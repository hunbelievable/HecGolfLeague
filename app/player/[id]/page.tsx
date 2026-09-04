export const dynamic = "force-dynamic";

import PlayerClient from "@/components/PlayerClient";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getPlayerData(id: string) {
  const [player, shotData, roundStats] = await Promise.all([
    prisma.player.findUnique({
      where: { id },
      include: {
        results: {
          include: { tournament: true },
          orderBy: [{ tournament: { date: "desc" } }, { type: "asc" }],
        },
        coachingReports: {
          orderBy: { tournamentId: "asc" },
        },
      },
    }),
    prisma.shotData.findMany({
      where: { playerId: id },
      select: { tournamentId: true, holeNumber: true, par: true, shotsCount: true, shots: true },
    }),
    prisma.playerRoundStats.findMany({
      where: { playerId: id },
      include: { tournament: { select: { id: true, name: true, week: true, season: true } } },
      orderBy: { tournament: { date: "asc" } },
    }),
  ]);

  return { player, shotData, roundStats };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { player, shotData, roundStats } = await getPlayerData(id);
  if (!player) notFound();

  return <PlayerClient player={player} shotData={shotData} roundStats={roundStats} />;
}
