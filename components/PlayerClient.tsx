"use client";

import { useState, useEffect } from "react";
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
  const [reportError, setReportError] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<number, string>>(
    Object.fromEntries(player.coachingReports.map(r => [r.tournamentId, r.report]))
  );
  const [prizeWins, setPrizeWins] = useState<{ skins: number; ctp: number } | null>(null);

  useEffect(() => {
    fetch("/api/weekly-prizes")
      .then(r => r.json())
      .then(({ leaderboard }: { leaderboard: { playerId: string; skins: number; ctp: number; net: number }[] }) => {
        const entry = leaderboard.find(e => e.playerId === player.id);
        setPrizeWins(entry ? { skins: entry.skins, ctp: entry.ctp } : { skins: 0, ctp: 0 });
      })
      .catch(() => setPrizeWins({ skins: 0, ctp: 0 }));
  }, [player.id]);

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
    setReportError(null);
    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, tournamentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error ?? `Server error ${res.status}`);
        return;
      }
      if (data.report) {
        setReports(prev => ({ ...prev, [tournamentId]: data.report }));
        setExpandedReport(tournamentId);
      } else {
        setReportError("No report returned. Check server logs.");
      }
    } catch (e) {
      console.error(e);
      setReportError(e instanceof Error ? e.message : "Network error — is the server running?");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3 group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to Standings</span>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-black/20"
            style={{ backgroundColor: color }}
          />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-0.5">
              {player.id}
            </h1>
            <span className="text-xs text-gray-500 font-mono">
              Handicap {player.handicap}
            </span>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent mt-4" />
      </div>

      {/* Stat cards — compact 5-column grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Gross Wins", value: grossWins, highlight: grossWins > 0, highlightColor: "text-yellow-400" },
          { label: "Net Wins", value: netWins, highlight: netWins > 0, highlightColor: "text-yellow-400" },
          { label: "CTP Wins", value: prizeWins?.ctp ?? "—", highlight: (prizeWins?.ctp ?? 0) > 0, highlightColor: "text-sky-400" },
          { label: "Skins Wins", value: prizeWins?.skins ?? "—", highlight: (prizeWins?.skins ?? 0) > 0, highlightColor: "text-purple-400" },
          { label: "Top 3 Finishes", value: grossTop3 },
        ].map(({ label, value, highlight, highlightColor }) => (
          <div
            key={label}
            className="bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-medium">{label}</div>
            <div className={`text-2xl font-bold tabular-nums ${highlight ? highlightColor : "text-white"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Avg Score", value: `+${avgGross}`, sub: "gross over par" },
          { label: "Best Round", value: bestGross, sub: "gross", green: true },
          { label: "Gross Points", value: totalGrossPoints.toLocaleString(), sub: "season total" },
          { label: "Net Points", value: totalNetPoints.toLocaleString(), sub: "season total" },
        ].map(({ label, value, sub, green }) => (
          <div
            key={label}
            className="bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="text-xs text-gray-600 mb-1 uppercase tracking-wide font-medium">{label}</div>
            <div className={`text-xl font-bold font-mono tabular-nums ${green ? "text-green-400" : "text-white"}`}>
              {value}
            </div>
            {sub && <div className="text-xs text-gray-700 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Score trend chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Score Trend</h2>
          <p className="text-xs text-gray-600 mt-0.5">Gross score over par by event</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
              width={28}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#d1d5db", fontWeight: 600 }}
              formatter={(v: unknown) => [`+${v}`, "Score"]}
            />
            <ReferenceLine
              y={player.handicap}
              stroke="#374151"
              strokeDasharray="4 4"
              label={{ value: "HCP", fill: "#4b5563", fontSize: 9 }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2.5}
              dot={{ fill: color, r: 3.5, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Round-by-round results */}
      <div className="rounded-xl border border-gray-800 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Round Results</h2>
          </div>
          <div className="flex gap-1.5">
            {(["gross", "net"] as const).map(t => (
              <button
                key={t}
                onClick={() => setResultTab(t)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  resultTab === t
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/80 text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
              <th className="text-left px-5 py-2.5 font-semibold">Event</th>
              <th className="text-center px-3 py-2.5 font-semibold">Pos</th>
              <th className="text-center px-3 py-2.5 font-semibold">Score</th>
              <th className="text-right px-5 py-2.5 font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {activeResults.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/40 ${
                  i % 2 === 0 ? "bg-gray-900" : "bg-gray-900/50"
                }`}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-xs font-mono w-12 shrink-0">{r.tournament.week}</span>
                    <span className="text-gray-200 text-sm">{r.tournament.name}</span>
                    {r.tournament.isMajor && (
                      <span className="text-xs text-yellow-400 font-bold ml-1">★</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  {r.position === 1 ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                      1
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">
                      {r.position}
                      <span className="text-gray-700">
                        {r.position === 2 ? "nd" : r.position === 3 ? "rd" : "th"}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center font-mono text-sm text-gray-200">{r.score}</td>
                <td className="px-5 py-3 text-right text-gray-500 font-mono text-xs">
                  {r.points.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Round Details — correlated SGT shot data + GSPro launch monitor */}
      <div className="rounded-xl border border-gray-800 overflow-hidden mb-6">
        <div className="px-5 py-3.5 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Round Details</h2>
            <span className="text-xs px-1.5 py-0.5 bg-sky-900/30 text-sky-400 rounded border border-sky-800/50 font-mono">
              SGT + GSPro
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Hole-by-hole shot data with launch monitor metrics. Tabs: Hole by Hole · By Club.
          </p>
        </div>
        <div className="divide-y divide-gray-800/60 bg-gray-900">
          {grossResults.map((r, i) => {
            const isOpen = expandedRound === r.tournamentId;
            return (
              <div key={r.tournamentId}>
                <button
                  onClick={() => setExpandedRound(isOpen ? null : r.tournamentId)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-xs font-mono w-12 shrink-0">{r.tournament.week}</span>
                    <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                      {r.tournament.name}
                    </span>
                    {r.tournament.isMajor && (
                      <span className="text-xs text-yellow-400">★</span>
                    )}
                    <span className="text-gray-600 font-mono text-xs">{r.score}</span>
                  </div>
                  <span className="text-gray-700 text-xs">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-3 border-t border-gray-800/50 bg-gray-950/30">
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
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-900 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-widest">AI Coaching Reports</h2>
          <p className="text-xs text-gray-600 mt-1">
            Generated by Claude. Requires shot data from Portal 2 for detailed analysis.
          </p>
        </div>
        {reportError && (
          <div className="mx-4 mt-4 p-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300 flex items-start gap-2">
            <span className="text-red-500 mt-0.5 flex-shrink-0">!</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-red-300 text-xs mb-0.5">Report generation failed</div>
              <div className="text-red-400/80 text-xs font-mono break-all">{reportError}</div>
            </div>
            <button
              onClick={() => setReportError(null)}
              className="text-red-600 hover:text-red-400 text-base leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        )}
        <div className="divide-y divide-gray-800/60 bg-gray-900">
          {grossResults.map((r, i) => {
            const hasReport = !!reports[r.tournamentId];
            const isExpanded = expandedReport === r.tournamentId;
            const isGenerating = generating === r.tournamentId;

            return (
              <div key={r.tournamentId} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-600 text-xs font-mono w-12 shrink-0">{r.tournament.week}</span>
                    <span className="text-gray-300 text-sm truncate">{r.tournament.name}</span>
                    <span className="text-gray-600 font-mono text-xs shrink-0">{r.score}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasReport && (
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : r.tournamentId)}
                        className="text-xs px-2.5 py-1 rounded-md bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
                      >
                        {isExpanded ? "Hide" : "View"}
                      </button>
                    )}
                    <button
                      onClick={() => generateReport(r.tournamentId)}
                      disabled={isGenerating}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                        isGenerating
                          ? "bg-gray-800 text-gray-600 cursor-wait"
                          : hasReport
                          ? "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300 border border-gray-700"
                          : "bg-green-700 text-white hover:bg-green-600 shadow-lg shadow-green-900/30"
                      }`}
                    >
                      {isGenerating ? "Generating..." : hasReport ? "Regen" : "Generate"}
                    </button>
                  </div>
                </div>
                {isExpanded && hasReport && (
                  <div className="mt-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
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
