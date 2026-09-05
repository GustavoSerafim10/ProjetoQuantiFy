import { describe, expect, it } from "vitest";

import { applyCorrelationAdjustments } from "./correlationEngine";

/*
 * Fase 6 do Decision Intelligence Layer (2026-09-04):
 * correlationEngine.ts passou a MEDIR correlação real via
 * coeficiente phi sobre a matriz de placares conjunta (mesma
 * matriz Poisson + Dixon-Coles de goalMatrix.ts). Isso foi
 * implementado e testado via runBacktest determinístico feito
 * para de verdade alimentar riskPipeline/correlation.ts
 * (addCorrelationComponent), que já existia pronto para consumir
 * isso mas sempre recebia zero.
 *
 * Resultado: ROI agregado ficou PIOR que o baseline nas duas
 * amostras testadas (2500 e 5000 partidas) — mesmo veredito da
 * fase 4 (edge dinâmico). Por isso correlationPenalty/
 * correlationNet REAIS (os que riskPipeline efetivamente lê)
 * permanecem 0, como sempre foram. A medição de redundância
 * continua visível em correlationPenaltyDiagnostic/
 * maxPositivePhi/mostRedundantWith, para auditoria e para uma
 * eventual segunda tentativa com dados reais.
 */
describe("applyCorrelationAdjustments — redundância via phi (diagnóstico)", () => {
  it("mede um par estruturalmente redundante (HOME e 1X quase sempre vencem juntos), mas não aplica penalidade real", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "DOUBLE_CHANCE_1X", ev: 0.08 }
      ],
      { lambdaHome: 1.8, lambdaAway: 0.9 }
    );

    const home = result.find(m => m.market === "HOME");

    // Continua 0 de verdade — riskPipeline lê exatamente estes campos.
    expect(home?.correlationPenalty).toBe(0);
    expect(home?.correlationNet).toBe(0);

    // Mas a medição real fica visível como diagnóstico.
    expect(home?.correlationPenaltyDiagnostic).toBeGreaterThan(0);
    expect(
      home?.debug?.correlationEngine?.mostRedundantWith
    ).toBe("DOUBLE_CHANCE_1X");
    expect(
      home?.debug?.correlationEngine?.maxPositivePhi
    ).toBeGreaterThan(0);
  });

  it("não mede redundância num par mutuamente exclusivo (HOME e AWAY não podem vencer juntos)", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "AWAY", ev: 0.08 }
      ],
      { lambdaHome: 1.4, lambdaAway: 1.3 }
    );

    const home = result.find(m => m.market === "HOME");
    const away = result.find(m => m.market === "AWAY");

    expect(home?.correlationPenaltyDiagnostic).toBe(0);
    expect(away?.correlationPenaltyDiagnostic).toBe(0);
  });

  it("não mede redundância quando o único outro candidato tem EV não positivo", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "DOUBLE_CHANCE_1X", ev: -0.02 }
      ],
      { lambdaHome: 1.8, lambdaAway: 0.9 }
    );

    const home = result.find(m => m.market === "HOME");

    expect(home?.correlationPenaltyDiagnostic).toBe(0);
  });

  it("DNB_HOME/DNB_AWAY ficam fora da checagem (aproximação retirada por inflar phi artificialmente)", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "DNB_HOME", ev: 0.08 }
      ],
      { lambdaHome: 1.8, lambdaAway: 0.9 }
    );

    const home = result.find(m => m.market === "HOME");
    const dnbHome = result.find(m => m.market === "DNB_HOME");

    expect(home?.correlationPenaltyDiagnostic).toBe(0);
    expect(dnbHome?.correlationPenaltyDiagnostic).toBe(0);
  });

  it("o diagnóstico nunca ultrapassaria o teto de penalidade (0.15) mesmo com phi próximo de 1", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "DOUBLE_CHANCE_1X", ev: 0.08 }
      ],
      { lambdaHome: 2.4, lambdaAway: 0.4 }
    );

    const home = result.find(m => m.market === "HOME");

    expect(home?.correlationPenaltyDiagnostic).toBeLessThanOrEqual(0.15);
  });

  it("sem lambdas válidos, fica igual ao comportamento antigo (penalty 0, sem lançar exceção)", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "DOUBLE_CHANCE_1X", ev: 0.08 }
      ],
      { lambdaHome: null, lambdaAway: null }
    );

    for (const market of result) {
      expect(market.correlationPenalty).toBe(0);
      expect(market.correlationNet).toBe(0);
      expect(market.correlationPenaltyDiagnostic).toBe(0);
    }
  });

  it("nunca concede correlationBoost (sem mecanismo de redução de risco)", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "AWAY", ev: 0.08 },
        { market: "OVER_2_5", ev: 0.05 }
      ],
      { lambdaHome: 1.5, lambdaAway: 1.2 }
    );

    for (const market of result) {
      expect(market.correlationBoost).toBe(0);
    }
  });

  it("correlationPenalty/correlationNet reais são sempre 0 (fase 6 não está aplicada)", () => {
    const result = applyCorrelationAdjustments(
      [
        { market: "HOME", ev: 0.10 },
        { market: "DOUBLE_CHANCE_1X", ev: 0.08 },
        { market: "OVER_2_5", ev: 0.05 },
        { market: "BTTS_YES", ev: 0.04 }
      ],
      { lambdaHome: 1.8, lambdaAway: 0.9 }
    );

    for (const market of result) {
      expect(market.correlationPenalty).toBe(0);
      expect(market.correlationNet).toBe(0);
    }
  });
});
