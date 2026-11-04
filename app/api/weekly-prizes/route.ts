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

  // skinsWinner "PUSH" = tie for most skins; that week's skins prize carries
  // over, so the next outright winner also collects every pushed week before it.
  let carry = 0;
  const weeks = tournaments.map((t) => {
    const p = prizeMap.get(t.id);
    const raw = p?.skinsWinner ?? null;
    const skinsPush = raw === "PUSH";
    const skinsWinner = skinsPush ? null : raw;
    let skinsCarryIn = 0;
    if (skinsPush) carry++;
    else if (skinsWinner) { skinsCarryIn = carry; carry = 0; }
    return {
      tournamentId: t.id,
      week: t.week,
      name: t.name,
      date: t.date,
      isMajor: t.isMajor,
      skinsWinner,
      skinsPush,
      skinsCarryIn,
      ctpWinner: p?.ctpWinner ?? null,
    };
  });

  // Build totals per player (CTP + Skins only)
  const totals: Record<string, { skins: number; ctp: number }> = {};
  const bump = (player: string, field: "skins" | "ctp", n: number) => {
    if (!totals[player]) totals[player] = { skins: 0, ctp: 0 };
    totals[player][field] += n;
  };
  for (const w of weeks) {
    if (w.skinsWinner) bump(w.skinsWinner, "skins", 1 + w.skinsCarryIn);
    if (w.ctpWinner) bump(w.ctpWinner, "ctp", 1);
  }

  const leaderboard = Object.entries(totals)
    .map(([playerId, counts]) => ({ playerId, ...counts }))
    .sort((a, b) => (b.skins + b.ctp) - (a.skins + a.ctp));

  return NextResponse.json({ weeks, leaderboard });
}
