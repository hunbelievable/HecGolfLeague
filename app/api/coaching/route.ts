import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Club ordering ─────────────────────────────────────────────────────────────

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

// ── Aggregation helpers ───────────────────────────────────────────────────────

function avg(vals: (number | null | undefined)[]): number | null {
  // Exclude null AND 0 — GSPro records 0 when the device didn't capture the metric
  const valid = vals.filter((v): v is number => v !== null && v !== undefined && !isNaN(v) && v !== 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function avgAllowZero(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function r1(v: number | null): string {
  if (v === null) return "—";
  return (Math.round(v * 10) / 10).toString();
}

// ── Formatters for prompt ─────────────────────────────────────────────────────

function formatShotDataForPrompt(
  shotRows: { holeNumber: number; par: number; shots: string }[]
): string {
  if (!shotRows.length) return "(No hole-by-hole shot data available for this round.)";

  const lines: string[] = [];
  for (const row of shotRows) {
    const shots = JSON.parse(row.shots) as string[];
    const nonPutt = shots.filter(s => !/auto.?putt/i.test(s));
    lines.push(
      `Hole ${row.holeNumber} (Par ${row.par}, ${shots.length} shots): ${nonPutt.join(" → ")}`
    );
  }
  return lines.join("\n");
}

type LMRow = {
  clubName: string;
  clubSpeed: number | null;
  ballSpeed: number | null;
  carryDist: number | null;
  offline:   number | null;
  backSpin:  number | null;
  vla:       number | null;
  clubAoA:   number | null;
  faceToPath:number | null;
};

function formatLMDataForPrompt(lmShots: LMRow[]): string {
  if (!lmShots.length) return "";

  // Only include shots that look like real full swings (carry > 10y, not putter)
  const fullSwings = lmShots.filter(
    s => s.clubName !== "PT" && (s.carryDist ?? 0) > 10
  );
  if (!fullSwings.length) return "";

  // Group by club
  const clubMap = new Map<string, LMRow[]>();
  for (const s of fullSwings) {
    const key = s.clubName.toUpperCase();
    if (!clubMap.has(key)) clubMap.set(key, []);
    clubMap.get(key)!.push(s);
  }

  const clubStats = [...clubMap.entries()]
    .map(([rawClub, shots]) => {
      const display  = CLUB_DISPLAY[rawClub] ?? rawClub;
      const clubSpeed = avg(shots.map(s => s.clubSpeed));
      const ballSpeed = avg(shots.map(s => s.ballSpeed));
      const carry    = avg(shots.map(s => s.carryDist));
      const offline  = avgAllowZero(shots.map(s => s.offline));
      const backSpin = avg(shots.map(s => s.backSpin));
      const vla      = avg(shots.map(s => s.vla));
      const aoa      = avgAllowZero(shots.map(s => s.clubAoA));
      const ftp      = avgAllowZero(shots.map(s => s.faceToPath));
      const smash    = clubSpeed && ballSpeed ? ballSpeed / clubSpeed : null;

      // Count big misses (offline ≥ 15 yards)
      const bigMisses = shots.filter(s => s.offline !== null && Math.abs(s.offline!) >= 15).length;

      return { display, rawClub, count: shots.length, clubSpeed, ballSpeed, smash, carry, offline, backSpin, vla, aoa, ftp, bigMisses };
    })
    .sort((a, b) => (CLUB_SORT[a.rawClub] ?? 99) - (CLUB_SORT[b.rawClub] ?? 99));

  const lines: string[] = ["LAUNCH MONITOR DATA (GSPro, averaged per club — 0 = not captured):"];

  for (const c of clubStats) {
    const parts: string[] = [`  ${c.display} ×${c.count}`];

    if (c.clubSpeed) parts.push(`${r1(c.clubSpeed)} mph club`);
    if (c.ballSpeed) parts.push(`${r1(c.ballSpeed)} mph ball`);
    if (c.smash)     parts.push(`${r1(c.smash)} smash`);
    if (c.carry)     parts.push(`${r1(c.carry)}y carry`);

    if (c.offline !== null) {
      const absOff = Math.abs(c.offline);
      const dir = absOff < 1 ? "straight" : `${r1(absOff)}y ${c.offline > 0 ? "right" : "left"}`;
      const bigMissNote = c.bigMisses > 0 ? ` (${c.bigMisses} miss${c.bigMisses > 1 ? "es" : ""} 15+y)` : "";
      parts.push(`avg ${dir}${bigMissNote}`);
    }

    if (c.backSpin)  parts.push(`${Math.round(c.backSpin)}rpm spin`);
    if (c.vla)       parts.push(`${r1(c.vla)}° VLA`);
    if (c.aoa)       parts.push(`${r1(c.aoa)}° AoA`);
    if (c.ftp !== null && Math.abs(c.ftp) > 0.5)
      parts.push(`${r1(c.ftp)}° face/path`);

    lines.push(parts.join(", "));
  }

  // Overall direction tendency
  const driverShots = fullSwings.filter(s => s.clubName === "DR");
  const allOfflines = driverShots
    .map(s => s.offline)
    .filter((v): v is number => v !== null);
  if (allOfflines.length >= 3) {
    const leftCount  = allOfflines.filter(v => v < -5).length;
    const rightCount = allOfflines.filter(v => v > 5).length;
    const netTend    = allOfflines.reduce((a, b) => a + b, 0) / allOfflines.length;
    if (Math.abs(netTend) > 3) {
      lines.push(
        `  (Driver tendency: ${r1(Math.abs(netTend))}y average ${netTend > 0 ? "right" : "left"}, ${leftCount}L / ${rightCount}R misses >5y)`
      );
    }
  }

  return lines.join("\n");
}

// ── POST — generate report ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { playerId, tournamentId, force } = await req.json();

  if (!playerId || !tournamentId) {
    return NextResponse.json({ error: "playerId and tournamentId required" }, { status: 400 });
  }

  // Return cached report unless force-regenerating
  if (!force) {
    const cached = await prisma.coachingReport.findUnique({
      where: { playerId_tournamentId: { playerId, tournamentId } },
    });
    if (cached) {
      return NextResponse.json({ report: cached.report, cached: true });
    }
  }

  const [grossResult, netResult, tournament, player, shotRows, lmShots] = await Promise.all([
    prisma.result.findUnique({
      where: { tournamentId_playerId_type: { tournamentId, playerId, type: "gross" } },
    }),
    prisma.result.findUnique({
      where: { tournamentId_playerId_type: { tournamentId, playerId, type: "net" } },
    }),
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.shotData.findMany({
      where: { tournamentId, playerId },
      orderBy: { holeNumber: "asc" },
    }),
    prisma.launchMonitorShot.findMany({
      where: { tournamentId, playerId },
      select: {
        clubName: true, clubSpeed: true, ballSpeed: true, carryDist: true,
        offline: true, backSpin: true, vla: true, clubAoA: true, faceToPath: true,
      },
    }),
  ]);

  if (!tournament || !player) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasShotData = shotRows.length > 0;
  const hasLMData   = lmShots.length > 0;
  const shotSection = formatShotDataForPrompt(shotRows);
  const lmSection   = formatLMDataForPrompt(lmShots);

  const prompt = `You are a direct, analytical golf coach reviewing a round for ${playerId} (handicap ${player.handicap}).

Tournament: ${tournament.name} (${tournament.week}${tournament.isMajor ? " — MAJOR" : ""})
Gross score: ${grossResult?.score ?? "N/A"} (Position: ${grossResult?.position ?? "N/A"} of 6)
Net score:   ${netResult?.score ?? "N/A"} (Position: ${netResult?.position ?? "N/A"} of 6)
${hasLMData ? `
${lmSection}
` : ""}
${hasShotData ? "Hole-by-hole shot data (lie type and distance to pin after each shot):\n" + shotSection : shotSection}

Write a coaching report for this round. Be direct and analytical — not patronising. Plain language, like a club pro talking to a regular member. Focus on:
1. Overall assessment (1-2 sentences: score vs handicap, how the round was shaped)
2. ${hasLMData ? "Ball striking quality — reference smash factor, club speed, and contact consistency from the LM data" : "Ball striking from the available data"}
3. Direction tendencies — ${hasLMData ? "use the offline averages and big-miss counts from LM alongside" : ""} tee shot lies from hole data
4. ${hasLMData ? "Distance gapping and carry numbers — flag any clubs with suspicious averages or big offline numbers" : "Approach distances and green proximity"}
5. Short game — wedge spin rates and proximity, chipping${hasLMData ? " (check wedge spin and offline in LM data)" : ""}
6. One or two concrete, specific things to work on — reference actual numbers where possible

Keep it under 500 words.${!hasShotData && !hasLMData ? "\n\nNote: No shot data or launch monitor data available — base analysis on score and position only." : ""}${hasShotData && !hasLMData ? "\n\nNote: No launch monitor data available for this round." : ""}${!hasShotData && hasLMData ? "\n\nNote: No hole-by-hole SGT shot data — base analysis on score, position and the LM data." : ""}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });

    const report = (message.content[0] as { type: string; text: string }).text;

    await prisma.coachingReport.upsert({
      where:  { playerId_tournamentId: { playerId, tournamentId } },
      update: { report, shotDataJson: hasShotData ? JSON.stringify(shotRows) : null },
      create: { playerId, tournamentId, report, shotDataJson: hasShotData ? JSON.stringify(shotRows) : null },
    });

    return NextResponse.json({ report, cached: false, hasShotData, hasLMData });
  } catch (err) {
    console.error("Anthropic error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET — fetch existing report ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId     = searchParams.get("playerId");
  const tournamentId = searchParams.get("tournamentId");

  if (!playerId || !tournamentId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const [report, shotCount, lmCount] = await Promise.all([
    prisma.coachingReport.findUnique({
      where: { playerId_tournamentId: { playerId, tournamentId: parseInt(tournamentId) } },
    }),
    prisma.shotData.count({ where: { tournamentId: parseInt(tournamentId), playerId } }),
    prisma.launchMonitorShot.count({ where: { tournamentId: parseInt(tournamentId), playerId } }),
  ]);

  return NextResponse.json({
    ...(report ?? { report: null }),
    hasShotData: shotCount > 0,
    hasLMData:   lmCount > 0,
  });
}
