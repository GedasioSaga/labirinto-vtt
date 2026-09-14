import type { DoorState, Drawing, MapData, RegionPoint, Wall } from '../types/map'
import { isPointExplored, isShapeExplored, type Exploration } from './exploration'
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
  /** Portas dentro da visão atual: saíram com o estado real e o chamador deve lembrá-lo. */
  visibleDoorIds: string[]
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

/** Fração da distância vértice-centróide que a amostra de área anda para dentro. */
const INTERIOR_PULL = 0.15
/** Piso do recuo, em px de mundo: vértice sobre a parede sai do traço dela. */
const INTERIOR_PULL_MIN = 4
/** Distância, em px de mundo, das amostras de visão da porta para cada lado da parede (a porta fica na borda do anel). */
const DOOR_VISION_PROBE = 2
/**
 * Distância das amostras de explorado da porta, em células: maior que a
 * diagonal da célula (√2), para cair numa célula que não cruza a parede da
 * porta (célula que cruza a parede nunca é marcada).
 */
const DOOR_EXPLORED_PROBE_CELLS = 1.5

/**
 * Amostras INTERNAS de uma forma com área: o centróide dos vértices e cada
 * vértice puxado em direção a ele. Vértice cru sobre uma parede fica na borda
 * da visão de quem está do outro lado e cai, pelo arredondamento, na célula
 * vizinha: a sala do lado vazaria. Com `ring`, descarta amostra fora do
 * polígono (centróide de polígono côncavo); se nenhuma sobra, usa todas.
 */
function interiorSamples(points: readonly RegionPoint[], ring?: RegionPoint[]): RegionPoint[] {
  if (points.length === 0) return []
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  const c = { x: sx / points.length, y: sy / points.length }
  const samples = [c]
  for (const p of points) {
    const dx = c.x - p.x
    const dy = c.y - p.y
    const d = Math.hypot(dx, dy)
    if (d === 0) continue
    const step = Math.min(d, Math.max(d * INTERIOR_PULL, INTERIOR_PULL_MIN))
    samples.push({ x: p.x + (dx * step) / d, y: p.y + (dy * step) / d })
  }
  if (ring === undefined || ring.length < 3) return samples
  const inside = samples.filter((p) => pointInRing(p, ring))
  return inside.length > 0 ? inside : samples
}

/**
 * Pontos que representam o desenho. Com área (polígono, retângulo, círculo,
 * elipse): amostras internas. Traço (linha, mão livre, curva) e texto: pontos
 * crus. Traço sem pontos devolve lista vazia e nunca é enviado.
 */
function drawingSamplePoints(drawing: Drawing): RegionPoint[] {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
      return drawing.points
    case 'polygon':
      return interiorSamples(drawing.points, drawing.points)
    case 'line':
      return [
        { x: drawing.x1, y: drawing.y1 },
        { x: (drawing.x1 + drawing.x2) / 2, y: (drawing.y1 + drawing.y2) / 2 },
        { x: drawing.x2, y: drawing.y2 },
      ]
    case 'circle':
      return interiorSamples(ellipseExtremes(drawing.cx, drawing.cy, drawing.radius, drawing.radius))
    case 'ellipse':
      return interiorSamples(ellipseExtremes(drawing.cx, drawing.cy, drawing.rx, drawing.ry))
    case 'text':
      return [{ x: drawing.x, y: drawing.y }]
    case 'rect':
      return interiorSamples([
        { x: drawing.x, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y },
        { x: drawing.x + drawing.w, y: drawing.y + drawing.h },
        { x: drawing.x, y: drawing.y + drawing.h },
      ])
  }
}

function ellipseExtremes(cx: number, cy: number, rx: number, ry: number): RegionPoint[] {
  return [
    { x: cx - rx, y: cy },
    { x: cx + rx, y: cy },
    { x: cx, y: cy - ry },
    { x: cx, y: cy + ry },
  ]
}

/** Meio da porta e dois pontos a `distance` px dele, um de cada lado da parede. */
function doorSamples(wall: Wall, distance: number): RegionPoint[] {
  const mx = (wall.x1 + wall.x2) / 2
  const my = (wall.y1 + wall.y2) / 2
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (len === 0) return [{ x: mx, y: my }]
  const nx = (-(wall.y2 - wall.y1) / len) * distance
  const ny = ((wall.x2 - wall.x1) / len) * distance
  return [
    { x: mx, y: my },
    { x: mx + nx, y: my + ny },
    { x: mx - nx, y: my - ny },
  ]
}

/** Porta explorada que o jogador nunca viu: aparece fechada e destrancada. */
function unseenDoor(door: DoorState): DoorState {
  return { open: false, locked: false, kind: door.kind }
}

/**
 * `explored`: memória do jogador ANTES desta visão (quem marca é o chamador).
 * Só a planta estática (regiões, desenhos e textos, escadas, portas, linhas,
 * marcadores) entra por estar explorada; token, prop e luz mudam de lugar e
 * continuam exigindo visão atual, senão a memória viraria espionagem.
 * `seenDoors`: último estado visto de cada porta (somente leitura). Porta
 * explorada fora da visão sai com esse estado, nunca com o atual: senão o
 * jogador longe veria o mestre abrir ou destrancar a porta.
 */
export function filterMapForPlayer(
  map: MapData,
  playerId: string,
  ownership: Record<string, string[]>,
  visionRadius: number,
  explored?: Exploration,
  seenDoors?: ReadonlyMap<string, DoorState>,
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

  // Planta estática: visível agora ou já explorada. Nunca usar para entidade dinâmica.
  const isPointKnown = (point: RegionPoint): boolean =>
    isVisible(point) || (explored !== undefined && isPointExplored(explored, point))
  const isShapeKnown = (points: readonly RegionPoint[]): boolean =>
    isShapeVisible(points) || (explored !== undefined && isShapeExplored(explored, points))

  const visibleDoorIds: string[] = []
  /** Porta dentro da visão sai com o estado real; explorada fora dela, com o lembrado; senão não sai. */
  const doorWallForPlayer = (w: Wall, door: DoorState): Wall[] => {
    if (doorSamples(w, DOOR_VISION_PROBE).some(isVisible)) {
      visibleDoorIds.push(w.id)
      return [w]
    }
    if (explored === undefined) return []
    const probe = explored.cell * DOOR_EXPLORED_PROBE_CELLS
    if (!doorSamples(w, probe).some((p) => isPointExplored(explored, p))) return []
    return [{ ...w, door: seenDoors?.get(w.id) ?? unseenDoor(door) }]
  }

  const filtered: MapData = {
    ...map,
    // Metadado do mestre: vínculo de cenário, dono e áreas reveladas não são do jogador.
    scenarioLink: null,
    ownerId: null,
    fog: { mode: map.fog.mode, revealed: [] },
    background: map.background.type === 'image' ? { type: 'image', src: '' } : map.background,
    tokens: layerTokens
      .filter((t) => !t.hidden && (owned.has(t.id) || isVisible({ x: t.x, y: t.y })))
      .map((t) => (t.image === null ? t : { ...t, image: null })),
    markers: map.markers.filter((m) => isPointKnown({ x: m.cx, y: m.cy })),
    lines: map.lines.filter((l) => isShapeKnown(l.points)),
    lights: visibleLights(map.lights, hiddenLayers).filter((l) => !l.hidden && isVisible({ x: l.x, y: l.y })),
    stairs: visibleStairs(map.stairs, hiddenLayers).filter((s) => {
      const first = s.segments[0]
      return !s.hidden && first !== undefined && isPointKnown({ x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 })
    }),
    props: visibleProps(map.props, hiddenLayers)
      .filter((p) => !p.hidden && isVisible({ x: p.x, y: p.y }))
      .map((p) => ({ ...p, src: '', linkedMapPath: null })),
    drawings: visibleDrawings(map.drawings, hiddenLayers).filter((d) => isShapeKnown(drawingSamplePoints(d))),
    regions: visibleRegions(map.regions, hiddenLayers).filter((r) => !r.hidden && isShapeKnown(interiorSamples(r.points, r.points))),
    walls: visibleWalls(map.walls, hiddenLayers).flatMap((w) => {
      if (w.hidden) return []
      return w.door === null ? [w] : doorWallForPlayer(w, w.door)
    }),
    floor: map.floor.filter((f) => !f.hidden),
  }
  return { map: filtered, vision, visibleDoorIds }
}

/** O host vê o mapa inteiro, inclusive itens ocultos. */
export function filterMapForHost(map: MapData): MapData {
  return map
}
