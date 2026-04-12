export function edgePipeline(data: any) {
  const confidence = data.confidence ?? 0.5;

  const markets = data.markets.map((m: any) => {

    const evComponent =
      m.ev * 0.50;

    const probabilityComponent =
      m.probability * 0.25;

    const confidenceComponent =
      confidence * 0.15;

    const riskPenalty =
      Math.pow(m.risk, 1.35) * 0.40;

    const edgeScore =
      evComponent +
      probabilityComponent +
      confidenceComponent -
      riskPenalty;

    return {
      ...m,
      confidence,
      edgeScore
    };
  });

  return {
    ...data,
    markets
  };
}