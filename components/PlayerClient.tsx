"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { PLAYER_COLORS } from "@/lib/types";
import CombinedRoundView from "./CombinedRoundView";

interface Tournament {
  id: number;
  name: string;
  week: string;
  date: string;
  isMajor: boolean;
}

interface Result {
  id: number;
  tournamentId: number;
  playerId: string;
  type: string;
  position: number;
  score: string;
  points: number;
  tournament: Tournament;
}

interface CoachingReport {
  id: number;
  playerId: string;
  tournamentId: number;
  report: string;
  createdAt: Date | string;
}

interface Player {
  id: string;
  handicap: number;
  results: Result[];
  coachingReports: CoachingReport[];
}

interface Props {
  player: Player;
}

function scoreToNum(score: string): number {
  if (score === "E") return 0;
  return parseInt(score.replace("+", "")) || 0;
}

export default function PlayerClient({ player }: Props) {
  const [resultTab, setResultTab] = useState<"gross" | "net">("gross");
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const [reports, setReports] = useState<Record<number, string>>(
    Object.fromEntries(player.coachingReports.map(r => [r.tournamentId, r.report]))
  );

  const grossResults = player.results.filter(r => r.type === "gross");
  const netResults = player.results.filter(r => r.type === "net");
  const activeResults = resultTab === "gross" ? grossResults : netResults;

  // Compute stats
  const grossWins = grossResults.filter(r => r.position === 1).length;
  const netWins = netResults.filter(r => r.position === 1).length;
  const grossTop3 = grossResults.filter(r => r.position <= 3).length;
  const totalGrossPoints = grossResults.reduce((s, r) => s + r.points, 0);
  const totalNetPoints = netResults.reduce((s, r) => s + r.points, 0);

  const grossScores = grossResults.map(r => scoreToNum(r.score));
  const avgGross = grossScores.length > 0
    ? (grossScores.reduce((a, b) => a + b, 0) / grossScores.length).toFixed(1)
    : "—";
  const bestGross = grossScores.length > 0 ? `+${Math.min(...grossScores)}` : "—";

  // Chart data
  const chartData = grossResults.map(r => ({
    week: r.tournament.week,
    score: scoreToNum(r.score),
    position: r.position,
  }));

  const color = PLAYER_COLORS[player.id] ?? "#10b981";

  async function generateReport(tournamentId: number) {
    setGenerating(tournamentId);
    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, tournamentId }),
      });
      const data = await res.json();
      if (data.report) {
        setReports(prev => ({ ...prev, [tournamentId]: data.report }));
        setExpandedReport(tournamentId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-gray-500 hover:text-white text-sm transition-colors">
          ← Standings
        </Link>
        <div className="h-4 w-px bg-gray-700" />
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
          <h1 className="text-2xl font-bold">{player.id}</h1>
          <span className="text-gray-500 text-sm">HCP {player.handicap}</span>
          {player.id === "holiday402" && (
            <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-400 rounded border border-green-800">you</span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Gross Wins", value: grossWins, highlight: grossWins > 0 },
          { label: "Net Wins", value: netWins, highlight: netWins > 0 },
          { label: "Gross Top 3", value: grossTop3 },
          { label: "Avg Score", value: `+${avgGross}` },
          { label: "Best Round", value: bestGross, green: true },
          { label: "Gross Points", value: totalGrossPoints.toLocaleString() },
          { label: "Net Points", value: totalNetPoints.toLocaleString() },
          { label: "Events Played", value: grossResults.length },
        ].map(({ label, value, highlight, green }) => (
          <div key={label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-xl font-bold ${highlight ? "text-yellow-400" : green ? "text-green-400" : "text-white"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Score trend chart */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
        <h2 className="text-base font-semibold mb-4 text-gray-300">Score Trend (Gross, Over Par)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="week" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v: unknown) => [`+${v}`, "Score"]}
            />
            <ReferenceLine y={player.handicap} stroke="#6b7280" strokeDasharray="4 4" label={{ value: "HCP", fill: "#6b7280", fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2.5}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Round-by-round results */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold">Round Results</h2>
          <div className="flex gap-2">
            {(["gross", "net"] as const).map(t => (
              <button
                key={t}
                onClick={() => setResultTab(t)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  resultTab === t ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-5 py-2">Event</th>
              <th className="text-center px-3 py-2">Pos</th>
              <th className="text-center px-3 py-2">Score</th>
              <th className="text-right px-5 py-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {activeResults.map(r => (
              <tr key={r.id} className="border-b border-gray-800/40 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs font-mono w-14">{r.tournament.week}</span>
                    <span className="text-gray-200">{r.tournament.name}</span>
                    {r.tournament.isMajor && (
                      <span className="text-xs text-yellow-400 font-bold">★ MAJOR</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={r.position === 1 ? "text-yellow-400 font-bold" : "text-gray-400"}>
                    {r.position}
                    <span className="text-xs">{r.position === 1 ? "st" : r.position === 2 ? "nd" : r.position === 3 ? "rd" : "th"}</span>
                  </span>
                </td>
                <td className="px-3 py-3 text-center font-mono text-sm text-gray-200">{r.score}</td>
                <td className="px-5 py-3 text-right text-gray-400 font-mono">{r.points.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Round Details — correlated SGT shot data + GSPro launch monitor */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 mb-8">
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Round Details</h2>
            <span className="text-xs px-1.5 py-0.5 bg-sky-900/40 text-sky-400 rounded border border-sky-800">SGT + GSPro</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Hole-by-hole shot data with launch monitor metrics per shot. Tabs: Hole by Hole · By Club.
          </p>
        </div>
        <div className="divide-y divide-gray-800">
          {grossResults.map(r => {
            const isOpen = expandedRound === r.tournamentId;
            return (
              <div key={r.tournamentId}>
                <button
                  onClick={() => setExpandedRound(isOpen ? null : r.tournamentId)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs font-mono w-14">{r.tournament.week}</span>
                    <span className="text-gray-300 text-sm">{r.tournament.name}</span>
                    {r.tournament.isMajor && (
                      <span className="text-xs text-yellow-400 font-bold">★</span>
                    )}
                    <span className="text-gray-500 font-mono text-xs">{r.score}</span>
                  </div>
                  <span className="text-gray-600 text-xs">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-3 border-t border-gray-800/50">
                    <CombinedRoundView
                      playerId={player.id}
                      tournamentId={r.tournamentId}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Coaching Reports */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold">AI Coaching Reports</h2>
          <p className="text-xs text-gray-500 mt-1">
            Generated by Claude. Requires shot data from Portal 2 for detailed analysis.
          </p>
        </div>
        <div className="divide-y divide-gray-800">
          {grossResults.map(r => {
            const hasReport = !!reports[r.tournamentId];
            const isExpanded = expandedReport === r.tournamentId;
            const isGenerating = generating === r.tournamentId;

            return (
              <div key={r.tournamentId} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs font-mono w-14">{r.tournament.week}</span>
                    <span className="text-gray-300 text-sm">{r.tournament.name}</span>
                    <span className="text-gray-500 font-mono text-xs">{r.score}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasReport && (
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : r.tournamentId)}
                        className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        {isExpanded ? "Hide" : "View"} Report
                      </button>
                    )}
                    <button
                      onClick={() => generateReport(r.tournamentId)}
                      disabled={isGenerating}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        isGenerating
                          ? "bg-gray-800 text-gray-500 cursor-wait"
                          : hasReport
                          ? "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
                          : "bg-green-700 text-white hover:bg-green-600"
                      }`}
                    >
                      {isGenerating ? "Generating..." : hasReport ? "Regenerate" : "Generate Report"}
                    </button>
                  </div>
                </div>
                {isExpanded && hasReport && (
                  <div className="mt-4 p-4 bg-gray-800 rounded-lg text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {reports[r.tournamentId]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
