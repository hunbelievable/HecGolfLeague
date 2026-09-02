export const dynamic = "force-dynamic";

import EventsClient from "@/components/EventsClient";
import prisma from "@/lib/prisma";

async function getEvents(season: number) {
  return prisma.tournament.findMany({
    where: { season },
    orderBy: { date: "asc" },
    include: {
      results: {
        orderBy: [{ type: "asc" }, { position: "asc" }],
        include: { player: true },
      },
    },
  });
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const season = params.season ? parseInt(params.season) : 2;
  const events = await getEvents(season);
  return <EventsClient events={events} season={season} />;
}
