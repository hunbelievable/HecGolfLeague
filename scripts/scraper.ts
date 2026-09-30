/**
 * SGT Scraper — pulls gross + net leaderboards from simulatorgolftour.com
 *
 * Run: npm run scrape
 *
 * No login needed. The /sgt-api/ endpoints return SGT's "OB" page unless the
 * request carries a PHPSESSID cookie that was issued by loading a tour or
 * tournament page (a cookie from the homepage doesn't work). So we load the
 * tour page once and send its cookie with every leaderboard request.
 *
 * For each tournament in TOURNAMENT_IDS:
 * 1. Creates the Tournament row if it's new (week, course, date from the SGT tournament page)
 * 2. Fetches the gross + net leaderboards
 * 3. Upserts results into the SQLite database
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as cheerio from "cheerio";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

// Season 1 (Spring 2026) — Tour 2248
// const SEASON_1_TOURNAMENT_IDS = [40579, 43157, 44078, 45169, 45853, 47001, 47836, 48674, 49707, 50643, 52153, 52918];

// Season 2 (Fall 2026) — Tour 3337
const TOUR_ID = 3337;
const SEASON = 2;
const TOURNAMENT_IDS = [67662, 71398, 72377, 74230, 74773];

interface LeaderboardEntry {
  position: number;
  playerId: string;
  score: string;
  points: number;
}

async function parseLeaderboard(html: string): Promise<LeaderboardEntry[]> {
  const $ = cheerio.load(html);
  const entries: LeaderboardEntry[] = [];

  // SGT full-page leaderboard — rows are tr.finished-card with data-player-name
  $("tr.finished-card").each((_, row) => {
    const playerId = $(row).attr("data-player-name") || "";
    if (!playerId) return;

    const posText = $(row).find("td.finished-only-position").first().text().trim();
    const pos = parseInt(posText);
    if (isNaN(pos)) return;

    const scoreText = $(row).find("td.total").first().text().trim();
    const score = /^[+-]\d+$/.test(scoreText) || scoreText === "E" ? scoreText : "E";

    // Points: first round cell (td[3])
    const cells = $(row).find("td");
    const pointsText = $(cells[3]).text().trim().replace(/,/g, "");
    const points = parseFloat(pointsText) || 0;

    entries.push({ position: pos, playerId, score, points });
  });

  return entries;
}

async function startSession(): Promise<string> {
  const res = await fetch(`${BASE_URL}/tour/${TOUR_ID}`, { headers: HEADERS });
  const cookie = res.headers.getSetCookie()
    .map(c => c.split(";")[0])
    .find(c => c.startsWith("PHPSESSID="));
  if (!cookie) throw new Error(`No PHPSESSID cookie from /tour/${TOUR_ID} (HTTP ${res.status})`);
  return cookie;
}

async function getText(url: string, cookie: string): Promise<string> {
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

// "September 24 - October 1, 2026" or "September 21 - 28, 2026" → "2026-10-01" / "2026-09-28".
// Events are dated by the day they close, matching the date on the SGT tour page.
function parseEndDate(range: string): string | null {
  const end = range.split(" - ").pop()!.trim();
  const d = new Date(/^\d/.test(end) ? `${range.split(" ")[0]} ${end}` : end);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Results need a Tournament row (foreign key), so create it from the tournament
// page header the first time we see a new event: <h1>Week 5</h1>, then course
// name and date range in .text-nowrap divs.
async function ensureTournament(tournamentId: number, cookie: string): Promise<void> {
  const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (existing) return;

  const $ = cheerio.load(await getText(`${BASE_URL}/tournament/${tournamentId}`, cookie));
  const header = $(".event-image").first();
  const week = header.find("h1").first().text().trim();
  const [name, range] = header.find(".text-nowrap").map((_, el) => $(el).text().trim()).get();
  const date = range ? parseEndDate(range) : null;
  if (!week || !name || !date) {
    throw new Error(`Couldn't read week/course/date from /tournament/${tournamentId} (got "${week}", "${name}", "${range}")`);
  }

  await prisma.tournament.create({ data: { id: tournamentId, name, week, date, season: SEASON } });
  console.log(`  New event: ${week} — ${name}, ${date}`);
}

async function main() {
  console.log("Starting SGT session...");
  const cookie = await startSession();

  let successCount = 0;
  let errorCount = 0;

  for (const tournamentId of TOURNAMENT_IDS) {
    console.log(`\nScraping tournament ${tournamentId}...`);

    try {
      await ensureTournament(tournamentId, cookie);
    } catch (err) {
      console.error(`  ${(err as Error).message}`);
      errorCount++;
      continue;
    }

    for (const type of ["gross", "net"] as const) {
      try {
        const html = await getText(`${BASE_URL}/sgt-api/leaderboard/${tournamentId}/${type}`, cookie);
        const entries = await parseLeaderboard(html);

        if (entries.length === 0) {
          const ob = html.includes("Simulator Golf Tour | OB");
          console.log(`  ${type}: no results${ob ? " — SGT returned its OB page (session not accepted)" : ""}`);
          errorCount++;
          continue;
        }

        let saved = 0;
        for (const entry of entries) {
          try {
            await prisma.result.upsert({
              where: {
                tournamentId_playerId_type: {
                  tournamentId,
                  playerId: entry.playerId,
                  type,
                },
              },
              update: {
                position: entry.position,
                score: entry.score,
                points: entry.points,
              },
              create: {
                tournamentId,
                playerId: entry.playerId,
                type,
                position: entry.position,
                score: entry.score,
                points: entry.points,
              },
            });
            saved++;
          } catch {
            // Player isn't in the Player table yet — add them, then re-run
            console.log(`  ${type}: skipped ${entry.playerId} (not in Player table)`);
          }
        }

        console.log(`  ${type}: saved ${saved} of ${entries.length} entries`);
        successCount++;
      } catch (err) {
        console.error(`  ${type} error:`, err);
        errorCount++;
      }
    }

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  await prisma.$disconnect();

  console.log(`\nDone. ${successCount} successful scrapes, ${errorCount} errors.`);
  if (errorCount > 0) process.exitCode = 1;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
