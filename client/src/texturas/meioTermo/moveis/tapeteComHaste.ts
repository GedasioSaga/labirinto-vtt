/**
 * TAPETE GRANDE "MEDALHÃO COM HASTE" (opção C do protótipo
 * `docs/design/tapete-grande/prototipo.html`, commit dd9203fc). Escolha do
 * Claude em 24/11/2026, pela recomendação do próprio protótipo: o dono
 * perguntou "cadê o tapete novo?" sem ter escolhido entre A, B e C.
 *
 * O mesmo desenho no tapete retangular (`tapete.ts`) e no tapete longo
 * (`tapeteLongo.ts`). Antes, o longo carimbava o mesmo losango a cada casa e
 * virava papel de parede no corredor. Agora:
 *  - a moldura (0,36 casa) e a franja (0,15 casa) têm tamanho fixo, com o
 *    motivo da borda arredondado para caber inteiro entre os cantos;
 *  - um painel recortado nos cantos, um medalhão no centro e duas pontas em
 *    arco, todos medidos pela LARGURA: esticar o tapete não deforma nada;
 *  - a haste fina (com folhas em espaço sorteado, espelhado no meio) liga o
 *    medalhão às pontas e é a única coisa que estica. No tapete curto (3 x 3)
 *    ela e as pontas somem e fica o medalhão simples.
 *
 * A conta é a do protótipo, em CASAS (G px do desenho por casa): cada textura
 * converte x e y para casas e a borda suave usa `SC` = pixels por casa.
 * Cores em luz cheia: quem escurece é a tinta da cena (o mapa de luz em
 * multiply, `pixi/mapaDeLuz.ts`), como nos outros objetos.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa } from './formas'
import { ruido, type Cena, type Textura } from './motor'
import { G, materialDaPeca, type ContextoDoMovel } from './contexto'

const TAU = Math.PI * 2

/** Sombra do tapete: quase rente ao chão (vale para todas as formas; `tapete.ts` a reexporta). */
export const SOMBRA_DO_TAPETE = { z: 1.5, forca: 0.22, suave: 1.2 } as const

export interface CoresDaHaste {
  readonly campo: Rgb
  /** O painel recortado e o miolo das pontas: o campo um pouco mais escuro. */
  readonly fundo: Rgb
  /** A faixa da moldura, o anel do medalhão e as pontas. */
  readonly faixa: Rgb
  /** O escuro das beiras da moldura. */
  readonly guarda: Rgb
  readonly fio: Rgb
  readonly acento: Rgb
}

function hex(h: string): Rgb {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A moldura e o acento que cada família de tecido soma ao campo (as paletas do protótipo). */
interface Moldura {
  readonly faixa: Rgb
  readonly guarda: Rgb
  readonly fio: Rgb
  readonly acento: Rgb
}

const FIO_CREME = hex('#dccdab')
const ACENTO_OURO = hex('#ae8a4c')
const ACENTO_VINHO = hex('#8b4747')
/** Campo vermelho (Vinho): moldura azul-ardósia, acento ouro. */
const MOLDURA_DO_VINHO: Moldura = { faixa: hex('#3a455c'), guarda: hex('#2a252c'), fio: FIO_CREME, acento: ACENTO_OURO }
/** Campo azul (Índigo): moldura vinho, acento ouro. */
const MOLDURA_DO_AZUL: Moldura = { faixa: hex('#6c3737'), guarda: hex('#25252e'), fio: FIO_CREME, acento: ACENTO_OURO }
/** Campo verde (Musgo): moldura de terra, acento vinho. */
const MOLDURA_DO_MUSGO: Moldura = { faixa: hex('#77583a'), guarda: hex('#2c2d24'), fio: hex('#ddd1b2'), acento: ACENTO_VINHO }
/** Campo de ocre ou de linho: a moldura azul-ardósia, com o acento vinho (o ouro some no amarelado). */
const MOLDURA_DO_OCRE: Moldura = { faixa: hex('#3a455c'), guarda: hex('#2a252c'), fio: FIO_CREME, acento: ACENTO_VINHO }

/** O fundo do painel é o campo x 0,83 (#773b3c no Vinho do protótipo). */
const FUNDO_DO_PAINEL = 0.83
/** Acima deste canal mais claro o tecido é claro (linho): fica com a moldura do ocre. */
const CANAL_DO_TECIDO_CLARO = 170

function matiz(c: Rgb): number {
  const [r, g, b] = c
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

function molduraDoTecido(base: Rgb): Moldura {
  if (Math.max(base[0], base[1], base[2]) > CANAL_DO_TECIDO_CLARO) return MOLDURA_DO_OCRE
  const h = matiz(base)
  if (h >= 180 && h < 300) return MOLDURA_DO_AZUL
  if (h >= 60 && h < 180) return MOLDURA_DO_MUSGO
  if (h >= 25 && h < 60) return MOLDURA_DO_OCRE
  return MOLDURA_DO_VINHO
}

/** O campo é o tecido escolhido no painel; a moldura e o acento saem da família dele. */
export function coresDaHaste(base: Rgb): CoresDaHaste {
  const m = molduraDoTecido(base)
  return { campo: base, fundo: [base[0] * FUNDO_DO_PAINEL, base[1] * FUNDO_DO_PAINEL, base[2] * FUNDO_DO_PAINEL], ...m }
}

// ---------- geometria, em casas ----------

/** Franja e moldura de tamanho fixo (casas); abaixo de 1,8 casa de largura a moldura encolhe para 20% dela. */
export const FRANJA_EM_CASAS = 0.15
const FRANJA_MAXIMA_DO_COMPRIMENTO = 0.12
export const MOLDURA_EM_CASAS = 0.36
const MOLDURA_DA_LARGURA = 0.2
/** Passo do motivo da borda (casas), ajustado para caber inteiro entre os cantos. */
const PERIODO_DA_BORDA = 0.5
/** A partir desta razão comprimento / largura o tapete é passadeira: medalhão e pontas maiores. */
const RAZAO_DE_PASSADEIRA = 2.5
/** A haste aparece quando sobra ao menos isto (casas) entre o medalhão e a ponta. */
const HASTE_MINIMA = 0.35
/** O desgaste do meio: força e a razão a partir da qual ele corre ao longo, como numa passadeira. */
const DESGASTE = 0.22
const RAZAO_DO_DESGASTE_AO_LONGO = 1.6

export interface GeometriaDaHaste {
  /** Comprimento (com a franja) e largura, em casas. */
  readonly L: number
  readonly Wd: number
  /** Meio comprimento do corpo (sem a franja) e meia largura. */
  readonly hu: number
  readonly hv: number
  /** Largura da moldura; Fu e Fv = meio campo de dentro dela. */
  readonly B: number
  /** Painel recortado: meio comprimento, meia largura e o recorte do canto. */
  readonly Pu: number
  readonly Pv: number
  readonly n: number
  /** Raio do medalhão. */
  readonly Rc: number
  /** Ponta em arco: meia largura, comprimento, onde começa (base) e onde acaba (ponta). */
  readonly Rcap: number
  readonly Lc: number
  readonly base: number
  readonly ponta: number
  /** Há haste e pontas (falso no tapete curto). */
  readonly temHaste: boolean
}

/** A franja, em casas: fixa, mas nunca mais que 12% do comprimento (o tapete de 1 casa). */
export function franjaEmCasas(comprimento: number): number {
  return Math.min(FRANJA_EM_CASAS, FRANJA_MAXIMA_DO_COMPRIMENTO * comprimento)
}

/** `L` = comprimento inteiro (com a franja) e `Wd` = largura, em casas. */
export function geometriaDaHaste(L: number, Wd: number): GeometriaDaHaste {
  const hu = L / 2 - franjaEmCasas(L)
  const hv = Wd / 2
  const B = Math.min(MOLDURA_EM_CASAS, MOLDURA_DA_LARGURA * Wd)
  const recuo = 0.09
  const Pu = hu - B - recuo
  const Pv = hv - B - recuo
  const n = Math.min(0.24, 0.38 * Pv)
  const passadeira = L / Wd >= RAZAO_DE_PASSADEIRA
  const Rc = Math.min((passadeira ? 0.82 : 0.62) * Pv, 0.8 * Pu)
  const Rcap = (passadeira ? 0.66 : 0.52) * Pv
  const Lc = (passadeira ? 2.3 : 1.25) * Rcap
  const base = Pu - 0.04
  const ponta = base - Lc
  return { L, Wd, hu, hv, B, Pu, Pv, n, Rc, Rcap, Lc, base, ponta, temHaste: ponta - Rc > HASTE_MINIMA }
}

// ---------- pincel ----------

/** Pixels por casa do desenho em curso (cada textura o põe antes de pintar o ponto). */
let SC = G
/** A cor do ponto em curso, e a guarda da mistura do campo com a moldura. */
const C = new Float32Array(3)
const GUARDA = new Float32Array(3)

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function suave(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Cobertura de um pixel numa área a `d` casas da borda (negativo = dentro). */
function cob(d: number): number {
  const k = 0.5 - d * SC
  return k <= 0 ? 0 : k >= 1 ? 1 : k
}

function pintar(k: Rgb): void {
  C[0] = k[0]
  C[1] = k[1]
  C[2] = k[2]
}

function tingir(k: Rgb, t: number): void {
  if (t <= 0) return
  const a = t > 1 ? 1 : t
  C[0] += (k[0] - C[0]) * a
  C[1] += (k[1] - C[1]) * a
  C[2] += (k[2] - C[2]) * a
}

// ---------- a moldura ----------

/** O motivo da borda: dois fios em onda e uma conta de acento em cada meia volta. */
function motivo(f: number, per: number, mw: number, B: number, t: CoresDaHaste): void {
  const A = 0.16 * B
  const ph = TAU * f
  const y = A * Math.sin(ph)
  const inclinacao = ((A * TAU) / per) * Math.cos(ph)
  const den = Math.sqrt(1 + inclinacao * inclinacao)
  tingir(t.fio, cob(Math.abs(mw - y) / den - 0.02 * B) * 0.82)
  tingir(t.fio, cob(Math.abs(mw + y) / den - 0.02 * B) * 0.82)
  const fo = (f < 0.5 ? f - 0.25 : f - 0.75) * per
  tingir(t.acento, cob(Math.hypot(fo, mw) - 0.075 * B))
}

/** O canto da moldura: um anel de fio, a conta do meio e quatro pontos. */
function canto(x: number, y: number, B: number, t: CoresDaHaste): void {
  const r = Math.hypot(x, y)
  tingir(t.fio, cob(Math.abs(r - 0.22 * B) - 0.022 * B) * 0.85)
  tingir(t.acento, cob(r - 0.1 * B))
  const d = 0.27 * B
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) tingir(t.fio, cob(Math.hypot(x - sx * d, y - sy * d) - 0.045 * B) * 0.8)
  }
}

/** A moldura: a guarda escura, a faixa no meio, os dois fios e o motivo (ou o canto). */
function moldura(u: number, v: number, a: number, b: number, de: number, g: GeometriaDaHaste, t: CoresDaHaste): void {
  const B = g.B
  pintar(t.guarda)
  tingir(t.faixa, cob(Math.abs(de - 0.5 * B) - 0.3 * B))
  tingir(t.fio, cob(Math.abs(de - 0.17 * B) - 0.028 * B) * 0.88)
  tingir(t.fio, cob(Math.abs(de - 0.83 * B) - 0.028 * B) * 0.88)
  const mw = de - 0.5 * B
  if (a < B && b < B) {
    canto(a - 0.5 * B, b - 0.5 * B, B, t)
    return
  }
  // O motivo cabe inteiro entre os cantos: o número de voltas é arredondado e o passo se ajusta.
  const s = b <= a ? u : v
  const meio = b <= a ? g.hu - B : g.hv - B
  const n = Math.max(1, Math.round((2 * meio) / PERIODO_DA_BORDA))
  const per = (2 * meio) / n
  const q = (s + meio) / per
  motivo(q - Math.floor(q), per, mw, B, t)
}

// ---------- o campo: painel, haste, pontas e medalhão ----------

/** Folhas da haste: uma célula de 0,46 casa, com a folha (ou nada) em lugar sorteado. */
const CELULA_DA_FOLHA = 0.46

function haste(u: number, v: number, au: number, av: number, g: GeometriaDaHaste, t: CoresDaHaste): void {
  // A haste dupla, do medalhão até a ponta.
  if (au > g.Rc * 0.95 && au < g.ponta + 0.02) tingir(t.fio, cob(Math.abs(av - 0.026) - 0.0065) * 0.85)
  // Folhas em espaço sorteado e espelhado no meio, nunca um passo fixo.
  const k = Math.floor(au / CELULA_DA_FOLHA)
  const uf = (k + 0.2 + 0.6 * hash(k, 0, 61)) * CELULA_DA_FOLHA
  if (hash(k, 0, 62) < 0.7 && uf > g.Rc + 0.22 && uf < g.ponta - 0.22) {
    const lado = hash(k, 0, 63) < 0.5 ? -1 : 1
    const du = au - uf
    const dv = v * Math.sign(u || 1) - lado * 0.075
    const cs = Math.cos(0.6 * lado)
    const sn = Math.sin(0.6 * lado)
    const fx = du * cs + dv * sn
    const fy = -du * sn + dv * cs
    const e = Math.hypot(fx / 0.075, fy / 0.03)
    const folha = cob((e - 1) * 0.03)
    tingir(t.acento, folha * 0.8)
    tingir(t.fio, cob(Math.abs(fy) - 0.004) * folha * 0.5)
  }
  // As contas que prendem a haste no medalhão e na ponta.
  for (const ju of [g.Rc + 0.09, g.ponta - 0.07]) tingir(t.acento, cob((Math.abs(au - ju) + av) * 0.7 - 0.03))
  // A ponta em arco, com o miolo e a conta.
  const d = g.base - au
  if (d > -0.05 && d < g.Lc + 0.05) {
    const meia = g.Rcap * Math.sqrt(clamp01(1 - d / g.Lc))
    const dist = Math.max(av - meia, -d)
    tingir(t.faixa, cob(dist))
    tingir(t.fio, cob(Math.abs(dist) - 0.011))
    const d2 = d - 0.07
    const meia2 = g.Rcap * 0.55 * Math.sqrt(clamp01(1 - d2 / (g.Lc * 0.62)))
    tingir(t.fundo, cob(Math.max(av - meia2, -d2)))
    tingir(t.acento, cob(Math.hypot(d - g.Lc * 0.3, v) - 0.06 * g.Rcap - 0.02))
  }
}

function medalhao(u: number, v: number, g: GeometriaDaHaste, t: CoresDaHaste): void {
  const r = Math.hypot(u, v)
  if (r >= g.Rc * 1.3) return
  const th = Math.atan2(v, u)
  // O anel recortado em 8 lóbulos, com oito contas por dentro.
  const dist = r - g.Rc * (1 + 0.045 * Math.cos(8 * th))
  tingir(t.faixa, cob(dist))
  tingir(t.fio, cob(Math.abs(dist) - 0.012))
  const ang = (Math.round((th - TAU / 16) / (TAU / 8)) * TAU) / 8 + TAU / 16
  tingir(t.acento, cob(Math.hypot(u - 0.84 * g.Rc * Math.cos(ang), v - 0.84 * g.Rc * Math.sin(ang)) - 0.045 * g.Rc))
  // O miolo do campo, a estrela de quatro pontas e o botão de fio.
  const d2 = r - g.Rc * 0.66
  tingir(t.campo, cob(d2))
  tingir(t.fio, cob(Math.abs(d2) - 0.01))
  const rs = g.Rc * 0.44 * (0.58 + 0.42 * Math.pow(Math.abs(Math.cos(4 * th)), 3))
  tingir(t.acento, cob(r - rs))
  tingir(t.fio, cob(r - g.Rc * 0.08))
}

function campo(u: number, v: number, g: GeometriaDaHaste, t: CoresDaHaste): void {
  pintar(t.campo)
  const au = Math.abs(u)
  const av = Math.abs(v)
  // O painel recortado nos cantos, com o fio em volta e um losango de acento em cada recorte.
  const sd = Math.max(Math.max(au - g.Pu, av - g.Pv), -Math.max(g.Pu - g.n - au, g.Pv - g.n - av))
  tingir(t.fundo, cob(sd))
  tingir(t.fio, cob(Math.abs(sd) - 0.009) * 0.9)
  const nx = g.Pu - g.n * 0.42
  const ny = g.Pv - g.n * 0.42
  tingir(t.acento, cob((Math.abs(au - nx) + Math.abs(av - ny)) * 0.7 - 0.035))
  if (g.temHaste) haste(u, v, au, av, g, t)
  medalhao(u, v, g, t)
}

function corpo(u: number, v: number, g: GeometriaDaHaste, t: CoresDaHaste): void {
  const a = g.hu - Math.abs(u)
  const b = g.hv - Math.abs(v)
  const de = Math.min(a, b)
  const kB = cob(de - g.B)
  if (kB < 1) campo(u, v, g, t)
  if (kB <= 0) return
  if (kB < 1) GUARDA.set(C)
  moldura(u, v, a, b, de, g, t)
  if (kB < 1) {
    const r = 1 - kB
    C[0] += (GUARDA[0] - C[0]) * r
    C[1] += (GUARDA[1] - C[1]) * r
    C[2] += (GUARDA[2] - C[2]) * r
  }
}

// ---------- pelo e desgaste ----------

/** O fio cru que aparece onde a lã gastou. */
const URDIDURA = hex('#b9ad93')

/** Deslocamento do ruído por semente, dentro do período de 256 da tabela. */
function deslocamento(semente: number, k: number): number {
  return ((semente * 37.17 + k * 61.3) % 256 + 256) % 256
}

/** A lã: o abrash (faixas largas de tom), o pelo miúdo e o grão por pixel; depois o desgaste do meio. */
function pelo(u: number, v: number, ix: number, iy: number, g: GeometriaDaHaste, semente: number): void {
  const k =
    1 +
    ruido(u * 0.55 + deslocamento(semente, 3), v * 0.4 + 1.7) * 0.11 +
    ruido(u * 3.2 + deslocamento(semente, 4), v * 3.2) * 0.05 +
    ruido(u * 34 + deslocamento(semente, 5), v * 34) * 0.08 +
    (hash(ix, iy, semente + 6) - 0.5) * 0.045
  C[0] *= k
  C[1] *= k
  C[2] *= k
  const trafego =
    g.L / g.Wd > RAZAO_DO_DESGASTE_AO_LONGO
      ? Math.exp(-(v * v) / (0.4 * g.hv * g.hv))
      : Math.exp(-(u * u + v * v) / (0.55 * Math.min(g.hu, g.hv) ** 2))
  const o = deslocamento(semente, 21)
  const fbm = 0.5 + ruido(u * 1.15 + o, v * 1.15) * 0.62 + ruido(u * 2.45 + o + 7, v * 2.45) * 0.38
  const w = suave(0.5, 0.88, fbm * 0.72 + trafego * 0.36) * DESGASTE
  if (w <= 0) return
  const lum = C[0] * 0.3 + C[1] * 0.59 + C[2] * 0.11
  const a1 = w * 0.42
  const a2 = w * 0.32
  for (let i = 0; i < 3; i += 1) {
    C[i] += (lum - C[i]) * a1
    C[i] += (URDIDURA[i] - C[i]) * a2
  }
  if (hash(ix, iy, semente + 31) < w * 0.16) for (let i = 0; i < 3; i += 1) C[i] += (URDIDURA[i] - C[i]) * 0.45
}

/** O corpo do tapete: o desenho C com a lã por cima. U ao longo, V atravessado. */
export function texHaste(t: CoresDaHaste, g: GeometriaDaHaste, deitado: boolean): Textura {
  return (_u, _v, x, y, p, s, S) => {
    SC = S * G
    const u = (deitado ? x : y) / G
    const v = (deitado ? y : x) / G
    corpo(u, v, g, t)
    pelo(u, v, Math.floor(x * S), Math.floor(y * S), g, p.semente)
    s[0] = C[0]
    s[1] = C[1]
    s[2] = C[2]
  }
}

// ---------- a franja ----------

const COR_DA_FRANJA = hex('#d5c8a9')
const COR_DO_NO = hex('#b3a282')
/** Largura de um fio da franja (casas) e quantos fios vão em cada nó. */
const FIO_DA_FRANJA = 0.034
const FIOS_POR_NO = 5

/** Os fios da franja, cada um de um comprimento, com a ponta mais clara e um nó a cada 5 fios na raiz. */
export function texFranjaComNos(g: GeometriaDaHaste, deitado: boolean): Textura {
  const fr = g.L / 2 - g.hu
  return (_u, _v, x, y, p, s, S) => {
    SC = S * G
    const u = (deitado ? x : y) / G
    const v = (deitado ? y : x) / G
    const fora = Math.abs(u) - g.hu
    const lado = u < 0 ? 0 : 1
    const tw = FIO_DA_FRANJA
    const vv = v + g.hv
    const k = Math.floor(vv / tw)
    const onda = Math.sin(fora * 55 + k * 1.7) * 0.004
    const fv = vv / tw - k
    const comp = fr * (0.64 + 0.36 * hash(k, lado, p.semente + 51))
    let alfa = cob(Math.abs((fv - 0.5) * tw + onda) - tw * 0.32) * cob(fora - comp)
    // A ponta do fio clareia, a raiz escurece.
    const tom = (0.9 + 0.14 * hash(k, lado, p.semente + 52)) * (0.88 + 0.12 * clamp01(fora / Math.max(comp, 0.01)))
    C[0] = COR_DA_FRANJA[0] * tom
    C[1] = COR_DA_FRANJA[1] * tom
    C[2] = COR_DA_FRANJA[2] * tom
    const grupo = Math.floor(vv / (tw * FIOS_POR_NO))
    const centro = (grupo + 0.5) * tw * FIOS_POR_NO
    const no = cob(Math.hypot((vv - centro) / 2.2, (fora - 0.014) * 1.4) - 0.022)
    if (no > 0) {
      tingir(COR_DO_NO, no)
      alfa += no * (1 - alfa)
    }
    if (fora < 0) alfa = Math.max(alfa, cob(-0.004 - fora))
    s[0] = C[0]
    s[1] = C[1]
    s[2] = C[2]
    s[5] = alfa
  }
}

// ---------- montagem ----------

/**
 * Monta o tapete retangular de cima (o `tapete` e o `tapeteLongo`): a sombra
 * rente, a franja nas pontas curtas e o corpo. O comprimento corre no lado maior.
 */
export function montarTapeteComHaste(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const deitado = w >= h
  const hu = deitado ? hw : hh
  const hv = deitado ? hh : hw
  const g = geometriaDaHaste((2 * hu) / G, (2 * hv) / G)
  const corpoHU = g.hu * G
  const noMundo = (u0: number, v0: number, u1: number, v1: number, raio: number) => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio))
  const forma = noMundo(-corpoHU, -hv, corpoHU, hv, 1.2)
  cena.sombras.push({ forma, ...SOMBRA_DO_TAPETE })
  const franja = texFranjaComNos(g, deitado)
  for (const ponta of [-1, 1]) {
    const u0 = ponta < 0 ? -hu : corpoHU - 1
    const u1 = ponta < 0 ? -corpoHU + 1 : hu
    cena.partes.push(P(noMundo(u0, -hv + 1.5, u1, hv - 1.5, 0), materialDaPeca('linho'), { textura: franja, bisel: 0, contorno: 0 }))
  }
  const tecido = c.m.tecido
  cena.partes.push(P(forma, tecido, { textura: texHaste(coresDaHaste(tecido.rgb), g, deitado), bisel: 1.4, contorno: 0.16 }))
}
