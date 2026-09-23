import { freeAreaCenter, type Bounds, type Camera, type Point, type Viewport } from '../pixi/world'
import type { Token } from '../types/map'

/**
 * Câmera do jogador ao chegar num mapa e ao pedir "Minha ficha".
 *
 * O painel do jogador flutua sobre o canto de cima à esquerda do canvas. O
 * enquadramento do mapa inteiro (`fitCamera`) não sabe dele, e a ficha que
 * nasce na borda esquerda caía DEBAIXO do painel: o jogador entrava sem se ver
 * (régua task-jornada-mapa-livre-do-painel, 23/09/2026).
 *
 * Tudo aqui é conta pura, em px do canvas; quem mede o painel é `coverBounds`.
 */

/** A própria ficha como a câmera enxerga: centro e raio, em px de mundo. */
export interface OwnDisc {
  x: number
  y: number
  radius: number
}

/**
 * A ficha que "Minha ficha" procura: a primeira de `ownTokens` que está neste
 * mapa — a mesma que o painel lista primeiro e que "Centralizar no meu
 * personagem" usa.
 */
export function firstOwnToken(tokens: readonly Token[], ownTokens: readonly string[]): Token | null {
  for (const id of ownTokens) {
    const token = tokens.find((t) => t.id === id)
    if (token) return token
  }
  return null
}

/** Câmera no zoom `scale` com `point` no centro do que os painéis deixam livre. */
export function centeredCamera(scale: number, point: Point, viewport: Viewport, obstacles: readonly Bounds[]): Camera {
  const center = freeAreaCenter(viewport, [...obstacles])
  return { scale, x: center.x - point.x * scale, y: center.y - point.y * scale }
}

function hasArea(b: Bounds): boolean {
  return b.maxX - b.minX > 0 && b.maxY - b.minY > 0
}

/** Disco (em px de tela) encosta no retângulo? Ponto do retângulo mais perto do centro, dentro do raio. */
function discTouchesBox(cx: number, cy: number, r: number, b: Bounds): boolean {
  const nearestX = Math.min(Math.max(cx, b.minX), b.maxX)
  const nearestY = Math.min(Math.max(cy, b.minY), b.maxY)
  return Math.hypot(cx - nearestX, cy - nearestY) < r
}

/**
 * Câmera de CHEGADA (entrar na mesa ou trocar de cena).
 *
 * Mantém o enquadramento do mapa inteiro sempre que ele já mostra a ficha
 * inteira, fora de qualquer painel: é o que a mesa inteira conhece desde o
 * começo, e o que as outras telas do jogador esperam. Só quando esse
 * enquadramento esconderia a ficha — debaixo do painel ou fora da tela (mapa
 * enorme no zoom mínimo) — a câmera vai para ela, no MESMO zoom, centrada na
 * área livre. Sem ficha própria nesta cena, fica o mapa inteiro.
 */
export function arrivalCamera(fitted: Camera, own: OwnDisc | null, viewport: Viewport, obstacles: readonly Bounds[]): Camera {
  if (own === null) return fitted
  const cx = own.x * fitted.scale + fitted.x
  const cy = own.y * fitted.scale + fitted.y
  const r = own.radius * fitted.scale
  const onScreen = cx - r >= 0 && cy - r >= 0 && cx + r <= viewport.width && cy + r <= viewport.height
  const covered = obstacles.some((b) => hasArea(b) && discTouchesBox(cx, cy, r, b))
  if (onScreen && !covered) return fitted
  return centeredCamera(fitted.scale, own, viewport, obstacles)
}

function boundsOf(el: Element | null): Bounds | null {
  if (el === null) return null
  const r = el.getBoundingClientRect()
  const b = { minX: r.left, minY: r.top, maxX: r.right, maxY: r.bottom }
  return hasArea(b) ? b : null
}

/**
 * O que cobre o mapa agora, em px da janela. Com o painel aberto, a barra
 * ("Painel", "Minha ficha") é o cabeçalho dele: a caixa do painel basta, e
 * somar a barra faria `freeAreaCenter` comer a faixa de cima da tela inteira.
 * Recolhido, sobra só a barra no canto.
 */
export function coverBounds(panel: HTMLElement | null, bar: HTMLElement | null): Bounds[] {
  const cover = panel !== null && !panel.hidden ? boundsOf(panel) : boundsOf(bar)
  return cover === null ? [] : [cover]
}
