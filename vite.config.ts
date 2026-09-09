import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serve o build em /ProjetoQuantiFy/, não na raiz.
  base: command === 'build' ? '/ProjetoQuantiFy/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Padrão do vitest (5s) é curto demais para os testes que rodam
    // a busca em grade determinística de fitMarketImpliedLambda
    // (marketLambda/marketModelPipeline/fusedModelPipeline) quando a
    // suite inteira roda em paralelo e disputa CPU — timeouts
    // observados eram falsos positivos (< 1s cada um rodando sozinho),
    // não regressão de lógica. Timeout global maior evita ter que
    // marcar teste por teste.
    testTimeout: 20000,
  },
}))
