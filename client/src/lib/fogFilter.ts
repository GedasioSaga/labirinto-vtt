import type { Drawing, MapData, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'
import { visibleDrawings, visibleLights, visibleProps, visibleRegions, visibleStairs, visibleTokens, visibleWalls } from './layers'
import { computeVisibility, visionSegments } from './visibility'

/**
 * Recorte do mapa que um jogador pode receber. Tudo que sai daqui vai pela
 * rede: item fora da visão precisa estar AUSENTE, não só escondido no render.
 * A planta (chão, estilo, moldura, fundo, paredes sem porta) vai inteira por
 * decisão do usuário; entidades dinâmicas só aparecem dentro da visão de pelo
 * menos um token do jogador. Camada oculta pelo mestre (`hiddenLayers`) não
 * sai, e caminho de arquivo local (fundo, imagem de token e de prop) também
 * não: o jogador não abre caminho do disco do mestre.
 */

/** Folga da caixa envolvente do anel de visão, em px de mundo; muito acima do erro de arredondamento. */
const BBOX_SLACK = 1e-3

export interface PlayerMapView {
  map: MapData
  vision: RegionPoint[][]
}

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function boxOf(points: readonly RegionPoint[]): Box | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Pontos que representam a forma: vértices, extremos e centro. Traço sem pontos devolve lista vazia e nunca é enviado. */
function drawingSamplePoints(drawing: Drawing): RegionPoint[] {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
    case 'polygon':
      return drawing.points
    case 'line':
      return [
        { x: drawing.x1, y: drawing.y1 },
        { x: (drawing.x1 + drawing.x2) / 2, y: (drawing.y1 + drawing.y2) / 2 },
        { x: drawing.x2, y: drawing.y2 },
      ]
    case 'circle':
      return ellipsePoints(drawing.cx, drawing.cy, drawing.radius, drawing.radius)
    case 'ellipse':
      return ellipsePoints(drawing.cx, drawing.cy, drawing.rx, drawing.ry)
    case 'text':
      return [{ x: drawing.x, y: drawing.y }]
    case 'rect':
      return [
        { x: drawing.x, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y + drawing.h },
        { x: drawing.x, y: drawing.y + drawing.h },
        { x: drawing.x + drawing.w / 2, y: drawing.y + drawing.h / 2 },
      ]
  }
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number): RegionPoint[] {
  return [
    { x: cx, y: cy },
    { x: cx - rx, y: cy },
    { x: cx + rx, y: cy },
    { x: cx, y: cy - ry },
    { x: cx, y: cy + ry },
  ]
}

function centroid(points: readonly RegionPoint[]): RegionPoint[] {
  if (points.length === 0) return []
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return [{ x: x / points.length, y: y / points.length }]
}

export function filterMapForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  visionRadius: number,
): PlayerMapView {
  const hiddenLayers = map.hiddenLayers
  const owned = new Set(ownership[playerId] ?? []) // jogador sem entrada de posse não tem token nem visão
  const layerTokens = visibleTokens(map.tokens, hiddenLayers)
  const ownTokens = layerTokens.filter((t) => owned.has(t.id) && !t.hidden)
  const segments = ownTokens.length > 0 ? visionSegments(map) : []
  const vision = ownTokens.map((t) => computeVisibility({ x: t.x, y: t.y }, segments, visionRadius))

  // Invariante de performance: cada anel de visão tem ~mil vértices e é testado
  // para cada entidade. Ponto fora da caixa envolvente (com folga para o
  // arredondamento da intersecção do pointInRing) nunca está dentro do anel,
  // então a caixa descarta a maioria sem mudar o resultado.
  const rings = vision.flatMap((ring) => {
    const box = ring.length >= 3 ? boxOf(ring) : null
    if (box === null) return []
    return [{ ring, minX: box.minX - BBOX_SLACK, minY: box.minY - BBOX_SLACK, maxX: box.maxX + BBOX_SLACK, maxY: box.maxY + BBOX_SLACK }]
  })

  const isVisible = (point: RegionPoint): boolean =>
    rings.some((b) => point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY && pointInRing(point, b.ring))

  /**
   * Forma com extensão: a caixa da forma precisa cruzar a caixa de algum anel
   * e algum ponto amostrado precisa estar dentro dele. Forma que só atravessa
   * a visão sem nenhum ponto amostrado dentro fica de fora (aceito).
   */
  const isShapeVisible = (points: readonly RegionPoint[]): boolean => {
    const box = boxOf(points)
    if (box === null) return false
    return rings.some(
      (b) =>
        box.maxX >= b.minX &&
        box.minX <= b.maxX &&
        box.maxY >= b.minY &&
        box.minY <= b.maxY &&
        points.some((p) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && pointInRing(p, b.ring)),
    )
  }

  const filtered: MapData = {
    ...map,
    background: map.background.type === 'image' ? { type: 'image', src: '' } : map.background,
    tokens: layerTokens
      .filter((t) => !t.hidden && (owned.has(t.id) || isVisible({ x: t.x, y: t.y })))
      .map((t) => (t.image === null ? t : { ...t, image: null })),
    markers: map.markers.filter((m) => isVisible({ x: m.cx, y: m.cy })),
    lines: map.lines.filter((l) => isShapeVisible(l.points)),
    lights: visibleLights(map.lights, hiddenLayers).filter((l) => !l.hidden && isVisible({ x: l.x, y: l.y })),
    stairs: visibleStairs(map.stairs, hiddenLayers).filter((s) => {
      const first = s.segments[0]
      return !s.hidden && first !== undefined && isVisible({ x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 })
    }),
    props: visibleProps(map.props, hiddenLayers)
      .filter((p) => !p.hidden && isVisible({ x: p.x, y: p.y }))
      .map((p) => ({ ...p, src: '', linkedMapPath: null })),
    drawings: visibleDrawings(map.drawings, hiddenLayers).filter((d) => isShapeVisible(drawingSamplePoints(d))),
    regions: visibleRegions(map.regions, hiddenLayers).filter((r) => !r.hidden && isShapeVisible([...r.points, ...centroid(r.points)])),
    walls: visibleWalls(map.walls, hiddenLayers).filter(
      (w) => !w.hidden && (w.door === null || isVisible({ x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 })),
    ),
    floor: map.floor.filter((f) => !f.hidden),
  }
  return { map: filtered, vision }
}

/** O host vê o mapa inteiro, inclusive itens ocultos. */
export function filterMapForHost(map: MapData): MapData {
  return map
}
