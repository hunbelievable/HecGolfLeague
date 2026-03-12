import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PlayerStanding, StandingsData, PointsHistory } from "@/lib/types";

function scoreToNumber(score: string): number {
  if (score === "E") return 0;
  return parseInt(score.replace("+", "")) || 0;
}

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "asc" },
    include: { results: { include: { player: true } } },
  });

  const players = await prisma.player.findMany();
  const playerIds = players.map(p => p.id);

  function buildStandings(type: "gross" | "net"): PlayerStanding[] {
    const standings: Record<string, PlayerStanding> = {};

    for (const p of players) {
      standings[p.id] = {
        playerId: p.id,
        handicap: p.handicap,
        wins: 0,
        top3: 0,
        top5: 0,
        totalPoints: 0,
        avgPosition: 0,
        bestScore: "+99",
        worstScore: "-99",
        events: 0,
        results: [],
      };
    }

    for (const t of tournaments) {
      const typeResults = t.results.filter(r => r.type === type);
      for (const r of typeResults) {
        if (!standings[r.playerId]) continue;
        const s = standings[r.playerId];
        s.events++;
        s.totalPoints += r.points;
        if (r.position === 1) s.wins++;
        if (r.position <= 3) s.top3++;
        if (r.position <= 5) s.top5++;

        const scoreNum = scoreToNumber(r.score);
        const bestNum = scoreToNumber(s.bestScore);
        const worstNum = scoreToNumber(s.worstScore);
        if (s.bestScore === "+99" || scoreNum < bestNum) s.bestScore = r.score;
        if (s.worstScore === "-99" || scoreNum > worstNum) s.worstScore = r.score;

        s.results.push({
          tournamentId: t.id,
          tournamentName: t.name,
          week: t.week,
          position: r.position,
          score: r.score,
          points: r.points,
          isMajor: t.isMajor,
        });
      }
    }

    return Object.values(standings)
      .filter(s => s.events > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((s, idx) => ({
        ...s,
        avgPosition: s.events > 0
          ? s.results.reduce((acc, r) => acc + r.position, 0) / s.events
          : 0,
      }));
  }

  // Build cumulative points history for charts
  const pointsHistory: PointsHistory[] = [];
  const cumulativePoints: Record<string, Record<string, number>> = { gross: {}, net: {} };
  for (const pid of playerIds) {
    cumulativePoints.gross[pid] = 0;
    cumulativePoints.net[pid] = 0;
  }

  for (const t of tournaments) {
    const entry: PointsHistory = {
      week: t.week,
      tournamentId: t.id,
      date: t.date,
    };

    const grossResults = t.results.filter(r => r.type === "gross");
    for (const pid of playerIds) {
      const r = grossResults.find(r => r.playerId === pid);
      if (r) cumulativePoints.gross[pid] += r.points;
      entry[`gross_${pid}`] = cumulativePoints.gross[pid];
    }

    const netResults = t.results.filter(r => r.type === "net");
    for (const pid of playerIds) {
      const r = netResults.find(r => r.playerId === pid);
      if (r) cumulativePoints.net[pid] += r.points;
      entry[`net_${pid}`] = cumulativePoints.net[pid];
    }

    pointsHistory.push(entry);
  }

  const data: StandingsData = {
    gross: buildStandings("gross"),
    net: buildStandings("net"),
    pointsHistory,
  };

  return NextResponse.json(data);
}
