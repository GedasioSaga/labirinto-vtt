import type { Drawing } from '../types/map'

/**
 * PINCEL POR BAIXO DA SALA (pedido de 08/10/2026): "eu quero que o pincel ele
 * sempre fique abaixo de paredes e salas, no caso ele pode pintar o cômodo da
 * sala porém ele fica embaixo das paredes [...] eu quero poder selecionar a
 * parede como prioridade".
 *
 * Vale para tudo que nasce do botão Desenho — Pincel (traço livre e pintura do
 * balde), Linha, Curva, Círculo, Elipse, Retângulo e Polígono. Esses desenhos:
 * - na TELA ficam entre o fundo da sala e a borda dela, sempre sob paredes,
 *   portas e escadas (`pixi/PixiCanvas.tsx`, `player/PlayerView.tsx`);
 * - no CLIQUE perdem para parede e escada e ganham da sala
 *   (`lib/selectionHitTest.ts`, `findSelectableAt`).
 *
 * Ficam DE FORA, como estavam (por cima da sala, ganhando o clique da parede):
 * - o Texto, que é botão próprio (T) e precisa ser lido por cima da planta;
 * - o Caminho (`kind: 'path'`), que nasce da ferramenta Caminho, colada no
 *   Chão e fora do grupo Desenho (`components/labels.ts`, `TOOLBAR_SLOTS`).
 *
 * Um lugar só para a regra: a tela e o clique precisam concordar, senão a
 * parede aparece por cima e o clique continua pegando a tinta.
 */
export function desenhoFicaSobAsSalas(drawing: Drawing): boolean {
  return drawing.kind !== 'text' && drawing.kind !== 'path'
}
