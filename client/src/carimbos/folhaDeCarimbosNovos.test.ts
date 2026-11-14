import { it, vi } from 'vitest'
import { DENSIDADE_PADRAO, fatorDeEspaco, tamanhoNatural } from '../lib/carimbos'
import { unidadeDoRelevo } from '../lib/relevo'
import { LADO_DO_PEDACO } from '../texturas/meioTermo/chaoNoMundo'
import { chaoDe, pintarRegiao, type Regiao } from '../texturas/meioTermo/chaoNoMundo.testkit'
import { emPng, escrever, novaTela, type Tela } from '../texturas/meioTermo/moveis/folhaDeContato.testkit'
import { digitalDosPixels, medirImagem } from '../texturas/meioTermo/moveis/medidas.testkit'
import { ALFA_DA_SOMBRA, assarDesenho, COR_DA_SOMBRA, multiplicar, QUADRO_DA_BIBLIOTECA, QUADRO_DA_SOMBRA, type Matriz } from './arte'
import { carimboDoCatalogo } from './catalogo'
import type { DefinicaoDeCarimbo, DesenhoDeCarimbo, Rgb } from './embutidos'

/**
 * FOLHA DE CONTATO DOS CARIMBOS NOVOS (os 42 carimbos de 14/11/2026): a
 * ferramenta com que o desenhista olha o próprio carimbo ANTES de ele entrar
 * no catálogo, e com que o integrador gera a folha do lote. Não é teste: não
 * reprova nada, só pinta e mede. Molde: `texturas/meioTermo/moveis/folhaDeObjetosNovos.test.ts`.
 *
 * Sem navegador e sem canvas no jsdom: o desenho roda num CANVAS 2D DE
 * MENTIRA, por software (abaixo), e passa pelo MESMO `assarDesenho` do app
 * (`arte.ts`: o corpo em 256 texels e a silhueta da sombra deitada e
 * esfumada). Cada cartão mostra:
 * - GRANDE: a arte no tamanho em que o app a assa (1 texel = 1 pixel), o
 *   desenho de 45° (o da miniatura do painel), sobre a grama;
 * - MESA e GRUPO sobre GRAMA, TERRA e AREIA (o chão de verdade do app): o
 *   carimbo no tamanho natural num mapa de 200 x 200 casas de 50 px, visto a
 *   100%, sozinho e num grupo de 5 como o spray solta (giros diferentes,
 *   tamanho de 86% a 115%, na densidade padrão). Sombras numa camada só, como
 *   em `pixi/drawCarimbos.ts`.
 *
 * COMO RODAR, de `C:/dev/labirinto/client` (o caminho do pedido na variável
 * `FOLHA_DE_CARIMBOS`, absoluto ou a partir de `client/`):
 *
 *   FOLHA_DE_CARIMBOS=../tmp/objetos-2026-11-14/carimbos/prova/pedido.json rtk proxy npx vitest run src/carimbos/folhaDeCarimbosNovos.test.ts
 *
 * (no PowerShell: `$env:FOLHA_DE_CARIMBOS='../tmp/...'; rtk proxy npx vitest run src/...`).
 * Sem a variável o arquivo é pulado. As medidas saem num `.txt` ao lado do
 * PNG, com o mesmo nome (o vitest esconde o console de quem passa).
 *
 * O PEDIDO (JSON). `saida` é a partir da pasta do pedido. Carimbo do catálogo:
 * `id`. Carimbo novo, ainda sem registro: `arquivo`, o nome do módulo em
 * `carimbos/novos/` (sem `.ts`), que exporta `carimbo` (`DefinicaoDeCarimbo`)
 * e, só no carimbo com brilho, `brilho` (`DesenhoDeCarimbo`, a parte que
 * acende, somada por cima). `variante` (0 a 7, opcional) troca o desenho do
 * GRANDE (padrão 1, o de 45°).
 *
 *   { "saida": "folha.png", "itens": [ { "id": "pinheiro" }, { "arquivo": "cerejeira" } ] }
 *
 * AS MEDIDAS de cada carimbo (no `.txt` e embaixo do cartão; em vermelho o
 * que passa da meta): o tempo dos 8 desenhos assados pelo software (régua
 * RELATIVA: o navegador é mais rápido; compare com a dos carimbos de hoje),
 * os comandos e os vértices por desenho (o custo que não depende da máquina),
 * a saturação p95 e o contorno (`medidas.testkit.ts`), as cores (canal até
 * 245, saturação HSL até 0,72 e escritas no formato que
 * `embutidos.test.ts` lê), quantos dos 8 giros saem diferentes, se a mesma
 * entrada repete a mesma imagem, se os pontos ficam no quadro (a conta de
 * `embutidos.test.ts`, sobre os números crus que o desenho passa), se o corpo
 * encosta na borda da arte (cortado) e o tamanho que ele ocupa.
 */

const PEDIDO: unknown = import.meta.env.FOLHA_DE_CARIMBOS
const PEDIDA = typeof PEDIDO === 'string' && PEDIDO !== ''
const TETO_DA_FOLHA_MS = 10 * 60_000

/** O lado da arte de cada carimbo no palco (`LADO_DA_ARTE` de `pixi/drawCarimbos.ts`): se mudar lá, muda aqui. */
const LADO_DA_ARTE = 256
/** O mapa do tamanho de mesa: 200 x 200 casas de 50 px, o das contas de `embutidos.ts` (o tronco caído tem ~2 casas nele). */
const MAPA_DA_MESA = { width: 200, height: 200, grid: 50 }
const DESENHOS = 8
/** O desenho do GRANDE: o de 45°, o mesmo da miniatura do painel (`CarimbosControls.tsx`). */
const VARIANTE_DO_GRANDE = 1
/** Quanto do brilho (a parte que acende) entra na MESA e no GRUPO: o meio do pulso. No GRANDE entra inteiro. */
const BRILHO_NA_MESA = 0.6

/**
 * AS METAS, tiradas dos 12 carimbos de hoje na primeira folha (14/11/2026,
 * `tmp/objetos-2026-11-14/carimbos/hoje/folha.txt`): o pior de hoje com uma
 * folga pequena. O carimbo novo que passa delas sai em vermelho. Hoje: tempo
 * até 255 ms e comandos até 598 (a árvore morta, de galhos; os outros até 25),
 * vértices até 10.792, saturação p95 até 0,821 (o pinheiro; o verde da mata
 * passa do teto de 0,62 dos móveis), contorno a partir de 0,166.
 */
const TETO_DO_TEMPO_MS = 500
const TETO_DE_COMANDOS = 600
const TETO_DE_VERTICES = 12_000
const TETO_DA_SATURACAO = 0.82
const CONTORNO_MINIMO = 0.15
/** As regras de cor de `embutidos.test.ts`. */
const CANAL_MAXIMO = 245
const TETO_DA_SATURACAO_HSL = 0.72
const GIROS_DIFERENTES_MINIMOS = 4
/** O respiro do quadro em `embutidos.test.ts` (o giro do pinheiro mexe a ponta um tantinho). */
const FOLGA_DO_QUADRO = 0.03
/** O formato de cor que `embutidos.test.ts` sabe ler: o de `css()`. */
const FORMATO_DO_TESTE = /^rgba?\((\d+), (\d+), (\d+)/

// ---------------------------------------------------------------------------
// O Canvas 2D de mentira: só o que os carimbos usam (caminhos, preenchimento,
// traço, recorte, gradiente, `drawImage`, o desfoque e os modos de mistura que
// `arte.ts` pede). Tudo pré-multiplicado, em ponto flutuante; borda suavizada
// por 4 sublinhas com cobertura exata na horizontal.

/** Cor sem pré-multiplicar, cada canal de 0 a 1. */
type Rgba = readonly [number, number, number, number]

const TRANSPARENTE: Rgba = [0, 0, 0, 0]
const CORES_COM_NOME = new Map<string, Rgba>([
  ['black', [0, 0, 0, 1]],
  ['white', [1, 1, 1, 1]],
  ['transparent', TRANSPARENTE],
])
const RGB_DO_CSS = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/
const HEX_DO_CSS = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/
const DESFOQUE_DO_CSS = /blur\(\s*([\d.]+)px\s*\)/

function lerCor(texto: string): Rgba {
  const t = texto.trim().toLowerCase()
  const nomeada = CORES_COM_NOME.get(t)
  if (nomeada !== undefined) return nomeada
  const rgb = RGB_DO_CSS.exec(t)
  if (rgb !== null) {
    const alfa = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] === '%' ? 100 : 1)
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255, Math.min(1, Math.max(0, alfa))]
  }
  const hex = HEX_DO_CSS.exec(t)
  if (hex !== null) {
    const h = hex[1]
    const curto = h.length <= 4
    const canal = (i: number): number => (curto ? parseInt(h[i] + h[i], 16) : parseInt(h.slice(i * 2, i * 2 + 2), 16)) / 255
    const canais = curto ? h.length : h.length / 2
    return [canal(0), canal(1), canal(2), canais === 4 ? canal(3) : 1]
  }
  throw new Error(`a folha não lê a cor "${texto}": use css([r, g, b]) ou css(cor, alfa) de embutidos.ts`)
}

/** O que o desenho pediu, anotado só enquanto ELE desenha (a sombra de `arte.ts` não conta). */
interface Diario {
  gravando: boolean
  cores: Set<string>
  comandos: number
  vertices: number
  /** A caixa dos números crus que o desenho passou aos caminhos: a conta de `embutidos.test.ts`. */
  cru: { x0: number; y0: number; x1: number; y1: number }
}

function novoDiario(): Diario {
  return { gravando: false, cores: new Set(), comandos: 0, vertices: 0, cru: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity } }
}

let diario = novoDiario()

function anotarCor(cor: string): void {
  if (diario.gravando) diario.cores.add(cor)
}

function anotarCru(x: number, y: number): void {
  if (!diario.gravando) return
  const c = diario.cru
  c.x0 = Math.min(c.x0, x)
  c.y0 = Math.min(c.y0, y)
  c.x1 = Math.max(c.x1, x)
  c.y1 = Math.max(c.y1, y)
}

function aplicar(m: Matriz, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function inversa(m: Matriz): Matriz {
  const det = m[0] * m[3] - m[1] * m[2]
  if (det === 0) return [0, 0, 0, 0, 0, 0]
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]
}

/** Quantos pixels da tela vale uma unidade do desenho (a média dos dois eixos). */
function escalaDa(m: Matriz): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))
}

class GradienteDeMentira {
  private readonly paradas: { t: number; cor: Rgba }[] = []
  constructor(private readonly posicao: (x: number, y: number) => number | null) {}

  addColorStop(t: number, cor: string): void {
    anotarCor(cor)
    this.paradas.push({ t: Math.min(1, Math.max(0, t)), cor: lerCor(cor) })
    this.paradas.sort((a, b) => a.t - b.t)
  }

  /** A cor no ponto (x, y) do desenho. */
  corEm(x: number, y: number): Rgba {
    const p = this.posicao(x, y)
    const n = this.paradas.length
    if (p === null || n === 0) return TRANSPARENTE
    if (p <= this.paradas[0].t) return this.paradas[0].cor
    if (p >= this.paradas[n - 1].t) return this.paradas[n - 1].cor
    let k = 0
    while (this.paradas[k + 1].t < p) k += 1
    const a = this.paradas[k]
    const b = this.paradas[k + 1]
    const f = b.t > a.t ? (p - a.t) / (b.t - a.t) : 0
    return [a.cor[0] + (b.cor[0] - a.cor[0]) * f, a.cor[1] + (b.cor[1] - a.cor[1]) * f, a.cor[2] + (b.cor[2] - a.cor[2]) * f, a.cor[3] + (b.cor[3] - a.cor[3]) * f]
  }
}

function gradienteLinear(x0: number, y0: number, x1: number, y1: number): GradienteDeMentira {
  const dx = x1 - x0
  const dy = y1 - y0
  const d2 = dx * dx + dy * dy
  return new GradienteDeMentira((x, y) => (d2 === 0 ? null : ((x - x0) * dx + (y - y0) * dy) / d2))
}

/** O gradiente radial do Canvas (dois círculos): o maior t em que o ponto cai no círculo de raio não negativo. */
function gradienteRadial(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): GradienteDeMentira {
  const cdx = x1 - x0
  const cdy = y1 - y0
  const dr = r1 - r0
  const a = cdx * cdx + cdy * cdy - dr * dr
  return new GradienteDeMentira((x, y) => {
    const pdx = x - x0
    const pdy = y - y0
    const b = pdx * cdx + pdy * cdy + r0 * dr
    const c = pdx * pdx + pdy * pdy - r0 * r0
    if (Math.abs(a) < 1e-12) return b === 0 ? null : c / (2 * b)
    const disc = b * b - a * c
    if (disc < 0) return null
    const raiz = Math.sqrt(disc)
    const t = (b + raiz) / a
    return r0 + t * dr >= 0 ? t : (b - raiz) / a
  })
}

/** Uma camada pronta para misturar: RGBA pré-multiplicado de `w` x `h` com o canto em (x0, y0). */
interface Camada {
  readonly x0: number
  readonly y0: number
  readonly w: number
  readonly h: number
  readonly px: Float32Array
}

interface Cobertura {
  readonly x0: number
  readonly y0: number
  readonly w: number
  readonly h: number
  /** De 0 a 1 (pode passar de 1 por arredondamento: quem lê corta). */
  readonly cov: Float32Array
}

const SUBLINHAS = 4

function somarFaixa(cov: Float32Array, base: number, xa: number, xb: number, w: number, peso: number): void {
  const a = Math.max(0, xa)
  const b = Math.min(w, xb)
  if (b <= a) return
  const i0 = Math.floor(a)
  const i1 = Math.floor(b)
  if (i0 === i1) {
    cov[base + i0] += (b - a) * peso
    return
  }
  cov[base + i0] += (i0 + 1 - a) * peso
  for (let i = i0 + 1; i < i1; i += 1) cov[base + i] += peso
  if (i1 < w) cov[base + i1] += (b - i1) * peso
}

/** A cobertura dos polígonos (pontos já na tela, fechados) pela regra pedida, cortada na tela `W` x `H`. */
function rasterizar(poligonos: readonly (readonly number[])[], regra: CanvasFillRule, W: number, H: number): Cobertura | null {
  const arestas: number[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of poligonos) {
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length
      const ax = p[i]
      const ay = p[i + 1]
      const bx = p[j]
      const by = p[j + 1]
      minX = Math.min(minX, ax)
      maxX = Math.max(maxX, ax)
      minY = Math.min(minY, ay)
      maxY = Math.max(maxY, ay)
      if (ay === by) continue
      if (ay < by) arestas.push(ax, ay, bx, by, 1)
      else arestas.push(bx, by, ax, ay, -1)
    }
  }
  if (arestas.length === 0 || !Number.isFinite(minX + minY + maxX + maxY)) return null
  const x0 = Math.max(0, Math.floor(minX))
  const y0 = Math.max(0, Math.floor(minY))
  const x1 = Math.min(W, Math.ceil(maxX))
  const y1 = Math.min(H, Math.ceil(maxY))
  if (x1 <= x0 || y1 <= y0) return null
  const w = x1 - x0
  const h = y1 - y0
  const cov = new Float32Array(w * h)
  const n = arestas.length / 5
  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => arestas[a * 5 + 1] - arestas[b * 5 + 1])
  const cruzaX: number[] = []
  const cruzaD: number[] = []
  let proxima = 0
  let ativas: number[] = []
  const dentro = (enrolamento: number): boolean => (regra === 'evenodd' ? Math.abs(enrolamento) % 2 === 1 : enrolamento !== 0)
  for (let j = y0; j < y1; j += 1) {
    for (let s = 0; s < SUBLINHAS; s += 1) {
      const yy = j + (s + 0.5) / SUBLINHAS
      while (proxima < n && arestas[ordem[proxima] * 5 + 1] <= yy) {
        ativas.push(ordem[proxima])
        proxima += 1
      }
      ativas = ativas.filter((e) => arestas[e * 5 + 3] > yy)
      cruzaX.length = 0
      cruzaD.length = 0
      for (const e of ativas) {
        const k = e * 5
        const x = arestas[k] + ((yy - arestas[k + 1]) * (arestas[k + 2] - arestas[k])) / (arestas[k + 3] - arestas[k + 1])
        // Inserção ordenada: poucas arestas por linha.
        let i = cruzaX.length
        cruzaX.push(x)
        cruzaD.push(arestas[k + 4])
        while (i > 0 && cruzaX[i - 1] > x) {
          cruzaX[i] = cruzaX[i - 1]
          cruzaD[i] = cruzaD[i - 1]
          i -= 1
        }
        cruzaX[i] = x
        cruzaD[i] = arestas[k + 4]
      }
      let enrolamento = 0
      let inicio = 0
      const base = (j - y0) * w
      for (let i = 0; i < cruzaX.length; i += 1) {
        const antes = dentro(enrolamento)
        enrolamento += cruzaD[i]
        const depois = dentro(enrolamento)
        if (!antes && depois) inicio = cruzaX[i]
        else if (antes && !depois) somarFaixa(cov, base, inicio - x0, cruzaX[i] - x0, w, 1 / SUBLINHAS)
      }
    }
  }
  return { x0, y0, w, h, cov }
}

function areaComSinal(p: readonly number[]): number {
  let a = 0
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length
    a += p[i] * p[j + 1] - p[j] * p[i + 1]
  }
  return a / 2
}

/** Todas as peças do traço no mesmo sentido: com a regra "não zero" o preenchimento delas é a união, sem buraco. */
function noMesmoSentido(p: number[]): number[] {
  if (areaComSinal(p) >= 0) return p
  const r: number[] = []
  for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1])
  return r
}

function circulo(x: number, y: number, r: number): number[] {
  const n = Math.max(8, Math.ceil(Math.sqrt(r) * 8))
  const p: number[] = []
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2
    p.push(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  return p
}

/** Quantos segmentos um arco de `varredura` rad e raio `raio` px precisa para errar menos de ~0,1 px. */
function segmentosDoArco(varredura: number, raio: number): number {
  return Math.min(256, Math.max(4, Math.ceil(Math.abs(varredura) * Math.sqrt(Math.max(1, raio)) * 1.2)))
}

const MODOS_DA_TELA_INTEIRA = new Set(['source-in', 'destination-in'])
const MODOS = new Set(['source-over', 'source-in', 'source-atop', 'destination-in', 'destination-out', 'lighter', 'multiply', 'screen'])

interface Subcaminho {
  pontos: number[]
  fechado: boolean
}

interface Estado {
  m: Matriz
  preenchimento: string | GradienteDeMentira
  traco: string | GradienteDeMentira
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  globalAlpha: number
  globalCompositeOperation: GlobalCompositeOperation
  filter: string
  clipe: Float32Array | null
}

class Contexto2DDeMentira {
  lineWidth = 1
  lineCap: CanvasLineCap = 'butt'
  lineJoin: CanvasLineJoin = 'miter'
  globalAlpha = 1
  globalCompositeOperation: GlobalCompositeOperation = 'source-over'
  /** Existe como campo: `arte.ts` pergunta `'filter' in g` antes de esfumar a sombra. */
  filter = 'none'
  imageSmoothingEnabled = true
  imageSmoothingQuality: ImageSmoothingQuality = 'low'
  private m: Matriz = [1, 0, 0, 1, 0, 0]
  private preenchimento: string | GradienteDeMentira = '#000000'
  private traco: string | GradienteDeMentira = '#000000'
  private clipe: Float32Array | null = null
  private pilha: Estado[] = []
  private subcaminhos: Subcaminho[] = []
  private atual: Subcaminho | null = null

  constructor(readonly canvas: TelaDeMentira) {}

  get fillStyle(): string | GradienteDeMentira {
    return this.preenchimento
  }

  set fillStyle(valor: string | GradienteDeMentira) {
    if (typeof valor === 'string') {
      lerCor(valor)
      anotarCor(valor)
    }
    this.preenchimento = valor
  }

  get strokeStyle(): string | GradienteDeMentira {
    return this.traco
  }

  set strokeStyle(valor: string | GradienteDeMentira) {
    if (typeof valor === 'string') {
      lerCor(valor)
      anotarCor(valor)
    }
    this.traco = valor
  }

  save(): void {
    this.pilha.push({
      m: this.m,
      preenchimento: this.preenchimento,
      traco: this.traco,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      filter: this.filter,
      clipe: this.clipe,
    })
  }

  restore(): void {
    const e = this.pilha.pop()
    if (e === undefined) return
    this.m = e.m
    this.preenchimento = e.preenchimento
    this.traco = e.traco
    this.lineWidth = e.lineWidth
    this.lineCap = e.lineCap
    this.lineJoin = e.lineJoin
    this.globalAlpha = e.globalAlpha
    this.globalCompositeOperation = e.globalCompositeOperation
    this.filter = e.filter
    this.clipe = e.clipe
  }

  setTransform(a?: number, b?: number, c?: number, d?: number, e?: number, f?: number): void {
    this.m = a === undefined ? [1, 0, 0, 1, 0, 0] : [a, b ?? 0, c ?? 0, d ?? 1, e ?? 0, f ?? 0]
  }

  resetTransform(): void {
    this.m = [1, 0, 0, 1, 0, 0]
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.m = multiplicar(this.m, [a, b, c, d, e, f])
  }

  translate(x: number, y: number): void {
    this.transform(1, 0, 0, 1, x, y)
  }

  rotate(angulo: number): void {
    const c = Math.cos(angulo)
    const s = Math.sin(angulo)
    this.transform(c, s, -s, c, 0, 0)
  }

  scale(sx: number, sy: number): void {
    this.transform(sx, 0, 0, sy, 0, 0)
  }

  beginPath(): void {
    this.subcaminhos = []
    this.atual = null
  }

  private iniciar(x: number, y: number): void {
    this.atual = { pontos: [x, y], fechado: false }
    this.subcaminhos.push(this.atual)
    if (diario.gravando) diario.vertices += 1
  }

  private empurrar(x: number, y: number): void {
    if (this.atual === null) {
      this.iniciar(x, y)
      return
    }
    this.atual.pontos.push(x, y)
    if (diario.gravando) diario.vertices += 1
  }

  private ultimo(): [number, number] | null {
    const p = this.atual?.pontos
    return p === undefined || p.length < 2 ? null : [p[p.length - 2], p[p.length - 1]]
  }

  moveTo(x: number, y: number): void {
    anotarCru(x, y)
    this.iniciar(...aplicar(this.m, x, y))
  }

  lineTo(x: number, y: number): void {
    anotarCru(x, y)
    this.empurrar(...aplicar(this.m, x, y))
  }

  closePath(): void {
    if (this.atual === null || this.atual.pontos.length < 2) return
    this.atual.fechado = true
    const [x0, y0] = this.atual.pontos
    this.atual = { pontos: [x0, y0], fechado: false }
    this.subcaminhos.push(this.atual)
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    anotarCru(cx, cy)
    anotarCru(x, y)
    const c = aplicar(this.m, cx, cy)
    const f = aplicar(this.m, x, y)
    const p0 = this.ultimo() ?? c
    if (this.atual === null) this.iniciar(...p0)
    const n = Math.min(64, Math.max(2, Math.ceil(Math.sqrt(Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(f[0] - c[0], f[1] - c[1])) * 1.5)))
    for (let k = 1; k <= n; k += 1) {
      const t = k / n
      const u = 1 - t
      this.empurrar(u * u * p0[0] + 2 * u * t * c[0] + t * t * f[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * f[1])
    }
  }

  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    anotarCru(c1x, c1y)
    anotarCru(c2x, c2y)
    anotarCru(x, y)
    const c1 = aplicar(this.m, c1x, c1y)
    const c2 = aplicar(this.m, c2x, c2y)
    const f = aplicar(this.m, x, y)
    const p0 = this.ultimo() ?? c1
    if (this.atual === null) this.iniciar(...p0)
    const comprimento = Math.hypot(c1[0] - p0[0], c1[1] - p0[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(f[0] - c2[0], f[1] - c2[1])
    const n = Math.min(96, Math.max(3, Math.ceil(Math.sqrt(comprimento) * 1.5)))
    for (let k = 1; k <= n; k += 1) {
      const t = k / n
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const d = t * t * t
      this.empurrar(a * p0[0] + b * c1[0] + c * c2[0] + d * f[0], a * p0[1] + b * c1[1] + c * c2[1] + d * f[1])
    }
  }

  arc(x: number, y: number, r: number, inicio: number, fim: number, antiHorario = false): void {
    // A caixa que `embutidos.test.ts` anota para o arco.
    anotarCru(x - r, y - r)
    anotarCru(x + r, y + r)
    this.arcoDeElipse(x, y, r, r, 0, inicio, fim, antiHorario)
  }

  ellipse(x: number, y: number, rx: number, ry: number, giro: number, inicio: number, fim: number, antiHorario = false): void {
    // A caixa da elipse girada, como `embutidos.test.ts` anota.
    const ex = Math.hypot(rx * Math.cos(giro), ry * Math.sin(giro))
    const ey = Math.hypot(rx * Math.sin(giro), ry * Math.cos(giro))
    anotarCru(x - ex, y - ey)
    anotarCru(x + ex, y + ey)
    this.arcoDeElipse(x, y, rx, ry, giro, inicio, fim, antiHorario)
  }

  private arcoDeElipse(x: number, y: number, rx: number, ry: number, giro: number, inicio: number, fim: number, antiHorario: boolean): void {
    const volta = Math.PI * 2
    const resto = (v: number): number => ((v % volta) + volta) % volta
    let varredura = fim - inicio
    if (!antiHorario) varredura = varredura >= volta ? volta : resto(varredura)
    else varredura = varredura <= -volta ? -volta : -resto(inicio - fim)
    const n = segmentosDoArco(varredura, Math.max(rx, ry) * escalaDa(this.m))
    const cg = Math.cos(giro)
    const sg = Math.sin(giro)
    for (let k = 0; k <= n; k += 1) {
      const a = inicio + (varredura * k) / n
      const lx = rx * Math.cos(a)
      const ly = ry * Math.sin(a)
      const [px, py] = aplicar(this.m, x + lx * cg - ly * sg, y + lx * sg + ly * cg)
      if (k === 0 && (this.atual === null || this.atual.pontos.length === 0)) this.iniciar(px, py)
      else this.empurrar(px, py)
    }
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.closePath()
  }

  private poligonosDoCaminho(): number[][] {
    return this.subcaminhos.filter((s) => s.pontos.length >= 6).map((s) => s.pontos)
  }

  private retangulo(x: number, y: number, w: number, h: number): number[] {
    anotarCru(x, y)
    anotarCru(x + w, y + h)
    return [...aplicar(this.m, x, y), ...aplicar(this.m, x + w, y), ...aplicar(this.m, x + w, y + h), ...aplicar(this.m, x, y + h)]
  }

  fill(regra: CanvasFillRule = 'nonzero'): void {
    if (diario.gravando) diario.comandos += 1
    this.preencher(this.poligonosDoCaminho(), regra, this.preenchimento)
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    if (diario.gravando) diario.comandos += 1
    this.preencher([this.retangulo(x, y, w, h)], 'nonzero', this.preenchimento)
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    const c = rasterizar([this.retangulo(x, y, w, h)], 'nonzero', this.canvas.width, this.canvas.height)
    if (c === null) return
    const dst = this.canvas.dados
    for (let j = 0; j < c.h; j += 1) {
      for (let i = 0; i < c.w; i += 1) {
        const resta = 1 - Math.min(1, c.cov[j * c.w + i])
        const d = ((c.y0 + j) * this.canvas.width + c.x0 + i) * 4
        for (let k = 0; k < 4; k += 1) dst[d + k] *= resta
      }
    }
  }

  /** O traço vira peças (um retângulo por segmento e um disco em cada junta e ponta redonda), preenchidas juntas. */
  stroke(): void {
    if (diario.gravando) diario.comandos += 1
    const meia = (this.lineWidth * escalaDa(this.m)) / 2
    if (!(meia > 0)) return
    const pecas: number[][] = []
    for (const sub of this.subcaminhos) {
      const p = sub.fechado ? [...sub.pontos, sub.pontos[0], sub.pontos[1]] : sub.pontos
      const n = p.length / 2
      if (n < 2) continue
      for (let k = 0; k + 1 < n; k += 1) {
        let ax = p[k * 2]
        let ay = p[k * 2 + 1]
        let bx = p[k * 2 + 2]
        let by = p[k * 2 + 3]
        const comprimento = Math.hypot(bx - ax, by - ay)
        if (comprimento < 1e-9) continue
        const ux = (bx - ax) / comprimento
        const uy = (by - ay) / comprimento
        if (this.lineCap === 'square' && !sub.fechado) {
          if (k === 0) {
            ax -= ux * meia
            ay -= uy * meia
          }
          if (k + 2 === n) {
            bx += ux * meia
            by += uy * meia
          }
        }
        const nx = -uy * meia
        const ny = ux * meia
        pecas.push(noMesmoSentido([ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny]))
      }
      // Juntas sempre redondas (a esquina em bico vira curva: no tamanho dos carimbos não se vê).
      const primeira = sub.fechado || this.lineCap === 'round' ? 0 : 1
      const ultima = sub.fechado || this.lineCap === 'round' ? n - 1 : n - 2
      for (let k = primeira; k <= ultima; k += 1) pecas.push(noMesmoSentido(circulo(p[k * 2], p[k * 2 + 1], meia)))
    }
    this.preencher(pecas, 'nonzero', this.traco)
  }

  clip(regra: CanvasFillRule = 'nonzero'): void {
    const W = this.canvas.width
    const H = this.canvas.height
    const novo = new Float32Array(W * H)
    const c = rasterizar(this.poligonosDoCaminho(), regra, W, H)
    if (c !== null) {
      for (let j = 0; j < c.h; j += 1) {
        for (let i = 0; i < c.w; i += 1) {
          const k = (c.y0 + j) * W + c.x0 + i
          novo[k] = Math.min(1, c.cov[j * c.w + i]) * (this.clipe === null ? 1 : this.clipe[k])
        }
      }
    }
    this.clipe = novo
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradienteDeMentira {
    return gradienteLinear(x0, y0, x1, y1)
  }

  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): GradienteDeMentira {
    return gradienteRadial(x0, y0, r0, x1, y1, r1)
  }

  private preencher(poligonos: readonly (readonly number[])[], regra: CanvasFillRule, tinta: string | GradienteDeMentira): void {
    const c = rasterizar(poligonos, regra, this.canvas.width, this.canvas.height)
    if (c === null) return
    const px = new Float32Array(c.w * c.h * 4)
    const solida = typeof tinta === 'string' ? lerCor(tinta) : null
    const inv = inversa(this.m)
    for (let j = 0; j < c.h; j += 1) {
      for (let i = 0; i < c.w; i += 1) {
        const cobre = Math.min(1, c.cov[j * c.w + i])
        if (cobre <= 0) continue
        let cor = solida
        if (cor === null && typeof tinta !== 'string') cor = tinta.corEm(...aplicar(inv, c.x0 + i + 0.5, c.y0 + j + 0.5))
        if (cor === null) continue
        const a = cor[3] * cobre
        const k = (j * c.w + i) * 4
        px[k] = cor[0] * a
        px[k + 1] = cor[1] * a
        px[k + 2] = cor[2] * a
        px[k + 3] = a
      }
    }
    this.compor({ x0: c.x0, y0: c.y0, w: c.w, h: c.h, px })
  }

  drawImage(imagem: unknown, ...n: number[]): void {
    if (!(imagem instanceof TelaDeMentira)) throw new Error('a folha só desenha (drawImage) outra tela da própria folha')
    let [sx, sy, sw, sh] = [0, 0, imagem.width, imagem.height]
    let dx: number
    let dy: number
    let dw: number
    let dh: number
    if (n.length === 2) [dx, dy, dw, dh] = [n[0], n[1], sw, sh]
    else if (n.length === 4) [dx, dy, dw, dh] = [n[0], n[1], n[2], n[3]]
    else if (n.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = [n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]]
    else throw new Error(`drawImage com ${n.length} números: a folha lê 2, 4 ou 8`)
    if (diario.gravando) diario.comandos += 1
    if (!(sw > 0 && sh > 0 && dw !== 0 && dh !== 0)) return
    const mapa = multiplicar(this.m, [dw / sw, 0, 0, dh / sh, dx - (sx * dw) / sw, dy - (sy * dh) / sh])
    const inv = inversa(mapa)
    const cantos = [aplicar(mapa, sx, sy), aplicar(mapa, sx + sw, sy), aplicar(mapa, sx, sy + sh), aplicar(mapa, sx + sw, sy + sh)]
    const x0 = Math.max(0, Math.floor(Math.min(...cantos.map((p) => p[0]))))
    const y0 = Math.max(0, Math.floor(Math.min(...cantos.map((p) => p[1]))))
    const x1 = Math.min(this.canvas.width, Math.ceil(Math.max(...cantos.map((p) => p[0]))))
    const y1 = Math.min(this.canvas.height, Math.ceil(Math.max(...cantos.map((p) => p[1]))))
    if (x1 <= x0 || y1 <= y0) return
    const w = x1 - x0
    const h = y1 - y0
    const px = new Float32Array(w * h * 4)
    // Encolhendo, várias amostras por pixel (o filtro da placa ao reduzir).
    const passos = Math.min(4, Math.max(1, Math.ceil(1 / Math.max(1e-6, escalaDa(mapa)))))
    const amostra = [0, 0, 0, 0]
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        let r = 0
        let g = 0
        let b = 0
        let a = 0
        for (let v = 0; v < passos; v += 1) {
          for (let u = 0; u < passos; u += 1) {
            const [qx, qy] = aplicar(inv, x0 + i + (u + 0.5) / passos, y0 + j + (v + 0.5) / passos)
            if (qx < sx || qy < sy || qx >= sx + sw || qy >= sy + sh) continue
            bilinear(imagem.dados, imagem.width, imagem.height, qx - 0.5, qy - 0.5, amostra)
            r += amostra[0]
            g += amostra[1]
            b += amostra[2]
            a += amostra[3]
          }
        }
        const k = (j * w + i) * 4
        const q = passos * passos
        px[k] = r / q
        px[k + 1] = g / q
        px[k + 2] = b / q
        px[k + 3] = a / q
      }
    }
    this.compor({ x0, y0, w, h, px })
  }

  /** Mistura a camada na tela: desfoque, transparência global, modo de mistura e recorte, nessa ordem (a do Canvas). */
  private compor(camada: Camada): void {
    const modo = this.globalCompositeOperation
    if (!MODOS.has(modo)) throw new Error(`modo de mistura "${modo}": a folha lê ${[...MODOS].join(', ')}`)
    const desfoque = DESFOQUE_DO_CSS.exec(this.filter)
    const fonte = desfoque === null ? camada : desfocar(camada, Number(desfoque[1]))
    const W = this.canvas.width
    const H = this.canvas.height
    const dst = this.canvas.dados
    const alfa = this.globalAlpha
    const inteira = MODOS_DA_TELA_INTEIRA.has(modo)
    const xa = inteira ? 0 : Math.max(0, fonte.x0)
    const ya = inteira ? 0 : Math.max(0, fonte.y0)
    const xb = inteira ? W : Math.min(W, fonte.x0 + fonte.w)
    const yb = inteira ? H : Math.min(H, fonte.y0 + fonte.h)
    const s = [0, 0, 0, 0]
    const o = [0, 0, 0, 0]
    for (let y = ya; y < yb; y += 1) {
      for (let x = xa; x < xb; x += 1) {
        const fx = x - fonte.x0
        const fy = y - fonte.y0
        const dentro = fx >= 0 && fy >= 0 && fx < fonte.w && fy < fonte.h
        const kf = (fy * fonte.w + fx) * 4
        for (let c = 0; c < 4; c += 1) s[c] = dentro ? fonte.px[kf + c] * alfa : 0
        const d = (y * W + x) * 4
        const sa = s[3]
        const da = dst[d + 3]
        for (let c = 0; c < 4; c += 1) {
          const sc = s[c]
          const dc = dst[d + c]
          const ehAlfa = c === 3
          switch (modo) {
            case 'source-over':
              o[c] = sc + dc * (1 - sa)
              break
            case 'source-in':
              o[c] = sc * da
              break
            case 'source-atop':
              o[c] = ehAlfa ? da : sc * da + dc * (1 - sa)
              break
            case 'destination-in':
              o[c] = dc * sa
              break
            case 'destination-out':
              o[c] = dc * (1 - sa)
              break
            case 'lighter':
              o[c] = Math.min(1, sc + dc)
              break
            case 'multiply':
              o[c] = ehAlfa ? sa + da - sa * da : sc * (1 - da) + dc * (1 - sa) + sc * dc
              break
            default:
              o[c] = sc + dc - sc * dc
          }
        }
        const recorte = this.clipe === null ? 1 : this.clipe[y * W + x]
        for (let c = 0; c < 4; c += 1) dst[d + c] = dst[d + c] + (o[c] - dst[d + c]) * recorte
      }
    }
  }
}

/** Lê RGBA pré-multiplicado em (x, y) contínuo, entre os 4 vizinhos; fora da imagem é transparente. */
function bilinear(px: Float32Array, W: number, H: number, x: number, y: number, saida: number[]): void {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  saida[0] = 0
  saida[1] = 0
  saida[2] = 0
  saida[3] = 0
  for (let v = 0; v < 2; v += 1) {
    const yy = y0 + v
    if (yy < 0 || yy >= H) continue
    const wy = v === 0 ? 1 - fy : fy
    for (let u = 0; u < 2; u += 1) {
      const xx = x0 + u
      if (xx < 0 || xx >= W) continue
      const peso = wy * (u === 0 ? 1 - fx : fx)
      const k = (yy * W + xx) * 4
      saida[0] += px[k] * peso
      saida[1] += px[k + 1] * peso
      saida[2] += px[k + 2] * peso
      saida[3] += px[k + 3] * peso
    }
  }
}

/** Média corrida numa direção (linhas ou colunas), zero fora da camada. */
function caixa(px: Float32Array, w: number, h: number, raio: number, horizontal: boolean): Float32Array {
  const saida = new Float32Array(px.length)
  const linhas = horizontal ? h : w
  const comprimento = horizontal ? w : h
  const indice = horizontal ? (l: number, i: number) => (l * w + i) * 4 : (l: number, i: number) => (i * w + l) * 4
  const largura = 2 * raio + 1
  for (let l = 0; l < linhas; l += 1) {
    for (let c = 0; c < 4; c += 1) {
      let soma = 0
      for (let i = 0; i <= raio && i < comprimento; i += 1) soma += px[indice(l, i) + c]
      for (let i = 0; i < comprimento; i += 1) {
        saida[indice(l, i) + c] = soma / largura
        const sai = i - raio
        const entra = i + raio + 1
        if (sai >= 0) soma -= px[indice(l, sai) + c]
        if (entra < comprimento) soma += px[indice(l, entra) + c]
      }
    }
  }
  return saida
}

/** O `blur(σpx)` do Canvas: três médias corridas em cada eixo, quase a gaussiana. */
function desfocar(c: Camada, sigma: number): Camada {
  if (!(sigma > 0)) return c
  const margem = Math.ceil(sigma * 3)
  const w = c.w + 2 * margem
  const h = c.h + 2 * margem
  let px = new Float32Array(w * h * 4)
  for (let j = 0; j < c.h; j += 1) px.set(c.px.subarray(j * c.w * 4, (j + 1) * c.w * 4), ((j + margem) * w + margem) * 4)
  const raio = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2))
  for (let passo = 0; passo < 3; passo += 1) {
    px = caixa(px, w, h, raio, true)
    px = caixa(px, w, h, raio, false)
  }
  return { x0: c.x0 - margem, y0: c.y0 - margem, w, h, px }
}

/** O `<canvas>` de mentira que `arte.ts` recebe de `document.createElement('canvas')`. */
class TelaDeMentira {
  private largura = 300
  private altura = 150
  /** RGBA pré-multiplicado, de 0 a 1. */
  dados = new Float32Array(300 * 150 * 4)
  private contexto: Contexto2DDeMentira | null = null

  get width(): number {
    return this.largura
  }

  set width(valor: number) {
    this.largura = Math.max(0, Math.floor(valor))
    this.dados = new Float32Array(this.largura * this.altura * 4)
  }

  get height(): number {
    return this.altura
  }

  set height(valor: number) {
    this.altura = Math.max(0, Math.floor(valor))
    this.dados = new Float32Array(this.largura * this.altura * 4)
  }

  getContext(tipo: string): Contexto2DDeMentira | null {
    if (tipo !== '2d') return null
    this.contexto ??= new Contexto2DDeMentira(this)
    return this.contexto
  }

  /** RGBA de 8 bits sem pré-multiplicar (o `ImageData`), para as medidas. */
  emRgba(): Uint8ClampedArray {
    const saida = new Uint8ClampedArray(this.dados.length)
    for (let k = 0; k < this.dados.length; k += 4) {
      const a = this.dados[k + 3]
      if (a <= 0) continue
      saida[k] = Math.round((this.dados[k] / a) * 255)
      saida[k + 1] = Math.round((this.dados[k + 1] / a) * 255)
      saida[k + 2] = Math.round((this.dados[k + 2] / a) * 255)
      saida[k + 3] = Math.round(Math.min(1, a) * 255)
    }
    return saida
  }
}

/** Troca o `document.createElement('canvas')` pela tela de mentira enquanto `fazer` roda. */
function comTelaDeMentira<T>(fazer: () => T): T {
  const original = document.createElement
  const criar = original.bind(document)
  document.createElement = ((tag: string, opcoes?: ElementCreationOptions) =>
    tag.toLowerCase() === 'canvas' ? new TelaDeMentira() : criar(tag, opcoes)) as unknown as typeof document.createElement
  try {
    return fazer()
  } finally {
    document.createElement = original
  }
}

// ---------------------------------------------------------------------------
// O pedido

interface ItemDoPedido {
  readonly rotulo: string
  /** Do catálogo (`id`) ou o módulo de `carimbos/novos/`. */
  readonly id?: string
  readonly modulo?: string
  readonly variante: number
}

interface Pedido {
  readonly saida: string
  readonly itens: readonly ItemDoPedido[]
}

const TERMINA_EM_PNG = /\.png$/i
const NOME_DE_MODULO = /^[A-Za-z0-9_-]{1,60}$/

function lerPedido(conteudo: string): Pedido {
  const bruto: unknown = JSON.parse(conteudo)
  if (typeof bruto !== 'object' || bruto === null) throw new Error('o pedido tem de ser um objeto JSON')
  const saida = 'saida' in bruto ? bruto.saida : undefined
  if (typeof saida !== 'string' || !TERMINA_EM_PNG.test(saida)) throw new Error('"saida" tem de ser o caminho de um .png (a partir da pasta do pedido)')
  const itens = 'itens' in bruto ? bruto.itens : undefined
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('"itens" tem de ser uma lista com ao menos um carimbo')
  return {
    saida,
    itens: itens.map((item: unknown, i): ItemDoPedido => {
      if (typeof item !== 'object' || item === null) throw new Error(`item ${i + 1}: tem de ser um objeto`)
      const variante = 'variante' in item ? item.variante : VARIANTE_DO_GRANDE
      if (typeof variante !== 'number' || !Number.isInteger(variante) || variante < 0 || variante >= DESENHOS) throw new Error(`item ${i + 1}: "variante" vai de 0 a 7`)
      if ('id' in item && typeof item.id === 'string') return { rotulo: item.id, id: item.id, variante }
      if ('arquivo' in item && typeof item.arquivo === 'string' && NOME_DE_MODULO.test(item.arquivo)) return { rotulo: item.arquivo, modulo: item.arquivo, variante }
      throw new Error(`item ${i + 1}: "id" (do catálogo) ou "arquivo" (o módulo em carimbos/novos/, sem .ts)`)
    }),
  }
}

/** Os módulos de `carimbos/novos/` que podem trazer um carimbo: os desenhos, sem testes nem o índice do integrador. */
const MODULOS = import.meta.glob<Readonly<Record<string, unknown>>>(['./novos/*.ts', '!./novos/*.test.ts', '!./novos/*.testkit.ts', '!./novos/index.ts'])

function ehDesenho(valor: unknown): valor is DesenhoDeCarimbo {
  return typeof valor === 'function'
}

function ehDefinicao(valor: unknown): valor is DefinicaoDeCarimbo {
  if (typeof valor !== 'object' || valor === null) return false
  return (
    'id' in valor &&
    typeof valor.id === 'string' &&
    'nome' in valor &&
    typeof valor.nome === 'string' &&
    'tamanho' in valor &&
    typeof valor.tamanho === 'number' &&
    'sombra' in valor &&
    (valor.sombra === 'em-pe' || valor.sombra === 'baixa' || valor.sombra === 'deitada' || valor.sombra === 'nenhuma') &&
    'desenhar' in valor &&
    ehDesenho(valor.desenhar)
  )
}

interface CarimboDaFolha {
  readonly def: DefinicaoDeCarimbo
  readonly brilho: DesenhoDeCarimbo | null
  readonly novo: boolean
  readonly variante: number
}

async function carimboDoItem(item: ItemDoPedido): Promise<CarimboDaFolha> {
  if (item.id !== undefined) {
    const def = carimboDoCatalogo(item.id)
    if (def === null) throw new Error(`${item.id}: não há carimbo com esse id no catálogo`)
    const brilho = 'brilho' in def && ehDesenho(def.brilho) ? def.brilho : null
    return { def, brilho, novo: false, variante: item.variante }
  }
  const caminho = `./novos/${item.modulo ?? ''}.ts`
  if (!Object.hasOwn(MODULOS, caminho)) throw new Error(`${item.rotulo}: não há ${caminho.slice(2)} em carimbos/ (o "arquivo" do pedido é o nome do módulo em carimbos/novos/, sem .ts)`)
  const modulo = await MODULOS[caminho]()
  const def = modulo.carimbo
  if (!ehDefinicao(def)) throw new Error(`${caminho}: tem de exportar "carimbo" com id, nome, tamanho, sombra e desenhar (exporta: ${Object.keys(modulo).join(', ')})`)
  const brilho = ehDesenho(modulo.brilho) ? modulo.brilho : null
  return { def, brilho, novo: true, variante: item.variante }
}

// ---------------------------------------------------------------------------
// Assar e medir

/** Uma imagem RGBA pré-multiplicada com as reduções pela metade (o mipmap da placa). */
interface Mip {
  readonly niveis: readonly { readonly w: number; readonly h: number; readonly px: Float32Array }[]
}

function mipDe(tela: TelaDeMentira): Mip {
  const niveis = [{ w: tela.width, h: tela.height, px: tela.dados }]
  for (;;) {
    const a = niveis[niveis.length - 1]
    if (a.w < 2 || a.h < 2) break
    const w = Math.floor(a.w / 2)
    const h = Math.floor(a.h / 2)
    const px = new Float32Array(w * h * 4)
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        for (let c = 0; c < 4; c += 1) {
          const k = (y: number, x: number) => (y * a.w + x) * 4 + c
          px[(j * w + i) * 4 + c] = (a.px[k(2 * j, 2 * i)] + a.px[k(2 * j, 2 * i + 1)] + a.px[k(2 * j + 1, 2 * i)] + a.px[k(2 * j + 1, 2 * i + 1)]) / 4
        }
      }
    }
    niveis.push({ w, h, px })
  }
  return { niveis }
}

/** Uma caixa em unidades do desenho (a base na origem). */
interface Caixa {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** A caixa dos texels com alfa acima de `limiar`, em unidades do quadro (`esquerda`, `topo`, unidades por texel). */
function caixaDoAlfa(tela: TelaDeMentira, limiar: number, esquerda: number, topo: number, porTexel: number): Caixa | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let j = 0; j < tela.height; j += 1) {
    for (let i = 0; i < tela.width; i += 1) {
      if (tela.dados[(j * tela.width + i) * 4 + 3] <= limiar) continue
      x0 = Math.min(x0, i)
      y0 = Math.min(y0, j)
      x1 = Math.max(x1, i + 1)
      y1 = Math.max(y1, j + 1)
    }
  }
  if (x1 < x0) return null
  return { x0: esquerda + x0 * porTexel, y0: topo + y0 * porTexel, x1: esquerda + x1 * porTexel, y1: topo + y1 * porTexel }
}

/** O corpo encosta na borda da arte: o que passa do quadro é cortado no mapa. */
function encostaNaBorda(tela: TelaDeMentira): boolean {
  const { width: W, height: H, dados } = tela
  const LIMIAR = 0.02
  for (let i = 0; i < W; i += 1) if (dados[i * 4 + 3] > LIMIAR || dados[((H - 1) * W + i) * 4 + 3] > LIMIAR) return true
  for (let j = 0; j < H; j += 1) if (dados[j * W * 4 + 3] > LIMIAR || dados[(j * W + W - 1) * 4 + 3] > LIMIAR) return true
  return false
}

interface ArteDoGiro {
  readonly corpo: Mip
  readonly sombra: Mip | null
  readonly brilho: Mip | null
  readonly chao: boolean
  /** As caixas do que aparece, em unidades: a janela da folha recorta por elas. */
  readonly caixaDoCorpo: Caixa | null
  readonly caixaDaSombra: Caixa | null
}

interface MedidasDoCarimbo {
  readonly ms: number
  readonly comandos: number
  readonly vertices: number
  readonly saturacaoP95: number
  readonly contornoMinimo: number
  readonly canalMaximo: number
  readonly saturacaoHsl: number
  readonly coresForaDoFormato: readonly string[]
  readonly girosDiferentes: number
  readonly repete: boolean
  /** O quanto os números crus passam do quadro (0 = dentro). */
  readonly foraDoQuadro: number
  readonly cortado: boolean
  /** A caixa do corpo opaco (alfa de ao menos 0,5) no desenho de 45°. */
  readonly ocupa: Caixa | null
}

function saturacaoHsl(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * l - 1))
}

function excessoDoQuadro(cru: Diario['cru']): number {
  const q = QUADRO_DA_BIBLIOTECA
  if (!Number.isFinite(cru.x0)) return 0
  return Math.max(0, q.esquerda - cru.x0, cru.x1 - (q.esquerda + q.lado), q.topo - cru.y0, cru.y1 - (q.topo + q.lado)) - FOLGA_DO_QUADRO
}

interface Assado {
  readonly giros: readonly ArteDoGiro[]
  readonly medidas: MedidasDoCarimbo
}

function telaDaArte(valor: HTMLCanvasElement | null): TelaDeMentira | null {
  return valor instanceof TelaDeMentira ? valor : null
}

/** Os 8 desenhos do carimbo pelo `assarDesenho` do app (corpo e sombra), o brilho à parte, e as medidas. */
function assarCarimbo(c: CarimboDaFolha): Assado {
  const { def } = c
  let erro: unknown = null
  const desenhar: DesenhoDeCarimbo = (g, giro, semente) => {
    diario.gravando = true
    try {
      def.desenhar(g, giro, semente)
    } catch (e) {
      erro ??= e
      throw e
    } finally {
      diario.gravando = false
    }
  }
  const coresDeTodos = new Set<string>()
  let comandos = 0
  let vertices = 0
  let ms = 0
  let foraDoQuadro = 0
  const telas: TelaDeMentira[] = []
  const giros: ArteDoGiro[] = []
  const unidadesPorTexel = QUADRO_DA_BIBLIOTECA.lado / LADO_DA_ARTE
  for (let v = 0; v < DESENHOS; v += 1) {
    diario = novoDiario()
    const inicio = performance.now()
    const arte = comTelaDeMentira(() => assarDesenho(desenhar, def.sombra, (v * Math.PI) / 4, v, LADO_DA_ARTE))
    ms += performance.now() - inicio
    if (erro !== null) throw new Error(`${def.id}: o desenho lançou um erro no giro ${v}`, { cause: erro })
    const corpo = telaDaArte(arte?.corpo ?? null)
    if (arte === null || corpo === null) throw new Error(`${def.id}: o desenho do giro ${v} não saiu`)
    comandos = Math.max(comandos, diario.comandos)
    vertices = Math.max(vertices, diario.vertices)
    foraDoQuadro = Math.max(foraDoQuadro, excessoDoQuadro(diario.cru))
    for (const cor of diario.cores) coresDeTodos.add(cor)
    const sombra = telaDaArte(arte.sombra)
    let brilho: Mip | null = null
    if (c.brilho !== null) {
      const desenhoDoBrilho = c.brilho
      const aceso = comTelaDeMentira(() => assarDesenho(desenhoDoBrilho, 'nenhuma', (v * Math.PI) / 4, v, LADO_DA_ARTE))
      const telaDoBrilho = telaDaArte(aceso?.corpo ?? null)
      if (telaDoBrilho === null) throw new Error(`${def.id}: o brilho do giro ${v} não saiu`)
      brilho = mipDe(telaDoBrilho)
    }
    const s = QUADRO_DA_SOMBRA
    telas.push(corpo)
    giros.push({
      corpo: mipDe(corpo),
      sombra: sombra === null ? null : mipDe(sombra),
      brilho,
      chao: arte.chao,
      caixaDoCorpo: caixaDoAlfa(corpo, 0.01, QUADRO_DA_BIBLIOTECA.esquerda, QUADRO_DA_BIBLIOTECA.topo, unidadesPorTexel),
      caixaDaSombra: sombra === null ? null : caixaDoAlfa(sombra, 0.01, s.esquerda, s.topo, s.largura / sombra.width),
    })
  }
  // A mesma entrada, a mesma imagem: o desenho não guarda estado entre chamadas.
  diario = novoDiario()
  const deNovo = telaDaArte(comTelaDeMentira(() => assarDesenho(desenhar, def.sombra, 0, 0, LADO_DA_ARTE))?.corpo ?? null)
  const rgbas = telas.map((t) => t.emRgba())
  const repete = deNovo !== null && digitalDosPixels(deNovo.emRgba()) === digitalDosPixels(rgbas[0])
  let saturacaoP95 = 0
  let contornoMinimo = Infinity
  for (const rgba of rgbas) {
    const m = medirImagem(rgba, LADO_DA_ARTE, LADO_DA_ARTE, LADO_DA_ARTE * LADO_DA_ARTE)
    saturacaoP95 = Math.max(saturacaoP95, m.saturacaoP95)
    contornoMinimo = Math.min(contornoMinimo, m.contornoMinimo)
  }
  let canalMaximo = 0
  let maiorSaturacaoHsl = 0
  const coresForaDoFormato: string[] = []
  for (const css of coresDeTodos) {
    if (!FORMATO_DO_TESTE.test(css)) coresForaDoFormato.push(css)
    const [r, g, b] = lerCor(css).map((k) => Math.round(k * 255))
    canalMaximo = Math.max(canalMaximo, r, g, b)
    maiorSaturacaoHsl = Math.max(maiorSaturacaoHsl, saturacaoHsl(r, g, b))
  }
  return {
    giros,
    medidas: {
      ms,
      comandos,
      vertices,
      saturacaoP95,
      contornoMinimo,
      canalMaximo,
      saturacaoHsl: maiorSaturacaoHsl,
      coresForaDoFormato,
      girosDiferentes: new Set(rgbas.map(digitalDosPixels)).size,
      repete,
      foraDoQuadro,
      cortado: telas.some(encostaNaBorda),
      ocupa: caixaDoAlfa(telas[VARIANTE_DO_GRANDE], 0.5, QUADRO_DA_BIBLIOTECA.esquerda, QUADRO_DA_BIBLIOTECA.topo, unidadesPorTexel),
    },
  }
}

/** O que passa das metas (em vermelho no cartão). */
function foraDasMetas(m: MedidasDoCarimbo): string[] {
  const fora: string[] = []
  if (m.ms > TETO_DO_TEMPO_MS) fora.push('tempo')
  if (m.comandos > TETO_DE_COMANDOS) fora.push('comandos')
  if (m.vertices > TETO_DE_VERTICES) fora.push('vértices')
  if (m.saturacaoP95 > TETO_DA_SATURACAO) fora.push('saturação')
  if (m.contornoMinimo < CONTORNO_MINIMO) fora.push('contorno')
  if (m.canalMaximo > CANAL_MAXIMO) fora.push('cor estourada')
  if (m.saturacaoHsl > TETO_DA_SATURACAO_HSL) fora.push('cor saturada')
  if (m.coresForaDoFormato.length > 0) fora.push('cor fora do css()')
  if (m.girosDiferentes < GIROS_DIFERENTES_MINIMOS) fora.push('giros iguais')
  if (!m.repete) fora.push('a mesma entrada deu outra imagem')
  if (m.foraDoQuadro > 0) fora.push('fora do quadro')
  if (m.cortado) fora.push('cortado na borda')
  return fora
}

// ---------------------------------------------------------------------------
// A cena: o carimbo no chão, sozinho ou em grupo

/** Um carimbo posto: o pé em (x, y) e `t` px por unidade, em px do mundo; `brilho` = quanto do brilho entra. */
interface Posto {
  readonly x: number
  readonly y: number
  readonly t: number
  readonly arte: ArteDoGiro
  readonly brilho: number
}

/** O grupo de 5 do spray: posições em vezes o espaço da densidade padrão, o desenho e o tamanho de cada um. */
const GRUPO: readonly { readonly dx: number; readonly dy: number; readonly variante: number; readonly tamanho: number }[] = [
  { dx: -0.55, dy: -0.5, variante: 2, tamanho: 0.92 },
  { dx: 0.6, dy: -0.42, variante: 5, tamanho: 1.1 },
  { dx: 0.02, dy: 0.05, variante: 7, tamanho: 1 },
  { dx: -0.62, dy: 0.55, variante: 4, tamanho: 0.86 },
  { dx: 0.5, dy: 0.6, variante: 3, tamanho: 1.15 },
]

/** Uma janela: o que cabe nela, em px da folha, e o canto dela no mundo visto na `escala` (px da folha por px do mundo). */
interface Janela {
  readonly w: number
  readonly h: number
  readonly ox: number
  readonly oy: number
  readonly escala: number
  readonly postos: readonly Posto[]
}

/** O chão em volta de cada janela. */
const RESPIRO = 14

function janelaDosPostos(postos: readonly Posto[], escala: number): Janela {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of postos) {
    for (const c of [p.arte.caixaDoCorpo, p.arte.caixaDaSombra]) {
      if (c === null) continue
      x0 = Math.min(x0, (p.x + c.x0 * p.t) * escala)
      y0 = Math.min(y0, (p.y + c.y0 * p.t) * escala)
      x1 = Math.max(x1, (p.x + c.x1 * p.t) * escala)
      y1 = Math.max(y1, (p.y + c.y1 * p.t) * escala)
    }
  }
  if (x1 < x0) {
    x0 = 0
    y0 = 0
    x1 = 1
    y1 = 1
  }
  const ox = Math.floor(x0) - RESPIRO
  const oy = Math.floor(y0) - RESPIRO
  return { w: Math.ceil(x1) - ox + RESPIRO, h: Math.ceil(y1) - oy + RESPIRO, ox, oy, escala, postos }
}

interface Recorte {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** Lê a imagem no nível do mip certo para quem a vê com `porPixel` texels por pixel. */
function amostrar(mip: Mip, u: number, v: number, porPixel: number, saida: number[]): void {
  const nivel = Math.min(mip.niveis.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, porPixel)))))
  const n = mip.niveis[nivel]
  const k = 2 ** nivel
  bilinear(n.px, n.w, n.h, u / k - 0.5, v / k - 0.5, saida)
}

/** Cola a imagem (pré-multiplicada) no retângulo (x, y, w, h) da folha, dentro do recorte; `somar` = brilho que acende. */
function colarMip(tela: Tela, mip: Mip, x: number, y: number, w: number, h: number, recorte: Recorte, alfa: number, somar: boolean): void {
  const base = mip.niveis[0]
  const porPixel = base.w / w
  const s = [0, 0, 0, 0]
  for (let py = Math.max(recorte.y0, Math.floor(y)); py < Math.min(recorte.y1, Math.ceil(y + h)); py += 1) {
    for (let px = Math.max(recorte.x0, Math.floor(x)); px < Math.min(recorte.x1, Math.ceil(x + w)); px += 1) {
      amostrar(mip, ((px + 0.5 - x) / w) * base.w, ((py + 0.5 - y) / h) * base.h, porPixel, s)
      if (s[3] <= 0) continue
      const d = (py * tela.largura + px) * 3
      for (let c = 0; c < 3; c += 1) {
        const atual = tela.rgb[d + c]
        tela.rgb[d + c] = Math.round(somar ? Math.min(255, atual + s[c] * 255 * alfa) : s[c] * 255 * alfa + atual * (1 - s[3] * alfa))
      }
    }
  }
}

/**
 * Enche o retângulo com o chão visto na `escala`: cada pixel lê o chão em
 * (i, j) / escala, entre os 4 vizinhos; passando da região, o chão dá a volta
 * (o `estenderChao` de `folhaDeObjetosNovos.test.ts`).
 */
function estenderChao(tela: Tela, chao: Regiao, x: number, y: number, largura: number, altura: number, escala: number): void {
  for (let j = 0; j < altura; j += 1) {
    const v = j / escala
    const v0 = Math.floor(v)
    const fv = v - v0
    const linha0 = (v0 % chao.altura) * chao.largura
    const linha1 = ((v0 + 1) % chao.altura) * chao.largura
    for (let i = 0; i < largura; i += 1) {
      const u = i / escala
      const u0 = Math.floor(u)
      const fu = u - u0
      const coluna0 = u0 % chao.largura
      const coluna1 = (u0 + 1) % chao.largura
      const destino = ((y + j) * tela.largura + x + i) * 3
      for (let k = 0; k < 3; k += 1) {
        const cima = chao.rgba[(linha0 + coluna0) * 4 + k] * (1 - fu) + chao.rgba[(linha0 + coluna1) * 4 + k] * fu
        const baixo = chao.rgba[(linha1 + coluna0) * 4 + k] * (1 - fu) + chao.rgba[(linha1 + coluna1) * 4 + k] * fu
        tela.rgb[destino + k] = Math.round(cima * (1 - fv) + baixo * fv)
      }
    }
  }
}

/**
 * A janela na folha, em (x, y) com a `altura` pedida (o conteúdo no meio):
 * o chão, os objetos do chão, as sombras numa camada só (a silhueta opaca
 * somada e a transparência uma vez, como `drawCarimbos.ts`) e os corpos de
 * trás para a frente, cada um com o brilho dele por cima.
 */
function desenharJanela(tela: Tela, j: Janela, x: number, y: number, altura: number, chao: Regiao): void {
  estenderChao(tela, chao, x, y, j.w, altura, j.escala)
  const recorte: Recorte = { x0: x, y0: y, x1: x + j.w, y1: y + altura }
  const ox = x - j.ox
  const oy = y + Math.floor((altura - j.h) / 2) - j.oy
  const q = QUADRO_DA_BIBLIOTECA
  const corpo = (p: Posto): [number, number, number, number] => [(p.x + q.esquerda * p.t) * j.escala + ox, (p.y + q.topo * p.t) * j.escala + oy, q.lado * p.t * j.escala, q.lado * p.t * j.escala]
  for (const p of j.postos) if (p.arte.chao) colarMip(tela, p.arte.corpo, ...corpo(p), recorte, 1, false)
  const mascara = new Float32Array(j.w * altura)
  const s = QUADRO_DA_SOMBRA
  const amostra = [0, 0, 0, 0]
  for (const p of j.postos) {
    const sombra = p.arte.sombra
    if (sombra === null) continue
    const base = sombra.niveis[0]
    const sx = (p.x + s.esquerda * p.t) * j.escala + ox
    const sy = (p.y + s.topo * p.t) * j.escala + oy
    const sw = s.largura * p.t * j.escala
    const sh = s.altura * p.t * j.escala
    for (let py = Math.max(y, Math.floor(sy)); py < Math.min(y + altura, Math.ceil(sy + sh)); py += 1) {
      for (let px = Math.max(x, Math.floor(sx)); px < Math.min(x + j.w, Math.ceil(sx + sw)); px += 1) {
        amostrar(sombra, ((px + 0.5 - sx) / sw) * base.w, ((py + 0.5 - sy) / sh) * base.h, base.w / sw, amostra)
        const k = (py - y) * j.w + (px - x)
        mascara[k] = mascara[k] + amostra[3] - mascara[k] * amostra[3]
      }
    }
  }
  for (let py = 0; py < altura; py += 1) {
    for (let px = 0; px < j.w; px += 1) {
      const m = Math.min(1, mascara[py * j.w + px]) * ALFA_DA_SOMBRA
      if (m <= 0) continue
      const d = ((y + py) * tela.largura + x + px) * 3
      for (let c = 0; c < 3; c += 1) tela.rgb[d + c] = Math.round(tela.rgb[d + c] * (1 - m) + COR_DA_SOMBRA[c] * m)
    }
  }
  for (const p of [...j.postos].filter((p) => !p.arte.chao).sort((a, b) => a.y - b.y)) {
    colarMip(tela, p.arte.corpo, ...corpo(p), recorte, 1, false)
    if (p.arte.brilho !== null && p.brilho > 0) colarMip(tela, p.arte.brilho, ...corpo(p), recorte, p.brilho, true)
  }
}

// ---------------------------------------------------------------------------
// O cartão e a folha

type Cor = Rgb
const FUNDO: Cor = [0x2a, 0x24, 0x20]
const TINTA: Cor = [0xee, 0xe4, 0xd8]
const APAGADA: Cor = [0xb0, 0xa4, 0x96]
const ALERTA: Cor = [0xf2, 0x7d, 0x5c]
const MARGEM = 24
const VAO = 16
const FRESTA = 6
const ESCALA_DO_NOME = 3
const ESCALA_DA_LETRA = 2
/** A fonte de `folhaDeContato.testkit.ts`: 5 x 7 pontos, mais 1 de espaço entre as letras. */
const ALTURA_DA_LETRA = 7
const PASSO_DA_LETRA = 6
const LINHA_DO_NOME = ALTURA_DA_LETRA * ESCALA_DO_NOME + 8
const LINHA = ALTURA_DA_LETRA * ESCALA_DA_LETRA + 8
const CABECALHO = 'GRANDE NA GRAMA, A ARTE COMO O APP ASSA, GIRO 45 / MESA E GRUPO DE 5 NUM MAPA DE 200 X 200 CASAS A 100 POR CENTO'
/** Os três chãos, do catálogo de texturas. O GRANDE vai no primeiro. */
const CHAOS: readonly { readonly id: string; readonly nome: string }[] = [
  { id: 'grama', nome: 'GRAMA' },
  { id: 'terra', nome: 'TERRA' },
  { id: 'areia', nome: 'AREIA' },
]
/** Chão pintado por textura: 2 x 2 pedaços; a janela maior dá a volta nele. */
const PEDACOS_DO_CHAO = 2
const FILEIRAS_A_TENTAR: readonly number[] = [1, 1.25, 1.5, 2, 2.5, 3]

/** A fonte só tem maiúsculas sem acento, dígitos e `, / +`: o resto sairia em branco. */
function emLetrasDaFolha(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').replace(/[-_.]/g, ' ').toUpperCase()
}

function larguraDoTexto(texto: string, escala: number): number {
  return texto.length * PASSO_DA_LETRA * escala
}

function comVirgula(valor: number, decimais: number): string {
  return valor.toFixed(decimais).replace('.', ',')
}

interface Cartao {
  readonly carimbo: CarimboDaFolha
  readonly medidas: MedidasDoCarimbo
  readonly fora: readonly string[]
  /** Px do mundo por unidade no tamanho de mesa. */
  readonly t: number
  readonly grande: Janela
  readonly mesas: readonly Janela[]
  readonly grupos: readonly Janela[]
  readonly alturaDaLinha: number
  readonly larguraDaDireita: number
  readonly alturaDasJanelas: number
  readonly detalhes: string
  readonly linhaDasMedidas: string
  readonly largura: number
  readonly altura: number
}

function montarCartao(carimbo: CarimboDaFolha): Cartao {
  const { giros, medidas } = assarCarimbo(carimbo)
  const fora = foraDasMetas(medidas)
  const t = tamanhoNatural(unidadeDoRelevo(MAPA_DA_MESA), MAPA_DA_MESA.grid, carimbo.def.tamanho, 100)
  const escalaDoGrande = LADO_DA_ARTE / QUADRO_DA_BIBLIOTECA.lado / t
  const grande = janelaDosPostos([{ x: 0, y: 0, t, arte: giros[carimbo.variante], brilho: 1 }], escalaDoGrande)
  const mesa = janelaDosPostos([{ x: 0, y: 0, t, arte: giros[0], brilho: BRILHO_NA_MESA }], 1)
  const espaco = fatorDeEspaco(DENSIDADE_PADRAO) * t
  const grupo = janelaDosPostos(
    GRUPO.map((g) => ({ x: g.dx * espaco, y: g.dy * espaco, t: t * g.tamanho, arte: giros[g.variante], brilho: BRILHO_NA_MESA })),
    1,
  )
  // A mesma janela nos três chãos: só o chão muda.
  const mesas = CHAOS.map(() => mesa)
  const grupos = CHAOS.map(() => grupo)
  const alturaDaLinha = Math.max(mesa.h, grupo.h)
  const larguraDaDireita = mesa.w + FRESTA + grupo.w
  const alturaDaDireita = CHAOS.length * (LINHA + alturaDaLinha) + (CHAOS.length - 1) * FRESTA
  const alturaDasJanelas = Math.max(LINHA + grande.h, alturaDaDireita)
  const { def } = carimbo
  const ocupa = medidas.ocupa
  const casas = (u: number): string => comVirgula((u * t) / MAPA_DA_MESA.grid, 1)
  const detalhes = emLetrasDaFolha(
    `${def.id}, tamanho ${def.tamanho}, sombra ${def.sombra}${carimbo.brilho !== null ? ', com brilho' : ''}${ocupa === null ? '' : `, ocupa ${casas(ocupa.x1 - ocupa.x0)} x ${casas(ocupa.y1 - ocupa.y0)} casas`}${carimbo.novo ? '' : ', do catalogo'}`,
  )
  const linhaDasMedidas = emLetrasDaFolha(
    `sat ${comVirgula(medidas.saturacaoP95, 2)}, contorno ${comVirgula(medidas.contornoMinimo, 2)}, ${medidas.comandos} comandos, ${Math.round(medidas.ms)} ms, giros ${medidas.girosDiferentes}/8${fora.length > 0 ? `, fora ${fora.join(' + ')}` : ''}`,
  )
  const largura = Math.max(grande.w + VAO + larguraDaDireita, larguraDoTexto(def.nome, ESCALA_DO_NOME), larguraDoTexto(detalhes, ESCALA_DA_LETRA), larguraDoTexto(linhaDasMedidas, ESCALA_DA_LETRA))
  return {
    carimbo,
    medidas,
    fora,
    t,
    grande,
    mesas,
    grupos,
    alturaDaLinha,
    larguraDaDireita,
    alturaDasJanelas,
    detalhes,
    linhaDasMedidas,
    largura,
    altura: alturaDasJanelas + RESPIRO + LINHA_DO_NOME + LINHA * 2,
  }
}

/** A linha do carimbo no `.txt`: cada medida com a meta ao lado. */
function relatoDoCartao(c: Cartao): string {
  const { carimbo, medidas: m } = c
  const simOuNao = (sim: boolean): string => (sim ? 'sim' : 'não')
  const ocupa = m.ocupa
  const casas = (u: number): string => comVirgula((u * c.t) / MAPA_DA_MESA.grid, 2)
  return [
    `${carimbo.def.nome} (${carimbo.def.id}, tamanho ${carimbo.def.tamanho} = ${comVirgula(c.t, 1)} px por unidade no mapa de 200 x 200, sombra ${carimbo.def.sombra}${carimbo.brilho !== null ? ', com brilho' : ''})`,
    `8 desenhos em ${Math.round(m.ms)} ms no software (teto ${TETO_DO_TEMPO_MS})`,
    `comandos por desenho até ${m.comandos} (teto ${TETO_DE_COMANDOS}), vértices até ${m.vertices} (teto ${TETO_DE_VERTICES})`,
    `saturação p95 ${comVirgula(m.saturacaoP95, 3)} (teto ${comVirgula(TETO_DA_SATURACAO, 2)})`,
    `contorno ${comVirgula(m.contornoMinimo, 3)} (mínimo ${comVirgula(CONTORNO_MINIMO, 2)})`,
    `canal mais claro ${m.canalMaximo} (teto ${CANAL_MAXIMO}), saturação HSL das cores até ${comVirgula(m.saturacaoHsl, 2)} (teto ${comVirgula(TETO_DA_SATURACAO_HSL, 2)})`,
    `cores fora do css(): ${m.coresForaDoFormato.length === 0 ? 'nenhuma' : m.coresForaDoFormato.join(' ; ')}`,
    `giros diferentes ${m.girosDiferentes} de 8 (mínimo ${GIROS_DIFERENTES_MINIMOS})`,
    `repete igual: ${simOuNao(m.repete)}`,
    `números crus no quadro: ${m.foraDoQuadro > 0 ? `não, passa ${comVirgula(m.foraDoQuadro, 3)} unidade` : 'sim'}`,
    `cortado na borda da arte: ${simOuNao(m.cortado)}`,
    ocupa === null
      ? 'ocupa: nada opaco'
      : `ocupa x ${comVirgula(ocupa.x0, 2)} a ${comVirgula(ocupa.x1, 2)}, y ${comVirgula(ocupa.y0, 2)} a ${comVirgula(ocupa.y1, 2)} unidades = ${casas(ocupa.x1 - ocupa.x0)} x ${casas(ocupa.y1 - ocupa.y0)} casas`,
    c.fora.length > 0 ? `FORA DAS METAS: ${c.fora.join(' + ')}` : 'dentro das metas',
  ].join(' | ')
}

function desenharCartao(tela: Tela, c: Cartao, x: number, y: number, chaos: readonly Regiao[]): void {
  escrever(tela, 'GRANDE', x, y, ESCALA_DA_LETRA, APAGADA)
  desenharJanela(tela, c.grande, x, y + LINHA, c.grande.h, chaos[0])
  const xDaDireita = x + c.grande.w + VAO
  CHAOS.forEach((chao, k) => {
    const yDaLinha = y + k * (LINHA + c.alturaDaLinha + FRESTA)
    escrever(tela, `${chao.nome} MESA E GRUPO`, xDaDireita, yDaLinha, ESCALA_DA_LETRA, APAGADA)
    desenharJanela(tela, c.mesas[k], xDaDireita, yDaLinha + LINHA, c.alturaDaLinha, chaos[k])
    desenharJanela(tela, c.grupos[k], xDaDireita + c.mesas[k].w + FRESTA, yDaLinha + LINHA, c.alturaDaLinha, chaos[k])
  })
  const yDoNome = y + c.alturaDasJanelas + RESPIRO
  escrever(tela, emLetrasDaFolha(c.carimbo.def.nome), x, yDoNome, ESCALA_DO_NOME, TINTA)
  escrever(tela, c.detalhes, x, yDoNome + LINHA_DO_NOME, ESCALA_DA_LETRA, APAGADA)
  escrever(tela, c.linhaDasMedidas, x, yDoNome + LINHA_DO_NOME + LINHA, ESCALA_DA_LETRA, c.fora.length > 0 ? ALERTA : APAGADA)
}

function quebrarEmFileiras(cartoes: readonly Cartao[], limite: number): Cartao[][] {
  const fileiras: Cartao[][] = []
  let fileira: Cartao[] = []
  let largura = 0
  for (const cartao of cartoes) {
    const comEste = fileira.length === 0 ? cartao.largura : largura + VAO + cartao.largura
    if (fileira.length > 0 && comEste > limite) {
      fileiras.push(fileira)
      fileira = [cartao]
      largura = cartao.largura
    } else {
      fileira.push(cartao)
      largura = comEste
    }
  }
  if (fileira.length > 0) fileiras.push(fileira)
  return fileiras
}

function larguraDaFileira(fileira: readonly Cartao[]): number {
  return fileira.reduce((soma, c) => soma + c.largura, 0) + (fileira.length - 1) * VAO
}

function alturaDaFileira(fileira: readonly Cartao[]): number {
  return Math.max(...fileira.map((c) => c.altura))
}

/** As fileiras que deixam a folha mais perto de quadrada (quem lê por ferramenta recebe a imagem reduzida). */
function emFileiras(cartoes: readonly Cartao[]): Cartao[][] {
  const maisLargo = Math.max(...cartoes.map((c) => c.largura))
  let melhores: Cartao[][] = []
  let menorLado = Infinity
  for (const vezes of FILEIRAS_A_TENTAR) {
    const fileiras = quebrarEmFileiras(cartoes, maisLargo * vezes)
    const largura = Math.max(...fileiras.map(larguraDaFileira))
    const altura = fileiras.reduce((soma, fileira) => soma + VAO + alturaDaFileira(fileira), 0)
    if (Math.max(largura, altura) < menorLado) {
      melhores = fileiras
      menorLado = Math.max(largura, altura)
    }
  }
  return melhores
}

function montarFolha(cartoes: readonly Cartao[]): Tela {
  const fileiras = emFileiras(cartoes)
  const alturas = fileiras.map(alturaDaFileira)
  const largura = MARGEM * 2 + Math.max(...fileiras.map(larguraDaFileira), larguraDoTexto(CABECALHO, ESCALA_DA_LETRA))
  const altura = MARGEM * 2 + LINHA + alturas.reduce((soma, a) => soma + VAO + a, 0)
  const tela = novaTela(largura, altura, FUNDO)
  escrever(tela, CABECALHO, MARGEM, MARGEM, ESCALA_DA_LETRA, APAGADA)
  // Sem as manchas: é o padrão do mapa (`MapData.manchasDoChao` ausente).
  const chaos = CHAOS.map(({ id }) => pintarRegiao({ ...chaoDe(id, MAPA_DA_MESA), manchas: false }, 0, 0, PEDACOS_DO_CHAO, PEDACOS_DO_CHAO))
  let y = MARGEM + LINHA + VAO
  fileiras.forEach((fileira, f) => {
    let x = MARGEM
    for (const cartao of fileira) {
      desenharCartao(tela, cartao, x, y, chaos)
      x += cartao.largura + VAO
    }
    y += alturas[f] + VAO
  })
  return tela
}

/** O pedaço do Node que a folha usa, pelo `vi.importActual` (o projeto não tem `@types/node`). */
async function nodeDaFolha() {
  const fs = await vi.importActual<{
    readFileSync(caminho: string, codificacao: 'utf8'): string
    writeFileSync(caminho: string, dados: Uint8Array): void
    mkdirSync(caminho: string, opcoes: { recursive: true }): string | undefined
  }>('node:fs')
  const path = await vi.importActual<{ dirname(caminho: string): string; resolve(...partes: string[]): string }>('node:path')
  return { fs, path }
}

it.skipIf(!PEDIDA)('gera a folha de contato dos carimbos do pedido', { timeout: TETO_DA_FOLHA_MS }, async () => {
  if (typeof PEDIDO !== 'string') return
  const inicio = performance.now()
  const node = await nodeDaFolha()
  const caminhoDoPedido = node.path.resolve(PEDIDO)
  const pedido = lerPedido(node.fs.readFileSync(caminhoDoPedido, 'utf8'))
  const saida = node.path.resolve(node.path.dirname(caminhoDoPedido), pedido.saida)
  // Um carimbo por vez: o tempo de cada um é medido sem outro pintando junto.
  const cartoes: Cartao[] = []
  for (const item of pedido.itens) cartoes.push(montarCartao(await carimboDoItem(item)))
  const tela = montarFolha(cartoes)
  node.fs.mkdirSync(node.path.dirname(saida), { recursive: true })
  node.fs.writeFileSync(saida, emPng(tela))
  const relato = [
    ...cartoes.map((c, i) => `${i + 1}. ${relatoDoCartao(c)}`),
    `folha: ${saida} (${tela.largura} x ${tela.altura} px, ${cartoes.length} carimbos, chão em pedaços de ${LADO_DO_PEDACO} px, ${Math.round(performance.now() - inicio)} ms no total)`,
  ]
  node.fs.writeFileSync(saida.replace(TERMINA_EM_PNG, '.txt'), new TextEncoder().encode(`${relato.join('\n')}\n`))
  for (const linha of relato) console.log(linha)
})
