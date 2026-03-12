"use client";

import { useState } from "react";
import Link from "next/link";
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

interface Props {
  events: Tournament[];
}

export default function EventsClient({ events }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"gross" | "net">("gross");

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      <div className="space-y-2">
        {events.map((event, idx) => {
          const typeResults = event.results.filter(r => r.type === tab);
          const winner = typeResults.find(r => r.position === 1);
          const isOpen = expanded.has(event.id);

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
                {/* Week badge */}
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
                        <span
                          className="font-semibold"
                          style={{ color: PLAYER_COLORS[winner.playerId] ?? "#fff" }}
                        >
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

              {/* Expanded leaderboard */}
              {isOpen && (
                <div className="border-t border-gray-800">
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
                            <span className={`text-xs font-medium ${r.position === 1 ? "text-yellow-400 font-bold" : "text-gray-600"}`}>{r.position}</span>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
