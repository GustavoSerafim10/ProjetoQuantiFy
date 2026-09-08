/*
 * Odds de várias casas de apostas para o mesmo jogo — usadas só
 * para calcular o consenso de-vig (a "crença" sobre o jogo). A odd
 * de uma casa específica (ex: bet365, já existente em `OddsPayload`)
 * continua sendo o preço real usado para calcular EV.
 */
export interface MultiBookOddsPayload {
  home?: number[];
  draw?: number[];
  away?: number[];

  over15?: number[];
  under15?: number[];

  over25?: number[];
  under25?: number[];

  bttsYes?: number[];
  bttsNo?: number[];

  homeOrDraw?: number[];
  awayOrDraw?: number[];

  dnbHome?: number[];
  dnbAway?: number[];
}

export function hasUsableMultiBookOdds(
  odds: MultiBookOddsPayload | null | undefined
): boolean {
  if (!odds) {
    return false;
  }

  return Object.values(odds).some(
    values =>
      Array.isArray(values) &&
      values.some(odd => Number.isFinite(odd) && odd > 1)
  );
}
