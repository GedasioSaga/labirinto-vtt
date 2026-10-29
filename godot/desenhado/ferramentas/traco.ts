/**
 * A CONTA DE REFERÊNCIA DO TRAÇO (onda 5, CONTRATO.md seção 11): como o app deita a face
 * e a borda de um traço Desenhado ao longo da beira de um barranco ou penhasco. Usa a
 * geometria do PRÓPRIO app (GeoDoBarranco de client/src/lib/barranco.ts: a beira, a normal
 * de cada trecho para o lado baixo, a de cada ponto em esquadro e a espessura de cada ponto),
 * então o que a mesa mostra é o que o app mostra se ele fizer esta conta.
 *
 * O Atual também sai daqui: o mesmo desenho de pixi/drawBarranco.ts (Meio-Termo), pelas
 * funções de cor do app (corDoBarranco, contornoDoTom, misturar), na mesma geometria. Os
 * polígonos dele viram a mesma varredura por trecho (as faixas do app são exatamente as
 * linhas de v constante desta conta).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { corridas, escalaDoBarranco, type GeoDoBarranco } from '@cliente/lib/barranco'
import { contornoDoTom, corDoBarranco, LARGURA_DO_CONTORNO, TONS_DO_BARRANCO } from '@cliente/texturas/meioTermo/barranco'
import { PALETA_MEIO_TERMO } from '@cliente/texturas/meioTermo/paleta'
import { hash, misturar, rgb, type Rgb } from '@cliente/texturas/ruido'
import { lerPng, type Imagem } from './png'

export const LUZ: readonly [number, number] = [-Math.SQRT1_2, -Math.SQRT1_2]
export type Altura = 'baixo' | 'medio' | 'alto'
export const ALTURAS: readonly Altura[] = ['baixo', 'medio', 'alto']

// ---------- os arquivos ----------

export interface ModuloDaFace { readonly casas: number; readonly comprimentoPx: number; readonly xPx: number; readonly larguraPx: number }
export interface ParamsDaFace {
  readonly id: string
  readonly parte: 'face'
  readonly alturas: Record<Altura, { hPx: number; arquivos: { cor: string; relevo: string } }>
  readonly face: { modulos: ModuloDaFace[]; acimaPx: number; abaixoPx: number }
  readonly sequencia: { semente: number }
  readonly luz: { face: number; relevo: number }
  readonly sombra: { jeito: 'pe' | 'nenhuma'; comprimentoPx: number; borraoPx: number; cor: string; alfa: number }
  readonly tingir: unknown
  readonly borda: string | null
}
export interface LinhaDaBorda { readonly nome: string; readonly ancora: 'beira' | 'pe'; readonly chao: readonly string[]; readonly yPx: number }
export interface ParamsDaBorda { readonly id: string; readonly parte: 'borda'; readonly borda: { arquivo: string; comprimentoPx: number; acimaPx: number; abaixoPx: number; linhaPx: number; linhas: LinhaDaBorda[] } }

/** Uma imagem em ponto flutuante, cor PRÉ-multiplicada (para filtrar sem franja). */
export interface Amostra { readonly w: number; readonly h: number; readonly px: Float32Array }
export interface FaceCarregada { readonly p: ParamsDaFace; readonly cor: Record<Altura, Amostra>; readonly relevo: Record<Altura, Amostra> }
export interface BordaCarregada { readonly p: ParamsDaBorda; readonly img: Amostra }

function amostraDe(img: Imagem, premultiplicar: boolean): Amostra {
  const px = new Float32Array(img.w * img.h * 4)
  for (let i = 0; i < img.w * img.h; i += 1) {
    const a = img.px[i * 4 + 3] / 255
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = (img.px[i * 4 + k] / 255) * (premultiplicar ? a : 1)
    px[i * 4 + 3] = a
  }
  return { w: img.w, h: img.h, px }
}

export function carregarFace(pasta: string): FaceCarregada {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParamsDaFace
  const cor = {} as Record<Altura, Amostra>
  const relevo = {} as Record<Altura, Amostra>
  for (const a of ALTURAS) {
    cor[a] = amostraDe(lerPng(join(pasta, p.alturas[a].arquivos.cor)), true)
    relevo[a] = amostraDe(lerPng(join(pasta, p.alturas[a].arquivos.relevo)), false)
  }
  return { p, cor, relevo }
}

export function carregarBorda(pasta: string): BordaCarregada {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParamsDaBorda
  return { p, img: amostraDe(lerPng(join(pasta, p.borda.arquivo)), true) }
}

/** Bilinear, a borda presa (o módulo nunca lê além da folga). */
function ler(a: Amostra, x: number, y: number, s: number[]): void {
  const u = Math.min(a.w - 1, Math.max(0, x - 0.5))
  const v = Math.min(a.h - 1, Math.max(0, y - 0.5))
  const iu = Math.floor(u)
  const iv = Math.floor(v)
  const tu = u - iu
  const tv = v - iv
  const iu1 = Math.min(a.w - 1, iu + 1)
  const iv1 = Math.min(a.h - 1, iv + 1)
  for (let k = 0; k < 4; k += 1) {
    const p00 = a.px[(iv * a.w + iu) * 4 + k]
    const p10 = a.px[(iv * a.w + iu1) * 4 + k]
    const p01 = a.px[(iv1 * a.w + iu) * 4 + k]
    const p11 = a.px[(iv1 * a.w + iu1) * 4 + k]
    s[k] = (p00 * (1 - tu) + p10 * tu) * (1 - tv) + (p01 * (1 - tu) + p11 * tu) * tv
  }
}

// ---------- a sequência de módulos (11.4) ----------

/** O hash do id do traço (FNV-1a de 32 bits): risco = o id; área = "area:<nível>:<n>". */
export function hashDoId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) & 0x7fffffff
}

export interface PedacoDaSequencia { readonly s0: number; readonly s1: number; readonly m: number; readonly espelho: boolean }

/**
 * Os módulos ao longo de uma beira de `len` px do mundo (a 64 px por casa). No laço fechado
 * os comprimentos escalam para fechar exatamente no começo (sem meio módulo).
 */
export function sequenciaDeModulos(face: ParamsDaFace, id: string, len: number, fechado: boolean): PedacoDaSequencia[] {
  const mods = face.face.modulos
  const N = mods.length
  const sem = face.sequencia.semente + hashDoId(id)
  const lista: { m: number; espelho: boolean; L: number }[] = []
  let soma = 0
  let antes = -1
  for (let j = 0; soma < len || lista.length === 0; j += 1) {
    let m = Math.min(N - 1, Math.floor(hash(j, 0, sem) * N))
    if (N > 1 && m === antes) m = (m + 1) % N
    antes = m
    lista.push({ m, espelho: hash(j, 1, sem) < 0.5, L: mods[m].comprimentoPx })
    soma += mods[m].comprimentoPx
    if (j > 10000) break
  }
  // Fechado: o último entra ou sai pelo que fica mais perto, e todos escalam.
  if (fechado && lista.length > 1 && soma - len > lista[lista.length - 1].L / 2) {
    soma -= lista[lista.length - 1].L
    lista.pop()
  }
  const k = fechado ? len / soma : 1
  const out: PedacoDaSequencia[] = []
  let s = 0
  for (const q of lista) {
    out.push({ s0: s, s1: s + q.L * k, m: q.m, espelho: q.espelho })
    s += q.L * k
  }
  return out
}

function pedacoEm(seq: readonly PedacoDaSequencia[], s: number): PedacoDaSequencia {
  let lo = 0
  let hi = seq.length - 1
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (seq[m].s0 <= s) lo = m
    else hi = m - 1
  }
  return seq[lo]
}

// ---------- a tela ----------

export interface Tela { readonly w: number; readonly h: number; readonly px: Float32Array }

export function telaDe(img: Imagem): Tela {
  const px = new Float32Array(img.w * img.h * 3)
  for (let i = 0; i < img.w * img.h; i += 1) for (let k = 0; k < 3; k += 1) px[i * 3 + k] = img.px[i * 4 + k] / 255
  return { w: img.w, h: img.h, px }
}

export function imagemDe(t: Tela): Imagem {
  const px = new Uint8ClampedArray(t.w * t.h * 4)
  for (let i = 0; i < t.w * t.h; i += 1) {
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = Math.round(t.px[i * 3 + k] * 255)
    px[i * 4 + 3] = 255
  }
  return { w: t.w, h: t.h, px }
}

/** Pinta a cor c (0..1) com cobertura a no pixel o. */
function sobre(t: Tela, o: number, c: readonly number[], a: number): void {
  if (a <= 0) return
  for (let k = 0; k < 3; k += 1) t.px[o * 3 + k] = t.px[o * 3 + k] * (1 - a) + c[k] * a
}

/** Pinta uma cor pré-multiplicada (r, g, b, a). */
function sobrePre(t: Tela, o: number, s: readonly number[]): void {
  if (s[3] <= 0) return
  for (let k = 0; k < 3; k += 1) t.px[o * 3 + k] = s[k] + t.px[o * 3 + k] * (1 - s[3])
}

/** Desfoque de caixa em 3 passadas (aproxima o gaussiano de desvio sigma). */
export function desfocar(a: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.3) return a
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2 - 0.5))
  let src = a
  for (let passada = 0; passada < 3; passada += 1) {
    const tmp = new Float32Array(w * h)
    for (let y = 0; y < h; y += 1) {
      let acc = 0
      for (let x = -r; x <= r; x += 1) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x += 1) {
        tmp[y * w + x] = acc / (2 * r + 1)
        acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]
      }
    }
    const out = new Float32Array(w * h)
    for (let x = 0; x < w; x += 1) {
      let acc = 0
      for (let y = -r; y <= r; y += 1) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y += 1) {
        out[y * w + x] = acc / (2 * r + 1)
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
      }
    }
    src = out
  }
  return src
}

// ---------- a varredura de uma faixa da beira ----------

type Pt = readonly [number, number]

function cruz(a: Pt, b: Pt): number {
  return a[0] * b[1] - a[1] * b[0]
}

/**
 * Para cada pixel entre as duas linhas lip + vn * de(i) e lip + vn * ate(i) de um trecho
 * (i -> j), chama cb(o, u, v) com u ao longo do trecho (0..1) e v de "de" a "ate" (0..1),
 * a inversa exata do quadrilátero (as faixas do app são as linhas de v constante).
 * vMargem: aceita v um pouco fora (para a borda suave do Atual).
 */
function varrerTrecho(geo: GeoDoBarranco, i: number, j: number, de: (i: number) => number, ate: (i: number) => number, t: Tela, ox: number, oy: number, vMargem: number, cb: (o: number, u: number, v: number, hq: number) => void): void {
  const L = geo.lip
  const N = geo.vn
  const q0: Pt = [L[i][0] + N[i][0] * de(i), L[i][1] + N[i][1] * de(i)]
  const q1: Pt = [L[j][0] + N[j][0] * de(j), L[j][1] + N[j][1] * de(j)]
  const q2: Pt = [L[j][0] + N[j][0] * ate(j), L[j][1] + N[j][1] * ate(j)]
  const q3: Pt = [L[i][0] + N[i][0] * ate(i), L[i][1] + N[i][1] * ate(i)]
  const xs = [q0[0], q1[0], q2[0], q3[0]]
  const ys = [q0[1], q1[1], q2[1], q3[1]]
  const X0 = Math.max(0, Math.floor(Math.min(...xs) - ox - 2))
  const X1 = Math.min(t.w - 1, Math.ceil(Math.max(...xs) - ox + 2))
  const Y0 = Math.max(0, Math.floor(Math.min(...ys) - oy - 2))
  const Y1 = Math.min(t.h - 1, Math.ceil(Math.max(...ys) - oy + 2))
  if (X0 > X1 || Y0 > Y1) return
  const e: Pt = [q1[0] - q0[0], q1[1] - q0[1]]
  const f: Pt = [q3[0] - q0[0], q3[1] - q0[1]]
  const g: Pt = [q0[0] - q1[0] + q2[0] - q3[0], q0[1] - q1[1] + q2[1] - q3[1]]
  const k2 = cruz(g, f)
  for (let Y = Y0; Y <= Y1; Y += 1) {
    for (let X = X0; X <= X1; X += 1) {
      const h: Pt = [X + 0.5 + ox - q0[0], Y + 0.5 + oy - q0[1]]
      const k1 = cruz(e, f) + cruz(h, g)
      const k0 = cruz(h, e)
      const vs: number[] = []
      if (Math.abs(k2) < 1e-7) {
        if (Math.abs(k1) > 1e-9) vs.push(-k0 / k1)
      } else {
        const w = k1 * k1 - 4 * k0 * k2
        if (w < 0) continue
        const r = Math.sqrt(w)
        vs.push((-k1 - r) / (2 * k2), (-k1 + r) / (2 * k2))
      }
      for (const v of vs) {
        if (v < -vMargem || v > 1 + vMargem) continue
        const ex = e[0] + g[0] * v
        const ey = e[1] + g[1] * v
        const l2 = ex * ex + ey * ey
        if (l2 < 1e-9) continue
        const u = ((h[0] - f[0] * v) * ex + (h[1] - f[1] * v) * ey) / l2
        if (u < -1e-4 || u > 1 + 1e-4) continue
        const hq = Math.hypot(q3[0] - q0[0] + (q2[0] - q1[0] - q3[0] + q0[0]) * u, q3[1] - q0[1] + (q2[1] - q1[1] - q3[1] + q0[1]) * u)
        cb(Y * t.w + X, Math.min(1, Math.max(0, u)), v, hq)
        break
      }
    }
  }
}

/** Os trechos (i, j) de cada corrida de uma beira (as rampas já cortadas pelo app). */
function trechosDe(geo: GeoDoBarranco): { i: number; j: number }[] {
  const n = geo.lip.length
  const out: { i: number; j: number }[] = []
  for (const c of corridas(geo)) {
    const idx = c.fechada ? [...c.idx, c.idx[0]] : c.idx
    for (let k = 0; k + 1 < idx.length; k += 1) out.push({ i: idx[k], j: idx[k + 1] % n })
  }
  return out
}

function sDe(geo: GeoDoBarranco, i: number, j: number, u: number): number {
  const sj = j === 0 && i !== 0 ? geo.len : geo.s[j]
  return geo.s[i] + (sj - geo.s[i]) * u
}

// ---------- a imagem pela espessura vista ----------

/**
 * A imagem de cada módulo sai da espessura VISTA no meio dele (CONTRATO.md 11.4), não da
 * altura da beira: abaixo de 26 px do mundo usa a do Baixo, abaixo de 40 a do Médio, senão
 * a do Alto; nunca acima da altura da beira. A face do norte de um paredão Alto (36% da
 * espessura) usa a do Baixo: só terra, sem rocha espremida.
 */
export const LIMITES_DA_ESCOLHA: readonly [number, number] = [26, 40]

export function alturaDaVista(tMundo: number, teto: Altura): Altura {
  const a: Altura = tMundo < LIMITES_DA_ESCOLHA[0] ? 'baixo' : tMundo < LIMITES_DA_ESCOLHA[1] ? 'medio' : 'alto'
  return ALTURAS.indexOf(a) < ALTURAS.indexOf(teto) ? a : teto
}

/** A espessura da beira no comprimento s (px da tela, como geo.s). */
function tEm(geo: GeoDoBarranco, s: number): number {
  const n = geo.s.length
  if (n === 0) return 0
  if (s <= geo.s[0]) return geo.t[0]
  if (s >= geo.s[n - 1]) {
    if (!geo.fechado || geo.len <= geo.s[n - 1]) return geo.t[n - 1]
    const u = (s - geo.s[n - 1]) / (geo.len - geo.s[n - 1])
    return geo.t[n - 1] + (geo.t[0] - geo.t[n - 1]) * Math.min(1, u)
  }
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (geo.s[m] <= s) lo = m
    else hi = m
  }
  const u = (s - geo.s[lo]) / Math.max(1e-6, geo.s[hi] - geo.s[lo])
  return geo.t[lo] + (geo.t[hi] - geo.t[lo]) * u
}

// ---------- o Desenhado ----------

export interface OpcoesDoTraco {
  /** A altura de cada beira (o risco tem uma; a área, a dos quadrados dela). */
  readonly alturaDe: (geo: GeoDoBarranco) => Altura
  /** A linha da borda de cima de cada beira (o chão do lado alto): o nome de uma linha "beira". */
  readonly bordaDe?: (geo: GeoDoBarranco) => string | null
  /** A linha "pe" (o pé molhado) só onde o lado baixo é água. */
  readonly peDe?: (geo: GeoDoBarranco) => string | null
  readonly grid: number
  readonly ox: number
  readonly oy: number
}

function realceDe(c: readonly number[]): number[] {
  return [0, 1, 2].map((k) => (c[k] * 1.1) * (1 - 0.08) + [0.98, 0.93, 0.7][k] * 0.08)
}

/** A luz do app sobre uma cor (11.5): a face pela normal do trecho, o relevo pela da imagem. */
function acender(c: number[], l: number): void {
  if (l >= 0) {
    const r = realceDe(c)
    for (let k = 0; k < 3; k += 1) c[k] = c[k] + (r[k] - c[k]) * Math.min(1, l)
  } else {
    for (let k = 0; k < 3; k += 1) c[k] = c[k] * (1 - 0.3 * Math.min(1, -l))
  }
}

const SOMBRA_DA_FAMILIA = rgb('#0a1c28').map((v) => v / 255)

function pintarSombraDesenhada(t: Tela, geos: readonly GeoDoBarranco[], face: FaceCarregada, o: OpcoesDoTraco): void {
  const sb = face.p.sombra
  if (sb.jeito === 'nenhuma') return
  const k = o.grid / 64
  const cob = new Float32Array(t.w * t.h)
  for (const geo of geos) {
    for (const { i, j } of trechosDe(geo)) {
      if (geo.t[i] < 0.4 && geo.t[j] < 0.4) continue
      const deCostas = (q: number): number => Math.max(0, -(geo.un[q][0] * LUZ[0] + geo.un[q][1] * LUZ[1]))
      varrerTrecho(geo, i, j, (q) => geo.t[q] * 0.5, (q) => geo.t[q] + sb.comprimentoPx * k + geo.t[q] * 1.05 * deCostas(q), t, o.ox, o.oy, 0, (px) => {
        cob[px] = 1
      })
    }
  }
  const b = desfocar(cob, t.w, t.h, sb.borraoPx * k * 0.5)
  for (let i = 0; i < t.w * t.h; i += 1) sobre(t, i, SOMBRA_DA_FAMILIA, b[i] * sb.alfa)
}

function pintarFaceDesenhada(t: Tela, geo: GeoDoBarranco, face: FaceCarregada, o: OpcoesDoTraco): void {
  const k = o.grid / 64
  const alt = o.alturaDe(geo)
  const H = face.p.alturas[alt].hPx
  const a = face.p.face.acimaPx / H
  const b = face.p.face.abaixoPx / H
  const seq = sequenciaDeModulos(face.p, geo.id, geo.len / k, geo.fechado)
  const altDoPedaco = new Map<PedacoDaSequencia, Altura>()
  for (const pd of seq) altDoPedaco.set(pd, alturaDaVista(tEm(geo, ((pd.s0 + pd.s1) / 2) * k) / k, alt))
  const feito = new Uint8Array(t.w * t.h)
  const s4 = [0, 0, 0, 0]
  const r4 = [0, 0, 0, 0]
  const c = [0, 0, 0]
  for (const { i, j } of trechosDe(geo)) {
    if (geo.t[i] < 0.2 && geo.t[j] < 0.2) continue
    const sn = geo.sn[i]
    // O referencial da face: "baixo" = a normal do trecho para o lado baixo; "ao longo" = ela
    // girada um quarto de volta (no sul, o leste). A imagem anda sempre para "ao longo".
    const along: Pt = [sn[1], -sn[0]]
    const tx = geo.lip[j][0] - geo.lip[i][0]
    const ty = geo.lip[j][1] - geo.lip[i][1]
    const contra = tx * along[0] + ty * along[1] < 0
    const lFace = face.p.luz.face * (sn[0] * LUZ[0] + sn[1] * LUZ[1])
    varrerTrecho(geo, i, j, (q) => -a * geo.t[q], (q) => (1 + b) * geo.t[q], t, o.ox, o.oy, 0, (px, u, v) => {
      if (feito[px]) return
      feito[px] = 1
      const f = -a + v * (1 + a + b)
      const s = sDe(geo, i, j, u) / k
      const pd = pedacoEm(seq, Math.min(Math.max(0, s), geo.len / k - 1e-6))
      const m = face.p.face.modulos[pd.m]
      let x = ((s - pd.s0) / (pd.s1 - pd.s0)) * m.comprimentoPx
      if (contra) x = m.comprimentoPx - x
      if (pd.espelho) x = m.comprimentoPx - x
      const ap = altDoPedaco.get(pd) ?? alt
      const xi = m.xPx + 2 * x
      const yi = 2 * (face.p.face.acimaPx + f * face.p.alturas[ap].hPx)
      ler(face.cor[ap], xi, yi, s4)
      if (s4[3] <= 1e-4) return
      ler(face.relevo[ap], xi, yi, r4)
      const rx = (2 * r4[0] - 1) * (pd.espelho ? -1 : 1)
      const ry = 2 * r4[1] - 1
      const nx = rx * along[0] + ry * sn[0]
      const ny = rx * along[1] + ry * sn[1]
      const l = lFace + face.p.luz.relevo * (nx * LUZ[0] + ny * LUZ[1])
      for (let q = 0; q < 3; q += 1) c[q] = s4[q] / s4[3]
      acender(c, l)
      sobre(t, px, c, s4[3])
    })
  }
}

function pintarBordaDesenhada(t: Tela, geo: GeoDoBarranco, borda: BordaCarregada, nome: string, face: FaceCarregada, o: OpcoesDoTraco): void {
  const k = o.grid / 64
  const bp = borda.p.borda
  const linha = bp.linhas.find((l) => l.nome === nome)
  if (linha === undefined) return
  const H = face.p.alturas[o.alturaDe(geo)].hPx * k
  const desvio = hash(0, 2, hashDoId(geo.id)) * bp.comprimentoPx
  const s4 = [0, 0, 0, 0]
  const feito = new Uint8Array(t.w * t.h)
  const noPe = linha.ancora === 'pe'
  for (const { i, j } of trechosDe(geo)) {
    if (geo.t[i] < 0.2 && geo.t[j] < 0.2) continue
    const ancora = (q: number): number => (noPe ? geo.t[q] : 0)
    varrerTrecho(geo, i, j, (q) => ancora(q) - bp.acimaPx * k, (q) => ancora(q) + bp.abaixoPx * k, t, o.ox, o.oy, 0, (px, u, v) => {
      if (feito[px]) return
      feito[px] = 1
      const tq = geo.t[i] + (geo.t[j] - geo.t[i]) * u
      const fade = suave(0, 0.25, tq / H)
      if (fade <= 0) return
      const s = sDe(geo, i, j, u) / k
      const x = 2 * ((((s + desvio) % bp.comprimentoPx) + bp.comprimentoPx) % bp.comprimentoPx)
      const y = linha.yPx + 2 * v * (bp.acimaPx + bp.abaixoPx)
      ler(borda.img, Math.min(x, borda.img.w - 0.5), Math.min(y, linha.yPx + bp.linhaPx - 0.5), s4)
      for (let q = 0; q < 4; q += 1) s4[q] *= fade
      sobrePre(t, px, s4)
    })
  }
}

function suave(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

/** O alto de uma área, mais claro a cada degrau (pixi/drawBarranco.ts, pintarTopo). */
function pintarTopo(t: Tela, geos: readonly GeoDoBarranco[], nivel: number, alfa: number, o: OpcoesDoTraco): void {
  const lacos = geos.map((g) => g.lip)
  if (lacos.length === 0) return
  const cor = rgb('#fff3dc').map((v) => v / 255)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const l of lacos) for (const p of l) {
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1])
  }
  const X0 = Math.max(0, Math.floor(x0 - o.ox)); const X1 = Math.min(t.w - 1, Math.ceil(x1 - o.ox))
  const Y0 = Math.max(0, Math.floor(y0 - o.oy)); const Y1 = Math.min(t.h - 1, Math.ceil(y1 - o.oy))
  for (let Y = Y0; Y <= Y1; Y += 1) {
    const py = Y + 0.5 + o.oy
    for (let X = X0; X <= X1; X += 1) {
      const px = X + 0.5 + o.ox
      let dentro = false
      for (const l of lacos) {
        for (let a = 0, b = l.length - 1; a < l.length; b = a, a += 1) {
          if (l[a][1] > py !== l[b][1] > py && px < ((l[b][0] - l[a][0]) * (py - l[a][1])) / (l[b][1] - l[a][1]) + l[a][0]) dentro = !dentro
        }
      }
      if (dentro) sobre(t, Y * t.w + X, cor, alfa * nivel)
    }
  }
}

/**
 * O barranco Desenhado inteiro, na ordem do app (pixi/drawBarranco.ts): nível por nível, a
 * sombra no de baixo, a face, o alto mais claro e a borda; os riscos por último.
 */
export function pintarDesenhado(t: Tela, geos: readonly GeoDoBarranco[], face: FaceCarregada, borda: BordaCarregada | null, o: OpcoesDoTraco): void {
  const grupos: { lista: GeoDoBarranco[]; nivel: number }[] = []
  for (let k = 1; k <= 3; k += 1) grupos.push({ lista: geos.filter((g) => g.tipo === 'area' && g.nivel === k), nivel: k })
  grupos.push({ lista: geos.filter((g) => g.tipo === 'risco'), nivel: 0 })
  for (const { lista, nivel } of grupos) {
    if (lista.length === 0) continue
    pintarSombraDesenhada(t, lista, face, o)
    for (const g of lista) pintarFaceDesenhada(t, g, face, o)
    if (nivel > 0) pintarTopo(t, lista, nivel, 0.06, o)
    if (borda !== null) {
      for (const g of lista) {
        const pe = o.peDe?.(g) ?? null
        if (pe !== null) pintarBordaDesenhada(t, g, borda, pe, face, o)
        const b = o.bordaDe?.(g) ?? null
        if (b !== null) pintarBordaDesenhada(t, g, borda, b, face, o)
      }
    }
  }
}

// ---------- o Atual (pixi/drawBarranco.ts, estilo Meio-Termo) ----------

const LUZ_DO_APP: Rgb = rgb('#fff3dc')
const SOMBRA_NO_CHAO: Rgb = contornoDoTom(rgb(PALETA_MEIO_TERMO.ardosia.base))
const FAIXAS_DA_SOMBRA: readonly (readonly [number, number])[] = [[1, 0.1], [0.72, 0.1], [0.45, 0.1]]

function corDaFaixaDoApp(faixa: number, face: number): number[] {
  const base: Rgb = corDoBarranco((faixa + 0.5) / 6)
  const f = face / 12
  const c = f > 0 ? misturar(base, LUZ_DO_APP, f * 0.42 * 0.45) : misturar(base, TONS_DO_BARRANCO.contorno, -f * 0.45 * 0.55)
  return [Math.round(c[0]) / 255, Math.round(c[1]) / 255, Math.round(c[2]) / 255]
}

function distanciaAoTraco(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const u = l2 > 0 ? Math.min(1, Math.max(0, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0
  return Math.hypot(px - a[0] - dx * u, py - a[1] - dy * u)
}

/** Uma linha de pontos com largura w, ponta e junta redondas (o stroke do Pixi). */
function pintarLinha(t: Tela, pts: readonly Pt[], w: number, cor: readonly number[], alfa: number, o: OpcoesDoTraco): void {
  const cob = new Float32Array(t.w * t.h)
  for (let q = 0; q + 1 < pts.length; q += 1) {
    const a = pts[q]
    const b = pts[q + 1]
    const X0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - w - o.ox)); const X1 = Math.min(t.w - 1, Math.ceil(Math.max(a[0], b[0]) + w - o.ox))
    const Y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - w - o.oy)); const Y1 = Math.min(t.h - 1, Math.ceil(Math.max(a[1], b[1]) + w - o.oy))
    for (let Y = Y0; Y <= Y1; Y += 1) for (let X = X0; X <= X1; X += 1) {
      const d = distanciaAoTraco(X + 0.5 + o.ox, Y + 0.5 + o.oy, a, b)
      const c = Math.min(1, Math.max(0, w / 2 - d + 0.5))
      if (c > cob[Y * t.w + X]) cob[Y * t.w + X] = c
    }
  }
  for (let i = 0; i < t.w * t.h; i += 1) if (cob[i] > 0) sobre(t, i, cor, cob[i] * alfa)
}

export function pintarAtual(t: Tela, geos: readonly GeoDoBarranco[], o: OpcoesDoTraco): void {
  const esc = escalaDoBarranco(o.grid)
  const sombra = SOMBRA_NO_CHAO.map((v) => v / 255)
  const contorno = TONS_DO_BARRANCO.contorno.map((v) => v / 255)
  const luz = LUZ_DO_APP.map((v) => v / 255)
  const passo = (lista: readonly GeoDoBarranco[], nivel: number): void => {
    for (const geo of lista) {
      for (const [ate, alfa] of FAIXAS_DA_SOMBRA) {
        const cob = new Uint8Array(t.w * t.h)
        for (const { i, j } of trechosDe(geo)) {
          const inteira = (q: number): number => geo.t[q] + 3 * esc + geo.t[q] * 1.05 * Math.max(0, -(geo.un[q][0] * LUZ[0] + geo.un[q][1] * LUZ[1]))
          varrerTrecho(geo, i, j, (q) => geo.t[q] * 0.5, (q) => geo.t[q] * 0.5 + (inteira(q) - geo.t[q] * 0.5) * ate, t, o.ox, o.oy, 0, (px) => { cob[px] = 1 })
        }
        for (let i = 0; i < t.w * t.h; i += 1) if (cob[i]) sobre(t, i, sombra, alfa)
      }
    }
    for (const geo of lista) {
      const feito = new Uint8Array(t.w * t.h)
      for (const { i, j } of trechosDe(geo)) {
        if (geo.t[i] < 0.4 && geo.t[j] < 0.4) continue
        const sn = geo.sn[i]
        const face = Math.round((sn[0] * LUZ[0] + sn[1] * LUZ[1]) * 12)
        varrerTrecho(geo, i, j, () => 0, (q) => geo.t[q], t, o.ox, o.oy, 0.5, (px, _u, v, hq) => {
          if (feito[px]) return
          const c = Math.min(1, Math.max(0, Math.min(v * hq + 0.5, (1 - v) * hq + 0.5)))
          if (c >= 1) feito[px] = 1
          const faixa = Math.min(5, Math.max(0, Math.floor(v * 6)))
          sobre(t, px, corDaFaixaDoApp(faixa, face), c)
        })
      }
      for (const c of corridas(geo)) {
        const idx = (c.fechada ? [...c.idx, c.idx[0]] : c.idx).filter((i) => geo.t[i] > 0.6 * esc || c.fechada)
        const pes: Pt[] = idx.map((i) => [geo.lip[i][0] + geo.vn[i][0] * geo.t[i], geo.lip[i][1] + geo.vn[i][1] * geo.t[i]])
        if (pes.length > 1) pintarLinha(t, pes, LARGURA_DO_CONTORNO * esc, contorno, 1, o)
      }
    }
    if (nivel > 0) pintarTopo(t, lista, nivel, 0.07, o)
    for (const geo of lista) {
      for (const c of corridas(geo)) {
        const idx = c.fechada ? [...c.idx, c.idx[0]] : c.idx
        const pts: Pt[] = idx.map((i) => [geo.lip[i][0] - geo.un[i][0] * 0.9 * esc, geo.lip[i][1] - geo.un[i][1] * 0.9 * esc])
        if (pts.length > 1) pintarLinha(t, pts, 1.7 * esc, luz, 0.45, o)
      }
    }
  }
  for (let k = 1; k <= 3; k += 1) passo(geos.filter((g) => g.tipo === 'area' && g.nivel === k), k)
  passo(geos.filter((g) => g.tipo === 'risco'), 0)
}
