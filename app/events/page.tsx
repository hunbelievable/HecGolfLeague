export const dynamic = "force-dynamic";

import EventsClient from "@/components/EventsClient";
import prisma from "@/lib/prisma";
import { getJournalEvents } from "@/lib/courseJournal";

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
  const [events, journal] = await Promise.all([getEvents(season), getJournalEvents(season)]);
  const courseInfo = Object.fromEntries(
    journal.map(j => [j.id, { courseSetup: j.courseSetup, stats: j.stats }])
  );
  return <EventsClient events={events} season={season} courseInfo={courseInfo} />;
}
