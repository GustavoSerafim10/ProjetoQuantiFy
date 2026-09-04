/*
 * Liga os console.group/console.log de auditoria espalhados pelo
 * pipeline (lambdaBuilder, modelPipeline). Desligado por padrão:
 * esses logs disparavam incondicionalmente em toda
 * análise (produção) e em toda partida de um backtest sintético,
 * inundando o console e derrubando a performance de sweeps de
 * calibração (2500 partidas geravam dezenas de MB de log). Ativar
 * manualmente aqui só quando for depurar o cálculo de lambda.
 */
export const PIPELINE_DEBUG = false;
