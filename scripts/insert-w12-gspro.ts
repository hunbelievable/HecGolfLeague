/**
 * One-off: insert W12 GSPro shot data from /tmp/w12shots.json into the DB.
 * Run: npx tsx scripts/insert-w12-gspro.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
import fs from "fs";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const records = JSON.parse(fs.readFileSync("/tmp/w12shots.json", "utf8"));
  console.log(`Inserting ${records.length} shot records for W12...`);

  await prisma.launchMonitorShot.createMany({ data: records });

  console.log(`Done. ${records.length} shots inserted.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
