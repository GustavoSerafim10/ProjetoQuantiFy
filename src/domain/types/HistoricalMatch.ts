import type { TeamStats } from "./TeamStats";

export interface HistoricalMatch {
  homeStats: TeamStats;
  awayStats: TeamStats;
  league: string;

  odds: Record<string, number>;

  result: {
    homeGoals: number;
    awayGoals: number;
    markets: string[];
  };
}