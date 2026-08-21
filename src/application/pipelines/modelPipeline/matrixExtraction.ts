import {
  type MatrixMarkets
} from "./types";

import {
  clamp,
  safeNumber
} from "./numericHelpers";

/* ==========================================
   EXTRAÇÃO DA MATRIZ
========================================== */

export function extractMatrixMarkets(
  matrix: number[][]
): MatrixMarkets {
  let home =
    0;

  let draw =
    0;

  let away =
    0;

  let over15 =
    0;

  let over25 =
    0;

  let bttsYes =
    0;

  for (
    let homeGoals = 0;
    homeGoals <
      matrix.length;
    homeGoals++
  ) {
    const row =
      matrix[
        homeGoals
      ] ?? [];

    for (
      let awayGoals = 0;
      awayGoals <
        row.length;
      awayGoals++
    ) {
      const probability =
        clamp(
          safeNumber(
            row[
              awayGoals
            ],
            0
          ),
          0,
          1
        );

      if (
        homeGoals >
        awayGoals
      ) {
        home +=
          probability;
      } else if (
        homeGoals ===
        awayGoals
      ) {
        draw +=
          probability;
      } else {
        away +=
          probability;
      }

      const totalGoals =
        homeGoals +
        awayGoals;

      if (
        totalGoals >= 2
      ) {
        over15 +=
          probability;
      }

      if (
        totalGoals >= 3
      ) {
        over25 +=
          probability;
      }

      if (
        homeGoals >= 1 &&
        awayGoals >= 1
      ) {
        bttsYes +=
          probability;
      }
    }
  }

  const resultTotal =
    home +
    draw +
    away;

  if (
    Number.isFinite(
      resultTotal
    ) &&
    resultTotal > 0
  ) {
    home /=
      resultTotal;

    draw /=
      resultTotal;

    away /=
      resultTotal;
  }

  home =
    clamp(
      home,
      0,
      1
    );

  draw =
    clamp(
      draw,
      0,
      1
    );

  away =
    clamp(
      away,
      0,
      1
    );

  over15 =
    clamp(
      over15,
      0,
      1
    );

  over25 =
    clamp(
      over25,
      0,
      1
    );

  bttsYes =
    clamp(
      bttsYes,
      0,
      1
    );

  const bttsNo =
    clamp(
      1 -
        bttsYes,
      0,
      1
    );

  const doubleChance1X =
    clamp(
      home +
        draw,
      0,
      1
    );

  const doubleChanceX2 =
    clamp(
      away +
        draw,
      0,
      1
    );

  return {
    home,
    draw,
    away,

    over15,
    over25,

    bttsYes,
    bttsNo,

    doubleChance1X,
    doubleChanceX2
  };
}
