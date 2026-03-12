/**
 * SGT Scraper — pulls live data from simulatorgolftour.com
 *
 * Authentication: Uses the user's existing Chrome session cookies.
 * Run: npm run scrape
 *
 * The scraper:
 * 1. Opens a browser using the user's existing Chrome profile (reads cookies automatically)
 * 2. Fetches gross + net leaderboard for each tournament
 * 3. Upserts results into the SQLite database
 *
 * If authentication fails, the script prints a login URL and waits for you to log in manually.
 */

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as cheerio from "cheerio";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";
const TOUR_ID = 2248;

const TOURNAMENT_IDS = [40579, 43157, 44078, 45169, 45853, 47001, 47836, 48674, 49707, 50643];

interface LeaderboardEntry {
  position: number;
  playerId: string;
  score: string;
  points: number;
}

async function parseLeaderboard(html: string): Promise<LeaderboardEntry[]> {
  const $ = cheerio.load(html);
  const entries: LeaderboardEntry[] = [];

  // SGT API returns an HTML fragment table — rows with position, name, score, points
  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;

    const posText = $(cells[0]).text().trim();
    const pos = parseInt(posText);
    if (isNaN(pos)) return;

    const playerCell = $(cells[1]).text().trim();
    const playerId = playerCell.split(/\s+/)[0]; // first token is username

    // Points are in the last cell
    const pointsText = $(cells[cells.length - 1]).text().trim().replace(/,/g, "");
    const points = parseFloat(pointsText) || 0;

    // Score — look for cells with +/- or "E"
    let score = "E";
    cells.each((_, cell) => {
      const text = $(cell).text().trim();
      if (/^[+-]\d+$/.test(text) || text === "E") {
        score = text;
      }
    });

    if (playerId && pos > 0) {
      entries.push({ position: pos, playerId, score, points });
    }
  });

  return entries;
}

async function main() {
  console.log("Launching browser with stored profile...");

  // Use a dedicated scraper profile so it doesn't conflict with running Chrome.
  const userDataDir = process.env.CHROME_USER_DATA_DIR ||
    path.join(process.env.HOME || "", ".hec-golf-scraper-profile");

  let browser;
  let useHeadless = false;

  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      args: ["--no-first-run", "--no-default-browser-check"],
    });
  } catch {
    console.log("Could not use Chrome profile, launching headless browser...");
    useHeadless = true;
    browser = await chromium.launch({ headless: true });
  }

  const page = useHeadless
    ? await (browser as Awaited<ReturnType<typeof chromium.launch>>).newPage()
    : browser.pages()[0] || await (browser as Awaited<ReturnType<typeof chromium.launchPersistentContext>>).newPage();

  // Check if we're authenticated
  await page.goto(`${BASE_URL}/sgt-api/tour/${TOUR_ID}/gross`, { waitUntil: "networkidle" });
  const content = await page.content();

  if (content.includes("login") || content.includes("sign in") || content.includes("unauthorized")) {
    console.log(`\nNot authenticated. Please visit: ${BASE_URL}/login`);
    console.log("Log in, then press Enter to continue...");
    await new Promise(resolve => process.stdin.once("data", resolve));
  }

  let successCount = 0;
  let errorCount = 0;

  for (const tournamentId of TOURNAMENT_IDS) {
    console.log(`\nScraping tournament ${tournamentId}...`);

    for (const type of ["gross", "net"] as const) {
      try {
        const url = `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/${type}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        const html = await page.content();
        const entries = await parseLeaderboard(html);

        if (entries.length === 0) {
          console.log(`  ${type}: no data found`);
          continue;
        }

        for (const entry of entries) {
          // Only save our 6 known players
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
          } catch {
            // Player might not exist in our DB — skip
          }
        }

        console.log(`  ${type}: saved ${entries.length} entries`);
        successCount++;
      } catch (err) {
        console.error(`  ${type} error:`, err);
        errorCount++;
      }
    }

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();
  await prisma.$disconnect();

  console.log(`\nDone. ${successCount} successful scrapes, ${errorCount} errors.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
