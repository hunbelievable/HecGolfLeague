"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PLAYER_COLORS } from "@/lib/types";

interface Result {
  playerId: string;
  type: string;
  position: number;
  score: string;
  points: number;
}

interface Tournament {
  id: number;
  name: string;
  week: string;
  date: string;
  isMajor: boolean;
  results: Result[];
}

interface Player {
  id: string;
  handicap: number;
}

interface RoundStat {
  playerId: string;
  tournamentId: number;
  scoringAvg: number | null;
  drivingDist: number | null;
  fir: number | null;
  gir: number | null;
  sandSave: number | null;
  scrambling: number | null;
  puttsPerRound: number | null;
  puttsPerGir: number | null;
  girProximity: number | null;
}

interface ShotRow {
  playerId: string;
  par: number;
  shotsCount: number;
  shots: string;
}

interface Props {
  tournaments: Tournament[];
  players: Player[];
  roundStats: RoundStat[];
  shotData: ShotRow[];
  season: number;
}

function scoreToNum(score: string): number {
  if (score === "E") return 0;
  return parseInt(score.replace("+", "")) || 0;
}

const SCORE_CATS = [
  { key: "eagle",  label: "Eagle+", color: "#fbbf24" },
  { key: "birdie", label: "Birdie",  color: "#38bdf8" },
  { key: "par",    label: "Par",     color: "#6b7280" },
  { key: "bogey",  label: "Bogey",   color: "#f97316" },
  { key: "double", label: "Double",  color: "#ef4444" },
  { key: "triple", label: "Triple+", color: "#991b1b" },
];

function classifyShot(shots: number, par: number): string {
  const d = shots - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0)  return "par";
  if (d === 1)  return "bogey";
  if (d === 2)  return "double";
  return "triple";
}

function parsePuttCount(shotsJson: string): number | null {
  try {
    const arr: string[] = JSON.parse(shotsJson);
    if (arr.length === 0) return null; // no shot data — skip hole
    return arr.filter(s => s === "AUTO-PUTT").length;
  } catch { return null; }
}

function onePuttPct(rows: ShotRow[]): number | null {
  const valid = rows.map(r => parsePuttCount(r.shots)).filter((p): p is number => p !== null);
  if (valid.length === 0) return null;
  return (valid.filter(p => p === 1).length / valid.length) * 100;
}

interface PuttingSummary {
  chipIn: number; onePutt: number; twoPutt: number; threePlus: number; total: number;
}

function buildPuttingSummary(rows: ShotRow[]): PuttingSummary {
  let chipIn = 0, onePutt = 0, twoPutt = 0, threePlus = 0, total = 0;
  for (const r of rows) {
    const p = parsePuttCount(r.shots);
    if (p === null) continue; // no shot data for this hole
    total++;
    if (p === 0) chipIn++;
    else if (p === 1) onePutt++;
    else if (p === 2) twoPutt++;
    else threePlus++;
  }
  return { chipIn, onePutt, twoPutt, threePlus, total };
}

function buildDist(shots: ShotRow[]) {
  const counts: Record<string, number> = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0 };
  for (const s of shots) counts[classifyShot(s.shotsCount, s.par)]++;
  const total = shots.length;
  return SCORE_CATS.map(c => ({ ...c, value: counts[c.key], pct: total > 0 ? (counts[c.key] / total) * 100 : 0 }))
    .filter(c => c.value > 0);
}

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null);
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

type RoundStatKey = keyof Omit<RoundStat, "playerId" | "tournamentId">;

interface StatDef {
  key: string;
  label: string;
  fmt: (v: number) => string;
  lowerBetter: boolean;
  compute?: (shots: ShotRow[]) => number | null;
}

const STAT_DEFS: StatDef[] = [
  { key: "scoringAvg",   label: "Scoring Avg",  fmt: v => `+${v.toFixed(1)}`,     lowerBetter: true  },
  { key: "drivingDist",  label: "Drive Dist",   fmt: v => `${v.toFixed(0)} yds`,  lowerBetter: false },
  { key: "fir",          label: "FIR %",        fmt: v => `${v.toFixed(0)}%`,      lowerBetter: false },
  { key: "gir",          label: "GIR %",        fmt: v => `${v.toFixed(0)}%`,      lowerBetter: false },
  { key: "sandSave",     label: "Sand Save %",  fmt: v => `${v.toFixed(0)}%`,      lowerBetter: false },
  { key: "scrambling",   label: "Scrambling %", fmt: v => `${v.toFixed(0)}%`,      lowerBetter: false },
  { key: "girProximity", label: "GIR Prox",     fmt: v => `${v.toFixed(1)} ft`,    lowerBetter: true  },
  { key: "onePuttPct",   label: "1-Putt %",     fmt: v => `${v.toFixed(0)}%`,      lowerBetter: false, compute: onePuttPct },
];

const PUTT_CATS = [
  { key: "chipIn",    label: "Chip-In", color: "#fbbf24" },
  { key: "onePutt",   label: "1-Putt",  color: "#38bdf8" },
  { key: "twoPutt",   label: "2-Putt",  color: "#6b7280" },
  { key: "threePlus", label: "3-Putt+", color: "#ef4444" },
] as const;

function PuttingDonutChart({ summary }: { summary: PuttingSummary }) {
  if (summary.total === 0) return <div className="text-xs text-gray-600 text-center py-4">No shot data</div>;
  const data = PUTT_CATS.map(c => ({
    ...c,
    value: summary[c.key],
    pct: summary.total > 0 ? (summary[c.key] / summary.total) * 100 : 0,
  })).filter(c => c.value > 0);
  return (
    <ResponsiveContainer width="100%" height={120}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={32} outerRadius={52} strokeWidth={1} stroke="#111827">
          {data.map(entry => <Cell key={entry.key} fill={entry.color} />)}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
          formatter={(v, name) => [`${v} (${data.find(d => d.label === name)?.pct.toFixed(0)}%)`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ScoreDistChart({ data, color }: { data: ReturnType<typeof buildDist>; color: string }) {
  if (data.length === 0) return <div className="text-xs text-gray-600 text-center py-4">No shot data</div>;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={32}
          outerRadius={52}
          strokeWidth={1}
          stroke="#111827"
        >
          {data.map(entry => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
          formatter={(v, name) => [`${v} (${data.find(d => d.label === name)?.pct.toFixed(0)}%)`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function HeadToHeadClient({ tournaments, players, roundStats, shotData, season }: Props) {
  const activeIds = Array.from(
    new Set(tournaments.flatMap(t => t.results.map(r => r.playerId)))
  ).sort();
  const defaultP1 = activeIds.includes("holiday402") ? "holiday402" : (activeIds[0] ?? "");
  const defaultP2 = activeIds.find(id => id !== defaultP1) ?? (activeIds[1] ?? "");

  const [player1, setPlayer1] = useState(defaultP1);
  const [player2, setPlayer2] = useState(defaultP2);
  const router = useRouter();
  const [tab, setTab] = useState<"gross" | "net">("gross");

  const color1 = PLAYER_COLORS[player1] ?? "#10b981";
  const color2 = PLAYER_COLORS[player2] ?? "#ef4444";

  // ── Matchups ──────────────────────────────────────────────────────────────
  type Matchup = { tournament: Tournament; r1: Result; r2: Result; s1: number; s2: number; outcome: "win" | "loss" | "tie" };
  const matchups: Matchup[] = tournaments.flatMap(t => {
    const r1 = t.results.find(r => r.playerId === player1 && r.type === tab);
    const r2 = t.results.find(r => r.playerId === player2 && r.type === tab);
    if (!r1 || !r2) return [];
    const s1 = scoreToNum(r1.score);
    const s2 = scoreToNum(r2.score);
    const outcome: "win" | "loss" | "tie" = s1 < s2 ? "win" : s2 < s1 ? "loss" : "tie";
    return [{ tournament: t, r1, r2, s1, s2, outcome }];
  });
  const wins = matchups.filter(m => m.outcome === "win").length;
  const losses = matchups.filter(m => m.outcome === "loss").length;
  const ties = matchups.filter(m => m.outcome === "tie").length;

  // ── Score distribution & putting ──────────────────────────────────────────
  const shots1 = shotData.filter(s => s.playerId === player1);
  const shots2 = shotData.filter(s => s.playerId === player2);
  const dist1 = buildDist(shots1);
  const dist2 = buildDist(shots2);
  const putting1 = buildPuttingSummary(shots1);
  const putting2 = buildPuttingSummary(shots2);

  // ── Stats averages ────────────────────────────────────────────────────────
  const stats1 = roundStats.filter(s => s.playerId === player1);
  const stats2 = roundStats.filter(s => s.playerId === player2);

  const avgStats1: Record<string, number | null> = {};
  const avgStats2: Record<string, number | null> = {};
  for (const def of STAT_DEFS) {
    if (def.compute) {
      avgStats1[def.key] = def.compute(shots1);
      avgStats2[def.key] = def.compute(shots2);
    } else {
      const k = def.key as RoundStatKey;
      avgStats1[def.key] = avg(stats1.map(s => s[k]));
      avgStats2[def.key] = avg(stats2.map(s => s[k]));
    }
  }

  const hasStats = STAT_DEFS.some(d => avgStats1[d.key] !== null || avgStats2[d.key] !== null);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-end justify-between mb-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Head to Head</h1>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
            {[1, 2].map(s => (
              <button
                key={s}
                onClick={() => router.push(s === 2 ? "/head-to-head" : `/head-to-head?season=${s}`)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  season === s ? "bg-green-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                S{s}
              </button>
            ))}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-36">
            <div className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/20" style={{ backgroundColor: color1 }} />
            <select value={player1} onChange={e => setPlayer1(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600/60 transition-colors">
              {activeIds.filter(id => id !== player2).map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <span className="text-gray-600 font-bold text-sm px-1">vs</span>
          <div className="flex items-center gap-2 flex-1 min-w-36">
            <div className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/20" style={{ backgroundColor: color2 }} />
            <select value={player2} onChange={e => setPlayer2(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600/60 transition-colors">
              {activeIds.filter(id => id !== player1).map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            {(["gross", "net"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold tracking-wide transition-all duration-150 ${
                  tab === t ? "bg-green-600 text-white shadow-lg shadow-green-900/40" : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Record cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-3xl font-bold tabular-nums" style={{ color: color1 }}>{wins}</div>
          <div className="text-xs text-gray-600 mt-1.5 uppercase tracking-wide font-medium truncate px-1">{player1} wins</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-3xl font-bold text-gray-500 tabular-nums">{ties}</div>
          <div className="text-xs text-gray-600 mt-1.5 uppercase tracking-wide font-medium">Ties</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-3xl font-bold tabular-nums" style={{ color: color2 }}>{losses}</div>
          <div className="text-xs text-gray-600 mt-1.5 uppercase tracking-wide font-medium truncate px-1">{player2} wins</div>
        </div>
      </div>

      {/* Win bar */}
      {matchups.length > 0 && (
        <div className="mb-6">
          <div className="h-3 rounded-full overflow-hidden flex bg-gray-800">
            <div className="h-full transition-all duration-500" style={{ width: `${(wins / matchups.length) * 100}%`, backgroundColor: color1 }} />
            <div className="h-full transition-all duration-500 bg-gray-600" style={{ width: `${(ties / matchups.length) * 100}%` }} />
            <div className="h-full transition-all duration-500" style={{ width: `${(losses / matchups.length) * 100}%`, backgroundColor: color2 }} />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1.5 font-mono">
            <span style={{ color: color1 }}>{((wins / matchups.length) * 100).toFixed(0)}%</span>
            <span style={{ color: color2 }}>{((losses / matchups.length) * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Score Distribution */}
      {(dist1.length > 0 || dist2.length > 0) && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Score Distribution</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-800">
            {/* Player 1 */}
            <div className="p-4">
              <div className="text-xs font-semibold mb-2 text-center" style={{ color: color1 }}>{player1}</div>
              <ScoreDistChart data={dist1} color={color1} />
              <div className="mt-2 space-y-1">
                {dist1.map(d => (
                  <div key={d.key} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-500 flex-1">{d.label}</span>
                    <span className="text-gray-400 font-mono">{d.value} ({d.pct.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Player 2 */}
            <div className="p-4">
              <div className="text-xs font-semibold mb-2 text-center" style={{ color: color2 }}>{player2}</div>
              <ScoreDistChart data={dist2} color={color2} />
              <div className="mt-2 space-y-1">
                {dist2.map(d => (
                  <div key={d.key} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-500 flex-1">{d.label}</span>
                    <span className="text-gray-400 font-mono">{d.value} ({d.pct.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Putting Breakdown */}
      {(putting1.total > 0 || putting2.total > 0) && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Putting</h2>
            <p className="text-xs text-gray-700 mt-0.5">Computed from GSPro shot data</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-800">
            {([
              { p: player1, color: color1, s: putting1 },
              { p: player2, color: color2, s: putting2 },
            ] as const).map(({ p, color, s }) => (
              <div key={p} className="p-4">
                <div className="text-xs font-semibold mb-2 text-center" style={{ color }}>{p}</div>
                <PuttingDonutChart summary={s} />
                <div className="mt-2 space-y-1">
                  {PUTT_CATS.map(c => {
                    const val = s[c.key];
                    return (
                      <div key={c.key} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-gray-500 flex-1">{c.label}</span>
                        <span className="text-gray-400 font-mono">{val} ({s.total > 0 ? ((val / s.total) * 100).toFixed(0) : 0}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Comparison */}
      {hasStats && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Stats Comparison</h2>
            <p className="text-xs text-gray-700 mt-0.5">Season averages · highlighted = better</p>
          </div>
          <div className="divide-y divide-gray-800/60">
            {STAT_DEFS.map(def => {
              const v1 = avgStats1[def.key];
              const v2 = avgStats2[def.key];
              if (v1 === null && v2 === null) return null;

              const hasWinner = v1 !== null && v2 !== null;
              const isTie = hasWinner && v1 === v2;
              let p1Wins = false;
              if (hasWinner && !isTie) {
                p1Wins = def.lowerBetter ? v1! < v2! : v1! > v2!;
              }
              const p2Wins = hasWinner && !isTie && !p1Wins;

              // Bar widths: proportion of max
              const max = Math.max(v1 ?? 0, v2 ?? 0);
              const bar1 = max > 0 && v1 !== null ? (def.lowerBetter ? (1 - v1 / max) * 100 : (v1 / max) * 100) : 0;
              const bar2 = max > 0 && v2 !== null ? (def.lowerBetter ? (1 - v2 / max) * 100 : (v2 / max) * 100) : 0;

              return (
                <div key={String(def.key)} className="px-4 py-2.5">
                  {/* Values row */}
                  <div className="flex items-center gap-3 mb-1.5">
                    <span
                      className={`flex-1 text-right font-mono text-sm font-semibold tabular-nums ${
                        p1Wins || isTie ? "opacity-100" : "opacity-40"
                      }`}
                      style={{ color: v1 !== null ? color1 : undefined }}
                    >
                      {v1 !== null ? def.fmt(v1) : "—"}
                    </span>
                    <span className="text-xs text-gray-600 uppercase tracking-wide font-medium w-24 text-center shrink-0">
                      {def.label}
                    </span>
                    <span
                      className={`flex-1 text-left font-mono text-sm font-semibold tabular-nums ${
                        p2Wins || isTie ? "opacity-100" : "opacity-40"
                      }`}
                      style={{ color: v2 !== null ? color2 : undefined }}
                    >
                      {v2 !== null ? def.fmt(v2) : "—"}
                    </span>
                  </div>
                  {/* Bar row */}
                  <div className="flex items-center gap-1">
                    {/* P1 bar (right-aligned) */}
                    <div className="flex-1 flex justify-end">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${bar1}%`,
                          backgroundColor: p1Wins || isTie ? color1 : `${color1}40`,
                        }}
                      />
                    </div>
                    <div className="w-px h-3 bg-gray-700 shrink-0" />
                    {/* P2 bar (left-aligned) */}
                    <div className="flex-1 flex justify-start">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${bar2}%`,
                          backgroundColor: p2Wins || isTie ? color2 : `${color2}40`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week-by-week */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-900 border-b border-gray-800">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Week by Week</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/80 text-xs uppercase tracking-widest border-b border-gray-800">
              <th className="text-left px-5 py-2.5 text-gray-500 font-semibold">Event</th>
              <th className="text-center px-3 py-2.5 font-semibold" style={{ color: color1 }}>{player1}</th>
              <th className="text-center px-3 py-2.5 text-gray-600 font-semibold">Result</th>
              <th className="text-center px-3 py-2.5 font-semibold" style={{ color: color2 }}>{player2}</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map(({ tournament, r1, r2, outcome }, i) => (
              <tr
                key={tournament.id}
                className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/40 ${
                  i % 2 === 0 ? "bg-gray-900" : "bg-gray-950/50"
                } ${outcome === "win" ? "border-l-2" : outcome === "loss" ? "border-r-2" : ""}`}
                style={outcome === "win" ? { borderLeftColor: color1 } : outcome === "loss" ? { borderRightColor: color2 } : {}}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono text-xs w-12 shrink-0">{tournament.week}</span>
                    <span className="text-gray-300 text-sm">{tournament.name}</span>
                    {tournament.isMajor && <span className="text-xs text-yellow-400">★</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-mono text-sm font-semibold ${outcome === "win" ? "opacity-100" : "opacity-40"}`} style={{ color: color1 }}>
                    {r1.score}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {outcome === "win" && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: color1, backgroundColor: `${color1}20` }}>W</span>}
                  {outcome === "loss" && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: color2, backgroundColor: `${color2}20` }}>L</span>}
                  {outcome === "tie" && <span className="text-xs text-gray-600 font-medium">T</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-mono text-sm font-semibold ${outcome === "loss" ? "opacity-100" : "opacity-40"}`} style={{ color: color2 }}>
                    {r2.score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
