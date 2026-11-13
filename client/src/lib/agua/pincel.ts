import type { RegionPoint } from '../../types/map'
import { marchingSquares, signedArea } from '../floorContour'

/**
 * ÁGUA: a conta das formas novas do lago e do mar (pedido "MAR MAIS FÁCIL",
 * 13/11/2026), em px de mundo: o retângulo, o ponto preso na borda do mapa e
 * o pincel "Mais água / Menos água". Puro, sem Pixi nem store.
 */

export interface RetanguloDoMapa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const arredondar = (v: number): number => Math.round(v * 10) / 10

/** O ponto preso dentro do retângulo do mapa (`null` = mapa sem tamanho: fica onde está). */
export function naBordaDoMapa(p: RegionPoint, borda: RetanguloDoMapa | null): RegionPoint {
  if (borda === null) return p
  return { x: Math.min(borda.maxX, Math.max(borda.minX, p.x)), y: Math.min(borda.maxY, Math.max(borda.minY, p.y)) }
}

/** Os 4 cantos do retângulo de `a` a `b`, no sentido horário da tela, já presos no mapa. */
export function retanguloDaAgua(a: RegionPoint, b: RegionPoint, borda: RetanguloDoMapa | null): RegionPoint[] {
  const p = naBordaDoMapa(a, borda)
  const q = naBordaDoMapa(b, borda)
  const x0 = arredondar(Math.min(p.x, q.x))
  const x1 = arredondar(Math.max(p.x, q.x))
  const y0 = arredondar(Math.min(p.y, q.y))
  const y1 = arredondar(Math.max(p.y, q.y))
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** Os cantos do ponto a ponto: presos no mapa, sem dois no mesmo lugar (o duplo clique repete o último). */
export function cantosDoPontoAPonto(cantos: readonly RegionPoint[], borda: RetanguloDoMapa | null, juntos: number): RegionPoint[] {
  const out: RegionPoint[] = []
  for (const c of cantos) {
    const p = naBordaDoMapa(c, borda)
    const q = { x: arredondar(p.x), y: arredondar(p.y) }
    const u = out[out.length - 1]
    if (u !== undefined && Math.hypot(q.x - u.x, q.y - u.y) <= juntos) continue
    out.push(q)
  }
  const primeiro = out[0]
  const ultimo = out[out.length - 1]
  if (out.length > 1 && Math.hypot(primeiro.x - ultimo.x, primeiro.y - ultimo.y) <= juntos) out.pop()
  return out
}

// ---------- pincel "Mais água / Menos água" ----------

/** Lado da célula da grade do pincel, em casas: 1/8 de casa (5 px na casa de 40). */
const CELULA_EM_CASAS = 1 / 8
/** Teto de células da grade: acima disso a célula cresce (o mar enorme não passa de ~200 ms). */
const CELULAS_MAX = 1_000_000
/** Distância entre os pontos de controle do resultado, em casas (como o traço à mão). */
const PASSO_DO_RESULTADO = 0.5
/** Pedaço que se soltou com menos que isto (casas²) nem conta como "a água partiu". */
const PEDACO_QUE_CONTA = 0.5

export interface ResultadoDoPincelDeAgua {
  /** Os pontos de controle novos (curva suave), ou `null`: a água sumiria inteira. */
  pontos: RegionPoint[] | null
  /** A água partiu em dois ou mais pedaços e só o maior ficou. */
  partiu: boolean
  /** O pincel abriu um buraco no meio, que não fica (a água não tem buraco). */
  buraco: boolean
}

interface Grade {
  x0: number
  y0: number
  passo: number
  cols: number
  rows: number
}

function gradeQueCobre(caixa: RetanguloDoMapa, grid: number, folga: number): Grade {
  const largura = caixa.maxX - caixa.minX + 2 * folga
  const altura = caixa.maxY - caixa.minY + 2 * folga
  let passo = Math.max(0.5, grid * CELULA_EM_CASAS)
  if ((largura / passo) * (altura / passo) > CELULAS_MAX) passo = Math.sqrt((largura * altura) / CELULAS_MAX)
  // Uma moldura de 2 células fora de tudo: todo anel fecha (`marchingSquares`).
  const x0 = caixa.minX - folga - 2 * passo
  const y0 = caixa.minY - folga - 2 * passo
  return { x0, y0, passo, cols: Math.ceil(largura / passo) + 5, rows: Math.ceil(altura / passo) + 5 }
}

/**
 * O campo do contorno na grade: negativo dentro, positivo fora, e perto da
 * beira a distância até ela pelas linhas e colunas da grade (o meio da célula
 * não vira escada). Cada aresta do contorno entra só nas linhas que cruza.
 */
function campoDoContorno(xy: readonly number[], g: Grade, teto: number): Float32Array {
  const { cols, rows, x0, y0, passo } = g
  const valores = new Float32Array(cols * rows).fill(teto)
  const n = xy.length / 2
  const cruzaLinha: number[][] = Array.from({ length: rows }, () => [])
  const cruzaColuna: number[][] = Array.from({ length: cols }, () => [])
  for (let a = 0; a < n; a += 1) {
    const b = (a + 1) % n
    const ax = xy[a * 2]
    const ay = xy[a * 2 + 1]
    const bx = xy[b * 2]
    const by = xy[b * 2 + 1]
    // Linhas (y fixo) que a aresta cruza: amostra j em y0 + j * passo.
    if (ay !== by) {
      const jIni = Math.max(0, Math.ceil((Math.min(ay, by) - y0) / passo))
      const jFim = Math.min(rows - 1, Math.floor((Math.max(ay, by) - y0) / passo))
      for (let j = jIni; j <= jFim; j += 1) {
        const y = y0 + j * passo
        // Meio-aberto: o vértice que fica na linha conta uma vez só.
        if (y < Math.min(ay, by) || y >= Math.max(ay, by)) continue
        cruzaLinha[j].push(ax + ((y - ay) * (bx - ax)) / (by - ay))
      }
    }
    if (ax !== bx) {
      const iIni = Math.max(0, Math.ceil((Math.min(ax, bx) - x0) / passo))
      const iFim = Math.min(cols - 1, Math.floor((Math.max(ax, bx) - x0) / passo))
      for (let i = iIni; i <= iFim; i += 1) {
        const x = x0 + i * passo
        if (x < Math.min(ax, bx) || x >= Math.max(ax, bx)) continue
        cruzaColuna[i].push(ay + ((x - ax) * (by - ay)) / (bx - ax))
      }
    }
  }
  // Pelas linhas: dentro (par ou ímpar) e a distância na horizontal.
  for (let j = 0; j < rows; j += 1) {
    const xs = cruzaLinha[j].sort((p, q) => p - q)
    if (xs.length === 0) continue
    let k = 0
    for (let i = 0; i < cols; i += 1) {
      const x = x0 + i * passo
      while (k < xs.length && xs[k] <= x) k += 1
      const dentro = k % 2 === 1
      const perto = Math.min(k > 0 ? x - xs[k - 1] : teto, k < xs.length ? xs[k] - x : teto, teto)
      valores[j * cols + i] = dentro ? -perto : perto
    }
  }
  // Pelas colunas: só aproxima a distância (o sinal das linhas fica).
  for (let i = 0; i < cols; i += 1) {
    const ys = cruzaColuna[i].sort((p, q) => p - q)
    if (ys.length === 0) continue
    let k = 0
    for (let j = 0; j < rows; j += 1) {
      const y = y0 + j * passo
      while (k < ys.length && ys[k] <= y) k += 1
      const perto = Math.min(k > 0 ? y - ys[k - 1] : teto, k < ys.length ? ys[k] - y : teto)
      const at = j * cols + i
      const v = valores[at]
      if (perto < Math.abs(v)) valores[at] = v < 0 ? -perto : perto
    }
  }
  return valores
}

/** Soma (`mais`) ou tira (`menos`) do campo o traço do pincel, de raio `raio`. */
function aplicarTraco(valores: Float32Array, g: Grade, traco: readonly RegionPoint[], raio: number, mais: boolean): void {
  const { cols, rows, x0, y0, passo } = g
  const segmentos = traco.length === 1 ? [[traco[0], traco[0]]] : traco.slice(1).map((p, i) => [traco[i], p])
  for (const [a, b] of segmentos) {
    const alcance = raio + 2 * passo
    const iIni = Math.max(0, Math.floor((Math.min(a.x, b.x) - alcance - x0) / passo))
    const iFim = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + alcance - x0) / passo))
    const jIni = Math.max(0, Math.floor((Math.min(a.y, b.y) - alcance - y0) / passo))
    const jFim = Math.min(rows - 1, Math.ceil((Math.max(a.y, b.y) + alcance - y0) / passo))
    const vx = b.x - a.x
    const vy = b.y - a.y
    const l2 = vx * vx + vy * vy
    for (let j = jIni; j <= jFim; j += 1) {
      const y = y0 + j * passo
      for (let i = iIni; i <= iFim; i += 1) {
        const x = x0 + i * passo
        const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * vx + (y - a.y) * vy) / l2))
        const d = Math.hypot(x - a.x - vx * t, y - a.y - vy * t) - raio
        const at = j * cols + i
        if (mais) {
          if (d < valores[at]) valores[at] = d
        } else if (-d > valores[at]) valores[at] = -d
      }
    }
  }
  // A moldura continua fora: o anel que encosta na borda da grade fecha.
  for (let i = 0; i < cols; i += 1) {
    valores[i] = Math.max(valores[i], passo)
    valores[(rows - 1) * cols + i] = Math.max(valores[(rows - 1) * cols + i], passo)
  }
  for (let j = 0; j < rows; j += 1) {
    valores[j * cols] = Math.max(valores[j * cols], passo)
    valores[j * cols + cols - 1] = Math.max(valores[j * cols + cols - 1], passo)
  }
}

/** Douglas-Peucker num anel fechado, tolerância absoluta. */
function simplificarAnel(anel: readonly RegionPoint[], tolerancia: number): RegionPoint[] {
  const n = anel.length
  if (n <= 4) return anel.slice()
  const ficam = new Array<boolean>(n).fill(false)
  let longe = 0
  for (let i = 1; i < n; i += 1) if (Math.hypot(anel[i].x - anel[0].x, anel[i].y - anel[0].y) > Math.hypot(anel[longe].x - anel[0].x, anel[longe].y - anel[0].y)) longe = i
  ficam[0] = true
  ficam[longe] = true
  const fechado = [...anel, anel[0]]
  const pilha: [number, number][] = [
    [0, longe],
    [longe, n],
  ]
  while (pilha.length > 0) {
    const [a, b] = pilha.pop() as [number, number]
    if (b - a < 2) continue
    let pior = -1
    let maior = tolerancia
    const pa = fechado[a]
    const pb = fechado[b]
    const vx = pb.x - pa.x
    const vy = pb.y - pa.y
    const l2 = vx * vx + vy * vy
    for (let i = a + 1; i < b; i += 1) {
      const p = fechado[i]
      const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - pa.x) * vx + (p.y - pa.y) * vy) / l2))
      const d = Math.hypot(p.x - pa.x - vx * t, p.y - pa.y - vy * t)
      if (d > maior) {
        maior = d
        pior = i
      }
    }
    if (pior < 0) continue
    ficam[pior] = true
    pilha.push([a, pior], [pior, b])
  }
  return anel.filter((_, i) => ficam[i])
}

/** Trechos longos partidos em pedaços de até `maximo`: a curva suave não estufa entre pontos muito desiguais. */
function partirTrechosLongos(anel: readonly RegionPoint[], maximo: number): RegionPoint[] {
  const out: RegionPoint[] = []
  for (let i = 0; i < anel.length; i += 1) {
    const a = anel[i]
    const b = anel[(i + 1) % anel.length]
    out.push(a)
    const partes = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maximo)
    for (let k = 1; k < partes; k += 1) out.push({ x: a.x + ((b.x - a.x) * k) / partes, y: a.y + ((b.y - a.y) * k) / partes })
  }
  return out
}

/**
 * O pincel "Mais água / Menos água" passado na água de contorno `xy` (a curva
 * amostrada, `curvaDaAgua`): o traço junta (`mais`) ou come (`menos`) área. O
 * resultado volta a ser pontos de controle de curva suave, presos no mapa,
 * sem buraco; se a água partir, fica o pedaço maior.
 */
export function aguaComPincel(
  xy: readonly number[],
  traco: readonly RegionPoint[],
  raio: number,
  mais: boolean,
  grid: number,
  borda: RetanguloDoMapa | null,
  pontosMax: number,
): ResultadoDoPincelDeAgua {
  const caixa: RetanguloDoMapa = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const somar = (x: number, y: number) => {
    caixa.minX = Math.min(caixa.minX, x)
    caixa.minY = Math.min(caixa.minY, y)
    caixa.maxX = Math.max(caixa.maxX, x)
    caixa.maxY = Math.max(caixa.maxY, y)
  }
  for (let i = 0; i + 1 < xy.length; i += 2) somar(xy[i], xy[i + 1])
  if (mais) for (const p of traco) somar(p.x, p.y)
  if (!Number.isFinite(caixa.minX)) return { pontos: null, partiu: false, buraco: false }
  const g = gradeQueCobre(caixa, grid, mais ? raio : 0)
  const teto = 2 * g.passo
  const valores = campoDoContorno(xy, g, teto)
  aplicarTraco(valores, g, traco, raio, mais)
  const aneis = marchingSquares(valores, g.cols, g.rows, g.x0, g.y0, g.passo)
  if (aneis.length === 0) return { pontos: null, partiu: false, buraco: false }
  // O anel externo tem o sinal do maior; o de sinal oposto é buraco.
  const areas = aneis.map((a) => signedArea(a))
  let maior = 0
  for (let i = 1; i < aneis.length; i += 1) if (Math.abs(areas[i]) > Math.abs(areas[maior])) maior = i
  const sinal = Math.sign(areas[maior])
  const conta = PEDACO_QUE_CONTA * grid * grid
  let externos = 0
  let buraco = false
  for (let i = 0; i < aneis.length; i += 1) {
    if (Math.abs(areas[i]) < conta) continue
    if (Math.sign(areas[i]) === sinal) externos += 1
    else buraco = true
  }
  const presos = aneis[maior].map((p) => naBordaDoMapa(p, borda))
  let pontos = partirTrechosLongos(simplificarAnel(presos, g.passo * 0.6), PASSO_DO_RESULTADO * grid * 3)
  // Pontos demais (a costa cheia de recortes): menos detalhe até caber no teto do arquivo.
  let tolerancia = g.passo * 0.6
  while (pontos.length > pontosMax && tolerancia < grid * 4) {
    tolerancia *= 1.6
    pontos = simplificarAnel(presos, tolerancia)
  }
  const final = pontos.slice(0, pontosMax).map((p) => ({ x: arredondar(p.x), y: arredondar(p.y) }))
  return { pontos: final.length >= 3 ? final : null, partiu: externos > 1, buraco: buraco && !mais }
}
