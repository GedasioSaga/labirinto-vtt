import type { RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'
import { simplifyRing } from './refineFloor'
import { computeVisibility, ringToSegments, type Segment } from './visibility'

/**
 * CENA ESCURA e SALA ESCURA — a visão de uma ficha quando a luz importa.
 *
 * No escuro a ficha enxerga a casa em volta dela (`DARK_SIGHT_CELLS`) e o que
 * uma Luz ilumina na linha de visão dela, MESMO além do raio: a caldeira acesa
 * no fim do porão aparece, o corredor entre as duas fica preto. Numa cena
 * clara, só o interior das salas escuras segue esta regra; fora delas vale a
 * visão de sempre.
 *
 * O resultado é uma lista de anéis cuja UNIÃO é o que se vê — o formato que
 * `filterMapForPlayer` já usa (`vision`, um anel por ficha, e o teste "está em
 * algum anel"). Nenhuma biblioteca de recorte de polígono: cada anel é um
 * polígono de visão (`computeVisibility`) lançado de uma SEMENTE que está
 * dentro da região pedida, com as bordas dessa região entrando como paredes.
 * O raio de uma semente para na primeira borda que cruza, então o anel nunca
 * sai da região — o erro é sempre para o lado de mostrar MENOS. Pedaço que só
 * se alcança dando a volta por fora da região (luz vista em volta de um pilar)
 * pede outra semente, tirada de uma grade de pontos; `MAX_SEEDS` limita o custo.
 */

/** No escuro a ficha enxerga isto em volta dela, em casas ("raio mínimo de 1 casa"). */
export const DARK_SIGHT_CELLS = 1
/**
 * Semente colada numa borda não vale: a varredura ignora acerto colado na
 * origem (`MIN_HIT_DISTANCE` de `visibility.ts`), e o raio atravessaria a
 * borda para o lado de fora. Em px de mundo, muito acima desse limite.
 */
const SEED_CLEARANCE = 0.5
/**
 * Sementes por região (o claro de uma luz, ou o que não é sala escura). Cada
 * semente é um anel a mais no pacote: medido num mapa de 60 paredes, 20 luzes
 * e 6 salas escuras, 24 sementes davam 165 mil pontos de visão por jogador.
 */
const MAX_SEEDS = 4
/**
 * Tolerância (px de mundo) do Douglas-Peucker nos anéis: tira os pontos
 * colineares que a varredura deixa ao longo de cada parede. O anel
 * simplificado fica a no máximo isto do original.
 */
const RING_TOLERANCE = 0.05
/** Pontos candidatos por eixo da grade de sementes: mapa-mundi de visão enorme não vira custo por pixel. */
const MAX_SAMPLES_PER_AXIS = 32

/** Uma Luz que ilumina para este jogador, já filtrada pelo recorte (`lib/fogFilter.ts`). */
export interface DarkLight {
  x: number
  y: number
  radius: number
}

export interface Darkness {
  /** Cena inteira escura (`MapData.dark`). */
  sceneDark: boolean
  /** Polígonos das salas escuras que valem para este jogador. */
  rooms: RegionPoint[][]
  lights: DarkLight[]
  /** Lado da casa, em px de mundo (`MapData.grid`). */
  cell: number
}

interface Boxed {
  ring: RegionPoint[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function boxed(ring: RegionPoint[]): Boxed {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of ring) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { ring, minX, minY, maxX, maxY }
}

function overlaps(a: Boxed, b: Boxed): boolean {
  return a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY
}

function inBoxed(b: Boxed, p: RegionPoint): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && pointInRing(p, b.ring)
}

function distanceToRing(p: RegionPoint, ring: readonly RegionPoint[]): number {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const lengthSq = ex * ex + ey * ey
    const t = lengthSq > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * ex + (p.y - a.y) * ey) / lengthSq)) : 0
    best = Math.min(best, Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t)))
  }
  return best
}

/** Dentro do anel e longe da borda: serve de semente. */
function clearlyInside(p: RegionPoint, b: Boxed): boolean {
  return inBoxed(b, p) && distanceToRing(p, b.ring) > SEED_CLEARANCE
}

/** Fora do anel e longe da borda. */
function clearlyOutside(p: RegionPoint, b: Boxed): boolean {
  if (p.x < b.minX - SEED_CLEARANCE || p.x > b.maxX + SEED_CLEARANCE || p.y < b.minY - SEED_CLEARANCE || p.y > b.maxY + SEED_CLEARANCE) return true
  return !pointInRing(p, b.ring) && distanceToRing(p, b.ring) > SEED_CLEARANCE
}

/** Anel sem os pontos colineares (`RING_TOLERANCE`); anel degenerado sai vazio. */
function tidy(ring: RegionPoint[]): RegionPoint[] {
  if (ring.length < 3) return []
  const simplified = simplifyRing(ring, RING_TOLERANCE)
  return simplified.length >= 3 ? simplified : []
}

/**
 * Centros de uma grade sobre a caixa, no passo pedido (ou maior, se a caixa
 * for enorme), do mais perto ao mais longe de `anchor`: com poucas sementes,
 * as primeiras são as que cobrem o que fica junto de quem olha.
 */
function seedGrid(box: Boxed, step: number, anchor: RegionPoint): RegionPoint[] {
  const width = box.maxX - box.minX
  const height = box.maxY - box.minY
  const stride = Math.max(step, width / MAX_SAMPLES_PER_AXIS, height / MAX_SAMPLES_PER_AXIS)
  if (!(stride > 0) || !Number.isFinite(stride)) return []
  const points: RegionPoint[] = []
  for (let y = box.minY + stride / 2; y < box.maxY; y += stride) {
    for (let x = box.minX + stride / 2; x < box.maxX; x += stride) points.push({ x, y })
  }
  const distance = (p: RegionPoint): number => Math.hypot(p.x - anchor.x, p.y - anchor.y)
  return points.sort((a, b) => distance(a) - distance(b))
}

/**
 * Anéis que cobrem a região aceita por `accepts`, cada um lançado de uma
 * semente com `walls` (paredes + bordas da região) barrando o raio. Semente
 * já coberta por um anel anterior desta mesma região é pulada.
 */
function fillFromSeeds(
  candidates: readonly RegionPoint[],
  accepts: (p: RegionPoint) => boolean,
  walls: Segment[],
  radius: number,
): RegionPoint[][] {
  const rings: RegionPoint[][] = []
  const covered: Boxed[] = []
  for (const seed of candidates) {
    if (rings.length >= MAX_SEEDS) break
    // Coberto primeiro: é o teste barato, e depois do primeiro anel quase todo candidato para nele.
    if (covered.some((b) => inBoxed(b, seed)) || !accepts(seed)) continue
    const ring = tidy(computeVisibility(seed, walls, radius))
    if (ring.length < 3) continue
    rings.push(ring)
    covered.push(boxed(ring))
  }
  return rings
}

/** Caixa do círculo de alcance de uma luz. */
function lightBox(l: DarkLight): Boxed {
  return boxed([
    { x: l.x - l.radius, y: l.y - l.radius },
    { x: l.x + l.radius, y: l.y + l.radius },
  ])
}

/**
 * A visão de uma ficha em `origin` com escuro no mapa: a casa em volta dela,
 * o que é claro na linha de visão (fora das salas escuras, e só numa cena que
 * não é escura) e o claro das luzes na linha de visão, mesmo além do raio.
 * `visionRadius <= 0` é ficha sem visão: nada, como em `computeVisibility`.
 */
export function darkVision(origin: RegionPoint, segments: Segment[], visionRadius: number, darkness: Darkness): RegionPoint[][] {
  if (!(visionRadius > 0)) return []
  const out: RegionPoint[][] = []
  const nearRadius = Math.min(visionRadius, darkness.cell * DARK_SIGHT_CELLS)
  const near = (): RegionPoint[] => tidy(computeVisibility(origin, segments, nearRadius))
  const rooms = darkness.rooms.filter((r) => r.length >= 3).map(boxed)

  if (darkness.sceneDark) {
    out.push(near())
  } else {
    const sight = computeVisibility(origin, segments, visionRadius)
    if (sight.length < 3) return []
    const sightBox = boxed(sight)
    const roomsInSight = rooms.filter((r) => overlaps(r, sightBox))
    if (roomsInSight.length === 0) {
      // Nenhuma sala escura à vista: a visão de sempre, anel intacto.
      out.push(sight)
    } else {
      out.push(near())
      const bounds = boxed(tidy(sight))
      const walls = [...segments, ...roomsInSight.flatMap((r) => ringToSegments(r.ring)), ...ringToSegments(bounds.ring)]
      const lit = (p: RegionPoint): boolean => clearlyInside(p, bounds) && roomsInSight.every((r) => clearlyOutside(p, r))
      const seeds = [origin, ...seedGrid(bounds, darkness.cell, origin)]
      out.push(...fillFromSeeds(seeds, lit, walls, visionRadius * 2))
    }
  }

  // Numa cena clara, luz só importa onde encosta numa sala escura.
  const lights = darkness.sceneDark ? darkness.lights : darkness.lights.filter((l) => rooms.some((r) => overlaps(r, lightBox(l))))
  if (lights.length > 0) out.push(...litRings(origin, segments, lights, darkness, rooms))
  return out.filter((ring) => ring.length >= 3)
}

/** O claro de cada luz que a ficha em `origin` vê, mesmo além do raio dela. */
function litRings(origin: RegionPoint, segments: Segment[], lights: readonly DarkLight[], darkness: Darkness, rooms: readonly Boxed[]): RegionPoint[][] {
  // Linha de visão SEM o raio da ficha: o que a luz acende se vê de longe.
  const reach = Math.max(...lights.map((l) => Math.hypot(l.x - origin.x, l.y - origin.y) + l.radius)) + darkness.cell
  const far = boxed(tidy(computeVisibility(origin, segments, reach)))
  if (far.ring.length < 3) return []
  const farWalls = ringToSegments(far.ring)
  const roomWalls = darkness.sceneDark ? [] : rooms.flatMap((r) => ringToSegments(r.ring))
  const out: RegionPoint[][] = []
  for (const light of lights) {
    if (!overlaps(lightBox(light), far)) continue
    const center = { x: light.x, y: light.y }
    const litArea = boxed(tidy(computeVisibility(center, segments, light.radius)))
    if (litArea.ring.length < 3 || !overlaps(litArea, far)) continue
    const walls = [...segments, ...ringToSegments(litArea.ring), ...farWalls, ...roomWalls]
    // Cena clara: o claro da luz só soma DENTRO da sala escura; fora dela a visão de sempre já decide.
    const accepts = (p: RegionPoint): boolean =>
      clearlyInside(p, litArea) && clearlyInside(p, far) && (darkness.sceneDark || rooms.some((r) => clearlyInside(p, r)))
    const seeds = [center, origin, ...seedGrid(litArea, Math.min(darkness.cell, light.radius / 2), center)]
    out.push(...fillFromSeeds(seeds, accepts, walls, light.radius * 2 + darkness.cell))
  }
  return out
}

