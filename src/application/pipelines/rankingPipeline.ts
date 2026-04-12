export function rankingPipeline(data: any) {
  const markets = data.markets.map((m: any) => {

    const score =
      (m.edgeScore * 0.70) +
      (m.probability * 0.15) +
      ((1 - m.risk) * 0.15);

    return {
      ...m,
      score
    };
  });

  markets.sort((a: any, b: any) => b.score - a.score);

  return {
    ...data,
    markets
  };
}