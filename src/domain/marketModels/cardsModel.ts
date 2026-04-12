import { poissonPMF } from "../math/poisson";

export function cardsModel(lambdaCards: number) {

  if (!lambdaCards || isNaN(lambdaCards)) {
    lambdaCards = 4.5;
  }

  lambdaCards = Math.max(2, Math.min(8, lambdaCards));

  function probOver(line: number) {
    let prob = 0;

    for (let k = Math.ceil(line); k <= 15; k++) {
      prob += poissonPMF(lambdaCards, k);
    }

    return prob;
  }

  function probUnder(line: number) {
    return 1 - probOver(line);
  }

  return {
    lambda: lambdaCards,

    over35: probOver(3.5),
    over45: probOver(4.5),
    over55: probOver(5.5),

    under35: probUnder(3.5),
    under45: probUnder(4.5),
    under55: probUnder(5.5),
  };
}