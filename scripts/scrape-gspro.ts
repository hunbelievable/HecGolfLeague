/**
 * GSPro Launch Monitor Shot Scraper
 *
 * Fetches shot data from portal.gsprogolf.com for all HEC league players
 * and upserts into the LaunchMonitorShot table.
 *
 * Setup (one-time):
 *   Add to .env:
 *     GSPRO_EMAIL=your@email.com
 *     GSPRO_PASSWORD=yourpassword
 *
 * Run:
 *   npm run scrape-gspro
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
import { chromium, type Page } from "playwright";
import roundMap from "./gspro-round-map.json";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const dbPath = path.resolve(process.cwd(), "data/dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const GSPRO_BASE = "https://portal.gsprogolf.com";
const LOGIN_URL = `${GSPRO_BASE}/Identity/Account/Login`;

interface ShotRow {
  shotKey: string;
  hole: number;
  holeShot: number;
  globalShotNumber: number;
  clubName: string;
  shotResult: string | null;
  ballSpeed: number | null;
  carryDistance: number | null;
  totalDistance: number | null;
  distanceToPin: number | null;
  peakHeight: number | null;
  offline: number | null;
}

interface MeasureRow {
  shotKey: string;
  measure: string;
  value: number;
}

function parseShotData(data: Record<string, unknown>): { shots: ShotRow[]; measures: MeasureRow[] } {
  const shots: ShotRow[] = ((data.PlayerShots as Record<string, unknown>[]) || []).map((s) => ({
    shotKey: s.shotKey as string,
    hole: s.hole as number,
    holeShot: s.holeShot as number,
    globalShotNumber: s.globalShotNumber as number,
    clubName: s.clubName as string,
    shotResult: (s.shotResult as string) || null,
    ballSpeed: (s.ballSpeed as number) || null,
    carryDistance: (s.carryDistance as number) || null,
    totalDistance: (s.totalDistance as number) || null,
    distanceToPin: (s.distanceToPin as number) || null,
    peakHeight: (s.peakHeight as number) || null,
    offline: (s.offline as number) || null,
  }));
  const measures: MeasureRow[] = ((data.PlayerShotMeasures as Record<string, unknown>[]) || []).map((m) => ({
    shotKey: m.shotKey as string,
    measure: m.measure as string,
    value: m.value as number,
  }));
  return { shots, measures };
}

async function fetchShotData(
  page: Page,
  selectedPlayer: string,
  playerGuid: string,
  roundKey: string
): Promise<{ shots: ShotRow[]; measures: MeasureRow[] }> {
  const roundKeyPlayerKey = encodeURIComponent(`${roundKey}|${playerGuid}`);
  const url = `${GSPRO_BASE}/analytics/shots/LoadData?selectedPlayer=${encodeURIComponent(selectedPlayer)}&analyticsType=Shots&refreshCache=false&explicitFilter=true&roundKeyPlayerKey=${roundKeyPlayerKey}`;

  const data = await page.evaluate(async (fetchUrl: string) => {
    const resp = await fetch(fetchUrl, { credentials: "include" });
    return resp.json();
  }, url) as Record<string, unknown>;

  return parseShotData(data);
}

function pivotMeasures(measures: MeasureRow[]): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const m of measures) {
    if (!map.has(m.shotKey)) map.set(m.shotKey, {});
    map.get(m.shotKey)![m.measure] = m.value;
  }
  return map;
}

async function login(page: Page, email: string, password: string): Promise<void> {
  console.log("Logging in to GSPro portal...");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Debug: print all input names so we can fix selectors if needed
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => ({ name: i.name, type: i.type, id: i.id }))
  );
  console.log("  Form inputs found:", JSON.stringify(inputs));

  // Fill email — try multiple selector patterns
  const emailSel = await page.$('input[name="Input.Email"]') ?? await page.$('input[type="email"]') ?? await page.$('input[name="email"]');
  if (!emailSel) throw new Error("Could not find email input on login page");
  await emailSel.fill(email);

  const passSel = await page.$('input[name="Input.Password"]') ?? await page.$('input[type="password"]') ?? await page.$('input[name="password"]');
  if (!passSel) throw new Error("Could not find password input on login page");
  await passSel.fill(password);

  // Click submit and wait for navigation together to avoid race conditions
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);

  const finalUrl = page.url();
  console.log("  Post-login URL:", finalUrl);

  if (finalUrl.toLowerCase().includes("login")) {
    // Grab any error message from the page
    const err = await page.$eval(".validation-summary-errors, .text-danger", (el) => el.textContent?.trim()).catch(() => "");
    throw new Error(`Login failed${err ? ": " + err : " — check GSPRO_EMAIL and GSPRO_PASSWORD in .env"}`);
  }
  console.log("Logged in successfully.");
}

async function main() {
  const email = process.env.GSPRO_EMAIL;
  const password = process.env.GSPRO_PASSWORD;

  if (!email || !password) {
    console.error(
      "GSPRO_EMAIL and GSPRO_PASSWORD must be set in .env\n\n" +
      "Add these lines to your .env file:\n" +
      "  GSPRO_EMAIL=your@email.com\n" +
      "  GSPRO_PASSWORD=yourpassword\n"
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, email, password);
  } catch (err) {
    console.error(`Login error: ${err}`);
    await browser.close();
    process.exit(1);
  }

  const playerGuids = roundMap.players as Record<string, string>;
  const playerKeys = (roundMap as Record<string, unknown>).playerKeys as Record<string, string> | undefined;
  const rounds = roundMap.rounds;

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of rounds) {
    const { player, tournamentId, roundKey } = entry;
    const selectedPlayer = playerGuids[player];
    const playerGuid = playerKeys?.[player] ?? selectedPlayer;

    if (!selectedPlayer) {
      console.warn(`  No GUID for player ${player}, skipping`);
      continue;
    }

    const existing = await prisma.launchMonitorShot.count({
      where: { tournamentId, playerId: player, roundKey },
    });
    if (existing > 0) {
      console.log(`  ${player} T${tournamentId} ${roundKey.slice(0, 8)}: ${existing} shots already — skipping`);
      skipped++;
      continue;
    }

    console.log(`Fetching: ${player} @ T${tournamentId} (${roundKey.slice(0, 8)}...)`);

    try {
      const { shots, measures } = await fetchShotData(page, selectedPlayer, playerGuid, roundKey);

      if (shots.length === 0) {
        console.log(`  No shots found`);
        continue;
      }

      const measureMap = pivotMeasures(measures);

      const data = shots.map((shot) => {
        const m = measureMap.get(shot.shotKey) || {};
        return {
          tournamentId,
          playerId: player,
          roundKey,
          shotKey: shot.shotKey,
          hole: shot.hole,
          holeShot: shot.holeShot,
          globalShotNum: shot.globalShotNumber,
          clubName: shot.clubName || "",
          shotResult: shot.shotResult,
          ballSpeed: shot.ballSpeed ?? m["Ball Speed"] ?? null,
          carryDist: shot.carryDistance ?? m["Carry Dist"] ?? null,
          totalDist: shot.totalDistance ?? m["Total Dist"] ?? null,
          distToPin: shot.distanceToPin ?? null,
          peakHeight: shot.peakHeight ?? m["Peak Height"] ?? null,
          offline: shot.offline ?? m["Offline"] ?? null,
          clubSpeed: m["Club Speed"] ?? null,
          backSpin: m["Back Spin"] ?? null,
          spinAxis: m["Spin Axis"] ?? null,
          clubAoA: m["Club AoA"] ?? null,
          clubPath: m["Club Path"] ?? null,
          faceToPath: m["Face to Path"] ?? null,
          faceToTarget: m["Face to Target"] ?? null,
          descAngle: m["Desc Angle"] ?? null,
          hla: m["HLA"] ?? null,
          vla: m["VLA"] ?? null,
        };
      });

      await prisma.launchMonitorShot.createMany({ data });
      console.log(`  ✓ Inserted ${data.length} shots`);
      inserted += data.length;
    } catch (err) {
      console.error(`  ✗ Error: ${err}`);
      errors++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. Inserted: ${inserted} shots, skipped: ${skipped} player-rounds, errors: ${errors}`);
  await prisma.$disconnect();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
