import type { HistoricalMatch } from "../types/HistoricalMatch";
import type { TeamStats } from "../types/TeamStats";

import seedrandom from "seedrandom";

const MATCH_GENERATOR_SEED = "quantify-v33";

let rng = seedrandom(MATCH_GENERATOR_SEED);

/*
 * Reinicia o gerador para o início da mesma sequência
 * determinística. Usado por experimentos de calibração que
 * precisam comparar configurações diferentes sobre o
 * exato mesmo lote de partidas sintéticas — sem isso, cada
 * chamada subsequente de generateHistoricalMatches() dentro
 * do mesmo processo avançaria o gerador e compararia
 * amostras diferentes.
 */
export function resetMatchGeneratorSeed(): void {
  rng = seedrandom(MATCH_GENERATOR_SEED);
}

import {
  goalMatrix,
  matchOutcomeProbabilities,
  overUnderProbability,
  bttsProbability
} from "../math/goalMatrix";

import { buildLambda } from "../model/lambdaBuilder";

/* ===========================
   CONFIG
=========================== */

type MarketDifficulty =
  | "SOFT"
  | "NORMAL"
  | "SHARP";

const SYNTHETIC_LEAGUE = "SYNTHETIC_BACKTEST";

/* ===========================
   UTIL
=========================== */

function randomRange(
  min: number,
  max: number
) {
  return min + rng() * (max - min);
}

function sampleResult(
  matrix: {
    homeGoals: number;
    awayGoals: number;
    probability: number;
  }[]
) {
  const rand = rng();

  let cumulative = 0;

  for (const cell of matrix) {
    cumulative += cell.probability;

    if (rand <= cumulative) {
      return {
        homeGoals: cell.homeGoals,
        awayGoals: cell.awayGoals
      };
    }
  }

const lastCell =
  matrix[
    matrix.length - 1
  ];

return {
  homeGoals:
    lastCell?.homeGoals ?? 0,

  awayGoals:
    lastCell?.awayGoals ?? 0
};
}

/* ===========================
   SYNTHETIC TEAM STATS

   Gera estatísticas de time plausíveis (não lambdas
   prontos) para que o mesmo buildLambda() usado pelo
   modelPipeline em produção derive o lambda "real" aqui
   e, de forma determinística e idêntica, o lambda do
   modelo quando runBacktest chamar modelPipeline(match)
   com esses mesmos homeStats/awayStats.
=========================== */

let teamCounter = 0;

function generateTeamStats(
  venue: "HOME" | "AWAY"
): TeamStats {
  teamCounter++;

  const matchesPlayed =
    Math.round(
      randomRange(12, 34)
    );

  const goalsScoredPerMatch =
    venue === "HOME"
      ? randomRange(0.75, 2.35)
      : randomRange(0.55, 2.05);

  const goalsConcededPerMatch =
    venue === "HOME"
      ? randomRange(0.55, 1.75)
      : randomRange(0.85, 2.25);

  const shotsPerMatch =
    randomRange(8, 17);

  const shotsOnTargetPerMatch =
    shotsPerMatch *
    randomRange(0.30, 0.46);

  const bigChancesPerMatch =
    randomRange(1.3, 4.2);

  return {
    id: `SYN_${venue}_${teamCounter}`,
    name: `Synthetic ${venue} ${teamCounter}`,

    matchesPlayed,

    homeGoalsScoredPerMatch:
      venue === "HOME"
        ? goalsScoredPerMatch
        : randomRange(0.75, 2.35),

    homeGoalsConcededPerMatch:
      venue === "HOME"
        ? goalsConcededPerMatch
        : randomRange(0.55, 1.75),

    awayGoalsScoredPerMatch:
      venue === "AWAY"
        ? goalsScoredPerMatch
        : randomRange(0.55, 2.05),

    awayGoalsConcededPerMatch:
      venue === "AWAY"
        ? goalsConcededPerMatch
        : randomRange(0.85, 2.25),

    shotsPerMatch,
    shotsOnTargetPerMatch,
    bigChancesPerMatch
  };
}

/* ===========================
   MARKET DISTORTION
=========================== */

function distortLambda(
  lambda: number,
  difficulty: MarketDifficulty
) {
  let distortion = 1;

  if (difficulty === "SOFT") {
    distortion =
      0.75 + rng() * 0.50;
  }

  if (difficulty === "NORMAL") {
    distortion =
      0.85 + rng() * 0.30;
  }

  if (difficulty === "SHARP") {
    distortion =
      0.93 + rng() * 0.14;
  }

  return lambda * distortion;
}

/* ===========================
   ODDS ENGINE
=========================== */

function safeOdd(
  prob: number,
  margin = 0.05
) {
  if (!isFinite(prob) || prob <= 0.0001) {
    return 100;
  }

  return Math.max(
    1.01,
    1 / (prob * (1 + margin))
  );
}

/* ===========================
   GENERATOR
=========================== */

export function generateHistoricalMatches(
  count: number = 100,
  difficulty: MarketDifficulty = "NORMAL"
): HistoricalMatch[] {

  const matches: HistoricalMatch[] = [];

  for (let i = 0; i < count; i++) {

    /* ===========================
       TRUE MATCH REALITY

       homeStats/awayStats representam a "verdade" do
       confronto. O mesmo buildLambda() oficial deriva o
       lambda real a partir deles — o mesmo cálculo que
       modelPipeline fará de novo, de forma determinística,
       quando runBacktest analisar este match.
    ============================ */

    const homeStats =
      generateTeamStats("HOME");

    const awayStats =
      generateTeamStats("AWAY");

    const trueLambda =
      buildLambda(
        homeStats,
        awayStats,
        SYNTHETIC_LEAGUE
      );

    const lambdaHome =
      trueLambda.lambdaHome;

    const lambdaAway =
      trueLambda.lambdaAway;

    const realMatrix =
      goalMatrix(
        lambdaHome,
        lambdaAway
      );

    /* ===========================
       BOOKMAKER VIEW
    ============================ */

    let bookLambdaHome =
      distortLambda(
        lambdaHome,
        difficulty
      );

    let bookLambdaAway =
      distortLambda(
        lambdaAway,
        difficulty
      );

    /* ===========================
       FAVORITE BIAS
    ============================ */
    if (Math.abs(lambdaHome - lambdaAway) > 0.8) {
      if (lambdaHome > lambdaAway) {
        bookLambdaHome *= 1.06;
      } else {
        bookLambdaAway *= 1.06;
      }
    }

    /* ===========================
       OVER POPULARITY BIAS
    ============================ */
    if (
      lambdaHome + lambdaAway >
      2.7 &&
      rng() < 0.25
    ) {
      bookLambdaHome *= 1.05;
      bookLambdaAway *= 1.05;
    }

    const bookMatrix =
      goalMatrix(
        bookLambdaHome,
        bookLambdaAway
      );

    const matchProbs =
      matchOutcomeProbabilities(
        bookMatrix
      );

    const ou25 =
      overUnderProbability(
        bookMatrix,
        2.5
      );

    const ou15 =
      overUnderProbability(
        bookMatrix,
        1.5
      );

    const btts =
      bttsProbability(
        bookMatrix
      );

    /* ===========================
       REAL RESULT
    ============================ */

    const {
      homeGoals,
      awayGoals
    } =
      sampleResult(realMatrix);

    const totalGoals =
      homeGoals + awayGoals;

    const markets: string[] = [];

    if (homeGoals > awayGoals)
      markets.push("HOME WIN");

    if (homeGoals === awayGoals)
      markets.push("DRAW");

    if (homeGoals < awayGoals)
      markets.push("AWAY WIN");

    if (totalGoals > 1)
      markets.push("OVER 1.5");

    if (totalGoals > 2)
      markets.push("OVER 2.5");

    if (
      homeGoals > 0 &&
      awayGoals > 0
    ) {
      markets.push("BTTS YES");
    } else {
      markets.push("BTTS NO");
    }

    /* ===========================
       ODDS
    ============================ */

    const odds: Record<string, number> = {
      "HOME":
        safeOdd(matchProbs.homeWin),

      "DRAW":
        safeOdd(matchProbs.draw),

      "AWAY":
        safeOdd(matchProbs.awayWin),

      "OVER_1_5":
        safeOdd(ou15.over),

      "OVER_2_5":
        safeOdd(ou25.over),

      "UNDER_2_5":
        safeOdd(ou25.under),

      "BTTS_YES":
        safeOdd(btts.yes),

      "BTTS_NO":
        safeOdd(btts.no),

      "DOUBLE_CHANCE_1X":
        safeOdd(
          matchProbs.homeWin +
          matchProbs.draw
        ),

      "DOUBLE_CHANCE_X2":
        safeOdd(
          matchProbs.awayWin +
          matchProbs.draw
        )
    };

    matches.push({
      homeStats,
      awayStats,
      league: SYNTHETIC_LEAGUE,

      odds,

      result: {
        homeGoals,
        awayGoals,
        markets
      }
    });
  }

  return matches;
}
