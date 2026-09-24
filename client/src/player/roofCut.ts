import type { Graphics } from 'pixi.js'
import type { RegionPoint } from '../types/map'

/**
 * CONE PELO VÃO na tela do jogador: o telhado chapado do prédio (`roofs`) abre
 * SÓ nos retângulos que o host mandou (`glimpses`, `lib/fogFilter.ts`). O
 * recorte é máscara INVERTIDA — pinta-se o cone em `cut` e o telhado deixa de
 * aparecer ali. `Graphics.cut()` não serve: ele falha quando o buraco encosta
 * na borda do polígono, e o cone sempre encosta (começa na janela).
 *
 * Sem cone, o telhado fica sem máscara nenhuma: inteiro, como sempre.
 */
export function applyRoofCut(roofs: Graphics, cut: Graphics, glimpses: readonly RegionPoint[][]): void {
  cut.clear()
  const shapes = glimpses.filter((ring) => ring.length >= 3)
  if (shapes.length === 0) {
    // `setMask({ mask: null })` NÃO tira a máscara (pixi 8.20, effectsMixin:
    // só atribui quando `options.mask` é verdadeiro); a atribuição direta tira.
    if (roofs.mask) roofs.mask = null
    return
  }
  for (const ring of shapes) cut.poly(ring, true)
  cut.fill({ color: 0xffffff, alpha: 1 })
  if (roofs.mask !== cut) roofs.setMask({ mask: cut, inverse: true })
}
