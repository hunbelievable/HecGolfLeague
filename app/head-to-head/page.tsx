export const dynamic = "force-dynamic";

import HeadToHeadClient from "@/components/HeadToHeadClient";
import prisma from "@/lib/prisma";

async function getData(season: number) {
  const [tournaments, players] = await Promise.all([
    prisma.tournament.findMany({
      where: { season },
      orderBy: { date: "asc" },
      include: { results: true },
    }),
    prisma.player.findMany(),
  ]);
  return { tournaments, players };
}

export default async function HeadToHeadPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const season = params.season ? parseInt(params.season) : 2;
  const data = await getData(season);
  return <HeadToHeadClient {...data} season={season} />;
}
