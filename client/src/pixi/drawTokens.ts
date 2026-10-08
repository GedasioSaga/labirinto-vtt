import { Graphics } from 'pixi.js'
import { SELECTION_COLOR } from './constants'
import { TOKEN_COLOR_DEFAULT } from '../lib/tokenColor'

/**
 * Raio do círculo genérico de um token de `size` casas: meia célula menos a
 * folga do contorno, para o traço de 2 px não passar da casa. Exportado para
 * o fantasma da ficha de teste (`fantasmaDeTeste.ts`) sair do mesmo tamanho
 * da ficha de verdade.
 */
export function tokenCircleRadius(gridSize: number, size: number): number {
  return (gridSize * size) / 2 - 2
}

/**
 * Desenha o círculo genérico de um token sem imagem (`Token.image === null`)
 * — preenchimento chapado, contorno mais grosso e amarelo quando selecionado.
 * Função pura: só escreve no `graphics` recebido, que já `clear()`a antes de
 * desenhar; não cria, posiciona nem destrói nada. O caller (tokensRenderer.ts)
 * é dono do ciclo de vida do Graphics e do posicionamento (via
 * wrapper.position) — este módulo não sabe onde o token fica no mapa, só como
 * ele se parece.
 *
 * `fillColor` omitido é a cor de fábrica: chamada antiga, e token sem `color`,
 * saem exatamente como antes deste parâmetro existir.
 */
export function drawTokenCircle(graphics: Graphics, radius: number, selected: boolean, fillColor: number = TOKEN_COLOR_DEFAULT): void {
  graphics
    .clear()
    .circle(0, 0, radius)
    .fill({ color: fillColor })
    .stroke({ width: selected ? 4 : 2, color: selected ? SELECTION_COLOR : 0x1a1a1a })
}
