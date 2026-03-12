import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const records: Array<{
      tournamentId: number;
      playerId: string;
      roundKey: string;
      shotKey: string;
      hole: number;
      holeShot: number;
      globalShotNum: number;
      clubName: string;
      shotResult?: string | null;
      ballSpeed?: number | null;
      carryDist?: number | null;
      totalDist?: number | null;
      distToPin?: number | null;
      peakHeight?: number | null;
      offline?: number | null;
      clubSpeed?: number | null;
      backSpin?: number | null;
      spinAxis?: number | null;
      clubAoA?: number | null;
      clubPath?: number | null;
      faceToPath?: number | null;
      faceToTarget?: number | null;
      descAngle?: number | null;
      hla?: number | null;
      vla?: number | null;
    }> = body.records;

    if (!records?.length) {
      return NextResponse.json({ error: "No records provided" }, { status: 400 });
    }

    const result = await prisma.launchMonitorShot.createMany({
      data: records,
      skipDuplicates: true,
    });

    return NextResponse.json({ inserted: result.count, received: records.length });
  } catch (err) {
    console.error("lm-import error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE() {
  // Clear all launch monitor data (for re-importing)
  const result = await prisma.launchMonitorShot.deleteMany();
  return NextResponse.json({ deleted: result.count });
}
