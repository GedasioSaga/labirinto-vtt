import { Graphics } from 'pixi.js'
import { SELECTION_COLOR } from './constants'
import { TOKEN_COLOR_DEFAULT } from '../lib/tokenColor'

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
