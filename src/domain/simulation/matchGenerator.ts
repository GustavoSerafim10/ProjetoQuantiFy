import type { HistoricalMatch } from "../types/HistoricalMatch";

import seedrandom from "seedrandom";
const rng = seedrandom("quantify-v33");

import {
  goalMatrix,
  matchOutcomeProbabilities,
  overUnderProbability,
  bttsProbability
} from "../math/goalMatrix";

/* ===========================
   CONFIG
=========================== */

type MarketDifficulty =
  | "SOFT"
  | "NORMAL"
  | "SHARP";

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

  return {
    homeGoals: 0,
    awayGoals: 0
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
    ============================ */

    const lambdaHome =
      randomRange(0.8, 2.2);

    const lambdaAway =
      randomRange(0.6, 2.0);

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
      "HOME WIN":
        safeOdd(matchProbs.homeWin),

      "DRAW":
        safeOdd(matchProbs.draw),

      "AWAY WIN":
        safeOdd(matchProbs.awayWin),

      "OVER 1.5":
        safeOdd(ou15.over),

      "OVER 2.5":
        safeOdd(ou25.over),

      "UNDER 2.5":
        safeOdd(ou25.under),

      "BTTS YES":
        safeOdd(btts.yes),

      "BTTS NO":
        safeOdd(btts.no),

      "1X":
        safeOdd(
          matchProbs.homeWin +
          matchProbs.draw
        ),

      "X2":
        safeOdd(
          matchProbs.awayWin +
          matchProbs.draw
        )
    };

    matches.push({
      lambdaHome,
      lambdaAway,

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