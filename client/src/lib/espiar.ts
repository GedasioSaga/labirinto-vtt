import type { RegionPoint } from '../types/map'

/**
 * ESPIAR PELA PASSAGEM — o jogador encostado num pino de viagem marcado "Dá
 * vista" vê, por alguns segundos, um recorte do outro lado: em volta do pino
 * par, até N casas, com a névoa, a parede e a zona oculta de lá. Nada disso
 * vira memória dele (nem no host, nem na tela).
 *
 * O recorte viaja em coordenadas RELATIVAS ao pino par (ele fica em 0,0): o
 * jogador não recebe a posição do pino na outra cena, nem o tamanho do mapa,
 * nem nome ou id de nada de lá — só a forma do que se vê e pontos coloridos.
 */

/** Faixa do "Dá vista (N casas)" no painel do mestre. */
export const DA_VISTA_MIN_CASAS = 1
export const DA_VISTA_MAX_CASAS = 6
/** O que o painel sugere ao ligar. */
export const DA_VISTA_PADRAO_CASAS = 3

/** Quanto tempo o recorte fica na tela do jogador. É o host quem diz; este é o que ele manda. */
export const ESPIAR_DURACAO_MS = 4000
/** Maior tempo que o jogador aceita do host: acima disso a mensagem inteira cai. */
export const ESPIAR_DURACAO_MAX_MS = 30_000

/**
 * Um pedido de espiar por jogador nesta janela. Igual à duração: enquanto o
 * recorte está na tela, outro pedido só faria a mesa do mestre piscar avisos.
 */
export const ESPIAR_INTERVALO_MIN_MS = ESPIAR_DURACAO_MS

/**
 * "Encostado": a borda da ficha a até esta distância do pino, em casas. Com a
 * ficha de 1 casa, o centro dela até 1,5 casa do pino — a casa do lado, mesmo
 * na diagonal.
 */
export const ESPIAR_ALCANCE_CASAS = 1

/**
 * Tetos do que o jogador aceita num recorte, abaixo de um host hostil enchendo
 * a tela. O host confere os MESMOS tetos antes de mandar (`espiadaCabe`): o que
 * passaria daqui ele recusa, em vez de mandar um recorte que o jogador jogaria fora.
 *
 * Anéis por lista: o pincel de revelar corta em faixas de 10 px, uma por linha
 * de células — 6 casas de raio numa grade de 50 são 60 linhas, e cada linha
 * com buraco vira duas ou três peças. 32 não cabia nem uma faixa pincelada.
 */
export const ESPIADA_MAX_ANEIS = 256
export const ESPIADA_MAX_PONTOS_POR_ANEL = 4096
/** Pontos somando visão, zonas ocultas e tetos: o que segura a lista de anéis maior. */
export const ESPIADA_MAX_PONTOS = 32_768
export const ESPIADA_MAX_PAREDES = 512
export const ESPIADA_MAX_PORTAS = 128
export const ESPIADA_MAX_FICHAS = 64

export interface EspiadaParede {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface EspiadaPorta extends EspiadaParede {
  open: boolean
}

/** Uma ficha do outro lado: onde, de que tamanho (em casas) e de que cor. Nem id, nem nome. */
export interface EspiadaFicha {
  x: number
  y: number
  size: number
  color: string
}

/** O recorte do outro lado, relativo ao pino par (0,0). */
export interface Espiada {
  /** Raio do recorte, em px do mapa de lá (casas × grade). */
  raio: number
  grid: number
  /** O que se vê: pintado como chão chapado. */
  vision: RegionPoint[][]
  walls: EspiadaParede[]
  doors: EspiadaPorta[]
  tokens: EspiadaFicha[]
  /** Zonas ocultas de lá que tocam o recorte: pintadas de preto por cima. */
  concealed: RegionPoint[][]
  /** Prédios de teto fechado que tocam o recorte: pintados como silhueta. */
  roofs: RegionPoint[][]
}

/** "Dá vista": inteiro de casas dentro da faixa. Qualquer outra coisa é "não dá vista". */
export function isDaVista(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= DA_VISTA_MIN_CASAS && value <= DA_VISTA_MAX_CASAS
}

/** Corta o pedido de casas na faixa. Número torto vira o mínimo: nunca a cena inteira. */
export function clampDaVista(casas: number): number {
  if (!Number.isFinite(casas)) return DA_VISTA_MIN_CASAS
  return Math.min(DA_VISTA_MAX_CASAS, Math.max(DA_VISTA_MIN_CASAS, Math.round(casas)))
}

/**
 * O trecho do segmento dentro do círculo de raio `r` centrado em (0,0), ou
 * `null` quando ele não entra. Paramétrico: p(t) = a + t·(b − a), t em [0, 1].
 */
export function clipSegmentToCircle(seg: EspiadaParede, r: number): EspiadaParede | null {
  const dx = seg.x2 - seg.x1
  const dy = seg.y2 - seg.y1
  const a = dx * dx + dy * dy
  const inside = (x: number, y: number) => x * x + y * y <= r * r
  if (a === 0) return inside(seg.x1, seg.y1) ? { ...seg } : null
  const b = 2 * (seg.x1 * dx + seg.y1 * dy)
  const c = seg.x1 * seg.x1 + seg.y1 * seg.y1 - r * r
  const disc = b * b - 4 * a * c
  if (disc <= 0) return null
  const raiz = Math.sqrt(disc)
  const t0 = Math.max(0, (-b - raiz) / (2 * a))
  const t1 = Math.min(1, (-b + raiz) / (2 * a))
  if (t0 >= t1) return null
  return { x1: seg.x1 + t0 * dx, y1: seg.y1 + t0 * dy, x2: seg.x1 + t1 * dx, y2: seg.y1 + t1 * dy }
}

/**
 * Lados do polígono que faz as vezes do círculo no corte de anel. Ele é
 * CIRCUNSCRITO (cada lado tangente ao círculo): nada de dentro do raio se perde,
 * e o que sobra para fora é a flecha do lado — r·(1/cos(π/64) − 1), 0,4 px com
 * 6 casas numa grade de 50.
 */
const LADOS_DO_CORTE = 64
/** Peça de área menor que isto (px²) é resto do corte, não forma: não vai. */
const AREA_MINIMA_DO_CORTE = 0.5

/** Área (sem sinal) pela fórmula do cadarço. */
function areaOf(ring: readonly RegionPoint[]): number {
  let twice = 0
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]
    if (b !== undefined) twice += a.x * b.y - b.x * a.y
  })
  return Math.abs(twice) / 2
}

/** Sutherland–Hodgman contra um semiplano: fica o que tem `p·n ≤ r`. */
function clipRingToHalfPlane(ring: readonly RegionPoint[], nx: number, ny: number, r: number): RegionPoint[] {
  const out: RegionPoint[] = []
  const side = (p: RegionPoint) => p.x * nx + p.y * ny - r
  ring.forEach((cur, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length]
    if (prev === undefined) return
    const sCur = side(cur)
    const sPrev = side(prev)
    if ((sCur <= 0) !== (sPrev <= 0)) {
      const t = sPrev / (sPrev - sCur)
      out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) })
    }
    if (sCur <= 0) out.push({ x: cur.x, y: cur.y })
  })
  return out
}

/**
 * O pedaço do anel dentro do círculo de raio `r` centrado em (0,0), ou `null`
 * quando não sobra forma. Anel côncavo sai num polígono só (pode ter lado
 * colado na borda do corte): serve para PINTAR, que é o que o recorte faz.
 */
export function clipRingToCircle(ring: readonly RegionPoint[], r: number): RegionPoint[] | null {
  let clipped: RegionPoint[] = [...ring]
  for (let k = 0; k < LADOS_DO_CORTE && clipped.length >= 3; k += 1) {
    const angle = (2 * Math.PI * k) / LADOS_DO_CORTE
    clipped = clipRingToHalfPlane(clipped, Math.cos(angle), Math.sin(angle), r / Math.cos(Math.PI / LADOS_DO_CORTE))
  }
  return clipped.length >= 3 && areaOf(clipped) >= AREA_MINIMA_DO_CORTE ? clipped : null
}

function ringsCabem(rings: readonly (readonly RegionPoint[])[]): boolean {
  return rings.length <= ESPIADA_MAX_ANEIS && rings.every((ring) => ring.length <= ESPIADA_MAX_PONTOS_POR_ANEL)
}

function totalDePontos(...lists: readonly (readonly (readonly RegionPoint[])[])[]): number {
  return lists.reduce((sum, rings) => sum + rings.reduce((n, ring) => n + ring.length, 0), 0)
}

/**
 * O recorte cabe nos tetos que o jogador aceita (`parseEspiada`)? O host
 * confere antes de mandar: recorte grande demais vira recusa, nunca uma
 * mensagem que o jogador descarta calado.
 */
export function espiadaCabe(e: Espiada): boolean {
  return (
    ringsCabem(e.vision) &&
    ringsCabem(e.concealed) &&
    ringsCabem(e.roofs) &&
    totalDePontos(e.vision, e.concealed, e.roofs) <= ESPIADA_MAX_PONTOS &&
    e.walls.length <= ESPIADA_MAX_PAREDES &&
    e.doors.length <= ESPIADA_MAX_PORTAS &&
    e.tokens.length <= ESPIADA_MAX_FICHAS
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** A cor da ficha vai direto para o `fill` do desenho: só `#rrggbb`. */
const COR_FICHA = /^#[0-9a-f]{6}$/i

function parseRings(value: unknown): RegionPoint[][] | null {
  if (!Array.isArray(value) || value.length > ESPIADA_MAX_ANEIS) return null
  const rings: RegionPoint[][] = []
  for (const ring of value) {
    if (!Array.isArray(ring) || ring.length > ESPIADA_MAX_PONTOS_POR_ANEL) return null
    const points: RegionPoint[] = []
    for (const p of ring) {
      if (!isRecord(p) || !isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return null
      points.push({ x: p.x, y: p.y })
    }
    rings.push(points)
  }
  return rings
}

function parseSegment(value: unknown): EspiadaParede | null {
  if (!isRecord(value)) return null
  const { x1, y1, x2, y2 } = value
  if (!isFiniteNumber(x1) || !isFiniteNumber(y1) || !isFiniteNumber(x2) || !isFiniteNumber(y2)) return null
  return { x1, y1, x2, y2 }
}

function parseList<T>(value: unknown, max: number, parseItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const out: T[] = []
  for (const item of value) {
    const parsed = parseItem(item)
    if (parsed === null) return null
    out.push(parsed)
  }
  return out
}

function parseDoor(value: unknown): EspiadaPorta | null {
  const seg = parseSegment(value)
  if (seg === null || !isRecord(value) || typeof value.open !== 'boolean') return null
  return { ...seg, open: value.open }
}

function parseToken(value: unknown): EspiadaFicha | null {
  if (!isRecord(value)) return null
  const { x, y, size, color } = value
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(size) || size <= 0) return null
  if (typeof color !== 'string' || !COR_FICHA.test(color)) return null
  return { x, y, size, color }
}

/**
 * Valida o recorte que o jogador recebe. O mestre é confiável, mas o que chega
 * vai para a tela: forma errada, número não finito, cor fora de `#rrggbb` ou
 * lista acima do teto recusam o recorte inteiro. Devolve cópia só com os campos
 * conhecidos — um nome de cena que viesse junto fica para trás.
 */
export function parseEspiada(value: unknown): Espiada | null {
  if (!isRecord(value)) return null
  const { raio, grid } = value
  if (!isFiniteNumber(raio) || raio <= 0 || !isFiniteNumber(grid) || grid <= 0) return null
  const vision = parseRings(value.vision)
  const concealed = parseRings(value.concealed)
  const roofs = parseRings(value.roofs)
  const walls = parseList(value.walls, ESPIADA_MAX_PAREDES, parseSegment)
  const doors = parseList(value.doors, ESPIADA_MAX_PORTAS, parseDoor)
  const tokens = parseList(value.tokens, ESPIADA_MAX_FICHAS, parseToken)
  if (vision === null || concealed === null || roofs === null || walls === null || doors === null || tokens === null) return null
  if (totalDePontos(vision, concealed, roofs) > ESPIADA_MAX_PONTOS) return null
  return { raio, grid, vision, walls, doors, tokens, concealed, roofs }
}
