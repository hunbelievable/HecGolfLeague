import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const CLUB_DISPLAY: Record<string, string> = {
  DR: "DR",
  W3: "3W", W4: "4W", W5: "5W", W7: "7W",
  H2: "2H", H3: "3H", H4: "4H", H5: "5H",
  I1: "1I", I2: "2I", I3: "3I", I4: "4I", I5: "5I",
  I6: "6I", I7: "7I", I8: "8I", I9: "9I",
  PW: "PW", GW: "GW", SW: "SW", LW: "LW", PT: "PT",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string; tournamentId: string }> }
) {
  const { playerId, tournamentId } = await params;
  const tid = parseInt(tournamentId);

  const [shotDataRows, lmShots] = await Promise.all([
    prisma.shotData.findMany({
      where: { playerId, tournamentId: tid },
      orderBy: { holeNumber: "asc" },
    }),
    prisma.launchMonitorShot.findMany({
      where: { playerId, tournamentId: tid },
      orderBy: [{ hole: "asc" }, { holeShot: "asc" }],
    }),
  ]);

  // Build LM lookup: "hole-holeShot" → lmShot
  const lmByKey = new Map<string, (typeof lmShots)[0]>();
  for (const shot of lmShots) {
    lmByKey.set(`${shot.hole}-${shot.holeShot}`, shot);
  }

  // Correlated holes: SGT descriptions joined with LM metrics per shot
  const holes = shotDataRows.map(row => {
    const shotStrings = JSON.parse(row.shots) as string[];
    const shots = shotStrings.map((description, i) => {
      const shotNum = i + 1;
      const lm = lmByKey.get(`${row.holeNumber}-${shotNum}`) ?? null;

      return {
        shotIndex: shotNum,
        description,
        lm: lm
          ? {
              clubName: CLUB_DISPLAY[lm.clubName.toUpperCase()] ?? lm.clubName,
              clubSpeed:   lm.clubSpeed,
              ballSpeed:   lm.ballSpeed,
              carryDist:   lm.carryDist,
              totalDist:   lm.totalDist,
              offline:     lm.offline,
              backSpin:    lm.backSpin,
              vla:         lm.vla,
              hla:         lm.hla,
              faceToPath:  lm.faceToPath,
              clubAoA:     lm.clubAoA,
              spinAxis:    lm.spinAxis,
              peakHeight:  lm.peakHeight,
            }
          : null,
      };
    });

    return {
      holeNumber: row.holeNumber,
      par:        row.par,
      shotsCount: row.shotsCount,
      shots,
    };
  });

  return NextResponse.json({
    holes,
    hasSGT: shotDataRows.length > 0,
    hasLM:  lmShots.length > 0,
  });
}
