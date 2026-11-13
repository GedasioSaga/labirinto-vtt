import type { FloorPiece, FloorShape } from '../types/map'
import { blocosBounds, blocosCenter, blocosDistance } from './floorBlocks'
import { createPolygonDistance, type PolygonDistance } from './polygonSdf'

/**
 * Motor do chão por peças: cada peça vira uma função de distância assinada
 * (negativa dentro, positiva fora, zero na borda) e o chão inteiro é a
 * combinação delas NA ORDEM da lista — 'add' = min, 'subtract' = max(d, -p).
 * Buraco, arredondamento e borda irregular saem de conta simples sobre essa
 * distância, sem biblioteca de booleana de polígonos.
 */

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Folga somada ao retângulo de cada peça para o descarte por distância. */
const CULL_MARGIN = 8

type PontoDoCorredor = { x: number; y: number; width: number }

/** Comprimento máximo de um trecho da curva amostrada, em px de mundo (10 px: lisa na largura de um caminho, e barata na conta do contorno). */
const TRECHO_DA_CURVA = 10
/** Teto de trechos por segmento: um segmento enorme não vira milhares de pontos. */
const TRECHOS_MAXIMOS = 32
const curvaDoCorredor = new WeakMap<object, PontoDoCorredor[]>()

/**
 * CURVA SUAVE (pedido CHÃO E CAMINHO de 12/11/2026): o corredor com
 * `suave` passa por uma curva de Catmull-Rom pelos pontos da mão, amostrada
 * numa polilinha densa — o resto do motor (distância, contorno, limite) não
 * muda. Sem `suave`, os próprios pontos (as retas de sempre). Guardado pela
 * referência da forma (a store é imutável).
 */
export function pontosDoCorredor(shape: Extract<FloorShape, { kind: 'corridor' }>): PontoDoCorredor[] {
  if (shape.suave !== true || shape.points.length < 3) return shape.points
  const guardada = curvaDoCorredor.get(shape)
  if (guardada !== undefined) return guardada
  const p = shape.points
  const curva: PontoDoCorredor[] = [p[0]]
  for (let i = 0; i + 1 < p.length; i += 1) {
    const p0 = p[Math.max(0, i - 1)]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[Math.min(p.length - 1, i + 2)]
    const n = Math.min(TRECHOS_MAXIMOS, Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / TRECHO_DA_CURVA)))
    for (let k = 1; k <= n; k += 1) {
      const t = k / n
      const t2 = t * t
      const t3 = t2 * t
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      curva.push({ x, y, width: p1.width + (p2.width - p1.width) * t })
    }
  }
  curvaDoCorredor.set(shape, curva)
  return curva
}

/** Centro de corredor/polígono livre por referência da forma: entra em toda amostra do campo. */
const centroDosPontos = new WeakMap<object, { x: number; y: number }>()

export function shapeCenter(shape: FloorShape): { x: number; y: number } {
  if (shape.kind === 'blocos') return blocosCenter(shape)
  if (shape.kind !== 'corridor' && shape.kind !== 'poly') return { x: shape.cx, y: shape.cy }
  let centro = centroDosPontos.get(shape)
  if (centro === undefined) {
    const b = pointsBounds(shape.kind === 'corridor' ? pontosDoCorredor(shape) : shape.points)
    centro = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
    centroDosPontos.set(shape, centro)
  }
  return { ...centro }
}

/** Retângulo dos pontos; ponto com `width` (corredor) conta o raio dele. */
function pointsBounds(points: { x: number; y: number; width?: number }[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    const r = (p.width ?? 0) / 2
    minX = Math.min(minX, p.x - r)
    minY = Math.min(minY, p.y - r)
    maxX = Math.max(maxX, p.x + r)
    maxY = Math.max(maxY, p.y + r)
  }
  return { minX, minY, maxX, maxY }
}

/** Retângulo que envolve a peça já girada, com a folga do ruído e do arredondamento. */
export function pieceBounds(piece: FloorPiece): Bounds {
  const { shape } = piece
  const extra =
    (piece.modifiers.noise?.amplitude ?? 0) +
    (shape.kind === 'rect' ? 0 : piece.modifiers.rounding ?? 0) +
    Math.max(0, piece.modifiers.grow ?? 0)
  let halfW: number
  let halfH: number
  if (shape.kind === 'blocos') {
    const b = blocosBounds(shape)
    // Forma sem célula nenhuma: retângulo degenerado no centro, sem chão.
    halfW = b ? (b.maxX - b.minX) / 2 : 0
    halfH = b ? (b.maxY - b.minY) / 2 : 0
  } else if (shape.kind === 'corridor' || shape.kind === 'poly') {
    const b = pointsBounds(shape.kind === 'corridor' ? pontosDoCorredor(shape) : shape.points)
    halfW = (b.maxX - b.minX) / 2
    halfH = (b.maxY - b.minY) / 2
  } else if (shape.kind === 'rect') {
    halfW = shape.w / 2
    halfH = shape.h / 2
  } else if (shape.kind === 'ellipse') {
    halfW = shape.rx
    halfH = shape.ry
  } else {
    halfW = shape.radius
    halfH = shape.radius
  }
  const rad = ((piece.rotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const rw = halfW * cos + halfH * sin + extra
  const rh = halfW * sin + halfH * cos + extra
  const c = shapeCenter(shape)
  return { minX: c.x - rw, minY: c.y - rh, maxX: c.x + rw, maxY: c.y + rh }
}

function sdBox(px: number, py: number, hw: number, hh: number): number {
  const dx = Math.abs(px) - hw
  const dy = Math.abs(py) - hh
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  const inside = Math.min(Math.max(dx, dy), 0)
  return outside + inside
}

/** Aproximação de distância à elipse (erro pequeno perto da borda, que é onde importa). */
function sdEllipse(px: number, py: number, rx: number, ry: number): number {
  const k0 = Math.hypot(px / rx, py / ry)
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry))
  if (k1 === 0) return -Math.min(rx, ry)
  return (k0 * (k0 - 1)) / k1
}

/** Vértices do polígono regular com o primeiro vértice apontando para cima. */
export function regularPolygonVertices(radius: number, sides: number): { x: number; y: number }[] {
  const n = Math.max(3, Math.round(sides))
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
}

/** Distância assinada a um polígono simples qualquer (regra do número de voltas). */
function sdPolygon(px: number, py: number, vertices: { x: number; y: number }[]): number {
  let best = Infinity
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[j]
    const b = vertices[i]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const wx = px - a.x
    const wy = py - a.y
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    best = Math.min(best, Math.hypot(wx - ex * t, wy - ey * t))
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside ? -best : best
}

/**
 * Distância assinada ao trecho a→b do corredor (a largura varia ao longo
 * dele), ou `Infinity` quando ela não fica abaixo de `melhor`: a conta do
 * quadrado poda antes da raiz (`Math.hypot` é o que pesa). Quando volta
 * número, é a MESMA conta, na mesma ordem, da volta inteira de sempre.
 */
function distanciaAoTrecho(px: number, py: number, a: PontoDoCorredor, b: PontoDoCorredor, melhor: number): number {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const lengthSq = ex * ex + ey * ey
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * ex + (py - a.y) * ey) / lengthSq))
  const radius = (a.width + (b.width - a.width) * t) / 2
  const qx = px - a.x - ex * t
  const qy = py - a.y - ey * t
  // hypot >= 0 e hypot² ≈ qx² + qy² (erro relativo ~1e-16): o trecho podado mede mais que o melhor por ~FOLGA_DA_PODA.
  const limite = melhor + radius + FOLGA_DA_PODA
  if (limite <= 0 || qx * qx + qy * qy >= limite * limite) return Infinity
  return Math.hypot(qx, qy) - radius
}

/** Trechos por folha da árvore do corredor. */
const TRECHOS_POR_FOLHA = 4
/** Abaixo disto o corredor é medido trecho a trecho, como sempre: a árvore não paga. */
const TRECHOS_PARA_ARVORE = 16
/**
 * Folga da poda, em px: muito acima do erro de arredondamento da conta de um
 * trecho (~1e-11 px nas coordenadas de um mapa), e muito abaixo de qualquer
 * coisa que se veja. O trecho podado mede MAIS que o melhor por pelo menos isto.
 */
const FOLGA_DA_PODA = 1e-6

/**
 * ÁRVORE DE CAIXAS do corredor longo (FX-CAMINHO-062: o caminho de ~90 casas
 * com curva suave tem ~600 trechos, e cada amostra do contorno media a
 * distância a todos: 11 s numa tarefa só no Goa). Cada nó guarda a caixa dos
 * pontos de uma faixa de trechos seguidos e a maior meia largura deles; a
 * distância à caixa menos essa meia largura é um limite inferior de qualquer
 * trecho do nó. Nó cujo limite não chega no melhor já achado é pulado inteiro.
 * O mínimo é o MESMO da volta inteira, número por número: o trecho pulado mede
 * mais que o melhor (por `FOLGA_DA_PODA`), e o resto usa a mesma conta.
 */
interface ArvoreDoCorredor {
  /** minX, minY, maxX, maxY de cada nó. */
  caixas: Float64Array
  /** Maior meia largura dos pontos de cada nó. */
  raios: Float64Array
  /** Faixa de trechos [inicio, fim) de cada folha. */
  inicio: Int32Array
  fim: Int32Array
  /** Filhos do nó interno; -1 na folha. */
  esquerda: Int32Array
  direita: Int32Array
  /** Pilha de trabalho da busca (nó e distância quadrada até a caixa dele). */
  pilha: Int32Array
  pilhaDaDistancia: Float64Array
  /**
   * A folha do melhor trecho da última busca: o contorno pergunta pontos
   * vizinhos em sequência, e começar por ela já dá um melhor que poda quase
   * tudo. Só muda a ordem da conta, não o mínimo.
   */
  ultimaFolha: number
}

function montarArvore(points: readonly PontoDoCorredor[]): ArvoreDoCorredor | null {
  // Número que não é finito: a volta inteira de sempre (a conta de caixa não vale para ele).
  for (const p of points) if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.width)) return null
  const trechos = points.length - 1
  // Cada folha tem ao menos um trecho e a árvore é binária: menos de 2 nós por trecho.
  const maxNos = 2 * trechos
  const caixas = new Float64Array(maxNos * 4)
  const raios = new Float64Array(maxNos)
  const inicio = new Int32Array(maxNos)
  const fim = new Int32Array(maxNos)
  const esquerda = new Int32Array(maxNos).fill(-1)
  const direita = new Int32Array(maxNos).fill(-1)
  let nos = 0
  let profundidade = 0
  const montar = (i0: number, i1: number, nivel: number): number => {
    const n = nos
    nos += 1
    profundidade = Math.max(profundidade, nivel)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let raio = -Infinity
    // Os pontos dos trechos i0..i1-1 são os de índice i0..i1.
    for (let i = i0; i <= i1; i += 1) {
      const p = points[i]
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
      raio = Math.max(raio, p.width / 2)
    }
    caixas[n * 4] = minX
    caixas[n * 4 + 1] = minY
    caixas[n * 4 + 2] = maxX
    caixas[n * 4 + 3] = maxY
    raios[n] = raio
    inicio[n] = i0
    fim[n] = i1
    if (i1 - i0 > TRECHOS_POR_FOLHA) {
      const meio = (i0 + i1) >> 1
      esquerda[n] = montar(i0, meio, nivel + 1)
      direita[n] = montar(meio, i1, nivel + 1)
    }
    return n
  }
  montar(0, trechos, 1)
  // Cada nó tirado da pilha põe no máximo dois: a pilha nunca passa de 2 por nível.
  const tamanhoDaPilha = 2 * profundidade + 2
  return {
    caixas,
    raios,
    inicio,
    fim,
    esquerda,
    direita,
    pilha: new Int32Array(tamanhoDaPilha),
    pilhaDaDistancia: new Float64Array(tamanhoDaPilha),
    ultimaFolha: -1,
  }
}

/** O corredor pronto para medir: centro, curva (`pontosDoCorredor`) e a árvore dos trechos (`null` = volta inteira). */
interface CorredorPronto {
  centro: { x: number; y: number }
  pontos: readonly PontoDoCorredor[]
  arvore: ArvoreDoCorredor | null
}

/** Guardado pela referência da forma (a store é imutável), como a curva e o centro. */
const corredorPorForma = new WeakMap<object, CorredorPronto>()

function corredorPronto(shape: Extract<FloorShape, { kind: 'corridor' }>): CorredorPronto {
  let pronto = corredorPorForma.get(shape)
  if (pronto === undefined) {
    const pontos = pontosDoCorredor(shape)
    pronto = { centro: shapeCenter(shape), pontos, arvore: pontos.length > TRECHOS_PARA_ARVORE ? montarArvore(pontos) : null }
    corredorPorForma.set(shape, pronto)
  }
  return pronto
}

function distanciaQuadradaACaixa(caixas: Float64Array, n: number, px: number, py: number): number {
  const dx = Math.max(caixas[n * 4] - px, 0, px - caixas[n * 4 + 2])
  const dy = Math.max(caixas[n * 4 + 1] - py, 0, py - caixas[n * 4 + 3])
  return dx * dx + dy * dy
}

function sdCorridorPelaArvore(px: number, py: number, points: readonly PontoDoCorredor[], arvore: ArvoreDoCorredor): number {
  const { caixas, raios, inicio, fim, esquerda, direita, pilha, pilhaDaDistancia } = arvore
  let best = Infinity
  // Começa pela folha da busca anterior (a vizinha): o trecho dela é de verdade, então o mínimo não muda.
  const semente = arvore.ultimaFolha
  let folhaDoMelhor = semente
  if (semente >= 0) {
    for (let i = inicio[semente]; i < fim[semente]; i += 1) best = Math.min(best, distanciaAoTrecho(px, py, points[i], points[i + 1], best))
  }
  pilha[0] = 0
  pilhaDaDistancia[0] = distanciaQuadradaACaixa(caixas, 0, px, py)
  let topo = 1
  while (topo > 0) {
    topo -= 1
    const n = pilha[topo]
    // Nenhum trecho do nó mede menos que (distância à caixa − maior meia largura): pula se isso não ganha do melhor.
    const limite = best + raios[n] + FOLGA_DA_PODA
    if (limite <= 0 || pilhaDaDistancia[topo] >= limite * limite) continue
    const e = esquerda[n]
    if (e < 0) {
      // A semente já entrou no melhor.
      if (n === semente) continue
      for (let i = inicio[n]; i < fim[n]; i += 1) {
        const v = distanciaAoTrecho(px, py, points[i], points[i + 1], best)
        if (v < best) folhaDoMelhor = n
        best = Math.min(best, v)
      }
      continue
    }
    const d = direita[n]
    const de = distanciaQuadradaACaixa(caixas, e, px, py)
    const dd = distanciaQuadradaACaixa(caixas, d, px, py)
    // O mais perto sai primeiro (fica no topo): o melhor cai cedo e poda mais.
    if (de <= dd) {
      pilha[topo] = d
      pilhaDaDistancia[topo] = dd
      pilha[topo + 1] = e
      pilhaDaDistancia[topo + 1] = de
    } else {
      pilha[topo] = e
      pilhaDaDistancia[topo] = de
      pilha[topo + 1] = d
      pilhaDaDistancia[topo + 1] = dd
    }
    topo += 2
  }
  arvore.ultimaFolha = folhaDoMelhor
  return best
}

function sdCorridor(px: number, py: number, points: readonly PontoDoCorredor[], arvore: ArvoreDoCorredor | null): number {
  if (points.length === 0) return Infinity
  if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y) - points[0].width / 2
  if (arvore !== null) return sdCorridorPelaArvore(px, py, points, arvore)
  let best = Infinity
  for (let i = 0; i + 1 < points.length; i += 1) best = Math.min(best, distanciaAoTrecho(px, py, points[i], points[i + 1], best))
  return best
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Uma oitava do ruído de valor (fora de `valueNoise`: era um fecho novo a cada amostra do contorno). */
function octave(fx: number, fy: number, s: number): number {
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const top = hash2(ix, iy, s) + (hash2(ix + 1, iy, s) - hash2(ix, iy, s)) * sx
  const bottom = hash2(ix, iy + 1, s) + (hash2(ix + 1, iy + 1, s) - hash2(ix, iy + 1, s)) * sx
  return top + (bottom - top) * sy
}

/** Ruído de valor 2D suavizado, em [-1, 1], duas oitavas. */
export function valueNoise(x: number, y: number, seed: number): number {
  return (octave(x, y, seed) * 2 + octave(x * 2.3, y * 2.3, seed + 7919)) / 3
}

/**
 * Índice espacial por forma. A store é imutável — forma editada é objeto novo —
 * então a própria referência da forma é a chave do cache, sem invalidação manual.
 */
const polygonDistanceCache = new WeakMap<object, PolygonDistance>()

function polygonDistanceFor(shape: Extract<FloorShape, { kind: 'poly' }>): PolygonDistance {
  let distance = polygonDistanceCache.get(shape)
  if (!distance) {
    distance = createPolygonDistance(shape.points)
    polygonDistanceCache.set(shape, distance)
  }
  return distance
}

/** Distância assinada de uma peça isolada (sem combinar com as outras). */
export function pieceDistance(piece: FloorPiece, x: number, y: number): number {
  const { shape, modifiers } = piece
  // Corredor: centro, curva e árvore numa consulta só (eram três, a cada amostra do contorno).
  const corredor = shape.kind === 'corridor' ? corredorPronto(shape) : undefined
  const center = corredor !== undefined ? corredor.centro : shapeCenter(shape)
  let px = x - center.x
  let py = y - center.y
  const rotation = piece.rotation ?? 0
  if (rotation !== 0) {
    const rad = (-rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const rx = px * cos - py * sin
    py = px * sin + py * cos
    px = rx
  }
  const rounding = Math.max(0, modifiers.rounding ?? 0)
  let d: number
  if (shape.kind === 'rect') {
    // Arredondamento de retângulo encolhe antes e expande depois: o tamanho externo não muda.
    const r = Math.min(rounding, shape.w / 2, shape.h / 2)
    d = sdBox(px, py, shape.w / 2 - r, shape.h / 2 - r) - r
  } else if (shape.kind === 'ellipse') {
    d = sdEllipse(px, py, shape.rx, shape.ry) - rounding
  } else if (shape.kind === 'polygon') {
    d = sdPolygon(px, py, regularPolygonVertices(shape.radius, shape.sides)) - rounding
  } else if (shape.kind === 'poly') {
    d = polygonDistanceFor(shape)(px + center.x, py + center.y) - rounding
  } else if (shape.kind === 'blocos') {
    d = blocosDistance(shape, px + center.x, py + center.y) - rounding
  } else {
    const pronto = corredor ?? corredorPronto(shape)
    d = sdCorridor(px + center.x, py + center.y, pronto.pontos, pronto.arvore) - rounding
  }
  const noise = modifiers.noise
  if (noise && noise.amplitude > 0 && noise.scale > 0) {
    d += valueNoise(x / noise.scale, y / noise.scale, noise.seed) * noise.amplitude
  }
  return d - (modifiers.grow ?? 0)
}

export interface CompiledFloor {
  /** Distância assinada do chão inteiro no ponto. Sinal exato; módulo exato só perto da borda. */
  sample: (x: number, y: number) => number
  /** Retângulo das peças 'add' visíveis, ou `null` se não há chão. */
  bounds: Bounds | null
  /**
   * Quanto `sample` pode variar por px andado (constante de Lipschitz, com
   * folga). Sem ruído é ~1; o ruído aumenta. Permite pular regiões inteiras
   * longe da borda na amostragem (`sampleFloorGrid`).
   */
  lipschitz: number
}

/** Inclinação máxima de `valueNoise` por unidade de entrada (duas oitavas, smoothstep), com folga. */
const NOISE_SLOPE = 6.5
/** Folga para a aproximação de distância da elipse, que não é exatamente 1-Lipschitz. */
const LIPSCHITZ_SAFETY = 1.25

function distanceToBounds(b: Bounds, x: number, y: number): number {
  const dx = Math.max(b.minX - x, 0, x - b.maxX)
  const dy = Math.max(b.minY - y, 0, y - b.maxY)
  return Math.hypot(dx, dy)
}

/**
 * Prepara as peças para amostragem repetida. Fora do retângulo de uma peça
 * (mais `CULL_MARGIN`) a distância dela é trocada pela distância ao retângulo,
 * que é um limite inferior: o sinal do resultado nunca muda e, perto da
 * borda (|d| < margem), o valor também é exato.
 */
export function compileFloor(pieces: FloorPiece[]): CompiledFloor {
  const visible = pieces.filter((piece) => !piece.hidden)
  const entries = visible.map((piece) => {
    const b = pieceBounds(piece)
    return {
      piece,
      bounds: b,
      culled: { minX: b.minX - CULL_MARGIN, minY: b.minY - CULL_MARGIN, maxX: b.maxX + CULL_MARGIN, maxY: b.maxY + CULL_MARGIN },
    }
  })

  let bounds: Bounds | null = null
  for (const entry of entries) {
    if (entry.piece.op !== 'add') continue
    bounds = bounds
      ? {
          minX: Math.min(bounds.minX, entry.bounds.minX),
          minY: Math.min(bounds.minY, entry.bounds.minY),
          maxX: Math.max(bounds.maxX, entry.bounds.maxX),
          maxY: Math.max(bounds.maxY, entry.bounds.maxY),
        }
      : { ...entry.bounds }
  }

  const sample = (x: number, y: number): number => {
    let d = Infinity
    for (const entry of entries) {
      const c = entry.culled
      const outside = x < c.minX || x > c.maxX || y < c.minY || y > c.maxY
      const p = outside ? Math.max(distanceToBounds(entry.bounds, x, y), CULL_MARGIN) : pieceDistance(entry.piece, x, y)
      d = entry.piece.op === 'add' ? Math.min(d, p) : Math.max(d, -p)
    }
    return d
  }

  let noiseSlope = 0
  for (const entry of entries) {
    const noise = entry.piece.modifiers.noise
    if (noise && noise.amplitude > 0 && noise.scale > 0) noiseSlope = Math.max(noiseSlope, (NOISE_SLOPE * noise.amplitude) / noise.scale)
  }

  return { sample, bounds, lipschitz: (1 + noiseSlope) * LIPSCHITZ_SAFETY }
}
