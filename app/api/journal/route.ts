import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { JOURNAL_EDITABLE } from "@/lib/courseJournal";

export async function POST(request: Request) {
  if (!JOURNAL_EDITABLE) {
    return NextResponse.json(
      { error: "Journal notes are edited on the local site, then deployed with the database." },
      { status: 403 }
    );
  }

  const { courseName, notes } = await request.json().catch(() => ({}));
  if (typeof courseName !== "string" || !courseName || typeof notes !== "string") {
    return NextResponse.json({ error: "courseName and notes are required" }, { status: 400 });
  }

  if (!notes.trim()) {
    await prisma.courseJournal.deleteMany({ where: { courseName } });
    return NextResponse.json({ courseName, notes: "", updatedAt: null });
  }

  const entry = await prisma.courseJournal.upsert({
    where: { courseName },
    create: { courseName, notes },
    update: { notes },
  });
  return NextResponse.json(entry);
}
