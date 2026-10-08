import type { Drawing, DrawingCap, DrawingPoint, Wall } from '../types/map'
import { computeMarkerStroke, readFreehandTexture } from './brushTexture'
import { flattenCurve } from './dashPattern'

/**
 * PAREDES AO REDOR DO DESENHO (pedido de 08/10/2026): a parede nasce no
 * CONTORNO do que está desenhado, em px de mundo. Este arquivo é só geometria
 * pura: devolve os anéis e os segmentos; quem cria e sincroniza as `Wall` é a
 * etapa seguinte.
 *
 * O que é "o que está desenhado" de cada tipo:
 * - traço (freehand, line, curve): a faixa da grossura, dos DOIS lados do eixo,
 *   com as pontas fechadas — vira um corredor fechado. Laço que o traço fecha
 *   vira buraco, com parede por dentro;
 * - pintura do balde (polygon cheio sem traço): a própria borda da tinta, com
 *   os buracos, sem a "ponte" que o balde usa para guardar buraco num anel só;
 * - forma preenchida com traço: a borda de fora, meia grossura para fora;
 * - forma sem preenchimento (rect, ellipse, circle, polygon): a borda de fora
 *   e a de dentro da faixa do traço;
 * - texto e caminho (`path`): sem parede.
 *
 * Retângulo e círculo saem exatos. O resto passa por um campo de distância
 * com sinal (distância ao eixo menos meia grossura; negativo dentro da
 * pegada), calculado numa grade fina SÓ na faixa perto dos segmentos, e por
 * marching squares com interpolação linear. Isso resolve de graça a união das
 * partes do traço: onde ele se cruza não sobra anel cruzado, e o laço fechado
 * vira buraco. No fim, Douglas-Peucker para a parede não ter um segmento por
 * célula da grade.
 *
 * Convenção dos anéis: fechados (o último ponto liga no primeiro, sem
 * repetir), anel de fora com área positiva pela fórmula do laço nas
 * coordenadas do mundo, buraco com área negativa. Cada anel começa no ponto
 * mais à esquerda (e mais acima no empate) e os anéis saem nessa ordem: mesma
 * entrada, mesma saída.
 */

/** As pontas de uma parede, no formato de `Wall`. */
export type SegmentoDeParede = Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>

/** Quanto a parede pode se afastar da borda desenhada, em px de mundo. */
const TOLERANCIA_PX = 0.5
/** Passo da grade do campo: metade da meia grossura, entre estes limites (px). */
const PASSO_MINIMO_PX = 0.25
const PASSO_MAXIMO_PX = 2
/** Lado de elipse que ainda vai virar traço: mais fino que a parede, para não somar erro. */
const TOLERANCIA_DA_FORMA_PX = 0.1
const LADOS_MINIMOS_DE_CIRCULO = 16
const LADOS_MAXIMOS_DE_CIRCULO = 1440
/** Anel com menos área que isto (px²) é resto de arredondamento, não parede. */
const AREA_MINIMA_DE_ANEL = 0.5
/** Ponto a menos disto da reta dos vizinhos é ponto alinhado (o balde arredonda a 0,01 px). */
const FOLGA_DE_ALINHAMENTO_PX = 0.02
/** Se a simplificação cruzar dois lados, tenta de novo com tolerância 4x menor, até isto. */
const TENTATIVAS_DE_SIMPLIFICAR = 3
/** As paredes saem arredondadas a 0,01 px, como a pintura do balde. */
const CENTESIMOS = 100

/** Um pedaço reto do eixo. Ponta reta (`butt`/`square`) só no começo e no fim do traço. */
interface Segmento {
  ax: number
  ay: number
  bx: number
  by: number
  retoEmA: boolean
  retoEmB: boolean
}

/** O que está desenhado: o eixo com meia grossura e, nas formas cheias, as áreas (par-ou-ímpar). */
interface Pegada {
  segmentos: Segmento[]
  meia: number
  areas: DrawingPoint[][]
}

/**
 * Grade esparsa do campo: blocos de `BLOCO` x `BLOCO` vértices, criados só
 * onde a faixa passa (uma linha fina atravessando o mapa não aloca a caixa
 * inteira). Vértice fora da faixa vale `Infinity`. O vértice (i, j) fica em
 * (ox + i·passo, oy + j·passo); i e j nunca são negativos.
 */
interface Campo {
  blocos: Map<number, Float32Array>
  blocosPorLinha: number
  colunas: number
  ox: number
  oy: number
  passo: number
}

/** Vértices por lado de cada bloco do campo. */
const BLOCO = 64

/** Texto e caminho não ganham parede; o resto ganha (forma sem traço e sem tinta dá zero anel). */
export function aceitaParedesAoRedor(desenho: Drawing): boolean {
  return desenho.kind !== 'text' && desenho.kind !== 'path'
}

/** Os anéis fechados (px de mundo) da borda do que o desenho mostra. */
export function contornoDoDesenho(desenho: Drawing): DrawingPoint[][] {
  const aneis: DrawingPoint[][] = []
  for (const anel of aneisSemOrdem(desenho)) {
    const limpo = tirarRepetidos(anel.map((p) => ({ x: arredondar(p.x), y: arredondar(p.y) })))
    if (limpo.length >= 3 && Math.abs(areaDoAnel(limpo)) > AREA_MINIMA_DE_ANEL) aneis.push(comecarNoCanto(limpo))
  }
  return aneis.sort((a, b) => a[0].x - b[0].x || a[0].y - b[0].y)
}

/** Os anéis como segmentos de parede: um por lado, cada anel fechando no primeiro ponto. */
export function segmentosDasParedesDoDesenho(desenho: Drawing): SegmentoDeParede[] {
  return contornoDoDesenho(desenho).flatMap((anel) =>
    anel.map((p, i) => {
      const q = anel[(i + 1) % anel.length]
      return { x1: p.x, y1: p.y, x2: q.x, y2: q.y }
    }),
  )
}

function aneisSemOrdem(desenho: Drawing): DrawingPoint[][] {
  switch (desenho.kind) {
    case 'text':
    case 'path':
      return []
    case 'line':
      return aneisDoTraco([{ x: desenho.x1, y: desenho.y1 }, { x: desenho.x2, y: desenho.y2 }], meiaGrossura(desenho.width), desenho.cap ?? 'round')
    case 'freehand': {
      // O marcador aparece 1,7x mais grosso que a espessura escolhida
      // (`lib/brushTexture.ts`): a parede abraça o que se vê.
      const largura = readFreehandTexture(desenho) === 'marker' ? computeMarkerStroke(desenho.width).width : desenho.width
      return aneisDoTraco(desenho.points, meiaGrossura(largura), desenho.cap ?? 'round')
    }
    case 'curve':
      return desenho.points.length < 2 ? [] : aneisDoTraco(flattenCurve(desenho.points), meiaGrossura(desenho.width), desenho.cap ?? 'round')
    case 'rect':
      return aneisDoRetangulo(desenho.x, desenho.y, desenho.w, desenho.h, meiaGrossura(desenho.width), desenho.filled)
    case 'circle':
      return aneisDoCirculo(desenho.cx, desenho.cy, desenho.radius, meiaGrossura(desenho.width), desenho.filled)
    case 'ellipse': {
      const meia = meiaGrossura(desenho.width)
      const pontos = pontosDaElipse(desenho.cx, desenho.cy, desenho.rx, desenho.ry, meia > 0 ? TOLERANCIA_DA_FORMA_PX : TOLERANCIA_PX)
      return aneisDaFormaFechada(pontos, meia, desenho.filled)
    }
    case 'polygon':
      return aneisDaFormaFechada(desenho.points, meiaGrossura(desenho.width), desenho.filled)
  }
}

/** Espessura inválida (NaN, negativa, ausente num mapa editado à mão) vale zero. */
function meiaGrossura(largura: number): number {
  return Number.isFinite(largura) && largura > 0 ? largura / 2 : 0
}

function pontosValidos(pontos: readonly DrawingPoint[]): DrawingPoint[] {
  return tirarRepetidos(pontos.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
}

/** Tira o ponto igual ao anterior; num anel, também o último igual ao primeiro. */
function tirarRepetidos(pontos: readonly DrawingPoint[]): DrawingPoint[] {
  const saida: DrawingPoint[] = []
  for (const p of pontos) {
    const anterior = saida[saida.length - 1]
    if (anterior === undefined || anterior.x !== p.x || anterior.y !== p.y) saida.push(p)
  }
  while (saida.length > 1 && saida[0].x === saida[saida.length - 1].x && saida[0].y === saida[saida.length - 1].y) saida.pop()
  return saida
}

// ── Formas exatas ────────────────────────────────────────────────────────────

/**
 * Retângulo: o traço do Pixi nas formas fechadas tem junta em quina (`miter`,
 * `pixi/drawDrawings.ts`), então a borda de fora é o retângulo crescido de
 * meia grossura e a de dentro, encolhido — quatro paredes cada, exatas.
 */
function aneisDoRetangulo(x: number, y: number, w: number, h: number, meia: number, cheio: boolean): DrawingPoint[][] {
  if (![x, y, w, h].every(Number.isFinite)) return []
  if (!cheio && meia <= 0) return []
  const x0 = Math.min(x, x + w)
  const x1 = Math.max(x, x + w)
  const y0 = Math.min(y, y + h)
  const y1 = Math.max(y, y + h)
  const fora = [{ x: x0 - meia, y: y0 - meia }, { x: x1 + meia, y: y0 - meia }, { x: x1 + meia, y: y1 + meia }, { x: x0 - meia, y: y1 + meia }]
  if (cheio || x1 - x0 <= 2 * meia || y1 - y0 <= 2 * meia) return [fora]
  const dentro = [{ x: x0 + meia, y: y0 + meia }, { x: x0 + meia, y: y1 - meia }, { x: x1 - meia, y: y1 - meia }, { x: x1 - meia, y: y0 + meia }]
  return [fora, dentro]
}

function aneisDoCirculo(cx: number, cy: number, raio: number, meia: number, cheio: boolean): DrawingPoint[][] {
  if (![cx, cy, raio].every(Number.isFinite) || raio < 0) return []
  if (!cheio && meia <= 0) return []
  const fora = pontosDoCirculo(cx, cy, raio + meia)
  const raioDeDentro = raio - meia
  if (cheio || raioDeDentro <= 0) return [fora]
  return [fora, pontosDoCirculo(cx, cy, raioDeDentro).reverse()]
}

/** Lados para a corda não se afastar do arco mais que `tolerancia`. */
function ladosDoArco(raio: number, tolerancia: number): number {
  if (!(raio > tolerancia)) return LADOS_MINIMOS_DE_CIRCULO
  const lados = Math.ceil(Math.PI / Math.acos(1 - tolerancia / raio))
  return Math.min(LADOS_MAXIMOS_DE_CIRCULO, Math.max(LADOS_MINIMOS_DE_CIRCULO, lados))
}

/** Ângulo crescente: área positiva nas coordenadas do mundo, ou seja, anel de fora. */
function pontosDoCirculo(cx: number, cy: number, raio: number): DrawingPoint[] {
  const lados = ladosDoArco(raio, TOLERANCIA_PX)
  const pontos: DrawingPoint[] = []
  for (let i = 0; i < lados; i += 1) {
    const angulo = (2 * Math.PI * i) / lados
    pontos.push({ x: cx + raio * Math.cos(angulo), y: cy + raio * Math.sin(angulo) })
  }
  return pontos
}

function pontosDaElipse(cx: number, cy: number, rx: number, ry: number, tolerancia: number): DrawingPoint[] {
  if (![cx, cy, rx, ry].every(Number.isFinite)) return []
  const lados = ladosDoArco(Math.max(Math.abs(rx), Math.abs(ry)), tolerancia)
  const pontos: DrawingPoint[] = []
  for (let i = 0; i < lados; i += 1) {
    const angulo = (2 * Math.PI * i) / lados
    pontos.push({ x: cx + Math.abs(rx) * Math.cos(angulo), y: cy + Math.abs(ry) * Math.sin(angulo) })
  }
  return pontos
}

// ── Traço e forma fechada: pegada para o campo ───────────────────────────────

/**
 * Traço aberto. Junta sempre redonda (é o que o render usa em freehand/curve);
 * ponta conforme `cap`: redonda, reta no ponto (`butt`) ou reta meia grossura
 * além dele (`square`). O traço interrompido (`dash`) conta como contínuo: a
 * parede fecha o corredor inteiro, não cada pedacinho.
 */
function aneisDoTraco(pontosCrus: readonly DrawingPoint[], meia: number, ponta: DrawingCap): DrawingPoint[][] {
  if (meia <= 0 || pontosCrus.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return []
  const pontos = semRepetirSeguidos(pontosCrus)
  if (pontos.length < 2) return []
  const reta = ponta !== 'round'
  const segmentos: Segmento[] = []
  for (let i = 0; i + 1 < pontos.length; i += 1) {
    segmentos.push({ ax: pontos[i].x, ay: pontos[i].y, bx: pontos[i + 1].x, by: pontos[i + 1].y, retoEmA: false, retoEmB: false })
  }
  const primeiro = segmentos[0]
  const ultimo = segmentos[segmentos.length - 1]
  primeiro.retoEmA = reta
  ultimo.retoEmB = reta
  if (ponta === 'square') {
    esticar(primeiro, 'a', meia)
    esticar(ultimo, 'b', meia)
  }
  return aneisDaPegada({ segmentos, meia, areas: [] })
}

/** Como `tirarRepetidos`, mas sem fechar: o último ponto do traço aberto pode ser igual ao primeiro. */
function semRepetirSeguidos(pontos: readonly DrawingPoint[]): DrawingPoint[] {
  const saida: DrawingPoint[] = []
  for (const p of pontos) {
    const anterior = saida[saida.length - 1]
    if (anterior === undefined || anterior.x !== p.x || anterior.y !== p.y) saida.push(p)
  }
  return saida
}

/** Ponta quadrada: a tinta continua meia grossura além da ponta, na direção do segmento. */
function esticar(segmento: Segmento, ponta: 'a' | 'b', quanto: number): void {
  const dx = segmento.bx - segmento.ax
  const dy = segmento.by - segmento.ay
  const tamanho = Math.hypot(dx, dy)
  if (tamanho === 0) return
  const ux = (dx / tamanho) * quanto
  const uy = (dy / tamanho) * quanto
  if (ponta === 'a') {
    segmento.ax -= ux
    segmento.ay -= uy
  } else {
    segmento.bx += ux
    segmento.by += uy
  }
}

/** Polígono ou elipse: traço fechado (junta redonda) e, se cheio, a área de dentro. */
function aneisDaFormaFechada(pontosCrus: readonly DrawingPoint[], meia: number, cheio: boolean): DrawingPoint[][] {
  const pontos = pontosValidos(pontosCrus)
  if (pontos.length < 3) return []
  if (meia <= 0) return cheio ? aneisDaArea(pontos) : []
  const segmentos: Segmento[] = pontos.map((p, i) => {
    const q = pontos[(i + 1) % pontos.length]
    return { ax: p.x, ay: p.y, bx: q.x, by: q.y, retoEmA: false, retoEmB: false }
  })
  return aneisDaPegada({ segmentos, meia, areas: cheio ? [pontos] : [] })
}

// ── Pintura sem traço: a borda exata ─────────────────────────────────────────

/**
 * Área sem traço (a pintura do balde): a parede é a própria borda. O balde
 * guarda buraco no mesmo anel com uma ponte de ida e volta
 * (`juntarBuracos` em `lib/baldeDeTinta.ts`); cada ponte é um par de lados
 * iguais em sentidos opostos, então sai tirando os pares. O que sobra se
 * fecha em anéis (cada ponto tem tantas saídas quanto entradas). Com
 * preenchimento par-ou-ímpar, a borda da tinta é exatamente esses lados,
 * mesmo num polígono que se cruza.
 */
function aneisDaArea(pontos: readonly DrawingPoint[]): DrawingPoint[][] {
  const n = pontos.length
  const chave = (p: DrawingPoint) => `${p.x},${p.y}`
  const removido = new Uint8Array(n)
  const semPar = new Map<string, number[]>()
  for (let i = 0; i < n; i += 1) {
    const a = chave(pontos[i])
    const b = chave(pontos[(i + 1) % n])
    const oposto = semPar.get(`${b}>${a}`)?.pop()
    if (oposto !== undefined) {
      removido[i] = 1
      removido[oposto] = 1
      continue
    }
    const lista = semPar.get(`${a}>${b}`)
    if (lista) lista.push(i)
    else semPar.set(`${a}>${b}`, [i])
  }

  const saidas = new Map<string, number[]>()
  for (let i = 0; i < n; i += 1) {
    if (removido[i]) continue
    const a = chave(pontos[i])
    const lista = saidas.get(a)
    if (lista) lista.push(i)
    else saidas.set(a, [i])
  }

  const usado = new Uint8Array(n)
  const aneis: DrawingPoint[][] = []
  for (let inicio = 0; inicio < n; inicio += 1) {
    if (removido[inicio] || usado[inicio]) continue
    const chaveDoInicio = chave(pontos[inicio])
    const anel: DrawingPoint[] = []
    let lado: number | undefined = inicio
    while (lado !== undefined) {
      usado[lado] = 1
      anel.push(pontos[lado])
      const fim = chave(pontos[(lado + 1) % n])
      if (fim === chaveDoInicio) break
      // Ponto sem saída livre não acontece (entradas = saídas); se acontecer, o anel fecha aqui.
      lado = saidas.get(fim)?.find((k) => !usado[k])
    }
    const limpo = tirarAlinhados(anel)
    if (limpo.length >= 3 && Math.abs(areaDoAnel(limpo)) > AREA_MINIMA_DE_ANEL) aneis.push(limpo)
  }
  return orientarPorAninhamento(aneis)
}

/** Tira o ponto que fica (quase) na reta entre o anterior e o seguinte. */
function tirarAlinhados(anel: DrawingPoint[]): DrawingPoint[] {
  let pontos = anel
  for (let mudou = true; mudou && pontos.length > 3; ) {
    mudou = false
    const ficam: DrawingPoint[] = []
    for (let i = 0; i < pontos.length; i += 1) {
      const anterior = ficam.length > 0 ? ficam[ficam.length - 1] : pontos[pontos.length - 1]
      const seguinte = pontos[(i + 1) % pontos.length]
      if (distanciaAoSegmento(pontos[i].x, pontos[i].y, anterior.x, anterior.y, seguinte.x, seguinte.y) <= FOLGA_DE_ALINHAMENTO_PX) mudou = true
      else ficam.push(pontos[i])
    }
    pontos = ficam
  }
  return pontos
}

/** Anel dentro de um número par de outros é de fora (área positiva); ímpar, buraco. */
function orientarPorAninhamento(aneis: DrawingPoint[][]): DrawingPoint[][] {
  return aneis.map((anel, i) => {
    const amostra = { x: (anel[0].x + anel[1].x) / 2, y: (anel[0].y + anel[1].y) / 2 }
    const profundidade = aneis.filter((outro, j) => j !== i && dentroDoAnel(amostra, outro)).length
    const querPositivo = profundidade % 2 === 0
    return areaDoAnel(anel) > 0 === querPositivo ? anel : [...anel].reverse()
  })
}

// ── Campo de distância com sinal + marching squares ─────────────────────────

function aneisDaPegada(pegada: Pegada): DrawingPoint[][] {
  if (pegada.segmentos.length === 0 || !(pegada.meia > 0)) return []
  const campo = medirCampo(pegada)
  if (pegada.areas.length > 0) encherAreas(campo, pegada.areas, pegada.meia)
  const aneis = contornar(campo)
  return simplificarSemCruzar(aneis, Math.min(TOLERANCIA_PX, pegada.meia / 2))
}

/**
 * Valor do campo em cada vértice da grade a menos de `meia + 2 passos` do
 * eixo: distância ao segmento mais perto menos meia grossura. Vértice mais
 * longe que isso não entra e nenhuma célula com ele cruza o zero (o campo
 * muda no máximo 1 px por px, e a célula tem diagonal de 1,41 passo).
 * A origem da grade sai da caixa do próprio desenho: mover o desenho move a
 * grade junto, e as paredes saem iguais, só deslocadas.
 */
function medirCampo({ segmentos, meia }: Pegada): Campo {
  const passo = Math.min(PASSO_MAXIMO_PX, Math.max(PASSO_MINIMO_PX, meia / 2))
  const faixa = 2 * passo
  const alcance = meia + faixa
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  for (const s of segmentos) {
    minX = Math.min(minX, s.ax, s.bx)
    minY = Math.min(minY, s.ay, s.by)
    maxX = Math.max(maxX, s.ax, s.bx)
  }
  const ox = minX - alcance - passo
  const oy = minY - alcance - passo
  const colunas = Math.ceil((maxX - minX + 2 * (alcance + passo)) / passo) + 2
  const campo: Campo = { blocos: new Map(), blocosPorLinha: Math.ceil(colunas / BLOCO), colunas, ox, oy, passo }

  for (const s of segmentos) {
    const dx = s.bx - s.ax
    const dy = s.by - s.ay
    const tamanho = Math.hypot(dx, dy)
    const ux = tamanho > 0 ? dx / tamanho : 0
    const uy = tamanho > 0 ? dy / tamanho : 0
    // Segmento comprido é varrido em pedaços de 2 alcances: a caixa de uma
    // diagonal longa é quase toda longe dela (uma linha de 1 px atravessando
    // o mapa faria milhões de contas). A distância continua sendo ao segmento
    // inteiro, então as pontas retas não mudam.
    const pedacos = Math.max(1, Math.ceil(tamanho / (2 * alcance)))
    for (let pedaco = 0; pedaco < pedacos; pedaco += 1) {
      const xa = s.ax + (dx * pedaco) / pedacos
      const ya = s.ay + (dy * pedaco) / pedacos
      const xb = s.ax + (dx * (pedaco + 1)) / pedacos
      const yb = s.ay + (dy * (pedaco + 1)) / pedacos
      const i0 = Math.ceil((Math.min(xa, xb) - alcance - ox) / passo)
      const i1 = Math.floor((Math.max(xa, xb) + alcance - ox) / passo)
      const j0 = Math.ceil((Math.min(ya, yb) - alcance - oy) / passo)
      const j1 = Math.floor((Math.max(ya, yb) + alcance - oy) / passo)
      for (let j = j0; j <= j1; j += 1) {
        const py = oy + j * passo - s.ay
        const linhaNoBloco = (j % BLOCO) * BLOCO
        // O bloco só muda a cada BLOCO colunas: busca no Map uma vez por trecho.
        let bloco: Float32Array | null = null
        for (let i = i0; i <= i1; i += 1) {
          if (i % BLOCO === 0) bloco = null
          const f = valorNoSegmento(s, tamanho, ux, uy, meia, ox + i * passo - s.ax, py)
          if (f >= faixa) continue
          if (bloco === null) bloco = blocoParaEscrever(campo, i, j)
          const posicao = linhaNoBloco + (i % BLOCO)
          if (f < bloco[posicao]) bloco[posicao] = f
        }
      }
    }
  }
  return campo
}

function chaveDoBloco(campo: Campo, i: number, j: number): number {
  return Math.floor(j / BLOCO) * campo.blocosPorLinha + Math.floor(i / BLOCO)
}

/** O bloco que guarda o vértice (i, j), criado vazio (tudo `Infinity`) se ainda não existe. */
function blocoParaEscrever(campo: Campo, i: number, j: number): Float32Array {
  const chave = chaveDoBloco(campo, i, j)
  const existente = campo.blocos.get(chave)
  if (existente) return existente
  const novo = new Float32Array(BLOCO * BLOCO).fill(Infinity)
  campo.blocos.set(chave, novo)
  return novo
}

/** Valor do campo no vértice (i, j); `Infinity` fora da faixa. */
function valorDoVertice(campo: Campo, i: number, j: number): number {
  const bloco = campo.blocos.get(chaveDoBloco(campo, i, j))
  return bloco ? bloco[(j % BLOCO) * BLOCO + (i % BLOCO)] : Infinity
}

/**
 * Distância com sinal à faixa de um segmento: `(px, py)` relativo à ponta A,
 * `(ux, uy)` a direção. Ponta redonda é o círculo; ponta reta é o canto de
 * caixa, e perto dela o mais perto da borda pode ser o plano da ponta (sem
 * isso a interpolação passaria da ponta).
 */
function valorNoSegmento(s: Segmento, tamanho: number, ux: number, uy: number, meia: number, px: number, py: number): number {
  const ao = px * ux + py * uy
  const deLado = Math.abs(px * uy - py * ux)
  const foraDaFaixa = deLado - meia
  if (ao < 0) return s.retoEmA ? pontaReta(-ao, foraDaFaixa) : Math.hypot(ao, deLado) - meia
  if (ao > tamanho) return s.retoEmB ? pontaReta(ao - tamanho, foraDaFaixa) : Math.hypot(ao - tamanho, deLado) - meia
  let f = foraDaFaixa
  if (s.retoEmA) f = Math.max(f, -ao)
  if (s.retoEmB) f = Math.max(f, ao - tamanho)
  return f
}

/** Distância com sinal além de uma ponta reta (canto de caixa): `alem` > 0 é quanto passou da ponta. */
function pontaReta(alem: number, foraDaFaixa: number): number {
  return foraDaFaixa > 0 ? Math.hypot(alem, foraDaFaixa) : alem
}

/**
 * Forma cheia: dentro da área (par-ou-ímpar) o campo fica negativo, então só a
 * borda de fora do traço sobra. Como o traço corre em cima da borda da área, a
 * distância à borda é `f + meia` e o valor de dentro é o menor entre o do traço
 * e menos essa distância.
 */
function encherAreas(campo: Campo, areas: readonly DrawingPoint[][], meia: number): void {
  const cruzamentosPorLinha = new Map<number, number[]>()
  for (const [chave, bloco] of campo.blocos) {
    const bi = chave % campo.blocosPorLinha
    const bj = Math.floor(chave / campo.blocosPorLinha)
    for (let posicao = 0; posicao < bloco.length; posicao += 1) {
      const f = bloco[posicao]
      if (f === Infinity) continue
      const i = bi * BLOCO + (posicao % BLOCO)
      const j = bj * BLOCO + Math.floor(posicao / BLOCO)
      let xs = cruzamentosPorLinha.get(j)
      if (!xs) {
        xs = cruzamentosNaAltura(areas, campo.oy + j * campo.passo)
        cruzamentosPorLinha.set(j, xs)
      }
      if (quantosAntes(xs, campo.ox + i * campo.passo) % 2 === 1) bloco[posicao] = Math.min(f, -(f + meia))
    }
  }
}

/** Os x em que as bordas das áreas cruzam a altura `y`, em ordem (regra meio-aberta). */
function cruzamentosNaAltura(areas: readonly DrawingPoint[][], y: number): number[] {
  const xs: number[] = []
  for (const anel of areas) {
    for (let i = 0; i < anel.length; i += 1) {
      const a = anel[i]
      const b = anel[(i + 1) % anel.length]
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
    }
  }
  return xs.sort((p, q) => p - q)
}

/** Quantos valores da lista ordenada são menores que `x` (busca binária). */
function quantosAntes(ordenados: readonly number[], x: number): number {
  let baixo = 0
  let alto = ordenados.length
  while (baixo < alto) {
    const meio = (baixo + alto) >> 1
    if (ordenados[meio] < x) baixo = meio + 1
    else alto = meio
  }
  return baixo
}

/**
 * Marching squares. Cada célula é percorrida na ordem dos cantos
 * (cima-esquerda, cima-direita, baixo-direita, baixo-esquerda), que deixa o
 * miolo da célula à esquerda do sentido de andar. Cada aresta em que o sinal
 * troca vira um ponto (interpolação linear); a "saída" (de dentro para fora)
 * liga na "entrada" seguinte. Assim a pegada fica sempre do mesmo lado do
 * contorno: anel de fora com área positiva, buraco negativa. Na célula de
 * sela (4 trocas), o valor do centro decide se as partes de dentro se ligam.
 * Cada aresta tem um id; o ponto dela é calculado uma vez e as células
 * vizinhas o encontram pelo id, então os anéis se fecham sem tolerância.
 */
function contornar(campo: Campo): DrawingPoint[][] {
  const { colunas } = campo
  const seguinte = new Map<number, number>()
  const pontos = new Map<number, DrawingPoint>()
  const ultimo = BLOCO - 1
  for (const [chave, bloco] of campo.blocos) {
    const bi = chave % campo.blocosPorLinha
    const bj = Math.floor(chave / campo.blocosPorLinha)
    for (let lj = 0; lj < BLOCO; lj += 1) {
      for (let li = 0; li < BLOCO; li += 1) {
        const posicao = lj * BLOCO + li
        const a = bloco[posicao]
        if (a === Infinity) continue
        const i = bi * BLOCO + li
        const j = bj * BLOCO + lj
        if (i + 1 >= colunas) continue
        // Vizinho no mesmo bloco sai direto do array; na beirada, do bloco ao lado.
        const b = li < ultimo ? bloco[posicao + 1] : valorDoVertice(campo, i + 1, j)
        const d = lj < ultimo ? bloco[posicao + BLOCO] : valorDoVertice(campo, i, j + 1)
        const c = li < ultimo && lj < ultimo ? bloco[posicao + BLOCO + 1] : valorDoVertice(campo, i + 1, j + 1)
        if (b === Infinity || c === Infinity || d === Infinity) continue
        // Quase toda célula da faixa não cruza o zero: sai antes de montar qualquer coisa.
        const dentroA = a < 0
        if (dentroA === b < 0 && dentroA === c < 0 && dentroA === d < 0) continue
        ligarCelula(campo, j * colunas + i, a, b, c, d, seguinte, pontos)
      }
    }
  }

  const aneis: DrawingPoint[][] = []
  const visitado = new Set<number>()
  for (const inicio of [...seguinte.keys()].sort((p, q) => p - q)) {
    if (visitado.has(inicio)) continue
    const anel: DrawingPoint[] = []
    for (let id: number | undefined = inicio; id !== undefined && !visitado.has(id); id = seguinte.get(id)) {
      visitado.add(id)
      const ponto = pontos.get(id)
      if (ponto) anel.push(ponto)
    }
    const limpo = tirarRepetidos(anel)
    if (limpo.length >= 3) aneis.push(limpo)
  }
  return aneis
}

/**
 * Uma célula que cruza o zero, com o vértice de cima-esquerda `k` e os valores
 * nos cantos. Arestas na ordem de andar: cima (a→b), direita (b→c), baixo
 * (c→d), esquerda (d→a). Os dois últimos valores de cada aresta são os do
 * sentido fixo (esquerda→direita, cima→baixo), para o ponto não depender de
 * qual das duas células vizinhas o calculou.
 */
function ligarCelula(
  campo: Campo,
  k: number,
  a: number,
  b: number,
  c: number,
  d: number,
  seguinte: Map<number, number>,
  pontos: Map<number, DrawingPoint>,
): void {
  const { colunas } = campo
  const arestas: Array<[number, number, number, number, number]> = [
    [2 * k, a, b, a, b],
    [2 * (k + 1) + 1, b, c, b, c],
    [2 * (k + colunas), c, d, d, c],
    [2 * k + 1, d, a, a, d],
  ]
  const trocas: Array<{ id: number; saida: boolean }> = []
  for (const [id, de, para, f0, f1] of arestas) {
    if (de < 0 === para < 0) continue
    trocas.push({ id, saida: de < 0 })
    if (!pontos.has(id)) pontos.set(id, pontoDaAresta(campo, id, f0, f1))
  }
  const centroDentro = (a + b + c + d) / 4 < 0
  trocas.forEach((troca, m) => {
    if (!troca.saida) return
    // Com 2 trocas, a seguinte e a anterior são a mesma. Na sela, o centro decide.
    const par = trocas[(m + (trocas.length === 2 || centroDentro ? 1 : trocas.length - 1)) % trocas.length]
    seguinte.set(troca.id, par.id)
  })
}

/**
 * Onde o campo zera na aresta `id` (par = horizontal a partir do vértice
 * `id >> 1`, ímpar = vertical). `f0` é o valor no vértice de partida, `f1` no
 * outro; quem chama só pergunta quando os sinais são diferentes.
 */
function pontoDaAresta(campo: Campo, id: number, f0: number, f1: number): DrawingPoint {
  // Divisão comum, não `>>`: num mapa grande o id passa de 2^31.
  const k = Math.floor(id / 2)
  const vertical = id % 2 === 1
  const t = f0 / (f0 - f1)
  const j = Math.floor(k / campo.colunas)
  const i = k - j * campo.colunas
  const x = campo.ox + i * campo.passo
  const y = campo.oy + j * campo.passo
  return vertical ? { x, y: y + t * campo.passo } : { x: x + t * campo.passo, y }
}

// ── Simplificação ────────────────────────────────────────────────────────────

/**
 * Douglas-Peucker em cada anel. A borda vinda da grade não se cruza, mas a
 * simplificação pode encostar um lado no outro onde o corredor é estreito:
 * se cruzar, tenta de novo com tolerância menor e, no limite, fica a borda
 * sem simplificar.
 */
function simplificarSemCruzar(aneis: DrawingPoint[][], tolerancia: number): DrawingPoint[][] {
  let atual = tolerancia
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_SIMPLIFICAR; tentativa += 1) {
    const simples = aneis.map((anel) => simplificarAnel(anel, atual)).filter((anel) => anel.length >= 3 && Math.abs(areaDoAnel(anel)) > AREA_MINIMA_DE_ANEL)
    if (!algumCruzamento(simples)) return simples
    atual /= 4
  }
  return aneis
}

/** Douglas-Peucker de anel fechado: âncoras no ponto mais à esquerda e no mais longe dele. */
function simplificarAnel(pontos: DrawingPoint[], tolerancia: number): DrawingPoint[] {
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
    if (d > maisLonge) {
      maisLonge = d
      b = i
    }
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
    let maior = tolerancia
    for (let k = (i + 1) % n; k !== j; k = (k + 1) % n) {
      const d = distanciaAoSegmento(pontos[k].x, pontos[k].y, p.x, p.y, q.x, q.y)
      if (d > maior) {
        maior = d
        pior = k
      }
    }
    if (pior < 0) continue
    manter[pior] = 1
    pendentes.push([i, pior], [pior, j])
  }
  return pontos.filter((_, i) => manter[i] === 1)
}

interface Lado {
  a: DrawingPoint
  b: DrawingPoint
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Algum lado cruza outro (de qualquer anel)? Varredura em x: cada lado só é
 * comparado com os que ainda estão "abertos" na mesma faixa de x. Encostar
 * na ponta não conta, só cruzar de verdade.
 */
function algumCruzamento(aneis: readonly DrawingPoint[][]): boolean {
  const lados: Lado[] = []
  for (const anel of aneis) {
    for (let i = 0; i < anel.length; i += 1) {
      const a = anel[i]
      const b = anel[(i + 1) % anel.length]
      lados.push({ a, b, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) })
    }
  }
  lados.sort((p, q) => p.minX - q.minX)
  let abertos: Lado[] = []
  for (const lado of lados) {
    abertos = abertos.filter((outro) => outro.maxX >= lado.minX)
    for (const outro of abertos) {
      if (outro.maxY < lado.minY || outro.minY > lado.maxY) continue
      if (cruzam(lado.a, lado.b, outro.a, outro.b)) return true
    }
    abertos.push(lado)
  }
  return false
}

function cruzam(a: DrawingPoint, b: DrawingPoint, c: DrawingPoint, d: DrawingPoint): boolean {
  return vetorial(a, b, c) * vetorial(a, b, d) < 0 && vetorial(c, d, a) * vetorial(c, d, b) < 0
}

function vetorial(a: DrawingPoint, b: DrawingPoint, c: DrawingPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function distanciaAoSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const tamanho2 = dx * dx + dy * dy
  const t = tamanho2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / tamanho2))
  return Math.hypot(ax + t * dx - px, ay + t * dy - py)
}

/** Área com sinal pela fórmula do laço: positiva = anel de fora nesta convenção. */
function areaDoAnel(anel: readonly DrawingPoint[]): number {
  let soma = 0
  for (let i = 0; i < anel.length; i += 1) {
    const a = anel[i]
    const b = anel[(i + 1) % anel.length]
    soma += a.x * b.y - b.x * a.y
  }
  return soma / 2
}

function dentroDoAnel(p: DrawingPoint, anel: readonly DrawingPoint[]): boolean {
  let dentro = false
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const a = anel[i]
    const b = anel[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

function arredondar(valor: number): number {
  return Math.round(valor * CENTESIMOS) / CENTESIMOS
}

/** Gira o anel para começar no ponto mais à esquerda (mais acima no empate). */
function comecarNoCanto(anel: DrawingPoint[]): DrawingPoint[] {
  let canto = 0
  for (let i = 1; i < anel.length; i += 1) {
    if (anel[i].x < anel[canto].x || (anel[i].x === anel[canto].x && anel[i].y < anel[canto].y)) canto = i
  }
  return [...anel.slice(canto), ...anel.slice(0, canto)]
}
