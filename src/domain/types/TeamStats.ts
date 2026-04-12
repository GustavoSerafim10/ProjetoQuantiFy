export interface TeamStats {
  id: string;
  name: string;

  matchesPlayed: number;

  homeGoalsScoredPerMatch: number;
  homeGoalsConcededPerMatch: number;

  awayGoalsScoredPerMatch: number;
  awayGoalsConcededPerMatch: number;

  goalVariance?: number;
  recentFormFactor?: number;

  // 🔥 NOVO
  shotsOnTargetPerMatch?: number;
  shotsPerMatch?: number;
}