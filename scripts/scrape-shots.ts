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

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";

// SGT user ID mapping
const PLAYER_SGT_IDS: Record<string, number> = {
  BDizzle:       32758,
  NickP:         32767,
  holiday402:    21975,
  bsteffy:       36710,
  BozClubBreaker: 36728,
  TLindell:      33297,
};

// 40579 = Week 1 (Cypress Point Club) — manually entered, no shot data on portal
const TOURNAMENT_IDS = [43157, 44078, 45169, 45853, 47001, 47836, 48674, 49707, 50643, 52153, 52918];

interface HoleData {
  holeNumber: number;
  par: number;
  shots: string[];
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

async function scrapeShotData(page: Page, tournamentId: number, playerId: string, sgtUserId: number): Promise<HoleData[] | null> {
  const url = `${BASE_URL}/scorecard/${tournamentId}/${sgtUserId}`;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });

    // Click SHOT DATA tab, then wait for shot descriptions to appear.
    // "N YDS TO [LIE]" patterns only exist in the SHOT DATA tab, not the scorecard tab.
    // We wait until the count stabilises — firing at exactly 18 means only 1 shot/hole
    // is rendered (1 "YDS TO" per hole). We want >=54 which implies >=3 per hole on avg.
    const shotDataTab = page.getByText("SHOT DATA", { exact: false });
    if (await shotDataTab.count() > 0) {
      await shotDataTab.first().click();
      // Wait for a generous number of "YDS TO" hits — each approach shot produces 1-2.
      // 54 = ~3 per hole × 18 holes, ensuring multiple shots per hole have rendered.
      await page.waitForFunction(
        () => (document.body.innerText.match(/\d+ YDS TO [A-Z]/g) || []).length >= 54,
        { timeout: 12000 }
      ).catch(() => {
        // Timeout is fine — grab whatever is there
      });
      // Brief extra pause for any remaining React renders
      await page.waitForTimeout(500);
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    const holes = parseShotDataFromText(bodyText);

    // Debug summary
    if (holes.length > 0) {
      const totalShots = holes.reduce((s, h) => s + h.shots.length, 0);
      process.stdout.write(`[${holes.length}H avg${(totalShots / holes.length).toFixed(1)}] `);
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

      // Save each hole
      for (const hole of holes) {
        await prisma.shotData.upsert({
          where: { tournamentId_playerId_holeNumber: { tournamentId, playerId, holeNumber: hole.holeNumber } },
          update: { par: hole.par, shots: JSON.stringify(hole.shots), shotsCount: hole.shots.length },
          create: { tournamentId, playerId, holeNumber: hole.holeNumber, par: hole.par, shots: JSON.stringify(hole.shots), shotsCount: hole.shots.length },
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
