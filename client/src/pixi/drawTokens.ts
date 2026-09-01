import { Graphics } from 'pixi.js'
import { SELECTION_COLOR } from './constants'

/**
 * Desenha o círculo genérico de um token sem imagem (`Token.image === null`)
 * — mesma aparência de sempre: preenchimento azul, contorno mais grosso e
 * amarelo quando selecionado. Função pura: só escreve no `graphics` recebido,
 * que já `clear()`a antes de desenhar; não cria, posiciona nem destrói nada.
 * O caller (tokensRenderer.ts) é dono do ciclo de vida do Graphics e do
 * posicionamento (via wrapper.position) — este módulo não sabe onde o token
 * fica no mapa, só como ele se parece.
 */
export function drawTokenCircle(graphics: Graphics, radius: number, selected: boolean): void {
  graphics
    .clear()
    .circle(0, 0, radius)
    .fill({ color: 0x5a8fd6 })
    .stroke({ width: selected ? 4 : 2, color: selected ? SELECTION_COLOR : 0x1a1a1a })
}
