"use client";

import { useEffect, useState } from "react";
import { PLAYER_COLORS } from "@/lib/types";

interface WeekRow {
  tournamentId: number;
  week: string;
  name: string;
  date: string;
  isMajor: boolean;
  skinsWinner: string | null;
  ctpWinner: string | null;
  netWinner: string | null;
}

interface LeaderboardEntry {
  playerId: string;
  skins: number;
  ctp: number;
  net: number;
}

interface WeeklyPrizesData {
  weeks: WeekRow[];
  leaderboard: LeaderboardEntry[];
}

function PlayerBadge({ playerId }: { playerId: string | null }) {
  if (!playerId) return <span className="text-gray-700 text-sm">—</span>;
  const color = PLAYER_COLORS[playerId] ?? "#9ca3af";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {playerId}
    </span>
  );
}

export default function WeeklyPrizesPage() {
  const [data, setData] = useState<WeeklyPrizesData | null>(null);

  useEffect(() => {
    fetch("/api/weekly-prizes")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
        Loading...
      </div>
    );
  }

  const { weeks, leaderboard } = data;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Weekly Prizes</h1>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      {/* Leaderboard totals */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Prize Totals
          </h2>
        </div>
        <div className="rounded-xl border border-gray-800 overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-700/80">
                <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  Player
                </th>
                <th className="text-center px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  CTP
                </th>
                <th className="text-center px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  Skins
                </th>
                <th className="text-center px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest border-l border-gray-800">
                  Net Wins
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const color = PLAYER_COLORS[entry.playerId] ?? "#9ca3af";
                const isLeader = i === 0;
                return (
                  <tr
                    key={entry.playerId}
                    className={`border-b border-gray-800/60 last:border-0 transition-colors hover:bg-gray-800/40 ${
                      i % 2 === 0 ? "bg-gray-900" : "bg-gray-900/60"
                    } ${isLeader ? "border-l-2" : ""}`}
                    style={isLeader ? { borderLeftColor: color } : undefined}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full ring-1 ring-black/20"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-white text-sm">{entry.playerId}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      {entry.ctp > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-md bg-sky-500/15 text-sky-400 text-xs font-bold">
                          {entry.ctp}
                        </span>
                      ) : (
                        <span className="text-gray-700 text-xs">0</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3">
                      {entry.skins > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-md bg-purple-500/15 text-purple-400 text-xs font-bold">
                          {entry.skins}
                        </span>
                      ) : (
                        <span className="text-gray-700 text-xs">0</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3 border-l border-gray-800">
                      {entry.net > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-md bg-yellow-500/15 text-yellow-400 text-xs font-bold">
                          {entry.net}
                        </span>
                      ) : (
                        <span className="text-gray-700 text-xs">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Week-by-week breakdown */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Week by Week
          </h2>
        </div>
        <div className="rounded-xl border border-gray-800 overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-700/80">
                <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  Week
                </th>
                <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest hidden sm:table-cell">
                  Course
                </th>
                <th className="text-center px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  CTP
                </th>
                <th className="text-center px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  Skins
                </th>
                <th className="text-center px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  Net Win
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr
                  key={w.tournamentId}
                  className={`border-b border-gray-800/60 last:border-0 transition-colors hover:bg-gray-800/40 ${
                    i % 2 === 0 ? "bg-gray-900" : "bg-gray-900/60"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{w.week}</span>
                      {w.isMajor && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-yellow-500/15 text-yellow-400 rounded border border-yellow-500/25 font-semibold">
                          ★ Major
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm hidden sm:table-cell">{w.name}</td>
                  <td className="text-center px-4 py-3">
                    <PlayerBadge playerId={w.ctpWinner} />
                  </td>
                  <td className="text-center px-4 py-3">
                    <PlayerBadge playerId={w.skinsWinner} />
                  </td>
                  <td className="text-center px-4 py-3">
                    <PlayerBadge playerId={w.netWinner} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
