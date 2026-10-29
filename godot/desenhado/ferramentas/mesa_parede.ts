/**
 * A MESA DA SALA (onda 5, CONTRATO.md 11.15): a parede, a janela e a grade de prisão
 * Desenhadas pela conta de referência (ferramentas/parede.ts) com as imagens que o Godot
 * exportou, ao lado do Atual (as linhas de pixi/drawWalls.ts e a grade de
 * pixi/gradeDePrisao.ts, refeitas por pixel; não é o Pixi). O chão da sala é o piso aprovado
 * (texturas/piso), tingido pela conta da PROPOSTA-TINGIR.md; fora da casa, a grama aprovada.
 *
 * Uso, em duas vezes (a mesa do Godot, comum/mesa_parede.gd, faz as duas):
 *   node mesa_parede.mjs --plano=<paineis>/plano.json
 *   node mesa_parede.mjs --textura=<exportado/id> --exportado=<exportado/> --saida=<paineis>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MATERIAIS, type IdDoMaterial, type OpcaoDeMaterial } from '@cliente/texturas/meioTermo/materiais'
import { CORES_DA_GRADE, geometriaDaGrade } from '@cliente/pixi/gradeDePrisao'
import { rgb } from '@cliente/texturas/ruido'
import { gravarPng, lerPng, type Imagem } from './png'
import { comporMovel, oklab, type Camada, type MovelCarregado, type ParamsDoMovel, type Rgb } from './movel'
import { carregarFace, imagemDe, type FaceCarregada, type Tela } from './traco'
import { costuraEntreItens, pintarParedes, type CadeiaDeParede, type FacesDaParede, type Papel, type ParamsDaParede } from './parede'

const CASA = 64
const MUNDO_CASAS = 40
const SOMBRA_COR = rgb('#0a1c28').map((v) => v / 255)
/** As cores do mestre na casa: a de hoje (WALL_COLOR), a madeira do mapa do usuário e uma ardósia. */
const CORES = ['#d8d2c4', '#945f05', '#6b7079'] as const
/** O Atual (pixi/drawWalls.ts): o degrau médio tem 2 px de TELA; a janela, dois fios de 1 px a 4 px. */
const ATUAL_PAREDE_TELA = 2
const ATUAL_JANELA_FIO = 1
const ATUAL_JANELA_VAO = 4
const PISO_COR = '#a07b51'
const CELA_COR = '#8d877c'

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

// ---------- as cenas (casas do mundo) ----------

type Item = 'parede' | 'janela' | 'grade'
type P = readonly [number, number]

interface Cena {
  readonly nome: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly cadeias: (cor: string) => CadeiaDeParede[]
  /** Salas (retângulos em casas) com a cor do chão; fora delas, o chão da cena. */
  readonly salas: readonly { x0: number; y0: number; x1: number; y1: number; cor: string }[]
  readonly fora: 'piso' | 'grama'
}

function cad(id: string, pts: readonly P[], papeis: readonly Papel[], fechada: boolean, t: number, cor: string): CadeiaDeParede {
  return { id, pontos: pts.map(([x, y]) => [x * CASA, y * CASA] as const), papeis, fechada, espessura: t, cor: rgb(cor) as unknown as Rgb }
}

const ESPESSURAS = [20, 32, 48] as const

function vaoDo(item: Item): Papel {
  return item === 'grade' ? 'grade' : 'janela'
}

function cenaDasFormas(item: Item): Cena {
  const cadeias = (cor: string): CadeiaDeParede[] => {
    const out: CadeiaDeParede[] = []
    ESPESSURAS.forEach((t, r) => {
      const y0 = 4 * r
      const v = vaoDo(item)
      if (item === 'parede') {
        out.push(cad(`reta-a-${r}`, [[0.5, y0 + 2], [3, y0 + 2]], ['parede'], false, t, cor))
        out.push(cad(`reta-b-${r}`, [[4, y0 + 2], [6.5, y0 + 2]], ['parede'], false, t, cor))
        out.push(cad(`quina-${r}`, [[7.8, y0 + 3.5], [7.8, y0 + 1], [13.2, y0 + 1]], ['parede', 'parede'], false, t, cor))
        out.push(cad(`t-${r}`, [[14.5, y0 + 1], [20.5, y0 + 1]], ['parede'], false, t, cor))
        out.push(cad(`t-haste-${r}`, [[17.5, y0 + 1], [17.5, y0 + 3.5]], ['parede'], false, t, cor))
        out.push(cad(`sala-${r}`, [[21.8, y0 + 0.9], [27.2, y0 + 0.9], [27.2, y0 + 3.4], [21.8, y0 + 3.4]], ['parede', 'parede', 'parede', 'parede'], true, t, cor))
      } else {
        out.push(cad(`reta-${r}`, [[0.5, y0 + 2], [1.5, y0 + 2], [2.5, y0 + 2], [3.5, y0 + 2], [5.5, y0 + 2], [6.5, y0 + 2]], ['parede', v, 'parede', v, 'parede'], false, t, cor))
        out.push(cad(`quina-${r}`, [[7.8, y0 + 3.5], [7.8, y0 + 1], [9.5, y0 + 1], [11.5, y0 + 1], [13.2, y0 + 1]], ['parede', 'parede', v, 'parede'], false, t, cor))
        out.push(cad(`t-${r}`, [[14.5, y0 + 1], [20.5, y0 + 1]], ['parede'], false, t, cor))
        out.push(cad(`t-haste-${r}`, [[17.5, y0 + 1], [17.5, y0 + 2], [17.5, y0 + 3], [17.5, y0 + 3.5]], ['parede', v, 'parede'], false, t, cor))
        out.push(cad(`sala-${r}`, [[21.8, y0 + 0.9], [23, y0 + 0.9], [26, y0 + 0.9], [27.2, y0 + 0.9], [27.2, y0 + 3.4], [21.8, y0 + 3.4]], ['parede', v, 'parede', 'parede', 'parede', 'parede'], true, t, cor))
      }
    })
    return out
  }
  return { nome: 'formas', x: 0, y: 0, w: 28, h: 12, cadeias, salas: [], fora: 'piso' }
}

function cenaDoParedao(item: Item): Cena {
  const cadeias = (cor: string): CadeiaDeParede[] => ESPESSURAS.map((t, r) => {
    const y = 12 + [0.9, 2.5, 4.1][r]
    if (item === 'parede') return cad(`paredao-${r}`, [[1, y], [39, y]], ['parede'], false, t, cor)
    const v = vaoDo(item)
    const xs = [1, 4, 5, 10, 12, 17, 20, 25, 26, 31, 33, 39]
    const papeis: Papel[] = xs.slice(1).map((_x, i) => (i % 2 === 1 ? v : 'parede'))
    return cad(`paredao-${r}`, xs.map((x) => [x, y] as const), papeis, false, t, cor)
  })
  return { nome: 'paredao', x: 0, y: 12, w: 40, h: 5, cadeias, salas: [], fora: 'piso' }
}

/** A casa da família: salão, quarto e cela; quinas, T, portas, janelas e as duas grades. */
function cenaDaCasa(): Cena {
  const Y = 17
  const cadeias = (cor: string): CadeiaDeParede[] => {
    const q = (pts: readonly P[]): P[] => pts.map(([x, y]) => [x, y + Y] as const)
    return [
      cad('casa-fora', q([[6.5, 10.5], [14.5, 10.5], [14.5, 8.5], [14.5, 7.5], [14.5, 1.5], [11.5, 1.5], [10.5, 1.5], [5.5, 1.5], [3.5, 1.5], [1.5, 1.5], [1.5, 5.5], [1.5, 7.5], [1.5, 10.5], [5.5, 10.5]]),
        ['parede', 'parede', 'grade', 'parede', 'parede', 'janela', 'parede', 'janela', 'parede', 'parede', 'janela', 'parede', 'parede'], false, 32, cor),
      cad('casa-v1', q([[9.5, 1.5], [9.5, 3]]), ['parede'], false, 20, cor),
      cad('casa-v2', q([[9.5, 4], [9.5, 7.5], [9.5, 9.5], [9.5, 10.5]]), ['parede', 'grade', 'parede'], false, 20, cor),
      cad('casa-h', q([[9.5, 6.5], [14.5, 6.5]]), ['parede'], false, 20, cor),
    ]
  }
  return {
    nome: 'casa', x: 0, y: Y, w: 16, h: 12, cadeias, fora: 'grama',
    salas: [
      { x0: 1.5, y0: Y + 1.5, x1: 14.5, y1: Y + 10.5, cor: PISO_COR },
      { x0: 9.5, y0: Y + 6.5, x1: 14.5, y1: Y + 10.5, cor: CELA_COR },
    ],
  }
}

interface Perto { readonly nome: string; readonly cena: string; readonly x: number; readonly y: number; readonly titulo: string }
const W_PERTO = 4
const H_PERTO = 3

const PERTOS: Record<Item, readonly Perto[]> = {
  parede: [
    { nome: 't', cena: 'formas', x: 15.5, y: 4.3, titulo: 'o T, Médio (32 px)' },
    { nome: 'quina', cena: 'formas', x: 6.6, y: 8.0, titulo: 'a quina, Alto (48 px)' },
    { nome: 'casa', cena: 'casa', x: 8.0, y: 17.4, titulo: 'a casa: o T da divisória (20 px) na parede de fora (32 px) e a janela do quarto' },
  ],
  janela: [
    { nome: 'janela', cena: 'formas', x: 0.6, y: 4.6, titulo: 'as janelas de 1 e de 2 casas, Médio (32 px)' },
    { nome: 'sala', cena: 'formas', x: 22.4, y: 7.9, titulo: 'a janela de 3 casas da sala, Alto (48 px)' },
    { nome: 'casa-janela', cena: 'casa', x: 0.4, y: 22.0, titulo: 'a casa: a janela de 2 casas do salão (32 px)' },
  ],
  grade: [
    { nome: 'grade', cena: 'formas', x: 0.6, y: 4.6, titulo: 'as grades de 1 e de 2 casas, Médio (32 px)' },
    { nome: 'cela', cena: 'casa', x: 8.0, y: 23.6, titulo: 'a casa: a frente da cela (20 px) e o T' },
    { nome: 'alto', cena: 'formas', x: 0.6, y: 8.6, titulo: 'as grades na muralha, Alto (48 px)' },
  ],
}

// ---------- o chão ----------

function srgbDe(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
}
function linearDoOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}
function suave(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

/** A rampa do chão de sala (PROPOSTA-TINGIR.md, "luz-oklab"): 256 cores, 0..1. */
function rampaDoChao(hex: string): Float32Array {
  const [L, a, b] = oklab(rgb(hex) as unknown as Rgb)
  const j = suave(0, 0.1, L) * suave(1, 0.94, L)
  const out = new Float32Array(256 * 3)
  for (let i = 0; i < 256; i += 1) {
    const L2 = L + 0.48 * j * (i / 255 - 0.5)
    let lo = 0
    let hi = 1
    const cabe = (c: number[]): boolean => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4)
    let c = linearDoOklab(L2, a, b)
    if (!cabe(c)) {
      for (let t = 0; t < 14; t += 1) {
        const m = (lo + hi) / 2
        if (cabe(linearDoOklab(L2, a * m, b * m))) lo = m
        else hi = m
      }
      c = linearDoOklab(L2, a * lo, b * lo)
    }
    for (let k = 0; k < 3; k += 1) out[i * 3 + k] = srgbDe(Math.min(1, Math.max(0, c[k])))
  }
  return out
}

const rampasDoChao = new Map<string, Float32Array>()

/** O chão da cena: o piso tingido dentro das salas (e na cena de piso), a grama fora. */
function chaoDa(c: Cena, k: number, x0: number, y0: number, w: number, h: number, grama: Imagem, piso: Imagem, gx: number, gy: number): Tela {
  const t: Tela = { w, h, px: new Float32Array(w * h * 3) }
  const casaPx = CASA * k
  for (let Y = 0; Y < h; Y += 1) {
    for (let X = 0; X < w; X += 1) {
      const cx = x0 + (X + 0.5) / casaPx
      const cy = y0 + (Y + 0.5) / casaPx
      let cor: string | null = c.fora === 'piso' ? PISO_COR : null
      for (const s of c.salas) if (cx >= s.x0 && cx < s.x1 && cy >= s.y0 && cy < s.y1) cor = s.cor
      const o = ((gy + Y) * grama.w + (gx + X)) * 4
      if (cor === null) {
        for (let q = 0; q < 3; q += 1) t.px[(Y * w + X) * 3 + q] = grama.px[o + q] / 255
        continue
      }
      let r = rampasDoChao.get(cor)
      if (r === undefined) { r = rampaDoChao(cor); rampasDoChao.set(cor, r) }
      const g = Math.min(255, Math.max(0, piso.px[o]))
      for (let q = 0; q < 3; q += 1) t.px[(Y * w + X) * 3 + q] = r[g * 3 + q]
    }
  }
  return t
}

// ---------- o Atual (pixi/drawWalls.ts e pixi/gradeDePrisao.ts) ----------

function cobrirCapsula(buf: Float32Array, t: Tela, ax: number, ay: number, bx: number, by: number, r: number, redonda: boolean): void {
  const X0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 2))
  const X1 = Math.min(t.w - 1, Math.ceil(Math.max(ax, bx) + r + 2))
  const Y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 2))
  const Y1 = Math.min(t.h - 1, Math.ceil(Math.max(ay, by) + r + 2))
  const dx = bx - ax
  const dy = by - ay
  const l2 = Math.max(1e-9, dx * dx + dy * dy)
  const l = Math.sqrt(l2)
  for (let Y = Y0; Y <= Y1; Y += 1) for (let X = X0; X <= X1; X += 1) {
    const px = X + 0.5 - ax
    const py = Y + 0.5 - ay
    const u = (px * dx + py * dy) / l2
    let d: number
    if (redonda) {
      const uu = Math.min(1, Math.max(0, u))
      d = Math.hypot(px - dx * uu, py - dy * uu) - r
    } else {
      const ao = Math.abs(px * dy - py * dx) / l - r
      const ponta = Math.max(-u * l, (u - 1) * l)
      d = Math.max(ao, ponta)
    }
    const a = Math.min(1, Math.max(0, 0.5 - d))
    const o = Y * t.w + X
    if (a > buf[o]) buf[o] = a
  }
}

function cobrirDisco(buf: Float32Array, t: Tela, cx: number, cy: number, r: number, anel = 0): void {
  for (let Y = Math.max(0, Math.floor(cy - r - 2)); Y <= Math.min(t.h - 1, Math.ceil(cy + r + 2)); Y += 1) {
    for (let X = Math.max(0, Math.floor(cx - r - 2)); X <= Math.min(t.w - 1, Math.ceil(cx + r + 2)); X += 1) {
      const d0 = Math.hypot(X + 0.5 - cx, Y + 0.5 - cy) - r
      const d = anel > 0 ? Math.abs(d0) - anel / 2 : d0
      const a = Math.min(1, Math.max(0, 0.5 - d))
      const o = Y * t.w + X
      if (a > buf[o]) buf[o] = a
    }
  }
}

function aplicar(t: Tela, buf: Float32Array, cor: readonly number[], alfa: number): void {
  for (let i = 0; i < t.w * t.h; i += 1) {
    const a = buf[i] * alfa
    if (a > 0) for (let k = 0; k < 3; k += 1) t.px[i * 3 + k] = t.px[i * 3 + k] * (1 - a) + cor[k] * a
    buf[i] = 0
  }
}

/** z = o zoom em que o painel vai ser visto (a linha da planta tem px de TELA). */
function pintarAtual(t: Tela, cadeias: readonly CadeiaDeParede[], k: number, z: number, ox: number, oy: number): void {
  const tela = k / z
  const buf = new Float32Array(t.w * t.h)
  for (const c of cadeias) {
    const cor = c.cor.map((v) => v / 255)
    const n = c.pontos.length
    const nSeg = c.fechada ? n : n - 1
    const pt = (i: number): P => [c.pontos[i % n][0] * k - ox, c.pontos[i % n][1] * k - oy]
    for (let i = 0; i < nSeg; i += 1) {
      const a = pt(i)
      const b = pt(i + 1)
      if (c.papeis[i] === 'parede') {
        cobrirCapsula(buf, t, a[0], a[1], b[0], b[1], (ATUAL_PAREDE_TELA * tela) / 2, true)
        continue
      }
      aplicar(t, buf, cor, 1)
      if (c.papeis[i] === 'janela') {
        const l = Math.hypot(b[0] - a[0], b[1] - a[1])
        const nx = (-(b[1] - a[1]) / l) * (ATUAL_JANELA_VAO / 2) * tela
        const ny = ((b[0] - a[0]) / l) * (ATUAL_JANELA_VAO / 2) * tela
        for (const lado of [1, -1]) cobrirCapsula(buf, t, a[0] + nx * lado, a[1] + ny * lado, b[0] + nx * lado, b[1] + ny * lado, (ATUAL_JANELA_FIO * tela) / 2, false)
        aplicar(t, buf, cor, 1)
        continue
      }
      // A grade do Meio-Termo (geometriaDaGrade, em px do mundo, no zoom z).
      const w = { x1: c.pontos[i][0], y1: c.pontos[i][1], x2: c.pontos[(i + 1) % n][0], y2: c.pontos[(i + 1) % n][1] }
      const geo = geometriaDaGrade(w, z)
      const base = rgb(`#${CORES_DA_GRADE.base.toString(16).padStart(6, '0')}`).map((v) => v / 255)
      const realce = rgb(`#${CORES_DA_GRADE.realce.toString(16).padStart(6, '0')}`).map((v) => v / 255)
      const contorno = rgb(`#${CORES_DA_GRADE.contorno.toString(16).padStart(6, '0')}`).map((v) => v / 255)
      cobrirCapsula(buf, t, a[0], a[1], b[0], b[1], ((geo.trilho + 2 * geo.contorno) * k) / 2, true)
      aplicar(t, buf, contorno, 1)
      cobrirCapsula(buf, t, a[0], a[1], b[0], b[1], (geo.trilho * k) / 2, true)
      aplicar(t, buf, base, 1)
      for (const q of geo.barras) cobrirDisco(buf, t, q.x * k - ox + geo.raio * 0.45 * k, q.y * k - oy + geo.raio * 0.6 * k, geo.raio * k)
      aplicar(t, buf, contorno, 0.3)
      for (const q of geo.barras) cobrirDisco(buf, t, q.x * k - ox, q.y * k - oy, geo.raio * k)
      aplicar(t, buf, base, 1)
      for (const q of geo.barras) cobrirDisco(buf, t, q.x * k - ox, q.y * k - oy, geo.raio * k, geo.contorno * k)
      aplicar(t, buf, contorno, 1)
      for (const q of geo.barras) cobrirDisco(buf, t, q.x * k - ox - geo.raio * 0.32 * k, q.y * k - oy - geo.raio * 0.32 * k, geo.raio * 0.38 * k)
      aplicar(t, buf, realce, 1)
    }
    aplicar(t, buf, cor, 1)
  }
}

// ---------- os móveis da onda 4 (as contas de ferramentas/mesa_traco.ts e da seção 10) ----------

interface Niveis { readonly n: Camada[] }
type Matriz = readonly [number, number, number, number, number, number]

function inversa(m: Matriz): Matriz {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

/** A camada (pré-multiplicada, 0..255) na tela pela matriz; soAlfa soma a silhueta em "sombra". */
function porAfim(t: Tela, sombra: Float32Array, nv: Niveis, m: Matriz, soAlfa = false): void {
  const c = nv.n[0]
  const inv = inversa(m)
  const cantos = [[0, 0], [c.w, 0], [0, c.h], [c.w, c.h]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]])
  const X0 = Math.max(0, Math.floor(Math.min(...cantos.map((p) => p[0]))))
  const X1 = Math.min(t.w, Math.ceil(Math.max(...cantos.map((p) => p[0]))))
  const Y0 = Math.max(0, Math.floor(Math.min(...cantos.map((p) => p[1]))))
  const Y1 = Math.min(t.h, Math.ceil(Math.max(...cantos.map((p) => p[1]))))
  const s = [0, 0, 0, 0]
  for (let Y = Y0; Y < Y1; Y += 1) {
    for (let X = X0; X < X1; X += 1) {
      const u = inv[0] * (X + 0.5) + inv[2] * (Y + 0.5) + inv[4] - 0.5
      const v = inv[1] * (X + 0.5) + inv[3] * (Y + 0.5) + inv[5] - 0.5
      const iu = Math.floor(u)
      const iv = Math.floor(v)
      const tu = u - iu
      const tv = v - iv
      s[0] = s[1] = s[2] = s[3] = 0
      for (const [dx, dy, p] of [[0, 0, (1 - tu) * (1 - tv)], [1, 0, tu * (1 - tv)], [0, 1, (1 - tu) * tv], [1, 1, tu * tv]] as const) {
        const x = iu + dx
        const y = iv + dy
        if (x < 0 || y < 0 || x >= c.w || y >= c.h || p === 0) continue
        const o = (y * c.w + x) * 4
        for (let k = 0; k < 4; k += 1) s[k] += c.px[o + k] * p
      }
      const a = s[3] / 255
      if (a <= 0) continue
      const o = Y * t.w + X
      if (soAlfa) {
        sombra[o] = sombra[o] + a * (1 - sombra[o])
        continue
      }
      for (let k = 0; k < 3; k += 1) t.px[o * 3 + k] = s[k] / 255 + t.px[o * 3 + k] * (1 - a)
    }
  }
}

interface Movel { readonly tipo: string; readonly pasta: string; readonly x: number; readonly y: number; readonly casas: readonly [number, number]; readonly giro: number; readonly opcoes: readonly OpcaoDeMaterial[]; readonly forma?: string }

function carregarMovel(pasta: string): MovelCarregado {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParamsDoMovel
  const imagens = new Map<string, Imagem>()
  for (const f of p.formas) for (const nome of [f.valor, f.partes, f.cor]) if (nome !== undefined) imagens.set(nome, lerPng(join(pasta, nome)))
  return { p, imagens }
}

function tomDe(o: OpcaoDeMaterial, opcoes: readonly OpcaoDeMaterial[], lugares: readonly string[]): Rgb {
  if (o === 'mesma' || o === 'varas') {
    const im = lugares.indexOf('madeira')
    return rgb(MATERIAIS[(im >= 0 ? opcoes[im] : 'carvalho') as IdDoMaterial].tom) as unknown as Rgb
  }
  return rgb(MATERIAIS[o].tom) as unknown as Rgb
}

function porMovel(t: Tela, sombra: Float32Array, m: MovelCarregado, o: Movel, casa: number, ox: number, oy: number, passo: 'sombra' | 'corpo'): void {
  const tons = m.p.lugares.map((_l, i) => tomDe(o.opcoes[i], o.opcoes, m.p.lugares))
  const comp = comporMovel(m, { vista: 'frente', opcoes: o.opcoes, tons, casasW: o.casas[0], casasH: o.casas[1], giro: o.giro, ...(o.forma !== undefined ? { forma: o.forma } : {}) }, casa)
  const r = (comp.resto * Math.PI) / 180
  const co = Math.cos(r)
  const si = Math.sin(r)
  const X = o.x * casa - ox
  const Y = o.y * casa - oy
  const mat: Matriz = [co, si, -si, co, X - (co * comp.cx - si * comp.cy), Y - (si * comp.cx + co * comp.cy)]
  if (passo === 'sombra') {
    if (comp.sombra === null) return
    const s = comp.sombra
    const alfa = m.p.sombra.alfa
    const c: Camada = { w: comp.corpo.w, h: comp.corpo.h, px: new Float32Array(comp.corpo.w * comp.corpo.h * 4).map((_v, i) => (i % 4 === 3 ? (s[i >> 2] / alfa) * 255 : 0)) }
    return porAfim(t, sombra, { n: [c] }, mat, true)
  }
  porAfim(t, sombra, { n: [comp.corpo] }, mat)
}

const Yc = 17
const MOVEIS_DA_CASA: readonly Movel[] = [
  { tipo: 'tapete', pasta: 'movel-tapete', x: 4.6, y: Yc + 6.4, casas: [3, 2], giro: 0, opcoes: ['azul'] },
  { tipo: 'lareira', pasta: 'movel-lareira', x: 7.3, y: Yc + 2.25, casas: [2, 1], giro: 0, opcoes: ['arenito', 'nogueira'], forma: 'apagado' },
  { tipo: 'mesa', pasta: 'movel-mesa', x: 4.6, y: Yc + 6.4, casas: [2, 1], giro: 0, opcoes: ['carvalho'] },
  { tipo: 'cadeira', pasta: 'movel-cadeira', x: 4.1, y: Yc + 5.55, casas: [0.5, 0.5], giro: 0, opcoes: ['carvalho', 'palha'] },
  { tipo: 'cadeira', pasta: 'movel-cadeira', x: 5.1, y: Yc + 5.55, casas: [0.5, 0.5], giro: 0, opcoes: ['carvalho', 'palha'] },
  { tipo: 'cadeira', pasta: 'movel-cadeira', x: 4.1, y: Yc + 7.25, casas: [0.5, 0.5], giro: 180, opcoes: ['carvalho', 'palha'] },
  { tipo: 'cadeira', pasta: 'movel-cadeira', x: 5.1, y: Yc + 7.25, casas: [0.5, 0.5], giro: 180, opcoes: ['carvalho', 'palha'] },
  { tipo: 'cadeira', pasta: 'movel-cadeira', x: 3.15, y: Yc + 6.4, casas: [0.5, 0.5], giro: 270, opcoes: ['nogueira', 'mesma'] },
  { tipo: 'barril', pasta: 'movel-barril', x: 2.2, y: Yc + 9.7, casas: [0.7, 0.7], giro: 0, opcoes: ['carvalho', 'ferro'] },
  { tipo: 'catre', pasta: 'movel-catre', x: 13.75, y: Yc + 2.75, casas: [1, 2], giro: 0, opcoes: ['carvalho', 'vinho', 'linho'] },
  { tipo: 'bau', pasta: 'movel-bau', x: 13.75, y: Yc + 4.25, casas: [1, 0.6], giro: 0, opcoes: ['nogueira', 'ferro'] },
  { tipo: 'catre', pasta: 'movel-catre', x: 12.4, y: Yc + 9.75, casas: [1, 2], giro: 90, opcoes: ['pinho', 'linho', 'linho'] },
]

function pintarMoveis(t: Tela, exportado: string, casa: number, ox: number, oy: number, avisos: string[]): void {
  const cache = new Map<string, MovelCarregado | null>()
  const carregado = (pasta: string): MovelCarregado | null => {
    if (!cache.has(pasta)) {
      try {
        cache.set(pasta, existsSync(join(exportado, pasta, 'textura.json')) ? carregarMovel(join(exportado, pasta)) : null)
      } catch (e) {
        avisos.push(`${pasta} não carregou: ${String(e)}`)
        cache.set(pasta, null)
      }
      if (cache.get(pasta) === null && !avisos.some((a) => a.includes(pasta))) avisos.push(`sem o ${pasta} exportado`)
    }
    return cache.get(pasta) ?? null
  }
  const sombra = new Float32Array(t.w * t.h)
  for (const o of MOVEIS_DA_CASA) { const m = carregado(o.pasta); if (m !== null) porMovel(t, sombra, m, o, casa, ox, oy, 'sombra') }
  for (let i = 0; i < t.w * t.h; i += 1) {
    const s = sombra[i] * 0.25
    if (s > 0) for (let k = 0; k < 3; k += 1) t.px[i * 3 + k] = t.px[i * 3 + k] * (1 - s) + SOMBRA_COR[k] * s
  }
  // O tapete por baixo de tudo; o resto em ordem de y.
  const lista = [...MOVEIS_DA_CASA].sort((a, b) => Number(b.tipo === 'tapete') - Number(a.tipo === 'tapete') || a.y + a.casas[1] / 2 - (b.y + b.casas[1] / 2))
  for (const o of lista) { const m = carregado(o.pasta); if (m !== null) porMovel(t, sombra, m, o, casa, ox, oy, 'corpo') }
}

// ---------- principal ----------

function itemDe(id: string): Item {
  return id === 'janela' ? 'janela' : id === 'grade-de-prisao' ? 'grade' : 'parede'
}

function principal(): void {
  const args = argumentos()
  const todosPertos = [...new Map(Object.values(PERTOS).flat().map((p) => [p.nome, p])).values()]
  const plano = args.get('plano')
  if (plano !== undefined) {
    const chaos: { nome: string; textura: string; origem: number[]; zoom: number; lado: number }[] = []
    for (const tex of ['grama', 'piso']) {
      chaos.push({ nome: `${tex}-100`, textura: tex, origem: [0, 0], zoom: 1, lado: MUNDO_CASAS * CASA })
      for (const p of todosPertos) chaos.push({ nome: `${tex}-300-${p.nome}`, textura: tex, origem: [p.x * CASA, p.y * CASA], zoom: 3, lado: W_PERTO * CASA * 3 })
    }
    writeFileSync(plano, JSON.stringify({ chaos }, null, 2))
    return
  }
  const pasta = args.get('textura')
  const exportado = args.get('exportado')
  const saida = args.get('saida')
  if (pasta === undefined || exportado === undefined || saida === undefined) {
    console.error('uso: --plano=<arquivo> | --textura=<exportado/id> --exportado=<exportado/> --saida=<paineis>')
    process.exit(2)
  }
  mkdirSync(saida, { recursive: true })
  const avisos: string[] = []
  const tipo = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as { id: string }
  const item = itemDe(tipo.id)
  const pastaParede = item === 'parede' ? pasta : join(exportado, 'parede')
  if (!existsSync(join(pastaParede, 'textura.json'))) throw new Error(`a janela e a grade precisam da parede exportada (${pastaParede})`)
  const carregarSe = (id: string): FaceCarregada | null => {
    const pp = tipo.id === id ? pasta : join(exportado, id)
    if (existsSync(join(pp, 'textura.json'))) return carregarFace(pp)
    avisos.push(`${id} ainda não exportada: o trecho sai como parede lisa`)
    return null
  }
  const faces: FacesDaParede = { parede: carregarFace(pastaParede), janela: carregarSe('janela'), grade: carregarSe('grade-de-prisao') }
  const params = (faces.parede.p as unknown as { parede: ParamsDaParede }).parede
  const grama100 = lerPng(join(saida, 'grama-100.png'))
  const piso100 = lerPng(join(saida, 'piso-100.png'))
  const tempos: Record<string, number> = {}
  const cenas = [cenaDasFormas(item), cenaDoParedao(item), cenaDaCasa()]
  const montar = (c: Cena, lado: 'desenhado' | 'atual', cor: string, k: number, z: number, x0: number, y0: number, w: number, h: number, grama: Imagem, piso: Imagem, gx: number, gy: number): Imagem => {
    const t = chaoDa(c, k, x0, y0, w, h, grama, piso, gx, gy)
    const cadeias = c.cadeias(cor)
    if (c.nome === 'casa') pintarMoveis(t, exportado, CASA * k, x0 * CASA * k, y0 * CASA * k, avisos)
    if (lado === 'desenhado') pintarParedes(t, cadeias, faces, params, { grid: CASA * k, ox: x0 * CASA * k, oy: y0 * CASA * k })
    else pintarAtual(t, cadeias, k, z, x0 * CASA * k, y0 * CASA * k)
    return imagemDe(t)
  }
  for (const c of cenas) {
    const gx = c.x * CASA
    const gy = c.y * CASA
    const W = c.w * CASA
    const H = c.h * CASA
    const t0 = Date.now()
    const cores = c.nome === 'casa' ? CORES : [CORES[0]]
    cores.forEach((cor, i) => {
      gravarPng(join(saida, `${c.nome}-desenhado${c.nome === 'casa' ? `-${i}` : ''}-100.png`), montar(c, 'desenhado', cor, 1, 1, c.x, c.y, W, H, grama100, piso100, gx, gy), true)
    })
    gravarPng(join(saida, `${c.nome}-atual-100.png`), montar(c, 'atual', CORES[0], 1, 1, c.x, c.y, W, H, grama100, piso100, gx, gy), true)
    // A linha do Atual tem px de TELA: para ver a 50% e a 25%, o painel é pintado para esse zoom.
    for (const z of c.nome === 'formas' ? [0.5, 0.25] : [0.5]) {
      gravarPng(join(saida, `${c.nome}-atual${Math.round(z * 100)}-100.png`), montar(c, 'atual', CORES[0], 1, z, c.x, c.y, W, H, grama100, piso100, gx, gy), true)
    }
    tempos[c.nome] = Date.now() - t0
  }
  for (const p of PERTOS[item]) {
    const c = cenas.find((q) => q.nome === p.cena)
    if (c === undefined) continue
    const grama = lerPng(join(saida, `grama-300-${p.nome}.png`))
    const piso = lerPng(join(saida, `piso-300-${p.nome}.png`))
    const W = W_PERTO * CASA * 3
    const H = H_PERTO * CASA * 3
    gravarPng(join(saida, `perto-${p.nome}-desenhado-300.png`), montar(c, 'desenhado', CORES[0], 3, 3, p.x, p.y, W, H, grama, piso, 0, 0), true)
    gravarPng(join(saida, `perto-${p.nome}-atual-300.png`), montar(c, 'atual', CORES[0], 3, 3, p.x, p.y, W, H, grama, piso, 0, 0), true)
  }
  const costura = costuraEntreItens(faces)
  writeFileSync(join(saida, 'paineis.json'), JSON.stringify({
    item, face: tipo.id, borda: null, bordaExportada: false, atual: true,
    modulosCasas: faces.parede.p.face.modulos.map((m) => m.casas),
    pertos: PERTOS[item].map((p) => ({ nome: p.nome, titulo: p.titulo })),
    cores: CORES, cenas: cenas.map((c) => ({ nome: c.nome, w: c.w, h: c.h })), costuraEntreItens: costura, avisos, tempos,
  }, null, 2))
  console.log(`mesa da sala (${item}): ${cenas.length} cenas e ${PERTOS[item].length} recortes, costura entre itens ${costura.cor}/255 na cor e ${costura.relevo}/255 no relevo, ${avisos.length} aviso(s)`)
}

principal()
