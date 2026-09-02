/**
 * GSPro Round Discovery Script
 *
 * Auto-discovers round keys from portal.gsprogolf.com and adds them to
 * gspro-round-map.json for a given tournament. Run this right after each
 * Tuesday night session.
 *
 * Prerequisites:
 *   - Chrome running with --remote-debugging-port=9222
 *   - Logged into portal.gsprogolf.com in Chrome
 *
 * Usage:
 *   # Discover rounds for a tournament (defaults to last 7 days)
 *   npx tsx scripts/discover-gspro-rounds.ts --tournament-id 67662 --date 2026-09-07
 *
 *   # Find a player's GSPro GUID (for new players)
 *   npx tsx scripts/discover-gspro-rounds.ts --find-player PikeMatrick
 *
 * After running, commit the updated gspro-round-map.json, then run:
 *   npx tsx scripts/scrape-gspro.ts
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const GSPRO_BASE = "https://portal.gsprogolf.com";
const MAP_PATH = path.resolve(process.cwd(), "scripts/gspro-round-map.json");

interface RoundEntry {
  player: string;
  tournamentId: number;
  roundKey: string;
  roundBegin: string;
}

interface RoundMap {
  players: Record<string, string>;
  playerKeys?: Record<string, string>;
  rounds: RoundEntry[];
}

interface DiscoveredRound {
  roundKey: string;
  date: string;
  courseName?: string;
  playerCount?: number;
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    tournamentId: get("--tournament-id") ? parseInt(get("--tournament-id")!) : undefined,
    date: get("--date"),           // YYYY-MM-DD of the session
    daysBack: parseInt(get("--days-back") ?? "10"),
    findPlayer: get("--find-player"),
    dryRun: args.includes("--dry-run"),
  };
}

// ── CDP connection ────────────────────────────────────────────────────────────

async function connectToChrome() {
  const browser = await chromium.connectOverCDP("http://localhost:9222").catch(() => null);
  if (!browser) {
    console.error(
      "\n✗ Could not connect to Chrome.\n" +
      "  Start Chrome with:\n" +
      '  open -a "Google Chrome" --args --remote-debugging-port=9222\n' +
      "  Then log in to portal.gsprogolf.com and re-run this script.\n"
    );
    process.exit(1);
  }
  return browser;
}

async function findOrOpenGSProTab(browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>) {
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      if (p.url().includes("portal.gsprogolf.com")) return { page: p, ctx };
    }
  }
  // No tab found — open one
  console.log("No GSPro portal tab found — opening one...");
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${GSPRO_BASE}/analytics`, { waitUntil: "networkidle", timeout: 30000 });
  return { page, ctx };
}

// ── Round discovery ───────────────────────────────────────────────────────────

async function discoverRounds(
  page: { evaluate: Function },
  playerGuid: string,
  afterDate: Date
): Promise<DiscoveredRound[]> {
  const afterIso = afterDate.toISOString().slice(0, 10);

  // Try several endpoint patterns — the portal API isn't documented,
  // so we attempt the most likely shapes and take whichever returns data.
  const endpoints = [
    `/analytics/shots/LoadData?selectedPlayer=${encodeURIComponent(playerGuid)}&analyticsType=Rounds&refreshCache=false`,
    `/analytics/rounds/LoadData?selectedPlayer=${encodeURIComponent(playerGuid)}&refreshCache=false`,
    `/analytics/shots/LoadData?selectedPlayer=${encodeURIComponent(playerGuid)}&analyticsType=Rounds`,
  ];

  for (const endpoint of endpoints) {
    const result = await page.evaluate(
      async ({ base, ep }: { base: string; ep: string }) => {
        try {
          const resp = await fetch(`${base}${ep}`, { credentials: "include" });
          if (!resp.ok) return { ok: false, status: resp.status, endpoint: ep };
          const text = await resp.text();
          return { ok: true, text, endpoint: ep };
        } catch (e) {
          return { ok: false, error: String(e), endpoint: ep };
        }
      },
      { base: GSPRO_BASE, ep: endpoint }
    ) as { ok: boolean; text?: string; status?: number; error?: string; endpoint: string };

    if (!result.ok) {
      console.log(`  ${endpoint} → ${result.status ?? result.error}`);
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(result.text!);
    } catch {
      console.log(`  ${endpoint} → non-JSON response`);
      continue;
    }

    const rounds = extractRounds(data, afterIso);
    if (rounds.length > 0) {
      console.log(`  ✓ Found ${rounds.length} round(s) via ${endpoint}`);
      return rounds;
    }
    console.log(`  ${endpoint} → no rounds in date range`);
  }

  return [];
}

function extractRounds(data: unknown, afterDate: string): DiscoveredRound[] {
  const rounds: DiscoveredRound[] = [];
  if (!data || typeof data !== "object") return rounds;

  // Handle array of rounds directly
  if (Array.isArray(data)) {
    for (const item of data) {
      const r = tryParseRoundItem(item);
      if (r && r.date >= afterDate) rounds.push(r);
    }
    return rounds;
  }

  // Handle { Rounds_Rounds: [...] } or { Rounds: [...] } or { rounds: [...] } etc.
  const obj = data as Record<string, unknown>;
  for (const key of ["Rounds_Rounds", "Rounds", "rounds", "data", "Data", "Results", "results"]) {
    if (Array.isArray(obj[key])) {
      for (const item of obj[key] as unknown[]) {
        const r = tryParseRoundItem(item);
        if (r && r.date >= afterDate) rounds.push(r);
      }
      if (rounds.length > 0) return rounds;
    }
  }

  return rounds;
}

function tryParseRoundItem(item: unknown): DiscoveredRound | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  // Look for a UUID-shaped roundKey field under various names
  const keyField = ["roundKey", "RoundKey", "round_key", "key", "Key", "id", "Id", "roundId", "RoundId"]
    .find(f => typeof obj[f] === "string" && /^[0-9a-f-]{36}$/i.test(obj[f] as string));
  if (!keyField) return null;

  const roundKey = obj[keyField] as string;

  // Find the date field
  const dateField = ["roundBegin", "RoundBegin", "date", "Date", "created", "Created", "startDate", "StartDate",
    "roundDate", "RoundDate", "dateTime", "DateTime"]
    .find(f => typeof obj[f] === "string");

  const rawDate = dateField ? (obj[dateField] as string) : "";
  const date = rawDate ? rawDate.slice(0, 10) : "";

  const courseName = (obj["courseName"] ?? obj["CourseName"] ?? obj["course"] ?? obj["Course"]) as string | undefined;
  const playerCount = (obj["playerCount"] ?? obj["PlayerCount"]) as number | undefined;

  return { roundKey, date, courseName, playerCount };
}

// ── Player GUID discovery ─────────────────────────────────────────────────────

async function findPlayerGuid(
  page: { evaluate: Function },
  nameOrEmail: string
): Promise<void> {
  console.log(`\nSearching for player: ${nameOrEmail}`);

  const endpoints = [
    `/analytics/players?search=${encodeURIComponent(nameOrEmail)}`,
    `/api/players?q=${encodeURIComponent(nameOrEmail)}`,
    `/sgt-api/players?name=${encodeURIComponent(nameOrEmail)}`,
  ];

  for (const ep of endpoints) {
    const result = await page.evaluate(
      async ({ base, endpoint }: { base: string; endpoint: string }) => {
        try {
          const resp = await fetch(`${base}${endpoint}`, { credentials: "include" });
          if (!resp.ok) return null;
          return await resp.text();
        } catch { return null; }
      },
      { base: GSPRO_BASE, endpoint: ep }
    ) as string | null;

    if (!result) continue;
    try {
      const data = JSON.parse(result);
      console.log(`\n  Response from ${ep}:`);
      console.log(JSON.stringify(data, null, 2).slice(0, 2000));
      return;
    } catch {
      continue;
    }
  }

  console.log(
    "\n  Could not auto-discover player GUID.\n" +
    "  Manual steps:\n" +
    "  1. Log in to portal.gsprogolf.com\n" +
    "  2. Navigate to Analytics and select the player from the dropdown\n" +
    "  3. Open DevTools → Network → filter for 'LoadData'\n" +
    "  4. The 'selectedPlayer' URL param is their GUID\n"
  );
}

// ── Interactive confirmation ───────────────────────────────────────────────────

async function confirmRounds(
  rounds: DiscoveredRound[],
  allPlayers: string[],
  tournamentId: number,
  targetDate?: string
): Promise<{ roundKey: string; players: string[] } | null> {
  if (rounds.length === 0) {
    console.log("\n✗ No rounds found in the date range.");
    return null;
  }

  // If a target date is given, prefer exact matches
  let candidates = targetDate
    ? rounds.filter(r => r.date === targetDate)
    : rounds;

  if (candidates.length === 0) candidates = rounds;

  console.log(`\nDiscovered rounds:`);
  candidates.forEach((r, i) => {
    const info = [r.date, r.courseName, r.playerCount ? `${r.playerCount} players` : ""].filter(Boolean).join(" · ");
    console.log(`  [${i + 1}] ${r.roundKey.slice(0, 8)}...  ${info}`);
  });

  let chosen: DiscoveredRound;
  if (candidates.length === 1) {
    chosen = candidates[0];
    console.log(`\n  Auto-selecting the only match: ${chosen.roundKey}`);
  } else {
    // Pick the most recent one closest to target date
    chosen = candidates.sort((a, b) => b.date.localeCompare(a.date))[0];
    console.log(`\n  Selecting most recent: ${chosen.roundKey} (${chosen.date})`);
    console.log("  (Pass --date YYYY-MM-DD to be more precise)\n");
  }

  return { roundKey: chosen.roundKey, players: allPlayers };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const roundMap: RoundMap = JSON.parse(readFileSync(MAP_PATH, "utf-8"));

  const browser = await connectToChrome();
  const { page } = await findOrOpenGSProTab(browser);
  console.log(`Connected to: ${page.url()}`);

  // ── Mode: find player GUID ──
  if (args.findPlayer) {
    await findPlayerGuid(page, args.findPlayer);
    await browser.close();
    return;
  }

  // ── Mode: discover rounds ──
  if (!args.tournamentId) {
    console.error("✗ --tournament-id is required.\n  Example: --tournament-id 67662");
    await browser.close();
    process.exit(1);
  }

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - args.daysBack);

  const playerGuids = roundMap.players;
  const allPlayerIds = Object.keys(playerGuids);

  // Use the first player with a GUID to do the discovery (round keys are shared across players)
  const probePlayer = Object.entries(playerGuids).find(([, v]) => v)?.[0]!;
  const probeGuid = playerGuids[probePlayer];

  console.log(`\nDiscovering rounds for ${probePlayer} (${probeGuid.slice(0, 8)}...) after ${afterDate.toISOString().slice(0, 10)}...`);
  const discovered = await discoverRounds(page, probeGuid, afterDate);

  const selection = await confirmRounds(discovered, allPlayerIds, args.tournamentId, args.date);

  if (!selection) {
    console.log("\nNo changes made.");
    await browser.close();
    return;
  }

  const { roundKey, players } = selection;
  const roundDate = args.date ?? discovered.find(r => r.roundKey === roundKey)?.date ?? new Date().toISOString().slice(0, 10);

  // Find which players already have an entry for this tournament+roundKey
  const existing = new Set(
    roundMap.rounds
      .filter(r => r.tournamentId === args.tournamentId && r.roundKey === roundKey)
      .map(r => r.player)
  );

  const newEntries: RoundEntry[] = players
    .filter(p => playerGuids[p] && !existing.has(p))
    .map(p => ({
      player: p,
      tournamentId: args.tournamentId!,
      roundKey,
      roundBegin: roundDate,
    }));

  const skipped = players.filter(p => !playerGuids[p]);

  if (skipped.length > 0) {
    console.log(`\n⚠ Skipped (no GUID in round map): ${skipped.join(", ")}`);
    console.log(`  Add their GUIDs to gspro-round-map.json "players" section, then re-run.`);
    console.log(`  To find a GUID: npx tsx scripts/discover-gspro-rounds.ts --find-player <name>`);
  }

  if (newEntries.length === 0) {
    console.log("\n✓ All players already have entries for this tournament+roundKey. Nothing to add.");
    await browser.close();
    return;
  }

  console.log(`\nNew entries to add (${newEntries.length}):`);
  for (const e of newEntries) {
    console.log(`  ${e.player}  T${e.tournamentId}  ${e.roundKey.slice(0, 8)}...  ${e.roundBegin}`);
  }

  if (args.dryRun) {
    console.log("\n[Dry run — not writing file]");
  } else {
    roundMap.rounds.push(...newEntries);
    writeFileSync(MAP_PATH, JSON.stringify(roundMap, null, 2) + "\n");
    console.log(`\n✓ Updated ${MAP_PATH}`);
    console.log(`  Next: run  npx tsx scripts/scrape-gspro.ts`);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
