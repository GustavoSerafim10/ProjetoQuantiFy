import { describe, expect, it } from "vitest";

import { detectExtremeValue } from "./extremeValueDetector";

describe("detectExtremeValue", () => {
  it("classifica EV dentro do normal (<=0.25) como NORMAL_VALUE", () => {
    expect(detectExtremeValue({ ev: 0.10 }).classification).toBe(
      "NORMAL_VALUE"
    );
    expect(detectExtremeValue({ ev: 0.25 }).classification).toBe(
      "NORMAL_VALUE"
    );
  });

  it("classifica EV moderadamente alto como STRONG_VALUE", () => {
    expect(detectExtremeValue({ ev: 0.35 }).classification).toBe(
      "STRONG_VALUE"
    );
  });

  it("classifica EV muito alto como EXTREME_VALUE e emite aviso", () => {
    const result = detectExtremeValue({ ev: 0.70 });

    expect(result.classification).toBe("EXTREME_VALUE");
    expect(result.warnings).toContain(
      "EXTREME_VALUE_REQUIRES_ADDITIONAL_EVIDENCE"
    );
  });

  it("classifica EV absurdo como SUSPICIOUS_VALUE e emite aviso", () => {
    const result = detectExtremeValue({ ev: 1.5 });

    expect(result.classification).toBe("SUSPICIOUS_VALUE");
    expect(result.warnings).toContain(
      "SUSPICIOUS_VALUE_LIKELY_INPUT_OR_MODEL_ERROR"
    );
  });

  it("EV negativo ou zero é NORMAL_VALUE (guards já tratam EV não positivo)", () => {
    expect(detectExtremeValue({ ev: -0.05 }).classification).toBe(
      "NORMAL_VALUE"
    );
    expect(detectExtremeValue({ ev: 0 }).classification).toBe(
      "NORMAL_VALUE"
    );
  });

  it("escalona uma vez quando o mesmo EV vem de um favorito claro (probability alta)", () => {
    const underdog = detectExtremeValue({
      ev: 0.35,
      probability: 0.30
    });

    const favorite = detectExtremeValue({
      ev: 0.35,
      probability: 0.70
    });

    expect(underdog.classification).toBe("STRONG_VALUE");
    expect(underdog.escalatedByHighProbability).toBe(false);

    expect(favorite.classification).toBe("EXTREME_VALUE");
    expect(favorite.escalatedByHighProbability).toBe(true);
  });

  it("nunca desescala — só usa a probabilidade para aumentar a exigência", () => {
    // NORMAL_VALUE nunca escalona, mesmo com favorito claro.
    const result = detectExtremeValue({
      ev: 0.10,
      probability: 0.90
    });

    expect(result.classification).toBe("NORMAL_VALUE");
    expect(result.escalatedByHighProbability).toBe(false);
  });

  it("EV inválido retorna resultado inválido sem lançar exceção", () => {
    const result = detectExtremeValue({ ev: null });

    expect(result.valid).toBe(false);
    expect(result.classification).toBeNull();
  });
});
