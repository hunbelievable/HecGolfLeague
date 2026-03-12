import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
const adapter = new PrismaLibSql({ url: `file:${path.resolve("dev.db")}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const total = await prisma.launchMonitorShot.count();
  console.log("Total LaunchMonitorShot rows:", total);

  const byPlayerTournament = await prisma.launchMonitorShot.groupBy({
    by: ["playerId", "tournamentId"],
    _count: true,
    orderBy: [{ playerId: "asc" }, { tournamentId: "asc" }],
  });

  console.log("\nPlayer / Tournament breakdown:");
  for (const r of byPlayerTournament) {
    console.log(`  ${r.playerId.padEnd(16)} T${r.tournamentId}  → ${r._count} shots`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
