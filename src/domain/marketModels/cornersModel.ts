import { poissonPMF } from "../math/poisson";

export function cornersModel(lambdaCorners: number) {
  /* ===========================
     1️⃣ SANITY CHECK
  ============================ */

  if (!lambdaCorners || isNaN(lambdaCorners)) {
    lambdaCorners = 9.5; // fallback neutro
  }

  // clamp seguro
  lambdaCorners = Math.max(5, Math.min(15, lambdaCorners));

  /* ===========================
     2️⃣ FUNÇÕES DE PROBABILIDADE
  ============================ */

  function probOver(line: number) {
    let prob = 0;

    for (let k = Math.ceil(line); k <= 25; k++) {
      prob += poissonPMF(lambdaCorners, k);
    }

    return prob;
  }

  function probUnder(line: number) {
    return 1 - probOver(line);
  }

  /* ===========================
     3️⃣ SAÍDA PADRÃO
  ============================ */

  return {
    lambda: lambdaCorners,

    over85: probOver(8.5),
    over95: probOver(9.5),
    over105: probOver(10.5),

    under85: probUnder(8.5),
    under95: probUnder(9.5),
    under105: probUnder(10.5),
  };
}