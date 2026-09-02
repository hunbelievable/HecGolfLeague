import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get("season") ?? "2");

  const tournaments = await prisma.tournament.findMany({
    where: { season },
    orderBy: { date: "asc" },
  });

  // Raw SQL so this works even if Prisma client was generated before WeeklyPrize was added
  const prizes = await prisma.$queryRaw<
    { tournamentId: number; skinsWinner: string | null; ctpWinner: string | null }[]
  >`SELECT tournamentId, skinsWinner, ctpWinner FROM WeeklyPrize`;

  const prizeMap = new Map(prizes.map((p) => [p.tournamentId, p]));

  const weeks = tournaments.map((t) => {
    const p = prizeMap.get(t.id);
    return {
      tournamentId: t.id,
      week: t.week,
      name: t.name,
      date: t.date,
      isMajor: t.isMajor,
      skinsWinner: p?.skinsWinner ?? null,
      ctpWinner: p?.ctpWinner ?? null,
    };
  });

  // Build totals per player (CTP + Skins only)
  const totals: Record<string, { skins: number; ctp: number }> = {};
  for (const w of weeks) {
    for (const [field, player] of [
      ["skins", w.skinsWinner],
      ["ctp", w.ctpWinner],
    ] as [string, string | null][]) {
      if (!player) continue;
      if (!totals[player]) totals[player] = { skins: 0, ctp: 0 };
      totals[player][field as "skins" | "ctp"]++;
    }
  }

  const leaderboard = Object.entries(totals)
    .map(([playerId, counts]) => ({ playerId, ...counts }))
    .sort((a, b) => (b.skins + b.ctp) - (a.skins + a.ctp));

  return NextResponse.json({ weeks, leaderboard });
}
