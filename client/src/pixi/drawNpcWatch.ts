import type { Graphics } from 'pixi.js'
import type { MapData, WatchAlert } from '../types/map'
import { visibleTokens } from '../lib/layers'
import { tokenWatchOf, watchConePolygon } from '../lib/npcWatch'
import { visionSegments, type Segment } from '../lib/visibility'
import { CONDITION_INK } from '../lib/tokenConditions'
import { parseHexColor } from '../lib/tokenColor'

/**
 * OLHOS DO GUARDA no Pixi: o CONE que o mestre vê no editor e o BALÃO (?, !)
 * que o jogador vê em cima do guarda. Mesmo idioma do minimapa: forma chapada,
 * contorno fino, nada de brilho nem degradê.
 */

/**
 * Nome (`Container.label`) da camada do balão dentro da ficha do jogador
 * (`player/PlayerView.tsx`). É por ele que o teste acha a camada.
 */
export const WATCH_ALERT_LABEL = 'alerta'

const INK = parseHexColor(CONDITION_INK) ?? 0x1a1a1a
/** "!" viu: vermelho de alarme. "?" desconfia: âmbar. As duas pistas juntas — cor E desenho. */
const ALERT_FILL: Record<WatchAlert, number> = { '!': 0xe8503a, '?': 0xf2c94c }
/** Raio do balão, em fração do raio da ficha, com piso para ficha pequena. */
const ALERT_RADIUS_FRACTION = 0.42
const ALERT_RADIUS_MIN = 6
/** Espessura do contorno e do traço do desenho, em fração do raio do balão. */
const ALERT_OUTLINE_FRACTION = 0.16
const ALERT_GLYPH_FRACTION = 0.2

/**
 * O balão do guarda, sentado na diagonal de cima à DIREITA da ficha — o topo
 * é das pastilhas de condição (`drawTokenConditions.ts`), e as duas marcas
 * precisam ser lidas juntas. Limpa antes de desenhar; `null` deixa vazio.
 */
export function drawWatchAlert(graphics: Graphics, alert: WatchAlert | null, tokenRadius: number): void {
  graphics.clear()
  if (alert === null) return
  const r = Math.max(ALERT_RADIUS_MIN, tokenRadius * ALERT_RADIUS_FRACTION)
  const lean = (tokenRadius + r * 0.35) * Math.SQRT1_2
  const cx = lean
  const cy = -lean
  graphics.circle(cx, cy, r).fill({ color: ALERT_FILL[alert] }).stroke({ width: r * ALERT_OUTLINE_FRACTION, color: INK })
  const width = r * ALERT_GLYPH_FRACTION
  if (alert === '!') {
    graphics.moveTo(cx, cy - r * 0.55).lineTo(cx, cy + r * 0.12).stroke({ width, color: INK, cap: 'round' })
  } else {
    // Gancho do "?": meia-volta por cima e a haste descendo para o centro.
    graphics
      .arc(cx, cy - r * 0.22, r * 0.3, Math.PI, Math.PI * 2.4)
      .lineTo(cx, cy + r * 0.12)
      .stroke({ width, color: INK, cap: 'round', join: 'round' })
  }
  graphics.circle(cx, cy + r * 0.45, width * 0.75).fill({ color: INK })
}

/** Cor do cone no editor: o mesmo âmbar do "?", bem transparente, para não cobrir o mapa. */
const CONE_COLOR = ALERT_FILL['?']
const CONE_FILL_ALPHA = 0.14
const CONE_STROKE_ALPHA = 0.55
const CONE_STROKE_WIDTH = 1

/**
 * Segmentos de visão do último mapa desenhado. O redesenho das fichas roda a
 * cada quadro do arrasto, e o contorno do chão (`visionSegments`) é caro: só
 * recalcula quando paredes ou chão mudam de referência (a store é imutável).
 */
let cached: { walls: MapData['walls']; floor: MapData['floor']; segments: Segment[] } | null = null

function segmentsOf(map: MapData): Segment[] {
  if (cached === null || cached.walls !== map.walls || cached.floor !== map.floor) {
    cached = { walls: map.walls, floor: map.floor, segments: visionSegments(map) }
  }
  return cached.segments
}

/**
 * O cone de cada guarda do mapa, cortado pelas paredes: é o "o que o guarda
 * vê" do mestre. Guarda "Oculto para jogadores" também desenha — o mestre vê
 * tudo —, mas oculto no editor, não: ele tirou o guarda do tabuleiro.
 */
export function drawWatchCones(graphics: Graphics, map: MapData): void {
  graphics.clear()
  const guards = visibleTokens(map.tokens, map.hiddenLayers).flatMap((t) => {
    const watch = t.hidden ? null : tokenWatchOf(t)
    return watch === null ? [] : [{ token: t, watch }]
  })
  if (guards.length === 0) return
  const segments = segmentsOf(map)
  for (const { token, watch } of guards) {
    const cone = watchConePolygon(token, watch, map.grid, segments)
    if (cone.length < 3) continue
    graphics
      .poly(cone, true)
      .fill({ color: CONE_COLOR, alpha: CONE_FILL_ALPHA })
      .stroke({ width: CONE_STROKE_WIDTH, color: CONE_COLOR, alpha: CONE_STROKE_ALPHA })
  }
}
