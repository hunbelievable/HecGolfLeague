"use client";

import { useState } from "react";
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

interface Props {
  tournaments: Tournament[];
  players: Player[];
}

const PLAYER_IDS = ["BDizzle", "NickP", "holiday402", "bsteffy", "BozClubBreaker", "TLindell"];

function scoreToNum(score: string): number {
  if (score === "E") return 0;
  return parseInt(score.replace("+", "")) || 0;
}

export default function HeadToHeadClient({ tournaments, players }: Props) {
  const [player1, setPlayer1] = useState("holiday402");
  const [player2, setPlayer2] = useState("BDizzle");
  const [tab, setTab] = useState<"gross" | "net">("gross");

  const head1 = players.find(p => p.id === player1);
  const head2 = players.find(p => p.id === player2);

  type Matchup = {
    tournament: Tournament;
    r1: Result;
    r2: Result;
    s1: number;
    s2: number;
    outcome: "win" | "loss" | "tie";
  };

  const matchups: Matchup[] = tournaments.flatMap(t => {
    const r1 = t.results.find(r => r.playerId === player1 && r.type === tab);
    const r2 = t.results.find(r => r.playerId === player2 && r.type === tab);
    if (!r1 || !r2) return [];

    const s1 = scoreToNum(r1.score);
    const s2 = scoreToNum(r2.score);
    let outcome: "win" | "loss" | "tie";
    if (s1 < s2) outcome = "win";
    else if (s2 < s1) outcome = "loss";
    else outcome = "tie";

    return [{ tournament: t, r1, r2, s1, s2, outcome }];
  });

  const wins = matchups.filter(m => m.outcome === "win").length;
  const losses = matchups.filter(m => m.outcome === "loss").length;
  const ties = matchups.filter(m => m.outcome === "tie").length;

  const color1 = PLAYER_COLORS[player1] ?? "#10b981";
  const color2 = PLAYER_COLORS[player2] ?? "#ef4444";

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Head to Head</h1>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      {/* Controls row */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Player 1 selector */}
          <div className="flex items-center gap-2 flex-1 min-w-36">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/20"
              style={{ backgroundColor: color1 }}
            />
            <select
              value={player1}
              onChange={e => setPlayer1(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600/60 transition-colors"
            >
              {PLAYER_IDS.filter(id => id !== player2).map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <span className="text-gray-600 font-bold text-sm px-1">vs</span>

          {/* Player 2 selector */}
          <div className="flex items-center gap-2 flex-1 min-w-36">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/20"
              style={{ backgroundColor: color2 }}
            />
            <select
              value={player2}
              onChange={e => setPlayer2(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600/60 transition-colors"
            >
              {PLAYER_IDS.filter(id => id !== player1).map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          {/* Gross / Net toggle */}
          <div className="flex gap-1.5">
            {(["gross", "net"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold tracking-wide transition-all duration-150 ${
                  tab === t
                    ? "bg-green-600 text-white shadow-lg shadow-green-900/40"
                    : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Record summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-3xl font-bold tabular-nums" style={{ color: color1 }}>
            {wins}
          </div>
          <div className="text-xs text-gray-600 mt-1.5 uppercase tracking-wide font-medium truncate px-1">
            {player1} wins
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-3xl font-bold text-gray-500 tabular-nums">{ties}</div>
          <div className="text-xs text-gray-600 mt-1.5 uppercase tracking-wide font-medium">Ties</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-3xl font-bold tabular-nums" style={{ color: color2 }}>
            {losses}
          </div>
          <div className="text-xs text-gray-600 mt-1.5 uppercase tracking-wide font-medium truncate px-1">
            {player2} wins
          </div>
        </div>
      </div>

      {/* Win bar */}
      {matchups.length > 0 && (
        <div className="mb-6">
          <div className="h-3 rounded-full overflow-hidden flex bg-gray-800">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${(wins / matchups.length) * 100}%`, backgroundColor: color1 }}
            />
            <div
              className="h-full transition-all duration-500 bg-gray-600"
              style={{ width: `${(ties / matchups.length) * 100}%` }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${(losses / matchups.length) * 100}%`, backgroundColor: color2 }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1.5 font-mono">
            <span style={{ color: color1 }}>{((wins / matchups.length) * 100).toFixed(0)}%</span>
            <span style={{ color: color2 }}>{((losses / matchups.length) * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Week-by-week breakdown */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-900 border-b border-gray-800">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Week by Week
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/80 text-xs uppercase tracking-widest border-b border-gray-800">
              <th className="text-left px-5 py-2.5 text-gray-500 font-semibold">Event</th>
              <th className="text-center px-3 py-2.5 font-semibold" style={{ color: color1 }}>
                {player1}
              </th>
              <th className="text-center px-3 py-2.5 text-gray-600 font-semibold">Result</th>
              <th className="text-center px-3 py-2.5 font-semibold" style={{ color: color2 }}>
                {player2}
              </th>
            </tr>
          </thead>
          <tbody>
            {matchups.map(({ tournament, r1, r2, outcome }, i) => (
              <tr
                key={tournament.id}
                className={`border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/40 ${
                  i % 2 === 0 ? "bg-gray-900" : "bg-gray-950/50"
                } ${outcome === "win" ? "border-l-2" : outcome === "loss" ? "border-r-2" : ""}`}
                style={
                  outcome === "win"
                    ? { borderLeftColor: color1 }
                    : outcome === "loss"
                    ? { borderRightColor: color2 }
                    : {}
                }
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono text-xs w-12 shrink-0">
                      {tournament.week}
                    </span>
                    <span className="text-gray-300 text-sm">{tournament.name}</span>
                    {tournament.isMajor && (
                      <span className="text-xs text-yellow-400">★</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      outcome === "win" ? "opacity-100" : "opacity-40"
                    }`}
                    style={{ color: color1 }}
                  >
                    {r1.score}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {outcome === "win" && (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ color: color1, backgroundColor: `${color1}20` }}
                    >
                      W
                    </span>
                  )}
                  {outcome === "loss" && (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ color: color2, backgroundColor: `${color2}20` }}
                    >
                      L
                    </span>
                  )}
                  {outcome === "tie" && (
                    <span className="text-xs text-gray-600 font-medium">T</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      outcome === "loss" ? "opacity-100" : "opacity-40"
                    }`}
                    style={{ color: color2 }}
                  >
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
