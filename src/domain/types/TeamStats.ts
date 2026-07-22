/* ==========================================
   TEAM STATS — QUANTIFY SPORTS V7
========================================== */

export interface TeamStats {
  /* ==========================================
     IDENTIFICAÇÃO
  ========================================== */

  id: string;
  name: string;

  /* ==========================================
     AMOSTRA
  ========================================== */

  /*
   * Quantidade de partidas utilizadas
   * para formar as médias.
   */
  matchesPlayed: number;

  /* ==========================================
     GOLS POR MANDO
  ========================================== */

  homeGoalsScoredPerMatch: number;
  homeGoalsConcededPerMatch: number;

  awayGoalsScoredPerMatch: number;
  awayGoalsConcededPerMatch: number;

  /* ==========================================
     MÉDIAS GERAIS OPCIONAIS
  ========================================== */

  /*
   * Campos genéricos utilizados quando alguma
   * engine não trabalha diretamente com mando.
   */
  goalsFor?: number;
  goalsAgainst?: number;

  goalsPerMatch?: number;
  goalsConcededPerMatch?: number;

  /* ==========================================
     ATAQUE
  ========================================== */

  shotsPerMatch?: number;
  shotsOnTargetPerMatch?: number;

  bigChancesPerMatch?: number;
  bigChancesCreatedPerMatch?: number;
  bigChancesMissedPerMatch?: number;

  /*
   * Perdas de posse podem ajudar a medir
   * controle, transição e risco estrutural,
   * mas não devem aumentar diretamente lambda
   * sem calibração.
   */
  possessionLostPerMatch?: number;

  /* ==========================================
     POSSE E PASSE
  ========================================== */

  possessionPercent?: number;

  passAccuracyPercent?: number;
  passesPerMatch?: number;
  accuratePassesPerMatch?: number;

  longBallsPerMatch?: number;
  accurateLongBallsPerMatch?: number;

  /* ==========================================
     DEFESA
  ========================================== */

  /*
   * Estes campos devem ser utilizados por modelos
   * defensivos, Winner Engine, risco e confiança.
   */
  savesPerMatch?: number;

  shotsConcededPerMatch?: number;
  shotsOnTargetConcededPerMatch?: number;

  bigChancesConcededPerMatch?: number;

  cleanSheetRate?: number;

  /* ==========================================
     DISCIPLINA E EVENTOS
  ========================================== */

  foulsPerMatch?: number;
  offsidesPerMatch?: number;
  throwInsPerMatch?: number;

  yellowCardsPerMatch?: number;
  redCardsPerMatch?: number;

  /* ==========================================
     FORMA E VOLATILIDADE
  ========================================== */

  goalVariance?: number;
  recentFormFactor?: number;

  last5GoalsFor?: number;
  last5GoalsAgainst?: number;

  /*
   * Caso os valores representem totais dos
   * últimos cinco jogos, isso deve ser mantido
   * explícito no nome.
   */
  last5GoalsForTotal?: number;
  last5GoalsAgainstTotal?: number;

  /* ==========================================
     FREQUÊNCIAS HISTÓRICAS
  ========================================== */

  over05Rate?: number;
  over15Rate?: number;
  over25Rate?: number;
  over35Rate?: number;

  bttsRate?: number;

  /* ==========================================
     QUALIDADE DOS DADOS
  ========================================== */

  /*
   * Permite registrar campos ausentes sem
   * alterar diretamente as probabilidades.
   *
   * Deve afetar confiança e risco.
   */
  missingFields?: string[];

  dataReliability?: number;
}