/**
 * Final season data update:
 * 1. Fix W5 (DPC County Down, 45853) — alt-shot format, seed data was wrong
 * 2. Add W12 (Dismal River Red, 52918) — tournament + all results
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const W5_GROSS = [
  { playerId: "NickP",          position: 1, score: "+17", points: 500 },
  { playerId: "holiday402",     position: 2, score: "+17", points: 500 },
  { playerId: "BDizzle",        position: 3, score: "+19", points: 190 },
  { playerId: "TLindell",       position: 4, score: "+19", points: 190 },
  { playerId: "bsteffy",        position: 5, score: "+30", points: 110 },
  { playerId: "BozClubBreaker", position: 6, score: "+30", points: 110 },
];

const W5_NET = [
  { playerId: "TLindell",       position: 1, score: "+4",  points: 500 },
  { playerId: "NickP",          position: 2, score: "+6",  points: 300 },
  { playerId: "holiday402",     position: 3, score: "+6",  points: 300 },
  { playerId: "BDizzle",        position: 4, score: "+12", points: 135 },
  { playerId: "BozClubBreaker", position: 5, score: "+20", points: 110 },
  { playerId: "bsteffy",        position: 6, score: "+22", points: 100 },
];

const W12_GROSS = [
  { playerId: "BDizzle",        position: 1, score: "+2",  points: 2500 },
  { playerId: "NickP",          position: 2, score: "+8",  points: 1500 },
  { playerId: "BozClubBreaker", position: 3, score: "+16", points: 950  },
  { playerId: "TLindell",       position: 4, score: "+16", points: 675  },
  { playerId: "bsteffy",        position: 5, score: "+17", points: 550  },
  { playerId: "holiday402",     position: 6, score: "+18", points: 500  },
];

const W12_NET = [
  { playerId: "BDizzle",        position: 1, score: "-1",  points: 2500 },
  { playerId: "NickP",          position: 2, score: "E",   points: 1500 },
  { playerId: "TLindell",       position: 3, score: "+5",  points: 950  },
  { playerId: "BozClubBreaker", position: 4, score: "+7",  points: 675  },
  { playerId: "bsteffy",        position: 5, score: "+7",  points: 550  },
  { playerId: "holiday402",     position: 6, score: "+10", points: 500  },
];

async function main() {
  // --- W5: Fix alt-shot results ---
  console.log("Fixing W5 (DPC County Down, alt-shot)...");
  for (const r of W5_GROSS) {
    await prisma.result.upsert({
      where: { tournamentId_playerId_type: { tournamentId: 45853, playerId: r.playerId, type: "gross" } },
      update: { position: r.position, score: r.score, points: r.points },
      create: { tournamentId: 45853, type: "gross", ...r },
    });
  }
  for (const r of W5_NET) {
    await prisma.result.upsert({
      where: { tournamentId_playerId_type: { tournamentId: 45853, playerId: r.playerId, type: "net" } },
      update: { position: r.position, score: r.score, points: r.points },
      create: { tournamentId: 45853, type: "net", ...r },
    });
  }
  console.log("  W5 done.");

  // --- W12: Add Dismal River tournament + results ---
  console.log("Adding W12 (Dismal River Red, 52918)...");
  await prisma.tournament.upsert({
    where: { id: 52918 },
    update: { name: "Dismal River (Red)", week: "Week 12", date: "2026-03-25", isMajor: false },
    create: { id: 52918, name: "Dismal River (Red)", week: "Week 12", date: "2026-03-25", isMajor: false },
  });
  for (const r of W12_GROSS) {
    await prisma.result.upsert({
      where: { tournamentId_playerId_type: { tournamentId: 52918, playerId: r.playerId, type: "gross" } },
      update: { position: r.position, score: r.score, points: r.points },
      create: { tournamentId: 52918, type: "gross", ...r },
    });
  }
  for (const r of W12_NET) {
    await prisma.result.upsert({
      where: { tournamentId_playerId_type: { tournamentId: 52918, playerId: r.playerId, type: "net" } },
      update: { position: r.position, score: r.score, points: r.points },
      create: { tournamentId: 52918, type: "net", ...r },
    });
  }
  console.log("  W12 done.");

  console.log("\nAll updates complete!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
