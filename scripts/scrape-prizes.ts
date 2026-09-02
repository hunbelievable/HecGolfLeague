/**
 * Scrapes CTP and Skins winners from simulatorgolftour.com and writes them to WeeklyPrize.
 *
 * CTP winner  = player with the shortest distance to the pin across all CTP holes.
 * Skins winner = player with the most total skins (sum of skin values across holes).
 *
 * Run: npm run scrape-prizes
 * Force re-scrape: npm run scrape-prizes -- --force
 */

import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";

// Season 2 tournament IDs — add each week as the season progresses
const TOURNAMENT_IDS = [67662];

// Known player IDs — used for case-insensitive name normalisation
const KNOWN_PLAYERS = [
  "BDizzle", "NickP", "holiday402", "bsteffy", "BozClubBreaker", "TLindell",
  "PikeMatrick", "FavHoliday27", "HuskerRC13", "2FlumsUp",
];

function normalizePlayer(name: string): string | null {
  const lower = name.toLowerCase().trim();
  return KNOWN_PLAYERS.find(p => p.toLowerCase() === lower) ?? null;
}

// ── CTP parsing ──────────────────────────────────────────────────────────────
// Page text contains lines like:
//   HOLE 5
//   AVG - 20.92 FT
//   BSTEFFY  8.46 FT
//   TLINDELL  23.27 FT
//
// Find every "PLAYER  X.XX FT" line, pick the minimum distance overall.

function parseCTPWinner(text: string): string | null {
  const lineRe = /^(?!AVG)(.+?)\s+([\d]+\.[\d]+)\s*FT\s*$/gim;
  let best: { player: string; dist: number } | null = null;

  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) !== null) {
    const rawName = m[1].trim();
    const dist = parseFloat(m[2]);
    const player = normalizePlayer(rawName);
    if (!player || isNaN(dist)) continue;
    if (!best || dist < best.dist) best = { player, dist };
  }

  return best?.player ?? null;
}

// ── Skins parsing ─────────────────────────────────────────────────────────────
// Page text contains blocks like:
//   HOLE 2
//   SCORE 4 | 2 SKINS
//   PIKEMATRICK
//
// Find each "N SKINS" line, look at the next non-empty lines for a player name,
// sum skin counts per player, return the player with the most.

function parseSkinsWinner(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const totals: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const skinMatch = lines[i].match(/(\d+)\s+SKINS?/i);
    if (!skinMatch) continue;

    const skinCount = parseInt(skinMatch[1]);

    // Player name is on one of the next few lines
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const player = normalizePlayer(lines[j]);
      if (player) {
        totals[player] = (totals[player] ?? 0) + skinCount;
        break;
      }
    }
  }

  if (Object.keys(totals).length === 0) return null;
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
}

async function fetchPageText(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => document.body.innerText);
}

async function main() {
  const force = process.argv.includes("--force");

  const userDataDir = process.env.CHROME_USER_DATA_DIR ||
    path.join(process.env.HOME || "", ".hec-golf-scraper-profile");

  // Mirror the auth setup from scraper.ts
  let browser: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | Awaited<ReturnType<typeof chromium.launch>>;
  let page: Page;
  let useHeadless = false;

  try {
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      args: ["--no-first-run", "--no-default-browser-check"],
    });
    browser = ctx;
    page = ctx.pages()[0] || await ctx.newPage();
  } catch {
    console.log("Chrome profile unavailable — using headless browser");
    useHeadless = true;
    const b = await chromium.launch({ headless: true });
    browser = b;
    page = await b.newPage();
  }

  // Verify auth (same check as scraper.ts)
  console.log("Checking SGT authentication...");
  await page.goto(`${BASE_URL}/sgt-api/leaderboard/${TOURNAMENT_IDS[0]}/gross`, { waitUntil: "domcontentloaded", timeout: 15000 });
  const authText = await page.evaluate(() => document.body.innerText);
  const isUnauthenticated = !authText.includes("finished-card") &&
    (authText.toLowerCase().includes("login") || authText.toLowerCase().includes("sign in") || authText.length < 100);

  if (!useHeadless && isUnauthenticated) {
    console.log("Not authenticated — log in to SGT in the browser, then press Enter...");
    await new Promise(r => process.stdin.once("data", r));
  }

  for (const tournamentId of TOURNAMENT_IDS) {
    console.log(`\nTournament ${tournamentId}...`);

    if (!force) {
      const existing = await prisma.weeklyPrize.findUnique({ where: { tournamentId } });
      if (existing?.ctpWinner && existing?.skinsWinner) {
        console.log("  Already have CTP + Skins — skipping (use --force to re-scrape)");
        continue;
      }
    }

    // ── CTP ──
    let ctpWinner: string | null = null;
    try {
      const ctpText = await fetchPageText(page, `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/ctp`);
      ctpWinner = parseCTPWinner(ctpText);
      if (ctpWinner) {
        console.log(`  CTP winner: ${ctpWinner}`);
      } else {
        console.log("  CTP winner: not found — page sample:");
        console.log(ctpText.slice(0, 600));
      }
    } catch (err) {
      console.error("  CTP scrape error:", err);
    }

    // ── Skins ──
    let skinsWinner: string | null = null;
    try {
      const skinsText = await fetchPageText(page, `${BASE_URL}/sgt-api/leaderboard/${tournamentId}/skins`);
      skinsWinner = parseSkinsWinner(skinsText);
      if (skinsWinner) {
        console.log(`  Skins winner: ${skinsWinner}`);
      } else {
        console.log("  Skins winner: not found — page sample:");
        console.log(skinsText.slice(0, 600));
      }
    } catch (err) {
      console.error("  Skins scrape error:", err);
    }

    // ── Upsert ──
    if (ctpWinner || skinsWinner) {
      await prisma.weeklyPrize.upsert({
        where: { tournamentId },
        update: {
          ...(ctpWinner   ? { ctpWinner }   : {}),
          ...(skinsWinner ? { skinsWinner } : {}),
        },
        create: { tournamentId, ctpWinner, skinsWinner },
      });
      console.log("  Saved to WeeklyPrize.");
    } else {
      console.log("  No prize data found — nothing saved.");
    }

    await page.waitForTimeout(500);
  }

  await browser.close();
  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch(e => { console.error(e); process.exit(1); });
