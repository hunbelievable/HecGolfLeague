/**
 * Add Week 5 Alt Shot (DPC County Down) results.
 * Run: npx tsx scripts/fix-altshot.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// Week 5 — DPC County Down (Alt Shot format)
// Gross: team-based (tied positions per team pair)
//   Scores from SGT portal: team1=+17, team2=+19, team3=+30
// Net: individually awarded by the league
const results = [
  { type: "gross", playerId: "holiday402",     position: 1, score: "+17", points: 500 },
  { type: "gross", playerId: "NickP",          position: 1, score: "+17", points: 500 },
  { type: "gross", playerId: "BDizzle",        position: 3, score: "+19", points: 190 },
  { type: "gross", playerId: "TLindell",       position: 3, score: "+19", points: 190 },
  { type: "gross", playerId: "BozClubBreaker", position: 5, score: "+30", points: 110 },
  { type: "gross", playerId: "bsteffy",        position: 5, score: "+30", points: 110 },
  { type: "net",   playerId: "TLindell",       position: 1, score: "—",   points: 500 },
  { type: "net",   playerId: "holiday402",     position: 2, score: "—",   points: 300 },
  { type: "net",   playerId: "NickP",          position: 2, score: "—",   points: 300 },
  { type: "net",   playerId: "BDizzle",        position: 4, score: "—",   points: 135 },
  { type: "net",   playerId: "BozClubBreaker", position: 5, score: "—",   points: 110 },
  { type: "net",   playerId: "bsteffy",        position: 6, score: "—",   points: 100 },
];

async function main() {
  for (const r of results) {
    await prisma.result.upsert({
      where: { tournamentId_playerId_type: { tournamentId: 45853, playerId: r.playerId, type: r.type } },
      update:  { position: r.position, score: r.score, points: r.points },
      create:  { tournamentId: 45853, playerId: r.playerId, type: r.type, position: r.position, score: r.score, points: r.points },
    });
    console.log(`  ${r.type.padEnd(5)} ${r.playerId.padEnd(16)} pos ${r.position} → ${r.points} pts`);
  }

  const players = ["BDizzle","NickP","holiday402","bsteffy","BozClubBreaker","TLindell"];
  console.log("\n--- Updated gross totals ---");
  for (const p of players) {
    const rows = await prisma.result.findMany({ where: { playerId: p, type: "gross" } });
    const total = rows.reduce((s, r) => s + r.points, 0);
    console.log(`  ${p.padEnd(16)} ${total}`);
  }
  console.log("\n--- Updated net totals ---");
  for (const p of players) {
    const rows = await prisma.result.findMany({ where: { playerId: p, type: "net" } });
    const total = rows.reduce((s, r) => s + r.points, 0);
    console.log(`  ${p.padEnd(16)} ${total}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
