"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { StandingsData, PlayerStanding } from "@/lib/types";
import { PLAYER_COLORS } from "@/lib/types";

const PLAYERS = ["BDizzle", "NickP", "holiday402", "bsteffy", "BozClubBreaker", "TLindell"];

interface Props {
  data: StandingsData;
}

function positionSuffix(pos: number) {
  if (pos === 1) return "st";
  if (pos === 2) return "nd";
  if (pos === 3) return "rd";
  return "th";
}

export default function StandingsClient({ data }: Props) {
  const [tab, setTab] = useState<"gross" | "net">("gross");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const standings = tab === "gross" ? data.gross : data.net;

  useEffect(() => { setMounted(true); }, []);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Season Standings</h1>
        <span className="text-sm text-gray-500">10 Events</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {(["gross", "net"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded font-medium text-sm transition-colors ${
              tab === t
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Standings table */}
      <div className="bg-gray-900 rounded-lg overflow-hidden mb-8 border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 w-8">Pos</th>
              <th className="text-left px-4 py-3">Player</th>
              {tab === "net" && <th className="text-center px-3 py-3">HCP</th>}
              <th className="text-center px-3 py-3">Events</th>
              <th className="text-center px-3 py-3">Wins</th>
              <th className="text-center px-3 py-3">Top 3</th>
              <th className="text-center px-3 py-3">Best</th>
              <th className="text-center px-3 py-3">Worst</th>
              <th className="text-right px-4 py-3">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.playerId}
                onClick={() => router.push(`/player/${s.playerId}`)}
                className="border-b border-gray-800/50 hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PLAYER_COLORS[s.playerId] ?? "#888" }}
                    />
                    <span className="font-medium text-white">{s.playerId}</span>
                    {s.playerId === "holiday402" && (
                      <span className="text-xs text-gray-500">(you)</span>
                    )}
                  </div>
                </td>
                {tab === "net" && (
                  <td className="px-3 py-3 text-center text-gray-400">{s.handicap}</td>
                )}
                <td className="px-3 py-3 text-center text-gray-400">{s.events}</td>
                <td className="px-3 py-3 text-center">
                  {s.wins > 0 ? (
                    <span className="text-yellow-400 font-bold">{s.wins}</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-gray-400">{s.top3}</td>
                <td className="px-3 py-3 text-center text-green-400 font-mono text-xs">{s.bestScore}</td>
                <td className="px-3 py-3 text-center text-red-400 font-mono text-xs">{s.worstScore}</td>
                <td className="px-4 py-3 text-right font-bold font-mono text-white">
                  {s.totalPoints.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Points progression chart */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-base font-semibold mb-4 text-gray-300">
          Points Progression — {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </h2>
        <ResponsiveContainer width="100%" height={300} key={mounted ? "mounted" : "ssr"}>
          <LineChart data={data.pointsHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="week"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              labelStyle={{ color: "#e5e7eb" }}
              itemStyle={{ color: "#e5e7eb" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
            />
            {PLAYERS.map(pid => (
              <Line
                key={pid}
                type="monotone"
                dataKey={`${tab}_${pid}`}
                name={pid}
                stroke={PLAYER_COLORS[pid] ?? "#888"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
