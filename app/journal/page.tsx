export const dynamic = "force-dynamic";

import JournalClient from "@/components/JournalClient";
import prisma from "@/lib/prisma";
import { getJournalEvents, JOURNAL_EDITABLE } from "@/lib/courseJournal";

export default async function JournalPage() {
  const [events, notes] = await Promise.all([
    getJournalEvents(),
    prisma.courseJournal.findMany(),
  ]);
  return (
    <JournalClient
      events={events}
      notes={Object.fromEntries(notes.map(n => [n.courseName, { notes: n.notes, updatedAt: n.updatedAt.toISOString() }]))}
      editable={JOURNAL_EDITABLE}
    />
  );
}
