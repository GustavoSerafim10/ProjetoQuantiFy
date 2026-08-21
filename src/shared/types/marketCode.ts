/*
 * Fonte única dos 9 códigos de mercado que atravessam a cadeia de
 * decisão ao vivo (probabilityPipeline → valuePipeline →
 * decisionPipeline). Antes desses três arquivos redeclararem, cada
 * um, o mesmo union de forma independente.
 */
export type MarketCode =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";
