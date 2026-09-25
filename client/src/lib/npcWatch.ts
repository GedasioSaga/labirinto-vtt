import type { MapData, RegionPoint, TokenWatch, WatchAlert } from '../types/map'
import { visibleTokens } from './layers'
import { visionSegments, type Segment } from './visibility'

/**
 * OLHOS DO GUARDA — regras compartilhadas pelo editor do mestre (cone e aviso)
 * e pelo recorte do jogador (a marca ? / !). Puro: sem DOM, sem Pixi, sem store.
 *
 * O guarda é uma ficha com `vigia`: olha para `direcao`, com `abertura` graus
 * de olhar, até `alcance` quadrados. Parede e porta fechada cortam a visão dele
 * com os MESMOS segmentos que cortam a de quem joga (`visionSegments`).
 */

/** Faixa aceita da abertura do olhar, em graus. */
export const WATCH_APERTURE_MIN = 15
export const WATCH_APERTURE_MAX = 360
/** Faixa aceita do alcance, em quadrados. */
export const WATCH_RANGE_MIN = 1
export const WATCH_RANGE_MAX = 30

/** O que a ficha ganha quando o mestre liga a vigia: olha para a direita, 90°, 6 quadrados. */
export const WATCH_DEFAULT: TokenWatch = { direcao: 0, abertura: 90, alcance: 6 }

/** As oito direções do painel, na ordem da rosa dos ventos a partir do norte. */
export const WATCH_DIRECTIONS: readonly { value: number; label: string }[] = [
  { value: 270, label: 'Norte' },
  { value: 315, label: 'Nordeste' },
  { value: 0, label: 'Leste' },
  { value: 45, label: 'Sudeste' },
  { value: 90, label: 'Sul' },
  { value: 135, label: 'Sudoeste' },
  { value: 180, label: 'Oeste' },
  { value: 225, label: 'Noroeste' },
]

/** Aberturas do painel, em graus; 360 é "Em volta". */
export const WATCH_APERTURES: readonly number[] = [60, 90, 120, 360]
/** Alcances do painel, em quadrados. */
export const WATCH_RANGES: readonly number[] = [3, 6, 9, 12]

/**
 * Até esta fração do alcance o guarda VÊ ("!"); dali até o alcance ele só
 * desconfia ("?"). É a leitura clássica de jogo furtivo: perto é flagrante,
 * na borda do olhar é um vulto.
 */
const ALERT_CERTAIN_FRACTION = 0.5
/** Cruzamento colado no guarda é ignorado: guarda em cima de uma linha não fica cego (mesma regra de `visibility.ts`). */
const MIN_HIT_DISTANCE = 1e-6
/** Abaixo disto o raio é tratado como paralelo ao segmento. */
const PARALLEL_EPSILON = 1e-12
/** Um raio a cada tantos graus desenha o arco do cone. */
const CONE_DEGREES_PER_RAY = 3
/** Desvio dos raios auxiliares em volta de cada quina de parede, em radianos. */
const CORNER_OFFSET = 1e-4

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Graus em [0, 360). */
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/**
 * A vigia como vale para desenhar e julgar: só os três números, já dentro da
 * faixa. O mapa do disco chega cru (`lib/mapFile.ts`), então campo torto vira
 * `null` (ficha comum) e texto enfiado no objeto fica de fora.
 */
export function readTokenWatch(raw: unknown): TokenWatch | null {
  if (typeof raw !== 'object' || raw === null) return null
  const direcao: unknown = Reflect.get(raw, 'direcao')
  const abertura: unknown = Reflect.get(raw, 'abertura')
  const alcance: unknown = Reflect.get(raw, 'alcance')
  if (!finite(direcao) || !finite(abertura) || !finite(alcance)) return null
  return {
    direcao: normalizeDegrees(direcao),
    abertura: clamp(abertura, WATCH_APERTURE_MIN, WATCH_APERTURE_MAX),
    alcance: clamp(alcance, WATCH_RANGE_MIN, WATCH_RANGE_MAX),
  }
}

/** A vigia de uma ficha, ou `null` se ela não vigia. */
export function tokenWatchOf(token: { vigia?: unknown }): TokenWatch | null {
  return readTokenWatch(token.vigia)
}

/** Guarda de leitura da marca: só "?" e "!" viram balão. */
export function watchAlertOf(token: { alerta?: unknown }): WatchAlert | null {
  return token.alerta === '?' || token.alerta === '!' ? token.alerta : null
}

/** Diferença angular em graus, em [-180, 180]. */
function angleGap(a: number, b: number): number {
  const gap = normalizeDegrees(a - b)
  return gap > 180 ? gap - 360 : gap
}

function inAperture(watch: TokenWatch, degrees: number): boolean {
  return watch.abertura >= WATCH_APERTURE_MAX || Math.abs(angleGap(degrees, watch.direcao)) <= watch.abertura / 2
}

/** Distância, em px, até o primeiro segmento no caminho do raio (`dx`,`dy` unitário); `Infinity` se nenhum. */
function firstHit(origin: RegionPoint, dx: number, dy: number, segments: readonly Segment[]): number {
  let nearest = Infinity
  for (const s of segments) {
    const ex = s.x2 - s.x1
    const ey = s.y2 - s.y1
    const denom = dx * ey - dy * ex
    if (Math.abs(denom) < PARALLEL_EPSILON) continue
    const ax = s.x1 - origin.x
    const ay = s.y1 - origin.y
    const t = (ax * ey - ay * ex) / denom
    const u = (ax * dy - ay * dx) / denom
    if (t > MIN_HIT_DISTANCE && u >= 0 && u <= 1 && t < nearest) nearest = t
  }
  return nearest
}

/**
 * O guarda em `guard` enxerga `target`? Dentro do alcance, dentro da abertura
 * e sem segmento de visão no meio do caminho.
 */
export function guardSeesPoint(guard: RegionPoint, watch: TokenWatch, grid: number, segments: readonly Segment[], target: RegionPoint): boolean {
  const dx = target.x - guard.x
  const dy = target.y - guard.y
  const distance = Math.hypot(dx, dy)
  if (distance > watch.alcance * grid) return false
  if (distance === 0) return true
  if (!inAperture(watch, (Math.atan2(dy, dx) * 180) / Math.PI)) return false
  return firstHit(guard, dx / distance, dy / distance, segments) >= distance
}

/** Um jogador no olhar de um guarda, e a marca que isso dá. */
export interface GuardSighting {
  guardId: string
  tokenId: string
  alert: WatchAlert
}

/**
 * Quem cada guarda do mapa vê entre as fichas `targetIds` (as fichas de
 * jogador). Guarda ou alvo oculto no editor, e camada de fichas escondida,
 * ficam de fora; guarda não vê a si mesmo. Segredo, zona oculta e teto NÃO são
 * olhados aqui (o mestre vê tudo): o recorte do jogador passa em `targetIds`
 * só as fichas que ele próprio recebe. `segments` é opcional para quem já
 * calculou a visão do mapa (`lib/fogFilter.ts`) não pagar duas vezes.
 */
export function guardSightings(map: MapData, targetIds: ReadonlySet<string>, segments?: readonly Segment[]): GuardSighting[] {
  const tokens = visibleTokens(map.tokens, map.hiddenLayers).filter((t) => !t.hidden)
  const guards = tokens.flatMap((t) => {
    const watch = tokenWatchOf(t)
    return watch === null ? [] : [{ token: t, watch }]
  })
  const targets = tokens.filter((t) => targetIds.has(t.id))
  if (guards.length === 0 || targets.length === 0) return []
  const walls = segments ?? visionSegments(map)
  const sightings: GuardSighting[] = []
  for (const { token: guard, watch } of guards) {
    for (const target of targets) {
      if (target.id === guard.id || !guardSeesPoint(guard, watch, map.grid, walls, target)) continue
      const near = Math.hypot(target.x - guard.x, target.y - guard.y) <= watch.alcance * map.grid * ALERT_CERTAIN_FRACTION
      sightings.push({ guardId: guard.id, tokenId: target.id, alert: near ? '!' : '?' })
    }
  }
  return sightings
}

/** A marca de cada guarda que vê alguém: a mais forte entre o que ele vê ("!" vence "?"). */
export function guardAlerts(map: MapData, targetIds: ReadonlySet<string>, segments?: readonly Segment[]): Map<string, WatchAlert> {
  const alerts = new Map<string, WatchAlert>()
  for (const s of guardSightings(map, targetIds, segments)) {
    if (alerts.get(s.guardId) !== '!') alerts.set(s.guardId, s.alert)
  }
  return alerts
}

/**
 * O cone que o mestre vê no editor: o guarda na ponta e o arco até o alcance,
 * cortado pelos segmentos de visão. Um raio a cada `CONE_DEGREES_PER_RAY` graus
 * e mais dois em volta de cada quina de parede dentro do olhar — é o que deixa
 * a sombra da quina reta em vez de serrilhada. Com 360° não há ponta: o anel.
 */
export function watchConePolygon(guard: RegionPoint, watch: TokenWatch, grid: number, segments: readonly Segment[]): RegionPoint[] {
  const range = watch.alcance * grid
  const full = watch.abertura >= WATCH_APERTURE_MAX
  const span = (Math.min(watch.abertura, WATCH_APERTURE_MAX) * Math.PI) / 180
  const start = (watch.direcao * Math.PI) / 180 - span / 2
  const steps = Math.max(8, Math.ceil(Math.min(watch.abertura, WATCH_APERTURE_MAX) / CONE_DEGREES_PER_RAY))
  const offsets: number[] = []
  for (let i = 0; i <= steps; i++) offsets.push((span * i) / steps)
  for (const s of segments) {
    for (const p of [
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 },
    ]) {
      if (Math.hypot(p.x - guard.x, p.y - guard.y) > range) continue
      const base = Math.atan2(p.y - guard.y, p.x - guard.x)
      for (const angle of [base - CORNER_OFFSET, base, base + CORNER_OFFSET]) {
        const offset = (((angle - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        if (offset <= span) offsets.push(offset)
      }
    }
  }
  offsets.sort((a, b) => a - b)
  const arc = offsets.map((offset) => {
    const angle = start + offset
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const reach = Math.min(range, firstHit(guard, dx, dy, segments))
    return { x: guard.x + dx * reach, y: guard.y + dy * reach }
  })
  return full ? arc : [{ x: guard.x, y: guard.y }, ...arc]
}
