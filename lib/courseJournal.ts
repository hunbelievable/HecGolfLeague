import prisma from "@/lib/prisma";

// Notes are written locally only: deploys copy data/dev.db over the server's DB,
// so anything saved on the live site would be lost on the next deploy.
export const JOURNAL_EDITABLE = process.env.NODE_ENV !== "production";

// Handicap groups use each player's *current* index (Player.handicap), as a
// proxy for skill — S2 indexes all started at 0, so the index at event time
// says little about early weeks.
export const HCP_GROUPS = [
  { key: "low",  label: "Low",  range: "≤5",   max: 5 },
  { key: "mid",  label: "Mid",  range: "6–12", max: 12 },
  { key: "high", label: "High", range: "13+",  max: Infinity },
] as const;
export type HcpGroupKey = (typeof HCP_GROUPS)[number]["key"];

export function hcpGroup(handicap: number): HcpGroupKey {
  return HCP_GROUPS.find(g => handicap <= g.max)!.key;
}

export interface GroupStat {
  avg9: number; // mean gross strokes over par, per 9 holes
  n: number;
}

export interface CourseSetupData {
  courseName: string;
  sgtCourseId: number | null;
  coursePar: number | null;
  tees: string | null;
  slope: number | null;
  rating: number | null;
  stimp: number | null;
  fairways: string | null;
  greens: string | null;
  pins: string | null;
  weather: string | null;
  wind: string | null;
  gimmies: string | null;
}

export interface EventCourseStats {
  tournamentId: number;
  holes: number;
  field: GroupStat | null;
  groups: Record<HcpGroupKey, GroupStat | null>;
  gap9: number | null;          // high − low, per 9 holes
  scratchExp9: number | null;   // (rating − par) per 9: what a scratch golfer should shoot vs par
  bogeyExp9: number | null;     // (bogey rating − par) per 9, bogey rating = rating + slope / 5.381
  blowupsPer9: number | null;   // triple bogey or worse, per player per 9 holes
  winner: { playerId: string; score: string } | null;
}

export function parseScore(score: string): number | null {
  if (score === "E") return 0;
  const n = parseInt(score, 10);
  return isNaN(n) ? null : n;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

interface StatsInput {
  id: number;
  season: number;
  courseSetup: CourseSetupData | null;
  results: { playerId: string; type: string; position: number; score: string; player: { handicap: number } }[];
}

interface ShotRow { tournamentId: number; playerId: string; holeNumber: number; par: number; shotsCount: number }

export function computeEventStats(t: StatsInput, shots: ShotRow[]): EventCourseStats {
  const own = shots.filter(s => s.tournamentId === t.id);
  const holes = new Set(own.map(s => s.holeNumber)).size || (t.season === 1 ? 18 : 9);
  const per9 = 9 / holes;

  const gross = t.results.filter(r => r.type === "gross");
  const scored = gross
    .map(r => ({ r, over: parseScore(r.score) }))
    .filter((x): x is { r: (typeof gross)[number]; over: number } => x.over !== null);

  const stat = (xs: number[]): GroupStat | null =>
    xs.length ? { avg9: round1(mean(xs) * per9), n: xs.length } : null;

  const groups = Object.fromEntries(
    HCP_GROUPS.map(g => [
      g.key,
      stat(scored.filter(x => hcpGroup(x.r.player.handicap) === g.key).map(x => x.over)),
    ])
  ) as Record<HcpGroupKey, GroupStat | null>;

  // Blow-ups only count players with a full card
  const byPlayer = new Map<string, ShotRow[]>();
  for (const s of own) byPlayer.set(s.playerId, [...(byPlayer.get(s.playerId) ?? []), s]);
  const fullCards = [...byPlayer.values()].filter(c => c.length === holes);
  const blowups = fullCards.map(c => c.filter(s => s.shotsCount - s.par >= 3).length);

  const cs = t.courseSetup;
  const hasRating = cs?.rating != null && cs.coursePar != null;
  const winner = gross.find(r => r.position === 1);

  return {
    tournamentId: t.id,
    holes,
    field: stat(scored.map(x => x.over)),
    groups,
    gap9: groups.high && groups.low ? round1(groups.high.avg9 - groups.low.avg9) : null,
    scratchExp9: hasRating ? round1((cs!.rating! - cs!.coursePar!) / 2) : null,
    bogeyExp9: hasRating && cs!.slope != null
      ? round1((cs!.rating! + cs!.slope / 5.381 - cs!.coursePar!) / 2)
      : null,
    blowupsPer9: fullCards.length ? round1(mean(blowups) * per9) : null,
    winner: winner ? { playerId: winner.playerId, score: winner.score } : null,
  };
}

export async function getJournalEvents(season?: number) {
  const tournaments = await prisma.tournament.findMany({
    where: season ? { season } : undefined,
    orderBy: [{ season: "asc" }, { date: "asc" }],
    include: {
      courseSetup: true,
      results: { include: { player: true } },
    },
  });
  const shots = await prisma.shotData.findMany({
    where: { tournamentId: { in: tournaments.map(t => t.id) } },
    select: { tournamentId: true, playerId: true, holeNumber: true, par: true, shotsCount: true },
  });
  return tournaments.map(t => ({
    id: t.id,
    name: t.name,
    week: t.week,
    date: t.date,
    season: t.season,
    isMajor: t.isMajor,
    courseSetup: t.courseSetup,
    stats: computeEventStats(t, shots),
  }));
}

export type JournalEvent = Awaited<ReturnType<typeof getJournalEvents>>[number];
