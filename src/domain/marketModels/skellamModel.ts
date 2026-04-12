import { poissonPMF } from "../math/poisson";

export function skellamModel(lambdaHome: number, lambdaAway: number) {

  const maxGoals = 10;

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {

      const prob =
        poissonPMF(lambdaHome, i) *
        poissonPMF(lambdaAway, j);

      if (i > j) homeWin += prob;
      else if (i === j) draw += prob;
      else awayWin += prob;
    }
  }

  return {
    homeWin,
    draw,
    awayWin
  };
}