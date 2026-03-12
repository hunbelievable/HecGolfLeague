import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  const tournamentId = searchParams.get("tournamentId");

  if (!playerId || !tournamentId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const holes = await prisma.shotData.findMany({
    where: { playerId, tournamentId: parseInt(tournamentId) },
    orderBy: { holeNumber: "asc" },
  });

  return NextResponse.json(holes);
}
