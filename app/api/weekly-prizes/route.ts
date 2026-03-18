import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "asc" },
    include: { results: { where: { type: "net", position: 1 } } },
  });

  // Raw SQL so this works even if Prisma client was generated before WeeklyPrize was added
  const prizes = await prisma.$queryRaw<
    { tournamentId: number; skinsWinner: string | null; ctpWinner: string | null; netWinner: string | null }[]
  >`SELECT tournamentId, skinsWinner, ctpWinner, netWinner FROM WeeklyPrize`;

  const prizeMap = new Map(prizes.map((p) => [p.tournamentId, p]));

  const weeks = tournaments.map((t) => {
    const p = prizeMap.get(t.id);
    // Fall back to position-1 net result if no prize record set
    const derivedNet = t.results[0]?.playerId ?? null;
    return {
      tournamentId: t.id,
      week: t.week,
      name: t.name,
      date: t.date,
      isMajor: t.isMajor,
      skinsWinner: p?.skinsWinner ?? null,
      ctpWinner: p?.ctpWinner ?? null,
      netWinner: p?.netWinner ?? derivedNet,
    };
  });

  // Build totals per player
  const totals: Record<string, { skins: number; ctp: number; net: number }> = {};
  for (const w of weeks) {
    for (const [field, player] of [
      ["skins", w.skinsWinner],
      ["ctp", w.ctpWinner],
      ["net", w.netWinner],
    ] as [string, string | null][]) {
      if (!player) continue;
      if (!totals[player]) totals[player] = { skins: 0, ctp: 0, net: 0 };
      totals[player][field as "skins" | "ctp" | "net"]++;
    }
  }

  const leaderboard = Object.entries(totals)
    .map(([playerId, counts]) => ({ playerId, ...counts }))
    .sort((a, b) => (b.skins + b.ctp) - (a.skins + a.ctp) || b.net - a.net);

  return NextResponse.json({ weeks, leaderboard });
}
