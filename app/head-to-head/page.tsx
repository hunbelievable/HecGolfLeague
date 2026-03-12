export const dynamic = "force-dynamic";

import HeadToHeadClient from "@/components/HeadToHeadClient";
import prisma from "@/lib/prisma";

async function getData() {
  const [tournaments, players] = await Promise.all([
    prisma.tournament.findMany({
      orderBy: { date: "asc" },
      include: { results: true },
    }),
    prisma.player.findMany(),
  ]);
  return { tournaments, players };
}

export default async function HeadToHeadPage() {
  const data = await getData();
  return <HeadToHeadClient {...data} />;
}
