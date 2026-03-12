/**
 * Fix Results Data
 * Upserts all tournament results with accurate data confirmed from the SGT portal.
 * Tournament 45853 (Week 5 - DPC County Down) was ALT SHOT format — no individual
 * points awarded — so its Result rows are deleted.
 *
 * Run: npx tsx scripts/fix-results.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

interface ResultEntry {
  playerId: string;
  position: number;
  score: string;
  points: number;
}

interface TournamentResults {
  tournamentId: number;
  gross: ResultEntry[];
  net: ResultEntry[];
}

// All data confirmed against SGT portal leaderboard API.
// Gross totals validated against /sgt-api/tour/2248/gross:
//   BDizzle 4090, NickP 2165, holiday402 1745, bsteffy 1730, BozClubBreaker 1355, TLindell 1115
// Net totals validated against /sgt-api/tour/2248/net:
//   BDizzle 3135, TLindell 2370, NickP 2155, holiday402 1680, BozClubBreaker 1555, bsteffy 1305
const CONFIRMED_RESULTS: TournamentResults[] = [
  {
    // Week 1 — Cypress Point Club (manually entered, no shot data on portal)
    // Net leaderboard shows same scores as gross (no HCP applied in SGT for this event)
    tournamentId: 40579,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+13", points: 500 },
      { playerId: "BozClubBreaker", position: 2, score: "+14", points: 300 },
      { playerId: "bsteffy",        position: 3, score: "+14", points: 190 },
      { playerId: "holiday402",     position: 4, score: "+15", points: 135 },
      { playerId: "NickP",          position: 5, score: "+16", points: 110 },
      { playerId: "TLindell",       position: 6, score: "+26", points: 100 },
    ],
    net: [
      { playerId: "BDizzle",        position: 1, score: "+13", points: 500 },
      { playerId: "BozClubBreaker", position: 2, score: "+14", points: 300 },
      { playerId: "bsteffy",        position: 3, score: "+14", points: 190 },
      { playerId: "holiday402",     position: 4, score: "+15", points: 135 },
      { playerId: "NickP",          position: 5, score: "+16", points: 110 },
      { playerId: "TLindell",       position: 6, score: "+26", points: 100 },
    ],
  },
  {
    // Week 2 — Turnberry Ailsa
    tournamentId: 43157,
    gross: [
      { playerId: "NickP",          position: 1, score: "+22", points: 500 },
      { playerId: "holiday402",     position: 2, score: "+29", points: 300 },
      { playerId: "BDizzle",        position: 3, score: "+38", points: 190 },
      { playerId: "BozClubBreaker", position: 4, score: "+39", points: 135 },
      { playerId: "bsteffy",        position: 5, score: "+42", points: 110 },
      { playerId: "TLindell",       position: 6, score: "+47", points: 100 },
    ],
    net: [
      { playerId: "NickP",          position: 1, score: "+11", points: 500 },
      { playerId: "holiday402",     position: 2, score: "+18", points: 300 },
      { playerId: "BozClubBreaker", position: 3, score: "+29", points: 190 },
      { playerId: "TLindell",       position: 4, score: "+30", points: 135 },
      { playerId: "BDizzle",        position: 5, score: "+31", points: 110 },
      { playerId: "bsteffy",        position: 6, score: "+34", points: 100 },
    ],
  },
  {
    // Week 3 — Augusta National
    tournamentId: 44078,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+13", points: 500 },
      { playerId: "holiday402",     position: 2, score: "+19", points: 300 },
      { playerId: "BozClubBreaker", position: 3, score: "+24", points: 190 },
      { playerId: "bsteffy",        position: 4, score: "+25", points: 135 },
      { playerId: "NickP",          position: 5, score: "+28", points: 110 },
      { playerId: "TLindell",       position: 6, score: "+30", points: 100 },
    ],
    net: [
      { playerId: "BDizzle",        position: 1, score: "+6",  points: 500 },
      { playerId: "holiday402",     position: 2, score: "+8",  points: 300 },
      { playerId: "TLindell",       position: 3, score: "+13", points: 190 },
      { playerId: "BozClubBreaker", position: 4, score: "+14", points: 135 },
      { playerId: "bsteffy",        position: 5, score: "+17", points: 110 },
      { playerId: "NickP",          position: 6, score: "+17", points: 100 },
    ],
  },
  {
    // Week 4 — Pine Valley
    tournamentId: 45169,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+7",  points: 500 },
      { playerId: "bsteffy",        position: 2, score: "+14", points: 300 },
      { playerId: "NickP",          position: 3, score: "+14", points: 190 },
      { playerId: "TLindell",       position: 4, score: "+16", points: 135 },
      { playerId: "BozClubBreaker", position: 5, score: "+17", points: 110 },
      { playerId: "holiday402",     position: 6, score: "+21", points: 100 },
    ],
    net: [
      { playerId: "TLindell",       position: 1, score: "-1",  points: 500 },
      { playerId: "BDizzle",        position: 2, score: "E",   points: 300 },
      { playerId: "NickP",          position: 3, score: "+3",  points: 190 },
      { playerId: "bsteffy",        position: 4, score: "+6",  points: 135 },
      { playerId: "BozClubBreaker", position: 5, score: "+7",  points: 110 },
      { playerId: "holiday402",     position: 6, score: "+10", points: 100 },
    ],
  },
  // Week 5 — DPC County Down: ALT SHOT format — handled separately (rows deleted)
  {
    // Week 6 — St Andrews Old Course
    tournamentId: 47001,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+8",  points: 500 },
      { playerId: "NickP",          position: 2, score: "+11", points: 300 },
      { playerId: "holiday402",     position: 3, score: "+17", points: 190 },
      { playerId: "bsteffy",        position: 4, score: "+17", points: 135 },
      { playerId: "TLindell",       position: 5, score: "+17", points: 110 },
      { playerId: "BozClubBreaker", position: 6, score: "+33", points: 100 },
    ],
    net: [
      { playerId: "NickP",          position: 1, score: "E",   points: 500 },
      { playerId: "BDizzle",        position: 2, score: "+1",  points: 300 },
      { playerId: "TLindell",       position: 3, score: "+2",  points: 190 },
      { playerId: "holiday402",     position: 4, score: "+6",  points: 135 },
      { playerId: "bsteffy",        position: 5, score: "+9",  points: 110 },
      { playerId: "BozClubBreaker", position: 6, score: "+23", points: 100 },
    ],
  },
  {
    // Week 7 — Renaissance Club
    tournamentId: 47836,
    gross: [
      { playerId: "bsteffy",        position: 1, score: "+9",  points: 500 },
      { playerId: "BDizzle",        position: 2, score: "+10", points: 300 },
      { playerId: "TLindell",       position: 3, score: "+14", points: 190 },
      { playerId: "NickP",          position: 4, score: "+14", points: 135 },
      { playerId: "holiday402",     position: 5, score: "+15", points: 110 },
      { playerId: "BozClubBreaker", position: 6, score: "+15", points: 100 },
    ],
    net: [
      { playerId: "TLindell",       position: 1, score: "-1",  points: 500 },
      { playerId: "bsteffy",        position: 2, score: "+1",  points: 300 },
      { playerId: "BDizzle",        position: 3, score: "+3",  points: 190 },
      { playerId: "NickP",          position: 4, score: "+3",  points: 135 },
      { playerId: "holiday402",     position: 5, score: "+4",  points: 110 },
      { playerId: "BozClubBreaker", position: 6, score: "+5",  points: 100 },
    ],
  },
  {
    // Week 8 — Pebble Beach
    tournamentId: 48674,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+7",  points: 500 },
      { playerId: "holiday402",     position: 2, score: "+9",  points: 300 },
      { playerId: "NickP",          position: 3, score: "+10", points: 190 },
      { playerId: "TLindell",       position: 4, score: "+11", points: 135 },
      { playerId: "BozClubBreaker", position: 5, score: "+11", points: 110 },
      { playerId: "bsteffy",        position: 6, score: "+18", points: 100 },
    ],
    net: [
      { playerId: "TLindell",       position: 1, score: "-4",  points: 500 },
      { playerId: "holiday402",     position: 2, score: "-3",  points: 300 },
      { playerId: "BozClubBreaker", position: 3, score: "-2",  points: 190 },
      { playerId: "BDizzle",        position: 4, score: "-1",  points: 135 },
      { playerId: "NickP",          position: 5, score: "-1",  points: 110 },
      { playerId: "bsteffy",        position: 6, score: "+8",  points: 100 },
    ],
  },
  {
    // Week 9 — Whistling Straits
    tournamentId: 49707,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+2",  points: 500 },
      { playerId: "NickP",          position: 2, score: "+11", points: 300 },
      { playerId: "holiday402",     position: 3, score: "+18", points: 190 },
      { playerId: "TLindell",       position: 4, score: "+22", points: 135 },
      { playerId: "bsteffy",        position: 5, score: "+23", points: 110 },
      { playerId: "BozClubBreaker", position: 6, score: "+26", points: 100 },
    ],
    net: [
      { playerId: "BDizzle",        position: 1, score: "-4",  points: 500 },
      { playerId: "NickP",          position: 2, score: "+2",  points: 300 },
      { playerId: "holiday402",     position: 3, score: "+10", points: 190 },
      { playerId: "TLindell",       position: 4, score: "+11", points: 135 },
      { playerId: "bsteffy",        position: 5, score: "+14", points: 110 },
      { playerId: "BozClubBreaker", position: 6, score: "+18", points: 100 },
    ],
  },
  {
    // Week 10 — MAJOR (Oakmont) — 1.2× points: 600/330/210/150/120/110
    tournamentId: 50643,
    gross: [
      { playerId: "BDizzle",        position: 1, score: "+11", points: 600 },
      { playerId: "NickP",          position: 2, score: "+20", points: 330 },
      { playerId: "BozClubBreaker", position: 3, score: "+21", points: 210 },
      { playerId: "bsteffy",        position: 4, score: "+27", points: 150 },
      { playerId: "holiday402",     position: 5, score: "+31", points: 120 },
      { playerId: "TLindell",       position: 6, score: "+31", points: 110 },
    ],
    net: [
      { playerId: "BDizzle",        position: 1, score: "+9",  points: 600 },
      { playerId: "BozClubBreaker", position: 2, score: "+13", points: 330 },
      { playerId: "NickP",          position: 3, score: "+13", points: 210 },
      { playerId: "bsteffy",        position: 4, score: "+18", points: 150 },
      { playerId: "TLindell",       position: 5, score: "+21", points: 120 },
      { playerId: "holiday402",     position: 6, score: "+23", points: 110 },
    ],
  },
];

async function main() {
  let upserted = 0;
  let deleted = 0;

  // Upsert all confirmed results
  for (const tournament of CONFIRMED_RESULTS) {
    const { tournamentId, gross, net } = tournament;
    process.stdout.write(`Tournament ${tournamentId}...`);

    for (const entry of gross) {
      await prisma.result.upsert({
        where: { tournamentId_playerId_type: { tournamentId, playerId: entry.playerId, type: "gross" } },
        update:  { position: entry.position, score: entry.score, points: entry.points },
        create:  { tournamentId, playerId: entry.playerId, type: "gross", position: entry.position, score: entry.score, points: entry.points },
      });
      upserted++;
    }

    for (const entry of net) {
      await prisma.result.upsert({
        where: { tournamentId_playerId_type: { tournamentId, playerId: entry.playerId, type: "net" } },
        update:  { position: entry.position, score: entry.score, points: entry.points },
        create:  { tournamentId, playerId: entry.playerId, type: "net", position: entry.position, score: entry.score, points: entry.points },
      });
      upserted++;
    }

    console.log(` ${gross.length} gross + ${net.length} net`);
  }

  // Delete Week 5 (45853) individual results — ALT SHOT team format, no individual points
  const altShotDeleted = await prisma.result.deleteMany({ where: { tournamentId: 45853 } });
  deleted = altShotDeleted.count;
  console.log(`\nTournament 45853 (Alt Shot): deleted ${deleted} stale individual result rows`);

  console.log(`\nDone. ${upserted} rows upserted, ${deleted} rows deleted.`);

  // Verify gross totals
  console.log("\n--- Gross points verification ---");
  const players = ["BDizzle", "NickP", "holiday402", "bsteffy", "BozClubBreaker", "TLindell"];
  for (const p of players) {
    const rows = await prisma.result.findMany({ where: { playerId: p, type: "gross" } });
    const total = rows.reduce((s, r) => s + r.points, 0);
    console.log(`  ${p.padEnd(16)} ${total}`);
  }

  console.log("\n--- Net points verification ---");
  for (const p of players) {
    const rows = await prisma.result.findMany({ where: { playerId: p, type: "net" } });
    const total = rows.reduce((s, r) => s + r.points, 0);
    console.log(`  ${p.padEnd(16)} ${total}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
