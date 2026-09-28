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
 *    caminhos e contornos de forma, mais parede, linha do mapa e borda de sala.
 * 3. Enchente de 4 vizinhos a partir da célula clicada, e depois a tinta anda
 *    1 célula por baixo do traço, para não sobrar fresta entre os dois.
 * 4. O contorno da área cheia vira anel; buraco (forma fechada lá dentro)
 *    entra no mesmo polígono por um "buraco de fechadura", porque o desenho
 *    `polygon` guarda um anel só e o preenchimento é par-ou-ímpar.
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

interface Anel {
  xs: number[]
  ys: number[]
  area: number
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

  const minimo = BLOQUEIO_MINIMO_EM_CELULAS * Math.max(grade.sx, grade.sy)
  for (const traco of tracosDoMapa(map)) bloquearTraco(grade, traco, Math.max(traco.meiaLargura, minimo))

  const col = Math.min(cols - 1, Math.floor(ponto.x / grade.sx))
  const row = Math.min(rows - 1, Math.floor(ponto.y / grade.sy))
  const cheias = encher(grade, row * cols + col)
  if (!cheias) return null

  const aneis = contornar(grade, cheias)
  const externo = aneis.filter((anel) => anel.area > 0).sort((a, b) => b.area - a.area)[0]
  if (!externo) return null
  const buracos = aneis.filter((anel) => anel.area < 0)
  return juntarBuracos(grade, externo, buracos)
}

function tracosDoMapa(map: MapaDoBalde): Traco[] {
  const tracos: Traco[] = barreirasDoBalde(map).map((b) => ({ ...b, meiaLargura: 0 }))
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

/**
 * Enchente de 4 vizinhos a partir de `inicio`, mais 1 célula por baixo dos
 * traços em volta. Devolve os índices das células cheias, ou `null` quando o
 * clique caiu em cima de um traço.
 */
function encher(grade: Grade, inicio: number): Int32Array | null {
  const { cols, rows, estado } = grade
  if (estado[inicio] !== LIVRE) return null
  const fila = new Int32Array(cols * rows)
  let fim = 0
  estado[inicio] = CHEIA
  fila[fim++] = inicio
  for (let lido = 0; lido < fim; lido += 1) {
    const i = fila[lido]
    const c = i % cols
    if (c > 0 && estado[i - 1] === LIVRE) { estado[i - 1] = CHEIA; fila[fim++] = i - 1 }
    if (c < cols - 1 && estado[i + 1] === LIVRE) { estado[i + 1] = CHEIA; fila[fim++] = i + 1 }
    if (i >= cols && estado[i - cols] === LIVRE) { estado[i - cols] = CHEIA; fila[fim++] = i - cols }
    if (i < cols * (rows - 1) && estado[i + cols] === LIVRE) { estado[i + cols] = CHEIA; fila[fim++] = i + cols }
  }
  const soLivres = fim
  const porBaixoDoTraco = (v: number) => {
    if (estado[v] === BLOQUEADA) { estado[v] = CHEIA_POR_BAIXO_DO_TRACO; fila[fim++] = v }
  }
  for (let lido = 0; lido < soLivres; lido += 1) {
    const i = fila[lido]
    const c = i % cols
    if (c > 0) porBaixoDoTraco(i - 1)
    if (c < cols - 1) porBaixoDoTraco(i + 1)
    if (i >= cols) porBaixoDoTraco(i - cols)
    if (i < cols * (rows - 1)) porBaixoDoTraco(i + cols)
  }
  return fila.subarray(0, fim)
}

function estaCheia(estado: Uint8Array, i: number): boolean {
  return estado[i] >= CHEIA
}

/**
 * Anéis do contorno das células cheias, só com os cantos. Cada aresta anda com
 * a tinta à DIREITA (y para baixo): anel de fora dá área positiva e buraco dá
 * negativa. No vértice em que duas células cheias se tocam só pela quina, a
 * regra "vire à direita primeiro" separa as duas, como a enchente de 4
 * vizinhos também separa.
 */
function contornar(grade: Grade, cheias: Int32Array): Anel[] {
  const { cols, rows, estado } = grade
  const largura = cols + 1
  const arestas = new Uint8Array(largura * (rows + 1))
  for (const i of cheias) {
    const c = i % cols
    const r = (i - c) / cols
    if (r === 0 || !estaCheia(estado, i - cols)) arestas[r * largura + c] |= 1
    if (c === cols - 1 || !estaCheia(estado, i + 1)) arestas[r * largura + c + 1] |= 2
    if (r === rows - 1 || !estaCheia(estado, i + cols)) arestas[(r + 1) * largura + c + 1] |= 4
    if (c === 0 || !estaCheia(estado, i - 1)) arestas[(r + 1) * largura + c] |= 8
  }
  const passo = [1, largura, -1, -largura]
  const aneis: Anel[] = []
  for (let v0 = 0; v0 < arestas.length; v0 += 1) {
    for (;;) {
      const livres = arestas[v0] & 0xf & ~(arestas[v0] >> 4)
      if (!livres) break
      const d0 = livres & 1 ? 0 : livres & 2 ? 1 : livres & 4 ? 2 : 3
      const xs: number[] = []
      const ys: number[] = []
      let v = v0
      let d = d0
      for (let passos = 0; passos < 4 * arestas.length; passos += 1) {
        arestas[v] |= 16 << d
        const w = v + passo[d]
        let proxima = -1
        for (const giro of GIROS_EM_ORDEM) {
          const candidata = (d + giro) % 4
          if (arestas[w] & (1 << candidata)) { proxima = candidata; break }
        }
        if (proxima < 0) break
        if (proxima !== d) { xs.push(w % largura); ys.push(Math.floor(w / largura)) }
        v = w
        d = proxima
        if (v === v0 && d === d0) break
      }
      if (xs.length >= 4) aneis.push({ xs, ys, area: areaComSinal(xs, ys) })
    }
  }
  return aneis
}

function areaComSinal(xs: number[], ys: number[]): number {
  let soma = 0
  for (let i = 0; i < xs.length; i += 1) {
    const j = (i + 1) % xs.length
    soma += xs[i] * ys[j] - xs[j] * ys[i]
  }
  return soma / 2
}

/**
 * Costura cada buraco no anel de fora com uma ponte horizontal de ida e volta
 * (o "buraco de fechadura"), para o polígono de um anel só pintar em volta do
 * buraco. A ponte sai do canto de cima à esquerda do buraco e anda para a
 * esquerda só por células cheias até a primeira borda: como não cruza nenhum
 * contorno, o polígono continua sem cruzamento. Buraco em ordem de x, para a
 * borda que a ponte encontra já estar costurada na lista.
 */
function juntarBuracos(grade: Grade, externo: Anel, buracos: Anel[]): DrawingPoint[] {
  const { cols, estado, sx, sy } = grade
  const nx: number[] = [...externo.xs]
  const ny: number[] = [...externo.ys]
  const proximo: number[] = externo.xs.map((_, i) => (i + 1) % externo.xs.length)
  const novo = (x: number, y: number) => {
    nx.push(x)
    ny.push(y)
    proximo.push(-1)
    return nx.length - 1
  }

  const ordenados = buracos
    .map((anel) => ({ anel, canto: cantoDeCimaAEsquerda(anel) }))
    .sort((a, b) => a.anel.xs[a.canto] - b.anel.xs[b.canto] || a.anel.ys[a.canto] - b.anel.ys[b.canto])

  for (const { anel, canto } of ordenados) {
    const hx = anel.xs[canto]
    const hy = anel.ys[canto]
    const seguinte = (canto + 1) % anel.xs.length
    if (anel.xs[seguinte] !== hx || anel.ys[seguinte] <= hy) continue
    let k = hx - 1
    while (k >= 0 && estaCheia(estado, hy * cols + k)) k -= 1
    const xBorda = k + 1
    const yPonte = hy + 0.5
    const u = acharSubida(nx, ny, proximo, xBorda, yPonte)
    if (u < 0) continue

    const base = nx.length
    anel.xs.forEach((x, i) => {
      novo(x, anel.ys[i])
      proximo[base + i] = base + ((i + 1) % anel.xs.length)
    })
    const c = base + canto
    const dNo = proximo[c]
    const wNo = proximo[u]
    const p1 = novo(xBorda, yPonte)
    const q1 = novo(hx, yPonte)
    const q2 = novo(hx, yPonte)
    const p2 = novo(xBorda, yPonte)
    proximo[u] = p1
    proximo[p1] = q1
    proximo[q1] = dNo
    proximo[c] = q2
    proximo[q2] = p2
    proximo[p2] = wNo
  }

  const arredondar = (valor: number) => Math.round(valor * 100) / 100
  const pontos: DrawingPoint[] = []
  let no = 0
  do {
    pontos.push({ x: arredondar(nx[no] * sx), y: arredondar(ny[no] * sy) })
    no = proximo[no]
  } while (no !== 0 && pontos.length <= nx.length)
  return pontos
}

function cantoDeCimaAEsquerda(anel: Anel): number {
  let melhor = 0
  for (let i = 1; i < anel.xs.length; i += 1) {
    if (anel.xs[i] < anel.xs[melhor] || (anel.xs[i] === anel.xs[melhor] && anel.ys[i] < anel.ys[melhor])) melhor = i
  }
  return melhor
}

/** O nó cujo trecho sobe pela coluna `x` e passa pela altura `y`. */
function acharSubida(nx: number[], ny: number[], proximo: number[], x: number, y: number): number {
  let no = 0
  let passos = 0
  do {
    const seguinte = proximo[no]
    if (nx[no] === x && nx[seguinte] === x && ny[no] > y && ny[seguinte] < y) return no
    no = seguinte
    passos += 1
  } while (no !== 0 && passos <= nx.length)
  return -1
}
