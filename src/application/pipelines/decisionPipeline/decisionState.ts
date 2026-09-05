import type {
  DecisionClassification
} from "./types";

import type { ExtremeValueClassification } from "../../../domain/analysis/extremeValueDetector";

/* ==========================================
   DECISION STATE — §15 DO ROTEIRO
========================================== */

/*
 * Responsabilidade:
 *
 * - derivar uma camada de estado MAIS informativa (ELITE/BET/
 *   SCALPER/WATCHLIST/REJECT/INVESTIGATE/NO_BET) por cima da
 *   `classification` real, sem alterá-la.
 *
 * Por que camada DERIVADA, e não substituir DecisionClassification
 * de verdade: o roteiro pede pra não aceitar a escala cegamente
 * ("analise se encaixa na arquitetura"). DecisionClassification é
 * usada por getClassificationPriority/capClassification/ordenação/
 * cores de UI em mais de 15 lugares — inserir REJECT/INVESTIGATE
 * como valores reais do enum exigiria redefinir a ordem de
 * prioridade entre 7 estados em vez de 5, e nenhum desses lugares
 * foi desenhado pra isso. Uma camada derivada entrega a mesma
 * informação (o "porquê" mais granular) sem esse risco estrutural.
 *
 * Este arquivo não:
 *
 * - decide classificação, risco ou stake — REJECT/INVESTIGATE
 *   aqui são só rótulos mais precisos para NO BET (ou até para uma
 *   aposta aprovada que ainda assim merece revisão humana);
 * - muda quais mercados entram em operationalBets/best.
 */

export type DecisionState =
  | "ELITE"
  | "SCALPER"
  | "BET"
  | "WATCHLIST"
  | "REJECT"
  | "INVESTIGATE"
  | "NO_BET";

/*
 * Blockers que representam risco/qualidade INVIÁVEL (dado
 * ausente, estrutura inválida, risco acima do teto absoluto) —
 * REJECT, não "só faltou edge". Ver guards.ts para a origem de
 * cada código.
 */
const REJECT_GUARD_CODES = new Set([
  "UNSUPPORTED_MARKET",
  "INVALID_PROBABILITY",
  "INVALID_ODD",
  "INVALID_EV",
  "INVALID_RISK",
  "RISK_ABOVE_GLOBAL_MAXIMUM",
  "INVALID_CONFIDENCE",
  "INVALID_RANKING_SCORE",
  "INVALID_MARKET_STRUCTURE",
  "TRAP_SCORE_ABOVE_MAXIMUM"
]);

/*
 * Discordância de modelo severa o suficiente para justificar
 * investigação mesmo numa aposta já aprovada — mesmo piso que
 * confidenceEngine.ts usa para capar confidence por forte
 * divergência (CONFIDENCE_CAPPED_BY_MODEL_DIVERGENCE), expresso
 * aqui em termos de modelAgreementScore (1 - diff/0.16 = 0 no
 * limiar de divergência forte).
 */
const SEVERE_MODEL_DISAGREEMENT_THRESHOLD = 0.10;

export function deriveDecisionState({
  classification,
  guardBlockers,
  extremeValueClassification,
  modelAgreementScore
}: {
  classification: DecisionClassification;
  guardBlockers: string[];
  extremeValueClassification: ExtremeValueClassification | null;
  modelAgreementScore: number | null;
}): DecisionState {
  const isSuspicious =
    extremeValueClassification === "SUSPICIOUS_VALUE";

  const hasSevereModelDisagreement =
    modelAgreementScore !== null &&
    modelAgreementScore <= SEVERE_MODEL_DISAGREEMENT_THRESHOLD;

  const warrantsInvestigation =
    isSuspicious ||
    hasSevereModelDisagreement;

  if (classification !== "NO BET") {
    if (warrantsInvestigation) {
      return "INVESTIGATE";
    }

    return classification;
  }

  if (
    guardBlockers.some(code => REJECT_GUARD_CODES.has(code))
  ) {
    return "REJECT";
  }

  if (warrantsInvestigation) {
    return "INVESTIGATE";
  }

  return "NO_BET";
}
