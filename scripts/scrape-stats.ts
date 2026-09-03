/**
 * Scrapes STATISTICS and LONG DRIVE data from the SGT tournament page.
 *
 * Strategy: establish a session on the tournament page, then fetch each
 * stat API endpoint directly. Known stat names were discovered by probing
 * the VIEW ALL network requests on the STATISTICS tab.
 *
 * Run: npm run scrape-stats
 * Force re-scrape: npm run scrape-stats -- --force
 */

import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";

const TOURNAMENT_IDS = [67662];

const KNOWN_PLAYERS = [
  "BDizzle", "NickP", "holiday402", "bsteffy", "BozClubBreaker", "TLindell",
  "PikeMatrick", "FavHoliday27", "HuskerRC13", "2FlumsUp",
];

function normalizePlayer(name: string): string | null {
  const lower = name.trim().toLowerCase();
  return KNOWN_PLAYERS.find(p => p.toLowerCase() === lower) ?? null;
}

// Known stat endpoint names → PlayerRoundStats column
const STAT_ENDPOINTS: { name: string; col: string }[] = [
  { name: "scoringAverage",  col: "scoringAvg" },
  { name: "drivingDistance", col: "drivingDist" },
  { name: "fir",             col: "fir" },
  { name: "gir",             col: "gir" },
  { name: "sandSave",        col: "sandSave" },
  { name: "scrambling",      col: "scrambling" },
  { name: "puttsPerRound",   col: "puttsPerRound" },
  { name: "puttsPerGir",     col: "puttsPerGir" },
  { name: "girProximity",    col: "girProximity" },
];

// Fallback stat names to try if the primary name 404s
const STAT_ALIASES: Record<string, string[]> = {
  scoringAverage:  ["scoringAvg", "avgScore"],
  drivingDistance: ["drivingDist", "avgDrive"],
  puttsPerRound:   ["avgPutts", "puttingAvg"],
  girProximity:    ["approach"],
};

// Parse POS / PLAYER / VALUE lines returned by each stat endpoint.
// Format (text body): each player appears as three consecutive lines:
//   position_number
//   PLAYER_NAME
//   value (e.g. "39.0", "272.4 YDS", "54.3%", "6.5 FT")
function parseStatBody(text: string): Map<string, number> {
  const result = new Map<string, number>();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i + 2 < lines.length; i++) {
    const pos = parseInt(lines[i]);
    if (isNaN(pos) || pos <= 0) continue;

    const player = normalizePlayer(lines[i + 1]);
    const numMatch = lines[i + 2].match(/([\d.]+)/);
    if (player && numMatch) {
      result.set(player, parseFloat(numMatch[1]));
      i += 2; // skip the player and value lines
    }
  }

  return result;
}

// Fetch a URL using the browser's session (already on the tournament page).
// Returns the response body text, or null on non-200.
async function fetchWithSession(page: Page, url: string): Promise<string | null> {
  const result = await page.evaluate(async (fetchUrl: string) => {
    try {
      const res = await fetch(fetchUrl, { credentials: "include" });
      if (!res.ok) return { ok: false, status: res.status, body: null };
      const text = await res.text();
      return { ok: true, status: res.status, body: text };
    } catch (e) {
      return { ok: false, status: 0, body: null };
    }
  }, url);

  if (!result.ok) return null;
  return result.body;
}

async function scrapeStats(page: Page, tournamentId: number): Promise<number> {
  // Navigate to establish session / cookies
  await page.goto(`${BASE_URL}/tournament/${tournamentId}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(1500);

  // Click STATISTICS tab to prime any auth state it sets
  await page.locator("text=STATISTICS").first().click().catch(() => {});
  await page.waitForTimeout(1500);

  const playerStats = new Map<string, Record<string, number>>();
  let fetched = 0;

  for (const { name, col } of STAT_ENDPOINTS) {
    const url = `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/stats/${name}`;
    let body = await fetchWithSession(page, url);

    // Try aliases if primary name 404s
    if (body === null && STAT_ALIASES[name]) {
      for (const alias of STAT_ALIASES[name]) {
        const aliasUrl = `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/stats/${alias}`;
        body = await fetchWithSession(page, aliasUrl);
        if (body !== null) break;
      }
    }

    if (body === null) {
      console.log(`    ${name}: no data`);
      continue;
    }

    const values = parseStatBody(body);
    if (values.size === 0) {
      console.log(`    ${name}: parsed 0 values. Body snippet: ${body.slice(0, 80)}`);
      continue;
    }

    console.log(`    ${name}: ${values.size} players`);
    fetched++;

    for (const [player, value] of values) {
      if (!playerStats.has(player)) playerStats.set(player, {});
      playerStats.get(player)![col] = value;
    }
  }

  // Upsert all player stats
  for (const [playerId, stats] of playerStats) {
    await prisma.playerRoundStats.upsert({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      update: stats,
      create: { tournamentId, playerId, ...stats },
    });
  }

  console.log(`  Stats saved for ${playerStats.size} players (${fetched} stat types)`);
  return fetched;
}

async function scrapeLongDrive(page: Page, tournamentId: number): Promise<number> {
  // Try to get the long drive data. Endpoint options:
  // /sgt-api/leaderboard/{id}/ld/net  — all holes summary
  // /sgt-api/leaderboard/{id}/ld/{hole} — per-hole detail
  const summaryUrl = `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/ld/net`;
  let body = await fetchWithSession(page, summaryUrl);

  if (body === null) {
    // Try clicking the LONG DRIVE tab first to prime the endpoint
    await page.locator("text=LONG DRIVE").first().click().catch(() => {});
    await page.waitForTimeout(1500);
    body = await fetchWithSession(page, summaryUrl);
  }

  if (body === null) {
    console.log("  LONG DRIVE: no summary data from /ld/net");
    // Try per-hole endpoints 1–9
    let holesFound = 0;
    for (let hole = 1; hole <= 9; hole++) {
      const holeUrl = `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/ld/${hole}`;
      const holeBody = await fetchWithSession(page, holeUrl);
      if (holeBody) {
        const drives = parseStatBody(holeBody);
        for (const [playerId, distanceYds] of drives) {
          await prisma.longDrive.upsert({
            where: { tournamentId_holeNumber_playerId: { tournamentId, holeNumber: hole, playerId } },
            update: { distanceYds },
            create: { tournamentId, holeNumber: hole, playerId, distanceYds },
          });
        }
        if (drives.size > 0) holesFound++;
      }
    }
    console.log(`  LONG DRIVE: ${holesFound} holes from per-hole endpoints`);
    return holesFound;
  }

  // Parse the summary: format is "HOLE N\nAVG - X YDS\nPLAYER\nX YDS\n..."
  // or just "POS\nPLAYER\nX YDS" for the top entry per hole
  console.log(`  LONG DRIVE summary snippet: ${body.slice(0, 200)}`);

  const ldByHole = parseLongDriveSummary(body);
  let saved = 0;
  for (const [holeNumber, drives] of ldByHole) {
    for (const [playerId, distanceYds] of drives) {
      await prisma.longDrive.upsert({
        where: { tournamentId_holeNumber_playerId: { tournamentId, holeNumber, playerId } },
        update: { distanceYds },
        create: { tournamentId, holeNumber, playerId, distanceYds },
      });
      saved++;
    }
  }

  console.log(`  LONG DRIVE: saved ${saved} entries for ${ldByHole.size} holes`);
  return ldByHole.size;
}

// Parse long drive summary page body (format TBD — log it first)
function parseLongDriveSummary(text: string): Map<number, Map<string, number>> {
  const ldByHole = new Map<number, Map<string, number>>();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let currentHole: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    // "HOLE N" header
    const holeMatch = lines[i].match(/^HOLE\s+(\d+)$/i);
    if (holeMatch) {
      currentHole = parseInt(holeMatch[1]);
      if (!ldByHole.has(currentHole)) ldByHole.set(currentHole, new Map());
      continue;
    }

    if (currentHole === null) {
      // No HOLE header yet — try "POS" format (flat list with a hole column?)
      // Check if this is just a position number
      const pos = parseInt(lines[i]);
      if (!isNaN(pos) && pos > 0 && i + 2 < lines.length) {
        const player = normalizePlayer(lines[i + 1]);
        const distMatch = lines[i + 2].match(/([\d.]+)/);
        if (player && distMatch) {
          // No hole info in flat list — skip
          i += 2;
        }
      }
      continue;
    }

    // Skip AVG lines
    if (/^AVG\s*-/i.test(lines[i])) continue;

    // Expect: PLAYER_NAME then DISTANCE on next line
    const player = normalizePlayer(lines[i]);
    if (player && i + 1 < lines.length) {
      const distMatch = lines[i + 1].match(/([\d.]+)\s*YDS/i);
      if (distMatch) {
        ldByHole.get(currentHole)!.set(player, parseFloat(distMatch[1]));
        i++; // skip distance line
      }
    }
  }

  return ldByHole;
}

async function main() {
  const force = process.argv.includes("--force");

  const userDataDir = path.join(process.env.HOME || "", ".hec-golf-scraper-profile");
  let browser: any;
  let page: Page;

  try {
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      channel: "chrome",
      args: ["--no-first-run", "--no-default-browser-check"],
    });
    browser = ctx;
    page = ctx.pages()[0] || await ctx.newPage();
  } catch {
    console.log("Chrome profile unavailable — using headless browser");
    const b = await chromium.launch({ headless: true });
    browser = b;
    page = await b.newPage();
  }

  for (const tournamentId of TOURNAMENT_IDS) {
    console.log(`\nTournament ${tournamentId}...`);

    if (!force) {
      const existing = await prisma.playerRoundStats.findFirst({ where: { tournamentId } });
      if (existing) {
        console.log("  Already have stats — skipping (use --force to re-scrape)");
        continue;
      }
    }

    const statCount = await scrapeStats(page, tournamentId);
    const holeCount = await scrapeLongDrive(page, tournamentId);

    console.log(`\n  Done: ${statCount} stats, ${holeCount} LD holes`);
    await page.waitForTimeout(500);
  }

  await browser.close();
  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch(e => { console.error(e); process.exit(1); });
