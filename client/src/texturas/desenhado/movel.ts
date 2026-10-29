/**
 * O MÓVEL DESENHADO QUE PEGA COR (plano de 29/10/2026, F3; CONTRATO.md seção 10):
 * a conta de `godot/desenhado/ferramentas/movel.ts` (a referência, que a mesa de
 * prova do pacote usa) trazida para o app, sem I/O e em passos.
 *
 * Por móvel o pacote entrega, a 128 px por casa, por forma `<vista>-<variante>-<virada>`:
 * o valor (R = G = B, 0,5 = o tom do material; A a cobertura), as partes (R, G, B =
 * o peso dos lugares 1, 2 e 3) e, no móvel de cor própria, a cor. A conta:
 *   1. a variante (`varianteDoPedido`: a opção do lugar, a forma do objeto, a variação do id);
 *   2. o quarto de volta k = round(giro / 90) mod 4 vem PINTADO (`formaDaVirada`); a tela gira
 *      só o resto, de -45 a 45 graus;
 *   3. o tingir por parte com a rampa OKLab do tom (`rampaDoTom`; a pedra com menos croma
 *      no escuro, `rampaDaOpcao`);
 *   4. o esticar: ponta + meio liso + ponta, o meio que repete, o centro fixo (`mapearEixo`);
 *   5. a sombra pela silhueta (desfocada, na direção (7, 11)).
 * A cerca por peças (10.12) é `planejarCerca` / `pintarCerca`, na geometria do app.
 *
 * Tudo em passos (`Generator`): o raster dos móveis anda uma linha por vez nas fatias de
 * 8 ms dele, então abrir um mapa com muitos móveis diferentes não trava a tela. A conta é
 * a mesma da referência número por número (a mesa de prova confere o app contra ela).
 */

export const PX_POR_CASA = 128

export type Rgb = readonly [number, number, number]
export type Vista = 'frente' | 'lado'

export interface Esticar {
  readonly eixo: 'x' | 'xy'
  readonly pontasCasas: readonly [number, number]
  readonly pontasCasasY: readonly [number, number] | null
  readonly ladoMaior: boolean
  readonly periodoCasas?: number
  readonly centroCasas?: number
  readonly centroCasasY?: number
}

export interface VistaDoMovel {
  readonly casas: readonly [number, number]
  readonly viradas: 1 | 2 | 4
  readonly esticar?: Esticar
}

export interface FormaDoMovel {
  readonly nome: string
  readonly vista: Vista
  readonly variante: string
  readonly virada: number
  readonly casas: readonly [number, number]
  readonly valor: string
  readonly partes: string
  readonly cor?: string
  readonly larguraPx: number
  readonly alturaPx: number
}

export interface Rampa {
  readonly escuro: readonly (readonly [number, number])[]
  readonly claro: readonly (readonly [number, number])[]
  readonly cromaNaSombra: number
  readonly amareloNaLuz: number
  readonly cromaNaLuz: number
  readonly escuroAte: number
  readonly claroDesde: number
}

/** A cerca por peças (só a cerca; CONTRATO 10.12). */
export interface PecasDaCerca {
  readonly mouraoCasas: readonly [number, number]
  readonly raioCasas: number
  readonly colunaCasas: number
  readonly viradaDaLuz: number
}

export interface VarianteDoMovel {
  readonly nome: string
  readonly quando: Readonly<Record<string, string>>
  readonly vistas?: Readonly<Partial<Record<Vista, VistaDoMovel>>>
}

export interface SombraDoMovel {
  readonly jeito: 'deslocada' | 'nenhuma'
  readonly direcao: readonly [number, number]
  readonly deslocamentoCasas: number
  readonly borraoCasas: number
  readonly alfa: number
  readonly cor: Rgb
}

export interface ParamsDoMovel {
  readonly id: string
  readonly idDoApp: string
  readonly margemCasas: number
  readonly lugares: readonly string[]
  readonly variantes: readonly VarianteDoMovel[]
  readonly vistas: Readonly<Partial<Record<Vista, VistaDoMovel>>>
  readonly formas: readonly FormaDoMovel[]
  readonly sombra: SombraDoMovel
  readonly tingir: Rampa
  readonly pecas?: PecasDaCerca
  /** Teto de memória decodificada de uma vista (CONTRATO 10.1, item 6). */
  readonly tetoPorVista: number
}

/** Uma imagem do pacote em RGBA, alfa reto (como a tela 2D devolve). */
export interface ImagemDoPacote {
  readonly w: number
  readonly h: number
  readonly px: Uint8ClampedArray
}

export interface MovelCarregado {
  readonly p: ParamsDoMovel
  /** Pelo nome do arquivo; só as formas da vista que o mapa usa. */
  readonly imagens: ReadonlyMap<string, ImagemDoPacote>
}

/** A geometria da cerca do app (`geometriaDaCerca`), em casas, no referencial do objeto, sem o giro. */
export interface GeometriaDaCercaEmCasas {
  readonly mouroes: readonly { readonly x: number; readonly y: number }[]
  readonly arco: { readonly center: { readonly x: number; readonly y: number }; readonly radius: number; readonly startAngle: number; readonly sweep: number } | null
}

export interface Pedido {
  readonly vista: Vista
  /** A opção de cada lugar, na ordem de `p.lugares`. */
  readonly opcoes: readonly string[]
  /** O tom (RGB 0..255) de cada lugar; "mesma" e "varas" já resolvidas para a madeira. */
  readonly tons: readonly Rgb[]
  /** A pegada SEM giro, em casas. */
  readonly casasW: number
  readonly casasH: number
  /** O giro do objeto, em graus. */
  readonly giro: number
  readonly forma?: string
  readonly variacao?: number
  readonly cerca?: GeometriaDaCercaEmCasas
}

/** RGBA pré-multiplicado, 0..255, em float. */
export interface Camada {
  readonly w: number
  readonly h: number
  readonly px: Float32Array
}

// ---------- leitura do textura.json (dado de fora: confere cada campo) ----------

function campo(o: unknown, k: string): unknown {
  return typeof o === 'object' && o !== null && k in o ? Reflect.get(o, k) : undefined
}

function numero(o: unknown, k: string): number | null {
  const v = campo(o, k)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function texto(o: unknown, k: string): string | null {
  const v = campo(o, k)
  return typeof v === 'string' ? v : null
}

function par(o: unknown, k: string): [number, number] | null {
  const v = campo(o, k)
  if (!Array.isArray(v) || v.length !== 2) return null
  const [a, b]: unknown[] = v
  return typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null
}

function nos(o: unknown, k: string): [number, number][] | null {
  const v = campo(o, k)
  if (!Array.isArray(v) || v.length < 2) return null
  const lista: [number, number][] = []
  for (let i = 0; i < v.length; i += 1) {
    const p = par(v, String(i))
    if (p === null) return null
    lista.push(p)
  }
  return lista
}

const COR_HEX = /^#[0-9a-f]{6}$/i

export function rgbDoHex(hex: string): Rgb {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function lerEsticar(bruto: unknown): Esticar | null | undefined {
  if (bruto === undefined) return undefined
  const eixo = texto(bruto, 'eixo')
  const pontas = par(bruto, 'pontasCasas')
  const pontasY = campo(bruto, 'pontasCasasY') === null || campo(bruto, 'pontasCasasY') === undefined ? null : par(bruto, 'pontasCasasY')
  if ((eixo !== 'x' && eixo !== 'xy') || pontas === null) return null
  const periodo = numero(bruto, 'periodoCasas')
  const centro = numero(bruto, 'centroCasas')
  const centroY = numero(bruto, 'centroCasasY')
  return {
    eixo,
    pontasCasas: pontas,
    pontasCasasY: pontasY,
    ladoMaior: campo(bruto, 'ladoMaior') === true,
    ...(periodo !== null && periodo > 0 ? { periodoCasas: periodo } : {}),
    ...(centro !== null && centro > 0 ? { centroCasas: centro } : {}),
    ...(centroY !== null && centroY > 0 ? { centroCasasY: centroY } : {}),
  }
}

function lerVista(bruto: unknown): VistaDoMovel | null | undefined {
  if (bruto === undefined) return undefined
  const casas = par(bruto, 'casas')
  const viradas = numero(bruto, 'viradas')
  const esticar = lerEsticar(campo(bruto, 'esticar'))
  if (casas === null || !(casas[0] > 0 && casas[1] > 0) || (viradas !== 1 && viradas !== 2 && viradas !== 4) || esticar === null) return null
  return { casas, viradas, ...(esticar !== undefined ? { esticar } : {}) }
}

function lerVistas(bruto: unknown): Partial<Record<Vista, VistaDoMovel>> | null {
  const frente = lerVista(campo(bruto, 'frente'))
  const lado = lerVista(campo(bruto, 'lado'))
  if (frente === null || lado === null) return null
  return { ...(frente !== undefined ? { frente } : {}), ...(lado !== undefined ? { lado } : {}) }
}

function lerQuando(bruto: unknown): Record<string, string> | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const quando: Record<string, string> = {}
  for (const [k, v] of Object.entries(bruto)) {
    if (typeof v !== 'string') return null
    quando[k] = v
  }
  return quando
}

function lerVariantes(bruto: unknown): VarianteDoMovel[] | null {
  if (!Array.isArray(bruto) || bruto.length === 0) return null
  const lista: VarianteDoMovel[] = []
  for (const v of bruto) {
    const nome = texto(v, 'nome')
    const quando = lerQuando(campo(v, 'quando'))
    const vistasBrutas = campo(v, 'vistas')
    const vistas = vistasBrutas === undefined ? undefined : lerVistas(vistasBrutas)
    if (nome === null || quando === null || vistas === null) return null
    lista.push({ nome, quando, ...(vistas !== undefined ? { vistas } : {}) })
  }
  return lista
}

function lerFormas(bruto: unknown): FormaDoMovel[] | null {
  if (!Array.isArray(bruto) || bruto.length === 0) return null
  const lista: FormaDoMovel[] = []
  for (const f of bruto) {
    const nome = texto(f, 'nome')
    const vista = texto(f, 'vista')
    const variante = texto(f, 'variante')
    const virada = numero(f, 'virada')
    const casas = par(f, 'casas')
    const valor = texto(f, 'valor')
    const partes = texto(f, 'partes')
    const cor = texto(f, 'cor')
    const larguraPx = numero(f, 'larguraPx')
    const alturaPx = numero(f, 'alturaPx')
    if (nome === null || (vista !== 'frente' && vista !== 'lado') || variante === null || virada === null || casas === null) return null
    if (valor === null || partes === null || larguraPx === null || alturaPx === null || larguraPx < 1 || alturaPx < 1 || larguraPx > 2048 || alturaPx > 2048) return null
    lista.push({ nome, vista, variante, virada, casas, valor, partes, larguraPx, alturaPx, ...(cor !== null ? { cor } : {}) })
  }
  return lista
}

function lerRampa(bruto: unknown): Rampa | null {
  const escuro = nos(bruto, 'escuro')
  const claro = nos(bruto, 'claro')
  const cromaNaSombra = numero(bruto, 'cromaNaSombra')
  const amareloNaLuz = numero(bruto, 'amareloNaLuz')
  const cromaNaLuz = numero(bruto, 'cromaNaLuz')
  const escuroAte = numero(bruto, 'escuroAte')
  const claroDesde = numero(bruto, 'claroDesde')
  if (escuro === null || claro === null || cromaNaSombra === null || amareloNaLuz === null || cromaNaLuz === null || escuroAte === null || claroDesde === null) return null
  return { escuro, claro, cromaNaSombra, amareloNaLuz, cromaNaLuz, escuroAte, claroDesde }
}

function lerSombra(bruto: unknown): SombraDoMovel | null {
  const jeito = texto(bruto, 'jeito')
  const direcao = par(bruto, 'direcao')
  const deslocamento = numero(bruto, 'deslocamentoCasas') ?? 0
  const borrao = numero(bruto, 'borraoCasas') ?? 0
  const alfa = numero(bruto, 'alfa')
  const cor = texto(bruto, 'cor')
  if ((jeito !== 'deslocada' && jeito !== 'nenhuma') || direcao === null || !(Math.hypot(direcao[0], direcao[1]) > 0)) return null
  if (alfa === null || alfa < 0 || alfa > 1 || cor === null || !COR_HEX.test(cor) || deslocamento < 0 || deslocamento > 0.5 || borrao < 0 || borrao > 0.25) return null
  return { jeito, direcao, deslocamentoCasas: deslocamento, borraoCasas: borrao, alfa, cor: rgbDoHex(cor) }
}

function lerPecas(bruto: unknown): PecasDaCerca | null | undefined {
  if (bruto === undefined) return undefined
  const mourao = par(bruto, 'mouraoCasas')
  const raio = numero(bruto, 'raioCasas')
  const coluna = numero(bruto, 'colunaCasas')
  const virada = numero(bruto, 'viradaDaLuz')
  if (mourao === null || raio === null || coluna === null || virada === null || !(raio > 0) || !(virada > 0)) return null
  return { mouraoCasas: mourao, raioCasas: raio, colunaCasas: coluna, viradaDaLuz: virada }
}

/** O `textura.json` de um móvel do pacote, conferido; `null` = não serve (o móvel fica no Atual). */
export function lerParamsDoMovel(bruto: unknown): ParamsDoMovel | null {
  const id = texto(bruto, 'id')
  const idDoApp = texto(bruto, 'idDoApp')
  if (numero(bruto, 'contrato') !== 1 || texto(bruto, 'tipo') !== 'movel' || numero(bruto, 'pxPorCasa') !== PX_POR_CASA) return null
  if (id === null || !id.startsWith('movel-') || idDoApp === null) return null
  const margem = numero(bruto, 'margemCasas')
  const lugaresBrutos = campo(bruto, 'lugares')
  const lugares = Array.isArray(lugaresBrutos) && lugaresBrutos.every((l): l is string => typeof l === 'string') && lugaresBrutos.length <= 3 ? lugaresBrutos : null
  const variantes = lerVariantes(campo(bruto, 'variantes'))
  const vistas = lerVistas(campo(bruto, 'vistas'))
  const formas = lerFormas(campo(bruto, 'formas'))
  const sombra = lerSombra(campo(bruto, 'sombra'))
  const tingir = lerRampa(campo(bruto, 'tingir'))
  const pecas = lerPecas(campo(bruto, 'pecas'))
  const teto = numero(campo(bruto, 'memoria'), 'tetoMemoriaBytes')
  if (margem === null || margem < 0 || margem > 0.5 || lugares === null || variantes === null || vistas === null || vistas.frente === undefined) return null
  if (formas === null || sombra === null || tingir === null || pecas === null || teto === null || teto <= 0) return null
  return { id, idDoApp, margemCasas: margem, lugares, variantes, vistas, formas, sombra, tingir, tetoPorVista: teto, ...(pecas !== undefined ? { pecas } : {}) }
}

// ---------- OKLab e a rampa (CONTRATO 10.5) ----------

function linear(c: number): number {
  const u = c / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

function srgb(c: number): number {
  const u = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return u * 255
}

export function oklab(c: Rgb): [number, number, number] {
  const r = linear(c[0])
  const g = linear(c[1])
  const b = linear(c[2])
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

function linearDoOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}

function cabe(c: readonly number[]): boolean {
  return c.every((v) => v >= -1e-4 && v <= 1 + 1e-4)
}

export function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function interpolar(lista: readonly (readonly [number, number])[], g: number): number {
  if (g <= lista[0][0]) return lista[0][1]
  for (let i = 1; i < lista.length; i += 1) {
    const [x0, y0] = lista[i - 1]
    const [x1, y1] = lista[i]
    if (g <= x1) return y0 + ((y1 - y0) * (g - x0)) / (x1 - x0)
  }
  return lista[lista.length - 1][1]
}

const MATIZ_DO_AMARELO = (() => {
  const [, a, b] = oklab([240, 210, 102])
  return Math.atan2(b, a)
})()

/** A rampa de um tom: 256 cores (RGB 0..255), uma por valor (a conta de `ferramentas/movel.ts`). */
export function rampaDoTom(tom: Rgb, r: Rampa): Float32Array {
  const [L, a, b] = oklab(tom)
  const C = Math.hypot(a, b)
  const h = Math.atan2(b, a)
  let dh = MATIZ_DO_AMARELO - h
  while (dh > Math.PI) dh -= 2 * Math.PI
  while (dh < -Math.PI) dh += 2 * Math.PI
  const j = suave(0, r.escuroAte, L) * suave(1, r.claroDesde, L)
  const saida = new Float32Array(256 * 3)
  for (let i = 0; i < 256; i += 1) {
    const g = i / 255
    let L2: number
    let C2: number
    let h2 = h
    if (g <= 0.5) {
      const f = interpolar(r.escuro, g)
      L2 = L * f
      C2 = C * (1 + r.cromaNaSombra * (1 - f))
    } else {
      const f = interpolar(r.claro, g)
      L2 = L + (1 - L) * f
      C2 = C * (1 - r.cromaNaLuz * f)
      h2 = h + dh * r.amareloNaLuz * Math.min(1, f / 0.26)
    }
    L2 = L + j * (L2 - L)
    C2 = C + j * (C2 - C)
    let lo = 0
    let hi = 1
    let c = linearDoOklab(L2, C2 * Math.cos(h2), C2 * Math.sin(h2))
    if (!cabe(c)) {
      for (let t = 0; t < 14; t += 1) {
        const m = (lo + hi) / 2
        const cc = linearDoOklab(L2, C2 * m * Math.cos(h2), C2 * m * Math.sin(h2))
        if (cabe(cc)) lo = m
        else hi = m
      }
      c = linearDoOklab(L2, C2 * lo * Math.cos(h2), C2 * lo * Math.sin(h2))
    }
    for (let k = 0; k < 3; k += 1) saida[i * 3 + k] = Math.min(255, Math.max(0, srgb(Math.min(1, Math.max(0, c[k])))))
  }
  return saida
}

/** A classe PEDRA tinge com menos croma no escuro (10.5, lote 12): os ids de classe 'pedra' de MATERIAIS. */
export const CROMA_NA_SOMBRA_DA_PEDRA = -0.6
export const MATERIAIS_DE_PEDRA: ReadonlySet<string> = new Set(['granito', 'arenito', 'ardosia', 'barro'])

export function rampaDaOpcao(r: Rampa, opcao: string | undefined): Rampa {
  return opcao !== undefined && MATERIAIS_DE_PEDRA.has(opcao) ? { ...r, cromaNaSombra: CROMA_NA_SOMBRA_DA_PEDRA } : r
}

function classesDoPedido(opcoes: readonly string[]): string {
  return opcoes.map((o) => (MATERIAIS_DE_PEDRA.has(o) ? 'p' : '-')).join('')
}

/** As rampas prontas por (tom, croma no escuro): 3 KB cada, poucas por mapa. */
const RAMPAS = new Map<string, Float32Array>()
const RAMPAS_MAXIMAS = 256

function rampaGuardada(tom: Rgb, r: Rampa): Float32Array {
  const chave = `${tom.join(',')}|${r.cromaNaSombra}`
  let pronta = RAMPAS.get(chave)
  if (pronta === undefined) {
    if (RAMPAS.size >= RAMPAS_MAXIMAS) RAMPAS.clear()
    pronta = rampaDoTom(tom, r)
    RAMPAS.set(chave, pronta)
  }
  return pronta
}

// ---------- 1 e 2: a variante e a forma ----------

export const CHAVE_DA_FORMA = 'forma'
export const FORMA_PADRAO = 'retangular'
export const CHAVE_DA_VARIACAO = 'variacao'

function bateComOPedido(p: ParamsDoMovel, chave: string, opcao: string, opcoes: readonly string[], forma: string | undefined, variacao: number | undefined): boolean {
  if (chave === CHAVE_DA_FORMA) return (forma ?? FORMA_PADRAO) === opcao
  if (chave === CHAVE_DA_VARIACAO) return String(variacao ?? 0) === opcao
  return opcoes[p.lugares.indexOf(chave)] === opcao
}

export function varianteDoPedido(p: ParamsDoMovel, opcoes: readonly string[], forma?: string, variacao?: number): string {
  for (const v of p.variantes) {
    const bate = Object.entries(v.quando).every(([chave, opcao]) => bateComOPedido(p, chave, opcao, opcoes, forma, variacao))
    if (bate && Object.keys(v.quando).length > 0) return v.nome
  }
  return p.variantes[p.variantes.length - 1].nome
}

/** A forma da virada k (0..3): a desenhada ou a transposta (CONTRATO 10.4). */
export function formaDaVirada(viradas: 1 | 2 | 4, k: number): { virada: number; transposta: boolean } {
  if (viradas === 4) return { virada: k, transposta: false }
  if (viradas === 2) return k === 0 || k === 2 ? { virada: k, transposta: false } : { virada: k === 1 ? 2 : 0, transposta: true }
  return { virada: 0, transposta: k % 2 === 1 }
}

/** A vista que a conta usa: a pedida, se o móvel tem; senão a de frente. */
export function vistaUsada(p: ParamsDoMovel, pedida: Vista): Vista {
  return p.vistas[pedida] !== undefined ? pedida : 'frente'
}

// ---------- 3: o tingir (em passos) ----------

/** Os níveis 2 x 2 de uma forma tingida (o nível 0 a 128 px por casa). */
export type Niveis = readonly Camada[]

function bytesDosNiveis(nv: Niveis): number {
  return nv.reduce((s, c) => s + c.px.byteLength, 0)
}

/**
 * As formas tingidas guardadas (Float32, ~21 bytes por px com os níveis): LRU por bytes.
 * As 5 cadeiras de carvalho e palha dividem a mesma.
 */
export class CacheDosTingidos {
  private readonly mapa = new Map<string, Niveis>()
  private total = 0
  constructor(private readonly teto: number) {}

  get bytes(): number {
    return this.total
  }

  pegar(chave: string): Niveis | undefined {
    const nv = this.mapa.get(chave)
    if (nv !== undefined) {
      this.mapa.delete(chave)
      this.mapa.set(chave, nv)
    }
    return nv
  }

  guardar(chave: string, nv: Niveis): void {
    if (this.mapa.has(chave)) return
    this.mapa.set(chave, nv)
    this.total += bytesDosNiveis(nv)
    for (const [k, v] of this.mapa) {
      if (this.total <= this.teto || k === chave) break
      this.mapa.delete(k)
      this.total -= bytesDosNiveis(v)
    }
  }

  /** Solta as formas de um móvel (o carregador soltou as imagens dele). */
  soltarDoMovel(id: string): void {
    for (const [k, v] of [...this.mapa]) {
      if (!k.startsWith(`${id}|`)) continue
      this.mapa.delete(k)
      this.total -= bytesDosNiveis(v)
    }
  }
}

function* tingirEmPassos(m: MovelCarregado, f: FormaDoMovel, tons: readonly Rgb[], opcoes: readonly string[], transposta: boolean): Generator<void, Camada, void> {
  const valor = m.imagens.get(f.valor)
  const partes = m.imagens.get(f.partes)
  if (valor === undefined || partes === undefined) throw new Error(`${m.p.id}: falta ${f.valor} ou ${f.partes}`)
  const cor = f.cor !== undefined ? m.imagens.get(f.cor) : undefined
  const rampas = tons.map((t, i) => rampaGuardada(t, rampaDaOpcao(m.p.tingir, opcoes[i])))
  const w = transposta ? valor.h : valor.w
  const h = transposta ? valor.w : valor.h
  const px = new Float32Array(w * h * 4)
  const pesos = [0, 0, 0]
  const c = [0, 0, 0]
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = ((transposta ? x : y) * valor.w + (transposta ? y : x)) * 4
      const a = valor.px[o + 3] / 255
      const d = (y * w + x) * 4
      if (a <= 0) continue
      const g = valor.px[o]
      pesos[0] = partes.px[o] / 255
      pesos[1] = partes.px[o + 1] / 255
      pesos[2] = partes.px[o + 2] / 255
      let fixa = 1
      c[0] = 0
      c[1] = 0
      c[2] = 0
      for (let k = 0; k < rampas.length; k += 1) {
        const p = pesos[k]
        if (p <= 0) continue
        fixa -= p
        for (let q = 0; q < 3; q += 1) c[q] += p * rampas[k][g * 3 + q]
      }
      if (fixa > 1e-3) {
        for (let q = 0; q < 3; q += 1) c[q] += fixa * (cor !== undefined ? cor.px[o + q] : rampas.length > 0 ? rampas[0][g * 3 + q] : g)
      }
      for (let q = 0; q < 3; q += 1) px[d + q] = c[q] * a
      px[d + 3] = a * 255
    }
    yield
  }
  return { w, h, px }
}

function* niveisEmPassos(c: Camada): Generator<void, Camada[], void> {
  const r = [c]
  let a = c
  while (a.w > 1 && a.h > 1) {
    const w = Math.max(1, a.w >> 1)
    const h = Math.max(1, a.h >> 1)
    const px = new Float32Array(w * h * 4)
    for (let y = 0; y < h; y += 1) {
      const y0 = Math.min(a.h - 1, 2 * y)
      const y1 = Math.min(a.h - 1, 2 * y + 1)
      for (let x = 0; x < w; x += 1) {
        const x0 = Math.min(a.w - 1, 2 * x)
        const x1 = Math.min(a.w - 1, 2 * x + 1)
        for (let k = 0; k < 4; k += 1) {
          const s = a.px[(y0 * a.w + x0) * 4 + k] + a.px[(y0 * a.w + x1) * 4 + k] + a.px[(y1 * a.w + x0) * 4 + k] + a.px[(y1 * a.w + x1) * 4 + k]
          px[(y * w + x) * 4 + k] = s / 4
        }
      }
      if (y % 8 === 7) yield
    }
    a = { w, h, px }
    r.push(a)
  }
  return r
}

/** A forma tingida com os níveis, da guarda ou feita agora (em passos). */
function* niveisDaForma(m: MovelCarregado, f: FormaDoMovel, pedido: Pedido, transposta: boolean, guarda: CacheDosTingidos): Generator<void, Niveis, void> {
  const chave = `${m.p.id}|${f.nome}|${transposta ? 't' : ''}|${pedido.tons.map((t) => t.join(',')).join('|')}|${classesDoPedido(pedido.opcoes)}`
  const pronta = guarda.pegar(chave)
  if (pronta !== undefined) return pronta
  const base = yield* tingirEmPassos(m, f, pedido.tons, pedido.opcoes, transposta)
  const nv = yield* niveisEmPassos(base)
  guarda.guardar(chave, nv)
  return nv
}

// ---------- 4: o esticar ----------

/** O meio que repete (10.6): a posição dentro do primeiro módulo da imagem (0..P). */
export function faseNoModulo(u: number, M: number, P: number): number {
  const n = Math.round(M / P)
  if (n < 1) return 0
  const s = M / n
  const f = u / s - Math.floor(u / s)
  return f * P
}

/** O ponto da imagem (casas, da borda da pegada) para o ponto t do móvel de T casas (10.6). */
export function mapearEixo(t: number, T: number, S: number, pontas: readonly [number, number] | null, periodo: number | null = null, centro: number | null = null): number {
  if (pontas === null) return (t * S) / T
  const [pE, pD] = pontas
  if (centro !== null) {
    const h = centro / 2
    const cT = T / 2
    const cS = S / 2
    if (Math.abs(t - cT) <= h) return cS + (t - cT)
    if (T >= pE + pD + centro) {
      if (t <= pE) return t
      if (t >= T - pD) return S - (T - t)
      if (t < cT) return pE + ((t - pE) * (cS - h - pE)) / (cT - h - pE)
      return cS + h + ((t - cT - h) * (S - pD - cS - h)) / (T - pD - cT - h)
    }
    return t < cT ? t : S - (T - t)
  }
  if (T >= pE + pD) {
    if (t <= pE) return t
    if (t >= T - pD) return S - (T - t)
    if (periodo !== null) return pE + faseNoModulo(t - pE, T - pE - pD, periodo)
    return pE + ((t - pE) * (S - pE - pD)) / (T - pE - pD)
  }
  return t < T / 2 ? t : S - (T - t)
}

/** Bilinear pré-multiplicado num nível; fora da imagem é transparente. */
function ler(n: Camada, x: number, y: number, saida: number[]): void {
  const fx = x - 0.5
  const fy = y - 0.5
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  saida[0] = 0
  saida[1] = 0
  saida[2] = 0
  saida[3] = 0
  for (let q = 0; q < 4; q += 1) {
    const dx = q & 1
    const dy = q >> 1
    const p = (dx === 0 ? 1 - tx : tx) * (dy === 0 ? 1 - ty : ty)
    const X = ix + dx
    const Y = iy + dy
    if (X < 0 || Y < 0 || X >= n.w || Y >= n.h || p === 0) continue
    const o = (Y * n.w + X) * 4
    saida[0] += n.px[o] * p
    saida[1] += n.px[o + 1] * p
    saida[2] += n.px[o + 2] * p
    saida[3] += n.px[o + 3] * p
  }
}

// ---------- 5: a sombra ----------

function* desfocarEmPassos(a: Float32Array, w: number, h: number, sigma: number): Generator<void, Float32Array, void> {
  if (sigma < 0.3) return a
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2 - 0.5))
  let src = a
  for (let passada = 0; passada < 3; passada += 1) {
    const tmp = new Float32Array(w * h)
    for (let y = 0; y < h; y += 1) {
      let s = 0
      for (let x = -r; x <= r; x += 1) s += x >= 0 && x < w ? src[y * w + x] : 0
      for (let x = 0; x < w; x += 1) {
        tmp[y * w + x] = s / (2 * r + 1)
        const sai = x - r
        const entra = x + r + 1
        if (sai >= 0) s -= src[y * w + sai]
        if (entra < w) s += src[y * w + entra]
      }
    }
    yield
    const out = new Float32Array(w * h)
    for (let x = 0; x < w; x += 1) {
      let s = 0
      for (let y = -r; y <= r; y += 1) s += y >= 0 && y < h ? tmp[y * w + x] : 0
      for (let y = 0; y < h; y += 1) {
        out[y * w + x] = s / (2 * r + 1)
        const sai = y - r
        const entra = y + r + 1
        if (sai >= 0) s -= tmp[sai * w + x]
        if (entra < h) s += tmp[entra * w + x]
      }
    }
    yield
    src = out
  }
  return src
}

/** A silhueta do corpo andada e desfocada, já com o alfa da sombra (0..1 por px); `null` sem sombra. */
export function* sombraDoCorpo(sb: SombraDoMovel, corpo: Camada, pxPorCasa: number): Generator<void, Float32Array | null, void> {
  if (sb.jeito === 'nenhuma') return null
  const { w: W, h: H, px } = corpo
  const nd = Math.hypot(sb.direcao[0], sb.direcao[1])
  const desl = sb.deslocamentoCasas * pxPorCasa
  const dx = Math.round((sb.direcao[0] / nd) * desl)
  const dy = Math.round((sb.direcao[1] / nd) * desl)
  const a = new Float32Array(W * H)
  for (let Y = 0; Y < H; Y += 1) {
    for (let X = 0; X < W; X += 1) {
      const x0 = X - dx
      const y0 = Y - dy
      if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) a[Y * W + X] = px[(y0 * W + x0) * 4 + 3] / 255
    }
  }
  yield
  const borrada = yield* desfocarEmPassos(a, W, H, sb.borraoCasas * pxPorCasa)
  for (let i = 0; i < borrada.length; i += 1) borrada[i] *= sb.alfa
  return borrada
}

// ---------- a conta inteira, em plano + passos ----------

/** O que a conta decide sem pintar nada: a forma, o tamanho da camada e onde fica o meio. */
export interface PlanoDoMovel {
  readonly m: MovelCarregado
  readonly pedido: Pedido
  readonly pxPorCasa: number
  readonly f: FormaDoMovel
  readonly transposta: boolean
  /** O quarto de volta que a imagem traz pintado (graus, múltiplo de 90; na cerca, o giro inteiro). */
  readonly giroPintado: number
  readonly W: number
  readonly H: number
  /** O meio da pegada, em px da camada. */
  readonly cx: number
  readonly cy: number
  /** A pegada pedida já na tela (casas), e a da fonte (já virada). */
  readonly alvo: readonly [number, number]
  readonly fonte: readonly [number, number]
  readonly pontasX: readonly [number, number] | null
  readonly pontasY: readonly [number, number] | null
  readonly periodoX: number | null
  readonly periodoY: number | null
  readonly centroX: number | null
  readonly centroY: number | null
  readonly borda: number
  /** A cerca por peças: a geometria já girada (casas, na tela). */
  readonly cerca?: CercaNaTela
}

interface CercaNaTela {
  readonly pc: PecasDaCerca
  readonly mouroes: readonly (readonly [number, number])[]
  readonly arco: { readonly c: readonly [number, number]; readonly r: number; readonly a0: number; readonly sw: number } | null
  /** O canto da camada, em px da tela a partir do meio do objeto. */
  readonly X0: number
  readonly Y0: number
}

/**
 * O plano do móvel (`comporMovel` da referência, sem pintar). `bordaMinimaPx` alarga a
 * camada para o que o app pinta em volta (o halo do lampião). `null` = falta a forma.
 */
export function planejarMovel(m: MovelCarregado, pedido: Pedido, pxPorCasa: number, bordaMinimaPx = 0): PlanoDoMovel | null {
  const p = m.p
  if (p.pecas !== undefined && pedido.cerca !== undefined) return planejarCerca(m, p.pecas, pedido, pedido.cerca, pxPorCasa)
  const nomeDaVista = vistaUsada(p, pedido.vista)
  const variante = varianteDoPedido(p, pedido.opcoes, pedido.forma, pedido.variacao)
  const vista = p.variantes.find((v) => v.nome === variante)?.vistas?.[nomeDaVista] ?? p.vistas[nomeDaVista]
  if (vista === undefined) return null
  const quartos = Math.round(pedido.giro / 90)
  let k = ((quartos % 4) + 4) % 4
  const giroPintado = (((quartos % 4) + 4) % 4) * 90
  let w = pedido.casasW
  let h = pedido.casasH
  if (vista.esticar?.ladoMaior === true && h > w) {
    ;[w, h] = [h, w]
    k = (k + 1) % 4
  }
  const { virada, transposta } = formaDaVirada(vista.viradas, k)
  const f = p.formas.find((x) => x.vista === nomeDaVista && x.variante === variante && x.virada === virada)
  if (f === undefined || !m.imagens.has(f.valor) || !m.imagens.has(f.partes)) return null
  const fonte: [number, number] = transposta ? [f.casas[1], f.casas[0]] : [f.casas[0], f.casas[1]]
  const alvo: [number, number] = k % 2 === 1 ? [h, w] : [w, h]
  const es = vista.esticar
  const ordem = (par2: readonly [number, number]): readonly [number, number] => (k >= 2 ? [par2[1], par2[0]] : par2)
  const pontasAoLongo = es !== undefined ? ordem(es.pontasCasas) : null
  const pontasAtraves = es !== undefined && es.eixo === 'xy' ? ordem(es.pontasCasasY ?? es.pontasCasas) : null
  const periodo = es?.periodoCasas ?? null
  const centro = es?.centroCasas ?? null
  const centroAtraves = es !== undefined && es.eixo === 'xy' ? (es.centroCasasY ?? null) : null
  const sb = p.sombra
  const desl = sb.jeito === 'nenhuma' ? 0 : sb.deslocamentoCasas * pxPorCasa
  const sigma = sb.jeito === 'nenhuma' ? 0 : sb.borraoCasas * pxPorCasa
  const bordaDaConta = Math.ceil(p.margemCasas * pxPorCasa + desl + 3 * sigma + 2)
  const meioMenor = (Math.min(alvo[0], alvo[1]) * pxPorCasa) / 2
  const borda = Math.max(bordaDaConta, Math.ceil(bordaMinimaPx - meioMenor))
  const W = Math.ceil(alvo[0] * pxPorCasa) + 2 * borda
  const H = Math.ceil(alvo[1] * pxPorCasa) + 2 * borda
  return {
    m,
    pedido,
    pxPorCasa,
    f,
    transposta,
    giroPintado,
    W,
    H,
    cx: borda + (alvo[0] * pxPorCasa) / 2,
    cy: borda + (alvo[1] * pxPorCasa) / 2,
    alvo,
    fonte,
    pontasX: k % 2 === 0 ? pontasAoLongo : pontasAtraves,
    pontasY: k % 2 === 0 ? pontasAtraves : pontasAoLongo,
    periodoX: k % 2 === 0 ? periodo : null,
    periodoY: k % 2 === 0 ? null : periodo,
    centroX: k % 2 === 0 ? centro : centroAtraves,
    centroY: k % 2 === 0 ? centroAtraves : centro,
    borda,
  }
}

/** Pinta o corpo do plano (RGBA pré-multiplicado, W x H), uma linha por passo. */
export function* pintarMovel(plano: PlanoDoMovel, guarda: CacheDosTingidos): Generator<void, Camada, void> {
  if (plano.cerca !== undefined) return yield* pintarCerca(plano, plano.cerca, guarda)
  const nv = yield* niveisDaForma(plano.m, plano.f, plano.pedido, plano.transposta, guarda)
  const { W, H, pxPorCasa, alvo, fonte, borda } = plano
  const mg = plano.m.p.margemCasas
  const px = new Float32Array(W * H * 4)
  const escala = Math.max(fonte[0] / alvo[0], fonte[1] / alvo[1], 1e-6)
  const fontePorPx = (escala * PX_POR_CASA) / pxPorCasa
  const nivel = Math.min(nv.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, fontePorPx)))))
  const n = nv[nivel]
  const kN = n.w / nv[0].w
  const amostra = [0, 0, 0, 0]
  for (let Y = 0; Y < H; Y += 1) {
    const ty = (Y + 0.5 - borda) / pxPorCasa
    const sy = mapearEixo(ty, alvo[1], fonte[1], plano.pontasY, plano.periodoY, plano.centroY)
    for (let X = 0; X < W; X += 1) {
      const tx = (X + 0.5 - borda) / pxPorCasa
      const sx = mapearEixo(tx, alvo[0], fonte[0], plano.pontasX, plano.periodoX, plano.centroX)
      ler(n, (sx + mg) * PX_POR_CASA * kN, (sy + mg) * PX_POR_CASA * kN, amostra)
      const o = (Y * W + X) * 4
      px[o] = amostra[0]
      px[o + 1] = amostra[1]
      px[o + 2] = amostra[2]
      px[o + 3] = amostra[3]
    }
    yield
  }
  return { w: W, h: H, px }
}

// ---------- a cerca por peças (10.12) ----------

const LUZ_DA_TELA: readonly [number, number] = [-Math.SQRT1_2, -Math.SQRT1_2]

function planejarCerca(m: MovelCarregado, pc: PecasDaCerca, pedido: Pedido, g: GeometriaDaCercaEmCasas, pxPorCasa: number): PlanoDoMovel | null {
  const p = m.p
  const variante = varianteDoPedido(p, pedido.opcoes)
  const f = p.formas.find((x) => x.vista === 'frente' && x.variante === variante && x.virada === 0)
  if (f === undefined || g.mouroes.length < 2 || !m.imagens.has(f.valor) || !m.imagens.has(f.partes)) return null
  const mg = p.margemCasas
  const meia = f.casas[1] / 2 + mg
  const ang = (pedido.giro * Math.PI) / 180
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const naTela = (x: number, y: number): [number, number] => [x * co - y * si, x * si + y * co]
  const mouroes = g.mouroes.map((q) => naTela(q.x, q.y))
  const arco = g.arco === null ? null : { c: naTela(g.arco.center.x, g.arco.center.y), r: g.arco.radius, a0: g.arco.startAngle + ang, sw: g.arco.sweep }
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  const incluir = (x: number, y: number, r: number): void => {
    x0 = Math.min(x0, x - r)
    x1 = Math.max(x1, x + r)
    y0 = Math.min(y0, y - r)
    y1 = Math.max(y1, y + r)
  }
  for (const [x, y] of mouroes) incluir(x, y, Math.max(meia, pc.raioCasas))
  if (arco !== null) {
    for (let i = 0; i <= 64; i += 1) {
      const a = arco.a0 + (arco.sw * i) / 64
      incluir(arco.c[0] + Math.cos(a) * arco.r, arco.c[1] + Math.sin(a) * arco.r, meia)
    }
  }
  const sb = p.sombra
  const desl = sb.jeito === 'nenhuma' ? 0 : sb.deslocamentoCasas * pxPorCasa
  const sigma = sb.jeito === 'nenhuma' ? 0 : sb.borraoCasas * pxPorCasa
  const borda = Math.ceil(desl + 3 * sigma + 2)
  const X0 = Math.floor(x0 * pxPorCasa) - borda
  const Y0 = Math.floor(y0 * pxPorCasa) - borda
  const W = Math.ceil(x1 * pxPorCasa) + borda - X0
  const H = Math.ceil(y1 * pxPorCasa) + borda - Y0
  return {
    m,
    pedido,
    pxPorCasa,
    f,
    transposta: false,
    giroPintado: pedido.giro,
    W,
    H,
    cx: -X0,
    cy: -Y0,
    alvo: [pedido.casasW, pedido.casasH],
    fonte: [f.casas[0], f.casas[1]],
    pontasX: null,
    pontasY: null,
    periodoX: null,
    periodoY: null,
    centroX: null,
    centroY: null,
    borda,
    cerca: { pc, mouroes, arco, X0, Y0 },
  }
}

function* pintarCerca(plano: PlanoDoMovel, cerca: CercaNaTela, guarda: CacheDosTingidos): Generator<void, Camada, void> {
  const { pc, mouroes, arco, X0, Y0 } = cerca
  const { W, H, pxPorCasa, f } = plano
  const nv = yield* niveisDaForma(plano.m, f, plano.pedido, false, guarda)
  const nivel = Math.min(nv.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, PX_POR_CASA / pxPorCasa)))))
  const n = nv[nivel]
  const kN = (n.w / nv[0].w) * PX_POR_CASA
  const mg = plano.m.p.margemCasas
  const meia = f.casas[1] / 2 + mg
  const px = new Float32Array(W * H * 4)
  const a1 = [0, 0, 0, 0]
  const a2 = [0, 0, 0, 0]
  const xCol = (pc.colunaCasas + mg) * kN
  const yMeio = meia * kN
  const [ax, ay] = mouroes[0]
  const [bx, by] = mouroes[mouroes.length - 1]
  const L = Math.hypot(bx - ax, by - ay) || 1
  const tx = (bx - ax) / L
  const ty = (by - ay) / L
  const sentido = arco === null ? 1 : Math.sign(arco.sw)
  for (let Y = 0; Y < H; Y += 1) {
    const wy = (Y + 0.5 + Y0) / pxPorCasa
    for (let X = 0; X < W; X += 1) {
      const wx = (X + 0.5 + X0) / pxPorCasa
      let c: number
      let nx: number
      let ny: number
      if (arco === null) {
        const s = (wx - ax) * tx + (wy - ay) * ty
        if (s < 0 || s > L) continue
        nx = -ty
        ny = tx
        c = (wx - ax) * nx + (wy - ay) * ny
      } else {
        const vx = wx - arco.c[0]
        const vy = wy - arco.c[1]
        const rr = Math.hypot(vx, vy) || 1e-9
        let d = Math.atan2(vy, vx) - arco.a0
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI))
        const u = d / arco.sw
        if (!(u >= 0 && u <= 1)) continue
        const ux = vx / rr
        const uy = vy / rr
        nx = -ux * sentido
        ny = -uy * sentido
        c = (rr - arco.r) * (ux * nx + uy * ny)
      }
      if (Math.abs(c) > meia) continue
      const olha = -(nx * LUZ_DA_TELA[0] + ny * LUZ_DA_TELA[1]) / Math.SQRT1_2
      const w = suave(-pc.viradaDaLuz, pc.viradaDaLuz, olha)
      ler(n, xCol, yMeio + c * kN, a1)
      ler(n, xCol, yMeio - c * kN, a2)
      const o = (Y * W + X) * 4
      for (let q = 0; q < 4; q += 1) px[o + q] = w * a1[q] + (1 - w) * a2[q]
    }
    yield
  }
  const raioPx = pc.raioCasas * pxPorCasa
  const mx = (pc.mouraoCasas[0] + mg) * kN
  const my = (pc.mouraoCasas[1] + mg) * kN
  for (const [qx, qy] of mouroes) {
    const cx = qx * pxPorCasa - X0
    const cy = qy * pxPorCasa - Y0
    for (let Y = Math.max(0, Math.floor(cy - raioPx - 1)); Y < Math.min(H, Math.ceil(cy + raioPx + 1)); Y += 1) {
      for (let X = Math.max(0, Math.floor(cx - raioPx - 1)); X < Math.min(W, Math.ceil(cx + raioPx + 1)); X += 1) {
        const dx = X + 0.5 - cx
        const dy = Y + 0.5 - cy
        const mascara = Math.min(1, Math.max(0, raioPx - Math.hypot(dx, dy) + 0.5))
        if (mascara <= 0) continue
        ler(n, mx + (dx / pxPorCasa) * kN, my + (dy / pxPorCasa) * kN, a1)
        const a = (a1[3] / 255) * mascara
        if (a <= 0) continue
        const o = (Y * W + X) * 4
        for (let q = 0; q < 4; q += 1) px[o + q] = a1[q] * mascara + px[o + q] * (1 - a)
      }
    }
    yield
  }
  return { w: W, h: H, px }
}
