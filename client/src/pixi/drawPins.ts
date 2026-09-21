import { Container, Graphics, Text } from 'pixi.js'
import type { Pin } from '../types/map'
import { PIN_GLYPH, PIN_HEAD_OFFSET, PIN_HEAD_RADIUS, PIN_HEIGHT, PIN_SYMBOLS, isPinIcon } from '../lib/pins'
import { SELECTION_COLOR } from './constants'

export interface PinsRenderer {
  draw: (container: Container, pins: readonly Pin[], selectedId: string | null) => void
}

/** Latão quente: o pino é chamariz, precisa saltar do chão marrom e do preto da névoa. */
const PIN_FILL = 0xf2c14e
/** Contorno escuro: sem ele a cabeça some contra chão claro. */
const PIN_OUTLINE = 0x1b1208
const PIN_OUTLINE_WIDTH = 2
const SELECTED_RING_WIDTH = 3
/** Folga entre a cabeça e o anel de seleção, em px de mundo. */
const SELECTED_RING_GAP = 3
const GLYPH_COLOR = 0x1b1208
/** O glifo ocupa a cabeça quase inteira: é ele que separa "!" de "?" a distância. */
const GLYPH_FONT_SIZE = PIN_HEAD_RADIUS * 1.7
/**
 * Meia-aresta do quadrado onde o símbolo é desenhado, em px de mundo. `0.64` do
 * raio deixa a forma tocar a borda sem encostar no contorno da cabeça: o
 * símbolo é o que se lê, o aro é só a moldura.
 */
const SYMBOL_RADIUS = PIN_HEAD_RADIUS * 0.64
/** Traço do símbolo: fino como a parede do minimapa, grosso o bastante para não sumir no zoom de fora. */
const SYMBOL_WIDTH = 1.7

/**
 * Pino de ponto de interesse: gota cravada no ponto (a ponta fica EXATAMENTE
 * em `pin.x`/`pin.y`, que é o que o mestre clicou) com o glifo dentro da
 * cabeça. Desenhado por código, como a escada (`drawStairs.ts`) — nada de
 * sprite: o mapa inteiro é vetor e o pino precisa continuar legível em
 * qualquer zoom.
 *
 * Um `Graphics` para todos os pinos e um `Text` por id que NUNCA é destruído
 * durante a sessão: `Text` destruído antes de ser renderizado derruba o Pixi
 * 8.20 em `TexturePool.returnTexture` — mesma regra de `drawRoomNames.ts` e
 * `drawConcealZones.ts`. Pino apagado só fica invisível.
 */
/**
 * Símbolo escolhido dentro da cabeça, a partir da forma normalizada de
 * `lib/pins.ts`. Desenhado no MESMO `Graphics` do pino — um símbolo é traço,
 * não texto, e desenhá-lo aqui evita mais um `Text` por pino (ver o aviso de
 * `TexturePool.returnTexture` no cabeçalho deste arquivo).
 */
function drawSymbol(graphics: Graphics, pin: Pin, headY: number): void {
  if (!isPinIcon(pin.icon)) return
  const shape = PIN_SYMBOLS[pin.icon]
  const px = (n: number) => pin.x + n * SYMBOL_RADIUS
  const py = (n: number) => headY + n * SYMBOL_RADIUS
  const traco = { width: SYMBOL_WIDTH, color: GLYPH_COLOR, cap: 'round', join: 'round' } as const

  for (const stroke of shape.strokes) {
    const [primeiro, ...resto] = stroke.points
    if (primeiro === undefined) continue
    graphics.moveTo(px(primeiro.x), py(primeiro.y))
    for (const ponto of resto) graphics.lineTo(px(ponto.x), py(ponto.y))
    if (stroke.closed === true) graphics.lineTo(px(primeiro.x), py(primeiro.y))
    graphics.stroke(traco)
  }
  for (const ring of shape.rings ?? []) {
    graphics.circle(px(ring.x), py(ring.y), ring.r * SYMBOL_RADIUS).stroke(traco)
  }
  for (const dot of shape.dots ?? []) {
    graphics.circle(px(dot.x), py(dot.y), dot.r * SYMBOL_RADIUS).fill({ color: GLYPH_COLOR })
  }
}

export function createPinsRenderer(): PinsRenderer {
  const graphics = new Graphics()
  const glyphs = new Map<string, Text>()

  function draw(container: Container, pins: readonly Pin[], selectedId: string | null): void {
    if (graphics.parent !== container) container.addChildAt(graphics, 0)
    graphics.clear()

    const ids = new Set(pins.map((p) => p.id))
    for (const [id, glyph] of glyphs) {
      if (!ids.has(id)) glyph.visible = false
    }

    for (const pin of pins) {
      const headY = pin.y - PIN_HEAD_OFFSET
      if (pin.id === selectedId) {
        graphics
          .circle(pin.x, headY, PIN_HEAD_RADIUS + SELECTED_RING_GAP)
          .stroke({ width: SELECTED_RING_WIDTH, color: SELECTION_COLOR })
      }
      // Haste: da ponta cravada até o meio da cabeça, para a gota ler como uma peça só.
      graphics
        .moveTo(pin.x, pin.y)
        .lineTo(pin.x, pin.y - PIN_HEIGHT + PIN_HEAD_RADIUS)
        .stroke({ width: PIN_OUTLINE_WIDTH + 2, color: PIN_OUTLINE, cap: 'round' })
      graphics.circle(pin.x, headY, PIN_HEAD_RADIUS).fill({ color: PIN_FILL }).stroke({ width: PIN_OUTLINE_WIDTH, color: PIN_OUTLINE })

      // Com símbolo escolhido, é ELE que ocupa a cabeça: o glifo sai de cena
      // (invisível, nunca destruído) em vez de dividir o espaço com o desenho.
      const comSimbolo = isPinIcon(pin.icon)
      drawSymbol(graphics, pin, headY)

      let glyph = glyphs.get(pin.id)
      if (!glyph) {
        if (comSimbolo) continue
        glyph = new Text({
          text: PIN_GLYPH[pin.kind],
          style: { fontSize: GLYPH_FONT_SIZE, fontWeight: 'bold', fill: GLYPH_COLOR },
        })
        glyph.anchor.set(0.5)
        glyphs.set(pin.id, glyph)
      }
      if (glyph.parent !== container) container.addChild(glyph)
      glyph.text = PIN_GLYPH[pin.kind]
      glyph.position.set(pin.x, headY)
      glyph.visible = !comSimbolo
    }
  }

  return { draw }
}
