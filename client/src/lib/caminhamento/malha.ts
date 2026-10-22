import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { segmentsIntersect } from '../collision'

/**
 * MALHA DE PASSOS — a parte do mapa que não muda enquanto o NPC anda: por
 * quais arestas de uma rede de pontos (a grade, uma casa entre eles) uma ficha
 * de raio `raio` passa. Cada aresta guarda o que a barra: parede (inclui
 * janela, porta secreta e vão estreito demais), porta trancada que ela cruza,
 * ou porta destrancada que ela cruza — esta passa, abrindo.
 *
 * Abrir ou fechar porta NÃO muda a malha (porta destrancada passa nos dois
 * estados), então o NPC que abre a porta não obriga a refazê-la; quem lê o
 * estado da porta é a busca (`busca.ts`), na hora da consulta.
 *
 * A malha é montada por fatias (`avancarMalha`): mapa grande com milhares de
 * paredes não trava o jogo num quadro só.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/** O que o motor precisa do mapa: as paredes do piso da ficha e a grade. */
export interface MapaDoCaminho {
  walls: readonly Wall[]
  grid: number
  width: number
  height: number
}

/**
 * Tolerância do desenho, em fração da casa: parede feita à mão raramente cai
 * no pixel da grade, e a ficha de uma casa precisa continuar passando pela
 * porta de uma casa. O vão aceito é o diâmetro menos duas vezes isto.
 */
export const TOLERANCIA_DO_DESENHO = 0.1
/**
 * Folga mínima da parede, em fração da casa, para ficha pequena: com menos
 * que isto ela raspa a quina (o mesmo número de `lib/caminhoEmGrade.ts`).
 */
export const FOLGA_MINIMA = 0.3

/** Os 8 vizinhos: retos (0 a 3) e diagonais (4 a 7). */
export const DIRECOES: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
/** A direção de volta de cada direção. */
export const OPOSTA: readonly number[] = [1, 0, 3, 2, 7, 6, 5, 4]
/** As direções "para a frente": cada aresta é testada uma vez, e marcada nos dois sentidos. */
const PARA_A_FRENTE: readonly number[] = [0, 2, 4, 6]

/** Como o andar sozinho trata a parede. */
export type PapelDaParede = 'ignora' | 'parede' | 'porta' | 'trancada'

/**
 * - porta destrancada (aberta ou fechada) que barra o passo: `porta`, o NPC abre;
 * - porta trancada: `trancada`, barra e dá o motivo;
 * - porta secreta é parede até o mestre revelar (como em `lib/collision.ts`);
 * - janela barra o passo sempre, mesmo marcada sem "barra movimento";
 * - parede que não barra o passo: `ignora`.
 */
export function papelDaParede(w: Wall): PapelDaParede {
  if (w.door !== null && w.door.secret !== true && w.blocksMove) return w.door.locked ? 'trancada' : 'porta'
  if (w.blocksMove || w.janela === true) return 'parede'
  return 'ignora'
}

/** Distância do ponto (px, py) ao traço a-b. */
export function distanciaAoTraco(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const comprimento2 = dx * dx + dy * dy
  const t = comprimento2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comprimento2))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

/** Distância entre o traço p-q e a parede: zero quando se cruzam. */
export function distanciaAteParede(p: Point, q: Point, w: Wall): number {
  const a = { x: w.x1, y: w.y1 }
  const b = { x: w.x2, y: w.y2 }
  if (segmentsIntersect(p, q, a, b)) return 0
  return Math.min(
    distanciaAoTraco(p.x, p.y, a.x, a.y, b.x, b.y),
    distanciaAoTraco(q.x, q.y, a.x, a.y, b.x, b.y),
    distanciaAoTraco(a.x, a.y, p.x, p.y, q.x, q.y),
    distanciaAoTraco(b.x, b.y, p.x, p.y, q.x, q.y),
  )
}

/** A folga que o centro da ficha guarda da parede: o raio, menos a tolerância do desenho. */
export function folgaDaParede(raio: number, grid: number): number {
  return Math.max(raio - grid * TOLERANCIA_DO_DESENHO, grid * FOLGA_MINIMA)
}

export interface Malha {
  readonly grid: number
  readonly raio: number
  readonly folga: number
  readonly largura: number
  readonly altura: number
  /** O primeiro ponto da rede, em px de mundo. */
  readonly x0: number
  readonly y0: number
  /** Pontos da rede por linha e por coluna. */
  readonly nx: number
  readonly ny: number
  /** Por ponto, um bit por direção: aresta barrada por parede (ou vão estreito). */
  readonly parede: Uint8Array
  /** Por ponto, um bit por direção: aresta que cruza porta trancada. */
  readonly tranca: Uint8Array
  /** Por ponto, um bit por direção: aresta que cruza porta destrancada. */
  readonly porta: Uint8Array
  /** Aresta (`no * 8 + dir`) que cruza porta → índice da porta em `paredes`. */
  readonly portaDaAresta: Map<number, number>
  /** Aresta que cruza porta trancada → índice dela em `paredes`. */
  readonly trancaDaAresta: Map<number, number>
  /** Casa do mapa → índices das paredes a até `folga + grid` dela (para os traços livres). */
  readonly baldes: Map<number, number[]>
  /** O papel de cada parede, pelo índice. */
  readonly papeis: readonly PapelDaParede[]
  /** Índices das portas destrancadas: a busca lê o estado delas sem varrer as paredes todas. */
  readonly portas: readonly number[]
  /** As paredes da montagem: a estrutura que a malha descreve. */
  readonly paredes: readonly Wall[]
  /** Quantas paredes já entraram; a malha está pronta quando entram todas. */
  feitas: number
  /** Memória de buscas que terminaram, para a próxima não alocar de novo (30 NPCs num mapa grande). */
  readonly sobras: MemoriaDaBusca[]
  /**
   * MARCOS (`marcos.ts`): a distância de cada marco a cada ponto, juntas por
   * ponto (`no * quantosMarcos + k`) — a busca lê as do ponto de uma vez.
   */
  marcos: Float32Array
  quantosMarcos: number
  /** A rede é grande e os marcos ainda não ficaram prontos; `null` = prontos (ou rede pequena, sem marcos). */
  construcaoDosMarcos: ConstrucaoDosMarcos | null
}

/** O Dijkstra de um marco, retomável. */
export interface DijkstraDoMarco {
  origem: number
  dist: Float32Array
  fechado: Uint8Array
  heapNo: number[]
  heapD: number[]
}

export interface ConstrucaoDosMarcos {
  /** Para cada ponto, a menor distância a um marco já feito: o próximo marco é o mais longe de todos. */
  menor: Float32Array
  atual: DijkstraDoMarco | null
  /** As distâncias de cada marco já feito, até juntá-las em `Malha.marcos`. */
  feitos: Float32Array[]
}

/** Redes com mais pontos que isto ganham marcos (mapa pequeno já é rápido sem eles). */
export const PONTOS_PARA_MARCOS = 20000

/** O que uma rodada de A* usa por ponto da rede (mais um, o fim), e o monte dos abertos. */
export interface MemoriaDaBusca {
  g: Float64Array
  /** A estimativa do ponto, calculada uma vez por rodada (vale onde `marca` não é 0). */
  h: Float64Array
  veio: Int32Array
  marca: Uint8Array
  bloqueioFicha: Uint8Array
  /** O monte (heap) dos abertos: cresce dobrando e fica para a próxima busca. */
  monteNo: Int32Array
  monteF: Float64Array
  monteH: Float64Array
}

const MONTE_INICIAL = 4096

/** Memória limpa para uma rodada nesta malha. */
export function pegarMemoria(m: Malha): MemoriaDaBusca {
  const total = m.nx * m.ny + 1
  const sobra = m.sobras.pop()
  if (sobra !== undefined && sobra.marca.length === total) {
    sobra.marca.fill(0)
    sobra.bloqueioFicha.fill(0)
    return sobra
  }
  return {
    g: new Float64Array(total),
    h: new Float64Array(total),
    veio: new Int32Array(total),
    marca: new Uint8Array(total),
    bloqueioFicha: new Uint8Array(total),
    monteNo: new Int32Array(MONTE_INICIAL),
    monteF: new Float64Array(MONTE_INICIAL),
    monteH: new Float64Array(MONTE_INICIAL),
  }
}

/** Teto de memórias guardadas por malha. */
const SOBRAS_MAX = 4

export function devolverMemoria(m: Malha, memoria: MemoriaDaBusca): void {
  if (m.sobras.length < SOBRAS_MAX) m.sobras.push(memoria)
}

/**
 * A rede de pontos de uma ficha de raio `raio`: ficha de uma ou três casas
 * anda pelos centros das casas; de duas, pelos cantos — o centro dela, onde
 * ela é desenhada encaixada. O ponto fica sempre com a ficha inteira dentro do mapa.
 */
function rede(raio: number, grid: number, tamanho: number): { inicio: number; pontos: number } {
  const resto = raio % grid
  const desvio = raio <= grid / 2 ? grid / 2 : resto
  const folgaDaBorda = 1e-6
  const primeiro = Math.ceil((raio - folgaDaBorda - desvio) / grid)
  const inicio = desvio + primeiro * grid
  const pontos = Math.floor((tamanho * grid - raio + folgaDaBorda - inicio) / grid) + 1
  return { inicio, pontos: Math.max(0, pontos) }
}

/** Uma malha vazia, para montar por fatias com `avancarMalha`. */
export function criarMalha(mapa: MapaDoCaminho, raio: number): Malha {
  const { grid } = mapa
  const largura = Math.max(1, Math.ceil(mapa.width))
  const altura = Math.max(1, Math.ceil(mapa.height))
  const emX = rede(raio, grid, largura)
  const emY = rede(raio, grid, altura)
  const total = emX.pontos * emY.pontos
  const papeis = mapa.walls.map(papelDaParede)
  return {
    grid,
    raio,
    folga: folgaDaParede(raio, grid),
    largura,
    altura,
    x0: emX.inicio,
    y0: emY.inicio,
    nx: emX.pontos,
    ny: emY.pontos,
    parede: new Uint8Array(total),
    tranca: new Uint8Array(total),
    porta: new Uint8Array(total),
    portaDaAresta: new Map(),
    trancaDaAresta: new Map(),
    baldes: new Map(),
    papeis,
    portas: papeis.flatMap((papel, k) => (papel === 'porta' ? [k] : [])),
    paredes: mapa.walls,
    feitas: 0,
    sobras: [],
    marcos: new Float32Array(0),
    quantosMarcos: 0,
    construcaoDosMarcos: total > PONTOS_PARA_MARCOS ? { menor: new Float32Array(total).fill(Number.POSITIVE_INFINITY), atual: null, feitos: [] } : null,
  }
}

/** As paredes já entraram todas (falta, talvez, os marcos). */
export function paredesProntas(m: Malha): boolean {
  return m.feitas >= m.paredes.length
}

/** Pronta para buscar: paredes e marcos. Antes disso a busca não começa — o caminho não pode depender de quando ela rodou. */
export function malhaPronta(m: Malha): boolean {
  return paredesProntas(m) && m.construcaoDosMarcos === null
}

export function pontoDoNo(m: Malha, no: number): Point {
  return { x: m.x0 + (no % m.nx) * m.grid, y: m.y0 + Math.floor(no / m.nx) * m.grid }
}

/** O vizinho de `no` na direção `dir`, ou -1 fora da rede. */
export function vizinho(m: Malha, no: number, dir: number): number {
  const passo = DIRECOES[dir]
  if (passo === undefined) return -1
  const i = (no % m.nx) + passo[0]
  const j = Math.floor(no / m.nx) + passo[1]
  if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) return -1
  return i + j * m.nx
}

function marcarBit(bits: Uint8Array, no: number, dir: number, outro: number): void {
  bits[no] = (bits[no] ?? 0) | (1 << dir)
  bits[outro] = (bits[outro] ?? 0) | (1 << (OPOSTA[dir] ?? 0))
}

function guardarNoBalde(m: Malha, w: Wall, indice: number): void {
  const margem = m.folga + m.grid
  const i0 = Math.max(0, Math.floor((Math.min(w.x1, w.x2) - margem) / m.grid))
  const i1 = Math.min(m.largura - 1, Math.floor((Math.max(w.x1, w.x2) + margem) / m.grid))
  const j0 = Math.max(0, Math.floor((Math.min(w.y1, w.y2) - margem) / m.grid))
  const j1 = Math.min(m.altura - 1, Math.floor((Math.max(w.y1, w.y2) + margem) / m.grid))
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const casa = i + j * m.largura
      const lista = m.baldes.get(casa)
      if (lista === undefined) m.baldes.set(casa, [indice])
      else lista.push(indice)
    }
  }
}

/** Marca na malha cada aresta que a parede `indice` barra ou cruza. */
function marcarParede(m: Malha, indice: number): void {
  const w = m.paredes[indice]
  const papel = m.papeis[indice]
  if (w === undefined || papel === undefined || papel === 'ignora') return
  guardarNoBalde(m, w, indice)
  if (m.nx === 0 || m.ny === 0) return
  const margem = m.folga + m.grid
  const a = { x: w.x1, y: w.y1 }
  const b = { x: w.x2, y: w.y2 }
  const i0 = Math.max(0, Math.ceil((Math.min(w.x1, w.x2) - margem - m.x0) / m.grid))
  const i1 = Math.min(m.nx - 1, Math.floor((Math.max(w.x1, w.x2) + margem - m.x0) / m.grid))
  const j0 = Math.max(0, Math.ceil((Math.min(w.y1, w.y2) - margem - m.y0) / m.grid))
  const j1 = Math.min(m.ny - 1, Math.floor((Math.max(w.y1, w.y2) + margem - m.y0) / m.grid))
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const no = i + j * m.nx
      const p = { x: m.x0 + i * m.grid, y: m.y0 + j * m.grid }
      for (const dir of PARA_A_FRENTE) {
        const outro = vizinho(m, no, dir)
        if (outro < 0) continue
        const passo = DIRECOES[dir] ?? [0, 0]
        const q = { x: p.x + passo[0] * m.grid, y: p.y + passo[1] * m.grid }
        const diagonal = dir >= 4
        if (papel === 'parede') {
          if (distanciaAteParede(p, q, w) < m.folga) marcarBit(m.parede, no, dir, outro)
          continue
        }
        if (!segmentsIntersect(p, q, a, b)) {
          // Porta que a aresta não cruza é parede para a folga: a ficha não raspa a folha.
          if (distanciaAteParede(p, q, w) < m.folga) marcarBit(m.parede, no, dir, outro)
          continue
        }
        // Porta só se cruza de frente, nunca na diagonal: o NPC para diante dela para abrir.
        if (diagonal) {
          marcarBit(m.parede, no, dir, outro)
          continue
        }
        const chave = no * 8 + dir
        const volta = outro * 8 + (OPOSTA[dir] ?? 0)
        const mapa = papel === 'porta' ? m.portaDaAresta : m.trancaDaAresta
        const outraMapa = papel === 'porta' ? m.trancaDaAresta : m.portaDaAresta
        const ja = mapa.get(chave) ?? outraMapa.get(chave)
        if (ja !== undefined && ja !== indice) {
          // Duas portas na mesma aresta: o NPC não abre duas de uma vez.
          marcarBit(m.parede, no, dir, outro)
          continue
        }
        mapa.set(chave, indice)
        mapa.set(volta, indice)
        marcarBit(papel === 'porta' ? m.porta : m.tranca, no, dir, outro)
      }
    }
  }
}

/** Monta mais `paredes` paredes da malha (só as paredes; os marcos são de `marcos.ts`). */
export function avancarParedes(m: Malha, paredes: number): boolean {
  const ate = Math.min(m.paredes.length, m.feitas + Math.max(1, paredes))
  for (let k = m.feitas; k < ate; k += 1) marcarParede(m, k)
  m.feitas = ate
  return paredesProntas(m)
}

/**
 * As paredes perto do traço a-b (a até `folga + grid` dele), sem repetir:
 * amostra o traço a cada meia casa e junta os baldes das casas. Índices em `paredes`.
 */
export function paredesAoLongo(m: Malha, a: Point, b: Point): number[] {
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y)
  const amostras = Math.max(1, Math.ceil(comprimento / (m.grid / 2)))
  const vistas = new Set<number>()
  const casasVistas = new Set<number>()
  for (let s = 0; s <= amostras; s += 1) {
    const t = s / amostras
    const ci = Math.floor((a.x + (b.x - a.x) * t) / m.grid)
    const cj = Math.floor((a.y + (b.y - a.y) * t) / m.grid)
    if (ci < 0 || cj < 0 || ci >= m.largura || cj >= m.altura) continue
    const casa = ci + cj * m.largura
    if (casasVistas.has(casa)) continue
    casasVistas.add(casa)
    for (const k of m.baldes.get(casa) ?? []) vistas.add(k)
  }
  // Na ordem em que o traço as encontra: quem testa sai na primeira que barra.
  return [...vistas]
}

/**
 * As mesmas paredes, na mesma ordem, com a mesma forma e o mesmo papel? Abrir
 * ou fechar porta não muda a estrutura: a malha montada continua valendo.
 */
export function mesmaEstrutura(antes: readonly Wall[], depois: readonly Wall[]): boolean {
  if (antes === depois) return true
  if (antes.length !== depois.length) return false
  for (let k = 0; k < antes.length; k += 1) {
    const a = antes[k]
    const b = depois[k]
    if (a === b) continue
    if (a === undefined || b === undefined) return false
    if (a.x1 !== b.x1 || a.y1 !== b.y1 || a.x2 !== b.x2 || a.y2 !== b.y2) return false
    if (papelDaParede(a) !== papelDaParede(b)) return false
    if ((a.door?.opensFrom ?? null) !== (b.door?.opensFrom ?? null)) return false
    if (a.id !== b.id) return false
  }
  return true
}
