import type { Wall, Light, Region, RegionPoint, Drawing, DrawingPoint, Stair, MapData } from '../types/map'
import type { Selection } from '../types/tools'
import { findTokenAt } from '../pixi/tokenInteraction'
import { findPropAt } from '../pixi/propInteraction'
import { visibleWalls, visibleRegions, visibleStairs, visibleLights, visibleDrawings, visibleTokens, visibleProps } from './layers'

export interface Point {
  x: number
  y: number
}

const WALL_HIT_TOLERANCE = 8
export const LIGHT_HIT_RADIUS = 14

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  const closestX = a.x + t * dx
  const closestY = a.y + t * dy
  return Math.hypot(point.x - closestX, point.y - closestY)
}

export function findWallAt(walls: Wall[], point: Point, tolerance = WALL_HIT_TOLERANCE): Wall | null {
  for (let i = walls.length - 1; i >= 0; i -= 1) {
    const wall = walls[i]
    if (distanceToSegment(point, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }) <= tolerance) {
      return wall
    }
  }
  return null
}

const STAIR_HIT_TOLERANCE = 8 // mesma tolerância de WALL_HIT_TOLERANCE — lance tem espessura de interação equivalente à de uma parede

/** Acerta se `point` está perto de QUALQUER segmento do lance (hoje só 1,
 *  shape 'straight' — 'l'/'double' terão mais de um segmento quando a
 *  ferramenta de criação deles existir, e este loop já cobre isso de graça). */
export function findStairAt(stairs: Stair[], point: Point, tolerance = STAIR_HIT_TOLERANCE): Stair | null {
  for (let i = stairs.length - 1; i >= 0; i -= 1) {
    const stair = stairs[i]
    for (const segment of stair.segments) {
      if (distanceToSegment(point, { x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }) <= tolerance) {
        return stair
      }
    }
  }
  return null
}

export function findLightAt(lights: Light[], point: Point, handleRadius = LIGHT_HIT_RADIUS): Light | null {
  for (let i = lights.length - 1; i >= 0; i -= 1) {
    const light = lights[i]
    if (Math.hypot(point.x - light.x, point.y - light.y) <= handleRadius) {
      return light
    }
  }
  return null
}

export function isPointInPolygon(point: Point, points: RegionPoint[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export function findRegionAt(regions: Region[], point: Point): Region | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const region = regions[i]
    if (region.points.length >= 3 && isPointInPolygon(point, region.points)) {
      return region
    }
  }
  return null
}

const DRAWING_HIT_TOLERANCE = 8

function distanceToPolyline(point: Point, points: Point[]): number {
  let min = Infinity
  for (let i = 0; i < points.length - 1; i += 1) {
    min = Math.min(min, distanceToSegment(point, points[i], points[i + 1]))
  }
  return min
}

/** Aproximação de largura de texto pra hit-test — não é medida real de glyph
 * (isso só existe depois do Pixi renderizar), é heurística: `0.55 * fontSize`
 * por caractere, suficiente pra clicar em cima do rótulo com folga. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55
}

export function findDrawingAt(drawings: Drawing[], point: Point, tolerance = DRAWING_HIT_TOLERANCE): Drawing | null {
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const drawing = drawings[i]

    if (drawing.kind === 'text') {
      const width = estimateTextWidth(drawing.text, drawing.fontSize)
      const withinX = point.x >= drawing.x - 4 && point.x <= drawing.x + width + 4
      const withinY = point.y >= drawing.y - 4 && point.y <= drawing.y + drawing.fontSize + 4
      if (withinX && withinY) return drawing
      continue
    }

    const reach = tolerance + drawing.width / 2

    if (drawing.kind === 'freehand' || drawing.kind === 'curve') {
      if (drawing.points.length >= 2 && distanceToPolyline(point, drawing.points) <= reach) return drawing
    } else if (drawing.kind === 'line') {
      if (distanceToSegment(point, { x: drawing.x1, y: drawing.y1 }, { x: drawing.x2, y: drawing.y2 }) <= reach) return drawing
    } else if (drawing.kind === 'circle') {
      const distanceToCenter = Math.hypot(point.x - drawing.cx, point.y - drawing.cy)
      const hit = drawing.filled ? distanceToCenter <= drawing.radius : Math.abs(distanceToCenter - drawing.radius) <= reach
      if (hit) return drawing
    } else if (drawing.kind === 'rect') {
      // Preenchido: contido no retângulo já basta (a borda cai dentro do
      // intervalo inclusivo). Vazado: só perto de uma das 4 arestas — mesma
      // ideia de findWallAt, um distanceToSegment por lado.
      const withinFill =
        point.x >= drawing.x && point.x <= drawing.x + drawing.w && point.y >= drawing.y && point.y <= drawing.y + drawing.h
      if (drawing.filled && withinFill) return drawing
      if (!drawing.filled) {
        const corners: Point[] = [
          { x: drawing.x, y: drawing.y },
          { x: drawing.x + drawing.w, y: drawing.y },
          { x: drawing.x + drawing.w, y: drawing.y + drawing.h },
          { x: drawing.x, y: drawing.y + drawing.h },
        ]
        for (let i = 0; i < corners.length; i += 1) {
          if (distanceToSegment(point, corners[i], corners[(i + 1) % corners.length]) <= reach) return drawing
        }
      }
    } else if (drawing.kind === 'ellipse') {
      // Distância normalizada ao contorno (nx,ny em unidades de raio): 0 no
      // centro, 1 exatamente na borda. Preenchido: <=1 já é "dentro". Vazado:
      // heurística — converte a folga em px (reach) numa folga na distância
      // normalizada usando o MENOR raio como escala local; não é a distância
      // geométrica exata ao contorno de uma elipse não-circular (não existe
      // fórmula fechada simples), mas erra pouco pra elipses razoavelmente
      // "redondas" e nunca deixa de achar clique bem em cima do traço — mesmo
      // espírito de aproximação de estimateTextWidth, acima.
      const nx = drawing.rx === 0 ? point.x - drawing.cx : (point.x - drawing.cx) / drawing.rx
      const ny = drawing.ry === 0 ? point.y - drawing.cy : (point.y - drawing.cy) / drawing.ry
      const normalizedDistance = Math.hypot(nx, ny)
      if (drawing.filled) {
        if (normalizedDistance <= 1) return drawing
      } else {
        const effectiveRadius = Math.max(Math.min(drawing.rx, drawing.ry), 1)
        if (Math.abs(normalizedDistance - 1) * effectiveRadius <= reach) return drawing
      }
    } else if (drawing.kind === 'polygon') {
      if (drawing.points.length >= 3) {
        if (drawing.filled && isPointInPolygon(point, drawing.points)) return drawing
        const n = drawing.points.length
        for (let i = 0; i < n; i += 1) {
          if (distanceToSegment(point, drawing.points[i], drawing.points[(i + 1) % n]) <= reach) return drawing
        }
      }
    }
  }
  return null
}

const VERTEX_MAGNET_TOLERANCE = 12

/**
 * Varre todos os pontos "grudáveis" já existentes no mapa — as 2 pontas de
 * cada Wall, todo RegionPoint de cada Region, e os pontos de todo Drawing do
 * tipo 'line' (as 2 pontas) ou 'curve' (todos os pontos) — e retorna o mais
 * próximo de `point` que esteja dentro de `tolerance` pixels, ou `null` se
 * nenhum estiver perto o bastante.
 *
 * Usado pelo "ímã" de vértice ao desenhar Parede/Linha (PixiCanvas): grudar
 * no vértice exato evita ponta solta boiando perto de uma estrutura já
 * desenhada sem tocar nela de verdade. 'freehand' fica de fora de propósito —
 * um traço à mão livre não tem vértice estrutural pra conectar.
 *
 * Varre só entidades em camada VISÍVEL (map.hiddenLayers) — sem isso o ímã
 * gruda em vértice de parede/região/desenho que o usuário acabou de esconder,
 * e a feature parece meio quebrada (grudar em algo que não se vê na tela).
 *
 * `excludeWallId` — bug G4 (fechamento de canto): ao ARRASTAR a ponta de uma
 * Wall já existente (não uma em criação), a própria wall sendo arrastada
 * também está em `map.walls`, e sua OUTRA ponta é um candidato geometricamente
 * válido mas espúrio (a parede pode grudar na própria outra ponta em vez da
 * parede vizinha que o usuário está tentando alcançar). Passe o `id` da wall
 * em arrasto para excluí-la da varredura — mesmo padrão que PixiCanvas já usa
 * pro fallback `computeAlignment` (filtro `wall.id !== draggingWallPointId`).
 */
export function findNearestExistingVertex(
  map: MapData,
  point: Point,
  tolerance = VERTEX_MAGNET_TOLERANCE,
  excludeWallId?: string,
): Point | null {
  let nearest: Point | null = null
  let nearestDistance = Infinity

  const consider = (candidate: Point) => {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y)
    if (distance <= tolerance && distance < nearestDistance) {
      nearestDistance = distance
      nearest = candidate
    }
  }

  for (const wall of visibleWalls(map.walls, map.hiddenLayers)) {
    if (wall.id === excludeWallId) continue
    consider({ x: wall.x1, y: wall.y1 })
    consider({ x: wall.x2, y: wall.y2 })
  }

  for (const region of visibleRegions(map.regions, map.hiddenLayers)) {
    for (const vertex of region.points) {
      consider(vertex)
    }
  }

  for (const drawing of visibleDrawings(map.drawings, map.hiddenLayers)) {
    if (drawing.kind === 'line') {
      consider({ x: drawing.x1, y: drawing.y1 })
      consider({ x: drawing.x2, y: drawing.y2 })
    } else if (drawing.kind === 'curve') {
      for (const vertex of drawing.points) {
        consider(vertex)
      }
    }
  }

  return nearest
}

export function findCurveControlPointAt(points: DrawingPoint[], point: Point, handleRadius = 8): number | null {
  for (let i = 0; i < points.length; i += 1) {
    if (Math.hypot(point.x - points[i].x, point.y - points[i].y) <= handleRadius) {
      return i
    }
  }
  return null
}

export interface SelectableHit extends Selection {
  draggable: boolean
}

/**
 * Cadeia de prioridade única de hit-test, usada pela ferramenta "Selecionar":
 * token/prop primeiro (pequenos, em primeiro plano, arrastáveis), depois
 * luz/parede (marcáveis mas não arrastáveis nesta versão), região por último
 * (área grande, não deve "engolir" clique destinado a algo menor por cima).
 *
 * Cada array é filtrado pela camada visível (map.hiddenLayers) ANTES do
 * hit-test — item em camada oculta não é selecionável, mesmo que geometricamente
 * o ponto caia em cima dele. Esse é o filtro de hit-test; o filtro de RENDER
 * (o que de fato desenha na tela) é território do integrador em
 * pixi/PixiCanvas.tsx (redrawShapes) e usa as mesmas funções `visible*` de
 * lib/layers.ts — os dois precisam concordar, senão dá pra clicar em algo
 * invisível ou ver algo que não clica.
 */
export function findSelectableAt(map: MapData, point: Point): SelectableHit | null {
  const token = findTokenAt(visibleTokens(map.tokens, map.hiddenLayers), point, map.grid)
  if (token) return { kind: 'token', id: token.id, draggable: true }

  const prop = findPropAt(visibleProps(map.props, map.hiddenLayers), point)
  if (prop) return { kind: 'prop', id: prop.id, draggable: true }

  const light = findLightAt(visibleLights(map.lights, map.hiddenLayers), point)
  if (light) return { kind: 'light', id: light.id, draggable: false }

  const drawing = findDrawingAt(visibleDrawings(map.drawings, map.hiddenLayers), point)
  // Agente B3 (dossiê F4, bug3): TODO kind de Drawing agora move o corpo
  // inteiro (mapFactory.moveDrawing cobre os 7 kinds — ver CONTRATO), por
  // isso `draggable` é sempre true aqui. 'curve' continua arrastando vértice
  // por um caminho separado, direto no PixiCanvas, que não passa por este
  // campo — mas o CORPO da curva também é `moveDrawing`-compatível.
  if (drawing) return { kind: 'drawing', id: drawing.id, draggable: true }

  const wall = findWallAt(visibleWalls(map.walls, map.hiddenLayers), point)
  if (wall) return { kind: 'wall', id: wall.id, draggable: false }

  // DEPOIS de wall, ANTES de region: escada encostada em parede não pode
  // roubar o clique da parede (testado antes: se viesse antes de wall, o
  // hit-test de escada, com a mesma tolerância, venceria por estar mais no
  // topo da pilha de prioridade). Escada não é arrastável nesta versão —
  // arrasto de ponta/corpo é território do integrador (updateStairPoint/
  // moveStair, ver CONTRATO), mesmo padrão de wall (draggable: false aqui,
  // drag tratado à parte em PixiCanvas.tsx).
  const stair = findStairAt(visibleStairs(map.stairs, map.hiddenLayers), point)
  if (stair) return { kind: 'stair', id: stair.id, draggable: false }

  const region = findRegionAt(visibleRegions(map.regions, map.hiddenLayers), point)
  if (region) return { kind: 'region', id: region.id, draggable: false }

  return null
}
