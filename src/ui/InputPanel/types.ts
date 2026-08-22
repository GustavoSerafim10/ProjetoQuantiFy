/* ==========================================
   FORMULÁRIO
========================================== */

export type FormField =
  | "homeTeam"
  | "awayTeam"
  | "league"

  | "homeRating"
  | "awayRating"

  | "homeMatches"
  | "awayMatches"

  | "homeGoals"
  | "awayGoals"

  | "homeConceded"
  | "awayConceded"

  | "homeAssists"
  | "awayAssists"

  | "homeGoalsPG"
  | "awayGoalsPG"

  | "homeGoalsScoredHome"
  | "homeGoalsConcededHome"

  | "awayGoalsScoredAway"
  | "awayGoalsConcededAway"

  | "homeShotsOnTarget"
  | "awayShotsOnTarget"

  | "homeBigChances"
  | "awayBigChances"

  | "homeBigChancesMissed"
  | "awayBigChancesMissed"

  | "homePossession"
  | "awayPossession"

  | "homePasses"
  | "awayPasses"

  | "homeLongBalls"
  | "awayLongBalls"

  | "homeCleanSheets"
  | "awayCleanSheets"

  | "homeConcededPG"
  | "awayConcededPG"

  | "homeInterceptions"
  | "awayInterceptions"

  | "homeTackles"
  | "awayTackles"

  | "homeClearances"
  | "awayClearances"

  | "homeSaves"
  | "awaySaves"

  | "homeFouls"
  | "awayFouls"

  | "homeOffsides"
  | "awayOffsides"

  | "homeThrowIns"
  | "awayThrowIns"

  | "homeYellow"
  | "awayYellow"

  | "homeRed"
  | "awayRed"

  | "oddHome"
  | "oddDraw"
  | "oddAway"

  | "oddOver15"
  | "oddOver25"

  | "oddBTTSYes"
  | "oddBTTSNo"

  | "odd1X"
  | "oddX2";

export type FormState =
  Partial<Record<FormField, string>>;

/* ==========================================
   DADOS EXTERNOS
========================================== */

/*
 * O ComparisonPanel pode enviar números,
 * strings numéricas ou valores ausentes.
 *
 * Não restringimos tudo a number porque isso
 * esconderia problemas reais vindos da origem.
 */
export type ExternalInputData =
  Partial<
    Record<
      FormField,
      number | string | null | undefined
    >
  >;

/* ==========================================
   CONTRATO ESTATÍSTICO OFICIAL
========================================== */

export interface TeamStatsPayload {
  rating?: number;

  matches?: number;
  matchesPlayed?: number;

  goalsFor?: number;
  goalsAgainst?: number;

  /*
   * Contrato canônico e aliases temporários.
   */
  avgGoals?: number;
  goalsPerGame?: number;
  goalsForPerGame?: number;

  avgGoalsAgainst?: number;
  goalsConcededPerGame?: number;
  goalsAgainstPerGame?: number;

  /*
   * Split real de mando (opcional). Quando presente,
   * lambdaBuilder usa a base de liga específica de
   * casa/fora em vez da base neutra — ver venue.ts.
   */
  homeGoalsScoredPerMatch?: number;
  homeGoalsConcededPerMatch?: number;

  awayGoalsScoredPerMatch?: number;
  awayGoalsConcededPerMatch?: number;

  assists?: number;

  avgShotsOnTarget?: number;
  shotsOnTarget?: number;
  shotsOnTargetPerGame?: number;

  bigChances?: number;
  bigChancesMissed?: number;

  possession?: number;
  passes?: number;
  longBalls?: number;

  cleanSheets?: number;

  interceptions?: number;
  tackles?: number;
  clearances?: number;
  saves?: number;

  fouls?: number;
  offsides?: number;
  throwIns?: number;

  yellowCards?: number;
  redCards?: number;
}

export interface OddsPayload {
  home?: number;
  draw?: number;
  away?: number;

  over15?: number;
  over25?: number;

  bttsYes?: number;
  bttsNo?: number;

  homeOrDraw?: number;
  awayOrDraw?: number;
}

export interface AnalysisPayload {
  match: {
    home: string;
    away: string;
    league: string;
  };

  stats: {
    home: TeamStatsPayload;
    away: TeamStatsPayload;
  };

  odds: OddsPayload;

  inputDiagnostics: {
    source:
      "MANUAL_OR_COMPARISON_PANEL";

    externalDataReceived:
      boolean;

    externalDataPartial:
      boolean;

    externalMissingFields:
      FormField[];

    warnings:
      string[];
  };
}

/* ==========================================
   PROPS
========================================== */

export interface InputPanelProps {
  onAnalyze: (
    data: AnalysisPayload
  ) => void | Promise<void>;

  externalData?:
    ExternalInputData | null;
}

/* ==========================================
   INSPEÇÃO DOS DADOS EXTERNOS
========================================== */

export interface ExternalDataInspection {
  received:
    boolean;

  partial:
    boolean;

  missingFields:
    FormField[];

  warnings:
    string[];
}
