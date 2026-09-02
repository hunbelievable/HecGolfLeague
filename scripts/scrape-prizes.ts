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

// ── CTP parsing ───────────────────────────────────────────────────────────────
// Page text format (after clicking CTP tab):
//   HOLE 5
//   AVG - 29.92 FT
//   BSTEFFY          ← player name line
//   6.46 FT          ← distance line
//   TLINDELL
//   23.27 FT
//
// Find distance-only lines (digits.digits FT), check the line above for a player name.
// Pick the minimum distance across all holes.

function parseCTPWinner(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let best: { player: string; dist: number } | null = null;

  for (let i = 1; i < lines.length; i++) {
    const distMatch = lines[i].match(/^([\d]+\.[\d]+)\s*FT$/i);
    if (!distMatch) continue;

    const dist = parseFloat(distMatch[1]);
    const player = normalizePlayer(lines[i - 1]);
    if (!player || isNaN(dist)) continue;
    if (!best || dist < best.dist) best = { player, dist };
  }

  return best?.player ?? null;
}

// ── Skins parsing ─────────────────────────────────────────────────────────────
// Page text format (after clicking SKINS tab):
//   HOLE 2
//   SCORE 4 |2 SKINS    ← N SKINS line
//   PIKEMATRICK          ← player name on next line
//
// Sum skin values per player; return the player with the highest total.

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

async function clickTabAndRead(page: Page, tabLabel: string): Promise<string | null> {
  // Tabs are not <button> elements — use text= locator
  const el = page.locator(`text=${tabLabel}`).first();
  if (await el.count() === 0) {
    console.log(`  Tab "${tabLabel}" not found on page`);
    return null;
  }
  await el.click();
  await page.waitForTimeout(2000);
  return page.evaluate(() => document.body.innerText);
}

async function main() {
  const force = process.argv.includes("--force");

  const userDataDir = process.env.CHROME_USER_DATA_DIR ||
    path.join(process.env.HOME || "", ".hec-golf-scraper-profile");

  let browser: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | Awaited<ReturnType<typeof chromium.launch>>;
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
      const existing = await prisma.weeklyPrize.findUnique({ where: { tournamentId } });
      if (existing?.ctpWinner && existing?.skinsWinner) {
        console.log("  Already have CTP + Skins — skipping (use --force to re-scrape)");
        continue;
      }
    }

    // Load the tournament page — tabs are loaded client-side from here
    await page.goto(`${BASE_URL}/tournament/${tournamentId}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    // ── CTP ──
    let ctpWinner: string | null = null;
    const ctpText = await clickTabAndRead(page, "CTP");
    if (ctpText) {
      ctpWinner = parseCTPWinner(ctpText);
      if (ctpWinner) {
        console.log(`  CTP winner: ${ctpWinner}`);
      } else {
        console.log("  CTP tab loaded but no winner parsed. Sample:");
        console.log(ctpText.slice(0, 600));
      }
    }

    // ── Skins ──
    let skinsWinner: string | null = null;
    const skinsText = await clickTabAndRead(page, "SKINS");
    if (skinsText) {
      skinsWinner = parseSkinsWinner(skinsText);
      if (skinsWinner) {
        console.log(`  Skins winner: ${skinsWinner}`);
      } else {
        console.log("  Skins tab loaded but no winner parsed. Sample:");
        console.log(skinsText.slice(0, 600));
      }
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
