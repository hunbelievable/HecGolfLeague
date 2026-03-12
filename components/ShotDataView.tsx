"use client";

import { useState, useEffect } from "react";

interface HoleData {
  id: number;
  holeNumber: number;
  par: number;
  shots: string;
  shotsCount: number;
}

interface ParsedShot {
  raw: string;
  isAutoPutt: boolean;
  lie?: string;
  distToLie?: number;
  distToHole?: number;
  distUnit?: "yds" | "ft";
}

const LIE_COLORS: Record<string, string> = {
  fairway:   "bg-green-700 text-green-100",
  semirough: "bg-yellow-700 text-yellow-100",
  rough:     "bg-orange-700 text-orange-100",
  deeprough: "bg-red-900 text-red-200",
  sand:      "bg-amber-600 text-amber-100",
  pinestraw: "bg-stone-600 text-stone-100",
  green:     "bg-emerald-600 text-emerald-100",
};

const LIE_DOT: Record<string, string> = {
  fairway:   "bg-green-500",
  semirough: "bg-yellow-500",
  rough:     "bg-orange-500",
  deeprough: "bg-red-700",
  sand:      "bg-amber-400",
  pinestraw: "bg-stone-400",
  green:     "bg-emerald-400",
};

function parseShot(raw: string): ParsedShot {
  if (/auto.?putt/i.test(raw)) return { raw, isAutoPutt: true };

  // Full format: "201 yds to fairway, 183 yds to hole"
  const match = raw.match(/(\d+)\s+yds?\s+to\s+([\w]+),\s+(\d+)\s+(yds?|ft)\s+to(?:\s+hole)?/i);
  if (match) {
    return {
      raw,
      isAutoPutt: false,
      distToLie: parseInt(match[1]),
      lie: match[2].toLowerCase(),
      distToHole: parseInt(match[3]),
      distUnit: match[4].toLowerCase().startsWith("ft") ? "ft" : "yds",
    };
  }
  // Legacy format (carry distance missing): "yds to rough, 152 yds to"
  const legacy = raw.match(/yds?\s+to\s+([\w]+),\s+(\d+)\s+(yds?|ft)\s+to/i);
  if (legacy) {
    return {
      raw,
      isAutoPutt: false,
      lie: legacy[1].toLowerCase(),
      distToHole: parseInt(legacy[2]),
      distUnit: legacy[3].toLowerCase().startsWith("ft") ? "ft" : "yds",
    };
  }
  return { raw, isAutoPutt: false };
}


function HoleCard({ hole, isOpen, onClick }: { hole: HoleData; isOpen: boolean; onClick: () => void }) {
  const shots = JSON.parse(hole.shots) as string[];
  const parsed = shots.map(parseShot);
  const nonPutt = parsed.filter(s => !s.isAutoPutt);

  // Tee shot lie for border color
  const teeShot = nonPutt[0];
  const teeLie = teeShot?.lie;
  const borderColor = teeLie ? (
    teeLie === "fairway" ? "border-green-600" :
    teeLie === "green"   ? "border-emerald-500" :
    teeLie === "sand"    ? "border-amber-500" :
    teeLie === "rough" || teeLie === "semirough" || teeLie === "deeprough" ? "border-orange-600" :
    "border-gray-600"
  ) : "border-gray-700";

  // Score vs par
  const diff = hole.shotsCount - hole.par;
  const scoreLabel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
  const scoreColor = diff <= -1 ? "text-yellow-400" : diff === 0 ? "text-gray-300" : diff === 1 ? "text-gray-400" : "text-red-400";

  return (
    <div className="flex flex-col">
      {/* Hole summary card */}
      <button
        onClick={onClick}
        className={`relative rounded-lg border-2 p-2.5 text-left transition-all ${
          isOpen ? "bg-gray-700" : "bg-gray-800 hover:bg-gray-750"
        } ${borderColor}`}
      >
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs text-gray-400 font-mono font-semibold">H{hole.holeNumber}</span>
          <span className="text-xs text-gray-600">p{hole.par}</span>
        </div>

        {/* Stroke count + score */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-base font-bold text-white leading-none">{hole.shotsCount}</span>
          <span className={`text-xs font-medium ${scoreColor}`}>{scoreLabel}</span>
        </div>

        {/* Tee shot lie label */}
        {teeLie ? (
          <div className={`text-xs px-1 py-0.5 rounded font-medium truncate ${LIE_COLORS[teeLie] ?? "bg-gray-700 text-gray-300"}`}>
            {teeLie}
          </div>
        ) : (
          <div className="text-xs text-gray-700 italic">—</div>
        )}
      </button>

      {/* Expanded shot detail */}
      {isOpen && (
        <div className="mt-1 bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-2">
          {parsed.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-gray-600 w-4 flex-shrink-0 font-mono">{i + 1}</span>
              {s.isAutoPutt ? (
                <span className="text-gray-600 italic">Auto-putt</span>
              ) : s.lie ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LIE_COLORS[s.lie] ?? "bg-gray-700 text-gray-300"}`}>
                    {s.lie}
                  </span>
                  {s.distToLie !== undefined && s.distToLie > 0 && (
                    <span className="text-gray-400">{s.distToLie}y carry</span>
                  )}
                  {s.distToHole !== undefined && (
                    <span className="text-gray-500">→ {s.distToHole}{s.distUnit === "ft" ? "ft" : "y"} to pin</span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400">{s.raw}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  playerId: string;
  tournamentId: number;
  tournamentName: string;
}

export default function ShotDataView({ playerId, tournamentId, tournamentName }: Props) {
  const [holes, setHoles] = useState<HoleData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [openHole, setOpenHole] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/shotdata?playerId=${playerId}&tournamentId=${tournamentId}`)
      .then(r => r.json())
      .then((data: HoleData[]) => setHoles(data))
      .catch(() => setHoles([]))
      .finally(() => setLoading(false));
  }, [playerId, tournamentId]);

  if (loading) {
    return <div className="text-xs text-gray-500 py-4 text-center">Loading shot data...</div>;
  }

  if (!holes || holes.length === 0) {
    return (
      <div className="text-xs text-gray-600 py-4 text-center">
        No shot data yet — run <code className="text-gray-500">npm run scrape-shots</code>
      </div>
    );
  }

  // Round totals
  const totalStrokes = holes.reduce((s, h) => s + h.shotsCount, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  const totalDiff = totalStrokes - totalPar;

  // Summary stats — approach shot lie distribution (tee shot of each hole)
  const approachShots = holes.map(h => (JSON.parse(h.shots) as string[]).map(parseShot).filter(s => !s.isAutoPutt)[0]).filter(Boolean);
  const lieCounts: Record<string, number> = {};
  for (const s of approachShots) {
    if (s.lie) lieCounts[s.lie] = (lieCounts[s.lie] ?? 0) + 1;
  }

  // Split into front/back 9
  const front = holes.filter(h => h.holeNumber <= 9);
  const back = holes.filter(h => h.holeNumber > 9);

  return (
    <div>
      {/* Summary strip — lie distribution */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <span className="text-xs text-gray-600 uppercase tracking-wide">Approach lies</span>
        {Object.entries(lieCounts).sort((a, b) => b[1] - a[1]).map(([lie, count]) => (
          <div key={lie} className="flex items-center gap-1 text-xs">
            <div className={`w-2 h-2 rounded-full ${LIE_DOT[lie] ?? "bg-gray-500"}`} />
            <span className="text-gray-500 capitalize">{lie}</span>
            <span className="text-gray-300 font-medium">{count}</span>
          </div>
        ))}
      </div>

      {/* Front 9 */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 uppercase tracking-wide mb-2">Front 9</div>
        <div className="grid grid-cols-9 gap-1.5">
          {front.map(hole => (
            <HoleCard
              key={hole.holeNumber}
              hole={hole}
              isOpen={openHole === hole.holeNumber}
              onClick={() => setOpenHole(openHole === hole.holeNumber ? null : hole.holeNumber)}
            />
          ))}
        </div>
      </div>

      {/* Back 9 */}
      {back.length > 0 && (
        <div>
          <div className="text-xs text-gray-600 uppercase tracking-wide mb-2">Back 9</div>
          <div className="grid grid-cols-9 gap-1.5">
            {back.map(hole => (
              <HoleCard
                key={hole.holeNumber}
                hole={hole}
                isOpen={openHole === hole.holeNumber}
                onClick={() => setOpenHole(openHole === hole.holeNumber ? null : hole.holeNumber)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Round total */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-800">
        <span className="text-xs text-gray-600 uppercase tracking-wide">Round</span>
        <span className="text-sm font-bold text-white">{totalStrokes}</span>
        <span className={`text-sm font-medium ${totalDiff <= 0 ? "text-green-400" : totalDiff <= 5 ? "text-gray-400" : "text-red-400"}`}>
          {totalDiff > 0 ? `+${totalDiff}` : totalDiff === 0 ? "E" : `${totalDiff}`}
        </span>
        <span className="text-xs text-gray-700">(par {totalPar})</span>
        <span className="text-xs text-gray-700 ml-auto">Click a hole to see shot detail</span>
      </div>
    </div>
  );
}
