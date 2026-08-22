/*
 * Cada estágio do pipeline recebe o payload produzido pelo estágio
 * anterior e só lê um subconjunto dos campos - por isso este tipo
 * permanece um "saco" permissivo em vez de modelar a forma completa.
 * Substitui `any`/`any[]` nos parâmetros de entrada dos pipelines
 * sem alterar o comportamento de acesso dinâmico às propriedades.
 */
export interface PipelineRecord {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
