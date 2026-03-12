export const dynamic = "force-dynamic";

import StandingsClient from "@/components/StandingsClient";
import prisma from "@/lib/prisma";
import type { StandingsData, PointsHistory, PlayerStanding } from "@/lib/types";

function scoreToNumber(score: string): number {
  if (score === "E") return 0;
  const n = parseInt(score.replace("+", ""));
  return isNaN(n) ? 0 : n;
}

async function getStandingsData(): Promise<StandingsData> {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "asc" },
    include: { results: { include: { player: true } } },
  });

  const players = await prisma.player.findMany();

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
        if (s.bestScore === "+99" || scoreNum < scoreToNumber(s.bestScore)) s.bestScore = r.score;
        if (s.worstScore === "-99" || scoreNum > scoreToNumber(s.worstScore)) s.worstScore = r.score;

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
      .map(s => ({
        ...s,
        avgPosition: s.events > 0
          ? s.results.reduce((acc, r) => acc + r.position, 0) / s.events
          : 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }

  const playerIds = players.map(p => p.id);
  const pointsHistory: PointsHistory[] = [];
  const cumulative: Record<string, Record<string, number>> = { gross: {}, net: {} };
  for (const pid of playerIds) {
    cumulative.gross[pid] = 0;
    cumulative.net[pid] = 0;
  }

  for (const t of tournaments) {
    const entry: PointsHistory = { week: t.week, tournamentId: t.id, date: t.date };
    for (const pid of playerIds) {
      const gr = t.results.find(r => r.playerId === pid && r.type === "gross");
      if (gr) cumulative.gross[pid] += gr.points;
      entry[`gross_${pid}`] = cumulative.gross[pid];

      const nr = t.results.find(r => r.playerId === pid && r.type === "net");
      if (nr) cumulative.net[pid] += nr.points;
      entry[`net_${pid}`] = cumulative.net[pid];
    }
    pointsHistory.push(entry);
  }

  return { gross: buildStandings("gross"), net: buildStandings("net"), pointsHistory };
}

export default async function StandingsPage() {
  const data = await getStandingsData();
  return <StandingsClient data={data} />;
}
