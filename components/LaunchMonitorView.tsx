"use client";

import { useEffect, useState } from "react";

interface ClubStat {
  club: string;
  count: number;
  clubSpeed: number | null;
  ballSpeed: number | null;
  carryDist: number | null;
  totalDist: number | null;
  offline: number | null;
  backSpin: number | null;
  vla: number | null;
  hla: number | null;
  faceToPath: number | null;
  clubAoA: number | null;
  spinAxis: number | null;
}

interface Summary {
  totalShots: number;
  avgDriverClubSpeed: number | null;
  avgDriverBallSpeed: number | null;
  avgDriverCarry: number | null;
  avgDriverOffline: number | null;
  driverSmashFactor: number | null;
  avgClubSpeed: number | null;
}

interface Data {
  byClub: ClubStat[];
  summary: Summary | null;
  totalShots: number;
}

type Tab = "distance" | "launch" | "spin";

function fmt(v: number | null, unit = ""): string {
  if (v === null || v === undefined) return "—";
  return `${v}${unit}`;
}

function offlineColor(v: number | null): string {
  if (v === null) return "text-gray-400";
  const abs = Math.abs(v);
  if (abs < 5) return "text-green-400";
  if (abs < 15) return "text-yellow-400";
  return "text-red-400";
}

function offlineLabel(v: number | null): string {
  if (v === null) return "—";
  if (Math.abs(v) < 1) return "straight";
  return `${Math.abs(v).toFixed(1)} ${v > 0 ? "R" : "L"}`;
}

export default function LaunchMonitorView({
  playerId,
  tournamentId,
}: {
  playerId: string;
  tournamentId: number;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("distance");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/launch-monitor/${playerId}/${tournamentId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId, tournamentId]);

  if (loading) {
    return <div className="py-4 text-center text-gray-500 text-sm animate-pulse">Loading launch monitor data...</div>;
  }

  if (!data || !data.byClub?.length) {
    return <div className="py-4 text-center text-gray-500 text-sm">No launch monitor data for this round.</div>;
  }

  const { byClub, summary } = data;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Driver Averages</div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: "Shots",       value: fmt(summary.totalShots) },
              { label: "Club Speed",  value: fmt(summary.avgDriverClubSpeed, " mph") },
              { label: "Ball Speed",  value: fmt(summary.avgDriverBallSpeed, " mph") },
              { label: "Smash",       value: fmt(summary.driverSmashFactor) },
              { label: "Carry",       value: fmt(summary.avgDriverCarry, " yd") },
              { label: "Offline",     value: offlineLabel(summary.avgDriverOffline) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-800/60 rounded p-2 text-center">
                <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                <div className="text-sm font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-800">
        {([
          ["distance", "Distance"],
          ["launch", "Launch Angles"],
          ["spin", "Spin & Face"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-green-500 text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Club table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-1.5 pr-3 font-medium">Club</th>
              <th className="text-right py-1.5 px-2 font-medium">#</th>
              {tab === "distance" && <>
                <th className="text-right py-1.5 px-2 font-medium">Club Spd</th>
                <th className="text-right py-1.5 px-2 font-medium">Ball Spd</th>
                <th className="text-right py-1.5 px-2 font-medium">Carry</th>
                <th className="text-right py-1.5 px-2 font-medium">Total</th>
                <th className="text-right py-1.5 px-2 font-medium">Offline</th>
              </>}
              {tab === "launch" && <>
                <th className="text-right py-1.5 px-2 font-medium">Club Spd</th>
                <th className="text-right py-1.5 px-2 font-medium">VLA</th>
                <th className="text-right py-1.5 px-2 font-medium">HLA</th>
                <th className="text-right py-1.5 px-2 font-medium">AoA</th>
                <th className="text-right py-1.5 px-2 font-medium">Peak Ht</th>
              </>}
              {tab === "spin" && <>
                <th className="text-right py-1.5 px-2 font-medium">Back Spin</th>
                <th className="text-right py-1.5 px-2 font-medium">Spin Axis</th>
                <th className="text-right py-1.5 px-2 font-medium">Face/Path</th>
                <th className="text-right py-1.5 px-2 font-medium">Offline</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {byClub.map(c => (
              <tr key={c.club} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                <td className="py-1.5 pr-3 font-mono font-semibold text-gray-200">{c.club}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">{c.count}</td>

                {tab === "distance" && <>
                  <td className="py-1.5 px-2 text-right text-sky-400 font-mono">{fmt(c.clubSpeed)}</td>
                  <td className="py-1.5 px-2 text-right text-sky-300 font-mono">{fmt(c.ballSpeed)}</td>
                  <td className="py-1.5 px-2 text-right text-green-400 font-mono">{fmt(c.carryDist)}</td>
                  <td className="py-1.5 px-2 text-right text-gray-300 font-mono">{fmt(c.totalDist)}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${offlineColor(c.offline)}`}>
                    {offlineLabel(c.offline)}
                  </td>
                </>}

                {tab === "launch" && <>
                  <td className="py-1.5 px-2 text-right text-sky-400 font-mono">{fmt(c.clubSpeed)}</td>
                  <td className="py-1.5 px-2 text-right text-purple-400 font-mono">{fmt(c.vla, "°")}</td>
                  <td className="py-1.5 px-2 text-right text-purple-300 font-mono">{fmt(c.hla, "°")}</td>
                  <td className="py-1.5 px-2 text-right text-orange-400 font-mono">{fmt(c.clubAoA, "°")}</td>
                  <td className="py-1.5 px-2 text-right text-gray-300 font-mono">—</td>
                </>}

                {tab === "spin" && <>
                  <td className="py-1.5 px-2 text-right text-amber-400 font-mono">{fmt(c.backSpin)}</td>
                  <td className="py-1.5 px-2 text-right text-gray-300 font-mono">{fmt(c.spinAxis, "°")}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${
                    c.faceToPath !== null && Math.abs(c.faceToPath) < 2 ? "text-green-400" :
                    c.faceToPath !== null && Math.abs(c.faceToPath) < 4 ? "text-yellow-400" : "text-red-400"
                  }`}>{fmt(c.faceToPath, "°")}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${offlineColor(c.offline)}`}>
                    {offlineLabel(c.offline)}
                  </td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-600 text-right">
        Data from GSPro · Averages per club · All distances in yards
      </div>
    </div>
  );
}
