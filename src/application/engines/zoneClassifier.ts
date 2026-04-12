export type OperationZone =
  | "GREEN"
  | "YELLOW"
  | "RED";

interface ZoneInput {
  expectedValue: number;
  riskScore: number;
  kelly: number;
  probability: number; // ✅ NOVO
}
export function classifyZone({
  expectedValue,
  riskScore,
  kelly,
  probability
}: ZoneInput): OperationZone {

// 🟢 ZONA PREMIUM (alta confiança)
// GREEN
if (
  expectedValue >= 0.05 &&   // menor EV (mais realista)
  riskScore <= 0.50 &&      // risco mais baixo
  kelly >= 0.02 &&          // stake relevante
  probability >= 0.55       // 🔥 NOVO: probabilidade mínima
) {
  return "GREEN";
}

// 🟡 ZONA AMARELA (entrada moderada)
if (
  expectedValue >= 0.03 &&
  riskScore <= 0.60 &&
  kelly > 0
) {
  return "YELLOW";
}

  // 🔴 RED (sem vantagem clara)
  return "RED";
}