"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { PLAYER_COLORS } from "@/lib/types";
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
  if (!g) return <td className="px-3 py-2.5 text-center text-gray-700">—</td>;
  return (
    <td className="px-3 py-2.5 text-center">
      <div className="font-mono text-gray-200">{fmtOver(g.avg9)}</div>
      <div className="text-[10px] text-gray-600">
        n={g.n}
        {exp != null && <> · {expLabel} {fmtOver(exp)}</>}
      </div>
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

function SlopeChart({ events }: { events: JournalEvent[] }) {
  const points = events
    .filter(e => e.courseSetup?.slope != null && e.stats.gap9 != null)
    .map(e => ({
      slope: e.courseSetup!.slope!,
      gap: e.stats.gap9!,
      label: e.courseSetup!.courseName,
      detail: `S${e.season} ${e.week} · ${e.courseSetup!.tees} tees`,
    }));

  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-600 px-4 py-6">
        Needs at least two events with both low (≤5) and high (13+) handicap players.
      </p>
    );
  }

  const yMax = Math.ceil((Math.max(...points.map(p => p.gap)) + 1) / 5) * 5;
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);

  return (
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 4 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="0" />
          <XAxis
            type="number" dataKey="slope" name="Slope"
            domain={["dataMin - 5", "dataMax + 5"]} allowDecimals={false}
            tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#374151" }} tickLine={false}
            label={{ value: "Slope of tees played", position: "insideBottom", offset: -16, fill: "#6b7280", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="gap" name="Gap" domain={[0, yMax]} ticks={yTicks}
            tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={36}
            label={{ value: "High − Low per 9", angle: -90, position: "insideLeft", offset: 10, fill: "#6b7280", fontSize: 11, dy: 50 }}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof points)[number];
              return (
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <div className="font-semibold text-white">{p.label}</div>
                  <div className="text-gray-500 mb-1">{p.detail}</div>
                  <div className="text-gray-300">Slope <b>{p.slope}</b> · gap <b>{p.gap.toFixed(1)}</b> strokes</div>
                </div>
              );
            }}
          />
          <Scatter data={points} fill="#22c55e" stroke="#111827" strokeWidth={2} isAnimationActive={false}>
            <LabelList dataKey="label" position="top" offset={10} style={{ fill: "#9ca3af", fontSize: 11 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
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

      {/* Slope vs handicap gap */}
      <section className="rounded-xl border border-gray-800 bg-gray-900 mb-6 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-white">Does slope predict the handicap gap?</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Slope is meant to measure how much harder a course plays for a bogey golfer than for scratch.
            Each dot is one round: the slope of the tees played against how many more strokes per 9 the
            high group (13+) took than the low group (≤5). Season 1 had no high-handicap players, so its
            rounds don&apos;t appear here.
          </p>
        </div>
        <SlopeChart events={visible} />
      </section>

      {/* How to read the tables */}
      <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
        Scores are gross strokes over par <b className="text-gray-400">per 9 holes</b>. Season 1&apos;s 18-hole rounds
        are split into front and back nines from hole-by-hole scores. Yards are the full 18 from the tees played. Groups use each player&apos;s current index:{" "}
        {HCP_GROUPS.map((g, i) => (
          <span key={g.key}>{i > 0 && ", "}{g.label} {g.range}</span>
        ))}.{" "}
        <b className="text-gray-400">scr</b> is what the course rating says a scratch golfer should shoot;{" "}
        <b className="text-gray-400">bgy</b> is the bogey golfer (~20 index), from rating + slope ÷ 5.381.
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
                      <th className="text-left px-4 py-2 font-semibold">Round</th>
                      <th className="text-left px-3 py-2 font-semibold">Nine</th>
                      <th className="text-left px-3 py-2 font-semibold">Tees</th>
                      <th className="text-center px-3 py-2 font-semibold">Slope</th>
                      <th className="text-center px-3 py-2 font-semibold">Rating</th>
                      <th className="text-left px-3 py-2 font-semibold">Conditions</th>
                      <th className="text-center px-3 py-2 font-semibold">Field</th>
                      <th className="text-center px-3 py-2 font-semibold">Low</th>
                      <th className="text-center px-3 py-2 font-semibold">Mid</th>
                      <th className="text-center px-3 py-2 font-semibold">High</th>
                      <th className="text-center px-3 py-2 font-semibold">Gap</th>
                      <th className="text-center px-3 py-2 font-semibold" title="Triple bogey or worse, per player per 9 holes">Blow-ups</th>
                      <th className="text-left px-4 py-2 font-semibold">Winner</th>
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
                            <td rowSpan={span} className="px-4 py-2.5 align-top">
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
                          <td className="px-3 py-2.5">
                            {row.nine ? (
                              <span className="text-gray-200">{nineLabel(row.nine.nine)}</span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          {ri === 0 && (
                            <>
                              <td rowSpan={span} className="px-3 py-2.5 align-top text-gray-300">
                                {cs?.tees ?? "—"}
                                {st.yards != null && <div className="text-[10px] text-gray-600">{st.yards.toLocaleString()} yds</div>}
                              </td>
                              <td rowSpan={span} className="px-3 py-2.5 align-top text-center font-mono text-gray-200">{cs?.slope ?? "—"}</td>
                              <td rowSpan={span} className="px-3 py-2.5 align-top text-center font-mono text-gray-200">{cs?.rating ?? "—"}</td>
                              <td rowSpan={span} className="px-3 py-2.5 align-top text-[11px] text-gray-400 leading-snug">
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
                              <td className="px-3 py-2.5 text-center font-mono text-gray-200">
                                {row.gap9 != null ? row.gap9.toFixed(1) : <span className="text-gray-700">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono text-gray-300">
                                {row.blowups != null ? row.blowups.toFixed(1) : <span className="text-gray-700">—</span>}
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-3 py-2.5 text-center text-[11px] text-gray-600 italic">
                              No reliable hole-by-hole scores for this nine
                            </td>
                          )}
                          {ri === 0 && (
                            <td rowSpan={span} className="px-4 py-2.5 align-top">
                              {st.winner ? (
                                <span className="text-xs">
                                  <span className="font-semibold" style={{ color: PLAYER_COLORS[st.winner.playerId] ?? "#e5e7eb" }}>
                                    {st.winner.playerId}
                                  </span>{" "}
                                  <span className="font-mono text-gray-500">{st.winner.score}</span>
                                </span>
                              ) : "—"}
                            </td>
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
