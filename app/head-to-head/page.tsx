export const dynamic = "force-dynamic";

import HeadToHeadClient from "@/components/HeadToHeadClient";
import prisma from "@/lib/prisma";

async function getData(season: number) {
  const tournaments = await prisma.tournament.findMany({
    where: { season },
    orderBy: { date: "asc" },
    include: { results: true },
  });
  const tournamentIds = tournaments.map(t => t.id);

  const [players, roundStats, shotData] = await Promise.all([
    prisma.player.findMany(),
    prisma.playerRoundStats.findMany({
      where: { tournamentId: { in: tournamentIds } },
      select: {
        playerId: true, tournamentId: true,
        scoringAvg: true, drivingDist: true, fir: true, gir: true,
        sandSave: true, scrambling: true, puttsPerRound: true,
        puttsPerGir: true, girProximity: true,
      },
    }),
    prisma.shotData.findMany({
      where: { tournamentId: { in: tournamentIds } },
      select: { playerId: true, par: true, shotsCount: true, shots: true },
    }),
  ]);
  return { tournaments, players, roundStats, shotData };
}

export default async function HeadToHeadPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const season = params.season ? parseInt(params.season) : 2;
  const { tournaments, players, roundStats, shotData } = await getData(season);
  return <HeadToHeadClient tournaments={tournaments} players={players} roundStats={roundStats} shotData={shotData} season={season} />;
}
