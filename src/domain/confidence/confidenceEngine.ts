/* ==========================================
   GLOBAL CONFIDENCE ENGINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - avaliar a consistência global do modelo;
 * - medir coerência entre probabilidades e lambdas;
 * - produzir uma confiança estrutural da partida;
 * - não calcular confiança específica por mercado.
 */

interface ConfidenceInput {
  goals: any;
  btts: any;
  result: any;

  lambdaHome: number;
  lambdaAway: number;
}

export function calculateGlobalConfidence(
  input: ConfidenceInput
): number {
  const goalsOver25 =
    firstProbability([
      input?.goals?.over25,
      input?.goals?.over2_5,
      input?.goals?.overTwoFive
    ]);

  const bttsYes =
    firstProbability([
      input?.btts?.yes,
      input?.btts?.bttsYes,
      input?.btts?.bothTeamsScore
    ]);

  const homeWin =
    firstProbability([
      input?.result?.homeWin,
      input?.result?.home,
      input?.result?.homeProbability
    ]);

  const draw =
    firstProbability([
      input?.result?.draw,
      input?.result?.drawProbability
    ]);

  const awayWin =
    firstProbability([
      input?.result?.awayWin,
      input?.result?.away,
      input?.result?.awayProbability
    ]);

  const lambdaHome =
    parsePositiveNumber(
      input?.lambdaHome
    );

  const lambdaAway =
    parsePositiveNumber(
      input?.lambdaAway
    );

  /*
   * Sem os componentes oficiais do modelo,
   * não inventamos confiança.
   */
  if (
    goalsOver25 === null ||
    bttsYes === null ||
    homeWin === null ||
    draw === null ||
    awayWin === null ||
    lambdaHome === null ||
    lambdaAway === null
  ) {
    return 0;
  }

  const normalizedResult =
    normalizeResult({
      homeWin,
      draw,
      awayWin
    });

  const totalLambda =
    lambdaHome +
    lambdaAway;

  const lambdaDifference =
    Math.abs(
      lambdaHome -
      lambdaAway
    );

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  const resultProbabilities = [
    normalizedResult.homeWin,
    normalizedResult.draw,
    normalizedResult.awayWin
  ];

  const maximumResult =
    Math.max(
      ...resultProbabilities
    );

  const secondResult =
    [...resultProbabilities]
      .sort(
        (first, second) =>
          second - first
      )[1];

  /*
   * Separação do resultado mais provável para
   * a segunda alternativa.
   */
  const resultSeparation =
    maximumResult -
    secondResult;

  /*
   * Convicção dos blocos:
   *
   * mede distância em relação aos pontos de
   * maior incerteza de cada mercado.
   */
  const goalsConviction =
    normalizeDistanceFromCenter(
      goalsOver25,
      0.50,
      0.50
    );

  const bttsConviction =
    normalizeDistanceFromCenter(
      bttsYes,
      0.50,
      0.50
    );

  const resultConviction =
    clamp(
      resultSeparation /
      0.35,
      0,
      1
    );

  /*
   * Qualidade estrutural dos lambdas.
   */
  let structuralConfidence =
    0.55;

  if (
    totalLambda >= 1.80 &&
    totalLambda <= 3.60
  ) {
    structuralConfidence +=
      0.12;
  }

  if (
    totalLambda > 3.60 &&
    totalLambda <= 4.20
  ) {
    structuralConfidence +=
      0.04;
  }

  if (
    totalLambda > 4.20
  ) {
    structuralConfidence -=
      0.08;
  }

  if (
    lambdaDifference >= 0.30 &&
    lambdaDifference <= 1.50
  ) {
    structuralConfidence +=
      0.05;
  }

  if (
    lambdaDifference < 0.20 &&
    draw >= 0.25
  ) {
    structuralConfidence +=
      0.03;
  }

  if (
    minimumLambda >= 0.85 &&
    minimumLambda <= 1.80
  ) {
    structuralConfidence +=
      0.04;
  }

  /*
   * Coerência entre BTTS e estrutura.
   */
  if (
    bttsYes >= 0.65 &&
    minimumLambda < 0.75
  ) {
    structuralConfidence -=
      0.10;
  }

  /*
   * Coerência entre Over 2.5 e total lambda.
   */
  if (
    goalsOver25 >= 0.70 &&
    totalLambda < 2.40
  ) {
    structuralConfidence -=
      0.10;
  }

  /*
   * Lambdas extremos e perfeitamente iguais
   * podem indicar saturação ou clamp anterior.
   */
  if (
    totalLambda >= 4.40 &&
    lambdaDifference < 0.05
  ) {
    structuralConfidence -=
      0.12;
  }

  structuralConfidence =
    clamp(
      structuralConfidence,
      0,
      1
    );

  /*
   * Escala global interpretável:
   *
   * 0.50 = confiança neutra
   * acima de 0.65 = boa consistência
   * acima de 0.75 = forte consistência
   *
   * Continua sendo confiança global, não a
   * confiança final de um mercado.
   */
  const confidence =
    0.35 +
    goalsConviction * 0.16 +
    bttsConviction * 0.14 +
    resultConviction * 0.15 +
    structuralConfidence * 0.20;

  return roundNumber(
    clamp(
      confidence,
      0,
      0.90
    )
  );
}

/* ==========================================
   NORMALIZAÇÃO 1X2
========================================== */

function normalizeResult(
  result: {
    homeWin: number;
    draw: number;
    awayWin: number;
  }
) {
  const total =
    result.homeWin +
    result.draw +
    result.awayWin;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      homeWin: 0,
      draw: 0,
      awayWin: 0
    };
  }

  return {
    homeWin:
      result.homeWin /
      total,

    draw:
      result.draw /
      total,

    awayWin:
      result.awayWin /
      total
  };
}

/* ==========================================
   HELPERS
========================================== */

function firstProbability(
  values: unknown[]
): number | null {
  for (const value of values) {
    const parsed =
      parseProbability(
        value
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseProbability(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parsePositiveNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeDistanceFromCenter(
  value: number,
  center: number,
  maximumDistance: number
): number {
  return clamp(
    Math.abs(
      value -
      center
    ) /
    maximumDistance,
    0,
    1
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function roundNumber(
  value: number,
  decimals = 4
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}