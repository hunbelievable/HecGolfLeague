"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLAYER_COLORS } from "@/lib/types";

interface Result {
  id: number;
  playerId: string;
  type: string;
  position: number;
  score: string;
  points: number;
  player: { id: string; handicap: number };
}

interface Tournament {
  id: number;
  name: string;
  week: string;
  date: string;
  isMajor: boolean;
  results: Result[];
}

interface ScorecardData {
  holes: number[];
  pars: number[];
  players: { id: string; scores: (number | null)[] }[];
}

interface Props {
  events: Tournament[];
  season: number;
}

function scoreBg(score: number | null, par: number): string {
  if (score === null) return "";
  const diff = score - par;
  if (diff <= -2) return "bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400/40";
  if (diff === -1) return "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40";
  if (diff === 0)  return "text-gray-400";
  if (diff === 1)  return "text-orange-400";
  if (diff === 2)  return "text-red-400";
  return "text-red-500 font-bold";
}

function Scorecard({ tournamentId }: { tournamentId: number }) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!loaded && !loading) {
    setLoading(true);
    fetch(`/api/scorecard?tournamentId=${tournamentId}`)
      .then(r => r.json())
      .then((d: ScorecardData) => { setData(d); setLoaded(true); setLoading(false); })
      .catch(() => setLoading(false));
  }

  if (loading || !data) {
    return <div className="px-4 py-6 text-gray-600 text-sm text-center">Loading scorecard…</div>;
  }

  if (data.players.length === 0) {
    return <div className="px-4 py-6 text-gray-600 text-sm text-center">No shot data for this round.</div>;
  }

  const totalPar = data.pars.reduce((s, p) => s + p, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-max">
        <thead>
          <tr className="bg-gray-900 border-b border-gray-700">
            <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-widest sticky left-0 bg-gray-900 z-10 min-w-[100px]">
              Player
            </th>
            {data.holes.map(h => (
              <th key={h} className="text-center px-2 py-2 text-gray-500 font-semibold w-8">
                {h}
              </th>
            ))}
            <th className="text-center px-3 py-2 text-gray-500 font-semibold w-12 border-l border-gray-700/60">
              TOT
            </th>
            <th className="text-center px-3 py-2 text-gray-500 font-semibold w-12">
              +/-
            </th>
          </tr>
          {/* Par row */}
          <tr className="bg-gray-900/60 border-b border-gray-800">
            <td className="px-3 py-1.5 text-gray-600 font-semibold uppercase tracking-widest sticky left-0 bg-gray-900/60 z-10">
              Par
            </td>
            {data.pars.map((p, i) => (
              <td key={i} className="text-center px-2 py-1.5 text-gray-600 font-mono">
                {p}
              </td>
            ))}
            <td className="text-center px-3 py-1.5 text-gray-600 font-mono border-l border-gray-700/60">
              {totalPar}
            </td>
            <td />
          </tr>
        </thead>
        <tbody>
          {data.players.map((player, pi) => {
            const color = PLAYER_COLORS[player.id] ?? "#9ca3af";
            const total = player.scores.reduce<number>((s, sc) => s + (sc ?? 0), 0);
            const hasAll = player.scores.every(sc => sc !== null);
            const diff = hasAll ? total - totalPar : null;
            const diffStr = diff === null ? "—" : diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;

            return (
              <tr
                key={player.id}
                className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/30 ${
                  pi % 2 === 0 ? "bg-gray-900" : "bg-gray-950/40"
                }`}
              >
                <td className={`px-3 py-2 sticky left-0 z-10 ${pi % 2 === 0 ? "bg-gray-900" : "bg-gray-950/40"}`}>
                  <Link
                    href={`/player/${player.id}`}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-semibold" style={{ color }}>{player.id}</span>
                  </Link>
                </td>
                {player.scores.map((sc, i) => (
                  <td key={i} className={`text-center px-2 py-2 font-mono ${scoreBg(sc, data.pars[i])}`}>
                    {sc ?? "—"}
                  </td>
                ))}
                <td className="text-center px-3 py-2 font-mono text-gray-300 font-semibold border-l border-gray-700/60">
                  {hasAll ? total : "—"}
                </td>
                <td className={`text-center px-3 py-2 font-mono font-semibold ${
                  diff === null ? "text-gray-700" :
                  diff < 0 ? "text-sky-400" :
                  diff === 0 ? "text-gray-400" : "text-orange-400"
                }`}>
                  {diffStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function EventsClient({ events, season }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [view, setView] = useState<Record<number, "leaderboard" | "scorecard">>({});
  const [tab, setTab] = useState<"gross" | "net">("gross");
  const router = useRouter();

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getView(id: number): "leaderboard" | "scorecard" {
    return view[id] ?? "leaderboard";
  }

  function setEventView(id: number, v: "leaderboard" | "scorecard") {
    setView(prev => ({ ...prev, [id]: v }));
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-end justify-between mb-1">
          <div className="flex items-end gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Events</h1>
            <span className="text-sm text-gray-500 mb-0.5">{events.length} rounds</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Season toggle */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
              {[1, 2].map(s => (
                <button
                  key={s}
                  onClick={() => router.push(s === 2 ? "/events" : `/events?season=${s}`)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                    season === s
                      ? "bg-green-600 text-white shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  S{s}
                </button>
              ))}
            </div>
            {/* Gross/Net toggle */}
            <div className="flex gap-1.5">
              {(["gross", "net"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all duration-150 ${
                    t === tab
                      ? "bg-green-600 text-white shadow-lg shadow-green-900/40"
                      : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      <div className="space-y-2">
        {events.map((event) => {
          const typeResults = event.results.filter(r => r.type === tab);
          const winner = typeResults.find(r => r.position === 1);
          const isOpen = expanded.has(event.id);
          const eventView = getView(event.id);

          return (
            <div
              key={event.id}
              className="rounded-xl border border-gray-800 overflow-hidden shadow-lg shadow-black/20"
            >
              {/* Event header row */}
              <button
                onClick={() => toggle(event.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-900 hover:bg-gray-800 transition-colors text-left group"
              >
                <span className="text-xs font-mono text-gray-600 w-12 shrink-0">{event.week}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm group-hover:text-green-400 transition-colors">
                      {event.name}
                    </span>
                    {event.isMajor && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-yellow-500/15 text-yellow-400 rounded border border-yellow-500/25 font-semibold">
                        ★ MAJOR
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-700">
                      {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    {winner && (
                      <span className="text-xs text-gray-500">
                        Winner:{" "}
                        <span className="font-semibold" style={{ color: PLAYER_COLORS[winner.playerId] ?? "#fff" }}>
                          {winner.playerId}
                        </span>
                        {" "}
                        <span className="text-gray-600 font-mono">{winner.score}</span>
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-gray-700 text-xs flex-shrink-0">{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* Expanded panel */}
              {isOpen && (
                <div className="border-t border-gray-800">
                  {/* View toggle */}
                  <div className="flex gap-1 px-4 py-2 bg-gray-900/60 border-b border-gray-800">
                    {(["leaderboard", "scorecard"] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setEventView(event.id, v)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all duration-150 ${
                          eventView === v
                            ? "bg-green-600/20 text-green-400 ring-1 ring-green-600/40"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>

                  {eventView === "leaderboard" ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-900/80 text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
                          <th className="text-left px-4 py-2.5 font-semibold w-10">Pos</th>
                          <th className="text-left px-3 py-2.5 font-semibold">Player</th>
                          <th className="text-center px-3 py-2.5 font-semibold">Score</th>
                          <th className="text-right px-4 py-2.5 font-semibold">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeResults.map((r, i) => (
                          <tr
                            key={r.id}
                            className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/40 ${
                              i % 2 === 0 ? "bg-gray-900" : "bg-gray-950/50"
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-medium ${r.position === 1 ? "text-yellow-400 font-bold" : "text-gray-600"}`}>
                                {r.position}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <Link
                                href={`/player/${r.playerId}`}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                onClick={e => e.stopPropagation()}
                              >
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: PLAYER_COLORS[r.playerId] ?? "#888" }}
                                />
                                <span
                                  className="text-sm font-medium hover:underline"
                                  style={{ color: PLAYER_COLORS[r.playerId] ?? "#fff" }}
                                >
                                  {r.playerId}
                                </span>
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`font-mono text-sm ${r.position === 1 ? "text-yellow-400 font-bold" : "text-gray-300"}`}>
                                {r.score}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500 font-mono text-xs">
                              {r.points.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Scorecard tournamentId={event.id} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
