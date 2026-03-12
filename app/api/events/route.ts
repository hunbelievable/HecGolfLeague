import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "asc" },
    include: {
      results: {
        orderBy: [{ type: "asc" }, { position: "asc" }],
        include: { player: true },
      },
    },
  });

  return NextResponse.json(tournaments);
}
