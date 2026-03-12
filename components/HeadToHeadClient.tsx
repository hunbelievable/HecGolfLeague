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
      <h1 className="text-2xl font-bold mb-6">Head-to-Head</h1>

      {/* Player selectors */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color1 }} />
          <select
            value={player1}
            onChange={e => setPlayer1(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            {PLAYER_IDS.filter(id => id !== player2).map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>

        <span className="text-gray-500 font-bold text-lg">vs</span>

        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color2 }} />
          <select
            value={player2}
            onChange={e => setPlayer2(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            {PLAYER_IDS.filter(id => id !== player1).map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>

        <div className="ml-2 flex gap-2">
          {(["gross", "net"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                tab === t ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Record summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 text-center">
          <div className="text-3xl font-bold" style={{ color: color1 }}>{wins}</div>
          <div className="text-xs text-gray-500 mt-1">
            {player1} wins
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 text-center">
          <div className="text-3xl font-bold text-gray-400">{ties}</div>
          <div className="text-xs text-gray-500 mt-1">Ties</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 text-center">
          <div className="text-3xl font-bold" style={{ color: color2 }}>{losses}</div>
          <div className="text-xs text-gray-500 mt-1">
            {player2} wins
          </div>
        </div>
      </div>

      {/* Win bar */}
      {matchups.length > 0 && (
        <div className="mb-8">
          <div className="h-4 rounded-full overflow-hidden flex bg-gray-800">
            <div
              className="h-full transition-all"
              style={{ width: `${(wins / matchups.length) * 100}%`, backgroundColor: color1 }}
            />
            <div
              className="h-full transition-all bg-gray-600"
              style={{ width: `${(ties / matchups.length) * 100}%` }}
            />
            <div
              className="h-full transition-all"
              style={{ width: `${(losses / matchups.length) * 100}%`, backgroundColor: color2 }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{((wins / matchups.length) * 100).toFixed(0)}%</span>
            <span>{((losses / matchups.length) * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Week-by-week breakdown */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Week-by-Week</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-5 py-2">Event</th>
              <th className="text-center px-3 py-2" style={{ color: color1 }}>{player1}</th>
              <th className="text-center px-3 py-2 text-gray-500">Result</th>
              <th className="text-center px-3 py-2" style={{ color: color2 }}>{player2}</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map(({ tournament, r1, r2, outcome }) => (
              <tr key={tournament.id} className="border-b border-gray-800/40 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-mono text-xs w-14">{tournament.week}</span>
                    <span className="text-gray-300">{tournament.name}</span>
                    {tournament.isMajor && <span className="text-xs text-yellow-400">★</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-mono" style={{ color: outcome === "win" ? color1 : "#9ca3af" }}>
                  {r1.score}
                  {outcome === "win" && <span className="ml-1 text-xs">✓</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {outcome === "win" && (
                    <span className="text-xs font-bold" style={{ color: color1 }}>W</span>
                  )}
                  {outcome === "loss" && (
                    <span className="text-xs font-bold" style={{ color: color2 }}>L</span>
                  )}
                  {outcome === "tie" && (
                    <span className="text-xs text-gray-500">T</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center font-mono" style={{ color: outcome === "loss" ? color2 : "#9ca3af" }}>
                  {r2.score}
                  {outcome === "loss" && <span className="ml-1 text-xs">✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
