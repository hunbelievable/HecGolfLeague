"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ReferenceLine,
} from "recharts";
import { HCP_GROUPS, type JournalEvent, type GroupStat } from "@/lib/courseJournal";
import { courseSlug, fmtOver, nineLabel } from "@/lib/courseFormat";

interface Props {
  events: JournalEvent[];
  notes: Record<string, { notes: string; updatedAt: string }>;
  editable: boolean;
}

type SeasonFilter = "all" | 1 | 2;

const shortDate = (d: string) =>
  // Parse as local time — a bare "YYYY-MM-DD" is read as UTC and renders a day early
  new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

function GroupCell({ g, exp, expLabel }: { g: GroupStat | null; exp?: number | null; expLabel?: string }) {
  if (!g) return <td className="px-2 py-2.5 text-center text-gray-700">—</td>;
  return (
    <td className="px-2 py-2.5 text-center">
      <div className="font-mono text-gray-200">{fmtOver(g.avg9)}</div>
      <div className="text-[10px] text-gray-600">n={g.n}</div>
      {exp != null && <div className="text-[10px] text-gray-600">{expLabel} {fmtOver(exp)}</div>}
    </td>
  );
}

function NotesEditor({ courseName, initial, editable }: {
  courseName: string;
  initial: { notes: string; updatedAt: string } | undefined;
  editable: boolean;
}) {
  const [saved, setSaved] = useState(initial?.notes ?? "");
  const [draft, setDraft] = useState(saved);
  const [updatedAt, setUpdatedAt] = useState(initial?.updatedAt ?? null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseName, notes: draft }),
    });
    if (!res.ok) { setStatus("error"); return; }
    const entry = await res.json();
    setSaved(entry.notes);
    setDraft(entry.notes);
    setUpdatedAt(entry.updatedAt);
    setStatus("idle");
  }

  if (!editable) {
    return saved ? (
      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{saved}</p>
    ) : (
      <p className="text-sm text-gray-600 italic">No notes yet.</p>
    );
  }

  const dirty = draft !== saved;
  return (
    <div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={Math.max(3, draft.split("\n").length)}
        placeholder="How did it play? Settings you'd change, holes that caused trouble, whether you'd play it again…"
        className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-green-600/60 resize-y"
      />
      <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-600">
        <span>
          {status === "error"
            ? <span className="text-red-400">Couldn&apos;t save — try again</span>
            : updatedAt ? `Saved ${new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not saved yet"}
        </span>
        <button
          onClick={save}
          disabled={!dirty || status === "saving"}
          className="px-3 py-1 rounded-md text-xs font-semibold bg-green-600 text-white disabled:bg-gray-800 disabled:text-gray-600 transition-colors"
        >
          {status === "saving" ? "Saving…" : "Save notes"}
        </button>
      </div>
    </div>
  );
}

interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  detail: string;
}

type LabelPos = "top" | "bottom" | "right" | "left";

// Axis with ~5 round-number ticks
function niceAxis(values: number[], includeZero: boolean, minStep = 1) {
  let lo = Math.min(...values, ...(includeZero ? [0] : []));
  let hi = Math.max(...values, ...(includeZero ? [0] : []));
  const range = hi - lo || 1;
  const step = Math.max(minStep, range <= 4 ? 1 : range <= 10 ? 2 : 5);
  lo = Math.floor((lo - step / 2) / step) * step;
  hi = Math.ceil((hi + step / 2) / step) * step;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  return { domain: [lo, hi] as [number, number], ticks };
}

const MARGIN = { top: 16, right: 24, bottom: 28, left: 4 };
const Y_AXIS_W = 40;
const CHAR_W = 6.2;   // ~11px system font
const LABEL_H = 13;
const DOT_R = 6;

// Greedy label placement in pixel space: each label takes the first side of its dot
// (above, below, right, left) that doesn't cover another label or dot. Labels with
// no free side (narrow screens) are hidden; the tooltip still names the dot.
function layoutLabels(
  points: ScatterPoint[], width: number, height: number,
  xDom: [number, number], yDom: [number, number],
): (LabelPos | null)[] {
  const pw = width - MARGIN.left - MARGIN.right - Y_AXIS_W;
  const ph = height - MARGIN.top - MARGIN.bottom;
  const px = (x: number) => ((x - xDom[0]) / (xDom[1] - xDom[0])) * pw;
  const py = (y: number) => ((yDom[1] - y) / (yDom[1] - yDom[0])) * ph;
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const dots: Box[] = points.map(p => ({ x0: px(p.x) - DOT_R, y0: py(p.y) - DOT_R, x1: px(p.x) + DOT_R, y1: py(p.y) + DOT_R }));
  const placed: Box[] = [];
  const result: (LabelPos | null)[] = new Array(points.length).fill(null);

  const order = points.map((_, i) => i).sort((a, b) => points[b].y - points[a].y);
  for (const i of order) {
    const cx = px(points[i].x), cy = py(points[i].y), w = points[i].label.length * CHAR_W;
    const boxes: Record<LabelPos, Box> = {
      top:    { x0: cx - w / 2, y0: cy - 8 - LABEL_H, x1: cx + w / 2, y1: cy - 8 },
      bottom: { x0: cx - w / 2, y0: cy + 8, x1: cx + w / 2, y1: cy + 8 + LABEL_H },
      right:  { x0: cx + 9, y0: cy - LABEL_H / 2, x1: cx + 9 + w, y1: cy + LABEL_H / 2 },
      left:   { x0: cx - 9 - w, y0: cy - LABEL_H / 2, x1: cx - 9, y1: cy + LABEL_H / 2 },
    };
    const fits = (pos: LabelPos) => {
      const b = boxes[pos];
      return b.x0 >= 0 && b.x1 <= pw && b.y0 >= 0 && b.y1 <= ph &&
        !placed.some(o => hit(o, b)) && !dots.some((d, j) => j !== i && hit(d, b));
    };
    const pos = (["top", "bottom", "right", "left"] as const).find(fits);
    if (!pos) continue;
    result[i] = pos;
    placed.push(boxes[pos]);
  }
  return result;
}

function LabeledScatter({ points, xLabel, yLabel, yFormat, refY, refYLabel, emptyText, height = 288 }: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  yFormat: (v: number) => string;
  refY?: number;
  refYLabel?: string;
  emptyText: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const x = niceAxis(points.map(p => p.x), false, 5);
  const y = niceAxis(points.map(p => p.y), refY !== undefined);
  const labelPos = useMemo(
    () => (width ? layoutLabels(points, width, height, x.domain, y.domain) : points.map(() => "top" as LabelPos)),
    [points, width, height, x.domain[0], x.domain[1], y.domain[0], y.domain[1]] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (points.length < 2) {
    return <p className="text-sm text-gray-600 px-4 py-6">{emptyText}</p>;
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" onResize={w => setWidth(w)}>
        <ScatterChart margin={MARGIN}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="0" />
          <XAxis
            type="number" dataKey="x" name={xLabel} domain={x.domain} ticks={x.ticks}
            tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#374151" }} tickLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -16, fill: "#6b7280", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y" name={yLabel} domain={y.domain} ticks={y.ticks}
            tickFormatter={yFormat}
            tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={Y_AXIS_W}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 10, fill: "#6b7280", fontSize: 11, dy: 60 }}
          />
          {refY !== undefined && (
            <ReferenceLine
              y={refY} stroke="#4b5563" strokeDasharray="4 4"
              label={{ value: refYLabel, position: "insideBottomRight", fill: "#6b7280", fontSize: 10 }}
            />
          )}
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScatterPoint;
              return (
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <div className="font-semibold text-white">{p.label}</div>
                  <div className="text-gray-500 mb-1">{p.detail}</div>
                  <div className="text-gray-300">{xLabel} <b>{p.x}</b> · {yLabel} <b>{yFormat(p.y)}</b></div>
                </div>
              );
            }}
          />
          <Scatter data={points} fill="#22c55e" stroke="#111827" strokeWidth={2} isAnimationActive={false}>
            <LabelList
              dataKey="label"
              content={(props) => {
                const { x: cx, y: cy, value, index } = props as { x: number; y: number; value: string; index: number };
                const pos = labelPos[index];
                if (!pos) return null;
                const at: { x: number; y: number; anchor: "middle" | "start" | "end" } = {
                  top:    { x: cx, y: cy - 10, anchor: "middle" as const },
                  bottom: { x: cx, y: cy + 19, anchor: "middle" as const },
                  right:  { x: cx + 9, y: cy + 4, anchor: "start" as const },
                  left:   { x: cx - 9, y: cy + 4, anchor: "end" as const },
                }[pos];
                return (
                  <text x={at.x} y={at.y} textAnchor={at.anchor} fill="#9ca3af" fontSize={11}>
                    {value}
                  </text>
                );
              }}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

const shortName = (name: string) =>
  name === "National Golf Links of America" ? "NGLA"
    : name.replace(/^DPC /, "").replace(/ (Golf Club|Club)$/, "").replace(/ Club-Red Course$/, " Red");

// One dot per course + tees played: how hard for scratch (rating vs par) and how much harder for bogey (slope)
function courseMapPoints(events: JournalEvent[]): ScatterPoint[] {
  const seen = new Map<string, { e: JournalEvent; rounds: string[] }>();
  for (const e of events) {
    const cs = e.courseSetup;
    if (cs?.slope == null || cs.rating == null || cs.coursePar == null) continue;
    const key = `${cs.courseName}|${cs.tees}`;
    const entry = seen.get(key) ?? { e, rounds: [] };
    entry.rounds.push(`S${e.season} ${e.week}`);
    seen.set(key, entry);
  }
  const multiTee = new Set(
    [...seen.keys()].map(k => k.split("|")[0]).filter((n, i, all) => all.indexOf(n) !== i)
  );
  return [...seen.values()].map(({ e, rounds }) => {
      const cs = e.courseSetup!;
      return {
        x: cs.slope!,
        y: Math.round((cs.rating! - cs.coursePar!) * 10) / 10,
        label: shortName(cs.courseName) + (multiTee.has(cs.courseName) ? ` (${cs.tees})` : ""),
        detail: `${cs.tees} tees · rating ${cs.rating} / par ${cs.coursePar} · ${rounds.join(", ")}`,
      };
    });
}

function netGapPoints(events: JournalEvent[]): ScatterPoint[] {
  return events
      .filter(e => e.courseSetup?.slope != null && e.stats.netGap9 != null)
      .map(e => ({
        x: e.courseSetup!.slope!,
        y: e.stats.netGap9!,
        label: shortName(e.courseSetup!.courseName),
        detail: `S${e.season} ${e.week} · ${e.courseSetup!.tees} tees · gross gap ${e.stats.gap9?.toFixed(1) ?? "—"}`,
      }));
}

export default function JournalClient({ events, notes, editable }: Props) {
  const [season, setSeason] = useState<SeasonFilter>("all");

  const visible = useMemo(
    () => events.filter(e => season === "all" || e.season === season),
    [events, season]
  );

  // Group events by SGT course name, most recently played first
  const courses = useMemo(() => {
    const map = new Map<string, JournalEvent[]>();
    for (const e of visible) {
      const key = e.courseSetup?.courseName ?? e.name;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()]
      .map(([name, evs]) => ({ name, events: evs.sort((a, b) => b.date.localeCompare(a.date)) }))
      .sort((a, b) => b.events[0].date.localeCompare(a.events[0].date));
  }, [visible]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-end justify-between mb-1 gap-3 flex-wrap">
          <div className="flex items-end gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Course Journal</h1>
            <span className="text-sm text-gray-500 mb-0.5">
              {courses.length} courses · {visible.length} rounds
            </span>
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
            {(["all", 1, 2] as const).map(s => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  season === s ? "bg-green-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                {s === "all" ? "All" : `S${s}`}
              </button>
            ))}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-green-600/40 via-green-600/10 to-transparent" />
      </div>

      <div className="grid gap-4 mb-6">
        <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-white">Where the courses sit</h2>
            <p className="text-xs text-gray-500 mt-1">
              One dot per course and tees played. <b className="text-gray-400">Up</b> is harder for everyone
              (rating vs par, over 18); <b className="text-gray-400">right</b> is harder on high handicaps
              relative to low (slope, 113 is average). Bottom-left is easy and fair.
            </p>
          </div>
          <LabeledScatter
            points={courseMapPoints(visible)}
            xLabel="Slope" yLabel="Rating − par" yFormat={v => fmtOver(v)}
            refY={0} refYLabel="rating = par" height={360}
            emptyText="No course ratings recorded yet."
          />
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-white">Did handicaps level the field?</h2>
            <p className="text-xs text-gray-500 mt-1">
              How many more <b className="text-gray-400">net</b> strokes per 9 the high group (13+) took than the
              low group (≤5). On the dashed line, handicap strokes evened things out; above it, the course cost
              high handicaps more than their strokes gave back. Week 1 of each season (all handicaps 0) and
              Season 1 (no high handicaps) aren&apos;t shown.
            </p>
          </div>
          <LabeledScatter
            points={netGapPoints(visible)}
            xLabel="Slope" yLabel="Net gap per 9" yFormat={v => v.toFixed(0)}
            refY={0} refYLabel="even"
            emptyText="Needs at least two rounds with handicaps set and both low and high players."
          />
        </section>
      </div>

      {/* How to read the tables */}
      <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
        Scores are gross strokes over par <b className="text-gray-400">per 9 holes</b>. Season 1&apos;s 18-hole rounds
        are split into front and back nines from hole-by-hole scores. Yards are the full 18 from the tees played. Groups use each player&apos;s current index:{" "}
        {HCP_GROUPS.map((g, i) => (
          <span key={g.key}>{i > 0 && ", "}{g.label} {g.range}</span>
        ))}.{" "}
        <b className="text-gray-400">scr</b> is what the course rating says a scratch golfer should shoot;{" "}
        <b className="text-gray-400">bgy</b> is the bogey golfer (~20 index), from rating + slope ÷ 5.381.{" "}
        <b className="text-gray-400">Net vs rtg</b> is the field&apos;s average net score per 9 minus the scratch expectation
        (positive = played harder than rated); <b className="text-gray-400">Net gap</b> is high minus low in net strokes
        (0 = handicaps evened it out). Both are blank in Week 1, before anyone has a handicap.
      </div>

      <div className="space-y-4">
        {courses.map(course => {
          const setup = course.events[0].courseSetup;
          return (
            <section
              key={course.name}
              id={courseSlug(course.name)}
              className="rounded-xl border border-gray-800 overflow-hidden shadow-lg shadow-black/20 scroll-mt-20"
            >
              <div className="px-4 py-3.5 bg-gray-900 flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">{course.name}</h2>
                  {setup?.coursePar != null && <span className="text-xs text-gray-500">Par {setup.coursePar}</span>}
                  <span className="text-xs text-gray-600">
                    · played {course.events.length}×
                  </span>
                </div>
                {setup?.sgtCourseId != null && (
                  <a
                    href={`https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_${setup.sgtCourseId}.jpg`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-500/80 hover:text-green-400"
                  >
                    SGT scorecard ↗
                  </a>
                )}
              </div>

              <div className="overflow-x-auto border-t border-gray-800">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-gray-900/80 text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-800">
                      <th className="text-left px-3 py-2 font-semibold">Round</th>
                      <th className="text-left px-2 py-2 font-semibold">Nine</th>
                      <th className="text-left px-2 py-2 font-semibold">Tees</th>
                      <th className="text-center px-2 py-2 font-semibold">Slope / Rtg</th>
                      <th className="text-left px-2 py-2 font-semibold">Conditions</th>
                      <th className="text-center px-2 py-2 font-semibold">Field</th>
                      <th className="text-center px-2 py-2 font-semibold">Low</th>
                      <th className="text-center px-2 py-2 font-semibold">Mid</th>
                      <th className="text-center px-2 py-2 font-semibold">High</th>
                      <th className="text-center px-2 py-2 font-semibold">Gap</th>
                      <th className="text-center px-2 py-2 font-semibold" title="Triple bogey or worse, per player per 9 holes">Blow-ups</th>
                      <th className="text-center px-2 py-2 font-semibold" title="Field's average net score per 9 minus what the course rating predicts">Net vs rtg</th>
                      <th className="text-center px-2 py-2 font-semibold" title="High group minus low group, in net strokes per 9. 0 = handicaps evened it out">Net gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.events.map((e, i) => {
                      const cs = e.courseSetup;
                      const st = e.stats;
                      // One row per nine played. A single-nine round uses the official round
                      // scores; 18-hole rounds split into front/back from hole-by-hole data.
                      const rows = st.nines.length > 1
                        ? st.nines.map(n => ({ key: n.nine, nine: n, field: n.field, groups: n.groups, gap9: n.gap9, blowups: n.blowupsPer9 }))
                        : [{ key: "round", nine: st.nines[0] ?? null, field: st.field, groups: st.groups, gap9: st.gap9, blowups: st.blowupsPer9 }];
                      const span = rows.length;
                      const stripe = i % 2 === 0 ? "bg-gray-900" : "bg-gray-950/50";

                      return rows.map((row, ri) => (
                        <tr
                          key={`${e.id}-${row.key}`}
                          className={`${stripe} ${ri === span - 1 ? "border-b border-gray-800/50" : "border-b border-gray-800/20"}`}
                        >
                          {ri === 0 && (
                            <td rowSpan={span} className="px-3 py-2.5 align-top">
                              <Link
                                href={e.season === 2 ? "/events" : `/events?season=${e.season}`}
                                className="text-gray-200 hover:text-green-400"
                              >
                                S{e.season} {e.week}
                              </Link>
                              {e.isMajor && <span className="ml-1.5 text-[10px] text-yellow-400">★</span>}
                              <div className="text-[10px] text-gray-600">{shortDate(e.date)} · {st.holes} holes</div>
                            </td>
                          )}
                          <td className="px-2 py-2.5">
                            {row.nine ? (
                              <span className="text-gray-200">{nineLabel(row.nine.nine)}</span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          {ri === 0 && (
                            <>
                              <td rowSpan={span} className="px-2 py-2.5 align-top text-gray-300">
                                {cs?.tees ?? "—"}
                                {st.yards != null && <div className="text-[10px] text-gray-600">{st.yards.toLocaleString()} yds</div>}
                              </td>
                              <td rowSpan={span} className="px-2 py-2.5 align-top text-center font-mono">
                                <div className="text-gray-200">{cs?.slope ?? "—"}</div>
                                {cs?.rating != null && <div className="text-[10px] text-gray-500">{cs.rating}</div>}
                              </td>
                              <td rowSpan={span} className="px-2 py-2.5 align-top text-[11px] text-gray-400 leading-snug">
                                {cs ? (
                                  <>
                                    <div>Stimp {cs.stimp ?? "—"} · {cs.wind ?? "—"}</div>
                                    <div className="text-gray-600">Fwy {cs.fairways ?? "—"} · Grn {cs.greens ?? "—"}</div>
                                  </>
                                ) : "—"}
                              </td>
                            </>
                          )}
                          {row.field ? (
                            <>
                              <GroupCell g={row.field} />
                              <GroupCell g={row.groups.low} exp={st.scratchExp9} expLabel="scr" />
                              <GroupCell g={row.groups.mid} />
                              <GroupCell g={row.groups.high} exp={st.bogeyExp9} expLabel="bgy" />
                              <td className="px-2 py-2.5 text-center font-mono text-gray-200">
                                {row.gap9 != null ? row.gap9.toFixed(1) : <span className="text-gray-700">—</span>}
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono text-gray-300">
                                {row.blowups != null ? row.blowups.toFixed(1) : <span className="text-gray-700">—</span>}
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-2 py-2.5 text-center text-[11px] text-gray-600 italic">
                              No reliable hole-by-hole scores for this nine
                            </td>
                          )}
                          {ri === 0 && (
                            <>
                              <td rowSpan={span} className="px-2 py-2.5 align-top text-center font-mono text-gray-200">
                                {st.netVsRating9 != null ? fmtOver(st.netVsRating9)
                                  : <span className="text-gray-700" title={st.handicapsSet ? undefined : "Handicaps not set yet"}>—</span>}
                              </td>
                              <td rowSpan={span} className="px-2 py-2.5 align-top text-center font-mono text-gray-200">
                                {st.netGap9 != null ? st.netGap9.toFixed(1)
                                  : <span className="text-gray-700" title={st.handicapsSet ? undefined : "Handicaps not set yet"}>—</span>}
                              </td>
                            </>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-gray-900/60 border-t border-gray-800">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1.5">League notes</div>
                <NotesEditor courseName={course.name} initial={notes[course.name]} editable={editable} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
