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
  BDizzle: "#ef4444",       // red
  NickP: "#3b82f6",         // blue
  holiday402: "#10b981",    // green
  bsteffy: "#f59e0b",       // amber
  BozClubBreaker: "#8b5cf6", // purple
  TLindell: "#06b6d4",      // cyan
};

export const PLAYER_DISPLAY: Record<string, string> = {
  BDizzle: "BDizzle",
  NickP: "NickP",
  holiday402: "holiday402",
  bsteffy: "bsteffy",
  BozClubBreaker: "BozClubBreaker",
  TLindell: "TLindell",
};
