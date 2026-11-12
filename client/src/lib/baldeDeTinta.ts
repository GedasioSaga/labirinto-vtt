import type { Drawing, DrawingPoint, MapData } from '../types/map'
import { flattenCurve } from './dashPattern'
import { buildPolygonDrawing } from './drawingFactory'
import { barreirasDoBalde } from './floorTool'

/**
 * Balde de tinta do PINCEL (botão Desenho → Pincel → Modo "Balde"): um clique
 * dentro de uma área fechada vira UM polígono preenchido com a cor do desenho.
 * É diferente do balde do Chão (`baldeNoPonto` em `lib/floorTool.ts`), que
 * enche por quadradinho da grade e cria peça de chão: este aqui segue o traço
 * de verdade, então um círculo feito à mão sai redondo.
 *
 * Como funciona, tudo em px de mundo:
 * 1. Uma grade fina cobre o mapa (no máximo `ORCAMENTO_DE_CELULAS` células).
 * 2. Cada traço bloqueia as células cujo centro fica a até meia espessura dele
 *    (nunca menos de 0,75 célula, senão a tinta escaparia pela fresta entre
 *    duas células vizinhas). Traços: desenhos do Pincel, linhas, curvas,
 *    caminhos e contornos de forma, mais parede (com a espessura dela), linha
 *    do mapa e borda de sala.
 * 3. Enchente de 4 vizinhos a partir da célula clicada. Depois a tinta entra
 *    por baixo dos traços até o EIXO deles: anda só para célula mais perto de
 *    um eixo e nunca num passo que cruze um eixo. Assim ela chega na linha do
 *    meio da parede sem passar para o outro lado, e um traço solto no meio da
 *    área fica pintado por baixo dos dois lados (sem espinho nem buraco).
 * 4. O contorno é "marching squares": um vértice por aresta de célula da
 *    borda, no ponto entre o centro de dentro e o de fora em que a distância
 *    ao eixo zera (interpolação). Num eixo reto esse ponto cai em cima do eixo,
 *    então a parede diagonal vira uma aresta só em vez de escadinha. Onde o
 *    contorno dobra perto de um canto de verdade (junta entre traços,
 *    cruzamento, traço chegando na borda do mapa, canto do mapa), o canto
 *    entra exato. O polígono não se cruza por construção: cada vértice fica
 *    preso na sua aresta e o canto, dentro da quina que só esse trecho usa.
 * 5. Saem os pontos alinhados e os que deixam a tinta recuar, por baixo do
 *    traço, menos que metade da meia espessura dele (Douglas-Peucker de um
 *    lado só: a tinta nunca avança além do eixo).
 * 6. Buraco (forma fechada lá dentro) entra no mesmo polígono por um "buraco
 *    de fechadura", porque o desenho `polygon` guarda um anel só e o
 *    preenchimento é par-ou-ímpar.
 *
 * A pintura é um `polygon` com `filled: true` e `width: 0`: é assim que ela é
 * reconhecida (`ehPinturaDeBalde`) para não virar barreira de outro balde e
 * para nascer por baixo dos traços (`inserirPinturaDeBalde`).
 */

/** Modo do Pincel: traço livre ou balde de tinta. */
export type BrushMode = 'traco' | 'balde'

/** 4 milhões de células:a enchente leva ~30-60 ms no mapa 100x100 de 70 px. */
const ORCAMENTO_DE_CELULAS = 4_000_000
/** Meia espessura mínima do bloqueio, em células: acima de 0,5 não vaza. */
const BLOQUEIO_MINIMO_EM_CELULAS = 0.75
/** Um círculo vira um polígono com um lado a cada ~8 px de contorno. */
const PX_POR_LADO_DE_CIRCULO = 8
const LADOS_MINIMOS_DE_CIRCULO = 24

/**
 * Quanto, além do raio de bloqueio, o índice de traços ainda alcança, em
 * células: cobre a célula de fora do contorno (até ~1 célula além do raio) e
 * o passo de uma célula da tinta por baixo do traço.
 */
const FOLGA_DA_BUSCA_EM_CELULAS = 2.5
/** Lado de cada balde do índice de traços, em células. */
const CELULAS_POR_BALDE_DE_BUSCA = 8
/** Peso da distância ao segundo eixo mais perto no desempate (ver `distanciaAosEixos`). */
const DESEMPATE_PELO_SEGUNDO_EIXO = 1e-6
/** Abaixo de 10° dois traços contam como alinhados: a junta deles não é canto. */
const SENO_MINIMO_DE_CANTO = Math.sin((10 * Math.PI) / 180)
/** Pontos a menos disto (px de mundo) de uma reta contam como alinhados. */
const FOLGA_DE_ALINHAMENTO = 1e-3
/** Anel com menos área que isto (px²) não é buraco de verdade. */
const AREA_MINIMA_DE_ANEL = 0.5
/** Área com menos de 1/8 das células: o contorno olha só as cheias, senão varre a grade. */
const PARTE_DA_GRADE_PARA_VARRER = 8
/** A ponte da fechadura passa no máximo isto (px) abaixo do ponto do buraco. */
const DESCIDA_MAXIMA_DA_PONTE = 0.5

const LIVRE = 0
const BLOQUEADA = 1
const CHEIA = 2
const CHEIA_POR_BAIXO_DO_TRACO = 3

/** Direções de aresta: 0 = +x, 1 = +y, 2 = −x, 3 = −y (y cresce para baixo). */
const VIRAR_A_DIREITA = 1
const SEGUIR_RETO = 0
const VIRAR_A_ESQUERDA = 3
const GIROS_EM_ORDEM = [VIRAR_A_DIREITA, SEGUIR_RETO, VIRAR_A_ESQUERDA]

interface Traco {
  x1: number
  y1: number
  x2: number
  y2: number
  meiaLargura: number
}

interface Grade {
  cols: number
  rows: number
  sx: number
  sy: number
  estado: Uint8Array
}

/**
 * Anel do contorno: cada passo é uma aresta de célula, guardada como
 * quina-de-partida × 4 + direção, andando com a tinta à DIREITA (y para
 * baixo). Anel de fora tem área positiva; buraco, negativa (em células²).
 */
interface Anel {
  passos: number[]
  area: number
}

/** Vértice sem reta conhecida: a tinta parou antes do eixo (numa fresta). */
const SEM_SUPORTE = -1
const BORDA_ESQUERDA = -2
const BORDA_DIREITA = -3
const BORDA_DE_CIMA = -4
const BORDA_DE_BAIXO = -5

/**
 * Vértice do contorno em px de mundo. `tolerancia` é quanto a simplificação
 * pode fazer a tinta recuar dali: metade da meia espessura do traço em que ele
 * está (o recuo fica escondido sob o traço), zero na borda do mapa.
 * `suporte` é a reta em que ele está: o índice do traço, uma das bordas do
 * mapa (`BORDA_*`) ou `SEM_SUPORTE`.
 */
interface PontoDoAnel {
  x: number
  y: number
  tolerancia: number
  suporte: number
}

/** Índice espacial: cada balde quadrado guarda os traços que passam perto dele. */
interface IndiceDeTracos {
  tracos: Traco[]
  /** Raio de bloqueio de cada traço, em px de mundo. */
  raios: number[]
  lado: number
  colunas: number
  linhas: number
  baldes: Map<number, number[]>
}

/** O que a enchente por baixo do traço e o contorno consultam. */
interface Medidor {
  grade: Grade
  indice: IndiceDeTracos
  larguraPx: number
  alturaPx: number
  celula: number
}

type MapaDoBalde = Pick<MapData, 'width' | 'height' | 'grid' | 'drawings'> &
  Partial<Pick<MapData, 'walls' | 'lines' | 'regions'>>

/** A pintura que um balde do Pincel deixou (e que outro balde atravessa). */
export function ehPinturaDeBalde(drawing: Drawing): boolean {
  return drawing.kind === 'polygon' && drawing.filled && drawing.width === 0
}

/**
 * Onde a pintura nova entra na lista: logo depois da última pintura de balde
 * (a mais nova fica por cima das antigas) e antes de todo traço, que continua
 * aparecendo por cima da tinta.
 */
export function inserirPinturaDeBalde(drawings: readonly Drawing[], pintura: Drawing): Drawing[] {
  let depoisDe = -1
  drawings.forEach((drawing, indice) => {
    if (ehPinturaDeBalde(drawing)) depoisDe = indice
  })
  const lista = [...drawings]
  lista.splice(depoisDe + 1, 0, pintura)
  return lista
}

/**
 * A pintura que o balde cria ao clicar em `ponto`, ou `null` quando não há o
 * que encher: clique fora do mapa ou em cima de um traço.
 */
export function baldeDeTintaNoPonto(map: MapaDoBalde, ponto: DrawingPoint, cor: string, id: string): Drawing | null {
  const contorno = areaDoBalde(map, ponto)
  return contorno ? buildPolygonDrawing(id, contorno, cor, 0, true, 1) : null
}

/** O contorno (px de mundo) da área que o balde enche a partir de `ponto`. */
export function areaDoBalde(map: MapaDoBalde, ponto: DrawingPoint): DrawingPoint[] | null {
  const larguraPx = map.width * map.grid
  const alturaPx = map.height * map.grid
  if (!(larguraPx > 0 && alturaPx > 0)) return null
  if (!(ponto.x >= 0 && ponto.x < larguraPx && ponto.y >= 0 && ponto.y < alturaPx)) return null

  const lado = Math.max(1, Math.sqrt((larguraPx * alturaPx) / ORCAMENTO_DE_CELULAS))
  const cols = Math.max(1, Math.ceil(larguraPx / lado))
  const rows = Math.max(1, Math.ceil(alturaPx / lado))
  const grade: Grade = { cols, rows, sx: larguraPx / cols, sy: alturaPx / rows, estado: new Uint8Array(cols * rows) }

  const celula = Math.max(grade.sx, grade.sy)
  const minimo = BLOQUEIO_MINIMO_EM_CELULAS * celula
  const tracos = tracosDoMapa(map)
  const raios = tracos.map((traco) => Math.max(traco.meiaLargura, minimo))
  tracos.forEach((traco, i) => bloquearTraco(grade, traco, raios[i]))

  const medidor: Medidor = {
    grade,
    indice: criarIndice(tracos, raios, celula, larguraPx, alturaPx),
    larguraPx,
    alturaPx,
    celula,
  }
  const col = Math.min(cols - 1, Math.floor(ponto.x / grade.sx))
  const row = Math.min(rows - 1, Math.floor(ponto.y / grade.sy))
  const cheias = encher(medidor, row * cols + col)
  if (!cheias) return null

  const aneis = contornar(grade, cheias)
  const externo = aneis.filter((anel) => anel.area > 0).sort((a, b) => b.area - a.area)[0]
  if (!externo) return null
  const fora = construirAnel(externo, medidor)
  if (!fora || areaDePontos(fora) <= AREA_MINIMA_DE_ANEL) return null
  const buracos: DrawingPoint[][] = []
  for (const anel of aneis) {
    if (anel.area >= 0) continue
    const buraco = construirAnel(anel, medidor)
    if (buraco && areaDePontos(buraco) < -AREA_MINIMA_DE_ANEL) buracos.push(buraco)
  }
  return juntarBuracos(fora, buracos)
}

function tracosDoMapa(map: MapaDoBalde): Traco[] {
  const tracos: Traco[] = barreirasDoBalde(map)
  const cadeia = (pontos: readonly DrawingPoint[], fechada: boolean, meiaLargura: number) => {
    if (pontos.length === 1) {
      tracos.push({ x1: pontos[0].x, y1: pontos[0].y, x2: pontos[0].x, y2: pontos[0].y, meiaLargura })
      return
    }
    const total = fechada ? pontos.length : pontos.length - 1
    for (let i = 0; i < total; i += 1) {
      const a = pontos[i]
      const b = pontos[(i + 1) % pontos.length]
      tracos.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, meiaLargura })
    }
  }
  const oval = (cx: number, cy: number, rx: number, ry: number, meiaLargura: number) => {
    const raio = Math.max(Math.abs(rx), Math.abs(ry))
    const lados = Math.max(LADOS_MINIMOS_DE_CIRCULO, Math.ceil((2 * Math.PI * raio) / PX_POR_LADO_DE_CIRCULO))
    const pontos: DrawingPoint[] = []
    for (let i = 0; i < lados; i += 1) {
      const angulo = (2 * Math.PI * i) / lados
      pontos.push({ x: cx + rx * Math.cos(angulo), y: cy + ry * Math.sin(angulo) })
    }
    cadeia(pontos, true, meiaLargura)
  }

  for (const drawing of map.drawings) {
    if (drawing.kind === 'text' || ehPinturaDeBalde(drawing)) continue
    const meia = Math.max(0, drawing.width) / 2
    switch (drawing.kind) {
      case 'freehand':
      case 'path':
        cadeia(drawing.points, false, meia)
        break
      case 'curve':
        cadeia(flattenCurve(drawing.points), false, meia)
        break
      case 'line':
        tracos.push({ x1: drawing.x1, y1: drawing.y1, x2: drawing.x2, y2: drawing.y2, meiaLargura: meia })
        break
      case 'polygon':
        cadeia(drawing.points, true, meia)
        break
      case 'rect': {
        const x0 = Math.min(drawing.x, drawing.x + drawing.w)
        const y0 = Math.min(drawing.y, drawing.y + drawing.h)
        const x1 = x0 + Math.abs(drawing.w)
        const y1 = y0 + Math.abs(drawing.h)
        cadeia([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], true, meia)
        break
      }
      case 'circle':
        oval(drawing.cx, drawing.cy, drawing.radius, drawing.radius, meia)
        break
      case 'ellipse':
        oval(drawing.cx, drawing.cy, drawing.rx, drawing.ry, meia)
        break
    }
  }
  return tracos
}

/**
 * Bloqueia as células cujo centro fica a até `raio` do traço. O traço é
 * cortado em pedaços curtos para a caixa de cada pedaço não cobrir o mapa
 * inteiro quando o traço é uma diagonal longa.
 */
function bloquearTraco(grade: Grade, traco: Traco, raio: number): void {
  const { cols, rows, sx, sy, estado } = grade
  const dx = traco.x2 - traco.x1
  const dy = traco.y2 - traco.y1
  const comprimento = Math.hypot(dx, dy)
  const pedaco = Math.max(8 * Math.max(sx, sy), 2 * raio)
  const pedacos = Math.max(1, Math.ceil(comprimento / pedaco))
  const raio2 = raio * raio
  for (let p = 0; p < pedacos; p += 1) {
    const ax = traco.x1 + (dx * p) / pedacos
    const ay = traco.y1 + (dy * p) / pedacos
    const bx = traco.x1 + (dx * (p + 1)) / pedacos
    const by = traco.y1 + (dy * (p + 1)) / pedacos
    const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - raio) / sx))
    const c1 = Math.min(cols - 1, Math.floor((Math.max(ax, bx) + raio) / sx))
    const r0 = Math.max(0, Math.floor((Math.min(ay, by) - raio) / sy))
    const r1 = Math.min(rows - 1, Math.floor((Math.max(ay, by) + raio) / sy))
    for (let r = r0; r <= r1; r += 1) {
      const cy = (r + 0.5) * sy
      for (let c = c0; c <= c1; c += 1) {
        const i = r * cols + c
        if (estado[i] === BLOQUEADA) continue
        if (distancia2AoSegmento((c + 0.5) * sx, cy, ax, ay, bx, by) <= raio2) estado[i] = BLOQUEADA
      }
    }
  }
}

function distancia2AoSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const tamanho2 = dx * dx + dy * dy
  const t = tamanho2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / tamanho2))
  const qx = ax + t * dx - px
  const qy = ay + t * dy - py
  return qx * qx + qy * qy
}

function distanciaAoTraco(x: number, y: number, traco: Traco): number {
  return Math.sqrt(distancia2AoSegmento(x, y, traco.x1, traco.y1, traco.x2, traco.y2))
}

/**
 * Índice espacial dos traços: cada balde quadrado guarda os traços que passam
 * a até "raio + folga" dele, para cada consulta olhar só os traços vizinhos e
 * não o mapa inteiro.
 */
function criarIndice(tracos: Traco[], raios: number[], celula: number, larguraPx: number, alturaPx: number): IndiceDeTracos {
  const folga = FOLGA_DA_BUSCA_EM_CELULAS * celula
  const lado = CELULAS_POR_BALDE_DE_BUSCA * celula
  const colunas = Math.max(1, Math.ceil(larguraPx / lado))
  const linhas = Math.max(1, Math.ceil(alturaPx / lado))
  const baldes = new Map<number, number[]>()
  tracos.forEach((traco, t) => {
    const alcance = raios[t] + folga
    const dx = traco.x2 - traco.x1
    const dy = traco.y2 - traco.y1
    const pedacos = Math.max(1, Math.ceil(Math.hypot(dx, dy) / lado))
    for (let p = 0; p < pedacos; p += 1) {
      const ax = traco.x1 + (dx * p) / pedacos
      const ay = traco.y1 + (dy * p) / pedacos
      const bx = traco.x1 + (dx * (p + 1)) / pedacos
      const by = traco.y1 + (dy * (p + 1)) / pedacos
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - alcance) / lado))
      const c1 = Math.min(colunas - 1, Math.floor((Math.max(ax, bx) + alcance) / lado))
      const r0 = Math.max(0, Math.floor((Math.min(ay, by) - alcance) / lado))
      const r1 = Math.min(linhas - 1, Math.floor((Math.max(ay, by) + alcance) / lado))
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          const chave = r * colunas + c
          const lista = baldes.get(chave)
          if (!lista) baldes.set(chave, [t])
          else if (lista[lista.length - 1] !== t) lista.push(t)
        }
      }
    }
  })
  return { tracos, raios, lado, colunas, linhas, baldes }
}

const NENHUM_TRACO: readonly number[] = []

function tracosPerto(indice: IndiceDeTracos, x: number, y: number): readonly number[] {
  const c = Math.min(indice.colunas - 1, Math.max(0, Math.floor(x / indice.lado)))
  const r = Math.min(indice.linhas - 1, Math.max(0, Math.floor(y / indice.lado)))
  return indice.baldes.get(r * indice.colunas + c) ?? NENHUM_TRACO
}

/**
 * Distância de (x, y) ao eixo mais perto, com um desempate minúsculo pela
 * distância ao segundo eixo mais perto. O desempate é o que deixa a tinta
 * entrar na célula do canto de uma sala (ela fica na bissetriz, à mesma
 * distância das duas paredes que a vizinha fica de uma) e continua barrando o
 * vão entre duas pontas de parede (lá as duas distâncias empatam dos dois lados).
 */
function distanciaAosEixos(indice: IndiceDeTracos, x: number, y: number): number {
  let menor = Infinity
  let segunda = Infinity
  for (const t of tracosPerto(indice, x, y)) {
    const traco = indice.tracos[t]
    const d2 = distancia2AoSegmento(x, y, traco.x1, traco.y1, traco.x2, traco.y2)
    if (d2 < menor) { segunda = menor; menor = d2 }
    else if (d2 < segunda) segunda = d2
  }
  const distancia = Math.sqrt(menor)
  return Number.isFinite(segunda) ? distancia + DESEMPATE_PELO_SEGUNDO_EIXO * Math.sqrt(segunda) : distancia
}

/**
 * Sem cache: cada balde do índice tem poucos traços e cada célula da faixa é
 * medida poucas vezes (a da vez, uma só), então um `Map` não se paga.
 */
function distanciaDaCelula(medidor: Medidor, i: number): number {
  const { cols, sx, sy } = medidor.grade
  const c = i % cols
  return distanciaAosEixos(medidor.indice, (c + 0.5) * sx, ((i - c) / cols + 0.5) * sy)
}

/**
 * O primeiro eixo que o passo de A para B atravessa (o mais perto de A) e em
 * que fração do passo, ou `null` se nenhum atravessa.
 */
function travessiaDoEixo(indice: IndiceDeTracos, ax: number, ay: number, bx: number, by: number): { traco: number; s: number } | null {
  const rx = bx - ax
  const ry = by - ay
  let melhor: { traco: number; s: number } | null = null
  for (const t of tracosPerto(indice, (ax + bx) / 2, (ay + by) / 2)) {
    const traco = indice.tracos[t]
    const qx = traco.x2 - traco.x1
    const qy = traco.y2 - traco.y1
    const denominador = rx * qy - ry * qx
    if (denominador === 0) continue
    const s = ((traco.x1 - ax) * qy - (traco.y1 - ay) * qx) / denominador
    const u = ((traco.x1 - ax) * ry - (traco.y1 - ay) * rx) / denominador
    const folga = FOLGA_DE_ALINHAMENTO / Math.hypot(qx, qy)
    if (s < 0 || s > 1 || u < -folga || u > 1 + folga) continue
    if (!melhor || s < melhor.s) melhor = { traco: t, s }
  }
  return melhor
}

function orientacao(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

/** Os segmentos AB e CD se cruzam ou se encostam (ponta em cima do outro conta). */
function segmentosSeTocam(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const o1 = orientacao(ax, ay, bx, by, cx, cy)
  const o2 = orientacao(ax, ay, bx, by, dx, dy)
  const o3 = orientacao(cx, cy, dx, dy, ax, ay)
  const o4 = orientacao(cx, cy, dx, dy, bx, by)
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true
  const naCaixa = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    Math.min(px, qx) <= rx && rx <= Math.max(px, qx) && Math.min(py, qy) <= ry && ry <= Math.max(py, qy)
  return (
    (o1 === 0 && naCaixa(ax, ay, bx, by, cx, cy)) ||
    (o2 === 0 && naCaixa(ax, ay, bx, by, dx, dy)) ||
    (o3 === 0 && naCaixa(cx, cy, dx, dy, ax, ay)) ||
    (o4 === 0 && naCaixa(cx, cy, dx, dy, bx, by))
  )
}

/**
 * A tinta passa da célula `de` para a bloqueada `para`? Só se o passo entre os
 * centros não cruza (nem encosta em) nenhum eixo, e, já por baixo do traço,
 * só se `para` fica mais perto de um eixo: assim ela para na linha do meio e
 * não atravessa a fresta estreita entre duas pontas de parede.
 */
function podeEntrarPorBaixo(medidor: Medidor, de: number, para: number, distanciaDoDe: number | null): boolean {
  if (distanciaDoDe !== null) {
    if (distanciaDaCelula(medidor, para) >= distanciaDoDe) return false
    // Um passo de uma célula só cruza eixo que passa a até uma célula da
    // origem; no meio de uma parede grossa nenhum passa, e o teste sai de graça.
    // A folga cobre o desempate somado em `distanciaAosEixos`.
    if (distanciaDoDe > medidor.celula + FOLGA_DE_ALINHAMENTO) return true
  }
  const { cols, sx, sy } = medidor.grade
  const cDe = de % cols
  const cPara = para % cols
  const ax = (cDe + 0.5) * sx
  const ay = ((de - cDe) / cols + 0.5) * sy
  const bx = (cPara + 0.5) * sx
  const by = ((para - cPara) / cols + 0.5) * sy
  const { tracos } = medidor.indice
  for (const t of tracosPerto(medidor.indice, bx, by)) {
    if (segmentosSeTocam(ax, ay, bx, by, tracos[t].x1, tracos[t].y1, tracos[t].x2, tracos[t].y2)) return false
  }
  return true
}

/**
 * Enchente de 4 vizinhos a partir de `inicio` pelas células livres e, delas,
 * por baixo dos traços até o eixo (`podeEntrarPorBaixo`). Devolve os índices
 * das células cheias, ou `null` quando o clique caiu em cima de um traço.
 */
function encher(medidor: Medidor, inicio: number): Int32Array | null {
  const { cols, rows, estado } = medidor.grade
  if (estado[inicio] !== LIVRE) return null
  const fila = new Int32Array(cols * rows)
  let fim = 0
  estado[inicio] = CHEIA
  fila[fim++] = inicio
  // Distância ao eixo da célula da vez, medida no máximo uma vez (NaN = ainda
  // não medida; `null` = célula livre, que não precisa descer).
  let distanciaDaVez: number | null = null
  const porBaixo = (de: number, para: number) => {
    if (distanciaDaVez !== null && Number.isNaN(distanciaDaVez)) distanciaDaVez = distanciaDaCelula(medidor, de)
    if (podeEntrarPorBaixo(medidor, de, para, distanciaDaVez)) { estado[para] = CHEIA_POR_BAIXO_DO_TRACO; fila[fim++] = para }
  }
  // Laço quente (milhões de células): a célula livre vizinha entra direto, e
  // só a bloqueada paga a conta de `podeEntrarPorBaixo`. Por baixo do traço a
  // tinta não volta para célula livre: a livre do outro lado de uma fresta é
  // de outra área.
  for (let lido = 0; lido < fim; lido += 1) {
    const i = fila[lido]
    const c = i % cols
    const livre = estado[i] === CHEIA
    distanciaDaVez = livre ? null : NaN
    if (c > 0) {
      const v = i - 1
      if (estado[v] === LIVRE) { if (livre) { estado[v] = CHEIA; fila[fim++] = v } }
      else if (estado[v] === BLOQUEADA) porBaixo(i, v)
    }
    if (c < cols - 1) {
      const v = i + 1
      if (estado[v] === LIVRE) { if (livre) { estado[v] = CHEIA; fila[fim++] = v } }
      else if (estado[v] === BLOQUEADA) porBaixo(i, v)
    }
    if (i >= cols) {
      const v = i - cols
      if (estado[v] === LIVRE) { if (livre) { estado[v] = CHEIA; fila[fim++] = v } }
      else if (estado[v] === BLOQUEADA) porBaixo(i, v)
    }
    if (i < cols * (rows - 1)) {
      const v = i + cols
      if (estado[v] === LIVRE) { if (livre) { estado[v] = CHEIA; fila[fim++] = v } }
      else if (estado[v] === BLOQUEADA) porBaixo(i, v)
    }
  }
  return fila.subarray(0, fim)
}

function estaCheia(estado: Uint8Array, i: number): boolean {
  return estado[i] >= CHEIA
}

/**
 * Anéis do contorno das células cheias, aresta por aresta. Cada aresta anda
 * com a tinta à DIREITA (y para baixo): anel de fora dá área positiva e buraco
 * dá negativa. No vértice em que duas células cheias se tocam só pela quina, a
 * regra "vire à direita primeiro" separa as duas, como a enchente de 4
 * vizinhos também separa.
 */
function contornar(grade: Grade, cheias: Int32Array): Anel[] {
  const { cols, rows, estado } = grade
  const largura = cols + 1
  const arestas = new Uint8Array(largura * (rows + 1))
  const marcar = (i: number, c: number, r: number) => {
    if (r === 0 || !estaCheia(estado, i - cols)) arestas[r * largura + c] |= 1
    if (c === cols - 1 || !estaCheia(estado, i + 1)) arestas[r * largura + c + 1] |= 2
    if (r === rows - 1 || !estaCheia(estado, i + cols)) arestas[(r + 1) * largura + c + 1] |= 4
    if (c === 0 || !estaCheia(estado, i - 1)) arestas[(r + 1) * largura + c] |= 8
  }
  // Área pequena: só as células cheias. Área grande: a grade em ordem, linha
  // a linha; na ordem da fila da enchente o acesso pula pela memória e esta
  // etapa chegava a custar mais que a própria enchente (medido).
  if (cheias.length * PARTE_DA_GRADE_PARA_VARRER < cols * rows) {
    for (const i of cheias) {
      const c = i % cols
      marcar(i, c, (i - c) / cols)
    }
  } else {
    for (let r = 0, i = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1, i += 1) if (estaCheia(estado, i)) marcar(i, c, r)
    }
  }
  const passo = [1, largura, -1, -largura]
  const aneis: Anel[] = []
  for (let v0 = 0; v0 < arestas.length; v0 += 1) {
    for (;;) {
      const livres = arestas[v0] & 0xf & ~(arestas[v0] >> 4)
      if (!livres) break
      const d0 = livres & 1 ? 0 : livres & 2 ? 1 : livres & 4 ? 2 : 3
      const passos: number[] = []
      let area = 0
      let v = v0
      let d = d0
      for (let contados = 0; contados < 4 * arestas.length; contados += 1) {
        arestas[v] |= 16 << d
        passos.push(v * 4 + d)
        const w = v + passo[d]
        area += (v % largura) * Math.floor(w / largura) - (w % largura) * Math.floor(v / largura)
        let proxima = -1
        for (const giro of GIROS_EM_ORDEM) {
          const candidata = (d + giro) % 4
          if (arestas[w] & (1 << candidata)) { proxima = candidata; break }
        }
        if (proxima < 0) break
        v = w
        d = proxima
        if (v === v0 && d === d0) break
      }
      if (passos.length >= 4) aneis.push({ passos, area: area / 2 })
    }
  }
  return aneis
}

function areaDePontos(pontos: readonly DrawingPoint[]): number {
  let soma = 0
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    soma += a.x * b.y - b.x * a.y
  }
  return soma / 2
}

/**
 * Os vértices do anel em px: um por aresta, mais os cantos de verdade entre
 * dois vértices seguidos apoiados em retas diferentes; depois limpo e
 * simplificado.
 */
function construirAnel(anel: Anel, medidor: Medidor): PontoDoAnel[] | null {
  const largura = medidor.grade.cols + 1
  const naAresta = anel.passos.map((codigo) => {
    const v = Math.floor(codigo / 4)
    return pontoNaAresta(medidor, v % largura, Math.floor(v / largura), codigo % 4)
  })
  const pontos: PontoDoAnel[] = []
  naAresta.forEach((ponto, k) => {
    pontos.push(ponto)
    const seguinte = naAresta[(k + 1) % naAresta.length]
    const canto = cantoEntre(medidor, ponto, seguinte)
    if (canto && !cantoTorceOContorno(pontos, naAresta, k, canto)) pontos.push(canto)
  })
  const limpo = limparAnel(pontos)
  return limpo.length >= 3 ? simplificarAnel(limpo) : null
}

/** Quantas arestas de cada lado do canto conferir: o canto fica a até 2 células. */
const VIZINHAS_DO_CANTO = 6

function cruzamProprio(a: DrawingPoint, b: DrawingPoint, c: DrawingPoint, d: DrawingPoint): boolean {
  const o1 = orientacao(a.x, a.y, b.x, b.y, c.x, c.y)
  const o2 = orientacao(a.x, a.y, b.x, b.y, d.x, d.y)
  const o3 = orientacao(c.x, c.y, d.x, d.y, a.x, a.y)
  const o4 = orientacao(c.x, c.y, d.x, d.y, b.x, b.y)
  return o1 * o2 < 0 && o3 * o4 < 0
}

/**
 * O canto entre o último ponto já posto e o vértice `k + 1` torceria o
 * contorno? Perto de uma junta aguda o triângulo do canto pode passar por cima
 * do trecho vizinho do contorno (a quina ao lado); aí o canto fica de fora.
 */
function cantoTorceOContorno(pontos: readonly PontoDoAnel[], naAresta: readonly PontoDoAnel[], k: number, canto: DrawingPoint): boolean {
  const a = pontos[pontos.length - 1]
  const b = naAresta[(k + 1) % naAresta.length]
  const arestas: Array<[DrawingPoint, DrawingPoint]> = []
  for (let m = Math.max(1, pontos.length - VIZINHAS_DO_CANTO); m < pontos.length; m += 1) arestas.push([pontos[m - 1], pontos[m]])
  for (let m = 1; m <= VIZINHAS_DO_CANTO; m += 1) {
    arestas.push([naAresta[(k + m) % naAresta.length], naAresta[(k + m + 1) % naAresta.length]])
  }
  return arestas.some(([p, q]) => cruzamProprio(a, canto, p, q) || cruzamProprio(canto, b, p, q))
}

/** Células de dentro e de fora da aresta que sai da quina (c, r) na direção `d`. */
const DENTRO_E_FORA: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, -1],
  [-1, 0, 0, 0],
  [-1, -1, -1, 0],
  [0, -1, -1, -1],
]
/** Meio da aresta que sai da quina na direção `d`, em células. */
const MEIO_DA_ARESTA: ReadonlyArray<readonly [number, number]> = [[0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5]]

/**
 * O vértice da aresta, no segmento entre o centro da célula de dentro e o da
 * de fora: onde esse passo atravessa o eixo de um traço (exato), ou, se
 * nenhum atravessa (a tinta parou antes do eixo, numa fresta), onde a
 * distância ao eixo zera se ela variar em linha reta entre os dois centros.
 * Aresta na borda do mapa fica no meio dela, em cima da borda.
 */
function pontoNaAresta(medidor: Medidor, c: number, r: number, d: number): PontoDoAnel {
  const { grade, celula, indice } = medidor
  const { cols, rows, sx, sy } = grade
  const [dc, dr, fc, fr] = DENTRO_E_FORA[d]
  const ci = c + dc
  const ri = r + dr
  const co = c + fc
  const ro = r + fr
  if (co < 0 || co >= cols || ro < 0 || ro >= rows) {
    const [mx, my] = MEIO_DA_ARESTA[d]
    const suporte = ro < 0 ? BORDA_DE_CIMA : ro >= rows ? BORDA_DE_BAIXO : co < 0 ? BORDA_ESQUERDA : BORDA_DIREITA
    return { x: pxNaColuna(medidor, c + mx), y: pxNaLinha(medidor, r + my), tolerancia: 0, suporte }
  }
  const xi = (ci + 0.5) * sx
  const yi = (ri + 0.5) * sy
  const xo = (co + 0.5) * sx
  const yo = (ro + 0.5) * sy
  const travessia = travessiaDoEixo(indice, xi, yi, xo, yo)
  if (travessia) {
    const meia = indice.tracos[travessia.traco].meiaLargura
    return {
      x: xi + travessia.s * (xo - xi),
      y: yi + travessia.s * (yo - yi),
      tolerancia: Math.min(meia, celula) / 2,
      suporte: travessia.traco,
    }
  }
  const dentro = distanciaDaCelula(medidor, ri * cols + ci)
  const fora = distanciaDaCelula(medidor, ro * cols + co)
  const t = Number.isFinite(dentro) && Number.isFinite(fora) && dentro + fora > 0 ? dentro / (dentro + fora) : 0.5
  return { x: xi + t * (xo - xi), y: yi + t * (yo - yi), tolerancia: celula / 4, suporte: SEM_SUPORTE }
}

function pxNaColuna(medidor: Medidor, coluna: number): number {
  return coluna >= medidor.grade.cols ? medidor.larguraPx : coluna * medidor.grade.sx
}

function pxNaLinha(medidor: Medidor, linha: number): number {
  return linha >= medidor.grade.rows ? medidor.alturaPx : linha * medidor.grade.sy
}

function pontaIgual(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) <= FOLGA_DE_ALINHAMENTO && Math.abs(ay - by) <= FOLGA_DE_ALINHAMENTO
}

/** A ponta que os dois traços dividem, ou `null` (nenhuma, ou as duas: trecho repetido). */
function pontaDividida(a: Traco, b: Traco): DrawingPoint | null {
  const inicio = pontaIgual(a.x1, a.y1, b.x1, b.y1) || pontaIgual(a.x1, a.y1, b.x2, b.y2)
  const fim = pontaIgual(a.x2, a.y2, b.x1, b.y1) || pontaIgual(a.x2, a.y2, b.x2, b.y2)
  if (inicio === fim) return null
  return inicio ? { x: a.x1, y: a.y1 } : { x: a.x2, y: a.y2 }
}

/** A reta em que um vértice se apoia: o eixo do traço ou a linha da borda do mapa. */
function retaDoSuporte(medidor: Medidor, suporte: number): { x: number; y: number; dx: number; dy: number } {
  if (suporte === BORDA_ESQUERDA) return { x: 0, y: 0, dx: 0, dy: 1 }
  if (suporte === BORDA_DIREITA) return { x: medidor.larguraPx, y: 0, dx: 0, dy: 1 }
  if (suporte === BORDA_DE_CIMA) return { x: 0, y: 0, dx: 1, dy: 0 }
  if (suporte === BORDA_DE_BAIXO) return { x: 0, y: medidor.alturaPx, dx: 1, dy: 0 }
  const traco = medidor.indice.tracos[suporte]
  return { x: traco.x1, y: traco.y1, dx: traco.x2 - traco.x1, dy: traco.y2 - traco.y1 }
}

/**
 * Algum eixo, fora o que apoia `de`, corta o lado novo de `de` até o canto?
 * Num emaranhado de traços um terceiro passa entre o vértice e a junta, e o
 * canto puxaria o contorno para o outro lado dele. Encostar bem no canto não
 * conta (três paredes que se encontram no mesmo ponto).
 */
function outroEixoCorta(medidor: Medidor, de: PontoDoAnel, canto: DrawingPoint): boolean {
  const { tracos } = medidor.indice
  for (const t of tracosPerto(medidor.indice, (de.x + canto.x) / 2, (de.y + canto.y) / 2)) {
    if (t === de.suporte) continue
    const traco = tracos[t]
    if (pontaIgual(traco.x1, traco.y1, canto.x, canto.y) || pontaIgual(traco.x2, traco.y2, canto.x, canto.y)) continue
    const o1 = orientacao(de.x, de.y, canto.x, canto.y, traco.x1, traco.y1)
    const o2 = orientacao(de.x, de.y, canto.x, canto.y, traco.x2, traco.y2)
    const o3 = orientacao(traco.x1, traco.y1, traco.x2, traco.y2, de.x, de.y)
    const o4 = orientacao(traco.x1, traco.y1, traco.x2, traco.y2, canto.x, canto.y)
    if (o1 * o2 < 0 && o3 * o4 < 0) return true
  }
  return false
}

/** O canto cai sob o traço (a até o raio de bloqueio dele) ou dentro do mapa, se for borda. */
function cantoCabeNoSuporte(medidor: Medidor, suporte: number, x: number, y: number): boolean {
  if (suporte < 0) return x >= -FOLGA_DE_ALINHAMENTO && x <= medidor.larguraPx + FOLGA_DE_ALINHAMENTO && y >= -FOLGA_DE_ALINHAMENTO && y <= medidor.alturaPx + FOLGA_DE_ALINHAMENTO
  return distanciaAoTraco(x, y, medidor.indice.tracos[suporte]) <= medidor.indice.raios[suporte]
}

/**
 * O canto de verdade entre dois vértices seguidos do contorno apoiados em
 * retas diferentes (duas paredes, a junta de um traço feito à mão, um traço e
 * a borda do mapa, duas bordas): o encontro das duas retas, se ele cai sob os
 * dois traços e a até 2 células dos dois vértices. Sem ele o contorno cortaria
 * o canto em diagonal. O triângulo que o canto acrescenta fica entre as duas
 * retas, onde nenhum outro trecho do contorno passa.
 */
function cantoEntre(medidor: Medidor, a: PontoDoAnel, b: PontoDoAnel): PontoDoAnel | null {
  if (a.suporte === b.suporte || a.suporte === SEM_SUPORTE || b.suporte === SEM_SUPORTE) return null
  const perto = 2 * medidor.celula
  // Trechos vizinhos de um mesmo traço (ou paredes que dividem a ponta): a
  // junta é a ponta, em qualquer ângulo. Mesmo quase reta ela vale, porque
  // deixa os dois vértices em volta alinhados com ela e a limpeza tira os dois.
  const junta = a.suporte >= 0 && b.suporte >= 0 ? pontaDividida(medidor.indice.tracos[a.suporte], medidor.indice.tracos[b.suporte]) : null
  if (junta) {
    if (Math.hypot(junta.x - a.x, junta.y - a.y) > perto || Math.hypot(junta.x - b.x, junta.y - b.y) > perto) return null
    if (outroEixoCorta(medidor, a, junta) || outroEixoCorta(medidor, b, junta)) return null
    return { x: junta.x, y: junta.y, tolerancia: Math.min(a.tolerancia, b.tolerancia), suporte: SEM_SUPORTE }
  }
  const ra = retaDoSuporte(medidor, a.suporte)
  const rb = retaDoSuporte(medidor, b.suporte)
  const tamanhos = Math.hypot(ra.dx, ra.dy) * Math.hypot(rb.dx, rb.dy)
  if (tamanhos === 0) return null
  const vetorial = ra.dx * rb.dy - ra.dy * rb.dx
  if (Math.abs(vetorial) / tamanhos < SENO_MINIMO_DE_CANTO) return null
  const s = ((rb.x - ra.x) * rb.dy - (rb.y - ra.y) * rb.dx) / vetorial
  const x = ra.x + s * ra.dx
  const y = ra.y + s * ra.dy
  if (Math.hypot(x - a.x, y - a.y) > perto || Math.hypot(x - b.x, y - b.y) > perto) return null
  if (!cantoCabeNoSuporte(medidor, a.suporte, x, y) || !cantoCabeNoSuporte(medidor, b.suporte, x, y)) return null
  if (outroEixoCorta(medidor, a, { x, y }) || outroEixoCorta(medidor, b, { x, y })) return null
  const naBorda = a.suporte < 0 || b.suporte < 0
  return { x, y, tolerancia: naBorda ? 0 : Math.min(a.tolerancia, b.tolerancia), suporte: SEM_SUPORTE }
}

function mesmoPonto(a: PontoDoAnel, b: PontoDoAnel): boolean {
  return Math.abs(a.x - b.x) <= FOLGA_DE_ALINHAMENTO && Math.abs(a.y - b.y) <= FOLGA_DE_ALINHAMENTO
}

/** `b` está na reta de `a` a `c`, seguindo em frente ou voltando (espinho de largura zero). */
function alinhados(a: PontoDoAnel, b: PontoDoAnel, c: PontoDoAnel): boolean {
  const ux = c.x - a.x
  const uy = c.y - a.y
  const tamanho = Math.hypot(ux, uy)
  if (tamanho <= FOLGA_DE_ALINHAMENTO) return true
  return Math.abs(ux * (b.y - a.y) - uy * (b.x - a.x)) / tamanho <= FOLGA_DE_ALINHAMENTO
}

/** Tira ponto repetido, ponto no meio de uma reta e espinho de ida e volta. */
function limparAnel(pontos: PontoDoAnel[]): PontoDoAnel[] {
  const pilha: PontoDoAnel[] = []
  const empilhar = (p: PontoDoAnel) => {
    for (;;) {
      const n = pilha.length
      if (n >= 1 && mesmoPonto(pilha[n - 1], p)) {
        pilha[n - 1].tolerancia = Math.min(pilha[n - 1].tolerancia, p.tolerancia)
        return
      }
      if (n >= 2 && alinhados(pilha[n - 2], pilha[n - 1], p)) {
        pilha.pop()
        continue
      }
      pilha.push(p)
      return
    }
  }
  for (const p of pontos) empilhar(p)
  // A volta fecha: o fim pode estar alinhado com o começo.
  for (let mudou = true; mudou && pilha.length >= 3; ) {
    const n = pilha.length
    mudou = true
    if (mesmoPonto(pilha[n - 1], pilha[0]) || alinhados(pilha[n - 2], pilha[n - 1], pilha[0])) pilha.pop()
    else if (alinhados(pilha[n - 1], pilha[0], pilha[1])) pilha.shift()
    else mudou = false
  }
  return pilha
}

/**
 * Douglas-Peucker com a tolerância de cada ponto, de um lado só: tira o ponto
 * que fica FORA da corda a até `tolerancia` dela (a tinta recua para o lado
 * dela, por baixo do traço), e nunca um ponto que fica do lado da tinta (a
 * corda avançaria além do eixo, para o outro lado da linha). A tinta anda à
 * direita do anel (y para baixo), então "lado da tinta" é
 * vetorial(corda, ponto) > 0. Âncoras fixas: o ponto mais à esquerda (sempre
 * canto de verdade) e o mais longe dele.
 */
function simplificarAnel(pontos: PontoDoAnel[]): PontoDoAnel[] {
  const n = pontos.length
  if (n <= 3) return pontos
  let a = 0
  for (let i = 1; i < n; i += 1) {
    if (pontos[i].x < pontos[a].x || (pontos[i].x === pontos[a].x && pontos[i].y < pontos[a].y)) a = i
  }
  let b = a
  let maisLonge = -1
  for (let i = 0; i < n; i += 1) {
    const d = (pontos[i].x - pontos[a].x) ** 2 + (pontos[i].y - pontos[a].y) ** 2
    if (d > maisLonge) { maisLonge = d; b = i }
  }
  if (a === b) return pontos
  const manter = new Uint8Array(n)
  manter[a] = 1
  manter[b] = 1
  const pendentes: Array<[number, number]> = [[a, b], [b, a]]
  for (let trecho = pendentes.pop(); trecho; trecho = pendentes.pop()) {
    const [i, j] = trecho
    const p = pontos[i]
    const q = pontos[j]
    let pior = -1
    let excesso = 0
    for (let k = (i + 1) % n; k !== j; k = (k + 1) % n) {
      const r = pontos[k]
      const ladoDaTinta = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) > 0
      const limite = ladoDaTinta ? FOLGA_DE_ALINHAMENTO : r.tolerancia
      const desvio = Math.sqrt(distancia2AoSegmento(r.x, r.y, p.x, p.y, q.x, q.y)) - limite
      if (desvio > excesso) { excesso = desvio; pior = k }
    }
    if (pior < 0) continue
    manter[pior] = 1
    pendentes.push([i, pior], [pior, j])
  }
  return pontos.filter((_, i) => manter[i] === 1)
}

/**
 * Costura cada buraco no anel de fora com uma ponte horizontal de ida e volta
 * (o "buraco de fechadura"), para o polígono de um anel só pintar em volta do
 * buraco. A ponte sai do lado esquerdo do buraco, rente ao ponto mais à
 * esquerda dele, numa altura sem nenhum vértice (assim ela nunca corre em cima
 * de uma aresta horizontal nem passa por um vértice), e anda para a esquerda
 * até a primeira aresta: como não cruza nenhum contorno, o polígono continua
 * sem cruzamento. Buraco em ordem de x, para a aresta que a ponte encontra já
 * estar costurada na lista.
 */
function juntarBuracos(externo: readonly DrawingPoint[], buracos: DrawingPoint[][]): DrawingPoint[] {
  const nx: number[] = externo.map((p) => p.x)
  const ny: number[] = externo.map((p) => p.y)
  const proximo: number[] = externo.map((_, i) => (i + 1) % externo.length)
  const novo = (x: number, y: number) => {
    nx.push(x)
    ny.push(y)
    proximo.push(-1)
    return nx.length - 1
  }

  const ordenados = buracos
    .map((anel) => ({ anel, esquerda: pontoMaisAEsquerda(anel) }))
    .sort((a, b) => a.esquerda.x - b.esquerda.x || a.esquerda.y - b.esquerda.y)

  for (const { anel, esquerda } of ordenados) {
    // A ponte passa do lado em que o buraco continua (abaixo do ponto, ou
    // acima quando o ponto mais à esquerda é também o mais baixo dele), a meio
    // caminho do vértice mais próximo naquela direção.
    const sentido = anel.some((p) => p.y > esquerda.y) ? 1 : -1
    let vao = Infinity
    for (const y of ny) if ((y - esquerda.y) * sentido > 0) vao = Math.min(vao, (y - esquerda.y) * sentido)
    for (const p of anel) if ((p.y - esquerda.y) * sentido > 0) vao = Math.min(vao, (p.y - esquerda.y) * sentido)
    if (!Number.isFinite(vao)) continue
    const yPonte = esquerda.y + sentido * Math.min(vao / 2, DESCIDA_MAXIMA_DA_PONTE)

    let lado = -1
    let xBuraco = Infinity
    for (let i = 0; i < anel.length; i += 1) {
      const x = cruzaAltura(anel[i].x, anel[i].y, anel[(i + 1) % anel.length].x, anel[(i + 1) % anel.length].y, yPonte)
      if (x !== null && x < xBuraco) { xBuraco = x; lado = i }
    }
    let u = -1
    let xBorda = -Infinity
    for (let no = 0; no < nx.length; no += 1) {
      const seguinte = proximo[no]
      const x = cruzaAltura(nx[no], ny[no], nx[seguinte], ny[seguinte], yPonte)
      if (x !== null && x < xBuraco && x > xBorda) { xBorda = x; u = no }
    }
    if (lado < 0 || u < 0) continue

    const w = proximo[u]
    const p1 = novo(xBorda, yPonte)
    const m1 = novo(xBuraco, yPonte)
    let anterior = m1
    for (let s = 1; s <= anel.length; s += 1) {
      const q = anel[(lado + s) % anel.length]
      const no = novo(q.x, q.y)
      proximo[anterior] = no
      anterior = no
    }
    const m2 = novo(xBuraco, yPonte)
    const p2 = novo(xBorda, yPonte)
    proximo[u] = p1
    proximo[p1] = m1
    proximo[anterior] = m2
    proximo[m2] = p2
    proximo[p2] = w
  }

  const arredondar = (valor: number) => Math.round(valor * 100) / 100
  const pontos: DrawingPoint[] = []
  let no = 0
  do {
    pontos.push({ x: arredondar(nx[no]), y: arredondar(ny[no]) })
    no = proximo[no]
  } while (no !== 0 && pontos.length <= nx.length)
  return pontos
}

function pontoMaisAEsquerda(anel: readonly DrawingPoint[]): DrawingPoint {
  let melhor = anel[0]
  for (const p of anel) if (p.x < melhor.x || (p.x === melhor.x && p.y < melhor.y)) melhor = p
  return melhor
}

/** O x em que a aresta de (ax, ay) a (bx, by) cruza a altura `y`, ou `null`. */
function cruzaAltura(ax: number, ay: number, bx: number, by: number, y: number): number | null {
  if (ay < y === by < y) return null
  return ax + ((y - ay) * (bx - ax)) / (by - ay)
}
