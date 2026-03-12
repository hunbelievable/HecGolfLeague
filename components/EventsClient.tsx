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
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        <div className="flex gap-2">
          {(["gross", "net"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {events.map(event => {
          const typeResults = event.results.filter(r => r.type === tab);
          const winner = typeResults.find(r => r.position === 1);
          const isOpen = expanded.has(event.id);

          return (
            <div
              key={event.id}
              className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
            >
              <button
                onClick={() => toggle(event.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800 transition-colors text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono w-16">{event.week}</span>
                    <span className="font-semibold text-white">{event.name}</span>
                    {event.isMajor && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded font-bold border border-yellow-500/30">
                        MAJOR
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-600">
                      {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    {winner && (
                      <span className="text-xs text-gray-400">
                        Winner:{" "}
                        <span
                          className="font-medium"
                          style={{ color: PLAYER_COLORS[winner.playerId] ?? "#fff" }}
                        >
                          {winner.playerId}
                        </span>
                        {" "}<span className="text-gray-500 font-mono">{winner.score}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-gray-600 text-sm">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                        <th className="text-left px-5 py-2 w-8">Pos</th>
                        <th className="text-left px-3 py-2">Player</th>
                        <th className="text-center px-3 py-2">Score</th>
                        <th className="text-right px-5 py-2">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeResults.map(r => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-800/40 last:border-0"
                        >
                          <td className="px-5 py-2.5 text-gray-500">{r.position}</td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/player/${r.playerId}`}
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                              onClick={e => e.stopPropagation()}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: PLAYER_COLORS[r.playerId] ?? "#888" }}
                              />
                              <span style={{ color: PLAYER_COLORS[r.playerId] ?? "#fff" }}>
                                {r.playerId}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-sm">
                            <span className={r.position === 1 ? "text-yellow-400 font-bold" : "text-gray-300"}>
                              {r.score}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right text-gray-400 font-mono">
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
