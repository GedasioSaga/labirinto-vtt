/**
 * TIPOS DE MÓVEL da mobília desenhada, numa lista só e SEM import nenhum.
 *
 * `types/map.ts` re-exporta `TipoMobilia` daqui e `lib/mobilia.ts` lê a lista
 * daqui: tipo novo entra numa linha deste arquivo, sem disputar
 * `types/map.ts` com quem mais estiver mexendo nele (plano do Meio-Termo,
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, retoque R0).
 * Sem import para não criar ciclo com `types/map.ts`.
 */

/**
 * Todos os tipos que o arquivo do mapa aceita: os 11 de antes e as peças novas
 * dos lotes 1 e 2 do Meio-Termo (fatias MT4 e MT5) e os móveis de casa de 28/10/2026
 * (cozinha, mesa posta, banheiro e sala), registrados em `pecasNovas.ts`. A ordem
 * e a lista que a setinha da ferramenta Objetos oferece moram em
 * `pecasNovas.ts` (`TIPOS_NO_CATALOGO`): peça nova só entra lá com o desenho pronto.
 */
export const TIPOS_MOBILIA = [
  'barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete',
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
  'sebe', 'jardineira', 'arcoDoPortao', 'placaDeSeta', 'tapeteLongo', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao',
] as const

/** Móveis do catálogo da mobília desenhada (`lib/mobilia.ts`). */
export type TipoMobilia = (typeof TIPOS_MOBILIA)[number]
