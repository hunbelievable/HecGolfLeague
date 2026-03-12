"use client";

import { useState, useEffect } from "react";
import LaunchMonitorView from "./LaunchMonitorView";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LMShot {
  clubName:    string;
  clubSpeed:   number | null;
  ballSpeed:   number | null;
  carryDist:   number | null;
  totalDist:   number | null;
  offline:     number | null;
  backSpin:    number | null;
  vla:         number | null;
  hla:         number | null;
  faceToPath:  number | null;
  clubAoA:     number | null;
  spinAxis:    number | null;
  peakHeight:  number | null;
}

interface CombinedShot {
  shotIndex:        number;
  description:      string;
  lm:               LMShot | null;
  confidence:       "high" | "medium" | "low" | null;
  confidenceReason: string | null;
}

interface HoleDetail {
  holeNumber: number;
  par:        number;
  shotsCount: number;
  shots:      CombinedShot[];
}

interface RoundData {
  holes:  HoleDetail[];
  hasSGT: boolean;
  hasLM:  boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

interface ParsedShot {
  raw:         string;
  isAutoPutt:  boolean;
  lie?:        string;
  distToLie?:  number;
  distToHole?: number;
  distUnit?:   "yds" | "ft";
}

function parseShot(raw: string): ParsedShot {
  if (/auto.?putt/i.test(raw)) return { raw, isAutoPutt: true };

  const match = raw.match(/(\d+)\s+yds?\s+to\s+([\w]+),\s+(\d+)\s+(yds?|ft)\s+to(?:\s+hole)?/i);
  if (match) {
    return {
      raw, isAutoPutt: false,
      distToLie:  parseInt(match[1]),
      lie:        match[2].toLowerCase(),
      distToHole: parseInt(match[3]),
      distUnit:   match[4].toLowerCase().startsWith("ft") ? "ft" : "yds",
    };
  }
  const legacy = raw.match(/yds?\s+to\s+([\w]+),\s+(\d+)\s+(yds?|ft)\s+to/i);
  if (legacy) {
    return {
      raw, isAutoPutt: false,
      lie:        legacy[1].toLowerCase(),
      distToHole: parseInt(legacy[2]),
      distUnit:   legacy[3].toLowerCase().startsWith("ft") ? "ft" : "yds",
    };
  }
  return { raw, isAutoPutt: false };
}

function offlineLabel(v: number | null): string {
  if (v === null) return "";
  if (Math.abs(v) < 0.5) return "straight";
  return `${Math.abs(v).toFixed(1)}y ${v > 0 ? "R" : "L"}`;
}

function offlineColor(v: number | null): string {
  if (v === null) return "text-gray-500";
  const abs = Math.abs(v);
  if (abs < 5)  return "text-green-400";
  if (abs < 15) return "text-yellow-400";
  return "text-red-400";
}

function r(v: number | null, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return digits === 0 ? String(Math.round(v)) : (Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits);
}

// ── Scorecard Row ─────────────────────────────────────────────────────────────

function ScorecardRow({ holes }: { holes: HoleDetail[] }) {
  if (!holes.length) return null;
  const total = holes.reduce((s, h) => s + h.shotsCount, 0);
  const par   = holes.reduce((s, h) => s + h.par, 0);
  const diff  = total - par;
  const diffLabel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
  const diffColor = diff <= 0 ? "text-green-400" : diff <= 4 ? "text-gray-400" : "text-red-400";

  return (
    <div className="flex gap-0.5 items-end text-xs">
      {holes.map(h => {
        const d = h.shotsCount - h.par;
        const color = d <= -1 ? "text-yellow-400 font-bold"
                    : d === 0 ? "text-gray-400"
                    : d === 1 ? "text-gray-500"
                    :           "text-red-400";
        return (
          <div key={h.holeNumber} className="flex flex-col items-center w-7">
            <span className="text-gray-700 font-mono">{h.holeNumber}</span>
            <span className={`font-mono font-semibold ${color}`}>{h.shotsCount}</span>
          </div>
        );
      })}
      <div className="flex flex-col items-center w-10 ml-1 border-l border-gray-700 pl-2">
        <span className="text-gray-600">tot</span>
        <span className={`font-mono font-bold ${diffColor}`}>{diffLabel}</span>
      </div>
    </div>
  );
}

// ── Hole Row (expandable list item) ──────────────────────────────────────────

function HoleRow({
  hole, isOpen, onClick, showLM,
}: {
  hole: HoleDetail; isOpen: boolean; onClick: () => void; showLM: boolean;
}) {
  const nonPutt  = hole.shots.filter(s => !/auto.?putt/i.test(s.description));
  const teeShot  = nonPutt[0];
  const teeParsed = teeShot ? parseShot(teeShot.description) : null;
  const teeLie   = teeParsed?.lie;

  const diff       = hole.shotsCount - hole.par;
  const scoreLabel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
  const scoreColor = diff <= -1 ? "text-yellow-400"
                   : diff === 0  ? "text-gray-300"
                   : diff === 1  ? "text-gray-400"
                   :               "text-red-400";

  // Does this hole have any correlated LM data?
  const hasAnyLM = showLM && hole.shots.some(s => s.lm !== null);

  return (
    <div>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800/40 transition-colors text-left rounded"
      >
        {/* Hole number */}
        <span className="text-gray-500 font-mono text-xs w-6 flex-shrink-0">H{hole.holeNumber}</span>

        {/* Par */}
        <span className="text-gray-700 text-xs w-8 flex-shrink-0">p{hole.par}</span>

        {/* Score */}
        <span className={`font-mono text-sm font-bold w-8 flex-shrink-0 ${scoreColor}`}>
          {hole.shotsCount}
          <span className="text-xs font-normal ml-0.5">{scoreLabel}</span>
        </span>

        {/* Tee shot lie */}
        {teeLie ? (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LIE_COLORS[teeLie] ?? "bg-gray-700 text-gray-300"}`}>
            {teeLie}
          </span>
        ) : (
          <span className="text-gray-700 text-xs">—</span>
        )}

        {/* LM indicator */}
        {hasAnyLM && (
          <span className="text-xs text-sky-600 ml-auto mr-1">GSPro</span>
        )}

        {/* Expand chevron */}
        <span className="text-gray-600 text-xs ml-auto">{isOpen ? "▲" : "▼"}</span>
      </button>

      {/* Expanded shot list */}
      {isOpen && (
        <div className="mx-3 mb-2 bg-gray-800/60 rounded-lg border border-gray-700/60 divide-y divide-gray-700/40">
          {hole.shots.map(shot => {
            const p  = parseShot(shot.description);
            const lm = shot.lm;

            return (
              <div key={shot.shotIndex} className="flex gap-2 px-3 py-2 text-xs">
                {/* Shot number */}
                <span className="text-gray-600 font-mono w-4 flex-shrink-0 pt-0.5">{shot.shotIndex}</span>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Line 1: club + confidence indicator + SGT description */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {showLM && lm && (
                      <span className="flex items-center gap-0.5 flex-shrink-0">
                        <span
                          className={`font-mono font-bold text-xs w-7 ${
                            shot.confidence === "low" ? "text-red-400" : "text-gray-100"
                          }`}
                        >
                          {lm.clubName}
                        </span>
                        {shot.confidence === "low" && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 cursor-help"
                            title={shot.confidenceReason ?? "Club likely mis-tagged in GSPro"}
                          />
                        )}
                        {shot.confidence === "medium" && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-yellow-400 opacity-70 flex-shrink-0 cursor-help"
                            title={shot.confidenceReason ?? "Club uncertain — possible layup or punch"}
                          />
                        )}
                      </span>
                    )}

                    {p.isAutoPutt ? (
                      <span className="text-gray-600 italic">auto-putt</span>
                    ) : p.lie ? (
                      <>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${LIE_COLORS[p.lie] ?? "bg-gray-700 text-gray-300"}`}>
                          {p.lie}
                        </span>
                        {p.distToLie !== undefined && p.distToLie > 0 && (
                          <span className="text-gray-400">{p.distToLie}y carry</span>
                        )}
                        {p.distToHole !== undefined && (
                          <span className="text-gray-500">
                            → {p.distToHole}{p.distUnit === "ft" ? "ft" : "y"} to pin
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 truncate">{p.raw}</span>
                    )}
                  </div>

                  {/* Line 2: LM metrics (only when available and not an auto-putt) */}
                  {showLM && lm && !p.isAutoPutt && (
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      {/* Speeds */}
                      {(lm.clubSpeed || lm.ballSpeed) && (
                        <span className="text-sky-400 font-mono">
                          {r(lm.clubSpeed)}→{r(lm.ballSpeed)} mph
                        </span>
                      )}
                      {/* LM carry */}
                      {lm.carryDist && (
                        <span className="text-green-400 font-mono">{r(lm.carryDist)}y carry</span>
                      )}
                      {/* Offline */}
                      {lm.offline !== null && lm.offline !== undefined && (
                        <span className={`font-mono ${offlineColor(lm.offline)}`}>
                          {offlineLabel(lm.offline)}
                        </span>
                      )}
                      {/* Back spin */}
                      {lm.backSpin && (
                        <span className="text-amber-400 font-mono">{r(lm.backSpin)} rpm</span>
                      )}
                      {/* VLA */}
                      {lm.vla && (
                        <span className="text-purple-400 font-mono">{r(lm.vla, 1)}° VLA</span>
                      )}
                      {/* Face to path */}
                      {lm.faceToPath !== null && lm.faceToPath !== undefined && (
                        <span className={`font-mono ${
                          Math.abs(lm.faceToPath) < 2 ? "text-green-400" :
                          Math.abs(lm.faceToPath) < 4 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {r(lm.faceToPath, 1)}° F/P
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type MainTab = "holes" | "clubs";

interface Props {
  playerId:     string;
  tournamentId: number;
}

export default function CombinedRoundView({ playerId, tournamentId }: Props) {
  const [data,    setData]    = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("holes");
  const [openHole, setOpenHole] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setOpenHole(null);
    fetch(`/api/round-detail/${playerId}/${tournamentId}`)
      .then(r => r.json())
      .then(d  => { setData(d); setLoading(false); })
      .catch(()  => setLoading(false));
  }, [playerId, tournamentId]);

  if (loading) {
    return <div className="py-4 text-center text-gray-500 text-sm animate-pulse">Loading round data…</div>;
  }
  if (!data) {
    return <div className="py-4 text-center text-gray-500 text-sm">Failed to load data.</div>;
  }

  const { holes, hasSGT, hasLM } = data;

  if (!hasSGT && !hasLM) {
    return (
      <div className="py-6 text-center text-gray-600 text-xs space-y-1">
        <div>No round data available.</div>
        <div>Run <code className="text-gray-500">npm run scrape-shots</code> to pull SGT shot data.</div>
      </div>
    );
  }

  const front = holes.filter(h => h.holeNumber <= 9);
  const back  = holes.filter(h => h.holeNumber > 9);

  // Approach lie distribution (tee shot of each hole)
  const lieCounts: Record<string, number> = {};
  for (const hole of holes) {
    const nonPutt = hole.shots.filter(s => !/auto.?putt/i.test(s.description));
    const p = nonPutt[0] ? parseShot(nonPutt[0].description) : null;
    if (p?.lie) lieCounts[p.lie] = (lieCounts[p.lie] ?? 0) + 1;
  }

  // Total scores
  const totalStrokes = holes.reduce((s, h) => s + h.shotsCount, 0);
  const totalPar     = holes.reduce((s, h) => s + h.par, 0);
  const totalDiff    = totalStrokes - totalPar;

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-800">
        {hasSGT && (
          <button
            onClick={() => setMainTab("holes")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              mainTab === "holes"
                ? "border-green-500 text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Hole by Hole
          </button>
        )}
        {hasLM && (
          <button
            onClick={() => setMainTab("clubs")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              mainTab === "clubs"
                ? "border-green-500 text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            By Club
          </button>
        )}
      </div>

      {/* ── Hole by Hole tab ── */}
      {mainTab === "holes" && hasSGT && (
        <div className="space-y-3">
          {/* Mini scorecard */}
          <div className="space-y-1">
            {front.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-8 flex-shrink-0">F9</span>
                <ScorecardRow holes={front} />
              </div>
            )}
            {back.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-8 flex-shrink-0">B9</span>
                <ScorecardRow holes={back} />
              </div>
            )}
          </div>

          {/* Approach lie distribution */}
          {Object.keys(lieCounts).length > 0 && (
            <div className="flex gap-3 flex-wrap items-center pt-1 pb-1 border-t border-gray-800">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Approach lies</span>
              {Object.entries(lieCounts).sort((a, b) => b[1] - a[1]).map(([lie, count]) => (
                <div key={lie} className="flex items-center gap-1 text-xs">
                  <div className={`w-2 h-2 rounded-full ${LIE_DOT[lie] ?? "bg-gray-500"}`} />
                  <span className="text-gray-500 capitalize">{lie}</span>
                  <span className="text-gray-300 font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hole list */}
          <div className="space-y-0.5">
            {front.length > 0 && (
              <div>
                <div className="text-xs text-gray-700 uppercase tracking-wide px-3 py-1">Front 9</div>
                {front.map(hole => (
                  <HoleRow
                    key={hole.holeNumber}
                    hole={hole}
                    isOpen={openHole === hole.holeNumber}
                    onClick={() => setOpenHole(openHole === hole.holeNumber ? null : hole.holeNumber)}
                    showLM={hasLM}
                  />
                ))}
              </div>
            )}
            {back.length > 0 && (
              <div>
                <div className="text-xs text-gray-700 uppercase tracking-wide px-3 py-1">Back 9</div>
                {back.map(hole => (
                  <HoleRow
                    key={hole.holeNumber}
                    hole={hole}
                    isOpen={openHole === hole.holeNumber}
                    onClick={() => setOpenHole(openHole === hole.holeNumber ? null : hole.holeNumber)}
                    showLM={hasLM}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Round total footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-800 text-xs">
            <span className="text-gray-600 uppercase tracking-wide">Round</span>
            <span className="font-bold text-white">{totalStrokes}</span>
            <span className={`font-medium ${totalDiff <= 0 ? "text-green-400" : totalDiff <= 5 ? "text-gray-400" : "text-red-400"}`}>
              {totalDiff > 0 ? `+${totalDiff}` : totalDiff === 0 ? "E" : `${totalDiff}`}
            </span>
            <span className="text-gray-700">(par {totalPar})</span>
            {hasLM && (
              <span className="flex items-center gap-2.5 ml-auto text-gray-600">
                <span>Club confidence:</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 opacity-70" />
                  <span>uncertain</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>mis-tagged</span>
                </span>
                <span className="text-gray-700">(hover for detail)</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── By Club tab ── */}
      {mainTab === "clubs" && hasLM && (
        <LaunchMonitorView playerId={playerId} tournamentId={tournamentId} />
      )}
    </div>
  );
}
