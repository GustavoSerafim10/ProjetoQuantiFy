import type {
  TeamStats
} from "../../types/TeamStats";

import { PIPELINE_DEBUG } from "../../../shared/debugFlag";

import {
  getLeagueGoalAdjustment,
  resolveLeagueStrength,
  buildLeagueReliability,
  type LeagueReliability
} from "../../rating/leagueStrength";

import {
  calculateXGProxyDetailed
} from "../../math/xgProxy";

import type {
  TeamStatsCompatibility
} from "./types";

import {
  clamp,
  safeNumber,
  safePositiveNumber,
  roundNumber
} from "./numericHelpers";

import {
  resolveMatchesPlayed
} from "./sample";

import {
  resolveHomeGoalsScored,
  resolveAwayGoalsScored
} from "./attackRates";

import {
  resolveHomeGoalsConceded,
  resolveAwayGoalsConceded
} from "./defenseRates";

import {
  resolveShotsOnTarget,
  resolveShots,
  resolveBigChances
} from "./shotResolution";

import {
  buildContextualAttackFactors
} from "./contextualFactors";

import {
  isTrueVenueAttackSource,
  isTrueVenueDefenseSource
} from "./venue";

import {
  calculateAdaptiveShrinkFactor,
  shrinkStat
} from "./shrinkage";

import {
  calculateDominanceFactor,
  safePower
} from "./safePower";

import {
  resolveLeagueGoalBases
} from "./leagueBases";

import {
  applyUpperTotalLimit
} from "./totalCap";

import {
  calculateInputQuality,
  calculateSampleReliability,
  buildWarnings
} from "./dataQuality";

import {
  ATTACK_ELASTICITY,
  DEFENSE_ELASTICITY,
  SHRINK_FACTOR,
  MIN_LAMBDA,
  MAX_LAMBDA,
  MAX_TOTAL_LAMBDA,
  GOALS_WEIGHT,
  XG_PROXY_WEIGHT,
  SHOT_QUALITY_WEIGHT,
  DOMINANCE_ELASTICITY,
  RECENT_FORM_MAX_ADJUSTMENT,
  VARIANCE_MAX_ADJUSTMENT,
  SHOT_QUALITY_MAX_ADJUSTMENT,
  MIN_ADAPTIVE_SHRINK,
  MAX_ADAPTIVE_SHRINK
} from "./constants";

/* ==========================================
   LAMBDA BUILDER — QUANTIFY V7.2 ELITE

   Objetivo da V7.2:
   - preservar a natureza estatística da entrada;
   - distinguir splits reais de médias gerais;
   - normalizar médias gerais contra uma base neutra;
   - aplicar o mando uma única vez nas bases finais;
   - impedir zero falso em finalizações totais;
   - ampliar diagnósticos de proveniência;
   - reduzir o viés estrutural de X2 gerado por
     normalização incompatível entre fonte e base.
========================================== */

/* ==========================================
   BUILD LAMBDA
========================================== */

export function buildLambda(
  homeInput:
    TeamStats,

  awayInput:
    TeamStats,

  leagueKey:
    string
) {
  const home =
    homeInput as
      TeamStatsCompatibility;

  const away =
    awayInput as
      TeamStatsCompatibility;

  /* ========================================
     CONFIGURAÇÃO DA LIGA
  ======================================== */

 const leagueResolution =
    resolveLeagueStrength(
      leagueKey
    );

  const league =
    leagueResolution.config;

  /*
   * Fonte oficial única de confiabilidade da liga.
   * Propagada adiante — nunca recalculada por
   * outros pipelines.
   */
  const leagueReliability: LeagueReliability =
    buildLeagueReliability(
      leagueResolution
    );

  const {
    leagueAverageGoals,
    leagueBaseHome,
    leagueBaseAway
  } =
    resolveLeagueGoalBases(
      league.averageGoals,
      league.averageHomeGoals,
      league.averageAwayGoals
    );

  /*
   * Base neutra por equipe.
   *
   * Usada sempre que a estatística recebida for
   * uma média geral e não um split real de mando.
   */
  const leagueTeamBase =
    leagueAverageGoals /
    2;

  /*
   * Ajuste complementar centralizado em
   * leagueStrength.ts.
   */
  const leagueAdjustment =
    safePositiveNumber(
      getLeagueGoalAdjustment(
        leagueKey
      ),
      1
    );

  /* ========================================
     AMOSTRA
  ======================================== */

  const homeMatchesResult =
    resolveMatchesPlayed(
      home
    );

  const awayMatchesResult =
    resolveMatchesPlayed(
      away
    );

  const homeMatchesPlayed =
    homeMatchesResult.value;

  const awayMatchesPlayed =
    awayMatchesResult.value;

  /* ========================================
     TAXAS OBSERVADAS
  ======================================== */

  const homeGoalsResult =
    resolveHomeGoalsScored(
      home,
      leagueBaseHome,
      homeMatchesPlayed
    );

  const awayGoalsResult =
    resolveAwayGoalsScored(
      away,
      leagueBaseAway,
      awayMatchesPlayed
    );

  const homeConcededResult =
    resolveHomeGoalsConceded(
      home,
      leagueBaseAway,
      homeMatchesPlayed
    );

  const awayConcededResult =
    resolveAwayGoalsConceded(
      away,
      leagueBaseHome,
      awayMatchesPlayed
    );

  const homeGoalsRate =
    homeGoalsResult.value;

  const awayGoalsRate =
    awayGoalsResult.value;

  const homeGoalsConcededRate =
    homeConcededResult.value;

  const awayGoalsConcededRate =
    awayConcededResult.value;

  /* ========================================
     FINALIZAÇÕES E XG PROXY
  ======================================== */

  const homeShotsOnTargetResult =
    resolveShotsOnTarget(
      home
    );

  const awayShotsOnTargetResult =
    resolveShotsOnTarget(
      away
    );

  const homeShotsResult =
    resolveShots(
      home
    );

  const awayShotsResult =
    resolveShots(
      away
    );

  const homeBigChancesResult =
    resolveBigChances(
      home
    );

  const awayBigChancesResult =
    resolveBigChances(
      away
    );

  /*
   * Zero em chutes totais com chutes no alvo
   * positivos é tratado como ausência de dado.
   *
   * Exemplo impossível:
   * shots = 0 e shotsOnTarget = 4.3.
   */
  const homeShotsForModel =
    homeShotsResult.value !== null &&
    homeShotsResult.value > 0
      ? homeShotsResult.value
      : homeShotsOnTargetResult.value !== null &&
        homeShotsOnTargetResult.value > 0
        ? null
        : homeShotsResult.value;

  const awayShotsForModel =
    awayShotsResult.value !== null &&
    awayShotsResult.value > 0
      ? awayShotsResult.value
      : awayShotsOnTargetResult.value !== null &&
        awayShotsOnTargetResult.value > 0
        ? null
        : awayShotsResult.value;

  const homeFalseZeroShotsDetected =
    homeShotsResult.value === 0 &&
    homeShotsOnTargetResult.value !== null &&
    homeShotsOnTargetResult.value > 0;

  const awayFalseZeroShotsDetected =
    awayShotsResult.value === 0 &&
    awayShotsOnTargetResult.value !== null &&
    awayShotsOnTargetResult.value > 0;

  const homeXGResult =
    calculateXGProxyDetailed(
      homeShotsOnTargetResult
        .value,

      homeShotsForModel
    );

  const awayXGResult =
    calculateXGProxyDetailed(
      awayShotsOnTargetResult
        .value,

      awayShotsForModel
    );

  const homeXG =
    homeXGResult.xg;

  const awayXG =
    awayXGResult.xg;

  const homeContextualFactors =
    buildContextualAttackFactors({
      team:
        home,

      goalsRate:
        homeGoalsRate,

      shotsOnTarget:
        homeShotsOnTargetResult
          .value,

      shots:
        homeShotsForModel,

      bigChances:
        homeBigChancesResult
          .value
    });

  const awayContextualFactors =
    buildContextualAttackFactors({
      team:
        away,

      goalsRate:
        awayGoalsRate,

      shotsOnTarget:
        awayShotsOnTargetResult
          .value,

      shots:
        awayShotsForModel,

      bigChances:
        awayBigChancesResult
          .value
    });

  /* ========================================
     COMPOSIÇÃO OFENSIVA
  ======================================== */

  const homeShotQualityProxy =
    homeGoalsRate *
    homeContextualFactors
      .shotQualityFactor;

  const awayShotQualityProxy =
    awayGoalsRate *
    awayContextualFactors
      .shotQualityFactor;

  const homeAttackBaseComposite =
    homeXGResult.valid &&
    homeXG !== null
      ? (
          homeGoalsRate *
            GOALS_WEIGHT +
          homeXG *
            XG_PROXY_WEIGHT +
          homeShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        )
      : (
          homeGoalsRate *
            (
              GOALS_WEIGHT +
              XG_PROXY_WEIGHT
            ) +
          homeShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        );

  const awayAttackBaseComposite =
    awayXGResult.valid &&
    awayXG !== null
      ? (
          awayGoalsRate *
            GOALS_WEIGHT +
          awayXG *
            XG_PROXY_WEIGHT +
          awayShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        )
      : (
          awayGoalsRate *
            (
              GOALS_WEIGHT +
              XG_PROXY_WEIGHT
            ) +
          awayShotQualityProxy *
            SHOT_QUALITY_WEIGHT
        );

  const homeAttackComposite =
    homeAttackBaseComposite *
    homeContextualFactors
      .recentFormFactor *
    homeContextualFactors
      .varianceFactor;

  const awayAttackComposite =
    awayAttackBaseComposite *
    awayContextualFactors
      .recentFormFactor *
    awayContextualFactors
      .varianceFactor;

  const preliminaryInputQuality =
    calculateInputQuality([
      homeGoalsResult,
      awayGoalsResult,
      homeConcededResult,
      awayConcededResult
    ]);

  /* ========================================
     REFERÊNCIAS ESTATÍSTICAS V7.2
  ======================================== */

  /*
   * Splits reais usam bases específicas de mando.
   *
   * Médias gerais usam a base neutra por equipe.
   * Isso impede que goalsPerGame do visitante seja
   * dividido por uma base visitante artificialmente
   * menor, criando força ofensiva falsa.
   */
  const homeAttackReference =
    isTrueVenueAttackSource(
      homeGoalsResult.source
    )
      ? leagueBaseHome
      : leagueTeamBase;

  const awayAttackReference =
    isTrueVenueAttackSource(
      awayGoalsResult.source
    )
      ? leagueBaseAway
      : leagueTeamBase;

  const homeDefenseReference =
    isTrueVenueDefenseSource(
      homeConcededResult.source
    )
      ? leagueBaseAway
      : leagueTeamBase;

  const awayDefenseReference =
    isTrueVenueDefenseSource(
      awayConcededResult.source
    )
      ? leagueBaseHome
      : leagueTeamBase;

  /* ========================================
     SHRINKAGE DO ATAQUE
  ======================================== */

  const homeAttackRaw =
    shrinkStat(
      homeAttackComposite,
      homeAttackReference,
      homeMatchesPlayed,
      preliminaryInputQuality
    );

  const awayAttackRaw =
    shrinkStat(
      awayAttackComposite,
      awayAttackReference,
      awayMatchesPlayed,
      preliminaryInputQuality
    );

  /* ========================================
     SHRINKAGE DA DEFESA
  ======================================== */

  const homeDefenseRaw =
    shrinkStat(
      homeGoalsConcededRate,
      homeDefenseReference,
      homeMatchesPlayed,
      preliminaryInputQuality
    );

  const awayDefenseRaw =
    shrinkStat(
      awayGoalsConcededRate,
      awayDefenseReference,
      awayMatchesPlayed,
      preliminaryInputQuality
    );

  /* ========================================
     FORÇAS RELATIVAS
  ======================================== */

  const homeAttackStrength =
    safePower(
      homeAttackRaw /
        homeAttackReference,
      ATTACK_ELASTICITY
    );

  const awayAttackStrength =
    safePower(
      awayAttackRaw /
        awayAttackReference,
      ATTACK_ELASTICITY
    );

  const homeDefensiveFragility =
    safePower(
      homeDefenseRaw /
        homeDefenseReference,
      DEFENSE_ELASTICITY
    );

  const awayDefensiveFragility =
    safePower(
      awayDefenseRaw /
        awayDefenseReference,
      DEFENSE_ELASTICITY
    );

  const homeDominanceFactor =
    calculateDominanceFactor(
      homeAttackStrength,
      awayAttackStrength,
      awayDefensiveFragility,
      homeDefensiveFragility
    );

  const awayDominanceFactor =
    calculateDominanceFactor(
      awayAttackStrength,
      homeAttackStrength,
      homeDefensiveFragility,
      awayDefensiveFragility
    );

  /* ========================================
     LAMBDAS ESTRUTURAIS
  ======================================== */

  let lambdaHome =
    leagueBaseHome *
    homeAttackStrength *
    awayDefensiveFragility *
    homeDominanceFactor;

  let lambdaAway =
    leagueBaseAway *
    awayAttackStrength *
    homeDefensiveFragility *
    awayDominanceFactor;

  /* ========================================
     AJUSTE COMPLEMENTAR DA LIGA
  ======================================== */

  lambdaHome *=
    leagueAdjustment;

  lambdaAway *=
    leagueAdjustment;

  /* ========================================
     PROTEÇÕES INDIVIDUAIS
  ======================================== */

  lambdaHome =
    clamp(
      safeNumber(
        lambdaHome,
        leagueBaseHome
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  lambdaAway =
    clamp(
      safeNumber(
        lambdaAway,
        leagueBaseAway
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  /* ========================================
     PROTEÇÃO DO TOTAL
  ======================================== */

  const limited =
    applyUpperTotalLimit(
      lambdaHome,
      lambdaAway,
      leagueBaseHome,
      leagueBaseAway
    );

  lambdaHome =
    clamp(
      safeNumber(
        limited.home,
        leagueBaseHome
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  lambdaAway =
    clamp(
      safeNumber(
        limited.away,
        leagueBaseAway
      ),
      MIN_LAMBDA,
      MAX_LAMBDA
    );

  const totalLambda =
    lambdaHome +
    lambdaAway;

  /* ========================================
     QUALIDADE E WARNINGS
  ======================================== */

  const inputQuality =
    preliminaryInputQuality;

  const sampleReliability =
    calculateSampleReliability(
      homeMatchesPlayed,
      awayMatchesPlayed
    );

  const warnings =
    [
      ...buildWarnings({
        homeMatches:
          homeMatchesResult,

        awayMatches:
          awayMatchesResult,

        homeGoals:
          homeGoalsResult,

        awayGoals:
          awayGoalsResult,

        homeConceded:
          homeConcededResult,

        awayConceded:
          awayConcededResult,

        homeShotsOnTarget:
          homeShotsOnTargetResult,

        awayShotsOnTarget:
          awayShotsOnTargetResult,

        leagueAverageGoals
      }),

      ...(
        homeFalseZeroShotsDetected
          ? [
              "HOME_SHOTS_ZERO_TREATED_AS_MISSING"
            ]
          : []
      ),

      ...(
        awayFalseZeroShotsDetected
          ? [
              "AWAY_SHOTS_ZERO_TREATED_AS_MISSING"
            ]
          : []
      )
    ];

  const usedLeagueFallback =
    homeGoalsResult
      .usedLeagueFallback ||
    awayGoalsResult
      .usedLeagueFallback ||
    homeConcededResult
      .usedLeagueFallback ||
    awayConcededResult
      .usedLeagueFallback;

  /* ========================================
     LOG DE AUDITORIA
  ======================================== */

  if (PIPELINE_DEBUG) {
  console.group(
    "⚽ LAMBDA BUILDER — AUDIT"
  );

console.log(
    "LEAGUE BASES:",
    {
      leagueKey,
      leagueAverageGoals,
      leagueBaseHome,
      leagueBaseAway,
      leagueTeamBase,
      leagueAdjustment
    }
  );

  console.log(
    "LEAGUE RELIABILITY:",
    {
      requested:
        leagueReliability.requestedKey,

      resolved:
        leagueReliability.key,

      resolution:
        leagueReliability.resolution,

      dataReliability:
        leagueReliability.dataReliability,

      usedDefault:
        leagueReliability.usedDefault,

      found:
        leagueReliability.found
    }
  );

  console.log(
    "HOME INPUT RESOLUTION:",
    {
      matches:
        homeMatchesResult,

      goals:
        homeGoalsResult,

      conceded:
        homeConcededResult,

      shotsOnTarget:
        homeShotsOnTargetResult,

      shots:
        homeShotsResult,

      bigChances:
        homeBigChancesResult,

      contextualFactors:
        homeContextualFactors
    }
  );

  console.log(
    "AWAY INPUT RESOLUTION:",
    {
      matches:
        awayMatchesResult,

      goals:
        awayGoalsResult,

      conceded:
        awayConcededResult,

      shotsOnTarget:
        awayShotsOnTargetResult,

      shots:
        awayShotsResult,

      bigChances:
        awayBigChancesResult,

      contextualFactors:
        awayContextualFactors
    }
  );

  console.log(
    "FINAL LAMBDAS:",
    {
      lambdaHome,
      lambdaAway,
      totalLambda,

      homeDominanceFactor,
      awayDominanceFactor
    }
  );

  console.log(
    "INPUT QUALITY:",
    {
      inputQuality,
      sampleReliability,
      usedLeagueFallback,
      warnings
    }
  );

  console.groupEnd();
  }

  /* ========================================
     RESULTADO
  ======================================== */

return {
    lambdaHome:
      roundNumber(
        lambdaHome
      ),

    lambdaAway:
      roundNumber(
        lambdaAway
      ),

    totalLambda:
      roundNumber(
        totalLambda
      ),

    /*
     * Contrato oficial único de confiabilidade
     * de liga. Consumido por ConfidencePipeline
     * e DecisionPipeline sem reconsulta.
     *
     * Não duplicado dentro de `diagnostics` —
     * já está disponível aqui no objeto principal.
     */
    leagueReliability,

    diagnostics: {
      leagueKey,

      leagueName:
        league.name,

      leagueAverageGoals:
        roundNumber(
          leagueAverageGoals
        ),

      leagueBaseHome:
        roundNumber(
          leagueBaseHome
        ),

      leagueBaseAway:
        roundNumber(
          leagueBaseAway
        ),

      leagueTeamBase:
        roundNumber(
          leagueTeamBase
        ),

      leagueAdjustment:
        roundNumber(
          leagueAdjustment
        ),

      /*
       * Qualidade geral da entrada.
       */
      inputQuality:
        roundNumber(
          inputQuality
        ),

      sampleReliability:
        roundNumber(
          sampleReliability
        ),

      usedLeagueFallback,

      warnings,

      /*
       * Amostra.
       */
      homeMatchesPlayed:
        roundNumber(
          homeMatchesPlayed
        ),

      awayMatchesPlayed:
        roundNumber(
          awayMatchesPlayed
        ),

      homeMatchesSource:
        homeMatchesResult.source,

      awayMatchesSource:
        awayMatchesResult.source,

      /*
       * Taxas observadas e suas origens.
       */
      homeGoalsRate:
        roundNumber(
          homeGoalsRate
        ),

      homeGoalsRateSource:
        homeGoalsResult.source,

      awayGoalsRate:
        roundNumber(
          awayGoalsRate
        ),

      awayGoalsRateSource:
        awayGoalsResult.source,

      homeGoalsConcededRate:
        roundNumber(
          homeGoalsConcededRate
        ),

      homeGoalsConcededRateSource:
        homeConcededResult.source,

      awayGoalsConcededRate:
        roundNumber(
          awayGoalsConcededRate
        ),

      awayGoalsConcededRateSource:
        awayConcededResult.source,

      /*
       * Indica se a média foi derivada de totais.
       */
      homeGoalsDerivedFromTotals:
        homeGoalsResult
          .derivedFromTotals,

      awayGoalsDerivedFromTotals:
        awayGoalsResult
          .derivedFromTotals,

      homeConcededDerivedFromTotals:
        homeConcededResult
          .derivedFromTotals,

      awayConcededDerivedFromTotals:
        awayConcededResult
          .derivedFromTotals,

      /*
       * Finalizações.
       */
      homeShotsOnTarget:
        homeShotsOnTargetResult
          .value,

      homeShotsOnTargetSource:
        homeShotsOnTargetResult
          .source,

      awayShotsOnTarget:
        awayShotsOnTargetResult
          .value,

      awayShotsOnTargetSource:
        awayShotsOnTargetResult
          .source,

      homeShots:
        homeShotsResult.value,

      homeShotsSource:
        homeShotsResult.source,

      awayShots:
        awayShotsResult.value,

      awayShotsSource:
        awayShotsResult.source,

      homeBigChances:
        homeBigChancesResult
          .value,

      homeBigChancesSource:
        homeBigChancesResult
          .source,

      awayBigChances:
        awayBigChancesResult
          .value,

      awayBigChancesSource:
        awayBigChancesResult
          .source,

      /*
       * xG proxy.
       */
      homeXG:
        homeXG === null
          ? null
          : roundNumber(
              homeXG
            ),

      awayXG:
        awayXG === null
          ? null
          : roundNumber(
              awayXG
            ),

      homeXGValid:
        homeXGResult.valid,

      awayXGValid:
        awayXGResult.valid,

      homeXGDiagnostics:
        homeXGResult.diagnostics,

      awayXGDiagnostics:
        awayXGResult.diagnostics,

      /*
       * Construção ofensiva e defensiva.
       */
      homeAttackComposite:
        roundNumber(
          homeAttackComposite
        ),

      awayAttackComposite:
        roundNumber(
          awayAttackComposite
        ),

      homeAttackBaseComposite:
        roundNumber(
          homeAttackBaseComposite
        ),

      awayAttackBaseComposite:
        roundNumber(
          awayAttackBaseComposite
        ),

      homeRecentFormFactor:
        roundNumber(
          homeContextualFactors
            .recentFormFactor
        ),

      awayRecentFormFactor:
        roundNumber(
          awayContextualFactors
            .recentFormFactor
        ),

      homeVarianceFactor:
        roundNumber(
          homeContextualFactors
            .varianceFactor
        ),

      awayVarianceFactor:
        roundNumber(
          awayContextualFactors
            .varianceFactor
        ),

      homeShotQualityFactor:
        roundNumber(
          homeContextualFactors
            .shotQualityFactor
        ),

      awayShotQualityFactor:
        roundNumber(
          awayContextualFactors
            .shotQualityFactor
        ),

      homeRecentGoalsPerGame:
        homeContextualFactors
          .recentGoalsPerGame,

      awayRecentGoalsPerGame:
        awayContextualFactors
          .recentGoalsPerGame,

      homeGoalVariance:
        homeContextualFactors
          .goalVariance,

      awayGoalVariance:
        awayContextualFactors
          .goalVariance,

      homeConversionRate:
        homeContextualFactors
          .conversionRate,

      awayConversionRate:
        awayContextualFactors
          .conversionRate,

      homeAttackReference:
        roundNumber(
          homeAttackReference
        ),

      awayAttackReference:
        roundNumber(
          awayAttackReference
        ),

      homeDefenseReference:
        roundNumber(
          homeDefenseReference
        ),

      awayDefenseReference:
        roundNumber(
          awayDefenseReference
        ),

      homeAttackUsesTrueVenueSplit:
        isTrueVenueAttackSource(
          homeGoalsResult.source
        ),

      awayAttackUsesTrueVenueSplit:
        isTrueVenueAttackSource(
          awayGoalsResult.source
        ),

      homeDefenseUsesTrueVenueSplit:
        isTrueVenueDefenseSource(
          homeConcededResult.source
        ),

      awayDefenseUsesTrueVenueSplit:
        isTrueVenueDefenseSource(
          awayConcededResult.source
        ),

      homeFalseZeroShotsDetected,

      awayFalseZeroShotsDetected,

      homeShotsUsedByModel:
        homeShotsForModel,

      awayShotsUsedByModel:
        awayShotsForModel,

      homeAttackRaw:
        roundNumber(
          homeAttackRaw
        ),

      awayAttackRaw:
        roundNumber(
          awayAttackRaw
        ),

      homeDefenseRaw:
        roundNumber(
          homeDefenseRaw
        ),

      awayDefenseRaw:
        roundNumber(
          awayDefenseRaw
        ),

      homeAttackStrength:
        roundNumber(
          homeAttackStrength
        ),

      awayAttackStrength:
        roundNumber(
          awayAttackStrength
        ),

      homeDefensiveFragility:
        roundNumber(
          homeDefensiveFragility
        ),

      awayDefensiveFragility:
        roundNumber(
          awayDefensiveFragility
        ),

      homeDominanceFactor:
        roundNumber(
          homeDominanceFactor
        ),

      awayDominanceFactor:
        roundNumber(
          awayDominanceFactor
        ),

      homeAdaptiveShrinkFactor:
        roundNumber(
          calculateAdaptiveShrinkFactor(
            homeMatchesPlayed,
            inputQuality
          )
        ),

      awayAdaptiveShrinkFactor:
        roundNumber(
          calculateAdaptiveShrinkFactor(
            awayMatchesPlayed,
            inputQuality
          )
        ),

      /*
       * Configuração matemática.
       */
      attackElasticity:
        ATTACK_ELASTICITY,

      defenseElasticity:
        DEFENSE_ELASTICITY,

      /*
       * Campo legado mantido para compatibilidade.
       * O shrink efetivo é adaptativo.
       */
      shrinkFactor:
        SHRINK_FACTOR,

      shrinkMode:
        "ADAPTIVE_V7_2",

      goalsWeight:
        GOALS_WEIGHT,

      xgProxyWeight:
        XG_PROXY_WEIGHT,

      shotQualityWeight:
        SHOT_QUALITY_WEIGHT,

      dominanceElasticity:
        DOMINANCE_ELASTICITY,

      recentFormMaxAdjustment:
        RECENT_FORM_MAX_ADJUSTMENT,

      varianceMaxAdjustment:
        VARIANCE_MAX_ADJUSTMENT,

      shotQualityMaxAdjustment:
        SHOT_QUALITY_MAX_ADJUSTMENT,

      minAdaptiveShrink:
        MIN_ADAPTIVE_SHRINK,

      maxAdaptiveShrink:
        MAX_ADAPTIVE_SHRINK,

      minLambda:
        MIN_LAMBDA,

      maxLambda:
        MAX_LAMBDA,

      maxTotalLambda:
        MAX_TOTAL_LAMBDA
    }
  };
}
