import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GSPro uses W3/H3/I6 notation — map to display name and sort order
const CLUB_DISPLAY: Record<string, string> = {
  DR: "DR",
  W3: "3W", W4: "4W", W5: "5W", W7: "7W",
  H2: "2H", H3: "3H", H4: "4H", H5: "5H",
  I1: "1I", I2: "2I", I3: "3I", I4: "4I", I5: "5I",
  I6: "6I", I7: "7I", I8: "8I", I9: "9I",
  PW: "PW", GW: "GW", SW: "SW", LW: "LW", PT: "PT",
};

const CLUB_SORT: Record<string, number> = {
  DR: 0, W3: 1, W4: 2, W5: 3, W7: 4,
  H2: 5, H3: 6, H4: 7, H5: 8,
  I1: 9, I2: 10, I3: 11, I4: 12, I5: 13,
  I6: 14, I7: 15, I8: 16, I9: 17,
  PW: 18, GW: 19, SW: 20, LW: 21, PT: 22,
};

function clubSortIndex(name: string): number {
  return CLUB_SORT[name.toUpperCase()] ?? 99;
}

function avg(vals: (number | null)[]): number | null {
  // Exclude null AND 0 — GSPro records 0 when the device didn't capture the metric
  const valid = vals.filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v !== 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Special avg for offline — 0 IS a valid value (perfectly straight)
function avgAllowZero(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string; tournamentId: string }> }
) {
  const { playerId, tournamentId } = await params;
  const tid = parseInt(tournamentId);

  const shots = await prisma.launchMonitorShot.findMany({
    where: { playerId, tournamentId: tid },
    orderBy: [{ hole: "asc" }, { holeShot: "asc" }],
  });

  if (!shots.length) {
    return NextResponse.json({ shots: [], byClub: [], summary: null });
  }

  // Group by club
  const clubMap = new Map<string, typeof shots>();
  for (const s of shots) {
    const key = s.clubName || "UNK";
    if (!clubMap.has(key)) clubMap.set(key, []);
    clubMap.get(key)!.push(s);
  }

  const byClub = [...clubMap.entries()]
    .map(([club, clubShots]: [string, typeof shots]) => ({
      club: CLUB_DISPLAY[club.toUpperCase()] ?? club,
      rawClub: club,
      count: clubShots.length,
      clubSpeed:   round1(avg(clubShots.map(s => s.clubSpeed))),
      ballSpeed:   round1(avg(clubShots.map(s => s.ballSpeed))),
      carryDist:   round1(avg(clubShots.map(s => s.carryDist))),
      totalDist:   round1(avg(clubShots.map(s => s.totalDist))),
      offline:     round1(avgAllowZero(clubShots.map(s => s.offline))),
      backSpin:    round1(avg(clubShots.map(s => s.backSpin))),
      vla:         round1(avg(clubShots.map(s => s.vla))),
      hla:         round1(avgAllowZero(clubShots.map(s => s.hla))),
      faceToPath:  round1(avgAllowZero(clubShots.map(s => s.faceToPath))),
      clubAoA:     round1(avgAllowZero(clubShots.map(s => s.clubAoA))),
      spinAxis:    round1(avgAllowZero(clubShots.map(s => s.spinAxis))),
    }))
    .sort((a, b) => clubSortIndex(a.rawClub) - clubSortIndex(b.rawClub));

  // Overall summary (driver-only for club/ball speed since that's what matters)
  const driverShots = shots.filter(s => s.clubName === "DR");
  const allSpeedShots = shots.filter(s => (s.clubSpeed ?? 0) > 0);

  const summary = {
    totalShots: shots.length,
    avgDriverClubSpeed: round1(avg(driverShots.map(s => s.clubSpeed))),
    avgDriverBallSpeed: round1(avg(driverShots.map(s => s.ballSpeed))),
    avgDriverCarry:     round1(avg(driverShots.map(s => s.carryDist))),
    avgDriverOffline:   round1(avgAllowZero(driverShots.map(s => s.offline))),
    driverSmashFactor: (() => {
      const bs = avg(driverShots.map(s => s.ballSpeed));
      const cs = avg(driverShots.map(s => s.clubSpeed));
      return cs && bs ? round1(bs / cs) : null;
    })(),
    avgClubSpeed: round1(avg(allSpeedShots.map(s => s.clubSpeed))),
  };

  return NextResponse.json({ byClub, summary, totalShots: shots.length });
}
