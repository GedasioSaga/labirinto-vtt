import { Container, Graphics, Text } from 'pixi.js'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { LASER_COLOR, LASER_LABEL, LASER_TRAIL_MS, type LaserTrail } from '../lib/laser'
import type { Camera } from './world'

/**
 * Rastro do laser do mestre em espaço de TELA (container fora do `world`):
 * espessura fixa em qualquer zoom. Cada trecho esmaece pela idade do ponto e
 * a ponta fica acesa enquanto o laser está ligado. Redesenhado a cada quadro
 * pelo ticker, porque o esmaecimento depende do tempo.
 */

const TRAIL_MIN_WIDTH = 2
const TRAIL_MAX_WIDTH = 6
const GLOW_EXTRA_WIDTH = 6
const GLOW_ALPHA = 0.25
const HEAD_RADIUS = 6
const HEAD_CORE_RADIUS = 2.5
const OUTLINE = 0x000000
const LABEL_FONT_SIZE = 13
const LABEL_GAP = 8

/**
 * Vida restante do ponto entre 0 (sumiu) e 1 (acabou de entrar). Raiz em vez
 * de linear: com queda linear o meio do rastro já lia apagado no fundo escuro.
 */
function lifeOf(t: number, now: number): number {
  return Math.sqrt(Math.max(0, 1 - (now - t) / LASER_TRAIL_MS))
}

/**
 * Um Graphics e um Text criados uma vez e nunca destruídos durante a sessão
 * (Text destruído antes do primeiro render derruba o Pixi 8.20, ver PlayerView).
 */
export function createLaserRenderer() {
  let graphics: Graphics | null = null
  let label: Text | null = null

  return {
    /** Desenha o rastro vivo em `now` e devolve quantos pontos apareceram (0 = nada na tela). */
    draw(container: Container, trail: LaserTrail | undefined, camera: Camera, now: number): number {
      if (graphics === null || label === null) {
        graphics = new Graphics()
        label = new Text({
          text: LASER_LABEL,
          style: { fontSize: LABEL_FONT_SIZE, fontWeight: 'bold', fill: LASER_COLOR, stroke: { color: OUTLINE, width: 3 }, fontFamily: DEFAULT_TEXT_FONT_FAMILY },
        })
        label.anchor.set(0.5, 1)
        container.addChild(graphics, label)
      }
      const g = graphics
      g.clear()
      const points = trail?.points ?? []
      const toScreen = (p: { x: number; y: number }) => ({ x: p.x * camera.scale + camera.x, y: p.y * camera.scale + camera.y })

      let drawn = 0
      for (let i = 0; i < points.length; i += 1) {
        const life = lifeOf(points[i].t, now)
        if (life <= 0) continue
        drawn += 1
        if (i === 0) continue
        const a = toScreen(points[i - 1])
        const b = toScreen(points[i])
        const width = TRAIL_MIN_WIDTH + (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH) * life
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: LASER_COLOR, width: width + GLOW_EXTRA_WIDTH, alpha: GLOW_ALPHA * life, cap: 'round' })
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: LASER_COLOR, width, alpha: life, cap: 'round' })
      }

      const last = points.at(-1)
      const on = trail?.on === true
      const headAlpha = last === undefined ? 0 : on ? 1 : lifeOf(last.t, now)
      if (last === undefined || headAlpha <= 0) {
        label.visible = false
        return drawn
      }
      // Ligado e parado: a ponta conta como desenhada mesmo com o rastro já apagado.
      if (on && drawn === 0) drawn = 1
      const head = toScreen(last)
      g.circle(head.x, head.y, HEAD_RADIUS + GLOW_EXTRA_WIDTH / 2).fill({ color: LASER_COLOR, alpha: GLOW_ALPHA * headAlpha })
      g.circle(head.x, head.y, HEAD_RADIUS).fill({ color: LASER_COLOR, alpha: headAlpha }).stroke({ color: OUTLINE, width: 1.5, alpha: headAlpha })
      g.circle(head.x, head.y, HEAD_CORE_RADIUS).fill({ color: 0xffffff, alpha: headAlpha })
      label.visible = true
      label.alpha = headAlpha
      label.position.set(head.x, head.y - HEAD_RADIUS - LABEL_GAP)
      return drawn
    },
  }
}
