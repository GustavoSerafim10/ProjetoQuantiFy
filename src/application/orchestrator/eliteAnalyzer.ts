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
   ENTRADA
========================================== */

/*
 * Contrato mínimo que este orquestrador realmente lê
 * diretamente (`odds`, `match`). O restante do payload
 * (homeStats/awayStats/league/etc.) atravessa intacto até
 * contextPipeline, que ainda não é tipado.
 */
export interface EliteAnalyzerInput {
  odds?: Record<string, number>;

  match?:
    | string
    | {
        home?: string;
        away?: string;
        league?: string;
      };

  [key: string]: unknown;
}

/* ==========================================
   PIPELINE PRINCIPAL
========================================== */

export function eliteAnalyzer(
  input: EliteAnalyzerInput
) {
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
  match: EliteAnalyzerInput["match"]
): string {
  if (typeof match === "string") {
    return (
      match.trim() ||
      "Partida não identificada"
    );
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
  simulation: object
) {
  const record =
    simulation as
      Record<string, unknown>;

  const debug =
    record.debug as
      Record<string, unknown> |
      undefined;

  const simulationPipelineDebug =
    debug?.simulationPipeline as
      Record<string, unknown> |
      undefined;

  const candidates = [
    record.monteCarlo,
    record.simulation,
    record.monteCarloResult,
    simulationPipelineDebug
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