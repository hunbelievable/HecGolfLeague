export const dynamic = "force-dynamic";

import EventsClient from "@/components/EventsClient";
import prisma from "@/lib/prisma";

async function getEvents() {
  return prisma.tournament.findMany({
    orderBy: { date: "asc" },
    include: {
      results: {
        orderBy: [{ type: "asc" }, { position: "asc" }],
        include: { player: true },
      },
    },
  });
}

export default async function EventsPage() {
  const events = await getEvents();
  return <EventsClient events={events} />;
}
