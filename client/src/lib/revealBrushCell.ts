/**
 * Lado da célula do pincel de revelar, em px de mundo. Faz parte do formato do
 * arquivo: mudar invalida o que já foi pintado.
 *
 * Mora num módulo sem nenhum import de propósito: `fogFilter.ts` calcula
 * constantes de topo a partir dele, e no bundle de produção o ciclo de imports
 * de `concealBrush.ts` fazia o `fogFilter` rodar antes dele (tela branca da
 * 0.4.0: "Cannot access 'Ye' before initialization"). Módulo folha nunca entra
 * num ciclo, então sempre inicializa antes de quem o importa.
 */
export const REVEAL_BRUSH_CELL = 10
