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
  if (!playerId) return <span className="text-gray-600 text-sm">—</span>;
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
      <div className="flex items-center justify-center h-40 text-gray-500">
        Loading...
      </div>
    );
  }

  const { weeks, leaderboard } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Weekly Prizes</h1>

      {/* Leaderboard totals */}
      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Prize Totals</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium">Player</th>
                <th className="text-center px-4 py-3 font-medium">🎯 CTP</th>
                <th className="text-center px-4 py-3 font-medium">💰 Skins</th>
                <th className="text-center px-4 py-3 font-medium border-l border-gray-700">🏆 Net Wins</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const color = PLAYER_COLORS[entry.playerId] ?? "#9ca3af";
                return (
                  <tr
                    key={entry.playerId}
                    className={`border-b border-gray-800 last:border-0 ${i === 0 ? "bg-gray-800/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium text-white">{entry.playerId}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3 text-gray-200">
                      {entry.ctp > 0 ? <span className="font-semibold">{entry.ctp}</span> : <span className="text-gray-600">0</span>}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-200">
                      {entry.skins > 0 ? <span className="font-semibold">{entry.skins}</span> : <span className="text-gray-600">0</span>}
                    </td>
                    <td className="text-center px-4 py-3 text-gray-200 border-l border-gray-700">
                      {entry.net > 0 ? <span className="font-semibold">{entry.net}</span> : <span className="text-gray-600">0</span>}
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
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Week by Week</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium">Week</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Course</th>
                <th className="text-center px-4 py-3 font-medium">🎯 CTP</th>
                <th className="text-center px-4 py-3 font-medium">💰 Skins</th>
                <th className="text-center px-4 py-3 font-medium">🏆 Net Win</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.tournamentId} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{w.week}</span>
                      {w.isMajor && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                          Major
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{w.name}</td>
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
