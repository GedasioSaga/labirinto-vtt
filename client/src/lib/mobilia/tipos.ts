/**
 * TIPOS DE MÓVEL da mobília desenhada, numa lista só e SEM import nenhum.
 *
 * `types/map.ts` re-exporta `TipoMobilia` daqui e `lib/mobilia.ts` lê a lista
 * daqui: tipo novo entra numa linha deste arquivo, sem disputar
 * `types/map.ts` com quem mais estiver mexendo nele (plano do Meio-Termo,
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, retoque R0).
 * Sem import para não criar ciclo com `types/map.ts`.
 */

/** Ordem em que a setinha da ferramenta Objetos oferece os móveis. */
export const TIPOS_MOBILIA = ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete'] as const

/** Móveis do catálogo da mobília desenhada (`lib/mobilia.ts`). */
export type TipoMobilia = (typeof TIPOS_MOBILIA)[number]
