import type { Renderer } from 'pixi.js'

/**
 * TERRENO ALTO (muralha, 14/11/2026) — o `multiply` que não tampa o fundo transparente.
 *
 * A tela de quem está no alto tem fundo transparente: por trás dela fica a
 * vista do piso de baixo (a outra `PlayerView`, outro canvas). O `multiply` do
 * Pixi 8 em WebGL faz a cor com (DST_COLOR, ONE_MINUS_SRC_ALPHA), mas o alfa com
 * (ONE, ONE_MINUS_SRC_ALPHA): num pixel transparente a cor sai 0 e o alfa sai 1,
 * um PRETO OPACO. A penumbra (`mapaDePenumbra.ts`), o mapa de luz e o chão
 * molhado só escurecem em multiply, então tampavam a vista de baixo inteira onde
 * o jogador enxerga (prova de 14/11: cor (17,17,17) com as duas telas e só com a
 * de cima, (81,61,53) só com a de baixo).
 *
 * Aqui, só no renderer da tela de cima: a parte do alfa vira (ZERO, ONE), isto
 * é, o alfa do destino fica como estava. Sobre pixel opaco a conta é a mesma do
 * Pixi (alfa 1 continua 1); sobre o transparente nada se pinta e a vista de
 * baixo aparece. A cor continua a do Pixi.
 */

type MapaDeBlend = Record<string, number[] | undefined>

/** O `multiply` do Pixi, por mapa de blend (o Pixi refaz o mapa quando o contexto volta). */
const originais = new WeakMap<MapaDeBlend, number[]>()

/** `transparente`: a tela de cima, com a vista do piso de baixo por trás. Falso devolve o `multiply` do Pixi. */
export function multiplySemTamparOFundo(renderer: Renderer, transparente: boolean): void {
  if (!('gl' in renderer)) return
  const { gl, state } = renderer
  // `blendModesMap` é `protected` nos tipos do Pixi 8, e é só nele que a conta do blend mora.
  const mapa = (state as unknown as { blendModesMap?: MapaDeBlend }).blendModesMap
  const atual = mapa?.multiply
  if (mapa === undefined || atual === undefined) return
  const original = originais.get(mapa) ?? atual
  originais.set(mapa, original)
  mapa.multiply = transparente ? [original[0], original[1], gl.ZERO, gl.ONE] : original
  // O Pixi só refaz o `blendFunc` quando o modo MUDA: passando pelo normal, o próximo multiply já usa a conta nova.
  state.setBlendMode('normal')
}
