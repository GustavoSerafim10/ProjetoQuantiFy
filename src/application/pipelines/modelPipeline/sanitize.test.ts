import { describe, expect, it } from "vitest";

import { sanitizeStats } from "./sanitize";

describe("sanitizeStats — cornersAvg ausente", () => {
  it("nao inclui cornersAvg quando o dado nunca foi informado (regressao: 0 forcado escondia a ausencia)", () => {
    const result = sanitizeStats(
      {
        matches: 23,
        goalsFor: 27,
        goalsAgainst: 27
      },
      "HOME"
    );

    expect(result.cornersAvg).toBeUndefined();
    expect(result.sources.cornersAvg).toBe("missing");
  });

  it("inclui cornersAvg quando informado, mesmo que zero", () => {
    const result = sanitizeStats(
      {
        matches: 23,
        goalsFor: 27,
        goalsAgainst: 27,
        cornersAvg: 0
      },
      "HOME"
    );

    expect(result.cornersAvg).toBe(0);
    expect(result.sources.cornersAvg).toBe("cornersAvg");
  });
});
