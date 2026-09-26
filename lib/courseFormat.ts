// Client-safe helpers for the Course Journal (no prisma import)

export function courseSlug(courseName: string): string {
  return courseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Strokes vs par: +3.2, E, -1.0 */
export function fmtOver(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) < 0.05) return "E";
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

export function nineLabel(nine: "front" | "back"): string {
  return nine === "front" ? "Front 9" : "Back 9";
}
