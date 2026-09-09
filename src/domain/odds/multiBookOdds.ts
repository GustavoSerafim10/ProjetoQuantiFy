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

/*
 * Achado real em 2026-09-09: `homeOrDraw`/`awayOrDraw`/`dnbHome`/
 * `dnbAway` existem no payload (a UI deixa preencher) mas NUNCA são
 * lidos por `fitMarketImpliedLambda` (domain/model/marketImpliedLambda.ts)
 * — só 1X2/O-U/BTTS entram no ajuste de lambda. Antes desta correção,
 * preencher só DNB/dupla-chance fazia `hasUsableMultiBookOdds`
 * retornar true, o que levava `marketModelPipeline`/`fusedModelPipeline`
 * a tentar ajustar o lambda sem nenhum alvo real — `fitMarketImpliedLambda`
 * então devolvia o fallback neutro (1.32/1.23) travestido de "ajuste
 * perfeito" (`fitError: 0`), e esse número fantasma virava a base da
 * análise. Por isso este helper só reconhece os campos que realmente
 * alimentam o ajuste de lambda.
 */
const LAMBDA_FITTABLE_MARKET_FIELDS = [
  "home",
  "draw",
  "away",
  "over15",
  "under15",
  "over25",
  "under25",
  "bttsYes",
  "bttsNo"
] as const satisfies ReadonlyArray<keyof MultiBookOddsPayload>;

export function hasUsableMultiBookOdds(
  odds: MultiBookOddsPayload | null | undefined
): boolean {
  if (!odds) {
    return false;
  }

  return LAMBDA_FITTABLE_MARKET_FIELDS.some(field => {
    const values = odds[field];

    return (
      Array.isArray(values) &&
      values.some(odd => Number.isFinite(odd) && odd > 1)
    );
  });
}
