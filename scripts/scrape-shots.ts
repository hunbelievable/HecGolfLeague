/**
 * Shot Data Scraper
 * Scrapes hole-by-hole shot data from simulatorgolftour.com/scorecard/{tournamentId}/{userId}
 * Uses the existing logged-in Chrome session.
 *
 * Run: npm run scrape-shots
 */

import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";

// SGT user ID mapping
const PLAYER_SGT_IDS: Record<string, number> = {
  // Season 1
  BDizzle:        32758,
  NickP:          32767,
  holiday402:     21975,
  bsteffy:        36710,
  BozClubBreaker: 36728,
  TLindell:       33297,
  // Season 2 new players
  PikeMatrick:    47246,
  FavHoliday27:   47402,
  HuskerRC13:     47232,
  "2FlumsUp":     47263,
};

// Season 1: 40579 = Week 1 (Cypress Point Club) — manually entered, no shot data on portal
const TOURNAMENT_IDS = [
  43157, 44078, 45169, 45853, 47001, 47836, 48674, 49707, 50643, 52153, 52918, // S1
  67662, // S2 Week 1 Kauri Cliffs
];

interface HoleData {
  holeNumber: number;
  par: number;
  shots: string[];
  actualScore?: number; // from scorecard table — more reliable than shots.length
}

function parseShotDataFromText(text: string): HoleData[] {
  const holes: HoleData[] = [];

  // Split by HOLE N pattern — use [ \t]+ (not \s+) between HOLE and the number
  // so we don't accidentally split on "152 YDS TO HOLE\n2" where "HOLE\n2" is
  // the end of a shot description, not a hole header.
  // Prepend \n so the first HOLE header is also matched by the \n prefix.
  const holeBlocks = ("\n" + text).split(/\nHOLE[ \t]+(\d+)[ \t]*\n/i).slice(1);

  for (let i = 0; i < holeBlocks.length; i += 2) {
    const holeNum = parseInt(holeBlocks[i]);
    const block = holeBlocks[i + 1] || "";

    // Extract par
    const parMatch = block.match(/PAR\s+(\d)/i);
    const par = parMatch ? parseInt(parMatch[1]) : 4;

    // Extract shots — lines matching "N yds to X, Y yds/ft to hole" or "Auto-putt"
    const shots: string[] = [];
    const lines = block.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Shot with distance info
      if (/\d+\s+yds?\s+to\s+\w/i.test(line) || /auto.?putt/i.test(line)) {
        // Strip leading shot index (e.g. "1 ") only when followed by another number (the distance)
        const cleaned = line.replace(/^\d+\s+(?=\d)/, "").trim();
        if (cleaned) shots.push(cleaned);
      }
    }

    if (holeNum && holeNum >= 1 && holeNum <= 18 && shots.length > 0) {
      holes.push({ holeNumber: holeNum, par, shots });
    }
  }

  // Deduplicate: multiple page sections (scorecard, stats, shot data) all repeat
  // HOLE N headers. Keep the entry with the most shots for each hole number.
  const holeMap = new Map<number, HoleData>();
  for (const hole of holes) {
    const existing = holeMap.get(hole.holeNumber);
    if (!existing || hole.shots.length > existing.shots.length) {
      holeMap.set(hole.holeNumber, hole);
    }
  }

  return Array.from(holeMap.values()).sort((a, b) => a.holeNumber - b.holeNumber);
}

// Read actual per-hole gross scores from the scorecard table (default tab).
// This is the authoritative source — penalty strokes are included here but
// may not appear in shot descriptions on the SHOT DATA tab.
async function scrapeActualScores(page: Page): Promise<Map<number, { par: number; score: number }>> {
  return page.evaluate(() => {
    const table = document.querySelector("table.scorecard-table");
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll("tr"));
    let holeRow: Element | null = null;
    let parRow: Element | null = null;
    let grossRow: Element | null = null;

    for (const row of rows) {
      const label = row.querySelector("td")?.textContent?.trim().toUpperCase();
      if (label === "HOLE")  holeRow  = row;
      if (label === "PAR")   parRow   = row;
      if (label === "GROSS") grossRow = row;
    }

    if (!holeRow || !parRow || !grossRow) return [];

    const cells = (row: Element) =>
      Array.from(row.querySelectorAll("td"))
        .slice(1) // skip label cell
        .map(td => td.textContent?.trim() ?? "")
        .filter(t => t !== "" && t.toUpperCase() !== "TOTAL");

    const holes  = cells(holeRow).map(Number);
    const pars   = cells(parRow).map(Number);
    const scores = cells(grossRow).map(Number);

    return holes.map((h, i) => ({ hole: h, par: pars[i], score: scores[i] }));
  }).then(rows => {
    const m = new Map<number, { par: number; score: number }>();
    for (const r of rows as { hole: number; par: number; score: number }[]) {
      if (r.hole && !isNaN(r.score)) m.set(r.hole, { par: r.par, score: r.score });
    }
    return m;
  });
}

async function scrapeShotData(page: Page, tournamentId: number, playerId: string, sgtUserId: number): Promise<HoleData[] | null> {
  const url = `${BASE_URL}/scorecard/${tournamentId}/${sgtUserId}`;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });

    // Read authoritative per-hole scores from the default scorecard table FIRST.
    const actualScores = await scrapeActualScores(page);

    // Click SHOT DATA tab for shot descriptions.
    const shotDataTab = page.getByText("SHOT DATA", { exact: false });
    if (await shotDataTab.count() > 0) {
      await shotDataTab.first().click();
      // For 9-hole rounds the threshold of 54 always times out — just wait a bit.
      await page.waitForFunction(
        () => (document.body.innerText.match(/\d+ YDS TO [A-Z]/g) || []).length >= 18,
        { timeout: 12000 }
      ).catch(() => {});
      await page.waitForTimeout(800);
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    const shotHoles = parseShotDataFromText(bodyText);

    // Merge: use actual scores as the authority for every hole the scorecard knows about.
    // For holes with shot descriptions, merge them in. For holes only in the scorecard
    // (shot tab failed to render), still create an entry with the correct score.
    const merged = new Map<number, HoleData>();

    // Seed from authoritative scores
    for (const [holeNum, { par, score }] of actualScores) {
      merged.set(holeNum, { holeNumber: holeNum, par, shots: [], actualScore: score });
    }

    // Overlay shot descriptions
    for (const h of shotHoles) {
      const existing = merged.get(h.holeNumber);
      if (existing) {
        existing.shots = h.shots;
      } else {
        merged.set(h.holeNumber, { ...h, actualScore: h.shots.length });
      }
    }

    const holes = Array.from(merged.values()).sort((a, b) => a.holeNumber - b.holeNumber);

    if (holes.length > 0) {
      process.stdout.write(`[${holes.length}H] `);
    }

    return holes.length > 0 ? holes : null;
  } catch (err) {
    console.error(`  Error scraping ${playerId} tournament ${tournamentId}:`, err);
    return null;
  }
}

async function main() {
  // Scorecard shot data is publicly accessible — no auth needed, use headless.
  console.log("Launching headless browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const force = process.argv.includes("--force");
  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (const tournamentId of TOURNAMENT_IDS) {
    console.log(`\nTournament ${tournamentId}...`);

    for (const [playerId, sgtUserId] of Object.entries(PLAYER_SGT_IDS)) {
      // Check if already scraped (skip unless --force)
      if (!force) {
        const existing = await prisma.shotData.findFirst({
          where: { tournamentId, playerId },
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      process.stdout.write(`  ${playerId}... `);
      const holes = await scrapeShotData(page, tournamentId, playerId, sgtUserId);

      if (!holes) {
        process.stdout.write("no data\n");
        errors++;
        continue;
      }

      // Save each hole — use actualScore (from scorecard table) as the authoritative count
      for (const hole of holes) {
        const shotsCount = hole.actualScore ?? hole.shots.length;
        await prisma.shotData.upsert({
          where: { tournamentId_playerId_holeNumber: { tournamentId, playerId, holeNumber: hole.holeNumber } },
          update: { par: hole.par, shots: JSON.stringify(hole.shots), shotsCount },
          create: { tournamentId, playerId, holeNumber: hole.holeNumber, par: hole.par, shots: JSON.stringify(hole.shots), shotsCount },
        });
      }

      saved += holes.length;
      process.stdout.write(`${holes.length} holes\n`);

      await page.waitForTimeout(300);
    }
  }

  await browser.close();
  await prisma.$disconnect();

  console.log(`\nDone. ${saved} hole records saved, ${skipped} already existed, ${errors} errors.`);
}

main().catch(e => { console.error(e); process.exit(1); });
