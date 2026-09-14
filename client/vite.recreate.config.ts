import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

/**
 * Servidor só do harness de recriação: porta própria e SEM watch/HMR. Cada
 * edição em `src/` durante uma rodada recarregava a página no meio da
 * medição ("Execution context was destroyed"); aqui o código fica congelado
 * no que estava quando o servidor subiu.
 */
export default mergeConfig(
  base,
  defineConfig({
    server: { port: 1422, strictPort: true, hmr: false, watch: null },
  }),
)
