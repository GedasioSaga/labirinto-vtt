import { Color, Container, FillGradient, Graphics } from 'pixi.js'
import type { Light, RegionPoint } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { LIGHT_HIT_RADIUS } from '../lib/selectionHitTest'
import { computeVisibility, type Segment } from '../lib/visibility'

/** Marcador da origem da luz, em px de TELA (critério 6 do passo 3). */
export const LIGHT_MARKER_SCREEN_RADIUS = 6
const LIGHT_MARKER_OUTLINE_SCREEN_PX = 1.5
const LIGHT_MARKER_OUTLINE_COLOR = 0x1f1b16

/**
 * Paradas do gradiente radial (offset → fração da intensidade). Sem anel duro:
 * o alpha cai de forma contínua até 0 na borda. Blend "normal": "add" estoura
 * para branco sobre o pergaminho e "multiply" escurece.
 *
 * 17/09/2026 — o halo antigo (0,35 no centro, 0,12 em 60% do raio) lia como um
 * véu: a meio raio entregava alpha 0,158. O perfil de hoje entrega 0,38 a meio
 * raio, ~2,4x, que é o "parece luz" pedido pelo usuário.
 */
export const LIGHT_GRADIENT_STOPS: readonly { offset: number; alphaPerIntensity: number }[] = [
  { offset: 0, alphaPerIntensity: 0.6 },
  { offset: 0.5, alphaPerIntensity: 0.38 },
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

export interface LightsDrawOptions {
  /** Anel de seleção do editor; o jogador nunca seleciona luz. */
  selectedLightId?: string | null
  /** Mantém o marcador com tamanho fixo na tela; redesenhar no zoom. */
  cameraScale?: number
  /**
   * Obstáculos que barram a luz (`lib/visibility.ts:visionSegments`). Lista
   * vazia = luz sem parede nenhuma, o halo sai círculo cheio.
   */
  occluders?: Segment[]
  /** Marcador da origem é ferramenta de edição: `false` na tela do jogador. */
  showMarkers?: boolean
}

export interface LightsRenderer {
  draw: (container: Container, lights: Light[], options?: LightsDrawOptions) => void
  /** Quantos FillGradient estão vivos (para o e2e contar vazamento). */
  liveGradients: () => number
  /** Libera todos os gradientes (desmonte do canvas). */
  destroy: () => void
}

/** Um halo por luz: a máscara do recorte é por objeto, não por instrução de desenho. */
interface Halo {
  halo: Graphics
  /** Polígono de alcance da luz; vazia quando não há parede recortando. */
  sombra: Graphics
}

interface PolygonCache {
  occluders: Segment[]
  polygon: RegionPoint[]
}

/** Chave do recorte: luz na mesma pose com os mesmos obstáculos reaproveita o raycast. */
function lightShapeKey(light: Light): string {
  return `${light.id}|${light.x}|${light.y}|${light.radius}`
}

/**
 * Renderer de luzes com cache de FillGradient por cor + intensidade. Cada
 * gradiente cria uma textura (FillGradient.d.ts: "important to destroy"):
 * gradiente que sai de uso é destruído no fim do draw, e `destroy()` limpa
 * tudo no teardown. Instanciar no setup() de cada canvas, nunca em módulo.
 *
 * A luz PARA NA PAREDE: o alcance de cada luz é o mesmo raycast da visão
 * (`computeVisibility`), e o polígono resultante entra como máscara do halo.
 * Máscara em vez de desenhar o polígono direto porque o gradiente é em espaço
 * LOCAL — preenchendo o polígono, ele seria esticado para a caixa do polígono
 * e o centro da luz sairia do lugar (pixi.js generateTextureFillMatrix.js).
 */
export function createLightsRenderer(): LightsRenderer {
  const cache = new Map<string, FillGradient>()
  const polygons = new Map<string, PolygonCache>()
  const halos: Halo[] = []
  let markers: Graphics | null = null

  /** Cresce o pool de halos até `count` e mantém os marcadores como último filho. */
  function ensureHalos(container: Container, count: number): Graphics {
    while (halos.length < count) {
      const sombra = new Graphics()
      const halo = new Graphics()
      halos.push({ halo, sombra })
      container.addChild(sombra, halo)
    }
    if (markers === null) markers = new Graphics()
    // addChild de quem já é filho re-empilha no topo: marcador de uma luz nunca
    // fica sob o halo de outra.
    container.addChild(markers)
    return markers
  }

  function clipPolygon(light: Light, occluders: Segment[]): RegionPoint[] {
    const key = lightShapeKey(light)
    const cached = polygons.get(key)
    if (cached && cached.occluders === occluders) return cached.polygon
    const polygon = computeVisibility({ x: light.x, y: light.y }, occluders, light.radius)
    polygons.set(key, { occluders, polygon })
    return polygon
  }

  function draw(container: Container, lights: Light[], options: LightsDrawOptions = {}): void {
    const { selectedLightId = null, cameraScale = 1, occluders = [], showMarkers = true } = options
    const scale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
    const markersGraphics = ensureHalos(container, lights.length)
    const usedGradients = new Set<string>()
    const usedPolygons = new Set<string>()

    for (let i = 0; i < halos.length; i += 1) {
      const { halo, sombra } = halos[i]
      halo.clear()
      sombra.clear()
      halo.mask = null
      const light: Light | undefined = lights[i]
      if (light === undefined || !(light.radius > 0)) {
        halo.visible = false
        continue
      }
      halo.visible = true
      const key = lightGradientKey(light)
      let gradient = cache.get(key)
      if (!gradient) {
        gradient = createLightGradient(light)
        cache.set(key, gradient)
      }
      usedGradients.add(key)
      halo.circle(light.x, light.y, light.radius).fill(gradient)
      if (occluders.length === 0) continue
      usedPolygons.add(lightShapeKey(light))
      const polygon = clipPolygon(light, occluders)
      if (polygon.length < 3) continue
      sombra.poly(polygon, true).fill({ color: 0xffffff })
      halo.mask = sombra
    }

    markersGraphics.clear()
    markersGraphics.visible = showMarkers
    if (showMarkers) {
      for (const light of lights) {
        const color = new Color(light.color).toNumber()
        markersGraphics
          .circle(light.x, light.y, LIGHT_MARKER_SCREEN_RADIUS / scale)
          .fill({ color })
          .stroke({ width: LIGHT_MARKER_OUTLINE_SCREEN_PX / scale, color: LIGHT_MARKER_OUTLINE_COLOR })
        if (light.id === selectedLightId) {
          markersGraphics.circle(light.x, light.y, LIGHT_HIT_RADIUS).stroke({ width: 3, color: SELECTION_COLOR })
        }
      }
    }

    for (const [key, gradient] of cache) {
      if (!usedGradients.has(key)) {
        cache.delete(key)
        gradient.destroy()
      }
    }
    for (const key of polygons.keys()) {
      if (!usedPolygons.has(key)) polygons.delete(key)
    }
  }

  function destroy(): void {
    for (const gradient of cache.values()) gradient.destroy()
    cache.clear()
    polygons.clear()
  }

  return { draw, liveGradients: () => cache.size, destroy }
}
