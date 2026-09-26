import prisma from "@/lib/prisma";
import teeYardage from "@/lib/teeYardage.json";

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

export type NineKey = "front" | "back";

export interface NineStats {
  nine: NineKey;
  field: GroupStat | null;      // strokes over par for these 9 holes
  groups: Record<HcpGroupKey, GroupStat | null>;
  gap9: number | null;
  blowupsPer9: number | null;
}

export interface EventCourseStats {
  tournamentId: number;
  holes: number;
  nines: NineStats[];           // the nine(s) played; S1 rounds have both
  yards: number | null;         // full 18-hole yardage of the tees played
  field: GroupStat | null;      // whole round, per 9 holes (official scores)
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
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const TEE_YARDAGE = teeYardage.courses as Record<string, { name: string; tees: Record<string, number> }>;

const NINE_HOLES: Record<NineKey, number[]> = {
  front: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  back: [10, 11, 12, 13, 14, 15, 16, 17, 18],
};

interface StatsInput {
  id: number;
  season: number;
  courseSetup: CourseSetupData | null;
  results: { playerId: string; type: string; position: number; score: string; player: { handicap: number } }[];
}

interface ShotRow { tournamentId: number; playerId: string; holeNumber: number; par: number; shotsCount: number }

function groupStats(rows: { handicap: number; over: number }[], per9: number) {
  const stat = (xs: number[]): GroupStat | null =>
    xs.length ? { avg9: round1(mean(xs) * per9), n: xs.length } : null;
  const groups = Object.fromEntries(
    HCP_GROUPS.map(g => [g.key, stat(rows.filter(r => hcpGroup(r.handicap) === g.key).map(r => r.over))])
  ) as Record<HcpGroupKey, GroupStat | null>;
  return {
    field: stat(rows.map(r => r.over)),
    groups,
    gap9: groups.high && groups.low ? round1(groups.high.avg9 - groups.low.avg9) : null,
  };
}

export function computeEventStats(t: StatsInput, shots: ShotRow[]): EventCourseStats {
  const cs = t.courseSetup;
  const yards = cs?.sgtCourseId != null && cs.tees
    ? TEE_YARDAGE[String(cs.sgtCourseId)]?.tees[cs.tees] ?? null
    : null;

  const gross = t.results.filter(r => r.type === "gross");
  const scored = gross
    .map(r => ({ playerId: r.playerId, handicap: r.player.handicap, over: parseScore(r.score) }))
    .filter((x): x is { playerId: string; handicap: number; over: number } => x.over !== null);

  // Shot cards are only trusted when they add up to the official gross score
  // (a few are bad scrapes or were edited on SGT afterwards)
  const own = shots.filter(s => s.tournamentId === t.id);
  const cards = new Map<string, ShotRow[]>();
  for (const s of own) cards.set(s.playerId, [...(cards.get(s.playerId) ?? []), s]);
  const validCards = scored
    .map(p => ({ ...p, card: cards.get(p.playerId) ?? [] }))
    .filter(p => p.card.length && sum(p.card.map(h => h.shotsCount - h.par)) === p.over);

  const playedHoles = new Set(own.map(s => s.holeNumber));
  const holes = playedHoles.size || (t.season === 1 ? 18 : 9);
  const ninesPlayed = (Object.keys(NINE_HOLES) as NineKey[]).filter(k =>
    playedHoles.size ? NINE_HOLES[k].some(h => playedHoles.has(h)) : holes === 18
  );

  const nines: NineStats[] = ninesPlayed.map(nine => {
    const rows = validCards
      .map(p => ({ handicap: p.handicap, holes: p.card.filter(h => NINE_HOLES[nine].includes(h.holeNumber)) }))
      .filter(p => p.holes.length === 9);
    const blowups = rows.map(p => p.holes.filter(h => h.shotsCount - h.par >= 3).length);
    return {
      nine,
      ...groupStats(rows.map(p => ({ handicap: p.handicap, over: sum(p.holes.map(h => h.shotsCount - h.par)) })), 1),
      blowupsPer9: blowups.length ? round1(mean(blowups)) : null,
    };
  });

  const hasRating = cs?.rating != null && cs.coursePar != null;
  const winner = gross.find(r => r.position === 1);
  const blowupRates = nines.filter(n => n.blowupsPer9 != null).map(n => n.blowupsPer9!);

  return {
    tournamentId: t.id,
    holes,
    nines,
    yards,
    ...groupStats(scored, 9 / holes),
    scratchExp9: hasRating ? round1((cs!.rating! - cs!.coursePar!) / 2) : null,
    bogeyExp9: hasRating && cs!.slope != null
      ? round1((cs!.rating! + cs!.slope / 5.381 - cs!.coursePar!) / 2)
      : null,
    blowupsPer9: blowupRates.length ? round1(mean(blowupRates)) : null,
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
