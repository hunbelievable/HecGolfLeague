import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

// Resolve DATABASE_URL to an absolute path — libsql requires absolute file: URIs
function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? `file:${path.resolve(process.cwd(), "dev.db")}`;
  if (raw.startsWith("file:") && !raw.startsWith("file:/")) {
    // Relative path like file:./dev.db or file:dev.db → make absolute
    const rel = raw.slice("file:".length);
    return `file:${path.resolve(process.cwd(), rel)}`;
  }
  return raw;
}

const adapter = new PrismaLibSql({ url: resolveDbUrl() });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
