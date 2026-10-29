import { hash } from '../ruido'
import { ruidoDoMundo } from '../meioTermo/ruidoDoMundo'
import { LADO_DO_PEDACO, mipDoLadrilho, type ImagemDoLadrilho, type Pedaco } from '../meioTermo/chaoNoMundo'
import { TINGIR_PADRAO, rgbDoHex, type ContaDeTingir } from './tingir'

/**
 * O CHÃO DESENHADO (`godot/desenhado/CONTRATO.md` seções 3 e 4; referência:
 * `comum/compor.gdshader`, a mesa de prova): a conta do pacote, assada em
 * pedaços de 256 px como o `chaoNoMundo.ts` do Meio-Termo, para o mesmo cache
 * (`pixi/pedacosDoChao.ts`).
 *
 * - Base: base-1..3 (ladrilhos de 8 x 8 casas) misturadas pelo `ruidoDoMundo`
 *   numa escala longa, e o tom do mundo por cima. Por pixel, trilinear como o
 *   `texture()` com mipmap do Godot.
 * - Detalhes: o atlas espalhado pelo `hash` numa grade de meia célula (ou
 *   `passoCasas`), com grupos, espelho na diagonal e as 2 rodadas de
 *   afastamento. Cada centro é calculado UMA vez por pedaço; depois o atlas é
 *   desenhado por cima, na ordem do Godot (gy e depois gx).
 * - Piso (PROPOSTA-TINGIR.md): a base é cinza e, no fim, cada g vira a cor da
 *   rampa da sala (`tingir.ts`).
 *
 * As contas são em px do Desenhado (64 por casa). O mapa tem `grid` px de mundo
 * por casa: px do Desenhado = px do mundo · 64 / grid (`ChaoDesenhado.escala`).
 * Puro: sem canvas nem Pixi (a mesma conta roda no Node para comparar com a
 * imagem do Godot).
 */

/** px de imagem da base por casa (CONTRATO.md seção 3, `casaPx`). */
export const CASA_PX_DO_DESENHADO = 64

/** Os 18 chãos do pacote (onda 1): 16 cobrem uma textura do catálogo (o id é o mesmo), o caminho e o piso não. */
export const CHAOS_DO_DESENHADO = [
  'grama', 'grama-amarela', 'floresta', 'terra', 'caminho', 'chao-de-floresta', 'bosque', 'pinheiros', 'pantano',
  'areia', 'duna', 'pedra', 'neve', 'lajotas', 'lajotas-escuras', 'calcamento', 'conves', 'piso',
] as const
export type IdDoChaoDesenhado = (typeof CHAOS_DO_DESENHADO)[number]

const CHAOS: ReadonlySet<string> = new Set(CHAOS_DO_DESENHADO)
export function ehChaoDoDesenhado(id: string): id is IdDoChaoDesenhado {
  return CHAOS.has(id)
}

/**
 * A textura do catálogo do app que tem chão Desenhado: o `idDoApp` de cada
 * `textura.json` é o próprio id (conferido nos 16), e o caminho e o piso não
 * têm (`idDoApp: null`).
 */
export function chaoDesenhadoDoApp(idDoApp: string): IdDoChaoDesenhado | null {
  return ehChaoDoDesenhado(idDoApp) && idDoApp !== 'caminho' && idDoApp !== 'piso' ? idDoApp : null
}

export interface GruposDoDetalhe {
  readonly gradeCasas: number
  readonly chance: number
  readonly raioMin: number
  readonly raioMax: number
}

/** O `textura.json` de um chão, só com o que a montagem lê (CONTRATO.md seção 3). */
export interface TexturaDoChao {
  readonly id: string
  readonly base: { readonly arquivos: readonly string[]; readonly ladoPx: number; readonly periodoCasas: number }
  readonly mistura: { readonly semente: number; readonly escala: number; readonly faixa: number; readonly corte: number }
  readonly tom: { readonly semente: number; readonly escala: number; readonly amplitude: number }
  readonly detalhes: {
    readonly arquivo: string | null
    readonly colunas: number
    readonly linhas: number
    readonly pxPorCasa: number
    readonly celulaCasas: number
    readonly semente: number
    readonly quantos: number
    readonly pesos: readonly number[]
    readonly densidade: number
    readonly agrupamento: number
    readonly escalaMin: number
    readonly escalaMax: number
    readonly variacaoDeTom: number
    readonly afastarCasas: number | null
    readonly passoCasas: number | null
    readonly grupos: GruposDoDetalhe | null
    readonly espelhar: boolean
  }
  readonly corMedia: string
  /** O bloco `tingir` (o piso): `null` = a textura tem cor própria. */
  readonly tingir: ContaDeTingir | null
}

// ---------- leitura do textura.json (dado de fora: confere cada campo) ----------

export function campo(o: unknown, k: string): unknown {
  return typeof o === 'object' && o !== null && k in o ? Reflect.get(o, k) : undefined
}

export function numero(o: unknown, k: string): number | null {
  const v = campo(o, k)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function texto(o: unknown, k: string): string | null {
  const v = campo(o, k)
  return typeof v === 'string' ? v : null
}

export function numeros(o: unknown, k: string): number[] | null {
  const v = campo(o, k)
  if (!Array.isArray(v)) return null
  const lista: number[] = []
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return null
    lista.push(x)
  }
  return lista
}

export function textos(o: unknown, k: string): string[] | null {
  const v = campo(o, k)
  if (!Array.isArray(v)) return null
  const lista: string[] = []
  for (const x of v) {
    if (typeof x !== 'string') return null
    lista.push(x)
  }
  return lista
}

export function lerTingir(bruto: unknown): ContaDeTingir | null {
  if (bruto === undefined || bruto === null) return null
  const neutro = numero(bruto, 'neutro')
  const ganhoL = numero(bruto, 'ganhoL')
  const escuroAte = numero(bruto, 'escuroAte')
  const claroDesde = numero(bruto, 'claroDesde')
  if (neutro === null || ganhoL === null || escuroAte === null || claroDesde === null) return TINGIR_PADRAO
  return { neutro, ganhoL, escuroAte, claroDesde }
}

function lerGrupos(bruto: unknown): GruposDoDetalhe | null {
  if (bruto === undefined || bruto === null) return null
  const gradeCasas = numero(bruto, 'gradeCasas')
  const chance = numero(bruto, 'chance')
  const raioMin = numero(bruto, 'raioMin')
  const raioMax = numero(bruto, 'raioMax')
  if (gradeCasas === null || chance === null || raioMin === null || raioMax === null) return null
  return { gradeCasas, chance, raioMin, raioMax }
}

/** O `textura.json` lido e conferido; campo faltando ou de outro tipo = `null` (o chão fica no Atual). */
export function lerTexturaDoChao(bruto: unknown): TexturaDoChao | null {
  const id = texto(bruto, 'id')
  const corMedia = texto(bruto, 'corMedia')
  if (id === null || corMedia === null || numero(bruto, 'contrato') !== 1) return null
  const base = campo(bruto, 'base')
  const arquivos = textos(base, 'arquivos')
  const ladoPx = numero(base, 'ladoPx')
  const periodoCasas = numero(base, 'periodoCasas')
  const m = campo(bruto, 'mistura')
  const t = campo(bruto, 'tom')
  const d = campo(bruto, 'detalhes')
  const mistura = { semente: numero(m, 'semente'), escala: numero(m, 'escala'), faixa: numero(m, 'faixa'), corte: numero(m, 'corte') }
  const tom = { semente: numero(t, 'semente'), escala: numero(t, 'escala'), amplitude: numero(t, 'amplitude') }
  const pesos = numeros(d, 'pesos')
  const arquivoBruto = campo(d, 'arquivo')
  const arquivo = typeof arquivoBruto === 'string' ? arquivoBruto : null
  const n = {
    colunas: numero(d, 'colunas'), linhas: numero(d, 'linhas'), pxPorCasa: numero(d, 'pxPorCasa'), celulaCasas: numero(d, 'celulaCasas'),
    semente: numero(d, 'semente'), quantos: numero(d, 'quantos'), densidade: numero(d, 'densidade'), agrupamento: numero(d, 'agrupamento'),
    escalaMin: numero(d, 'escalaMin'), escalaMax: numero(d, 'escalaMax'), variacaoDeTom: numero(d, 'variacaoDeTom'),
  }
  if (arquivos === null || arquivos.length === 0 || ladoPx === null || periodoCasas === null || pesos === null) return null
  if (mistura.semente === null || mistura.escala === null || mistura.faixa === null || mistura.corte === null) return null
  if (tom.semente === null || tom.escala === null || tom.amplitude === null) return null
  if (n.colunas === null || n.linhas === null || n.pxPorCasa === null || n.celulaCasas === null || n.semente === null || n.quantos === null) return null
  if (n.densidade === null || n.agrupamento === null || n.escalaMin === null || n.escalaMax === null || n.variacaoDeTom === null) return null
  return {
    id,
    base: { arquivos, ladoPx, periodoCasas },
    mistura: { semente: mistura.semente, escala: mistura.escala, faixa: mistura.faixa, corte: mistura.corte },
    tom: { semente: tom.semente, escala: tom.escala, amplitude: tom.amplitude },
    detalhes: {
      arquivo,
      colunas: n.colunas, linhas: n.linhas, pxPorCasa: n.pxPorCasa, celulaCasas: n.celulaCasas, semente: n.semente, quantos: n.quantos,
      pesos, densidade: n.densidade, agrupamento: n.agrupamento, escalaMin: n.escalaMin, escalaMax: n.escalaMax, variacaoDeTom: n.variacaoDeTom,
      afastarCasas: numero(d, 'afastarCasas'),
      passoCasas: numero(d, 'passoCasas'),
      grupos: lerGrupos(campo(d, 'grupos')),
      espelhar: campo(d, 'espelhar') === true,
    },
    corMedia,
    tingir: lerTingir(campo(bruto, 'tingir')),
  }
}

// ---------- a montagem ----------

/** Um chão Desenhado pronto para pintar pedaços. */
export interface ChaoDesenhado {
  readonly tipo: 'desenhado'
  readonly textura: TexturaDoChao
  /** base-1..3, RGBA (o alfa é 255), quadradas. */
  readonly bases: readonly ImagemDoLadrilho[]
  /** O atlas em RGBA PRÉ-MULTIPLICADO (a tela 2D guarda assim; a mistura fica sem franja). `null` = sem detalhes. */
  readonly atlas: ImagemDoLadrilho | null
  /** px do Desenhado por px do mundo do mapa (64 / grid). */
  readonly escala: number
  /** Piso: a rampa da cor da sala (`tingir.ts`), 256 x RGB; `null` = a cor da própria textura. */
  readonly rampa: Uint8Array | null
}

/** Um detalhe que cai no pedaço: o centro já afastado, a escala, o espelho, a célula do atlas e o tom. */
interface DetalheNoPedaco {
  readonly cx: number
  readonly cy: number
  readonly esc: number
  readonly espelho: boolean
  readonly celX: number
  readonly celY: number
  readonly tom: number
  /** Linhas e colunas do pedaço que ele cobre (inclusivas). */
  readonly py0: number
  readonly py1: number
  readonly px0: number
  readonly px1: number
}

export interface PinturaDesenhada {
  readonly pixels: Uint8ClampedArray
  readonly detalhes: readonly DetalheNoPedaco[]
  linha: number
}

function suave(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Os níveis de mip de uma imagem até `ate` (0 = ela mesma). */
function mips(img: ImagemDoLadrilho, ate: number): ImagemDoLadrilho[] {
  const lista: ImagemDoLadrilho[] = []
  for (let m = 0; m <= ate; m += 1) lista.push(mipDoLadrilho(img, m))
  return lista
}

/** Bilinear em `uv` (fração da imagem), centros de texel em +0,5, dando a volta (`repetir`) ou presa na borda; soma `peso` x amostra em `saida`. */
function somarBilinear(img: ImagemDoLadrilho, u: number, v: number, repetir: boolean, peso: number, saida: Float64Array): void {
  const L = img.lado
  const x = u * L - 0.5
  const y = v * L - 0.5
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  let x0: number
  let x1: number
  let y0: number
  let y1: number
  if (repetir) {
    x0 = ((ix % L) + L) % L
    x1 = x0 + 1 === L ? 0 : x0 + 1
    y0 = ((iy % L) + L) % L
    y1 = y0 + 1 === L ? 0 : y0 + 1
  } else {
    x0 = Math.min(Math.max(ix, 0), L - 1)
    x1 = Math.min(Math.max(ix + 1, 0), L - 1)
    y0 = Math.min(Math.max(iy, 0), L - 1)
    y1 = Math.min(Math.max(iy + 1, 0), L - 1)
  }
  const p = img.pixels
  const a = (y0 * L + x0) * 4
  const b = (y0 * L + x1) * 4
  const c = (y1 * L + x0) * 4
  const d = (y1 * L + x1) * 4
  const wa = (1 - fx) * (1 - fy) * peso
  const wb = fx * (1 - fy) * peso
  const wc = (1 - fx) * fy * peso
  const wd = fx * fy * peso
  for (let k = 0; k < 4; k += 1) saida[k] += p[a + k] * wa + p[b + k] * wb + p[c + k] * wc + p[d + k] * wd
}

/** Trilinear (como o `filter_linear_mipmap` do Godot): mistura os dois mips em volta de `lod`; soma em `saida` (0..255). */
function somarTrilinear(niveis: readonly ImagemDoLadrilho[], lod: number, u: number, v: number, repetir: boolean, peso: number, saida: Float64Array): void {
  const ultimo = niveis.length - 1
  const l = Math.min(Math.max(lod, 0), ultimo)
  const m0 = Math.floor(l)
  const f = l - m0
  if (f < 1e-4 || m0 >= ultimo) {
    somarBilinear(niveis[m0], u, v, repetir, peso, saida)
    return
  }
  somarBilinear(niveis[m0], u, v, repetir, peso * (1 - f), saida)
  somarBilinear(niveis[m0 + 1], u, v, repetir, peso * f, saida)
}

/** O peso da textura i no sorteio (`escolher_detalhe` do compor.gdshader). */
function escolherDetalhe(t: TexturaDoChao, r: number): number {
  const n = Math.min(t.detalhes.quantos, t.detalhes.pesos.length)
  let total = 0
  for (let k = 0; k < n; k += 1) total += Math.max(t.detalhes.pesos[k], 0)
  const alvo = r * Math.max(total, 1e-6)
  let soma = 0
  for (let k = 0; k < n; k += 1) {
    soma += Math.max(t.detalhes.pesos[k], 0)
    if (alvo < soma) return k
  }
  return Math.max(n - 1, 0)
}

/** O aglomerado da célula de centro (cx, cy), de -1 a 1 (`aglomerado_em`). */
function aglomerado(t: TexturaDoChao, cx: number, cy: number): number {
  const d = t.detalhes
  const g = d.grupos
  if (g === null) return ruidoDoMundo(cx, cy, d.semente + 50)
  const G = g.gradeCasas * CASA_PX_DO_DESENHADO
  const bx0 = Math.floor(cx / G)
  const by0 = Math.floor(cy / G)
  let m = 0
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      const bx = bx0 + i
      const by = by0 + j
      if (hash(bx, by, d.semente + 60) >= g.chance) continue
      const ox = (bx + 0.2 + 0.6 * hash(bx, by, d.semente + 61)) * G
      const oy = (by + 0.2 + 0.6 * hash(bx, by, d.semente + 62)) * G
      const r = (g.raioMin + (g.raioMax - g.raioMin) * hash(bx, by, d.semente + 63)) * G
      m = Math.max(m, 1 - suave(0.55 * r, r, Math.hypot(cx - ox, cy - oy)))
    }
  }
  return 2 * m - 1
}

/** A grade do espalhamento: o passo (px do Desenhado), a chance por célula e o teto dela. */
function gradeDosDetalhes(t: TexturaDoChao): { passo: number; meia: number; porCelula: number; teto: number } {
  const d = t.detalhes
  const meia = 32 * d.celulaCasas
  let passo = 32 * d.celulaCasas
  let porCelula = d.densidade * 0.25 * d.celulaCasas * d.celulaCasas
  if (d.passoCasas !== null && d.passoCasas > 0) {
    passo = CASA_PX_DO_DESENHADO * d.passoCasas
    porCelula = d.densidade * d.passoCasas * d.passoCasas
  }
  const teto = Math.min(Math.max(porCelula * (1 + 2 * d.agrupamento), 0), 0.85)
  return { passo, meia, porCelula, teto }
}

/** O centro sorteado da célula (gx, gy), se ela tem detalhe (`candidata` do compor.gdshader). */
function candidata(t: TexturaDoChao, gx: number, gy: number, passo: number, porCelula: number, teto: number): [number, number] | null {
  const d = t.detalhes
  const r0 = hash(gx, gy, d.semente)
  if (r0 >= teto) return null
  const a = aglomerado(t, (gx + 0.5) * passo, (gy + 0.5) * passo)
  const p = Math.min(Math.max(porCelula * (1 + d.agrupamento * 2 * a), 0), 0.85)
  if (r0 >= p) return null
  return [(gx + hash(gx, gy, d.semente + 1)) * passo, (gy + hash(gx, gy, d.semente + 2)) * passo]
}

/** Metade do que falta para a e b ficarem a `dmin` (`empurrao`); centros iguais: a direção das células, de b para a. */
function empurrao(ax: number, ay: number, bx: number, by: number, dx: number, dy: number, dmin: number, saida: [number, number]): void {
  const vx = ax - bx
  const vy = ay - by
  const d = Math.hypot(vx, vy)
  if (d >= dmin) return
  let ux: number
  let uy: number
  if (d < 1e-3) {
    const n = Math.hypot(dx, dy)
    ux = dx / n
    uy = dy / n
  } else {
    ux = vx / d
    uy = vy / d
  }
  saida[0] += ux * (dmin - d) * 0.5
  saida[1] += uy * (dmin - d) * 0.5
}

function limitar(v: [number, number], lim: number): void {
  const m = Math.hypot(v[0], v[1])
  if (m > lim) {
    v[0] *= lim / m
    v[1] *= lim / m
  }
}

/** O retângulo do pedaço em px do Desenhado e quantos px do Desenhado cada pixel do pedaço cobre. */
function janelaDoPedaco(chao: ChaoDesenhado, pedaco: Pedaco): { x0: number; y0: number; d: number } {
  const passoNoMundo = 2 ** pedaco.nivel
  return {
    x0: pedaco.i * LADO_DO_PEDACO * passoNoMundo * chao.escala,
    y0: pedaco.j * LADO_DO_PEDACO * passoNoMundo * chao.escala,
    d: passoNoMundo * chao.escala,
  }
}

/** Os detalhes que caem no pedaço, já afastados, na ordem do desenho (gy e depois gx). */
function detalhesDoPedaco(chao: ChaoDesenhado, pedaco: Pedaco): DetalheNoPedaco[] {
  const t = chao.textura
  const d = t.detalhes
  if (chao.atlas === null || d.quantos <= 0 || d.arquivo === null) return []
  const { passo, meia, porCelula, teto } = gradeDosDetalhes(t)
  const { x0, y0, d: px } = janelaDoPedaco(chao, pedaco)
  const lado = LADO_DO_PEDACO * px
  const dmin = d.afastarCasas !== null && d.afastarCasas > 0 ? d.afastarCasas * CASA_PX_DO_DESENHADO : 0
  const alcance = meia * d.escalaMax + dmin / 2
  const gxA = Math.floor((x0 - alcance) / passo)
  const gxB = Math.floor((x0 + lado + alcance) / passo)
  const gyA = Math.floor((y0 - alcance) / passo)
  const gyB = Math.floor((y0 + lado + alcance) / passo)
  // c0 com 2 células de folga (as vizinhas das vizinhas, para a rodada 2).
  const F = dmin > 0 ? 2 : 0
  const W = gxB - gxA + 1 + 2 * F
  const H = gyB - gyA + 1 + 2 * F
  const c0: ([number, number] | null)[] = new Array(W * H)
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) c0[j * W + i] = candidata(t, gxA - F + i, gyA - F + j, passo, porCelula, teto)
  let centros: ([number, number] | null)[] = c0
  if (dmin > 0) {
    const lim = 0.5 * dmin
    const rodada = (de: ([number, number] | null)[]): ([number, number] | null)[] => {
      const nova: ([number, number] | null)[] = new Array(W * H).fill(null)
      for (let j = 1; j < H - 1; j += 1) {
        for (let i = 1; i < W - 1; i += 1) {
          const a0 = c0[j * W + i]
          const a = de[j * W + i]
          if (a0 === null || a === null) continue
          // Desloca a partir do anterior: rodada 1 soma em c0, rodada 2 soma (c1 - c0) e os empurrões em c1.
          const desl: [number, number] = [a[0] - a0[0], a[1] - a0[1]]
          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              if (ox === 0 && oy === 0) continue
              const b = de[(j + oy) * W + i + ox]
              if (b === null || c0[(j + oy) * W + i + ox] === null) continue
              empurrao(a[0], a[1], b[0], b[1], -ox, -oy, dmin, desl)
            }
          }
          limitar(desl, lim)
          nova[j * W + i] = [a0[0] + desl[0], a0[1] + desl[1]]
        }
      }
      return nova
    }
    centros = rodada(rodada(c0))
  }
  const lista: DetalheNoPedaco[] = []
  for (let gy = gyA; gy <= gyB; gy += 1) {
    for (let gx = gxA; gx <= gxB; gx += 1) {
      const k = (gy - gyA + F) * W + (gx - gxA + F)
      const c = centros[k]
      if (c === null) continue
      const esc = d.escalaMin + (d.escalaMax - d.escalaMin) * hash(gx, gy, d.semente + 4)
      const meiaNoMundo = meia * esc
      const px0 = Math.max(0, Math.floor((c[0] - meiaNoMundo - x0) / px))
      const px1 = Math.min(LADO_DO_PEDACO - 1, Math.floor((c[0] + meiaNoMundo - x0) / px))
      const py0 = Math.max(0, Math.floor((c[1] - meiaNoMundo - y0) / px))
      const py1 = Math.min(LADO_DO_PEDACO - 1, Math.floor((c[1] + meiaNoMundo - y0) / px))
      if (px1 < px0 || py1 < py0) continue
      const i = escolherDetalhe(t, hash(gx, gy, d.semente + 3))
      lista.push({
        cx: c[0],
        cy: c[1],
        esc,
        espelho: d.espelhar && hash(gx, gy, d.semente + 6) < 0.5,
        celX: i % d.colunas,
        celY: Math.floor(i / d.colunas),
        tom: 1 + d.variacaoDeTom * (2 * hash(gx, gy, d.semente + 5) - 1),
        px0,
        px1,
        py0,
        py1,
      })
    }
  }
  return lista
}

/**
 * ZOOM MUITO PEQUENO (CONTRATO.md seção 3, `corMedia`): com este tanto de px do
 * Desenhado (meia casa) ou mais por pixel do pedaço, a casa cabe em 2 pixels e o
 * desenho vira só ruído; o pedaço sai na cor média da base-1, sem ruído e sem
 * detalhes (que, nesse nível, seriam dezenas de milhares por pedaço). Com o zoom
 * mínimo da tela (10%) não chega: vale para a imagem inteira de um mapa enorme.
 */
const PX_DO_DESENHADO_DA_COR_MEDIA = 32

function naCorMedia(chao: ChaoDesenhado, pedaco: Pedaco): boolean {
  return janelaDoPedaco(chao, pedaco).d >= PX_DO_DESENHADO_DA_COR_MEDIA
}

/** As linhas até `fim` na cor média (no piso, a rampa da sala no valor da cor média, que é cinza). */
function pintarCorMedia(chao: ChaoDesenhado, p: PinturaDesenhada, fim: number): void {
  const rgb = rgbDoHex(chao.textura.corMedia) ?? [128, 128, 128]
  const { rampa } = chao
  const g = rgb[0] * 3
  const r = rampa === null ? rgb[0] : rampa[g]
  const v = rampa === null ? rgb[1] : rampa[g + 1]
  const b = rampa === null ? rgb[2] : rampa[g + 2]
  for (let o = p.linha * LADO_DO_PEDACO * 4; o < fim * LADO_DO_PEDACO * 4; o += 4) {
    p.pixels[o] = r
    p.pixels[o + 1] = v
    p.pixels[o + 2] = b
    p.pixels[o + 3] = 255
  }
  p.linha = fim
}

export function comecarPedacoDesenhado(chao: ChaoDesenhado, pedaco: Pedaco): PinturaDesenhada {
  const detalhes = naCorMedia(chao, pedaco) ? [] : detalhesDoPedaco(chao, pedaco)
  return { pixels: new Uint8ClampedArray(LADO_DO_PEDACO * LADO_DO_PEDACO * 4), detalhes, linha: 0 }
}

/** Mips guardados por imagem (base e atlas), para não montar a lista a cada linha. */
const niveisGuardados = new WeakMap<ImagemDoLadrilho, ImagemDoLadrilho[]>()
/** Até o mip de lado 4 (o `mipDoLadrilho` para nele). */
function niveisDe(img: ImagemDoLadrilho): ImagemDoLadrilho[] {
  let n = niveisGuardados.get(img)
  if (n === undefined) {
    n = mips(img, Math.max(0, Math.round(Math.log2(img.lado / 4))))
    niveisGuardados.set(img, n)
  }
  return n
}

/**
 * Pinta as linhas do pedaço até `ate` (exclusivo). Pintar em fatias de linhas
 * dá os mesmos bytes de pintar de uma vez: cada linha é a base dela e os
 * detalhes que a cruzam, em float, arredondada uma vez só no fim (como o Godot).
 */
export function pintarLinhasDesenhado(chao: ChaoDesenhado, pedaco: Pedaco, p: PinturaDesenhada, ate: number): void {
  const fim = Math.min(LADO_DO_PEDACO, ate)
  if (p.linha >= fim) return
  const t = chao.textura
  const { x0, y0, d } = janelaDoPedaco(chao, pedaco)
  if (d >= PX_DO_DESENHADO_DA_COR_MEDIA) {
    pintarCorMedia(chao, p, fim)
    return
  }
  const periodo = t.base.periodoCasas * CASA_PX_DO_DESENHADO
  const niveisDaBase = chao.bases.map(niveisDe)
  const variantes = niveisDaBase.length
  // Texels da base por px do Desenhado (1 com a base de 512 px em 8 casas) vezes px do Desenhado por pixel do pedaço.
  const lodDaBase = Math.log2(Math.max((t.base.ladoPx / periodo) * d, 1e-6))
  const { meia } = gradeDosDetalhes(t)
  const atlas = chao.atlas === null ? null : niveisDe(chao.atlas)
  const colunas = t.detalhes.colunas
  const linhas = t.detalhes.linhas
  const texelDoAtlas = (t.detalhes.pxPorCasa / CASA_PX_DO_DESENHADO) * d
  const m = t.mistura
  const tom = t.tom
  const rampa = chao.rampa
  const cor = new Float64Array(LADO_DO_PEDACO * 3)
  const amostra = new Float64Array(4)
  const pesos = [0, 0, 0]
  for (let py = p.linha; py < fim; py += 1) {
    const wy = y0 + (py + 0.5) * d
    for (let px = 0; px < LADO_DO_PEDACO; px += 1) {
      const wx = x0 + (px + 0.5) * d
      const n = ruidoDoMundo(wx / m.escala, wy / m.escala, m.semente)
      if (variantes <= 1) {
        pesos[0] = 1
        pesos[1] = 0
        pesos[2] = 0
      } else if (variantes === 2) {
        const s = suave(-m.faixa, m.faixa, n)
        pesos[0] = 1 - s
        pesos[1] = s
        pesos[2] = 0
      } else {
        const w1 = 1 - suave(-m.corte - m.faixa, -m.corte + m.faixa, n)
        const w3 = suave(m.corte - m.faixa, m.corte + m.faixa, n)
        pesos[0] = w1
        pesos[1] = Math.max(1 - w1 - w3, 0)
        pesos[2] = w3
      }
      amostra.fill(0)
      for (let k = 0; k < variantes && k < 3; k += 1) {
        if (pesos[k] > 0) somarTrilinear(niveisDaBase[k], lodDaBase, wx / periodo, wy / periodo, true, pesos[k], amostra)
      }
      const fator = (1 + tom.amplitude * ruidoDoMundo(wx / tom.escala, wy / tom.escala, tom.semente)) / 255
      const o = px * 3
      cor[o] = amostra[0] * fator
      cor[o + 1] = amostra[1] * fator
      cor[o + 2] = amostra[2] * fator
    }
    if (atlas !== null) {
      for (const det of p.detalhes) {
        if (py < det.py0 || py > det.py1) continue
        const lod = Math.log2(Math.max(texelDoAtlas / det.esc, 1e-6))
        for (let px = det.px0; px <= det.px1; px += 1) {
          const wx = x0 + (px + 0.5) * d
          let qx = (wx - det.cx) / det.esc
          let qy = (wy - det.cy) / det.esc
          if (det.espelho) {
            const troca = qx
            qx = qy
            qy = troca
          }
          if (Math.abs(qx) >= meia || Math.abs(qy) >= meia) continue
          const u = (det.celX + qx / (2 * meia) + 0.5) / colunas
          const v = (det.celY + qy / (2 * meia) + 0.5) / linhas
          amostra.fill(0)
          somarTrilinear(atlas, lod, u, v, false, 1, amostra)
          const a = amostra[3] / 255
          if (a <= 0) continue
          const o = px * 3
          // Pré-multiplicado: c = c · (1 − a) + rgb · a · tom.
          cor[o] = cor[o] * (1 - a) + (amostra[0] / 255) * det.tom
          cor[o + 1] = cor[o + 1] * (1 - a) + (amostra[1] / 255) * det.tom
          cor[o + 2] = cor[o + 2] * (1 - a) + (amostra[2] / 255) * det.tom
        }
      }
    }
    const linha = py * LADO_DO_PEDACO * 4
    for (let px = 0; px < LADO_DO_PEDACO; px += 1) {
      const o = px * 3
      const destino = linha + px * 4
      if (rampa !== null) {
        // Piso: a base é cinza (R = G = B); o g vira a cor da rampa da sala.
        const g = Math.min(Math.max(Math.round(Math.min(Math.max(cor[o], 0), 1) * 255), 0), 255) * 3
        p.pixels[destino] = rampa[g]
        p.pixels[destino + 1] = rampa[g + 1]
        p.pixels[destino + 2] = rampa[g + 2]
      } else {
        p.pixels[destino] = Math.min(Math.max(cor[o], 0), 1) * 255
        p.pixels[destino + 1] = Math.min(Math.max(cor[o + 1], 0), 1) * 255
        p.pixels[destino + 2] = Math.min(Math.max(cor[o + 2], 0), 1) * 255
      }
      p.pixels[destino + 3] = 255
    }
  }
  p.linha = fim
}

/** O pedaço inteiro de uma vez (a comparação com o Godot e a folha). */
export function pintarPedacoDesenhado(chao: ChaoDesenhado, pedaco: Pedaco): Uint8ClampedArray {
  const p = comecarPedacoDesenhado(chao, pedaco)
  pintarLinhasDesenhado(chao, pedaco, p, LADO_DO_PEDACO)
  return p.pixels
}
