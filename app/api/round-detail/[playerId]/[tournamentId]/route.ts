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

// Expected carry ranges [min, max] yards in simulator play.
// Covers HCP 4–12 players. Intentional layups/punches may fall below min.
const CARRY_RANGE: Record<string, [number, number]> = {
  DR: [190, 295], W3: [172, 265], W4: [163, 252], W5: [158, 242], W7: [145, 228],
  H2: [162, 235], H3: [152, 225], H4: [142, 213], H5: [132, 203],
  I1: [150, 215], I2: [143, 205], I3: [135, 195], I4: [125, 185], I5: [115, 175],
  I6: [105, 165], I7:  [95, 155], I8:  [85, 147], I9:  [75, 137],
  PW: [65, 127], GW: [55, 112], SW: [45, 98], LW: [35, 88], PT: [0, 32],
};

/**
 * SGT descriptions look like "310 yds to fairway, 145 yds to hole".
 * The first number is the total distance the ball traveled (carry + roll).
 */
function parseSGTCarry(raw: string): number | null {
  if (/auto.?putt/i.test(raw)) return null;
  const m = raw.match(/^(\d+)\s+yds?\s+to\s+/i);
  return m ? parseInt(m[1]) : null;
}

type Confidence = "high" | "medium" | "low";

/**
 * Cross-reference the SGT description with the GSPro club/carry data.
 *
 * Two signals:
 *  1. Carry alignment — LM carryDist should be 65–100% of SGT total distance (the rest is roll).
 *     A large mismatch means the shots may not be correlated, or the LM metric is wrong.
 *  2. Club range — is the carry plausible for the labelled club?
 *     GSPro auto-suggests clubs but players often forget to change them,
 *     so a 3W label with a 140y carry means it was almost certainly an iron.
 *
 * Returns null when there is no LM carry to evaluate.
 */
function assessConfidence(
  description: string,
  clubRaw: string,
  lmCarry: number | null,
): { confidence: Confidence; reason: string } | null {
  if (!lmCarry || lmCarry < 1) return null;

  const club  = clubRaw.toUpperCase();
  const range = CARRY_RANGE[club];
  const label = CLUB_DISPLAY[club] ?? club;

  const sgtCarry = parseSGTCarry(description);

  // ── Signal 1: carry alignment ─────────────────────────────────────────────
  // ratio = LM carry / SGT total. Expect 0.65-1.00 (LM carry ≤ total due to roll).
  // Short shots (<25y) get wider tolerance — bounce/roll is unpredictable.
  let shotDataGood = true;
  let shotDataNote: string | null = null;

  if (sgtCarry !== null && sgtCarry > 5) {
    const ratio = lmCarry / sgtCarry;
    const [lo, hi] = sgtCarry < 25 ? [0.30, 2.20] : [0.62, 1.14];

    if (ratio < lo || ratio > hi) {
      shotDataGood = false;
      shotDataNote = `SGT ${sgtCarry}y vs LM ${Math.round(lmCarry)}y — shots may be mis-aligned`;
    }
  }

  // ── Signal 2: club range plausibility ─────────────────────────────────────
  const inRange     = !range || (lmCarry >= range[0]        && lmCarry <= range[1]);
  const inWideRange = !range || (lmCarry >= range[0] * 0.72 && lmCarry <= range[1] * 1.22);

  // ── Combine signals ───────────────────────────────────────────────────────
  if (!shotDataGood) {
    return { confidence: "low", reason: shotDataNote! };
  }

  if (!inWideRange && range) {
    return {
      confidence: "low",
      reason: `Club mis-tagged? ${label} typical ${range[0]}–${range[1]}y, LM shows ${Math.round(lmCarry)}y`,
    };
  }

  if (!inRange && range) {
    // Consistent carries but club is borderline — likely intentional layup or punch
    return {
      confidence: "medium",
      reason: `Possible layup/punch: ${label} typical ${range[0]}–${range[1]}y, LM shows ${Math.round(lmCarry)}y`,
    };
  }

  if (sgtCarry !== null && sgtCarry > 5) {
    // Both signals pass with SGT cross-check
    return {
      confidence: "high",
      reason: `SGT ${sgtCarry}y ≈ LM ${Math.round(lmCarry)}y carry, in range for ${label}`,
    };
  }

  // No SGT carry to cross-check — medium is the best we can say
  return {
    confidence: "medium",
    reason: `No SGT carry to verify; LM ${Math.round(lmCarry)}y is plausible for ${label}`,
  };
}

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
      const clubRaw = lm?.clubName?.toUpperCase() ?? "";
      const conf = lm ? assessConfidence(description, clubRaw, lm.carryDist) : null;

      return {
        shotIndex: shotNum,
        description,
        lm: lm
          ? {
              clubName:  CLUB_DISPLAY[clubRaw] ?? lm.clubName,
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
        confidence:       conf?.confidence ?? null,
        confidenceReason: conf?.reason     ?? null,
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
