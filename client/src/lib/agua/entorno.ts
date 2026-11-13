import type { Agua, FloorPiece, Prop, Region, TracoDeAreia } from '../../types/map'
import { buildFloorOutline } from '../floorContour'
import { compileFloor, pieceBounds } from '../floorSdf'
import { visibleRegions, type FonteDeCamadas } from '../layers'
import { ehConstrucao } from '../mobilia/construcoes'
import { propCorners } from '../objectTransform'
import { CASA_U, PERTO } from './campo'
import { larguraDoRio } from './dados'
import { curvaGuardada } from './forma'

/**
 * ÁGUA E O QUE ESTÁ EM VOLTA (MAR MAIS FÁCIL, 13/11/2026): o retângulo do
 * mapa, o chão que fica POR CIMA da água (salas e Chão Liso: a água abre
 * buraco) e o que tira a margem da beira (salas, Chão Liso e construções: por
 * baixo ou a menos de meia casa, sem raso, espuma nem areia). Tudo em px de
 * mundo; lógica pura, quem desenha é `pixi/aguaDoMapa.ts`.
 *
 * CHÃO LISO (decisão de 13/11, 11h30): a peça fica por cima de UMA água só
 * quando mais da metade dela está dentro dessa água (píer, plataforma, ponte);
 * a peça de fundo ou de terra fica por baixo, como na 0.5.62 (`lisasDaAgua`).
 *
 * No jogador o entorno sai só do que ele recebe (as salas e o Chão do recorte):
 * a sala secreta que não chega a ele não abre buraco nem tira margem. A conta
 * da metade também: a peça e a água que ele recebe, nunca as do mestre.
 */

/** Uma forma: anéis fechados (x, y, x, y...) em px de mundo, dentro por par ou ímpar entre os anéis. */
export interface FormaDoEntorno {
  aneis: readonly (readonly number[])[]
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Uma peça de Chão Liso desenhada: fica por cima da água em que mais da metade dela está (`lisasDaAgua`). */
export interface PecaLisa {
  /** A peça e as peças 'subtract' que vêm depois dela (elas a apagam, como no Chão). */
  pecas: FloorPiece[]
  /** A caixa da peça (px de mundo), cortada ao mapa. */
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface EntornoDaAgua {
  /** O mapa (px de mundo): a água não passa dele, e a beira na borda não é margem. `null` = mapa sem tamanho. */
  mapa: { largura: number; altura: number } | null
  /** Por cima de toda água: o fundo das salas. */
  porCima: readonly FormaDoEntorno[]
  /** A beira por baixo ou perto destas não é margem em toda água: salas e construções. */
  semMargem: readonly FormaDoEntorno[]
  /** O Chão Liso desenhado: cada peça vale só na água em que mais da metade dela está. */
  lisas: readonly PecaLisa[]
  /** O passo do contorno do Chão (`FloorStyle.sampleStep`): o buraco da peça segue a borda que o Chão desenha. */
  passo: number | undefined
  /** Muda quando o conteúdo muda (a assinatura do campo). */
  chave: string
}

/** A beira a menos disto (em casas) de sala, Chão Liso ou construção não é margem. */
export const PERTO_DA_ESTRUTURA = 0.5
/** A beira a menos disto (em casas) da borda do mapa, ou fora dele, não é margem (o mar segue para fora). */
export const NA_BORDA = 0.05
/** O pincel de areia esmaece nesta distância (em casas): a areia some aos poucos, sem corte reto. */
export const ESMAECER_DA_AREIA = 0.5

export const SEM_ENTORNO: EntornoDaAgua = { mapa: null, porCima: [], semMargem: [], lisas: [], passo: undefined, chave: '' }

const arred = (v: number): number => Math.round(v * 2) / 2

function formaDosAneis(aneis: readonly (readonly number[])[]): FormaDoEntorno | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const validos = aneis.filter((a) => a.length >= 6)
  for (const anel of validos) {
    for (let i = 0; i + 1 < anel.length; i += 2) {
      x0 = Math.min(x0, anel[i])
      y0 = Math.min(y0, anel[i + 1])
      x1 = Math.max(x1, anel[i])
      y1 = Math.max(y1, anel[i + 1])
    }
  }
  return validos.length === 0 || !Number.isFinite(x0) ? null : { aneis: validos, x0, y0, x1, y1 }
}

const plano = (pontos: readonly { x: number; y: number }[]): number[] => pontos.flatMap((p) => [arred(p.x), arred(p.y)])

export interface PecasDoEntorno {
  /** O mapa em px de mundo (largura * grade); 0 = sem tamanho. */
  largura: number
  altura: number
  /** As salas do piso (as escondidas do olho do mestre saem por `ocultas`, como no desenho). */
  regioes: readonly Region[]
  ocultas: FonteDeCamadas
  /** As peças de Chão Liso desenhadas, na ordem (a lista que o Chão desenha, `pecasLisas`). */
  chao: readonly FloorPiece[]
  /** `FloorStyle.sampleStep` (ausente = o passo padrão do Chão). */
  passo?: number
  props: readonly Prop[]
}

interface Guardado {
  ocultas: FonteDeCamadas
  chao: readonly FloorPiece[]
  passo: number | undefined
  props: readonly Prop[]
  largura: number
  altura: number
  entorno: EntornoDaAgua
}
const guardados = new WeakMap<readonly Region[], Guardado>()

/** As peças lisas que somam chão (com as que as apagam depois) e o desenho delas para a chave. */
function lisasDoChao(chao: readonly FloorPiece[], mapa: EntornoDaAgua['mapa'], partes: unknown[]): PecaLisa[] {
  const lisas: PecaLisa[] = []
  for (let i = 0; i < chao.length; i += 1) {
    const peca = chao[i]
    if (peca.hidden === true) continue
    partes.push(4, peca.op, peca.shape, peca.rotation ?? 0, peca.modifiers)
    if (peca.op !== 'add') continue
    const b = pieceBounds(peca)
    const x0 = mapa === null ? b.minX : Math.max(0, b.minX)
    const y0 = mapa === null ? b.minY : Math.max(0, b.minY)
    const x1 = mapa === null ? b.maxX : Math.min(mapa.largura, b.maxX)
    const y1 = mapa === null ? b.maxY : Math.min(mapa.altura, b.maxY)
    if (!(x1 > x0 && y1 > y0)) continue
    const buracos = chao.slice(i + 1).filter((p) => p.op === 'subtract' && p.hidden !== true)
    lisas.push({ pecas: [peca, ...buracos], x0, y0, x1, y1 })
  }
  return lisas
}

/** O entorno das águas; as mesmas peças (pela referência) devolvem o mesmo objeto. */
export function entornoDaAgua(pecas: PecasDoEntorno): EntornoDaAgua {
  const ja = guardados.get(pecas.regioes)
  if (ja !== undefined && ja.ocultas === pecas.ocultas && ja.chao === pecas.chao && ja.passo === pecas.passo && ja.props === pecas.props && ja.largura === pecas.largura && ja.altura === pecas.altura) return ja.entorno
  const salas = visibleRegions([...pecas.regioes], pecas.ocultas).filter((r) => r.points.length >= 3 && r.agua !== true)
  const porCima: FormaDoEntorno[] = []
  const semMargem: FormaDoEntorno[] = []
  const partes: unknown[] = [pecas.largura, pecas.altura]
  for (const sala of salas) {
    const anel = plano(sala.points)
    const forma = formaDosAneis([anel])
    if (forma === null) continue
    semMargem.push(forma)
    // A sala sem fundo não tem chão para mostrar: a água segue por baixo dela.
    if (sala.filled !== false) porCima.push(forma)
    partes.push(sala.filled === false ? 0 : 1, anel)
  }
  for (const prop of pecas.props) {
    if (!ehConstrucao(prop.mobilia)) continue
    const anel = plano(propCorners(prop))
    const forma = formaDosAneis([anel])
    if (forma === null) continue
    semMargem.push(forma)
    partes.push(3, anel)
  }
  const mapa = pecas.largura > 0 && pecas.altura > 0 ? { largura: pecas.largura, altura: pecas.altura } : null
  // O Chão Liso não entra em `porCima` nem em `semMargem`: cada peça vale só na água em que mais da metade dela está.
  const lisas = lisasDoChao(pecas.chao, mapa, partes)
  partes.push(pecas.passo ?? null)
  const entorno: EntornoDaAgua = { mapa, porCima, semMargem, lisas, passo: pecas.passo, chave: JSON.stringify(partes) }
  guardados.set(pecas.regioes, { ocultas: pecas.ocultas, chao: pecas.chao, passo: pecas.passo, props: pecas.props, largura: pecas.largura, altura: pecas.altura, entorno })
  return entorno
}

// ---------- o Chão Liso por cima de uma água: a conta da metade ----------

/** A água como quem vê a recebe, para a conta da metade (px de mundo). */
export interface AguaParaMetade {
  /** Dentro da água, como ela é desenhada (o contorno, a largura do rio ou as células do recorte). */
  dentro: (x: number, y: number) => boolean
  x0: number
  y0: number
  x1: number
  y1: number
  /** A área da água no mapa (px²). */
  area: number
}

/** Teto de amostras por peça na conta da metade: na peça grande a grade fica mais rala. */
const AMOSTRAS_DA_METADE = 4096
/** A grade mais fina da conta da metade, em casas (a mesma do campo da água). */
const GRADE_DA_METADE = 0.1

interface AmostrasDaPeca {
  grid: number
  lado: number
  i0: number
  j0: number
  colunas: number
  linhas: number
  /** 1 = a amostra está na peça (e no mapa). */
  naPeca: Uint8Array
  total: number
}
const amostrasDasPecas = new WeakMap<PecaLisa, AmostrasDaPeca>()

/** As amostras da peça numa grade presa à origem do mundo: o mestre e o jogador contam nos mesmos pontos. */
function amostrasDaPeca(lisa: PecaLisa, grid: number): AmostrasDaPeca {
  const ja = amostrasDasPecas.get(lisa)
  if (ja !== undefined && ja.grid === grid) return ja
  const lado = Math.max(grid * GRADE_DA_METADE, Math.sqrt(((lisa.x1 - lisa.x0) * (lisa.y1 - lisa.y0)) / AMOSTRAS_DA_METADE), 1)
  const i0 = Math.floor(lisa.x0 / lado)
  const j0 = Math.floor(lisa.y0 / lado)
  const colunas = Math.max(0, Math.ceil(lisa.x1 / lado) - i0)
  const linhas = Math.max(0, Math.ceil(lisa.y1 / lado) - j0)
  const naPeca = new Uint8Array(colunas * linhas)
  const { sample } = compileFloor(lisa.pecas)
  let total = 0
  for (let j = 0; j < linhas; j += 1) {
    const y = (j0 + j + 0.5) * lado
    if (y < lisa.y0 || y > lisa.y1) continue
    for (let i = 0; i < colunas; i += 1) {
      const x = (i0 + i + 0.5) * lado
      if (x < lisa.x0 || x > lisa.x1 || !(sample(x, y) < 0)) continue
      naPeca[j * colunas + i] = 1
      total += 1
    }
  }
  const amostras = { grid, lado, i0, j0, colunas, linhas, naPeca, total }
  amostrasDasPecas.set(lisa, amostras)
  return amostras
}

/**
 * As peças de Chão Liso que ficam por cima DESTA água: mais da metade da peça
 * dentro dela (píer, plataforma, ponte). A peça que guarda mais da metade da
 * água é o chão debaixo dela (o fundo do mapa com um mar grande) e fica por
 * baixo, como a peça de terra.
 */
export function lisasPorCima(entorno: EntornoDaAgua, agua: AguaParaMetade, grid: number): PecaLisa[] {
  const saida: PecaLisa[] = []
  for (const lisa of entorno.lisas) {
    if (lisa.x1 <= agua.x0 || lisa.x0 >= agua.x1 || lisa.y1 <= agua.y0 || lisa.y0 >= agua.y1) continue
    const a = amostrasDaPeca(lisa, grid)
    if (a.total === 0) continue
    const ia = Math.max(0, Math.floor(agua.x0 / a.lado) - a.i0)
    const ib = Math.min(a.colunas, Math.ceil(agua.x1 / a.lado) - a.i0)
    const ja = Math.max(0, Math.floor(agua.y0 / a.lado) - a.j0)
    const jb = Math.min(a.linhas, Math.ceil(agua.y1 / a.lado) - a.j0)
    // Nem toda a caixa da água em comum daria a metade: nem conta.
    if ((ib - ia) * (jb - ja) * 2 <= a.total) continue
    let naAgua = 0
    for (let j = ja; j < jb; j += 1) {
      const y = (a.j0 + j + 0.5) * a.lado
      for (let i = ia; i < ib; i += 1) if (a.naPeca[j * a.colunas + i] === 1 && agua.dentro((a.i0 + i + 0.5) * a.lado, y)) naAgua += 1
    }
    if (naAgua * 2 > a.total && naAgua * a.lado * a.lado * 2 <= agua.area) saida.push(lisa)
  }
  return saida
}

/** Área (px²) do anel [x, y, ...] cortado ao retângulo do mapa (Sutherland-Hodgman: o recorte é convexo). */
function areaNoMapa(xy: readonly number[], mapa: EntornoDaAgua['mapa']): number {
  let pts: number[] = [...xy]
  if (mapa !== null) {
    const cortar = (dentro: (x: number, y: number) => boolean, corte: (ax: number, ay: number, bx: number, by: number) => [number, number]): void => {
      const saida: number[] = []
      const n = pts.length / 2
      for (let i = 0; i < n; i += 1) {
        const ax = pts[i * 2]
        const ay = pts[i * 2 + 1]
        const bx = pts[((i + 1) % n) * 2]
        const by = pts[((i + 1) % n) * 2 + 1]
        const da = dentro(ax, ay)
        const db = dentro(bx, by)
        if (da) saida.push(ax, ay)
        if (da !== db) saida.push(...corte(ax, ay, bx, by))
      }
      pts = saida
    }
    const emX = (x: number) => (ax: number, ay: number, bx: number, by: number): [number, number] => [x, ay + ((by - ay) * (x - ax)) / (bx - ax)]
    const emY = (y: number) => (ax: number, ay: number, bx: number, by: number): [number, number] => [ax + ((bx - ax) * (y - ay)) / (by - ay), y]
    cortar((x) => x >= 0, emX(0))
    cortar((x) => x <= mapa.largura, emX(mapa.largura))
    cortar((_x, y) => y >= 0, emY(0))
    cortar((_x, y) => y <= mapa.altura, emY(mapa.altura))
  }
  let dobro = 0
  const n = pts.length / 2
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    dobro += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]
  }
  return Math.abs(dobro) / 2
}

/** O rio (o traço do mestre ou os trechos do recorte) com a meia largura. */
function rioParaMetade(tracos: readonly (readonly number[])[], meia: number): AguaParaMetade | null {
  const baldes = new Baldes(Math.max(8, meia), meia)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  let comprimento = 0
  for (const xy of tracos) {
    for (let i = 0; i + 1 < xy.length; i += 2) {
      x0 = Math.min(x0, xy[i])
      y0 = Math.min(y0, xy[i + 1])
      x1 = Math.max(x1, xy[i])
      y1 = Math.max(y1, xy[i + 1])
      if (i + 3 < xy.length) {
        baldes.por(xy[i], xy[i + 1], xy[i + 2], xy[i + 3])
        comprimento += Math.hypot(xy[i + 2] - xy[i], xy[i + 3] - xy[i + 1])
      }
    }
  }
  if (!Number.isFinite(x0) || comprimento <= 0) return null
  return { dentro: (x, y) => baldes.perto(x, y, meia), x0: x0 - meia, y0: y0 - meia, x1: x1 + meia, y1: y1 + meia, area: comprimento * meia * 2 }
}

/**
 * O lago ou o mar do jogador (`Agua.recorte`): as células conhecidas com água
 * e, perto de uma margem conhecida, o lado da água, a mesma conta do campo
 * (`campoDaArea`, a margem mais perto até `PERTO`).
 */
function recorteParaMetade(celula: number, chaves: ReadonlySet<string>, margens: readonly (readonly number[])[], grid: number): AguaParaMetade | null {
  if (chaves.size === 0 || !(celula > 0)) return null
  const raio = (PERTO * Math.max(1, grid)) / CASA_U
  const baldes = new Baldes(Math.max(8, grid), raio)
  for (const m of margens) for (let i = 0; i + 3 < m.length; i += 2) baldes.por(m[i], m[i + 1], m[i + 2], m[i + 3])
  let c0 = Infinity
  let l0 = Infinity
  let c1 = -Infinity
  let l1 = -Infinity
  for (const chave of chaves) {
    const [col, lin] = chave.split(',').map(Number)
    c0 = Math.min(c0, col)
    l0 = Math.min(l0, lin)
    c1 = Math.max(c1, col)
    l1 = Math.max(l1, lin)
  }
  if (!Number.isFinite(c0) || !Number.isFinite(l0)) return null
  const s = baldes.segs
  const dentro = (x: number, y: number): boolean => {
    if (!chaves.has(`${Math.floor(x / celula)},${Math.floor(y / celula)}`)) return false
    const i = baldes.maisPerto(x, y, raio)
    if (i < 0) return true
    return (s[i + 2] - s[i]) * (y - s[i + 1]) - (s[i + 3] - s[i + 1]) * (x - s[i]) >= 0
  }
  return { dentro, x0: c0 * celula, y0: l0 * celula, x1: (c1 + 1) * celula, y1: (l1 + 1) * celula, area: chaves.size * celula * celula }
}

/** Esta água para a conta da metade, como quem vê a recebe (o mestre inteira; o jogador o recorte). */
export function aguaParaMetade(agua: Agua, grid: number, mapa: EntornoDaAgua['mapa']): AguaParaMetade | null {
  const recorte = agua.recorte
  if (agua.tipo === 'rio') {
    const meia = (larguraDoRio(agua) * grid) / 2
    if (recorte !== undefined) return rioParaMetade((recorte.trechos ?? []).map((t) => t.pontos), meia)
    return rioParaMetade([curvaGuardada(agua, grid)], meia)
  }
  if (recorte !== undefined) return recorteParaMetade(recorte.celula, new Set(recorte.celulas ?? []), (recorte.margens ?? []).filter((m) => m.length >= 4), grid)
  const xy = curvaGuardada(agua, grid)
  const forma = formaDosAneis([xy])
  if (forma === null) return null
  const indexada = indexarForma(forma, Math.max(1, grid))
  return { dentro: (x, y) => dentroDaForma(indexada, x, y), x0: forma.x0, y0: forma.y0, x1: forma.x1, y1: forma.y1, area: areaNoMapa(xy, mapa) }
}

const SEM_LISAS: readonly PecaLisa[] = []
const lisasGuardadas = new WeakMap<Agua, { entorno: EntornoDaAgua; grid: number; lisas: readonly PecaLisa[] }>()

/** As peças de Chão Liso por cima desta água (guardado pela água e pelo entorno: o objeto muda quando ela muda). */
export function lisasDaAgua(agua: Agua, grid: number, entorno: EntornoDaAgua | undefined): readonly PecaLisa[] {
  if (entorno === undefined || entorno.lisas.length === 0) return SEM_LISAS
  const ja = lisasGuardadas.get(agua)
  if (ja !== undefined && ja.entorno === entorno && ja.grid === grid) return ja.lisas
  const medida = aguaParaMetade(agua, grid, entorno.mapa)
  const achadas = medida === null ? [] : lisasPorCima(entorno, medida, grid)
  const lisas = achadas.length === 0 ? SEM_LISAS : achadas
  lisasGuardadas.set(agua, { entorno, grid, lisas })
  return lisas
}

const formasDasLisas = new WeakMap<PecaLisa, FormaDoEntorno | null>()

/** O contorno da peça sozinha (com as que a apagam), no passo e no recorte do Chão: o buraco segue a borda desenhada. */
export function formaDaLisa(lisa: PecaLisa, entorno: EntornoDaAgua): FormaDoEntorno | null {
  const ja = formasDasLisas.get(lisa)
  if (ja !== undefined) return ja
  const m = entorno.mapa
  const poligonos = buildFloorOutline(lisa.pecas, { step: entorno.passo, clip: m === null ? undefined : { minX: 0, minY: 0, maxX: m.largura, maxY: m.altura } })
  const forma = formaDosAneis(poligonos.flatMap((p) => [plano(p.outer), ...p.holes.map(plano)]))
  formasDasLisas.set(lisa, forma)
  return forma
}

/** As formas que tocam a caixa (px de mundo). */
export function formasNaCaixa(formas: readonly FormaDoEntorno[], x0: number, y0: number, x1: number, y1: number): FormaDoEntorno[] {
  return formas.filter((f) => f.x1 >= x0 && f.x0 <= x1 && f.y1 >= y0 && f.y0 <= y1)
}

// ---------- perguntas por ponto, com baldes ----------

function distanciaAoSegmento2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const l2 = vx * vx + vy * vy
  const t = l2 <= 1e-12 ? 0 : Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / l2))
  const dx = px - ax - vx * t
  const dy = py - ay - vy * t
  return dx * dx + dy * dy
}

const chaveDoBalde = (bx: number, by: number): number => (bx + 0x8000) * 0x10000 + (by + 0x8000)

/** Segmentos [ax, ay, bx, by] guardados nos baldes que eles tocam (com a folga `raio`). */
class Baldes {
  private readonly mapa = new Map<number, number[]>()
  readonly segs: number[] = []
  constructor(
    private readonly lado: number,
    private readonly raio: number,
  ) {}
  por(ax: number, ay: number, bx: number, by: number): void {
    const i = this.segs.length
    this.segs.push(ax, ay, bx, by)
    const l = this.lado
    for (let y = Math.floor((Math.min(ay, by) - this.raio) / l); y <= Math.floor((Math.max(ay, by) + this.raio) / l); y += 1) {
      for (let x = Math.floor((Math.min(ax, bx) - this.raio) / l); x <= Math.floor((Math.max(ax, bx) + this.raio) / l); x += 1) {
        const k = chaveDoBalde(x, y)
        const lista = this.mapa.get(k)
        if (lista === undefined) this.mapa.set(k, [i])
        else lista.push(i)
      }
    }
  }
  /** Algum segmento a até `raio` do ponto? */
  perto(px: number, py: number, raio: number): boolean {
    const lista = this.mapa.get(chaveDoBalde(Math.floor(px / this.lado), Math.floor(py / this.lado)))
    if (lista === undefined) return false
    const r2 = raio * raio
    const s = this.segs
    for (const i of lista) if (distanciaAoSegmento2(px, py, s[i], s[i + 1], s[i + 2], s[i + 3]) <= r2) return true
    return false
  }
  /** O segmento mais perto a até `raio` do ponto (o índice em `segs`), ou -1. */
  maisPerto(px: number, py: number, raio: number): number {
    const lista = this.mapa.get(chaveDoBalde(Math.floor(px / this.lado), Math.floor(py / this.lado)))
    if (lista === undefined) return -1
    let melhor = raio * raio
    let achado = -1
    const s = this.segs
    for (const i of lista) {
      const d2 = distanciaAoSegmento2(px, py, s[i], s[i + 1], s[i + 2], s[i + 3])
      if (d2 <= melhor) {
        melhor = d2
        achado = i
      }
    }
    return achado
  }
}

/** Dentro da forma (par ou ímpar), com os segmentos guardados por faixa de altura. */
interface FormaIndexada {
  forma: FormaDoEntorno
  faixa: number
  porFaixa: Map<number, number[]>
}

function indexarForma(forma: FormaDoEntorno, faixa: number): FormaIndexada {
  const porFaixa = new Map<number, number[]>()
  for (const anel of forma.aneis) {
    const m = anel.length / 2
    for (let i = 0; i < m; i += 1) {
      const j = (i + 1) % m
      const ay = anel[i * 2 + 1]
      const by = anel[j * 2 + 1]
      for (let f = Math.floor(Math.min(ay, by) / faixa); f <= Math.floor(Math.max(ay, by) / faixa); f += 1) {
        const lista = porFaixa.get(f)
        const seg = [anel[i * 2], ay, anel[j * 2], by]
        if (lista === undefined) porFaixa.set(f, seg)
        else lista.push(...seg)
      }
    }
  }
  return { forma, faixa, porFaixa }
}

function dentroDaForma(f: FormaIndexada, x: number, y: number): boolean {
  if (x < f.forma.x0 || x > f.forma.x1 || y < f.forma.y0 || y > f.forma.y1) return false
  const s = f.porFaixa.get(Math.floor(y / f.faixa))
  if (s === undefined) return false
  let dentro = false
  for (let i = 0; i + 3 < s.length; i += 4) {
    const ay = s[i + 1]
    const by = s[i + 3]
    if (ay > y !== by > y && x < ((s[i + 2] - s[i]) * (y - ay)) / (by - ay) + s[i]) dentro = !dentro
  }
  return dentro
}

interface IndiceDaEstrutura {
  grid: number
  bordas: Baldes
  formas: FormaIndexada[]
}
const indicesDaEstrutura = new WeakMap<EntornoDaAgua, IndiceDaEstrutura>()

function indexarEstruturas(formas: readonly FormaDoEntorno[], grid: number): IndiceDaEstrutura {
  const raio = grid * PERTO_DA_ESTRUTURA
  const bordas = new Baldes(Math.max(1, grid), raio)
  const indexadas: FormaIndexada[] = []
  for (const forma of formas) {
    for (const anel of forma.aneis) {
      const m = anel.length / 2
      for (let i = 0; i < m; i += 1) {
        const j = (i + 1) % m
        bordas.por(anel[i * 2], anel[i * 2 + 1], anel[j * 2], anel[j * 2 + 1])
      }
    }
    indexadas.push(indexarForma(forma, Math.max(1, grid)))
  }
  return { grid, bordas, formas: indexadas }
}

function indiceDaEstrutura(entorno: EntornoDaAgua, grid: number): IndiceDaEstrutura {
  const ja = indicesDaEstrutura.get(entorno)
  if (ja !== undefined && ja.grid === grid) return ja
  const indice = indexarEstruturas(entorno.semMargem, grid)
  indicesDaEstrutura.set(entorno, indice)
  return indice
}

/** O Chão Liso por cima de uma água (a lista de `lisasDaAgua`, guardada por ela). */
const indicesDasLisas = new WeakMap<readonly PecaLisa[], IndiceDaEstrutura>()
function indiceDasLisas(lisas: readonly PecaLisa[], entorno: EntornoDaAgua, grid: number): IndiceDaEstrutura | null {
  if (lisas.length === 0) return null
  const ja = indicesDasLisas.get(lisas)
  if (ja !== undefined && ja.grid === grid) return ja
  const formas = lisas.map((l) => formaDaLisa(l, entorno)).filter((f): f is FormaDoEntorno => f !== null)
  const indice = indexarEstruturas(formas, grid)
  indicesDasLisas.set(lisas, indice)
  return indice
}

const pertoDe = (indice: IndiceDaEstrutura | null, x: number, y: number, raio: number): boolean => indice !== null && (indice.bordas.perto(x, y, raio) || indice.formas.some((f) => dentroDaForma(f, x, y)))

/**
 * Por ponto da linha da beira (x, y, ... em px de mundo): 1 = margem (raso,
 * espuma e areia, como antes); 0 = na borda do mapa ou fora dele, ou por baixo
 * / a menos de meia casa de sala, construção ou de peça de Chão Liso que fica
 * por cima DESTA água (`lisas`, de `lisasDaAgua`). `null` = tudo margem (nada
 * muda no campo).
 */
export function margemDaBeira(xy: readonly number[], entorno: EntornoDaAgua | undefined, grid: number, lisas: readonly PecaLisa[] = SEM_LISAS): Uint8Array | null {
  if (entorno === undefined || (entorno.mapa === null && entorno.semMargem.length === 0 && lisas.length === 0)) return null
  const n = xy.length / 2
  const marca = new Uint8Array(n).fill(1)
  let algum = false
  const folga = grid * NA_BORDA
  const raio = grid * PERTO_DA_ESTRUTURA
  const indice = entorno.semMargem.length > 0 ? indiceDaEstrutura(entorno, grid) : null
  const doChao = indiceDasLisas(lisas, entorno, grid)
  for (let i = 0; i < n; i += 1) {
    const x = xy[i * 2]
    const y = xy[i * 2 + 1]
    const m = entorno.mapa
    const naBorda = m !== null && (x <= folga || y <= folga || x >= m.largura - folga || y >= m.altura - folga)
    const pertoDaEstrutura = !naBorda && (pertoDe(indice, x, y, raio) || pertoDe(doChao, x, y, raio))
    if (naBorda || pertoDaEstrutura) {
      marca[i] = 0
      algum = true
    }
  }
  return algum ? marca : null
}

// ---------- o pincel de areia ----------

interface TracoIndexado {
  tirar: boolean
  raio: number
  x0: number
  y0: number
  x1: number
  y1: number
  baldes: Baldes
}
const tracosIndexados = new WeakMap<readonly TracoDeAreia[], TracoIndexado[]>()

function indexarTracos(areia: readonly TracoDeAreia[]): TracoIndexado[] {
  const ja = tracosIndexados.get(areia)
  if (ja !== undefined) return ja
  const lista = areia.map((t) => {
    const baldes = new Baldes(Math.max(8, t.raio), t.raio)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < t.pontos.length; i += 1) {
      const a = t.pontos[i]
      const b = t.pontos[Math.min(t.pontos.length - 1, i + 1)]
      if (i + 1 < t.pontos.length || t.pontos.length === 1) baldes.por(a.x, a.y, b.x, b.y)
      x0 = Math.min(x0, a.x)
      y0 = Math.min(y0, a.y)
      x1 = Math.max(x1, a.x)
      y1 = Math.max(y1, a.y)
    }
    return { tirar: t.modo === 'tirar', raio: t.raio, x0: x0 - t.raio, y0: y0 - t.raio, x1: x1 + t.raio, y1: y1 + t.raio, baldes }
  })
  tracosIndexados.set(areia, lista)
  return lista
}

/** O último traço que passa no ponto manda: 1 = tirou a areia, 0 = pôs (ou nenhum passou). */
function tirouNoPonto(tracos: readonly TracoIndexado[], x: number, y: number): number {
  for (let i = tracos.length - 1; i >= 0; i -= 1) {
    const t = tracos[i]
    if (x < t.x0 || x > t.x1 || y < t.y0 || y > t.y1) continue
    if (t.baldes.perto(x, y, t.raio)) return t.tirar ? 1 : 0
  }
  return 0
}

/** As provas em volta de cada ponto (frações de `ESMAECER_DA_AREIA`): o meio e dois anéis. */
const PROVAS_DA_AREIA: readonly (readonly [number, number])[] = [
  [0, 0],
  ...Array.from({ length: 6 }, (_, i): [number, number] => [0.5 * Math.cos((i * Math.PI) / 3), 0.5 * Math.sin((i * Math.PI) / 3)]),
  ...Array.from({ length: 8 }, (_, i): [number, number] => [Math.cos(((i + 0.5) * Math.PI) / 4), Math.sin(((i + 0.5) * Math.PI) / 4)]),
]

/**
 * Por ponto da linha da beira: 0 = com areia (como antes) a 1 = sem areia,
 * pelo pincel "Tirar areia / Pôr areia" (o último traço que passa manda). A
 * conta só olha a posição do ponto e os traços (média de provas num disco de
 * meia casa), então dá o mesmo no mestre e no jogador. `null` = sem pincel.
 */
export function semAreiaDaBeira(xy: readonly number[], areia: readonly TracoDeAreia[] | undefined, grid: number): Float32Array | null {
  if (areia === undefined || areia.length === 0) return null
  const tracos = indexarTracos(areia)
  const r = grid * ESMAECER_DA_AREIA
  const n = xy.length / 2
  const saida = new Float32Array(n)
  let algum = false
  for (let i = 0; i < n; i += 1) {
    const x = xy[i * 2]
    const y = xy[i * 2 + 1]
    if (!tracos.some((t) => x >= t.x0 - r && x <= t.x1 + r && y >= t.y0 - r && y <= t.y1 + r)) continue
    let soma = 0
    for (const [fx, fy] of PROVAS_DA_AREIA) soma += tirouNoPonto(tracos, x + fx * r, y + fy * r)
    saida[i] = soma / PROVAS_DA_AREIA.length
    if (saida[i] > 0) algum = true
  }
  return algum ? saida : null
}

/**
 * Os traços de areia que o jogador recebe (a areia tirada não é segredo): só
 * os pedaços que alcançam a beira que ele conhece (`margens`, px de mundo), na
 * mesma ordem. Cada ponto conhecido dá a mesma conta que no mestre: o pedaço
 * que fica fora tem todo segmento longe demais de qualquer prova dele.
 */
export function areiaParaJogador(areia: readonly TracoDeAreia[] | undefined, margens: readonly (readonly number[])[], grid: number): TracoDeAreia[] | undefined {
  if (areia === undefined || areia.length === 0 || margens.length === 0) return undefined
  const saida: TracoDeAreia[] = []
  const alem = grid * ESMAECER_DA_AREIA + 1
  // Os pontos conhecidos, cada um no balde dele.
  const lado = Math.max(8, grid)
  const conhecidos = new Map<number, number[]>()
  for (const m of margens) {
    for (let i = 0; i + 1 < m.length; i += 2) {
      const k = chaveDoBalde(Math.floor(m[i] / lado), Math.floor(m[i + 1] / lado))
      const lista = conhecidos.get(k)
      if (lista === undefined) conhecidos.set(k, [m[i], m[i + 1]])
      else lista.push(m[i], m[i + 1])
    }
  }
  for (const traco of areia) {
    const alcance = traco.raio + alem
    const r2 = alcance * alcance
    /** Algum ponto conhecido a até `alcance` do segmento ab? */
    const alcanca = (ax: number, ay: number, bx: number, by: number): boolean => {
      for (let y = Math.floor((Math.min(ay, by) - alcance) / lado); y <= Math.floor((Math.max(ay, by) + alcance) / lado); y += 1) {
        for (let x = Math.floor((Math.min(ax, bx) - alcance) / lado); x <= Math.floor((Math.max(ax, bx) + alcance) / lado); x += 1) {
          const lista = conhecidos.get(chaveDoBalde(x, y))
          if (lista === undefined) continue
          for (let i = 0; i + 1 < lista.length; i += 2) if (distanciaAoSegmento2(lista[i], lista[i + 1], ax, ay, bx, by) <= r2) return true
        }
      }
      return false
    }
    const p = traco.pontos
    if (p.length === 1) {
      if (alcanca(p[0].x, p[0].y, p[0].x, p[0].y)) saida.push({ modo: traco.modo, raio: traco.raio, pontos: [p[0]] })
      continue
    }
    let atual: TracoDeAreia['pontos'] = []
    for (let i = 0; i + 1 < p.length; i += 1) {
      if (alcanca(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y)) {
        if (atual.length === 0) atual.push(p[i])
        atual.push(p[i + 1])
      } else if (atual.length > 0) {
        saida.push({ modo: traco.modo, raio: traco.raio, pontos: atual })
        atual = []
      }
    }
    if (atual.length > 0) saida.push({ modo: traco.modo, raio: traco.raio, pontos: atual })
  }
  return saida.length === 0 ? undefined : saida
}
