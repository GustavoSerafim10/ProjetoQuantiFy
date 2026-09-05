import {
  clamp
} from "./numericHelpers";

/* ==========================================
   PERFIL DE GOLS
========================================== */

export function calculateGoalExpectationScore(
  lambdaHome: number,
  lambdaAway: number
): number {
  const totalLambda =
    lambdaHome +
    lambdaAway;

  const weakerLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  /*
   * Mede expectativa conjunta de gols.
   *
   * Não altera lambda, probabilidade ou EV.
   */
  const totalComponent =
    clamp(
      totalLambda /
        3.25,
      0,
      1
    );

  /*
   * Achado real em 2026-09-05 (mesmo padrão já corrigido antes em
   * contextEngine.ts/contextAdjustment.ts): o denominador original
   * (1.15) satura este componente assim que o lambda do lado MAIS
   * FRACO passa de 1.15 — um valor apenas um pouco acima da média
   * de um time mediano, não de um ataque genuinamente forte. Medido
   * com amostra realista (1000 jogos, lambdas 0.5-2.5): 37% batiam
   * no teto (score final >= 0.999), média de 0.858 num score que
   * deveria centralizar perto de 0.5 para uma amostra aleatória.
   * Isso inflava artificialmente goalExpectationScore pra perto de
   * 1.0 em jogos comuns, disparando GOAL_EXPECTATION_CONTEXT_DIVERGENCE
   * (operationalPolicy.ts) contra contextualGoalExpectationScore —
   * que usa uma curva logística bem mais suave — mesmo quando não
   * havia divergência real nenhuma entre os dois modelos.
   *
   * 2.0 exige um ataque genuinamente forte (2 gols esperados) do
   * lado mais fraco para saturar — ainda alcançável em jogos de
   * fato abertos, mas não em qualquer confronto equilibrado comum.
   */
  const bilateralComponent =
    clamp(
      weakerLambda /
        2.0,
      0,
      1
    );

  return clamp(
    totalComponent *
      0.75 +
    bilateralComponent *
      0.25,
    0,
    1
  );
}

export function classifyGoalProfile(
  lambdaHome: number,
  lambdaAway: number
):
  | "LOW_GOAL"
  | "OPEN_GOALS"
  | "FAVORITE_EDGE"
  | "BALANCED" {
  const total =
    lambdaHome +
    lambdaAway;

  const minimumLambda =
    Math.min(
      lambdaHome,
      lambdaAway
    );

  const difference =
    Math.abs(
      lambdaHome -
      lambdaAway
    );

  if (
    total < 1.85 ||
    (
      lambdaHome < 0.85 &&
      lambdaAway < 0.85
    )
  ) {
    return "LOW_GOAL";
  }

  if (
    total >= 2.75 &&
    minimumLambda >= 0.95
  ) {
    return "OPEN_GOALS";
  }

  if (
    difference >= 0.75
  ) {
    return "FAVORITE_EDGE";
  }

  return "BALANCED";
}
