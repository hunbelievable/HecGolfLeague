import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import path from "path";

const adapter = new PrismaLibSql({ url: `file:${path.resolve("dev.db")}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  // Look for the downloaded file in Downloads folder
  const candidates = [
    path.join(process.env.HOME!, "Downloads/hec-lm-shots.json"),
    path.join(process.cwd(), "hec-lm-shots.json"),
  ];

  let filePath = "";
  for (const c of candidates) {
    try { readFileSync(c); filePath = c; break; } catch {}
  }

  if (!filePath) {
    console.error("Could not find hec-lm-shots.json in Downloads or project root");
    process.exit(1);
  }

  console.log(`Reading from: ${filePath}`);
  const records = JSON.parse(readFileSync(filePath, "utf-8"));
  console.log(`Records to import: ${records.length}`);

  // Upsert in batches using shotKey as unique key
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Promise.all(batch.map((rec: typeof records[0]) =>
      prisma.launchMonitorShot.upsert({
        where: { shotKey: rec.shotKey },
        create: rec,
        update: rec,
      })
    ));
    total += batch.length;
    process.stdout.write(`\r  Upserted ${total}/${records.length}...`);
  }

  console.log(`\nDone! Inserted ${total} shots.`);

  // Summary by player
  const byPlayer = await prisma.launchMonitorShot.groupBy({ by: ["playerId"], _count: true });
  console.log("\nBy player:");
  for (const r of byPlayer) console.log(`  ${r.playerId}: ${r._count} shots`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
