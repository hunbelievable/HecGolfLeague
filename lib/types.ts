export interface TournamentResult {
  position: number;
  playerId: string;
  score: string;
  points: number;
  type: "gross" | "net";
}

export interface Tournament {
  id: number;
  name: string;
  week: string;
  date: string;
  isMajor: boolean;
  grossResults: TournamentResult[];
  netResults: TournamentResult[];
}

export interface PlayerStanding {
  playerId: string;
  handicap: number;
  wins: number;
  top3: number;
  top5: number;
  totalPoints: number;
  avgPosition: number;
  bestScore: string;
  worstScore: string;
  events: number;
  results: Array<{
    tournamentId: number;
    tournamentName: string;
    week: string;
    position: number;
    score: string;
    points: number;
    isMajor: boolean;
  }>;
}

export interface StandingsData {
  gross: PlayerStanding[];
  net: PlayerStanding[];
  pointsHistory: PointsHistory[];
}

export interface PointsHistory {
  week: string;
  tournamentId: number;
  date: string;
  [playerId: string]: number | string;
}

export const PLAYER_COLORS: Record<string, string> = {
  BDizzle: "#ef4444",        // red
  NickP: "#3b82f6",          // blue
  holiday402: "#10b981",     // green
  bsteffy: "#f59e0b",        // amber
  BozClubBreaker: "#8b5cf6", // purple
  TLindell: "#06b6d4",       // cyan
  PikeMatrick: "#f97316",    // orange
  FavHoliday27: "#ec4899",   // pink
  HuskerRC13: "#84cc16",     // lime
  "2FlumsUp": "#a78bfa",     // violet
};

export const PLAYER_DISPLAY: Record<string, string> = {
  BDizzle: "BDizzle",
  NickP: "NickP",
  holiday402: "holiday402",
  bsteffy: "bsteffy",
  BozClubBreaker: "BozClubBreaker",
  TLindell: "TLindell",
  PikeMatrick: "PikeMatrick",
  FavHoliday27: "FavHoliday27",
  HuskerRC13: "HuskerRC13",
  "2FlumsUp": "2FlumsUp",
};

// Points awarded by finishing position (1-indexed)
export const POINTS_BY_POSITION: number[] = [500, 300, 190, 135, 110, 100, 90, 85, 80, 75];

export const SGT_USER_IDS: Record<string, number> = {
  BDizzle: 32758,
  NickP: 32767,
  holiday402: 21975,
  bsteffy: 36710,
  BozClubBreaker: 36728,
  TLindell: 33297,
  PikeMatrick: 47246,
  FavHoliday27: 47402,
  HuskerRC13: 47232,
  "2FlumsUp": 47263,
};
