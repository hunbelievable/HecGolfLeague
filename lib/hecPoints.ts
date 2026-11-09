// HEC league points: the regular-event table times an event multiplier
// (1× tour event, 2× major, 3× Tour Championship).
// SGT uses its own tables for majors (600 for 1st) and the championship (2500 for 1st),
// which is why these differ from the stored Result.points.
import { POINTS_BY_POSITION } from "./types";

export function hecMultiplier(t: { isMajor: boolean; isChampionship: boolean }): number {
  if (t.isChampionship) return 3;
  if (t.isMajor) return 2;
  return 1;
}

export function hecPoints(position: number, t: { isMajor: boolean; isChampionship: boolean }): number {
  // Past 10th the regular table has no value; use 10th place's points.
  const base = POINTS_BY_POSITION[position - 1] ?? POINTS_BY_POSITION[POINTS_BY_POSITION.length - 1];
  return base * hecMultiplier(t);
}
