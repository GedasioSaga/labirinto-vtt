import { Color, FillGradient, type Graphics } from 'pixi.js'
import type { Light } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { LIGHT_HIT_RADIUS } from '../lib/selectionHitTest'

/** Marcador da origem da luz, em px de TELA (critério 6 do passo 3). */
export const LIGHT_MARKER_SCREEN_RADIUS = 6
const LIGHT_MARKER_OUTLINE_SCREEN_PX = 1.5
const LIGHT_MARKER_OUTLINE_COLOR = 0x1f1b16

/**
 * Paradas do gradiente radial (offset → fração da intensidade). Sem anel duro:
 * o alpha cai de forma contínua até 0 na borda. Blend "normal": "add" estoura
 * para branco sobre o pergaminho e "multiply" escurece.
 */
export const LIGHT_GRADIENT_STOPS: readonly { offset: number; alphaPerIntensity: number }[] = [
  { offset: 0, alphaPerIntensity: 0.35 },
  { offset: 0.6, alphaPerIntensity: 0.12 },
  { offset: 1, alphaPerIntensity: 0 },
]

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/** Chave do cache: 1 FillGradient (1 textura) por cor + intensidade. */
export function lightGradientKey(light: Pick<Light, 'color' | 'intensity'>): string {
  return `${new Color(light.color).toHex()}|${clamp01(light.intensity)}`
}

/** Gradiente em espaço LOCAL (0..1 do contorno do círculo): serve para qualquer raio. */
export function createLightGradient(light: Pick<Light, 'color' | 'intensity'>): FillGradient {
  const [r, g, b] = new Color(light.color).toUint8RgbArray()
  const intensity = clamp01(light.intensity)
  return new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    textureSpace: 'local',
    colorStops: LIGHT_GRADIENT_STOPS.map((stop) => ({ offset: stop.offset, color: { r, g, b, a: intensity * stop.alphaPerIntensity } })),
  })
}

export interface LightsRenderer {
  /** `cameraScale` mantém o marcador com tamanho fixo na tela; redesenhar no zoom. */
  draw: (graphics: Graphics, lights: Light[], selectedLightId?: string | null, cameraScale?: number) => void
  /** Quantos FillGradient estão vivos (para o e2e contar vazamento). */
  liveGradients: () => number
  /** Libera todos os gradientes (desmonte do canvas). */
  destroy: () => void
}

/**
 * Renderer de luzes com cache de FillGradient por cor + intensidade. Cada
 * gradiente cria uma textura (FillGradient.d.ts: "important to destroy"):
 * gradiente que sai de uso é destruído no fim do draw, e `destroy()` limpa
 * tudo no teardown. Instanciar no setup() de cada canvas, nunca em módulo.
 */
export function createLightsRenderer(): LightsRenderer {
  const cache = new Map<string, FillGradient>()

  function draw(graphics: Graphics, lights: Light[], selectedLightId: string | null = null, cameraScale = 1): void {
    graphics.clear()
    const scale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
    const used = new Set<string>()
    for (const light of lights) {
      if (!(light.radius > 0)) continue
      const key = lightGradientKey(light)
      let gradient = cache.get(key)
      if (!gradient) {
        gradient = createLightGradient(light)
        cache.set(key, gradient)
      }
      used.add(key)
      graphics.circle(light.x, light.y, light.radius).fill(gradient)
    }
    // Marcadores por cima de todos os halos: halo de uma luz não cobre o ponto da outra.
    for (const light of lights) {
      const color = new Color(light.color).toNumber()
      graphics
        .circle(light.x, light.y, LIGHT_MARKER_SCREEN_RADIUS / scale)
        .fill({ color })
        .stroke({ width: LIGHT_MARKER_OUTLINE_SCREEN_PX / scale, color: LIGHT_MARKER_OUTLINE_COLOR })
      if (light.id === selectedLightId) {
        graphics.circle(light.x, light.y, LIGHT_HIT_RADIUS).stroke({ width: 3, color: SELECTION_COLOR })
      }
    }
    for (const [key, gradient] of cache) {
      if (!used.has(key)) {
        cache.delete(key)
        gradient.destroy()
      }
    }
  }

  function destroy(): void {
    for (const gradient of cache.values()) gradient.destroy()
    cache.clear()
  }

  return { draw, liveGradients: () => cache.size, destroy }
}
