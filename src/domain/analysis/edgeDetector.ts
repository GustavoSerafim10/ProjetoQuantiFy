export function detectEdges(statReport: any) {
  const insights: string[] = [];

  const byMarket = statReport.byMarket || {};
  const byOdds = statReport.byOddsRange || {};

  // 📊 MERCADOS
  for (const market in byMarket) {
    const data = byMarket[market];

    if (data.bets < 50) continue;

    if (data.roi > 0.05) {
      insights.push(`🔥 ${market} lucrativo (ROI ${(data.roi * 100).toFixed(1)}%)`);
    }

    if (data.roi < -0.05) {
      insights.push(`❌ ${market} negativo (ROI ${(data.roi * 100).toFixed(1)}%)`);
    }
  }

  // 🎯 ODDS
  for (const range in byOdds) {
    const data = byOdds[range];

    if (data.bets < 50) continue;

    if (data.roi > 0.05) {
      insights.push(`💰 Odds ${range} lucrativas`);
    }

    if (data.roi < -0.05) {
      insights.push(`⚠️ Odds ${range} ruins`);
    }
  }

  return insights;
}