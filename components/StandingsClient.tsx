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
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-end gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Season Standings</h1>
          <span className="text-sm text-gray-500 mb-0.5">10 Events</span>
        </div>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        {(["gross", "net"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold tracking-wide transition-all duration-150 ${
              tab === t
                ? "bg-green-600 text-white shadow-lg shadow-green-900/40"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Standings table */}
      <div className="rounded-xl overflow-hidden mb-8 border border-gray-800 shadow-xl shadow-black/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-700/80">
              <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest w-10">
                #
              </th>
              <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                Player
              </th>
              {tab === "net" && (
                <th className="text-center px-3 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  HCP
                </th>
              )}
              <th className="text-center px-3 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest hidden sm:table-cell">
                Played
              </th>
              <th className="text-center px-3 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                Wins
              </th>
              <th className="text-center px-3 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest hidden sm:table-cell">
                Top 3
              </th>
              <th className="text-center px-3 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest hidden md:table-cell">
                Best
              </th>
              <th className="text-center px-3 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest hidden md:table-cell">
                Worst
              </th>
              <th className="text-right px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-widest">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.playerId}
                onClick={() => router.push(`/player/${s.playerId}`)}
                className={`border-b border-gray-800/60 last:border-0 cursor-pointer transition-colors duration-100 group ${
                  i % 2 === 0 ? "bg-gray-900" : "bg-gray-900/60"
                } hover:bg-gray-800`}
              >
                <td className="px-4 py-3">
                  {i === 0 ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                      1
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs font-medium">{i + 1}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/20"
                      style={{ backgroundColor: PLAYER_COLORS[s.playerId] ?? "#888" }}
                    />
                    <span className="font-semibold text-white text-sm group-hover:text-green-400 transition-colors">
                      {s.playerId}
                    </span>
                  </div>
                </td>
                {tab === "net" && (
                  <td className="px-3 py-3 text-center text-gray-500 text-xs">{s.handicap}</td>
                )}
                <td className="px-3 py-3 text-center text-gray-500 text-xs hidden sm:table-cell">
                  {s.events}
                </td>
                <td className="px-3 py-3 text-center">
                  {s.wins > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded bg-yellow-500/15 text-yellow-400 text-xs font-bold">
                      {s.wins}
                    </span>
                  ) : (
                    <span className="text-gray-700 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-gray-500 text-xs hidden sm:table-cell">
                  {s.top3}
                </td>
                <td className="px-3 py-3 text-center font-mono text-xs text-green-500 hidden md:table-cell">
                  {s.bestScore}
                </td>
                <td className="px-3 py-3 text-center font-mono text-xs text-red-500 hidden md:table-cell">
                  {s.worstScore}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold font-mono text-white text-sm">
                    {s.totalPoints.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Points progression chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">
              Points Progression
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {tab.charAt(0).toUpperCase() + tab.slice(1)} — cumulative after each event
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280} key={mounted ? "mounted" : "ssr"}>
          <LineChart data={data.pointsHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="week"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#d1d5db", fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: "#d1d5db", padding: "1px 0" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#6b7280", paddingTop: 12 }}
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
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
