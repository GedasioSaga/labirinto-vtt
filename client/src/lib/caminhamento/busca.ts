import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { isTokenPathClear, segmentsIntersect, wallBlocksToken } from '../collision'
import { sideOfWall } from '../doorReach'
import { DIRECOES, devolverMemoria, distanciaAoTraco, distanciaAteParede, type Malha, type MemoriaDaBusca, paredesAoLongo, pegarMemoria, pontoDoNo } from './malha'
import { avancarMalha } from './marcos'

/**
 * BUSCA DO CAMINHO — A* sobre a malha (`malha.ts`) para uma ficha de raio
 * `malha.raio`, desviando das outras fichas, abrindo porta destrancada.
 *
 * Retomável: `avancarBusca` anda no máximo N pontos por chamada, e a agenda
 * (`agenda.ts`) reparte as buscas pelos quadros. O resultado não depende do
 * tamanho das fatias: mesma entrada, mesmo caminho (desempate estável, sem sorte).
 *
 * Quando não há caminho, a busca diz POR QUÊ, em até três rodadas:
 * 1. com as fichas no caminho;
 * 2. falhou e alguma ficha atrapalhou: sem as fichas. Achou = `ocupado`;
 * 3. falhou e alguma porta trancada estava no caminho: com ela destrancada.
 *    Achou = `porta-trancada` (com as portas que o mestre teria de destrancar);
 *    senão, `sem-caminho`.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/** Outra ficha no piso: obstáculo que o NPC contorna. */
export interface FichaNoCaminho {
  id: string
  x: number
  y: number
  raio: number
}

export interface ConsultaDeCaminho {
  de: Point
  para: Point
  /** As outras fichas do piso (sem a própria). */
  fichas: readonly FichaNoCaminho[]
  /** Folga a mais em volta das fichas, em px: o anti-trava replaneja mais largo. */
  folgaExtra?: number
  /** Quanto custa abrir e fechar uma porta, em px de caminho. Padrão: `CUSTO_DA_PORTA` casas. */
  custoPorPorta?: number
}

export type MotivoSemCaminho = 'porta-trancada' | 'sem-caminho' | 'ocupado'

/** Um canto do caminho. `abrir`: ao chegar aqui, abre esta porta; `fechar`: aqui, fecha a que passou. */
export interface PontoDoCaminho {
  x: number
  y: number
  abrir?: string
  fechar?: string
}

export type ResultadoDoCaminho =
  | { tipo: 'caminho'; pontos: PontoDoCaminho[]; comprimento: number; portas: number }
  | { tipo: 'sem-caminho'; motivo: MotivoSemCaminho; portas: string[]; fichas: string[] }

/** Abrir e fechar a porta custa o mesmo que andar isto, em casas: dois tiques parados da rotina. */
export const CUSTO_DA_PORTA = 0.8
/** Sobreposição tolerada entre duas fichas, em fração da casa: encostar não é atravessar. */
export const TOLERANCIA_ENTRE_FICHAS = 0.05
/** Até quantas casas em volta a perna liga o ponto real da ficha à rede. */
const ALCANCE_DA_PERNA = 2
const RAIZ_DE_2 = Math.SQRT2

export interface Obstaculo {
  id: string
  x: number
  y: number
  /** Distância mínima entre o centro do NPC e o desta ficha. */
  alcance: number
}

interface Fase {
  comFichas: boolean
  trancaPassa: boolean
}

interface Rodada {
  memoria: MemoriaDaBusca
  heapNo: number[]
  heapF: number[]
  heapH: number[]
  chegada: Map<number, number>
  fichasPerto: Map<number, number[]>
  obstaculos: readonly Obstaculo[]
  portaFechada: Uint8Array
  custoPorta: number
  /** Por marco: a menor e a maior distância dele aos pontos de chegada que ele alcança (infinito: nenhum). */
  alvoMin: number[]
  alvoMax: number[]
  /** Por marco: ele alcança todos os pontos de chegada. */
  alvoTodoAlcancado: boolean[]
}

export interface Busca {
  readonly malha: Malha
  readonly paredes: readonly Wall[]
  readonly consulta: ConsultaDeCaminho
  resultado: ResultadoDoCaminho | null
  /** Pontos abertos até agora, somando as rodadas (medida). */
  abertos: number
  fase: Fase
  rodada: Rodada | null
  fichasQueAtrapalham: Set<string>
  trancasVistas: Set<number>
}

const ABERTO = 1
const FECHADO = 2

/** As fichas que contam como obstáculo para quem sai de `de`, com o alcance de cada uma. */
export function obstaculosPara(de: Point, fichas: readonly FichaNoCaminho[], raio: number, grid: number, folgaExtra: number = 0): Obstaculo[] {
  const lista: Obstaculo[] = []
  for (const f of fichas) {
    const alcance = raio + f.raio - grid * TOLERANCIA_ENTRE_FICHAS + folgaExtra
    // Ficha já encostada no ponto de saída (o mestre largou uma em cima da outra):
    // não conta, senão o NPC nem sai do lugar.
    if (Math.hypot(f.x - de.x, f.y - de.y) < alcance) continue
    lista.push({ id: f.id, x: f.x, y: f.y, alcance })
  }
  return lista.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** A primeira ficha que o traço a-b atravessa, ou `null`. */
export function fichaNoTraco(a: Point, b: Point, obstaculos: readonly Obstaculo[]): Obstaculo | null {
  for (const o of obstaculos) if (distanciaAoTraco(o.x, o.y, a.x, a.y, b.x, b.y) < o.alcance) return o
  return null
}

/** A parede como o andar sozinho a vê: janela barra o passo mesmo sem "barra movimento". */
function paraAColisao(w: Wall): Wall {
  return w.janela === true && !w.blocksMove ? { ...w, blocksMove: true } : w
}

/**
 * O traço passa pela regra do arrasto (`lib/collision.ts`), com as portas no
 * estado de agora, e nem raspa a ponta de parede (o arrasto deixa raspar; quem
 * anda sozinho não precisa). É a perna curta entre o ponto real da ficha e a
 * rede — a ficha pode estar encostada na parede, e exigir a folga ali a
 * deixaria presa — e o teste do passo de quem anda.
 */
export function passaPeloArrasto(m: Malha, paredes: readonly Wall[], a: Point, b: Point): boolean {
  const perto: Wall[] = []
  for (const k of paredesAoLongo(m, a, b)) {
    const w = paredes[k]
    if (w === undefined) continue
    const comoColide = paraAColisao(w)
    if (wallBlocksToken(comoColide) && segmentsIntersect(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) return false
    perto.push(comoColide)
  }
  return isTokenPathClear(a, b, perto, m.grid)
}

function pernaPassa(m: Malha, paredes: readonly Wall[], a: Point, b: Point, obstaculos: readonly Obstaculo[] | null): boolean {
  if (!passaPeloArrasto(m, paredes, a, b)) return false
  return obstaculos === null || fichaNoTraco(a, b, obstaculos) === null
}

/**
 * O traço reto a-b serve ao NPC agora: guarda a folga das paredes, não cruza
 * porta fechada nem trancada (aberta passa), não encosta em ficha. É o teste do
 * alisado.
 */
export function tracoLivre(m: Malha, paredes: readonly Wall[], a: Point, b: Point, obstaculos: readonly Obstaculo[] | null): boolean {
  for (const k of paredesAoLongo(m, a, b)) {
    const papel = m.papeis[k]
    const w = paredes[k]
    if (w === undefined || papel === undefined || papel === 'ignora') continue
    const aberta = papel === 'porta' && w.door !== null && w.door.open
    if (aberta && segmentsIntersect(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) continue
    if (distanciaAteParede(a, b, w) < m.folga) return false
  }
  return obstaculos === null || fichaNoTraco(a, b, obstaculos) === null
}

function noMaisPerto(m: Malha, p: Point): [number, number] {
  const i = Math.min(m.nx - 1, Math.max(0, Math.round((p.x - m.x0) / m.grid)))
  const j = Math.min(m.ny - 1, Math.max(0, Math.round((p.y - m.y0) / m.grid)))
  return [i, j]
}

/**
 * Os pontos da rede em volta de `p` que a perna alcança, com a distância: os
 * vizinhos de casa primeiro; só sem nenhum, o anel de fora (até
 * `ALCANCE_DA_PERNA` casas) — a ficha quase sempre está num ponto da rede.
 */
function pontosEmVolta(m: Malha, paredes: readonly Wall[], p: Point, obstaculos: readonly Obstaculo[] | null, bloqueio: Uint8Array | null): Map<number, number> {
  const pontos = new Map<number, number>()
  if (m.nx === 0 || m.ny === 0) return pontos
  const [ci, cj] = noMaisPerto(m, p)
  for (let anel = 1; anel <= ALCANCE_DA_PERNA && pontos.size === 0; anel += 1) {
    for (let dj = -anel; dj <= anel; dj += 1) {
      for (let di = -anel; di <= anel; di += 1) {
        if (anel > 1 && Math.max(Math.abs(di), Math.abs(dj)) < anel) continue
        const i = ci + di
        const j = cj + dj
        if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) continue
        const no = i + j * m.nx
        if (bloqueio !== null && bloqueio[no] === 1) continue
        const c = pontoDoNo(m, no)
        if (pernaPassa(m, paredes, p, c, obstaculos)) pontos.set(no, Math.hypot(c.x - p.x, c.y - p.y))
      }
    }
  }
  return pontos
}

/** Distância octil do ponto (x, y) até `para`: a heurística do A* em 8 direções. */
function octil(x: number, y: number, para: Point): number {
  const dx = Math.abs(para.x - x)
  const dy = Math.abs(para.y - y)
  return Math.max(dx, dy) + (RAIZ_DE_2 - 1) * Math.min(dx, dy)
}

/**
 * O que falta, por baixo, do ponto `no` (em x, y) até o fim: a octil até o
 * destino ou, maior, a dos marcos (`marcos.ts`). -1: deste ponto não se chega
 * (outra parte do mapa, que os marcos separam).
 */
function estimativa(b: Busca, r: Rodada, no: number, x: number, y: number): number {
  let h = octil(x, y, b.consulta.para)
  const marcos = b.malha.marcos
  for (let k = 0; k < marcos.length; k += 1) {
    const d = marcos[k]?.[no] ?? Number.POSITIVE_INFINITY
    const min = r.alvoMin[k] ?? Number.POSITIVE_INFINITY
    if (d === Number.POSITIVE_INFINITY) {
      if (r.alvoTodoAlcancado[k] === true) return -1
      continue
    }
    if (min === Number.POSITIVE_INFINITY) return -1
    const piso = Math.max(min - d, d - (r.alvoMax[k] ?? 0))
    if (piso > h) h = piso
  }
  return h
}

function medirAlvos(m: Malha, r: Rodada): void {
  for (const dist of m.marcos) {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let todos = true
    for (const no of r.chegada.keys()) {
      const d = dist[no] ?? Number.POSITIVE_INFINITY
      if (d === Number.POSITIVE_INFINITY) todos = false
      else {
        min = Math.min(min, d)
        max = Math.max(max, d)
      }
    }
    r.alvoMin.push(min)
    r.alvoMax.push(max)
    r.alvoTodoAlcancado.push(todos)
  }
}

/** `i` sai antes de `j`: menor custo; empate, o mais perto do fim; empate, o menor ponto. */
function antes(r: Rodada, i: number, j: number): boolean {
  const fi = r.heapF[i] ?? 0
  const fj = r.heapF[j] ?? 0
  if (fi !== fj) return fi < fj
  const hi = r.heapH[i] ?? 0
  const hj = r.heapH[j] ?? 0
  if (hi !== hj) return hi < hj
  return (r.heapNo[i] ?? 0) < (r.heapNo[j] ?? 0)
}

function trocar(r: Rodada, a: number, b: number): void {
  const no = r.heapNo[a] ?? 0
  r.heapNo[a] = r.heapNo[b] ?? 0
  r.heapNo[b] = no
  const f = r.heapF[a] ?? 0
  r.heapF[a] = r.heapF[b] ?? 0
  r.heapF[b] = f
  const h = r.heapH[a] ?? 0
  r.heapH[a] = r.heapH[b] ?? 0
  r.heapH[b] = h
}

function pôr(r: Rodada, no: number, f: number, h: number): void {
  r.heapNo.push(no)
  r.heapF.push(f)
  r.heapH.push(h)
  let i = r.heapNo.length - 1
  while (i > 0) {
    const pai = (i - 1) >> 1
    if (!antes(r, i, pai)) break
    trocar(r, i, pai)
    i = pai
  }
}

function tirar(r: Rodada): number {
  const topo = r.heapNo[0] ?? -1
  const ultimoNo = r.heapNo.pop()
  const ultimoF = r.heapF.pop()
  const ultimoH = r.heapH.pop()
  if (r.heapNo.length > 0 && ultimoNo !== undefined && ultimoF !== undefined && ultimoH !== undefined) {
    r.heapNo[0] = ultimoNo
    r.heapF[0] = ultimoF
    r.heapH[0] = ultimoH
    let i = 0
    for (;;) {
      const esq = 2 * i + 1
      const dir = esq + 1
      let menor = i
      if (esq < r.heapNo.length && antes(r, esq, menor)) menor = esq
      if (dir < r.heapNo.length && antes(r, dir, menor)) menor = dir
      if (menor === i) break
      trocar(r, i, menor)
      i = menor
    }
  }
  return topo
}

/** As fichas viram pontos barrados da rede e, perto delas, arestas a conferir. */
function marcarFichas(m: Malha, r: Rodada): void {
  if (m.nx === 0 || m.ny === 0) return
  const bloqueio = r.memoria.bloqueioFicha
  r.obstaculos.forEach((o, indice) => {
    const alcance = o.alcance + m.grid * RAIZ_DE_2
    const i0 = Math.max(0, Math.ceil((o.x - alcance - m.x0) / m.grid))
    const i1 = Math.min(m.nx - 1, Math.floor((o.x + alcance - m.x0) / m.grid))
    const j0 = Math.max(0, Math.ceil((o.y - alcance - m.y0) / m.grid))
    const j1 = Math.min(m.ny - 1, Math.floor((o.y + alcance - m.y0) / m.grid))
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const no = i + j * m.nx
        const d = Math.hypot(m.x0 + i * m.grid - o.x, m.y0 + j * m.grid - o.y)
        if (d < o.alcance) bloqueio[no] = 1
        else if (d < alcance) {
          const lista = r.fichasPerto.get(no)
          if (lista === undefined) r.fichasPerto.set(no, [indice])
          else lista.push(indice)
        }
      }
    }
  })
}

function comecarRodada(b: Busca): void {
  const m = b.malha
  if (b.rodada !== null) devolverMemoria(m, b.rodada.memoria)
  const { de, para, fichas, folgaExtra } = b.consulta
  const obstaculos = b.fase.comFichas ? obstaculosPara(de, fichas, m.raio, m.grid, folgaExtra) : []
  const r: Rodada = {
    memoria: pegarMemoria(m),
    heapNo: [],
    heapF: [],
    heapH: [],
    chegada: new Map(),
    fichasPerto: new Map(),
    obstaculos,
    portaFechada: new Uint8Array(b.paredes.length),
    custoPorta: b.consulta.custoPorPorta ?? CUSTO_DA_PORTA * m.grid,
    alvoMin: [],
    alvoMax: [],
    alvoTodoAlcancado: [],
  }
  for (const k of m.portas) {
    const w = b.paredes[k]
    if (w !== undefined && w.door !== null && !w.door.open) r.portaFechada[k] = 1
  }
  marcarFichas(m, r)
  const comFichas = b.fase.comFichas ? obstaculos : null
  const bloqueio = b.fase.comFichas ? r.memoria.bloqueioFicha : null
  const inicio = pontosEmVolta(m, b.paredes, de, comFichas, bloqueio)
  r.chegada = pontosEmVolta(m, b.paredes, para, comFichas, bloqueio)
  b.rodada = r
  if (r.chegada.size === 0) return
  medirAlvos(m, r)
  const { g, veio, marca } = r.memoria
  for (const [no, dist] of inicio) {
    const c = pontoDoNo(m, no)
    const h = estimativa(b, r, no, c.x, c.y)
    if (h < 0) continue
    g[no] = dist
    // A memória vem de outra busca: o ponto de saída precisa dizer que é o começo.
    veio[no] = -1
    marca[no] = ABERTO
    pôr(r, no, dist + h, h)
  }
}

/** O custo da aresta `no → outro` na direção `dir` (de `p`), ou -1 se não passa nesta rodada. */
function custoDaAresta(b: Busca, r: Rodada, no: number, dir: number, outro: number, px: number, py: number): number {
  const m = b.malha
  const bit = 1 << dir
  const parede = m.parede[no] ?? 0
  if ((parede & bit) !== 0) return -1
  const tranca = m.tranca[no] ?? 0
  const porta = m.porta[no] ?? 0
  let extra = 0
  if ((tranca & bit) !== 0) {
    if (!b.fase.trancaPassa) {
      const k = m.trancaDaAresta.get(no * 8 + dir)
      if (k !== undefined) b.trancasVistas.add(k)
      return -1
    }
    extra += r.custoPorta
  }
  if (dir >= 4) {
    // Diagonal só com os dois lados retos livres (sem parede, sem porta): não corta quina.
    const passo = DIRECOES[dir] ?? [0, 0]
    const retos = (1 << (passo[0] > 0 ? 0 : 1)) | (1 << (passo[1] > 0 ? 2 : 3))
    if (((parede | tranca | porta) & retos) !== 0) return -1
  }
  if ((porta & bit) !== 0) {
    const k = m.portaDaAresta.get(no * 8 + dir)
    if (k !== undefined && r.portaFechada[k] === 1) {
      const w = b.paredes[k]
      // Porta de um lado: fechada, só abre de quem está do lado certo.
      const lado = w?.door?.opensFrom
      if (w !== undefined && lado !== undefined && sideOfWall({ x: px, y: py }, w) !== lado) return -1
      extra += r.custoPorta
    }
  }
  if (b.fase.comFichas) {
    if (r.memoria.bloqueioFicha[outro] === 1) {
      const c = pontoDoNo(m, outro)
      for (const o of r.obstaculos) if (Math.hypot(c.x - o.x, c.y - o.y) < o.alcance) b.fichasQueAtrapalham.add(o.id)
      return -1
    }
    const perto = r.fichasPerto.get(no)
    if (perto !== undefined) {
      const c = pontoDoNo(m, outro)
      for (const indice of perto) {
        const o = r.obstaculos[indice]
        if (o !== undefined && distanciaAoTraco(o.x, o.y, px, py, c.x, c.y) < o.alcance) {
          b.fichasQueAtrapalham.add(o.id)
          return -1
        }
      }
    }
  }
  return (dir < 4 ? m.grid : m.grid * RAIZ_DE_2) + extra
}

/**
 * Uma rodada anda até `orcamento` pontos. Devolve o fim (achou), -1 se a
 * rodada acabou sem caminho, ou `undefined` se ainda não terminou.
 */
function andarRodada(b: Busca, orcamento: number): number | undefined {
  const r = b.rodada
  if (r === null) return -1
  const m = b.malha
  const { g, veio, marca } = r.memoria
  const fim = m.nx * m.ny
  let feitos = 0
  while (r.heapNo.length > 0) {
    if (feitos >= orcamento) return undefined
    const no = tirar(r)
    if (no < 0 || marca[no] === FECHADO) continue
    if (no === fim) return fim
    marca[no] = FECHADO
    feitos += 1
    b.abertos += 1
    const custoAqui = g[no] ?? 0
    const perna = r.chegada.get(no)
    if (perna !== undefined) {
      const novo = custoAqui + perna
      if (marca[fim] !== ABERTO || novo < (g[fim] ?? 0)) {
        g[fim] = novo
        veio[fim] = no
        marca[fim] = ABERTO
        pôr(r, fim, novo, 0)
      }
    }
    const i = no % m.nx
    const j = (no - i) / m.nx
    const px = m.x0 + i * m.grid
    const py = m.y0 + j * m.grid
    for (let dir = 0; dir < 8; dir += 1) {
      const passo = DIRECOES[dir] ?? [0, 0]
      const ni = i + passo[0]
      const nj = j + passo[1]
      if (ni < 0 || nj < 0 || ni >= m.nx || nj >= m.ny) continue
      const outro = ni + nj * m.nx
      if (marca[outro] === FECHADO) continue
      const custo = custoDaAresta(b, r, no, dir, outro, px, py)
      if (custo < 0) continue
      const novo = custoAqui + custo
      if (marca[outro] === ABERTO && novo >= (g[outro] ?? 0)) continue
      const h = estimativa(b, r, outro, m.x0 + ni * m.grid, m.y0 + nj * m.grid)
      if (h < 0) continue
      g[outro] = novo
      veio[outro] = no
      marca[outro] = ABERTO
      pôr(r, outro, novo + h, h)
    }
  }
  return -1
}

/** A direção de `a` para o vizinho `b`. */
function direcaoEntre(m: Malha, a: number, b: number): number {
  const di = (b % m.nx) - (a % m.nx)
  const dj = Math.floor(b / m.nx) - Math.floor(a / m.nx)
  return DIRECOES.findIndex(([x, y]) => x === di && y === dj)
}

function nosDoCaminho(r: Rodada, fim: number): number[] {
  const { veio } = r.memoria
  const nos: number[] = []
  for (let no = veio[fim] ?? -1; no >= 0; no = veio[no] ?? -1) nos.push(no)
  return nos.reverse()
}

/**
 * Só as curvas: no meio de uma reta da rede, o ponto sai. A reta inteira é a
 * soma das arestas que a busca aceitou, então continua andável — e o alisado
 * depois testa poucas retas longas em vez de uma por casa.
 */
function soCurvas(pontos: readonly Point[]): Point[] {
  const curvas: Point[] = []
  for (let i = 0; i < pontos.length; i += 1) {
    const p = pontos[i]
    if (p === undefined) continue
    const antes = curvas[curvas.length - 1]
    const depois = pontos[i + 1]
    const meioDeReta =
      antes !== undefined &&
      depois !== undefined &&
      (p.x - antes.x) * (depois.y - p.y) === (p.y - antes.y) * (depois.x - p.x) &&
      (p.x - antes.x) * (depois.x - p.x) + (p.y - antes.y) * (depois.y - p.y) > 0
    if (!meioDeReta) curvas.push(p)
  }
  return curvas
}

/** O fio puxado: de cada canto, direto ao mais adiante que o traço livre alcança. */
function alisar(entrada: readonly PontoDoCaminho[], passa: (a: Point, b: Point) => boolean): PontoDoCaminho[] {
  const pontos = soCurvas(entrada)
  const primeiro = pontos[0]
  if (primeiro === undefined) return []
  const alisado = [primeiro]
  let i = 0
  while (i < pontos.length - 1) {
    let j = i + 1
    const daqui = pontos[i]
    while (daqui !== undefined && j + 1 < pontos.length) {
      const adiante = pontos[j + 1]
      if (adiante === undefined || !passa(daqui, adiante)) break
      j += 1
    }
    const canto = pontos[j]
    if (canto !== undefined) alisado.push(canto)
    i = j
  }
  return alisado
}

/** Um pedaço do caminho: livre (alisa) ou a passagem por uma porta fechada (não alisa). */
interface Peca {
  porta: string | null
  pontos: Point[]
}

/**
 * Os cantos do caminho achado: pedaços livres alisados entre as portas; na
 * porta fechada, o ponto diante dela (abrir) e o primeiro depois dela (fechar).
 */
function montarCaminho(b: Busca, r: Rodada, fim: number): ResultadoDoCaminho {
  const m = b.malha
  const { de, para } = b.consulta
  const nos = nosDoCaminho(r, fim)
  const pecas: Peca[] = [{ porta: null, pontos: [{ x: de.x, y: de.y }] }]
  for (let i = 0; i < nos.length; i += 1) {
    const no = nos[i] ?? 0
    const c = pontoDoNo(m, no)
    const anterior = i > 0 ? nos[i - 1] : undefined
    const k = anterior === undefined ? undefined : m.portaDaAresta.get(anterior * 8 + direcaoEntre(m, anterior, no))
    const id = k !== undefined && r.portaFechada[k] === 1 ? b.paredes[k]?.id ?? null : null
    const atual = pecas[pecas.length - 1] ?? { porta: null, pontos: [] }
    const ultimo = atual.pontos[atual.pontos.length - 1] ?? c
    if (id !== null && atual.porta === id) atual.pontos.push(c)
    else if (id !== null) pecas.push({ porta: id, pontos: [ultimo, c] })
    else if (atual.porta !== null) pecas.push({ porta: null, pontos: [ultimo, c] })
    else atual.pontos.push(c)
  }
  const ultimaPeca = pecas[pecas.length - 1]
  if (ultimaPeca !== undefined && ultimaPeca.porta !== null) pecas.push({ porta: null, pontos: [ultimaPeca.pontos[ultimaPeca.pontos.length - 1] ?? para] })
  pecas[pecas.length - 1]?.pontos.push({ x: para.x, y: para.y })

  const obstaculos = b.fase.comFichas ? r.obstaculos : null
  const passa = (x: Point, y: Point) => tracoLivre(m, b.paredes, x, y, obstaculos)
  const pontos: PontoDoCaminho[] = []
  let portas = 0
  for (const peca of pecas) {
    const cantos: PontoDoCaminho[] = peca.porta === null ? alisar(peca.pontos, passa) : peca.pontos.map((p) => ({ x: p.x, y: p.y }))
    if (peca.porta !== null) {
      portas += 1
      const primeiro = cantos[0]
      const ultimo = cantos[cantos.length - 1]
      if (primeiro !== undefined) primeiro.abrir = peca.porta
      if (ultimo !== undefined) ultimo.fechar = peca.porta
    }
    for (const canto of cantos) {
      const anterior = pontos[pontos.length - 1]
      if (anterior !== undefined && anterior.x === canto.x && anterior.y === canto.y) {
        if (canto.abrir !== undefined) anterior.abrir = canto.abrir
        if (canto.fechar !== undefined) anterior.fechar = canto.fechar
        continue
      }
      const ponto: PontoDoCaminho = { x: canto.x, y: canto.y }
      if (canto.abrir !== undefined) ponto.abrir = canto.abrir
      if (canto.fechar !== undefined) ponto.fechar = canto.fechar
      pontos.push(ponto)
    }
  }
  return { tipo: 'caminho', pontos, comprimento: comprimentoDe(pontos), portas }
}

export function comprimentoDe(pontos: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]
    const b = pontos[i]
    if (a !== undefined && b !== undefined) total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** As portas trancadas no caminho da rodada que as deixou passar. */
function trancasNoCaminho(b: Busca, r: Rodada, fim: number): string[] {
  const m = b.malha
  const nos = nosDoCaminho(r, fim)
  const ids = new Set<string>()
  for (let i = 1; i < nos.length; i += 1) {
    const a = nos[i - 1] ?? 0
    const k = m.trancaDaAresta.get(a * 8 + direcaoEntre(m, a, nos[i] ?? 0))
    const w = k === undefined ? undefined : b.paredes[k]
    if (w !== undefined) ids.add(w.id)
  }
  return [...ids].sort()
}

function semCaminho(motivo: MotivoSemCaminho, portas: string[], fichas: string[]): ResultadoDoCaminho {
  return { tipo: 'sem-caminho', motivo, portas, fichas }
}

/** O traço direto de-para serve (curto pela regra do arrasto, ou livre com folga): o caminho sem rede. */
function direto(b: Busca): boolean {
  const { de, para, fichas, folgaExtra } = b.consulta
  const m = b.malha
  const obstaculos = obstaculosPara(de, fichas, m.raio, m.grid, folgaExtra)
  if (Math.hypot(para.x - de.x, para.y - de.y) <= m.grid && pernaPassa(m, b.paredes, de, para, obstaculos)) return true
  return tracoLivre(m, b.paredes, de, para, obstaculos)
}

/**
 * Começa uma busca; `avancarBusca` a leva adiante. `paredes` = as paredes de
 * agora (portas no estado atual). Malha por montar é montada aqui, de uma vez
 * (a agenda nunca chega a isso: ela só começa a busca com a malha pronta), para
 * o caminho não depender de quando a busca rodou.
 */
export function iniciarBusca(malha: Malha, paredes: readonly Wall[], consulta: ConsultaDeCaminho): Busca {
  while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
  const b: Busca = {
    malha,
    paredes,
    consulta,
    resultado: null,
    abertos: 0,
    fase: { comFichas: true, trancaPassa: false },
    rodada: null,
    fichasQueAtrapalham: new Set(),
    trancasVistas: new Set(),
  }
  const { de, para } = consulta
  if (de.x === para.x && de.y === para.y) {
    b.resultado = { tipo: 'caminho', pontos: [{ x: de.x, y: de.y }], comprimento: 0, portas: 0 }
    return b
  }
  if (direto(b)) {
    const pontos = [
      { x: de.x, y: de.y },
      { x: para.x, y: para.y },
    ]
    b.resultado = { tipo: 'caminho', pontos, comprimento: comprimentoDe(pontos), portas: 0 }
    return b
  }
  // Destino com ficha em cima: nem procura com as fichas, vai direto saber se há caminho sem elas.
  const emCima = obstaculosPara(de, consulta.fichas, malha.raio, malha.grid, consulta.folgaExtra).filter((o) => Math.hypot(o.x - para.x, o.y - para.y) < o.alcance)
  if (emCima.length > 0) {
    for (const o of emCima) b.fichasQueAtrapalham.add(o.id)
    b.fase = { comFichas: false, trancaPassa: false }
  }
  comecarRodada(b)
  return b
}

function encerrar(b: Busca, resultado: ResultadoDoCaminho): true {
  b.resultado = resultado
  if (b.rodada !== null) devolverMemoria(b.malha, b.rodada.memoria)
  b.rodada = null
  return true
}

/** Leva a busca adiante por até `orcamento` pontos da rede. `true` quando ela terminou (`b.resultado`). */
export function avancarBusca(b: Busca, orcamento: number): boolean {
  if (b.resultado !== null) return true
  const r = b.rodada
  if (r === null) return encerrar(b, semCaminho('sem-caminho', [], []))
  const fim = andarRodada(b, orcamento)
  if (fim === undefined) return false
  const { comFichas, trancaPassa } = b.fase
  if (fim >= 0) {
    if (comFichas) return encerrar(b, montarCaminho(b, r, fim))
    if (!trancaPassa) return encerrar(b, semCaminho('ocupado', [], [...b.fichasQueAtrapalham].sort()))
    return encerrar(b, semCaminho('porta-trancada', trancasNoCaminho(b, r, fim), []))
  }
  if (comFichas && b.fichasQueAtrapalham.size > 0) {
    b.fase = { comFichas: false, trancaPassa: false }
    comecarRodada(b)
    return false
  }
  if (!trancaPassa && b.trancasVistas.size > 0) {
    b.fase = { comFichas: false, trancaPassa: true }
    comecarRodada(b)
    return false
  }
  return encerrar(b, semCaminho('sem-caminho', [], []))
}

/** A busca inteira de uma vez (teste, mapa pequeno, malha já pronta). */
export function acharCaminhoNaMalha(malha: Malha, paredes: readonly Wall[], consulta: ConsultaDeCaminho): ResultadoDoCaminho {
  const b = iniciarBusca(malha, paredes, consulta)
  while (!avancarBusca(b, Number.POSITIVE_INFINITY));
  return b.resultado ?? semCaminho('sem-caminho', [], [])
}
