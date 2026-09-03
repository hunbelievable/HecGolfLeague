import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournamentId = parseInt(searchParams.get("tournamentId") ?? "");
  if (isNaN(tournamentId)) return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });

  const [shotRows, results] = await Promise.all([
    prisma.shotData.findMany({
      where: { tournamentId },
      orderBy: [{ playerId: "asc" }, { holeNumber: "asc" }],
    }),
    // Use gross results for player ordering and scoring
    prisma.result.findMany({
      where: { tournamentId, type: "gross" },
      orderBy: { position: "asc" },
    }),
  ]);

  // Build hole list and par from shot data
  const holeSet = new Set<number>();
  const parByHole = new Map<number, number>();
  for (const row of shotRows) {
    holeSet.add(row.holeNumber);
    parByHole.set(row.holeNumber, row.par);
  }
  const holes = Array.from(holeSet).sort((a, b) => a - b);
  const pars = holes.map(h => parByHole.get(h) ?? 4);

  // Group shot data by player
  const byPlayer = new Map<string, Map<number, number>>();
  for (const row of shotRows) {
    if (!byPlayer.has(row.playerId)) byPlayer.set(row.playerId, new Map());
    byPlayer.get(row.playerId)!.set(row.holeNumber, row.shotsCount);
  }

  // Order players by gross position, then any remaining players alphabetically
  const orderedIds = results.map(r => r.playerId);
  const remaining = Array.from(byPlayer.keys()).filter(id => !orderedIds.includes(id)).sort();
  const allPlayerIds = [...orderedIds, ...remaining];

  const players = allPlayerIds.map(id => ({
    id,
    scores: holes.map(h => byPlayer.get(id)?.get(h) ?? null),
  }));

  return NextResponse.json({ holes, pars, players });
}
