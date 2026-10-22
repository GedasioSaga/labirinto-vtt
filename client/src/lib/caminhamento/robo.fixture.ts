import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import type { FichaNoCaminho } from './busca'
import { TOLERANCIA_ENTRE_FICHAS } from './busca'
import { distanciaAoTraco, distanciaAteParede, folgaDaParede, type MapaDoCaminho, papelDaParede } from './malha'

/**
 * O ROBÔ DO CAMINHAMENTO — mapas gerados com semente fixa (salas e
 * corredores em faixas, portas fechadas, abertas e trancadas, janelas, vãos,
 * pilares tortos, fichas paradas) e um ORÁCULO independente do motor: Dijkstra
 * numa rede de meia casa (o motor anda em casas inteiras), com as mesmas regras
 * de passagem (folga da parede, porta destrancada passa, trancada e janela
 * barram, ficha não se encosta). O ótimo do oráculo é a régua do robô: o motor
 * não se mede por ele mesmo. Só teste importa este arquivo.
 */

/** Sorteio com semente (mulberry32): mesma semente, mesmo mapa. */
export function sorteador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Sala {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface MapaDoRobo {
  mapa: MapaDoCaminho
  fichas: FichaNoCaminho[]
  salas: Sala[]
  /** A sala sem entrada (mapa com destino sem caminho), ou `null`. */
  isolada: number | null
}

type Ligacao = 'aberto' | 'vao' | 'porta' | 'portaAberta' | 'trancada' | 'janela' | 'parede'

interface Fronteira {
  a: number
  b: number
  vertical: boolean
  /** Em casas: a linha (x da vertical, y da horizontal) e o trecho dela. */
  linha: number
  de: number
  ate: number
}

function faixas(total: number, minima: number, inteiro: (a: number, b: number) => number, sorte: () => number): number[] {
  const larguras: number[] = []
  let soma = 0
  while (soma < total) {
    const w = Math.min(total - soma, sorte() < 0.25 ? minima : inteiro(minima + 1, 7))
    larguras.push(w)
    soma += w
  }
  return larguras
}

function raiz(pais: number[], i: number): number {
  let r = i
  while (pais[r] !== r) r = pais[r] ?? r
  return r
}

/**
 * Um mapa de salas e corredores para o robô, com semente fixa. `tamanho`: o
 * da ficha que vai andar nele (corredor e passagem têm pelo menos essa largura).
 */
export function gerarMapaDoRobo(semente: number, grid: number, isolar: boolean, tamanho: number, dimensoes?: { largura: number; altura: number }): MapaDoRobo {
  const sorte = sorteador(semente)
  const inteiro = (a: number, b: number) => a + Math.floor(sorte() * (b - a + 1))
  const largura = dimensoes?.largura ?? inteiro(24, 56)
  const altura = dimensoes?.altura ?? inteiro(24, 56)
  const colunas = faixas(largura, tamanho, inteiro, sorte)
  const linhas = faixas(altura, tamanho, inteiro, sorte)
  const xs = colunas.reduce<number[]>((acc, w) => [...acc, (acc[acc.length - 1] ?? 0) + w], [0])
  const ys = linhas.reduce<number[]>((acc, h) => [...acc, (acc[acc.length - 1] ?? 0) + h], [0])
  const salas: Sala[] = []
  for (let r = 0; r < linhas.length; r += 1) for (let c = 0; c < colunas.length; c += 1) salas.push({ x0: xs[c] ?? 0, x1: xs[c + 1] ?? 0, y0: ys[r] ?? 0, y1: ys[r + 1] ?? 0 })
  const nc = colunas.length
  const fronteiras: Fronteira[] = []
  for (let r = 0; r < linhas.length; r += 1) {
    for (let c = 0; c < nc; c += 1) {
      const i = r * nc + c
      if (c + 1 < nc) fronteiras.push({ a: i, b: i + 1, vertical: true, linha: xs[c + 1] ?? 0, de: ys[r] ?? 0, ate: ys[r + 1] ?? 0 })
      if (r + 1 < linhas.length) fronteiras.push({ a: i, b: i + nc, vertical: false, linha: ys[r + 1] ?? 0, de: xs[c] ?? 0, ate: xs[c + 1] ?? 0 })
    }
  }
  const isolada = isolar && salas.length > 4 ? inteiro(1, salas.length - 1) : null
  // Árvore que liga todas as salas (menos a isolada) por passagens; o resto sorteia.
  const pais = salas.map((_, i) => i)
  const ordem = fronteiras.map((f, i) => ({ f, chave: sorte(), i })).sort((p, q) => p.chave - q.chave || p.i - q.i)
  const ligacoes = new Map<Fronteira, Ligacao>()
  for (const { f } of ordem) {
    const tocaIsolada = f.a === isolada || f.b === isolada
    const ra = raiz(pais, f.a)
    const rb = raiz(pais, f.b)
    if (!tocaIsolada && ra !== rb) {
      pais[ra] = rb
      const s = sorte()
      ligacoes.set(f, s < 0.2 ? 'aberto' : s < 0.55 ? 'vao' : s < 0.85 ? 'porta' : 'portaAberta')
      continue
    }
    const s = sorte()
    if (tocaIsolada) ligacoes.set(f, s < 0.5 ? 'parede' : s < 0.75 ? 'trancada' : 'janela')
    else ligacoes.set(f, s < 0.45 ? 'parede' : s < 0.6 ? 'vao' : s < 0.7 ? 'porta' : s < 0.8 ? 'trancada' : s < 0.95 ? 'janela' : 'aberto')
  }
  const walls: Wall[] = []
  let n = 0
  const novaParede = (x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}) => {
    n += 1
    walls.push({ id: `p${n}`, x1: x1 * grid, y1: y1 * grid, x2: x2 * grid, y2: y2 * grid, blocksLight: true, blocksMove: true, door: null, ...extra })
  }
  const pedaco = (f: Fronteira, de: number, ate: number, extra: Partial<Wall> = {}) => {
    if (ate <= de) return
    if (f.vertical) novaParede(f.linha, de, f.linha, ate, extra)
    else novaParede(de, f.linha, ate, f.linha, extra)
  }
  for (const f of fronteiras) {
    const ligacao = ligacoes.get(f) ?? 'parede'
    const comprimento = f.ate - f.de
    if (ligacao === 'aberto') continue
    if (ligacao === 'parede') {
      pedaco(f, f.de, f.ate)
      continue
    }
    const passagem = Math.min(tamanho, comprimento)
    const vao =
      ligacao === 'vao'
        ? inteiro(passagem, Math.max(passagem, Math.min(3, comprimento)))
        : ligacao === 'janela'
          ? inteiro(1, Math.min(2, comprimento))
          : Math.max(passagem, comprimento >= 3 && sorte() < 0.3 ? 2 : 1)
    const inicio = f.de + inteiro(0, comprimento - vao)
    pedaco(f, f.de, inicio)
    pedaco(f, inicio + vao, f.ate)
    if (ligacao === 'porta' || ligacao === 'portaAberta' || ligacao === 'trancada') {
      pedaco(f, inicio, inicio + vao, { door: { open: ligacao === 'portaAberta', locked: ligacao === 'trancada', kind: vao === 2 ? 'double' : 'normal' } })
    } else if (ligacao === 'janela') {
      pedaco(f, inicio, inicio + vao, { janela: true, blocksMove: sorte() < 0.7 })
    }
  }
  // A borda do mapa.
  novaParede(0, 0, largura, 0)
  novaParede(largura, 0, largura, altura)
  novaParede(largura, altura, 0, altura)
  novaParede(0, altura, 0, 0)
  // Pilares tortos (fora da grade, em 45°) no meio das salas grandes.
  for (const sala of salas) {
    if (sala.x1 - sala.x0 < 5 || sala.y1 - sala.y0 < 5 || sorte() > 0.4) continue
    const cx = sala.x0 + 2 + sorte() * (sala.x1 - sala.x0 - 4)
    const cy = sala.y0 + 2 + sorte() * (sala.y1 - sala.y0 - 4)
    const meio = 0.35 + sorte() * 0.2
    const sinal = sorte() < 0.5 ? 1 : -1
    novaParede(cx - meio, cy - meio * sinal, cx + meio, cy + meio * sinal)
  }
  // Fichas paradas no centro de casas sorteadas (às vezes num corredor).
  const fichas: FichaNoCaminho[] = []
  const quantas = inteiro(2, 2 + Math.floor((largura * altura) / 200))
  for (let k = 0; k < quantas; k += 1) {
    const sala = salas[inteiro(0, salas.length - 1)]
    if (sala === undefined) continue
    const x = (inteiro(sala.x0, sala.x1 - 1) + 0.5) * grid
    const y = (inteiro(sala.y0, sala.y1 - 1) + 0.5) * grid
    if (fichas.some((f) => f.x === x && f.y === y)) continue
    fichas.push({ id: `f${k}`, x, y, raio: grid / 2 })
  }
  return { mapa: { walls, grid, width: largura, height: altura }, fichas, salas, isolada }
}

const DIRECOES: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/**
 * O ÓTIMO de verdade, por outro caminho de código: Dijkstra numa rede de meia
 * casa, onde cada ponto e cada aresta guardam a folga das paredes que barram
 * (parede, janela, porta trancada ou secreta) e das fichas. Porta destrancada
 * não conta: passa abrindo. Mais livre que o motor (rede mais fina), então o
 * ótimo dele é no máximo o do motor.
 */
export class Oraculo {
  private readonly passo: number
  private readonly n: number
  private readonly m: number
  private readonly livre: Uint8Array
  private readonly arestas: Uint8Array
  private readonly raio: number
  private readonly grid: number

  constructor(mapa: MapaDoCaminho, raio: number) {
    const { grid } = mapa
    this.grid = grid
    this.raio = raio
    this.passo = grid / 2
    this.n = 2 * mapa.width - 1
    this.m = 2 * mapa.height - 1
    const folga = folgaDaParede(raio, grid)
    const barram = mapa.walls.filter((w) => {
      const papel = papelDaParede(w)
      return papel === 'parede' || papel === 'trancada'
    })
    const total = this.n * this.m
    this.livre = new Uint8Array(total)
    this.arestas = new Uint8Array(total)
    const baldes = new Map<number, Wall[]>()
    const margem = folga + grid
    for (const w of barram) {
      const i0 = Math.floor((Math.min(w.x1, w.x2) - margem) / grid)
      const i1 = Math.floor((Math.max(w.x1, w.x2) + margem) / grid)
      const j0 = Math.floor((Math.min(w.y1, w.y2) - margem) / grid)
      const j1 = Math.floor((Math.max(w.y1, w.y2) + margem) / grid)
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const chave = i * 10007 + j
          const lista = baldes.get(chave)
          if (lista === undefined) baldes.set(chave, [w])
          else lista.push(w)
        }
      }
    }
    const perto = (p: Point) => baldes.get(Math.floor(p.x / grid) * 10007 + Math.floor(p.y / grid)) ?? []
    const largura = mapa.width * grid
    const alturaPx = mapa.height * grid
    for (let l = 0; l < this.m; l += 1) {
      for (let k = 0; k < this.n; k += 1) {
        const p = this.ponto(k + l * this.n)
        const dentro = p.x >= raio - 1e-6 && p.y >= raio - 1e-6 && p.x <= largura - raio + 1e-6 && p.y <= alturaPx - raio + 1e-6
        if (dentro && perto(p).every((w) => distanciaAteParede(p, p, w) >= folga)) this.livre[k + l * this.n] = 1
      }
    }
    for (let no = 0; no < total; no += 1) {
      if (this.livre[no] !== 1) continue
      const p = this.ponto(no)
      let bits = 0
      DIRECOES.forEach(([dx, dy], dir) => {
        const outro = this.vizinho(no, dx, dy)
        if (outro < 0 || this.livre[outro] !== 1) return
        const q = this.ponto(outro)
        if (perto(p).every((w) => distanciaAteParede(p, q, w) >= folga)) bits |= 1 << dir
      })
      this.arestas[no] = bits
    }
  }

  private ponto(no: number): Point {
    return { x: ((no % this.n) + 1) * this.passo, y: (Math.floor(no / this.n) + 1) * this.passo }
  }

  private vizinho(no: number, dx: number, dy: number): number {
    const k = (no % this.n) + dx
    const l = Math.floor(no / this.n) + dy
    if (k < 0 || l < 0 || k >= this.n || l >= this.m) return -1
    return k + l * this.n
  }

  /** O ponto livre da rede mais perto de `p` (até uma casa), ou -1. */
  private noPerto(p: Point, livreDeFicha: (no: number) => boolean): number {
    let melhor = -1
    let melhorD = Number.POSITIVE_INFINITY
    const k0 = Math.round(p.x / this.passo) - 1
    const l0 = Math.round(p.y / this.passo) - 1
    for (let dl = -2; dl <= 2; dl += 1) {
      for (let dk = -2; dk <= 2; dk += 1) {
        const k = k0 + dk
        const l = l0 + dl
        if (k < 0 || l < 0 || k >= this.n || l >= this.m) continue
        const no = k + l * this.n
        if (this.livre[no] !== 1 || !livreDeFicha(no)) continue
        const c = this.ponto(no)
        const d = Math.hypot(c.x - p.x, c.y - p.y)
        if (d < melhorD) {
          melhorD = d
          melhor = no
        }
      }
    }
    return melhor
  }

  /** O comprimento do caminho mais curto de `de` a `para` desviando de `fichas`, ou `null` sem caminho. */
  otimo(de: Point, para: Point, fichas: readonly FichaNoCaminho[]): number | null {
    const tolerancia = this.grid * TOLERANCIA_ENTRE_FICHAS
    const obstaculos = fichas
      .map((f) => ({ ...f, alcance: this.raio + f.raio - tolerancia }))
      .filter((f) => Math.hypot(f.x - de.x, f.y - de.y) >= f.alcance)
    const livreDeFicha = (no: number) => {
      const c = this.ponto(no)
      return obstaculos.every((f) => Math.hypot(c.x - f.x, c.y - f.y) >= f.alcance)
    }
    if (obstaculos.some((f) => Math.hypot(para.x - f.x, para.y - f.y) < f.alcance)) return null
    const inicio = this.noPerto(de, livreDeFicha)
    const fim = this.noPerto(para, livreDeFicha)
    if (inicio < 0 || fim < 0) return null
    const pi = this.ponto(inicio)
    const pf = this.ponto(fim)
    const total = this.n * this.m
    const dist = new Float64Array(total).fill(Number.POSITIVE_INFINITY)
    const fechado = new Uint8Array(total)
    const heap: [number, number][] = []
    const pôr = (d: number, no: number) => {
      heap.push([d, no])
      let i = heap.length - 1
      while (i > 0) {
        const pai = (i - 1) >> 1
        const a = heap[pai]
        const b = heap[i]
        if (a === undefined || b === undefined || a[0] <= b[0]) break
        heap[pai] = b
        heap[i] = a
        i = pai
      }
    }
    const tirar = (): [number, number] | undefined => {
      const topo = heap[0]
      const ultimo = heap.pop()
      if (heap.length > 0 && ultimo !== undefined) {
        heap[0] = ultimo
        let i = 0
        for (;;) {
          const e = 2 * i + 1
          const d = e + 1
          let menor = i
          if ((heap[e]?.[0] ?? Number.POSITIVE_INFINITY) < (heap[menor]?.[0] ?? 0)) menor = e
          if ((heap[d]?.[0] ?? Number.POSITIVE_INFINITY) < (heap[menor]?.[0] ?? 0)) menor = d
          if (menor === i) break
          const a = heap[i]
          const b = heap[menor]
          if (a === undefined || b === undefined) break
          heap[i] = b
          heap[menor] = a
          i = menor
        }
      }
      return topo
    }
    dist[inicio] = Math.hypot(pi.x - de.x, pi.y - de.y)
    pôr(dist[inicio] ?? 0, inicio)
    while (heap.length > 0) {
      const item = tirar()
      if (item === undefined) break
      const [d, no] = item
      if (fechado[no] === 1) continue
      fechado[no] = 1
      if (no === fim) return d + Math.hypot(para.x - pf.x, para.y - pf.y)
      const p = this.ponto(no)
      const bits = this.arestas[no] ?? 0
      DIRECOES.forEach(([dx, dy], dir) => {
        if ((bits & (1 << dir)) === 0) return
        const outro = this.vizinho(no, dx, dy)
        if (outro < 0 || fechado[outro] === 1 || !livreDeFicha(outro)) return
        const q = this.ponto(outro)
        if (obstaculos.some((f) => distanciaAoTraco(f.x, f.y, p.x, p.y, q.x, q.y) < f.alcance)) return
        const novo = d + Math.hypot(q.x - p.x, q.y - p.y)
        if (novo < (dist[outro] ?? Number.POSITIVE_INFINITY)) {
          dist[outro] = novo
          pôr(novo, outro)
        }
      })
    }
    return null
  }
}
