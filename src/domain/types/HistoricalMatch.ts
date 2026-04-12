export interface HistoricalMatch {
  lambdaHome: number;
  lambdaAway: number;
  odds: Record<string, number>;

  result: {
    homeGoals: number;
    awayGoals: number;
    markets: string[];
  };
}