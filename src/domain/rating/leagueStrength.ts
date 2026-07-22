/* ==========================================
   CONFIGURAÇÃO ESTRUTURAL DAS LIGAS
========================================== */

export interface LeagueStrength {
  /*
   * Nome utilizado apenas para exibição,
   * relatórios e diagnósticos.
   */
  name: string;

  /*
   * Identificação opcional da temporada.
   *
   * Importante porque o comportamento de uma liga
   * pode mudar entre temporadas.
   */
  season?: string;

  /* ==========================================
     BASE DE GOLS
  ========================================== */

  /*
   * Média total de gols esperada por partida.
   *
   * Deve ser atualizada futuramente com dados
   * históricos da liga e da temporada.
   */
  averageGoals: number;

  /*
   * Média de gols dos mandantes.
   */
  averageHomeGoals: number;

  /*
   * Média de gols dos visitantes.
   */
  averageAwayGoals: number;

  /* ==========================================
     AJUSTES ESTRUTURAIS
  ========================================== */

  /*
   * Ajuste geral de produção ofensiva da liga.
   *
   * 1.00 = neutro
   * > 1.00 = liga mais ofensiva
   * < 1.00 = liga menos ofensiva
   */
  attackFactor: number;

  /*
   * Ajuste da força defensiva da liga.
   *
   * 1.00 = neutro
   * > 1.00 = defesas estruturalmente mais fortes
   * < 1.00 = defesas estruturalmente mais frágeis
   *
   * No lambdaBuilder atual, esse fator é utilizado
   * como divisor do fator ofensivo.
   */
  defenseFactor: number;

  /*
   * Vantagem estrutural do mandante.
   *
   * 1.00 = nenhuma vantagem
   * > 1.00 = vantagem do mandante
   */
  homeAdvantage: number;

  /*
   * Força competitiva geral da liga.
   *
   * Não deve alterar diretamente os gols.
   * Pode ser utilizada futuramente pelo:
   *
   * - Winner Engine;
   * - Risk Engine;
   * - Confidence Engine;
   * - calibração;
   * - comparação entre ligas.
   */
  leagueStrength: number;

  /* ==========================================
     IDENTIDADE DOS MERCADOS
  ========================================== */

  /*
   * Estes fatores devem permanecer neutros até
   * existirem dados históricos e backtests que
   * justifiquem qualquer alteração.
   */

  over15Factor: number;
  over25Factor: number;

  bttsYesFactor: number;
  bttsNoFactor: number;

  homeWinFactor: number;
  drawFactor: number;
  awayWinFactor: number;

  /*
   * As duplas chances serão derivadas de:
   *
   * 1X = Casa + Empate
   * X2 = Fora + Empate
   *
   * Portanto, não possuem fatores independentes.
   */

  /* ==========================================
     RISCO E CONFIABILIDADE
  ========================================== */

  /*
   * Multiplicador estrutural de variância.
   *
   * 1.00 = neutro
   * > 1.00 = liga mais imprevisível
   * < 1.00 = liga mais estável
   */
  volatilityFactor: number;

  /*
   * Qualidade histórica dos dados disponíveis
   * para a competição.
   *
   * Deve ser utilizado em confiança e risco,
   * nunca para aumentar diretamente probabilidade.
   */
  dataReliability: number;
}

/* ==========================================
   CONFIGURAÇÃO PADRÃO
========================================== */

/*
 * Utilizada quando leagueKey não estiver cadastrada.
 *
 * Todos os multiplicadores de mercado permanecem
 * neutros para evitar ajustes arbitrários.
 */
export const defaultLeagueStrength: LeagueStrength = {
  name: "Liga Padrão",

  averageGoals: 2.55,
  averageHomeGoals: 1.32,
  averageAwayGoals: 1.23,

  attackFactor: 1,
  defenseFactor: 1,
  homeAdvantage: 1.06,

  leagueStrength: 1,

  over15Factor: 1,
  over25Factor: 1,

  bttsYesFactor: 1,
  bttsNoFactor: 1,

  homeWinFactor: 1,
  drawFactor: 1,
  awayWinFactor: 1,

  volatilityFactor: 1,
  dataReliability: 1
};

/* ==========================================
   MAPA DAS LIGAS
========================================== */

/*
 * Os fatores específicos dos mercados continuam
 * em 1.00 enquanto não forem calibrados por:
 *
 * - base histórica;
 * - Brier Score;
 * - Log Loss;
 * - backtesting fora da amostra;
 * - resultados separados por liga e temporada.
 *
 * Os valores antigos de attackFactor e defenseFactor
 * foram preservados temporariamente para manter
 * compatibilidade com o comportamento atual.
 */
export const leagueStrengthMap: Record<
  string,
  LeagueStrength
> = {
  premierLeague: {
    name: "Premier League",

    averageGoals: 2.55,
    averageHomeGoals: 1.32,
    averageAwayGoals: 1.23,

    attackFactor: 1.02,
    defenseFactor: 1.01,
    homeAdvantage: 1.06,

    leagueStrength: 1,

    over15Factor: 1,
    over25Factor: 1,

    bttsYesFactor: 1,
    bttsNoFactor: 1,

    homeWinFactor: 1,
    drawFactor: 1,
    awayWinFactor: 1,

    volatilityFactor: 1,
    dataReliability: 1
  },

  laLiga: {
    name: "La Liga",

    averageGoals: 2.55,
    averageHomeGoals: 1.32,
    averageAwayGoals: 1.23,

    attackFactor: 0.99,
    defenseFactor: 1,
    homeAdvantage: 1.06,

    leagueStrength: 1,

    over15Factor: 1,
    over25Factor: 1,

    bttsYesFactor: 1,
    bttsNoFactor: 1,

    homeWinFactor: 1,
    drawFactor: 1,
    awayWinFactor: 1,

    volatilityFactor: 1,
    dataReliability: 1
  }
};

/* ==========================================
   UTILITÁRIOS
========================================== */

/*
 * Sempre retorna uma configuração válida.
 *
 * Evita espalhar verificações de undefined
 * pelos demais módulos do projeto.
 */
export function getLeagueStrength(
  leagueKey?: string
): LeagueStrength {
  if (!leagueKey) {
    return defaultLeagueStrength;
  }

  return (
    leagueStrengthMap[leagueKey] ??
    defaultLeagueStrength
  );
}

/*
 * Retorna apenas o fator atualmente utilizado
 * para ajuste dos lambdas.
 *
 * Mantém a semântica centralizada:
 *
 * fator maior que 1 → maior expectativa ofensiva
 * fator menor que 1 → menor expectativa ofensiva
 */
export function getLeagueGoalAdjustment(
  leagueKey?: string
): number {
  const league = getLeagueStrength(leagueKey);

  const attackFactor = Number.isFinite(
    league.attackFactor
  )
    ? league.attackFactor
    : 1;

  const defenseFactor =
    Number.isFinite(league.defenseFactor) &&
    league.defenseFactor > 0
      ? league.defenseFactor
      : 1;

  const adjustment =
    attackFactor / defenseFactor;

  /*
   * Proteção contra configurações extremas
   * ou erros de digitação.
   */
  return Math.max(
    0.85,
    Math.min(1.15, adjustment)
  );
}