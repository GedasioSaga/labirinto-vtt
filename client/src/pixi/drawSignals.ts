import { Container, Graphics, Text } from 'pixi.js'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { SIGNAL_TTL_MS, type DestinationMark, type SignalMark } from '../lib/signals'
import type { Camera, Point, Viewport } from './world'

/**
 * Sinais dos jogadores desenhados em espaço de TELA (container fora do
 * `world`): ondas com tamanho fixo em qualquer zoom e, quando o ponto está
 * fora do viewport, uma seta presa na borda apontando para ele. Redesenhado
 * a cada quadro pelo ticker, porque a animação depende do tempo.
 */

/** Distância da seta até a borda da tela, em px. */
export const SIGNAL_EDGE_MARGIN = 28
const RING_COUNT = 3
const RING_PERIOD_MS = 1000
const RING_MIN_RADIUS = 6
const RING_MAX_RADIUS = 34
const RING_WIDTH = 3
const DOT_RADIUS = 5
const ARROW_LENGTH = 18
const ARROW_HALF_WIDTH = 10
const OUTLINE = 0x000000
const LABEL_FONT_SIZE = 13
const LABEL_GAP = 6
const FADE_OUT_MS = 800

export interface SignalPlacement {
  x: number
  y: number
  onScreen: boolean
  /** Direção do centro da tela até o ponto (radianos); só vale fora da tela. */
  angle: number
}

/**
 * Posição de desenho do sinal em px de tela. Dentro do viewport é o próprio
 * ponto; fora dele, o cruzamento da reta centro→ponto com o retângulo da tela
 * encolhido por `margin`.
 */
export function placeSignal(point: Point, camera: Camera, viewport: Viewport, margin = SIGNAL_EDGE_MARGIN): SignalPlacement {
  const sx = point.x * camera.scale + camera.x
  const sy = point.y * camera.scale + camera.y
  if (sx >= 0 && sy >= 0 && sx <= viewport.width && sy <= viewport.height) return { x: sx, y: sy, onScreen: true, angle: 0 }
  const cx = viewport.width / 2
  const cy = viewport.height / 2
  const dx = sx - cx
  const dy = sy - cy
  const halfW = Math.max(cx - margin, 0)
  const halfH = Math.max(cy - margin, 0)
  // Fora da tela, |dx| > cx ou |dy| > cy: o menor fator é < 1 e finito.
  const t = Math.min(dx === 0 ? Infinity : halfW / Math.abs(dx), dy === 0 ? Infinity : halfH / Math.abs(dy))
  return { x: cx + dx * t, y: cy + dy * t, onScreen: false, angle: Math.atan2(dy, dx) }
}

interface SignalView {
  graphics: Graphics
  label: Text
}

function paintSignal(view: SignalView, signal: SignalMark, place: SignalPlacement, age: number): void {
  const { graphics: g, label } = view
  // Opaco a maior parte do tempo e só esmaece no fim: com fade linear o sinal já nascia apagado nos tons escuros da paleta.
  const fade = Math.min(1, (SIGNAL_TTL_MS - age) / FADE_OUT_MS)
  g.clear()
  g.visible = true
  label.visible = true
  label.alpha = fade
  if (label.text !== signal.name) label.text = signal.name

  if (place.onScreen) {
    for (let k = 0; k < RING_COUNT; k += 1) {
      const phase = (age / RING_PERIOD_MS + k / RING_COUNT) % 1
      const radius = RING_MIN_RADIUS + phase * (RING_MAX_RADIUS - RING_MIN_RADIUS)
      g.circle(place.x, place.y, radius).stroke({ color: signal.color, width: RING_WIDTH, alpha: (1 - phase) * fade })
    }
    g.circle(place.x, place.y, DOT_RADIUS).fill({ color: signal.color, alpha: fade }).stroke({ color: OUTLINE, width: 1.5, alpha: fade })
    label.position.set(place.x, place.y - RING_MAX_RADIUS / 2 - LABEL_GAP)
    return
  }

  const cos = Math.cos(place.angle)
  const sin = Math.sin(place.angle)
  // Pulso leve na seta: parada na borda ela chamaria menos atenção que as ondas.
  const pulse = 1 + 0.15 * Math.sin((age / RING_PERIOD_MS) * Math.PI * 2)
  const length = ARROW_LENGTH * pulse
  const half = ARROW_HALF_WIDTH * pulse
  const tipX = place.x + cos * length
  const tipY = place.y + sin * length
  g.poly([tipX, tipY, place.x - sin * half, place.y + cos * half, place.x + sin * half, place.y - cos * half], true)
    .fill({ color: signal.color, alpha: fade })
    .stroke({ color: OUTLINE, width: 1.5, alpha: fade })
  // Nome do lado de dentro da tela, atrás da seta.
  label.position.set(place.x - cos * (LABEL_GAP + LABEL_FONT_SIZE), place.y - sin * (LABEL_GAP + LABEL_FONT_SIZE) + LABEL_FONT_SIZE / 2)
}

function createLabel(): Text {
  const label = new Text({
    text: '',
    style: {
      fontSize: LABEL_FONT_SIZE,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: OUTLINE, width: 3 },
      fontFamily: DEFAULT_TEXT_FONT_FAMILY,
    },
  })
  label.anchor.set(0.5, 1)
  return label
}

/** Mastro da bandeirinha "vamos para cá", em px de tela (tamanho fixo em qualquer zoom). */
const FLAG_POLE_HEIGHT = 26
const FLAG_WIDTH = 16
const FLAG_HEIGHT = 11
const FLAG_BASE_RADIUS = 3

/** O que a bandeirinha diz: de quem é, ou "Meu destino" para a própria. */
export function destinationLabel(mark: DestinationMark): string {
  return mark.mine ? 'Meu destino' : `${mark.from}: vamos para cá`
}

/**
 * Bandeirinha "vamos para cá": mastro fino claro, pano na cor da ficha e o
 * nome em cima. Fora da tela, a mesma seta presa na borda do sinal (parada,
 * sem pulso: a marca não pede atenção, só diz onde está).
 */
function paintDestination(view: SignalView, mark: DestinationMark, place: SignalPlacement): void {
  const { graphics: g, label } = view
  g.clear()
  g.visible = true
  label.visible = true
  label.alpha = 1
  const text = destinationLabel(mark)
  if (label.text !== text) label.text = text
  if (place.onScreen) {
    const top = place.y - FLAG_POLE_HEIGHT
    g.moveTo(place.x, place.y).lineTo(place.x, top).stroke({ color: 0xf2efe6, width: 2 })
    g.poly([place.x, top, place.x + FLAG_WIDTH, top + FLAG_HEIGHT / 2, place.x, top + FLAG_HEIGHT], true)
      .fill({ color: mark.color })
      .stroke({ color: OUTLINE, width: 1.5 })
    g.circle(place.x, place.y, FLAG_BASE_RADIUS).fill({ color: mark.color }).stroke({ color: OUTLINE, width: 1.5 })
    label.position.set(place.x, top - LABEL_GAP)
    return
  }
  const cos = Math.cos(place.angle)
  const sin = Math.sin(place.angle)
  const tipX = place.x + cos * ARROW_LENGTH
  const tipY = place.y + sin * ARROW_LENGTH
  g.poly([tipX, tipY, place.x - sin * ARROW_HALF_WIDTH, place.y + cos * ARROW_HALF_WIDTH, place.x + sin * ARROW_HALF_WIDTH, place.y - cos * ARROW_HALF_WIDTH], true)
    .fill({ color: mark.color })
    .stroke({ color: OUTLINE, width: 1.5 })
  label.position.set(place.x - cos * (LABEL_GAP + LABEL_FONT_SIZE), place.y - sin * (LABEL_GAP + LABEL_FONT_SIZE) + LABEL_FONT_SIZE / 2)
}

/**
 * As marcas "vamos para cá", no mesmo espaço de TELA dos sinais. Sem prazo:
 * cada chamada desenha a lista inteira; a view de quem saiu da lista volta ao
 * pool, escondida (mesma regra do pool de sinais). Devolve quantas desenhou.
 */
export function createDestinationsRenderer() {
  const pool: SignalView[] = []
  return {
    draw(container: Container, marks: readonly DestinationMark[], camera: Camera, viewport: Viewport): number {
      marks.forEach((mark, i) => {
        let view = pool[i]
        if (view === undefined) {
          view = { graphics: new Graphics(), label: createLabel() }
          container.addChild(view.graphics, view.label)
          pool.push(view)
        }
        paintDestination(view, mark, placeSignal(mark, camera, viewport))
      })
      for (let i = marks.length; i < pool.length; i += 1) {
        pool[i].graphics.visible = false
        pool[i].label.visible = false
      }
      return marks.length
    },
  }
}

/**
 * Pool de views reaproveitadas por posição, nunca destruídas durante a sessão
 * (Text destruído antes do primeiro render derruba o Pixi 8.20, ver
 * PlayerView). O tamanho do pool é o pico de sinais simultâneos.
 */
export function createSignalsRenderer() {
  const pool: SignalView[] = []
  return {
    /** Desenha os sinais ainda vivos em `now` e devolve quantos foram desenhados. */
    draw(container: Container, signals: readonly SignalMark[], camera: Camera, viewport: Viewport, now: number): number {
      let used = 0
      for (const signal of signals) {
        const age = now - signal.createdAt
        if (age < 0 || age >= SIGNAL_TTL_MS) continue
        let view = pool[used]
        if (view === undefined) {
          view = { graphics: new Graphics(), label: createLabel() }
          container.addChild(view.graphics, view.label)
          pool.push(view)
        }
        used += 1
        paintSignal(view, signal, placeSignal(signal, camera, viewport), age)
      }
      for (let i = used; i < pool.length; i += 1) {
        pool[i].graphics.visible = false
        pool[i].label.visible = false
      }
      return used
    },
  }
}
