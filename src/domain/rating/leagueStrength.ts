export interface LeagueStrength {
  name: string;
  attackFactor: number;
  defenseFactor: number;
}

export const leagueStrengthMap: Record<string, LeagueStrength> = {
  premierLeague: {
    name: "Premier League",
    attackFactor: 1.02,
    defenseFactor: 1.01
  },
  laLiga: {
    name: "La Liga",
    attackFactor: 0.99,
    defenseFactor: 1.00
  }
};