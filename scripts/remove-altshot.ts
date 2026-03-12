import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
const players = ["BDizzle","NickP","holiday402","bsteffy","BozClubBreaker","TLindell"];
async function main() {
  const deleted = await prisma.result.deleteMany({ where: { tournamentId: 45853 } });
  console.log(`Deleted ${deleted.count} Week 5 alt shot rows`);
  console.log("\nGross totals (should match portal):");
  for (const p of players) {
    const rows = await prisma.result.findMany({ where: { playerId: p, type: "gross" } });
    console.log(`  ${p.padEnd(16)} ${rows.reduce((s,r)=>s+r.points,0)}`);
  }
  console.log("\nNet totals (should match portal):");
  for (const p of players) {
    const rows = await prisma.result.findMany({ where: { playerId: p, type: "net" } });
    console.log(`  ${p.padEnd(16)} ${rows.reduce((s,r)=>s+r.points,0)}`);
  }
}
main().catch(console.error).finally(()=>prisma.$disconnect());
