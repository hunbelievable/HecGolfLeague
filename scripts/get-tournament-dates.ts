import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const tournaments = await prisma.tournament.findMany({ orderBy: { date: "asc" } });
  console.log("id\tweek\tdate\t\t\tname");
  for (const t of tournaments) {
    const d = typeof t.date === "string" ? t.date : String(t.date);
    console.log(`${t.id}\t${t.week}\t${d.slice(0, 10)}\t${t.name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
