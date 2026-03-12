/**
 * GSPro Launch Monitor Shot Scraper
 *
 * Fetches shot data from portal.gsprogolf.com for all HEC league players
 * and upserts into the LaunchMonitorShot table.
 *
 * Prerequisites:
 *   - portal.gsprogolf.com must be open in Chrome and the user must be logged in
 *   - Run: npx tsx scripts/scrape-gspro.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
import { chromium } from "playwright";
import roundMap from "./gspro-round-map.json";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const GSPRO_BASE = "https://portal.gsprogolf.com";

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

async function fetchShotData(
  page: { evaluate: (fn: (args: { baseUrl: string; playerGuid: string; roundBegin: string }) => Promise<{ shots: ShotRow[]; measures: MeasureRow[] }>, args: { baseUrl: string; playerGuid: string; roundBegin: string }) => Promise<{ shots: ShotRow[]; measures: MeasureRow[] }> },
  playerGuid: string,
  roundBegin: string
): Promise<{ shots: ShotRow[]; measures: MeasureRow[] }> {
  return page.evaluate(
    async ({ baseUrl, playerGuid, roundBegin }) => {
      const url = `${baseUrl}/analytics/shots/LoadData?selectedPlayer=${playerGuid}&analyticsType=Shots&refreshCache=false&explicitFilter=true&roundBegins=${encodeURIComponent(roundBegin)}`;
      const resp = await fetch(url);
      const data = await resp.json();

      const shots: ShotRow[] = (data.PlayerShots || []).map((s: Record<string, unknown>) => ({
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

      const measures: MeasureRow[] = (data.PlayerShotMeasures || []).map((m: Record<string, unknown>) => ({
        shotKey: m.shotKey as string,
        measure: m.measure as string,
        value: m.value as number,
      }));

      return { shots, measures };
    },
    { baseUrl: GSPRO_BASE, playerGuid, roundBegin }
  );
}

function pivotMeasures(measures: MeasureRow[]): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const m of measures) {
    if (!map.has(m.shotKey)) map.set(m.shotKey, {});
    map.get(m.shotKey)![m.measure] = m.value;
  }
  return map;
}

async function main() {
  // Launch Playwright and connect to existing Chrome session via CDP
  // The user must have Chrome running with --remote-debugging-port=9222
  // OR we use the existing browser via a new context
  const browser = await chromium.connectOverCDP("http://localhost:9222").catch(() => null);

  if (!browser) {
    console.error(
      "Could not connect to Chrome via CDP.\n" +
      "Please ensure Chrome is running with --remote-debugging-port=9222\n" +
      "or use the alternative fetch approach."
    );
    process.exit(1);
  }

  // Find the GSPro tab or create a new context
  const contexts = browser.contexts();
  let page = null;
  for (const ctx of contexts) {
    const pages = ctx.pages();
    for (const p of pages) {
      if (p.url().includes("portal.gsprogolf.com")) {
        page = p;
        break;
      }
    }
    if (page) break;
  }

  if (!page) {
    console.error("Could not find a portal.gsprogolf.com tab. Please open it in Chrome.");
    await browser.close();
    process.exit(1);
  }

  console.log(`Found GSPro tab: ${page.url()}`);

  const playerGuids = roundMap.players as Record<string, string>;
  const rounds = roundMap.rounds;

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of rounds) {
    const { player, tournamentId, roundKey, roundBegin } = entry;
    const playerGuid = playerGuids[player];

    if (!playerGuid) {
      console.warn(`  No GUID for player ${player}, skipping`);
      continue;
    }

    // Check if we already have data for this player+tournament
    const existing = await prisma.launchMonitorShot.count({
      where: { tournamentId, playerId: player },
    });
    if (existing > 0) {
      console.log(`  ${player} T${tournamentId}: already has ${existing} shots, skipping`);
      skipped++;
      continue;
    }

    console.log(`Fetching: ${player} @ tournament ${tournamentId} (round ${roundKey.slice(0, 8)}...)`);

    try {
      const roundBeginTs = roundBegin + "T00:00:00Z";
      const { shots, measures } = await fetchShotData(
        page as Parameters<typeof fetchShotData>[0],
        playerGuid,
        // Find the actual roundBegin timestamp from the rounds list
        rounds.find(r => r.roundKey === roundKey && r.player === player)?.roundBegin + "T00:00:00Z" || roundBeginTs
      );

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

      await prisma.launchMonitorShot.createMany({ data, skipDuplicates: true });
      console.log(`  ✓ Inserted ${data.length} shots`);
      inserted += data.length;
    } catch (err) {
      console.error(`  ✗ Error: ${err}`);
      errors++;
    }

    // Small delay to avoid hammering the API
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
