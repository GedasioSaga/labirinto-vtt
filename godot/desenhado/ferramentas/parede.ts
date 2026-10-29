/**
 * A CONTA DE REFERÊNCIA DA PAREDE (onda 5, CONTRATO.md 11.15): como o app deita a parede, a
 * janela e a grade de prisão Desenhadas ao longo das paredes do mapa (pixi/drawWalls.ts).
 * Por pixel, em JavaScript: serve para conferir o shader do app, não para rodar nele.
 *
 * Uma CADEIA é o que o app já junta num path só (groupWallChains: as arestas de uma Sala em
 * ordem, ou uma parede solta); a porta parte a cadeia (o vão é dela), a janela e a grade NÃO
 * partem: são trechos da cadeia com outra imagem. Por cadeia:
 *  - a geometria: os pontos, o esquadro (miter) em cada canto, a normal à DIREITA de quem
 *    risca (o "baixo" da face) e o comprimento s;
 *  - as CORRIDAS: os trechos seguidos de mesmo papel (parede, janela, grade). A corrida de
 *    parede tem a sua sequência de módulos (11.6, com o id "<cadeia>:<n>") escalada para
 *    fechar em módulos inteiros; a de janela e a de grade repetem o módulo único n vezes.
 *    Toda ponta de corrida cai numa coluna de costura: a parede emenda na janela sem degrau;
 *  - dois passes: (1) o CONTORNO, a faixa inteira (a espessura t) no valor 0,10 da rampa,
 *    e (2) o MIOLO, a face (t - 2c) lida da imagem, tingida e acesa. Os passes 1 de todas as
 *    cadeias vêm antes dos passes 2: no T e no cruzamento o miolo de uma apaga o contorno da
 *    outra e as duas se fundem. No passe 2 vai primeiro a cadeia que encosta a ponta no meio
 *    de outra (o T), depois a mais fina;
 *  - a sombra (jeito "deslocada"): a faixa inteira de todas, andada e desfocada, antes.
 */
import { rgb } from '@cliente/texturas/ruido'
import { rampaDoTom, type Rampa, type Rgb } from './movel'
import { desfocar, LUZ, sequenciaDeModulos, type Altura, type Amostra, type FaceCarregada, type PedacoDaSequencia, type Tela } from './traco'

export type Papel = 'parede' | 'janela' | 'grade'
type Pt = readonly [number, number]

export interface CadeiaDeParede {
  readonly id: string
  /** Os pontos, em px do mundo a 64 px por casa (a mesa multiplica pelo zoom). */
  readonly pontos: readonly Pt[]
  /** Um papel por trecho: pontos.length - 1 (aberta) ou pontos.length (fechada). */
  readonly papeis: readonly Papel[]
  readonly fechada: boolean
  /** A espessura t, em px do mundo (o degrau vira px do mundo: parede.espessuraDoDegrauPx). */
  readonly espessura: number
  readonly cor: Rgb
}

export interface ParamsDaParede {
  readonly contorno: { px: number; minPx: number; fracao: number; valor: number }
  readonly trechoCurtoCasas: number
}

export interface FacesDaParede {
  readonly parede: FaceCarregada
  readonly janela: FaceCarregada | null
  readonly grade: FaceCarregada | null
}

// ---------- a rampa (CONTRATO 10.5, a da família com o croma da pedra) ----------

export const RAMPA_FAMILIA_PEDRA: Rampa = {
  escuro: [[0, 0.42], [0.1, 0.5], [0.24, 0.64], [0.36, 0.78], [0.5, 1]],
  claro: [[0.5, 0], [0.62, 0.12], [0.76, 0.26], [1, 0.45]],
  cromaNaSombra: -0.6,
  amareloNaLuz: 0.12,
  cromaNaLuz: 0.2,
  escuroAte: 0.1,
  claroDesde: 0.94,
}

const rampas = new Map<string, Float32Array>()

/** A rampa da cor da parede (256 cores, 0..255), guardada por cor. */
export function rampaDaParede(cor: Rgb): Float32Array {
  const chave = cor.join(',')
  let r = rampas.get(chave)
  if (r === undefined) {
    r = rampaDoTom(cor, RAMPA_FAMILIA_PEDRA)
    rampas.set(chave, r)
  }
  return r
}

/** A cor (0..1) do valor g na rampa, interpolada entre as 256 entradas. */
export function corDoValor(rampa: Float32Array, g: number, saida: number[]): void {
  const x = Math.min(255, Math.max(0, g * 255))
  const i = Math.min(254, Math.floor(x))
  const f = x - i
  for (let k = 0; k < 3; k += 1) saida[k] = (rampa[i * 3 + k] * (1 - f) + rampa[(i + 1) * 3 + k] * f) / 255
}

/** O contorno que o app pinta (11.15): c = clamp(fracao * t, minPx, px). */
export function contornoDa(t: number, p: ParamsDaParede): number {
  return Math.min(p.contorno.px, Math.max(p.contorno.minPx, p.contorno.fracao * t))
}

/** A imagem pela espessura (11.4): t < 26 px do mundo o Baixo, < 40 o Médio, senão o Alto. */
export function alturaDaParede(t: number): Altura {
  return t < 26 ? 'baixo' : t < 40 ? 'medio' : 'alto'
}

// ---------- a geometria da cadeia ----------

interface Geo {
  readonly P: Pt[]
  readonly nSeg: number
  readonly s: number[]
  readonly len: number
  readonly d: Pt[]
  readonly nr: Pt[]
  /** Por vértice: o vetor do esquadro (dot com a normal do trecho = 1). */
  readonly o: Pt[]
}

function geoDa(c: CadeiaDeParede, k: number): Geo {
  const P = c.pontos.map(([x, y]) => [x * k, y * k] as Pt)
  const n = P.length
  const nSeg = c.fechada ? n : n - 1
  const d: Pt[] = []
  const nr: Pt[] = []
  const s = [0]
  for (let i = 0; i < nSeg; i += 1) {
    const a = P[i]
    const b = P[(i + 1) % n]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    d.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l])
    nr.push([-(b[1] - a[1]) / l, (b[0] - a[0]) / l])
    s.push(s[i] + l)
  }
  const o: Pt[] = []
  for (let v = 0; v < n; v += 1) {
    const antes = c.fechada ? (v + nSeg - 1) % nSeg : v - 1
    const depois = c.fechada ? v % nSeg : v
    if (antes < 0) { o.push(nr[0]); continue }
    if (depois >= nSeg) { o.push(nr[nSeg - 1]); continue }
    const mx = nr[antes][0] + nr[depois][0]
    const my = nr[antes][1] + nr[depois][1]
    const ml = Math.hypot(mx, my)
    if (ml < 1e-6) { o.push(nr[depois]); continue }
    const m: Pt = [mx / ml, my / ml]
    const esc = 1 / Math.max(0.25, m[0] * nr[depois][0] + m[1] * nr[depois][1])
    o.push([m[0] * esc, m[1] * esc])
  }
  return { P, nSeg, s, len: s[nSeg], d, nr, o }
}

// ---------- as corridas ----------

interface Corrida {
  readonly s0: number
  readonly s1: number
  readonly papel: Papel
  readonly face: FaceCarregada
  /** Em s absoluto (px da tela). */
  readonly pedacos: readonly PedacoDaSequencia[]
  /** Curta demais para módulos: a coluna da costura inteira. */
  readonly liso: boolean
}

function faceDo(papel: Papel, faces: FacesDaParede): FaceCarregada {
  return (papel === 'janela' ? faces.janela : papel === 'grade' ? faces.grade : null) ?? faces.parede
}

function corridasDa(c: CadeiaDeParede, g: Geo, faces: FacesDaParede, p: ParamsDaParede, k: number, cont: number): Corrida[] {
  // Os limites de papel, em s. Na cadeia fechada com mais de um papel, começa num limite.
  // A quina também parte a corrida: a ponta de cada corrida é a coluna da costura (o meio de
  // um bloco), e o canto do esquadro estica essa coluna (ver o miolo), sem junta na quina.
  const lim: { s: number; papel: Papel }[] = []
  for (let i = 0; i < g.nSeg; i += 1) if (i === 0 || c.papeis[i] !== c.papeis[i - 1] || ehQuina(g, c.fechada, i)) lim.push({ s: g.s[i], papel: c.papeis[i] })
  const out: Corrida[] = []
  if (c.fechada && lim.length > 1 && c.papeis[0] === c.papeis[g.nSeg - 1] && !ehQuina(g, true, 0)) {
    // A corrida do fim continua na do começo: junta as duas (passa pelo s = 0).
    const ult = lim[lim.length - 1]
    lim[0] = { s: ult.s - g.len, papel: ult.papel }
    lim.pop()
  }
  for (let j = 0; j < lim.length; j += 1) {
    let s0 = lim[j].s
    let s1 = j + 1 < lim.length ? lim[j + 1].s : c.fechada ? lim[0].s + g.len : g.len
    if (!c.fechada && j === 0) s0 += cont
    if (!c.fechada && j === lim.length - 1) s1 -= cont
    const papel = lim[j].papel
    const face = faceDo(papel, faces)
    const L = (s1 - s0) / k
    let pedacos: PedacoDaSequencia[]
    if (papel === 'parede' || face === faces.parede) {
      pedacos = sequenciaDeModulos(face.p, `${c.id}:${j}`, L, true).map((q) => ({ ...q, s0: s0 + q.s0 * k, s1: s0 + q.s1 * k }))
    } else {
      const n = Math.max(1, Math.round(L / face.p.face.modulos[0].comprimentoPx))
      pedacos = Array.from({ length: n }, (_v, i) => ({ s0: s0 + ((s1 - s0) * i) / n, s1: s0 + ((s1 - s0) * (i + 1)) / n, m: 0, espelho: false }))
    }
    out.push({ s0, s1, papel, face, pedacos, liso: papel === 'parede' && L < p.trechoCurtoCasas * 64 })
  }
  return out
}

/** A curva mais fechada que ainda conta como reta (cosseno de 25 graus). */
const QUINA_COS = 0.906

/** O vértice v (o começo do trecho v) é uma quina: a cadeia vira mais de 25 graus ali. */
function ehQuina(g: Geo, fechada: boolean, v: number): boolean {
  const antes = v > 0 ? v - 1 : fechada ? g.nSeg - 1 : -1
  const depois = fechada ? v % g.nSeg : v
  if (antes < 0 || depois >= g.nSeg) return false
  return g.d[antes][0] * g.d[depois][0] + g.d[antes][1] * g.d[depois][1] < QUINA_COS
}

function corridaEm(cs: readonly Corrida[], s: number, len: number, fechada: boolean): Corrida | null {
  for (const c of cs) {
    if (s >= c.s0 && s < c.s1) return c
    if (fechada && s - len >= c.s0 && s - len < c.s1) return c
    if (fechada && s + len >= c.s0 && s + len < c.s1) return c
  }
  return null
}

function pedacoEm(c: Corrida, s: number): PedacoDaSequencia {
  for (const q of c.pedacos) if (s < q.s1) return q
  return c.pedacos[c.pedacos.length - 1]
}

// ---------- a varredura de um quadrilátero ----------

function cruz(a: Pt, b: Pt): number {
  return a[0] * b[1] - a[1] * b[0]
}

/** Cada pixel dentro de q0 q1 q2 q3 (q0 q1 o lado de w0, q3 q2 o de w1): cb(o, u, v). */
function varrerQuad(q0: Pt, q1: Pt, q2: Pt, q3: Pt, t: Tela, ox: number, oy: number, cb: (o: number, u: number, v: number) => void): void {
  const xs = [q0[0], q1[0], q2[0], q3[0]]
  const ys = [q0[1], q1[1], q2[1], q3[1]]
  const X0 = Math.max(0, Math.floor(Math.min(...xs) - ox - 1))
  const X1 = Math.min(t.w - 1, Math.ceil(Math.max(...xs) - ox + 1))
  const Y0 = Math.max(0, Math.floor(Math.min(...ys) - oy - 1))
  const Y1 = Math.min(t.h - 1, Math.ceil(Math.max(...ys) - oy + 1))
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
        if (v < -1e-4 || v > 1 + 1e-4) continue
        const ex = e[0] + g[0] * v
        const ey = e[1] + g[1] * v
        const l2 = ex * ex + ey * ey
        if (l2 < 1e-9) continue
        const u = ((h[0] - f[0] * v) * ex + (h[1] - f[1] * v) * ey) / l2
        if (u < -1e-4 || u > 1 + 1e-4) continue
        cb(Y * t.w + X, Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)))
        break
      }
    }
  }
}

/**
 * Varre a faixa de w0 a w1 (atravessando, + = a direita) de cada trecho, com o esquadro nos
 * cantos; nas pontas da cadeia aberta a faixa passa `alem` px (para a borda suave).
 * cb(o, s, w, trecho).
 */
function varrerFaixa(g: Geo, fechada: boolean, w0: number, w1: number, alem: number, t: Tela, ox: number, oy: number, cb: (o: number, s: number, w: number, i: number) => void): void {
  const n = g.P.length
  for (let i = 0; i < g.nSeg; i += 1) {
    const a = g.P[i]
    const b = g.P[(i + 1) % n]
    const oa = g.o[i]
    const ob = g.o[(i + 1) % n]
    const ea = !fechada && i === 0 ? alem : 0
    const eb = !fechada && i === g.nSeg - 1 ? alem : 0
    const A: Pt = [a[0] - g.d[i][0] * ea, a[1] - g.d[i][1] * ea]
    const B: Pt = [b[0] + g.d[i][0] * eb, b[1] + g.d[i][1] * eb]
    // O quadrilátero (do esquadro de um canto ao do outro) só diz de quem é o pixel; o s sai
    // da projeção no trecho, para as juntas ficarem retas até o corte do esquadro (pela
    // inversa bilinear elas entortariam perto da quina). O w é o mesmo nas duas contas.
    const [dx, dy] = g.d[i]
    varrerQuad([A[0] + oa[0] * w0, A[1] + oa[1] * w0], [B[0] + ob[0] * w0, B[1] + ob[1] * w0], [B[0] + ob[0] * w1, B[1] + ob[1] * w1], [A[0] + oa[0] * w1, A[1] + oa[1] * w1], t, ox, oy, (o, _u, v) => {
      const X = (o % t.w) + 0.5 + ox
      const Y = Math.floor(o / t.w) + 0.5 + oy
      cb(o, g.s[i] + (X - a[0]) * dx + (Y - a[1]) * dy, w0 + (w1 - w0) * v, i)
    })
  }
}

// ---------- os passes ----------

function sobre(t: Tela, o: number, c: readonly number[], a: number): void {
  if (a <= 0) return
  for (let k = 0; k < 3; k += 1) t.px[o * 3 + k] = t.px[o * 3 + k] * (1 - a) + c[k] * a
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

/** A luz do app (11.5), igual à de ferramentas/traco.ts: realce_de do cabeçalho, ou escurece. */
function acender(c: number[], l: number): void {
  if (l >= 0) {
    for (let k = 0; k < 3; k += 1) {
      const r = c[k] * 1.1 * (1 - 0.08) + [0.98, 0.93, 0.7][k] * 0.08
      c[k] = c[k] + (r - c[k]) * Math.min(1, l)
    }
  } else {
    for (let k = 0; k < 3; k += 1) c[k] = c[k] * (1 - 0.3 * Math.min(1, -l))
  }
}

function cobertura(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/** A distância de p ao trecho a-b. */
function distanciaAoTrecho(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const u = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Math.max(1e-9, dx * dx + dy * dy)))
  return Math.hypot(a[0] + dx * u - p[0], a[1] + dy * u - p[1])
}

/**
 * A ponta de uma cadeia aberta encosta no meio de outra (o T)? A ponta cai dentro da faixa da
 * outra e longe das pontas soltas dela (ponta com ponta é o L de duas paredes soltas, não T).
 */
function encosta(c: CadeiaDeParede, outras: readonly CadeiaDeParede[]): boolean {
  if (c.fechada) return false
  const pontas = [c.pontos[0], c.pontos[c.pontos.length - 1]]
  for (const o of outras) {
    if (o === c) continue
    const n = o.pontos.length
    const nSeg = o.fechada ? n : n - 1
    const soltas = o.fechada ? [] : [o.pontos[0], o.pontos[n - 1]]
    for (const p of pontas) {
      if (soltas.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < o.espessura / 2)) continue
      for (let i = 0; i < nSeg; i += 1) if (distanciaAoTrecho(p, o.pontos[i], o.pontos[(i + 1) % n]) < o.espessura / 2) return true
    }
  }
  return false
}

export interface OpcoesDaParede {
  readonly grid: number
  readonly ox: number
  readonly oy: number
}

/** As paredes Desenhadas inteiras, na ordem do app: a sombra, os contornos, os miolos. */
export function pintarParedes(t: Tela, cadeias: readonly CadeiaDeParede[], faces: FacesDaParede, p: ParamsDaParede, o: OpcoesDaParede): void {
  const k = o.grid / 64
  const fp = faces.parede.p
  const geos = new Map<CadeiaDeParede, Geo>(cadeias.map((c) => [c, geoDa(c, k)]))
  // 1. A sombra: a faixa inteira de todas, andada e desfocada, numa camada só.
  const sb = fp.sombra as unknown as { jeito: string; deslocamentoPx?: number; borraoPx: number; cor: string; alfa: number; direcao?: [number, number] }
  if (sb.jeito === 'deslocada') {
    const cob = new Float32Array(t.w * t.h)
    const dir = sb.direcao ?? [7, 11]
    const dl = Math.hypot(dir[0], dir[1])
    const desl = (sb.deslocamentoPx ?? 4) * k
    const sx = (dir[0] / dl) * desl
    const sy = (dir[1] / dl) * desl
    for (const c of cadeias) {
      const g = geos.get(c) as Geo
      varrerFaixa(g, c.fechada, -c.espessura * k / 2 - 1, c.espessura * k / 2 + 1, 1, t, o.ox - sx, o.oy - sy, (px, s, w) => {
        const a = cobertura((c.espessura * k) / 2 + 0.5 - Math.abs(w)) * (c.fechada ? 1 : cobertura(s + 0.5) * cobertura(g.len - s + 0.5))
        cob[px] = Math.max(cob[px], a)
      })
    }
    const b = desfocar(cob, t.w, t.h, sb.borraoPx * k * 0.5)
    const cor = rgb(sb.cor).map((v) => v / 255)
    for (let i = 0; i < t.w * t.h; i += 1) sobre(t, i, cor, b[i] * sb.alfa)
  }
  // 2. Os contornos: a faixa inteira no valor do contorno, a ponta da cadeia aberta reta.
  const cc = [0, 0, 0]
  for (const c of cadeias) {
    const g = geos.get(c) as Geo
    corDoValor(rampaDaParede(c.cor), p.contorno.valor, cc)
    const feito = new Float32Array(t.w * t.h)
    const tt = c.espessura * k
    varrerFaixa(g, c.fechada, -tt / 2 - 1, tt / 2 + 1, 1, t, o.ox, o.oy, (px, s, w) => {
      const a = cobertura(tt / 2 + 0.5 - Math.abs(w)) * (c.fechada ? 1 : cobertura(s + 0.5) * cobertura(g.len - s + 0.5))
      if (a <= feito[px]) return
      // Pinta só o que falta (o canto é varrido pelos dois trechos).
      const falta = (a - feito[px]) / (1 - feito[px] + 1e-6)
      feito[px] = a
      sobre(t, px, cc, falta)
    })
  }
  // 3. Os miolos: primeiro quem encosta a ponta no meio de outra, depois a mais fina.
  const ordem = [...cadeias].sort((a, b) => Number(encosta(b, cadeias)) - Number(encosta(a, cadeias)) || a.espessura - b.espessura || Number(a.fechada) - Number(b.fechada))
  const s4 = [0, 0, 0, 0]
  const r4 = [0, 0, 0, 0]
  const cor = [0, 0, 0]
  for (const c of ordem) {
    const g = geos.get(c) as Geo
    const tt = c.espessura * k
    const cont = contornoDa(c.espessura, p) * k
    const hi = tt / 2 - cont
    if (hi <= 0.25) continue
    const alt = alturaDaParede(c.espessura)
    const corridas = corridasDa(c, g, faces, p, k, cont)
    const rampa = rampaDaParede(c.cor)
    const feito = new Uint8Array(t.w * t.h)
    varrerFaixa(g, c.fechada, -hi - 1, hi + 1, 0, t, o.ox, o.oy, (px, s0, w, i) => {
      if (feito[px]) return
      // O canto do esquadro, além da quina: a coluna da ponta da corrida, esticada.
      let s = s0
      if (s > g.s[i + 1] && ehQuina(g, c.fechada, i + 1)) s = g.s[i + 1] - 1e-3
      else if (s < g.s[i] && ehQuina(g, c.fechada, i)) s = g.s[i] + 1e-3
      const cr = corridaEm(corridas, s, g.len, c.fechada)
      if (cr === null) return
      feito[px] = 1
      const face = cr.face
      const H = face.p.alturas[alt].hPx
      const f = (w + hi) / (2 * hi)
      const yi = 2 * (face.p.face.acimaPx + f * H)
      let espelho = false
      let xi: number
      if (cr.liso) {
        xi = face.p.face.modulos[0].xPx
      } else {
        const ss = s >= cr.s1 ? s - g.len : s < cr.s0 ? s + g.len : s
        const pd = pedacoEm(cr, ss)
        const m = face.p.face.modulos[pd.m]
        let x = ((ss - pd.s0) / (pd.s1 - pd.s0)) * m.comprimentoPx
        if (pd.espelho) x = m.comprimentoPx - x
        espelho = pd.espelho
        xi = m.xPx + 2 * x
      }
      ler(face.cor[alt], xi, yi, s4)
      if (s4[3] <= 1e-4) return
      ler(face.relevo[alt], xi, yi, r4)
      corDoValor(rampa, s4[0] / s4[3], cor)
      const rx = (2 * r4[0] - 1) * (espelho ? -1 : 1)
      const ry = 2 * r4[1] - 1
      const d = g.d[i]
      const nr = g.nr[i]
      const nx = rx * d[0] + ry * nr[0]
      const ny = rx * d[1] + ry * nr[1]
      const l = face.p.luz.face * (nr[0] * LUZ[0] + nr[1] * LUZ[1]) + face.p.luz.relevo * (nx * LUZ[0] + ny * LUZ[1])
      acender(cor, l)
      // A ponta da cadeia aberta: o miolo para no contorno da ponta, suave.
      const ponta = c.fechada ? 1 : cobertura(s - cont + 0.5) * cobertura(g.len - cont - s + 0.5)
      sobre(t, px, cor, s4[3] * ponta)
    })
  }
}

// ---------- a costura entre os itens ----------

/**
 * A coluna da costura tem de ser a MESMA na parede, na janela e na grade (o exportador só
 * mede dentro de cada item). Devolve a maior diferença (de 0 a 255) entre a primeira coluna
 * do módulo 0 da parede e a primeira e a última de cada módulo dos outros, por altura, na
 * cor (o valor e o alfa) e no relevo.
 */
export function costuraEntreItens(faces: FacesDaParede): { cor: number; relevo: number; porAltura: Record<string, number> } {
  let pior = 0
  let piorRelevo = 0
  const porAltura: Record<string, number> = {}
  for (const alt of ['baixo', 'medio', 'alto'] as Altura[]) {
    const ref = faces.parede
    const xr = ref.p.face.modulos[0].xPx
    let pa = 0
    for (const outra of [faces.janela, faces.grade]) {
      if (outra === null) continue
      for (const m of outra.p.face.modulos) {
        for (const x of [m.xPx, m.xPx + m.larguraPx - 1]) {
          const a = ref.cor[alt]
          const b = outra.cor[alt]
          for (let y = 0; y < Math.min(a.h, b.h); y += 1) {
            for (let q = 0; q < 4; q += 1) {
              const d = Math.abs(a.px[(y * a.w + xr) * 4 + q] - b.px[(y * b.w + x) * 4 + q]) * 255
              pa = Math.max(pa, d)
            }
            for (let q = 0; q < 2; q += 1) {
              const d = Math.abs(ref.relevo[alt].px[(y * a.w + xr) * 4 + q] - outra.relevo[alt].px[(y * b.w + x) * 4 + q]) * 255
              piorRelevo = Math.max(piorRelevo, d)
            }
          }
        }
      }
    }
    porAltura[alt] = Math.round(pa * 100) / 100
    pior = Math.max(pior, pa)
  }
  return { cor: Math.round(pior * 100) / 100, relevo: Math.round(piorRelevo * 100) / 100, porAltura }
}
