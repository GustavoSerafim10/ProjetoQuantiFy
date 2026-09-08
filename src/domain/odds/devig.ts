/*
 * Consenso de múltiplas casas de apostas, sem margem (de-vig).
 *
 * Achado real em 2026-09-08: um método validado manualmente pelo
 * usuário (odds médias de bet365/Betano/Superbet, margem removida
 * proporcionalmente) acertou 5 de 6 entradas reais na Champions
 * League — muito melhor que o motor Poisson-de-stats do projeto
 * (25% de acerto, -17,2% ROI, e um bug de dados real corrompendo o
 * proxy de xG). Este módulo implementa exatamente esse método:
 * probabilidade "real" = probabilidade implícita (1/odd) média das
 * casas, normalizada para somar 1.
 *
 * Não decide mercado, não calcula EV, não constrói lambda — só
 * converte odds em probabilidade de consenso.
 */

/*
 * Média simples das odds de N casas para um mesmo resultado.
 * Odds inválidas (<=1, não finitas) são ignoradas; se nenhuma
 * sobrar, retorna null em vez de inventar um valor.
 */
export function averageBookmakerOdds(
  oddsPerOutcome: number[]
): number | null {
  const validOdds = oddsPerOutcome.filter(
    odd => Number.isFinite(odd) && odd > 1
  );

  if (validOdds.length === 0) {
    return null;
  }

  return (
    validOdds.reduce((sum, odd) => sum + odd, 0) /
    validOdds.length
  );
}

/*
 * Remove a margem da casa proporcionalmente: cada probabilidade
 * implícita (1/odd) é dividida pela soma de todas as
 * probabilidades implícitas do mercado, de forma que o total dê
 * exatamente 1. Método simples e o mais usado — foi o confirmado
 * pelo usuário e bate com os números que ele já validou nos PDFs.
 */
export function devigProportional(
  averagedOdds: number[]
): number[] {
  const impliedProbabilities = averagedOdds.map(odd =>
    Number.isFinite(odd) && odd > 1 ? 1 / odd : 0
  );

  const total = impliedProbabilities.reduce(
    (sum, probability) => sum + probability,
    0
  );

  if (total <= 0) {
    return averagedOdds.map(() => 0);
  }

  return impliedProbabilities.map(
    probability => probability / total
  );
}

/*
 * Atalho para o caso comum: odds de várias casas por resultado ->
 * probabilidade de consenso, sem margem, num único passo.
 * `oddsByOutcome` é a lista de odds de cada casa por resultado, ex:
 * [[1.68, 1.70], [4.05, 4.00], [4.45, 4.50]] para 1X2 com 2 casas.
 */
export function devigConsensus(
  oddsByOutcome: number[][]
): {
  averagedOdds: Array<number | null>;
  probabilities: number[];
  bookmakerCount: number;
} {
  const averagedOdds = oddsByOutcome.map(averageBookmakerOdds);

  const bookmakerCount = Math.max(
    0,
    ...oddsByOutcome.map(
      outcomeOdds =>
        outcomeOdds.filter(
          odd => Number.isFinite(odd) && odd > 1
        ).length
    )
  );

  const probabilities = devigProportional(
    averagedOdds.map(odd => odd ?? 0)
  );

  return {
    averagedOdds,
    probabilities,
    bookmakerCount
  };
}
