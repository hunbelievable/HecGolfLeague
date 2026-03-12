import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "asc" },
    include: { weeklyPrize: true },
  });

  const weeks = tournaments.map((t) => ({
    tournamentId: t.id,
    week: t.week,
    name: t.name,
    date: t.date,
    isMajor: t.isMajor,
    skinsWinner: (t.weeklyPrize as any)?.skinsWinner ?? null,
    ctpWinner: (t.weeklyPrize as any)?.ctpWinner ?? null,
    netWinner: (t.weeklyPrize as any)?.netWinner ?? null,
  }));

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
