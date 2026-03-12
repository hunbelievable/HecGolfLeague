export const dynamic = "force-dynamic";

import PlayerClient from "@/components/PlayerClient";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getPlayerData(id: string) {
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      results: {
        include: { tournament: true },
        orderBy: [{ tournament: { date: "asc" } }, { type: "asc" }],
      },
      coachingReports: {
        orderBy: { tournamentId: "asc" },
      },
    },
  });
  return player;
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayerData(id);
  if (!player) notFound();

  return <PlayerClient player={player} />;
}
