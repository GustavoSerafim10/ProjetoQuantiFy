import {
  contextPipeline
} from "../pipelines/contextPipeline";

import {
  modelPipeline
} from "../pipelines/modelPipeline";

import {
  simulationPipeline
} from "../pipelines/simulationPipeline";

import {
  probabilityPipeline
} from "../pipelines/probabilityPipeline";

import {
  valuePipeline
} from "../pipelines/valuePipeline";

import {
  correlationPipeline
} from "../pipelines/correlationPipeline";

import {
  riskPipeline
} from "../pipelines/riskPipeline";

import {
  confidencePipeline
} from "../pipelines/confidencePipeline";

import {
  rankingPipeline
} from "../pipelines/rankingPipeline";

import {
  decisionPipeline
} from "../pipelines/decisionPipeline";

/* ==========================================
   ELITE ANALYZER — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - orquestrar os pipelines na ordem correta;
 * - garantir que cada estágio receba o resultado
 *   completo do estágio anterior;
 * - preservar diagnósticos para auditoria;
 * - devolver o resultado oficial da decisão.
 *
 * Este arquivo não:
 *
 * - recalcula probabilidades;
 * - recalcula EV;
 * - reconstrói mercados;
 * - altera risco;
 * - escolhe mercados por conta própria.
 */

/* ==========================================
   PIPELINE PRINCIPAL
========================================== */

export function eliteAnalyzer(
  input: any
) {
  console.log(
    "🔥 ELITE ANALYZER EXECUTOU"
  );

  /*
   * 1. Contexto e normalização
   */
  const context =
    contextPipeline(
      input
    );

  /*
   * 2. Modelo analítico
   */
  const model =
    modelPipeline(
      context
    );

  /*
   * 3. Simulação Monte Carlo e comparação
   */
  const simulation =
    simulationPipeline(
      model
    );

  /*
   * 4. Probabilidades oficiais
   */
  const probabilities =
    probabilityPipeline(
      simulation
    );

  /*
   * 5. Valor econômico
   *
   * Aqui nascem:
   *
   * probability
   * impliedProbability
   * fairOdd
   * ev
   * probabilityEdge
   * edge
   */
  const valued =
    valuePipeline(
      probabilities,
      input?.odds ?? {}
    );

  /*
   * 6. Diagnóstico de correlação
   *
   * A correlação precisa vir antes do risco,
   * pois o riskPipeline é o único responsável
   * por consumir correlationNet.
   */
  const correlated =
    correlationPipeline(
      valued
    );

  /*
   * 7. Risco oficial
   */
const risked =
  riskPipeline(
    correlated
  );

const confident =
  confidencePipeline(
    risked
  );

const ranked =
  rankingPipeline(
    confident
  );

  /*
   * 9. Decisão operacional
   */
  const decision =
    decisionPipeline(
      ranked
    );

  /* ==========================================
     DIAGNÓSTICO DE INTEGRAÇÃO
  ========================================== */

  console.log(
    "📊 PIPELINE CHECK:",
    {
      contextMarkets:
        Array.isArray(
          context?.markets
        )
          ? context.markets.length
          : 0,

      modelMarkets:
        Array.isArray(
          model?.markets
        )
          ? model.markets.length
          : 0,

      probabilityValid:
        probabilities
          ?.probabilityValid,

      probabilityMarkets:
        probabilities
          ?.probs,

      valueValid:
        valued?.valueValid,

      valuedMarkets:
        Array.isArray(
          valued?.markets
        )
          ? valued.markets.map(
              (market: any) => ({
                market:
                  market?.market,

                probability:
                  market?.probability,

                odd:
                  market?.odd,

                ev:
                  market?.ev,

                probabilityEdge:
                  market
                    ?.probabilityEdge
              })
            )
          : [],

      correlationValid:
        correlated
          ?.correlationValid,

      riskValid:
        risked?.riskValid,

      rankingValid:
        ranked?.rankingValid,

      decisionValid:
        decision
          ?.decisionValid,

      best:
        decision?.best,

      reason:
        decision?.reason
    }
  );

  /* ==========================================
     RESULTADO
  ========================================== */

  return {
    /*
     * Preservamos os dados consolidados do
     * decisionPipeline.
     */
    ...decision,

    /*
     * Nome da partida em formato adequado à UI.
     */
    match:
      buildMatchName(
        input?.match
      ),

    /*
     * Blocos úteis para auditoria.
     */
    input,

    context,

    model,

    simulation,

    probabilities:
      probabilities?.probs ??
      null,

    monteCarlo:
      extractMonteCarlo(
        simulation
      ),

    /*
     * Compatibilidade com consumidores que ainda
     * procuram topScores. A nova simulação pode
     * não produzir placares exatos.
     */
    topScores:
      Array.isArray(
        simulation?.topScores
      )
        ? simulation.topScores
        : [],

    /*
     * IA desativada por enquanto.
     */
    aiAnalysis:
      null
  };
}

/* ==========================================
   MATCH
========================================== */

function buildMatchName(
  match: any
): string {
  if (
    typeof match === "string" &&
    match.trim()
  ) {
    return match.trim();
  }

  const home =
    String(
      match?.home ??
      ""
    ).trim();

  const away =
    String(
      match?.away ??
      ""
    ).trim();

  if (
    home &&
    away
  ) {
    return `${home} vs ${away}`;
  }

  if (home) {
    return home;
  }

  if (away) {
    return away;
  }

  return "Partida não identificada";
}

/* ==========================================
   MONTE CARLO
========================================== */

function extractMonteCarlo(
  simulation: any
) {
  const candidates = [
    simulation?.monteCarlo,
    simulation?.simulation,
    simulation?.monteCarloResult,
    simulation?.debug
      ?.simulationPipeline
      ?.monteCarlo
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate &&
      typeof candidate === "object"
    ) {
      return candidate;
    }
  }

  return null;
}