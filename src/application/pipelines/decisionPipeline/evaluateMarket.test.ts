import { describe, expect, it } from "vitest";

import { evaluateMarket } from "./evaluateMarket";
import { buildDecisionContextMetrics } from "./context";

/*
 * Fase 4 do Decision Intelligence Layer foi implementada e testada
 * via runBacktest (2026-09-04): usar effectiveProbability para
 * reclassificar o mercado (em vez de só diagnosticar) piorou o ROI
 * agregado em duas amostras determinísticas — ver comentário em
 * operationalPolicy.ts. A decisão foi reverter a aplicação real,
 * mantendo uncertaintyClassification só como diagnóstico.
 *
 * Este teste protege exatamente essa decisão: garante que uma
 * incerteza alta o suficiente para derrubar a classificação
 * "efetiva" para NO BET não muda `classification`/`stake` reais,
 * mesmo sinalizando o diagnóstico corretamente.
 */
describe("evaluateMarket — uncertainty é diagnóstico, não decisão (fase 4 revertida)", () => {
  it("incerteza alta rebaixaria a classificação efetiva, mas não altera a classificação real", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = {
      market: "DOUBLE_CHANCE_X2",

      probability: 0.58,
      odd: 1.9,
      ev: 0.10,
      probabilityEdge: 0.05,

      risk: 0.3,
      confidence: 0.60,

      rankingScore: 0.6,
      rankingValid: true,

      /*
       * Valores escolhidos deliberadamente ACIMA dos cortes
       * binários que operationalPolicy.ts ainda usa (<0.50,
       * <0.50, <0.45) — os gates reais não disparam — mas ainda
       * baixos o suficiente, combinados com modelAgreementScore
       * ruim, para que o desconto contínuo de
       * calculateUncertaintyAdjustment derrube effectiveProbability
       * abaixo do minimumProbability do tier. É exatamente o tipo
       * de caso de fronteira que o mecanismo binário não captura.
       */
      debug: {
        confidencePipeline: {
          sampleReliability: 0.51,
          leagueTrust: 0.51,
          globalConfidence: 0.46,
          engine: {
            modelAgreementScore: 0
          }
        }
      }
    };

    const result = evaluateMarket(
      market,
      0,
      {},
      decisionContext
    );

    // Confirma que o cenário realmente cria a divergência esperada.
    expect(result.baseClassification).toBe("BET");
    expect(result.uncertaintyClassification).toBe("NO BET");
    expect(result.uncertaintyDowngraded).toBe(true);

    // A decisão real não deve ter sido afetada pelo diagnóstico.
    expect(result.classification).toBe("BET");
    expect(result.stake).toBeGreaterThan(0);

    expect(result.warnings).toContain(
      "UNCERTAINTY_DIAGNOSTIC_WOULD_DOWNGRADE"
    );
  });

  it("sem sinais de incerteza disponíveis, uncertaintyClassification é igual à base", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = {
      market: "DOUBLE_CHANCE_X2",

      probability: 0.58,
      odd: 1.9,
      ev: 0.10,
      probabilityEdge: 0.05,

      risk: 0.3,
      confidence: 0.60,

      rankingScore: 0.6,
      rankingValid: true
    };

    const result = evaluateMarket(
      market,
      0,
      {},
      decisionContext
    );

    expect(result.uncertaintyClassification).toBe(
      result.baseClassification
    );
    expect(result.uncertaintyDowngraded).toBe(false);
    expect(result.classification).toBe(result.baseClassification);
  });
});

/*
 * §22 do roteiro, item 3: "EV extremo + inconsistência =
 * INVESTIGATE". Aqui através da função real (não só
 * deriveDecisionState isolado em decisionState.test.ts) — confirma
 * que extremeValueDetector + deriveDecisionState estão de fato
 * ligados dentro de evaluateMarket.
 */
describe("evaluateMarket — EV suspeito vira INVESTIGATE (§7/§15)", () => {
  it("EV absurdamente alto marca decisionState como INVESTIGATE mesmo aprovado", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = {
      market: "DOUBLE_CHANCE_X2",

      probability: 0.60,
      odd: 4.5,
      // probability*odd - 1 = 1.7 -> SUSPICIOUS_VALUE
      ev: 1.7,
      probabilityEdge: 0.30,

      risk: 0.3,
      confidence: 0.60,

      rankingScore: 0.6,
      rankingValid: true
    };

    const result = evaluateMarket(
      market,
      0,
      {},
      decisionContext
    );

    expect(result.extremeValueClassification).toBe(
      "SUSPICIOUS_VALUE"
    );
    expect(result.decisionState).toBe("INVESTIGATE");
    expect(result.explain?.decisionWarnings).toContain(
      "SUSPICIOUS_VALUE_FLAG"
    );
  });
});

/*
 * §22 do roteiro, item 6: "under/BTTS coerentes = consensus sem
 * double counting". Aqui através da função real, usando
 * data.markets (os outros mercados JÁ avaliados do mesmo jogo) —
 * confirma que marketFamily.ts está de fato ligado dentro de
 * evaluateMarket, não só testável isoladamente.
 */
describe("evaluateMarket — family consensus através de data.markets (§9)", () => {
  it("BTTS_NO reconhece UNDER_2_5 do mesmo jogo como confirmação, sem somar EV", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const bttsNo = {
      market: "BTTS_NO",
      probability: 0.65,
      odd: 1.8,
      ev: 0.17,
      probabilityEdge: 0.10,
      risk: 0.3,
      confidence: 0.6,
      rankingScore: 0.6,
      rankingValid: true
    };

    const under25 = {
      market: "UNDER_2_5",
      probability: 0.62,
      odd: 1.7,
      ev: 0.05,
      probabilityEdge: 0.04,
      risk: 0.3,
      confidence: 0.55,
      rankingScore: 0.5,
      rankingValid: true
    };

    const data = {
      markets: [bttsNo, under25]
    };

    const result = evaluateMarket(
      bttsNo,
      0,
      data,
      decisionContext
    );

    expect(result.familyConsensus?.direction).toBe(
      "LOW_SCORING"
    );
    expect(result.familyConsensus?.confirmingMarkets).toEqual(
      ["UNDER_2_5"]
    );

    // Narrativo — o EV do BTTS_NO continua sendo só o dele.
    expect(result.ev).toBe(0.17);
  });
});

/*
 * §22 do roteiro, itens 9 e 8: "amostra muito pequena = decision
 * penalty" e "league fallback = penalty". Estes gates
 * (operationalPolicy.ts) são ANTERIORES ao Decision Intelligence
 * Layer construído nesta sessão — não foram criados agora, mas
 * nunca tinham teste de integração neste nível. Fechando aqui
 * porque o roteiro pede explicitamente essa cobertura.
 */
describe("evaluateMarket — gates pré-existentes de qualidade de dado (§22.8, §22.9)", () => {
  function buildBaseMarket(overrides: Record<string, unknown> = {}) {
    return {
      market: "DOUBLE_CHANCE_X2",

      probability: 0.65,
      odd: 1.9,
      ev: 0.15,
      probabilityEdge: 0.08,

      risk: 0.3,
      confidence: 0.60,

      rankingScore: 0.6,
      rankingValid: true,

      ...overrides
    };
  }

  it("amostra muito pequena (sampleReliability baixa) nunca passa de WATCHLIST", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = buildBaseMarket({
      debug: {
        confidencePipeline: {
          sampleReliability: 0.2,
          leagueTrust: 0.9,
          globalConfidence: 0.8
        }
      }
    });

    const result = evaluateMarket(market, 0, {}, decisionContext);

    expect(result.baseClassification).not.toBe("NO BET");
    expect(result.classification).toBe("WATCHLIST");
    expect(result.operationalReasons).toContain(
      "LOW_SAMPLE_RELIABILITY"
    );
  });

  it("liga com fallback (baixa confiança de liga) nunca passa de WATCHLIST", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = buildBaseMarket({
      debug: {
        confidencePipeline: {
          sampleReliability: 0.9,
          leagueTrust: 0.3,
          globalConfidence: 0.8
        }
      }
    });

    const result = evaluateMarket(market, 0, {}, decisionContext);

    expect(result.baseClassification).not.toBe("NO BET");
    expect(result.classification).toBe("WATCHLIST");
    expect(result.operationalReasons).toContain("LOW_LEAGUE_TRUST");
  });
});

/*
 * §22 do roteiro, itens 10 e 11: "probabilidade alta sem value =
 * NO BET" e "value alto com risco extremo = NO BET". Guards.ts
 * também é anterior a esta sessão — fechando a mesma lacuna de
 * cobertura de integração.
 */
describe("evaluateMarket — guards estruturais pré-existentes (§22.10, §22.11)", () => {
  it("probabilidade alta sem EV positivo é bloqueada (NON_POSITIVE_EV)", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = {
      market: "HOME",

      probability: 0.85,
      odd: 1.15,
      // probability*odd - 1 < 0 apesar da probabilidade alta.
      ev: -0.02,
      probabilityEdge: -0.01,

      risk: 0.3,
      confidence: 0.6,

      rankingScore: 0.5,
      rankingValid: true
    };

    const result = evaluateMarket(market, 0, {}, decisionContext);

    expect(result.classification).toBe("NO BET");
    expect(result.decisionBlockers).toContain("NON_POSITIVE_EV");
  });

  it("EV/probabilidade positivos mas risco acima do teto global são bloqueados (RISK_ABOVE_GLOBAL_MAXIMUM)", () => {
    const decisionContext = buildDecisionContextMetrics({});

    const market = {
      market: "OVER_2_5",

      probability: 0.55,
      odd: 2.2,
      ev: 0.21,
      probabilityEdge: 0.09,

      // Acima de GLOBAL_POLICY.hardMaximumRisk (0.78).
      risk: 0.95,
      confidence: 0.6,

      rankingScore: 0.5,
      rankingValid: true
    };

    const result = evaluateMarket(market, 0, {}, decisionContext);

    expect(result.classification).toBe("NO BET");
    expect(result.decisionBlockers).toContain(
      "RISK_ABOVE_GLOBAL_MAXIMUM"
    );
  });
});
