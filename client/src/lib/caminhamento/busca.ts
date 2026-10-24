import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { isTokenPathClear, segmentsIntersect, wallBlocksToken } from '../collision'
import { doorOpensFrom } from '../doorReach'
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
 * O andar do jogador (`lib/knownPath.ts`) usa a mesma busca, sem fichas, com
 * MÁSCARA (só o chão que ele conhece) e com a porta fechada barrando como a
 * trancada (`portaFechadaBarra`): o host não abre porta no passo dele.
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
  /**
   * MÁSCARA: onde a ficha pode pisar (o jogador: só o chão que ele já
   * conhece). Ausente = o mapa todo. Ponto da rede fora dela não entra; a
   * diagonal entra só com os dois cantos retos também dentro; perna, traço
   * direto e alisado são amostrados a cada
   * `passoDaMascara` px, nas mesmas posições em que o host confere o chão.
   */
  mascara?: (x: number, y: number) => boolean
  /** Passo das amostras de um traço na máscara, em px. Padrão: um quarto da casa (`AMOSTRAS_POR_CASA`). */
  passoDaMascara?: number
  /**
   * Porta fechada (destrancada) não abre: barra como a trancada e, como ela,
   * entra no motivo (`porta-trancada`, com o id em `portas`). É o andar do
   * jogador: o host recusa o passo que cruza porta fechada.
   */
  portaFechadaBarra?: boolean
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
/**
 * A estimativa pesa um pouco mais que o caminho feito (A* ponderado): a busca
 * abre bem menos pontos e o caminho fica, no pior caso, este tanto mais
 * comprido que o mais curto — na prática quase nada, depois do alisado.
 */
const PESO_DA_ESTIMATIVA = 1.2

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
  /** Quantos abertos há no monte (`memoria.monte*`). */
  tamanho: number
  chegada: Map<number, number>
  fichasPerto: Map<number, number[]>
  obstaculos: readonly Obstaculo[]
  portaFechada: Uint8Array
  custoPorta: number
  /** Por marco: a menor e a maior distância dele aos pontos de chegada que ele alcança (infinito: nenhum). */
  alvoMin: Float64Array
  alvoMax: Float64Array
  /** Por marco: 1 se ele alcança todos os pontos de chegada. */
  alvoTodoAlcancado: Uint8Array
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
  /** Portas fechadas que barraram uma aresta (só com `portaFechadaBarra`): como as trancas, levam à última rodada. */
  fechadasVistas: Set<number>
  /** A máscara já lida, por ponto da rede: 0 = não lido, `DENTRO`, `FORA`. `null` sem máscara. */
  naMascara: Uint8Array | null
}

const ABERTO = 1
const FECHADO = 2
const DENTRO = 1
const FORA = 2
/** Amostras por casa num traço conferido na máscara: o passo com que o host confere o chão (`moveValidation`). */
const AMOSTRAS_POR_CASA = 4
/** Teto de amostras de um traço, como no host (`MAX_PATH_SAMPLES`). */
const MAX_AMOSTRAS_DO_TRACO = 10_000

/** O ponto `no` da rede está na máscara: lido uma vez por busca. */
function noNaMascara(b: Busca, no: number): boolean {
  const lidos = b.naMascara
  if (lidos === null) return true
  const lido = lidos[no] ?? 0
  if (lido !== 0) return lido === DENTRO
  const m = b.malha
  const i = no % m.nx
  const dentro = b.consulta.mascara?.(m.x0 + i * m.grid, m.y0 + ((no - i) / m.nx) * m.grid) ?? true
  lidos[no] = dentro ? DENTRO : FORA
  return dentro
}

/**
 * A aresta de `no` (em i, j) ao vizinho `outro` (em ni, nj) fica na máscara:
 * o vizinho dentro e, na diagonal, os dois cantos retos também (não corta a
 * quina do escuro). O traço entre dois pontos é conferido inteiro só onde vira
 * trecho (alisado, perna, e a conferência final de `lib/knownPath.ts`).
 */
function arestaNaMascara(b: Busca, outro: number, i: number, j: number, ni: number, nj: number): boolean {
  if (!noNaMascara(b, outro)) return false
  if (ni === i || nj === j) return true
  const nx = b.malha.nx
  return noNaMascara(b, ni + j * nx) && noNaMascara(b, i + nj * nx)
}

/**
 * O traço a-z fica na máscara, amostrado como o host amostra o chão (mesmo
 * passo, mesmas posições). A ponta `a` não conta: é onde a ficha já está, ou
 * um ponto da rede já conferido.
 */
function tracoNaMascara(b: Busca, a: Point, z: Point): boolean {
  const mascara = b.consulta.mascara
  if (mascara === undefined) return true
  const passo = b.consulta.passoDaMascara ?? Math.max(b.malha.grid / AMOSTRAS_POR_CASA, 1)
  const querido = Math.ceil(Math.hypot(z.x - a.x, z.y - a.y) / passo)
  const amostras = Number.isFinite(querido) ? Math.min(MAX_AMOSTRAS_DO_TRACO, Math.max(1, querido)) : MAX_AMOSTRAS_DO_TRACO
  for (let k = 1; k <= amostras; k += 1) {
    const t = k / amostras
    if (!mascara(a.x + (z.x - a.x) * t, a.y + (z.y - a.y) * t)) return false
  }
  return true
}

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
 * Com máscara, o ponto e a perna ficam nela (`chegando`: a perna vai do ponto
 * da rede a `p`, e `p` conta; saindo, `p` é onde a ficha já está).
 */
function pontosEmVolta(b: Busca, p: Point, obstaculos: readonly Obstaculo[] | null, bloqueio: Uint8Array | null, chegando: boolean): Map<number, number> {
  const m = b.malha
  const paredes = b.paredes
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
        if (!noNaMascara(b, no)) continue
        const c = pontoDoNo(m, no)
        if (!pernaPassa(m, paredes, p, c, obstaculos)) continue
        if (!(chegando ? tracoNaMascara(b, c, p) : tracoNaMascara(b, p, c))) continue
        pontos.set(no, Math.hypot(c.x - p.x, c.y - p.y))
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
  const m = b.malha
  const quantos = m.quantosMarcos
  const base = no * quantos
  for (let k = 0; k < quantos; k += 1) {
    const d = m.marcos[base + k] ?? Number.POSITIVE_INFINITY
    if (d === Number.POSITIVE_INFINITY) {
      if (r.alvoTodoAlcancado[k] === 1) return -1
      continue
    }
    const min = r.alvoMin[k] ?? Number.POSITIVE_INFINITY
    if (min === Number.POSITIVE_INFINITY) return -1
    const piso = Math.max(min - d, d - (r.alvoMax[k] ?? 0))
    if (piso > h) h = piso
  }
  return h
}

function medirAlvos(m: Malha, r: Rodada): void {
  const quantos = m.quantosMarcos
  for (let k = 0; k < quantos; k += 1) {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let todos = 1
    for (const no of r.chegada.keys()) {
      const d = m.marcos[no * quantos + k] ?? Number.POSITIVE_INFINITY
      if (d === Number.POSITIVE_INFINITY) todos = 0
      else {
        min = Math.min(min, d)
        max = Math.max(max, d)
      }
    }
    r.alvoMin[k] = min
    r.alvoMax[k] = max
    r.alvoTodoAlcancado[k] = todos
  }
}

/** (fa, ha, na) sai antes de (fb, hb, nb): menor custo; empate, o mais perto do fim; empate, o menor ponto. */
function antes(fa: number, ha: number, na: number, fb: number, hb: number, nb: number): boolean {
  if (fa !== fb) return fa < fb
  if (ha !== hb) return ha < hb
  return na < nb
}

function crescerMonte(memoria: MemoriaDaBusca): void {
  const capacidade = memoria.monteNo.length * 2
  const nos = new Int32Array(capacidade)
  nos.set(memoria.monteNo)
  const fs = new Float64Array(capacidade)
  fs.set(memoria.monteF)
  const hs = new Float64Array(capacidade)
  hs.set(memoria.monteH)
  memoria.monteNo = nos
  memoria.monteF = fs
  memoria.monteH = hs
}

function pôr(r: Rodada, no: number, f: number, h: number): void {
  if (r.tamanho === r.memoria.monteNo.length) crescerMonte(r.memoria)
  const { monteNo, monteF, monteH } = r.memoria
  let i = r.tamanho
  r.tamanho += 1
  while (i > 0) {
    const pai = (i - 1) >> 1
    const noPai = monteNo[pai] ?? 0
    const fPai = monteF[pai] ?? 0
    const hPai = monteH[pai] ?? 0
    if (!antes(f, h, no, fPai, hPai, noPai)) break
    monteNo[i] = noPai
    monteF[i] = fPai
    monteH[i] = hPai
    i = pai
  }
  monteNo[i] = no
  monteF[i] = f
  monteH[i] = h
}

/** Tira o primeiro do monte (que não pode estar vazio). */
function tirar(r: Rodada): number {
  const { monteNo, monteF, monteH } = r.memoria
  const topo = monteNo[0] ?? -1
  r.tamanho -= 1
  const n = r.tamanho
  if (n === 0) return topo
  const no = monteNo[n] ?? 0
  const f = monteF[n] ?? 0
  const h = monteH[n] ?? 0
  let i = 0
  for (;;) {
    let filho = 2 * i + 1
    if (filho >= n) break
    const irmao = filho + 1
    if (irmao < n && antes(monteF[irmao] ?? 0, monteH[irmao] ?? 0, monteNo[irmao] ?? 0, monteF[filho] ?? 0, monteH[filho] ?? 0, monteNo[filho] ?? 0)) filho = irmao
    const noFilho = monteNo[filho] ?? 0
    const fFilho = monteF[filho] ?? 0
    const hFilho = monteH[filho] ?? 0
    if (!antes(fFilho, hFilho, noFilho, f, h, no)) break
    monteNo[i] = noFilho
    monteF[i] = fFilho
    monteH[i] = hFilho
    i = filho
  }
  monteNo[i] = no
  monteF[i] = f
  monteH[i] = h
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
    tamanho: 0,
    chegada: new Map(),
    fichasPerto: new Map(),
    obstaculos,
    portaFechada: new Uint8Array(b.paredes.length),
    custoPorta: b.consulta.custoPorPorta ?? CUSTO_DA_PORTA * m.grid,
    alvoMin: new Float64Array(m.quantosMarcos),
    alvoMax: new Float64Array(m.quantosMarcos),
    alvoTodoAlcancado: new Uint8Array(m.quantosMarcos),
  }
  for (const k of m.portas) {
    const w = b.paredes[k]
    if (w !== undefined && w.door !== null && !w.door.open) r.portaFechada[k] = 1
  }
  marcarFichas(m, r)
  const comFichas = b.fase.comFichas ? obstaculos : null
  const bloqueio = b.fase.comFichas ? r.memoria.bloqueioFicha : null
  const inicio = pontosEmVolta(b, de, comFichas, bloqueio, false)
  r.chegada = pontosEmVolta(b, para, comFichas, bloqueio, true)
  b.rodada = r
  if (r.chegada.size === 0) return
  medirAlvos(m, r)
  const { g, h: estimado, veio, marca } = r.memoria
  for (const [no, dist] of inicio) {
    const c = pontoDoNo(m, no)
    const h = estimativa(b, r, no, c.x, c.y)
    if (h < 0) continue
    g[no] = dist
    estimado[no] = h
    // A memória vem de outra busca: o ponto de saída precisa dizer que é o começo.
    veio[no] = -1
    marca[no] = ABERTO
    pôr(r, no, dist + PESO_DA_ESTIMATIVA * h, h)
  }
}

const PASSO_EM_I = Int8Array.from(DIRECOES, ([di]) => di)
const PASSO_EM_J = Int8Array.from(DIRECOES, ([, dj]) => dj)
/** Para cada diagonal, os bits dos dois lados retos que ela não pode cortar (0 nas retas). */
const RETOS_DA_DIAGONAL = Uint8Array.from(DIRECOES, ([di, dj], dir) => (dir < 4 ? 0 : (1 << (di > 0 ? 0 : 1)) | (1 << (dj > 0 ? 2 : 3))))

/**
 * O custo a mais da aresta de `no` na direção `dir` que cruza tranca ou porta
 * (o ponto em px, py), ou -1 se ela não passa nesta rodada.
 */
function custoDaPorta(b: Busca, r: Rodada, no: number, dir: number, px: number, py: number): number {
  const m = b.malha
  const bit = 1 << dir
  const parede = m.parede[no] ?? 0
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
  // Diagonal só com os dois lados retos livres (sem parede, sem porta): não corta quina.
  if (((parede | tranca | porta) & (RETOS_DA_DIAGONAL[dir] ?? 0)) !== 0) return -1
  if ((porta & bit) !== 0) {
    const k = m.portaDaAresta.get(no * 8 + dir)
    if (k !== undefined && r.portaFechada[k] === 1) {
      if (b.consulta.portaFechadaBarra === true && !b.fase.trancaPassa) {
        b.fechadasVistas.add(k)
        return -1
      }
      const w = b.paredes[k]
      // Porta de um lado: fechada, só abre de quem está do lado certo. Em cima da linha
      // não há lado errado: a ficha de duas casas anda pelos cantos e passa por ela.
      if (w !== undefined && !doorOpensFrom(w, { x: px, y: py })) return -1
      extra += r.custoPorta
    }
  }
  return extra
}

/**
 * Uma ficha barra o passo de (px, py) ao ponto `outro` em (cx, cy): ele está
 * barrado, ou o traço encosta numa ficha de perto (`perto`). Anota quem atrapalha.
 */
function fichaBarra(b: Busca, r: Rodada, outro: number, perto: readonly number[] | undefined, px: number, py: number, cx: number, cy: number): boolean {
  if (r.memoria.bloqueioFicha[outro] === 1) {
    for (const o of r.obstaculos) if (Math.hypot(cx - o.x, cy - o.y) < o.alcance) b.fichasQueAtrapalham.add(o.id)
    return true
  }
  if (perto === undefined) return false
  for (const indice of perto) {
    const o = r.obstaculos[indice]
    if (o !== undefined && distanciaAoTraco(o.x, o.y, px, py, cx, cy) < o.alcance) {
      b.fichasQueAtrapalham.add(o.id)
      return true
    }
  }
  return false
}

/**
 * Uma rodada anda até `orcamento` pontos. Devolve o fim (achou), -1 se a
 * rodada acabou sem caminho, ou `undefined` se ainda não terminou. É o laço
 * quente do motor: o que é do ponto (bits, fichas de perto) é lido uma vez,
 * não por vizinho, e a estimativa de cada ponto, uma vez por rodada.
 */
function andarRodada(b: Busca, orcamento: number): number | undefined {
  const r = b.rodada
  if (r === null) return -1
  const m = b.malha
  const { g, h: estimado, veio, marca } = r.memoria
  const fim = m.nx * m.ny
  const comFichas = b.fase.comFichas
  const comMascara = b.naMascara !== null
  const custoReto = m.grid
  const custoDiagonal = m.grid * RAIZ_DE_2
  let feitos = 0
  while (r.tamanho > 0) {
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
    const parede = m.parede[no] ?? 0xff
    const especial = (m.tranca[no] ?? 0) | (m.porta[no] ?? 0)
    const quina = parede | especial
    const perto = comFichas ? r.fichasPerto.get(no) : undefined
    const i = no % m.nx
    const j = (no - i) / m.nx
    const px = m.x0 + i * m.grid
    const py = m.y0 + j * m.grid
    for (let dir = 0; dir < 8; dir += 1) {
      const bit = 1 << dir
      if ((parede & bit) !== 0) continue
      const ni = i + (PASSO_EM_I[dir] ?? 0)
      const nj = j + (PASSO_EM_J[dir] ?? 0)
      if (ni < 0 || nj < 0 || ni >= m.nx || nj >= m.ny) continue
      const outro = ni + nj * m.nx
      if (marca[outro] === FECHADO) continue
      if (comMascara && !arestaNaMascara(b, outro, i, j, ni, nj)) continue
      let custo = dir < 4 ? custoReto : custoDiagonal
      if ((especial & bit) !== 0) {
        const extra = custoDaPorta(b, r, no, dir, px, py)
        if (extra < 0) continue
        custo += extra
      } else if ((quina & (RETOS_DA_DIAGONAL[dir] ?? 0)) !== 0) continue
      const cx = m.x0 + ni * m.grid
      const cy = m.y0 + nj * m.grid
      if (comFichas && fichaBarra(b, r, outro, perto, px, py, cx, cy)) continue
      const novo = custoAqui + custo
      const aberto = marca[outro] === ABERTO
      if (aberto && novo >= (g[outro] ?? 0)) continue
      let h = estimado[outro] ?? 0
      if (!aberto) {
        h = estimativa(b, r, outro, cx, cy)
        if (h < 0) {
          // Outra parte do mapa (os marcos separam): nem volta a olhar.
          marca[outro] = FECHADO
          continue
        }
        estimado[outro] = h
      }
      g[outro] = novo
      veio[outro] = no
      marca[outro] = ABERTO
      pôr(r, outro, novo + PESO_DA_ESTIMATIVA * h, h)
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
  const passa = (x: Point, y: Point) => tracoLivre(m, b.paredes, x, y, obstaculos) && tracoNaMascara(b, x, y)
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

/** As portas trancadas (e, com `portaFechadaBarra`, as fechadas) no caminho da rodada que as deixou passar. */
function trancasNoCaminho(b: Busca, r: Rodada, fim: number): string[] {
  const m = b.malha
  const nos = nosDoCaminho(r, fim)
  const ids = new Set<string>()
  const fechadaConta = b.consulta.portaFechadaBarra === true
  for (let i = 1; i < nos.length; i += 1) {
    const a = nos[i - 1] ?? 0
    const aresta = a * 8 + direcaoEntre(m, a, nos[i] ?? 0)
    const fechada = fechadaConta ? m.portaDaAresta.get(aresta) : undefined
    const k = m.trancaDaAresta.get(aresta) ?? (fechada !== undefined && r.portaFechada[fechada] === 1 ? fechada : undefined)
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
  const curto = Math.hypot(para.x - de.x, para.y - de.y) <= m.grid && pernaPassa(m, b.paredes, de, para, obstaculos)
  return (curto || tracoLivre(m, b.paredes, de, para, obstaculos)) && tracoNaMascara(b, de, para)
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
    fechadasVistas: new Set(),
    naMascara: consulta.mascara === undefined ? null : new Uint8Array(malha.nx * malha.ny),
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

/** A busca que ninguém mais espera (pedido trocado ou cancelado): a memória dela volta para a malha. */
export function largarBusca(b: Busca): void {
  if (b.rodada !== null) devolverMemoria(b.malha, b.rodada.memoria)
  b.rodada = null
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
  if (!trancaPassa && (b.trancasVistas.size > 0 || b.fechadasVistas.size > 0)) {
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
