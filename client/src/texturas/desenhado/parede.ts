import type { DoorKind } from '../../types/map'
import type { Rampa } from './movel'
import { ID_DA_FORMA, meiaDaFolhaNoMundo, MODULO_DO_ESTADO, pedacosDaFolha, pedacosDoVao, type EstadoDaFolha, type PlanoDaPorta } from './porta'
import { sequenciaDeModulos, type AlturaDoTraco, type FaceDoTraco } from './traco'

/**
 * A PAREDE, A JANELA E A GRADE DESENHADAS (plano de 29/10/2026, F4b; CONTRATO.md
 * 11.15): a conta que deita a alvenaria do pacote ao longo das paredes do mapa.
 * Sem Pixi e sem I/O: a leitura do bloco `parede` e do `tingir` do
 * `textura.json`, a geometria de cada cadeia (o esquadro dos cantos, a normal à
 * direita), as corridas por papel e por quina, a ordem dos miolos (o T
 * primeiro, a mais fina depois) e os números de cada vértice das malhas. O
 * desenho na placa é de `pixi/malhaDaParede.ts`; quem monta as cadeias com as
 * paredes do app e pinta é `pixi/paredesDesenhadas.ts`.
 *
 * A referência é `godot/desenhado/ferramentas/parede.ts` (`pintarParedes`, por
 * pixel): o shader faz, em cada pixel, a mesma conta, com os números que estas
 * malhas levam. Onde a referência decide "de quem é o pixel" pelo `s` (a
 * projeção no trecho), a malha é cortada nas mesmas retas de `s` constante:
 * cada pedaço já é só de um módulo.
 *
 * Unidades: os pontos e o `s` em px do MUNDO do app; a espessura da cadeia e os
 * módulos em "px do traço" (a 64 px por casa); `k = grid / 64` converte.
 */

type Pt = readonly [number, number]

export type PapelDaParede = 'parede' | 'janela' | 'grade' | 'porta'
/** A imagem de cada pedaço: a parede, a janela, a grade e as 3 portas (lote 18, uma imagem por forma). */
export type ItemDaParede = 'parede' | 'janela' | 'grade' | 'porta' | 'porta-dupla' | 'porta-portao'
export const ITENS_DA_PAREDE: readonly ItemDaParede[] = ['parede', 'janela', 'grade', 'porta', 'porta-dupla', 'porta-portao']

/** A porta de um trecho de papel "porta" (CONTRATO 11.16). */
export interface PortaDaCadeia {
  /** O id da parede da porta (a camada das portas pula a folha que a parede pinta). */
  readonly id: string
  readonly forma: DoorKind
  /** `null` = só o vão (a porta anda: a folha é da animação, por cima). */
  readonly estado: EstadoDaFolha | null
  /** A linha da rampa da cor da PORTA no atlas (a creme, a vermelha da trancada ou a própria). */
  readonly linha: number
}

export interface ContornoDaParede {
  readonly px: number
  readonly minPx: number
  readonly fracao: number
  /** O valor da rampa da faixa inteira (0,10: o escuro da cor da parede). */
  readonly valor: number
}

export interface SombraDaParede {
  readonly deslocamentoPx: number
  /** A direção do deslocamento, normalizada. */
  readonly direcao: Pt
  readonly borraoPx: number
  readonly cor: string
  readonly alfa: number
}

/** O bloco `parede` (e o `tingir` e a `sombra` deslocada) do `textura.json` da parede, conferido. */
export interface ParamsDaParede {
  readonly contorno: ContornoDaParede
  /** Os degraus nomeados do app em px do traço (fina 12, média 20, grossa 32). */
  readonly degrau: { readonly thin: number; readonly medium: number; readonly thick: number }
  /** A corrida de parede mais curta que isto (em casas) sai lisa: só a coluna da costura. */
  readonly trechoCurtoCasas: number
  readonly rampa: Rampa
  readonly sombra: SombraDaParede
}

// ---------- leitura (dado de fora: confere cada campo) ----------

function campo(o: unknown, k: string): unknown {
  return typeof o === 'object' && o !== null && k in o ? Reflect.get(o, k) : undefined
}

function numero(o: unknown, k: string): number | null {
  const v = campo(o, k)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function dentro(v: number | null, min: number, max: number): v is number {
  return v !== null && v >= min && v <= max
}

/** `[[g, f], ...]` com g crescente em 0..1. */
function pares(o: unknown, k: string): (readonly [number, number])[] | null {
  const v = campo(o, k)
  if (!Array.isArray(v) || v.length < 2) return null
  const out: (readonly [number, number])[] = []
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2) return null
    const [g, f] = p
    if (typeof g !== 'number' || typeof f !== 'number' || !Number.isFinite(g) || !Number.isFinite(f) || g < 0 || g > 1) return null
    if (out.length > 0 && g <= out[out.length - 1][0]) return null
    out.push([g, f])
  }
  return out
}

function lerRampa(t: unknown): Rampa | null {
  const escuro = pares(t, 'escuro')
  const claro = pares(t, 'claro')
  const cromaNaSombra = numero(t, 'cromaNaSombra')
  const amareloNaLuz = numero(t, 'amareloNaLuz')
  const cromaNaLuz = numero(t, 'cromaNaLuz')
  const escuroAte = numero(t, 'escuroAte')
  const claroDesde = numero(t, 'claroDesde')
  if (escuro === null || claro === null || !dentro(cromaNaSombra, -1, 1) || !dentro(amareloNaLuz, 0, 1) || !dentro(cromaNaLuz, 0, 1)) return null
  if (!dentro(escuroAte, 0, 1) || !dentro(claroDesde, 0, 1)) return null
  return { escuro, claro, cromaNaSombra, amareloNaLuz, cromaNaLuz, escuroAte, claroDesde }
}

const COR_HEX = /^#[0-9a-f]{6}$/i

function lerSombra(s: unknown): SombraDaParede | null {
  if (campo(s, 'jeito') !== 'deslocada') return null
  const deslocamentoPx = numero(s, 'deslocamentoPx')
  const borraoPx = numero(s, 'borraoPx')
  const alfa = numero(s, 'alfa')
  const cor = campo(s, 'cor')
  const dir = campo(s, 'direcao')
  if (!dentro(deslocamentoPx, 0, 64) || !dentro(borraoPx, 0, 64) || !dentro(alfa, 0, 1) || typeof cor !== 'string' || !COR_HEX.test(cor)) return null
  if (!Array.isArray(dir) || dir.length !== 2 || typeof dir[0] !== 'number' || typeof dir[1] !== 'number') return null
  const l = Math.hypot(dir[0], dir[1])
  if (!(l > 1e-6)) return null
  return { deslocamentoPx, direcao: [dir[0] / l, dir[1] / l], borraoPx, cor, alfa }
}

/** O `textura.json` da parede (o bruto, como veio); `null` = não serve (as paredes ficam no Atual). */
export function lerParamsDaParede(bruto: unknown): ParamsDaParede | null {
  const p = campo(bruto, 'parede')
  const c = campo(p, 'contorno')
  const px = numero(c, 'px')
  const minPx = numero(c, 'minPx')
  const fracao = numero(c, 'fracao')
  const valor = numero(c, 'valor')
  if (!dentro(px, 0, 32) || !dentro(minPx, 0, 32) || !dentro(fracao, 0, 0.5) || !dentro(valor, 0, 1) || minPx > px) return null
  const e = campo(p, 'espessuraDoDegrauPx')
  const thin = numero(e, 'thin')
  const medium = numero(e, 'medium')
  const thick = numero(e, 'thick')
  if (!dentro(thin, 1, 64) || !dentro(medium, 1, 64) || !dentro(thick, 1, 64)) return null
  const trechoCurtoCasas = numero(p, 'trechoCurtoCasas') ?? 1.25
  const rampa = lerRampa(campo(bruto, 'tingir'))
  const sombra = lerSombra(campo(bruto, 'sombra'))
  if (!dentro(trechoCurtoCasas, 0, 16) || rampa === null || sombra === null) return null
  return { contorno: { px, minPx, fracao, valor }, degrau: { thin, medium, thick }, trechoCurtoCasas, rampa, sombra }
}

/** O contorno que o app pinta (11.15): c = clamp(fracao * t, minPx, px), em px do traço. */
export function contornoDa(t: number, c: ContornoDaParede): number {
  return Math.min(c.px, Math.max(c.minPx, c.fracao * t))
}

/** A imagem pela espessura (11.4): t < 26 px do traço o Baixo, < 40 o Médio, senão o Alto. */
export function alturaDaParede(t: number, limites: readonly [number, number]): AlturaDoTraco {
  return t < limites[0] ? 'baixo' : t < limites[1] ? 'medio' : 'alto'
}

// ---------- a cadeia e a geometria ----------

/** Uma cadeia: as paredes ligadas de `groupWallChains` (a porta parte, a janela e a grade não). */
export interface CadeiaDaParede {
  readonly id: string
  /** Os pontos em px do mundo do app, sem repetidos seguidos. */
  readonly pontos: readonly Pt[]
  /** Um papel por trecho: `pontos.length - 1` (aberta) ou `pontos.length` (fechada). */
  readonly papeis: readonly PapelDaParede[]
  /** O trecho sai na tela? (O jogador só desenha o que está perto e o já visto; a conta é da cadeia inteira.) */
  readonly desenha: readonly boolean[]
  readonly fechada: boolean
  /** A espessura em px do traço (o mundo é `espessura * k`). */
  readonly espessura: number
  /** A linha da rampa desta cor no atlas (`malhaDaParede.ts`). */
  readonly linha: number
  /** Por trecho, a porta dos trechos de papel "porta" (`null` nos outros). */
  readonly portas?: readonly (PortaDaCadeia | null)[]
}

interface Geo {
  readonly P: readonly Pt[]
  readonly nSeg: number
  readonly s: readonly number[]
  readonly len: number
  readonly d: readonly Pt[]
  readonly nr: readonly Pt[]
  /** Por vértice: o vetor do esquadro (dot com a normal do trecho = 1). */
  readonly o: readonly Pt[]
}

function geoDa(c: CadeiaDaParede): Geo {
  const P = c.pontos
  const n = P.length
  const nSeg = c.fechada ? n : n - 1
  const d: Pt[] = []
  const nr: Pt[] = []
  const s = [0]
  for (let i = 0; i < nSeg; i += 1) {
    const a = P[i]
    const b = P[(i + 1) % n]
    const l = Math.max(1e-9, Math.hypot(b[0] - a[0], b[1] - a[1]))
    d.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l])
    nr.push([-(b[1] - a[1]) / l, (b[0] - a[0]) / l])
    s.push(s[i] + l)
  }
  const o: Pt[] = []
  for (let v = 0; v < n; v += 1) {
    const antes = c.fechada ? (v + nSeg - 1) % nSeg : v - 1
    const depois = c.fechada ? v % nSeg : v
    if (antes < 0) {
      o.push(nr[0])
      continue
    }
    if (depois >= nSeg) {
      o.push(nr[nSeg - 1])
      continue
    }
    const mx = nr[antes][0] + nr[depois][0]
    const my = nr[antes][1] + nr[depois][1]
    const ml = Math.hypot(mx, my)
    if (ml < 1e-6) {
      o.push(nr[depois])
      continue
    }
    const m: Pt = [mx / ml, my / ml]
    const esc = 1 / Math.max(0.25, m[0] * nr[depois][0] + m[1] * nr[depois][1])
    o.push([m[0] * esc, m[1] * esc])
  }
  return { P, nSeg, s, len: s[nSeg], d, nr, o }
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

// ---------- as corridas ----------

/** As faces conferidas dos três itens; sem a da janela ou da grade, a parede vale por elas. */
/** A imagem e o plano de uma forma de porta (o plano sai do bloco `parede.porta` do `textura.json`). */
export interface FaceDaPorta {
  readonly face: FaceDoTraco
  readonly plano: PlanoDaPorta
}

export interface FacesDaParede {
  readonly parede: FaceDoTraco
  readonly janela: FaceDoTraco | null
  readonly grade: FaceDoTraco | null
  /** As portas por forma (lote 18); sem a forma, a normal; sem nenhuma, o trecho sai como parede. */
  readonly portas?: Partial<Record<DoorKind, FaceDaPorta>>
}

/** Um módulo de uma corrida, em `s` do mundo. `liso` = a coluna da costura inteira. */
interface Pedaco {
  readonly s0: number
  readonly s1: number
  readonly item: ItemDaParede
  /** Onde a leitura começa na imagem (px da imagem): o módulo, ou o pedaço dele (a porta). */
  readonly xPx: number
  /** Px do traço; 0 = liso. */
  readonly comprimentoPx: number
  readonly espelho: boolean
}

/** Um pedaço da folha de uma porta (o 4º passe): só no trecho dela, na rampa da cor da porta. */
interface PedacoDaFolha extends Pedaco {
  readonly trecho: number
  readonly linha: number
}

/** A forma que tem imagem: a própria, senão a normal; `null` = nenhuma (a porta fica a do Atual). */
function formaComFace(forma: DoorKind, faces: FacesDaParede): DoorKind | null {
  if (faces.portas?.[forma] !== undefined) return forma
  return faces.portas?.normal !== undefined ? 'normal' : null
}

function itemDo(papel: PapelDaParede, faces: FacesDaParede): ItemDaParede {
  if (papel === 'janela' && faces.janela !== null) return 'janela'
  if (papel === 'grade' && faces.grade !== null) return 'grade'
  return 'parede'
}

function faceDoItem(item: ItemDaParede, faces: FacesDaParede): FaceDoTraco {
  if (item === 'porta') return faces.portas?.normal?.face ?? faces.parede
  if (item === 'porta-dupla') return faces.portas?.double?.face ?? faces.parede
  if (item === 'porta-portao') return faces.portas?.gate?.face ?? faces.parede
  return (item === 'janela' ? faces.janela : item === 'grade' ? faces.grade : null) ?? faces.parede
}

/** Os pedaços de todas as corridas da cadeia, em ordem de s (a referência: `corridasDa`), e os da folha das portas. */
function pedacosDa(c: CadeiaDaParede, g: Geo, faces: FacesDaParede, p: ParamsDaParede, k: number, cont: number): { pedacos: Pedaco[]; folhas: PedacoDaFolha[] } {
  // A porta sem imagem (nem a normal) fica parede, como antes do lote 18.
  const portaDe = (i: number): PortaDaCadeia | null => (c.papeis[i] === 'porta' ? (c.portas?.[i] ?? null) : null)
  const papelDe = (i: number): PapelDaParede => {
    if (c.papeis[i] !== 'porta') return c.papeis[i]
    const porta = portaDe(i)
    return porta !== null && formaComFace(porta.forma, faces) !== null ? 'porta' : 'parede'
  }
  const lim: { s: number; papel: PapelDaParede; trecho: number }[] = []
  for (let i = 0; i < g.nSeg; i += 1) if (i === 0 || papelDe(i) !== papelDe(i - 1) || papelDe(i) === 'porta' || ehQuina(g, c.fechada, i)) lim.push({ s: g.s[i], papel: papelDe(i), trecho: i })
  if (c.fechada && lim.length > 1 && papelDe(0) === papelDe(g.nSeg - 1) && papelDe(0) !== 'porta' && !ehQuina(g, true, 0)) {
    // A corrida do fim continua na do começo: junta as duas (passa pelo s = 0).
    const ult = lim[lim.length - 1]
    lim[0] = { s: ult.s - g.len, papel: ult.papel, trecho: ult.trecho }
    lim.pop()
  }
  // Os limites de cada corrida; as ombreiras da porta (11.16) saem da corrida de parede vizinha.
  const faixas = lim.map((l, j) => {
    let s0 = l.s
    let s1 = j + 1 < lim.length ? lim[j + 1].s : c.fechada ? lim[0].s + g.len : g.len
    if (!c.fechada && j === 0) s0 += cont
    if (!c.fechada && j === lim.length - 1) s1 -= cont
    return { s0, s1, papel: l.papel, trecho: l.trecho, ol: 0, or: 0 }
  })
  const n = faixas.length
  for (let j = 0; j < n; j += 1) {
    const fx = faixas[j]
    const porta = fx.papel === 'porta' ? portaDe(fx.trecho) : null
    const forma = porta === null ? null : formaComFace(porta.forma, faces)
    const daForma = forma === null ? undefined : faces.portas?.[forma]
    if (daForma === undefined) continue
    const o = daForma.plano.ombreiraPx * k
    const ant = j > 0 ? faixas[j - 1] : c.fechada && n > 1 ? faixas[n - 1] : null
    const dep = j + 1 < n ? faixas[j + 1] : c.fechada && n > 1 ? faixas[0] : null
    if (ant !== null && ant.papel === 'parede' && !ehQuina(g, c.fechada, fx.trecho) && ant.s1 - ant.s0 > o + 1) {
      ant.s1 -= o
      fx.ol = o
    }
    if (dep !== null && dep.papel === 'parede' && !ehQuina(g, c.fechada, fx.trecho + 1) && dep.s1 - dep.s0 > o + 1) {
      dep.s0 += o
      fx.or = o
    }
  }
  const out: Pedaco[] = []
  const folhas: PedacoDaFolha[] = []
  for (let j = 0; j < n; j += 1) {
    const { s0, s1, trecho, ol, or } = faixas[j]
    if (s1 - s0 < 1e-6) continue
    const porta = faixas[j].papel === 'porta' ? portaDe(trecho) : null
    const forma = porta === null ? null : formaComFace(porta.forma, faces)
    const daForma = forma === null ? undefined : faces.portas?.[forma]
    if (porta !== null && forma !== null && daForma !== undefined) {
      const item = ID_DA_FORMA[forma]
      const mods = daForma.face.modulos
      for (const q of pedacosDoVao(daForma.plano, mods[0].comprimentoPx, s0, s1, ol, or, k)) {
        out.push({ s0: q.s0, s1: q.s1, item, xPx: mods[0].xPx + 2 * q.x0, comprimentoPx: q.comp, espelho: false })
      }
      if (porta.estado !== null) {
        const m = mods[MODULO_DO_ESTADO[porta.estado]]
        for (const q of pedacosDaFolha(daForma.plano, s0, s1, k)) {
          folhas.push({ s0: q.s0, s1: q.s1, item, xPx: m.xPx + 2 * q.x0, comprimentoPx: q.comp, espelho: false, trecho, linha: porta.linha })
        }
      }
      continue
    }
    const item = itemDo(faixas[j].papel, faces)
    const face = faceDoItem(item, faces)
    const L = (s1 - s0) / k
    if (item === 'parede') {
      if (L < p.trechoCurtoCasas * 64) {
        out.push({ s0, s1, item, xPx: face.modulos[0].xPx, comprimentoPx: 0, espelho: false })
        continue
      }
      for (const q of sequenciaDeModulos(face, `${c.id}:${j}`, L, true)) {
        const m = face.modulos[q.m]
        out.push({ s0: s0 + q.s0 * k, s1: s0 + q.s1 * k, item, xPx: m.xPx, comprimentoPx: m.comprimentoPx, espelho: q.espelho })
      }
    } else {
      const m = face.modulos[0]
      const vezes = Math.max(1, Math.round(L / m.comprimentoPx))
      for (let i = 0; i < vezes; i += 1) out.push({ s0: s0 + ((s1 - s0) * i) / vezes, s1: s0 + ((s1 - s0) * (i + 1)) / vezes, item, xPx: m.xPx, comprimentoPx: m.comprimentoPx, espelho: false })
    }
  }
  return { pedacos: out, folhas }
}

// ---------- o T ----------

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
function encosta(c: CadeiaDaParede, outras: readonly CadeiaDaParede[], k: number): boolean {
  if (c.fechada) return false
  const pontas = [c.pontos[0], c.pontos[c.pontos.length - 1]]
  for (const o of outras) {
    if (o === c) continue
    const meia = (o.espessura * k) / 2
    const n = o.pontos.length
    const nSeg = o.fechada ? n : n - 1
    const soltas = o.fechada ? [] : [o.pontos[0], o.pontos[n - 1]]
    for (const p of pontas) {
      if (soltas.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < meia)) continue
      for (let i = 0; i < nSeg; i += 1) if (distanciaAoTrecho(p, o.pontos[i], o.pontos[(i + 1) % n]) < meia) return true
    }
  }
  return false
}

// ---------- os números das malhas ----------

/**
 * Os números de uma malha da parede (por vértice; o pedaço é um polígono convexo em leque):
 * - `quadA`/`quadB`: q0, e, f, g do quadrilátero do trecho inteiro (a inversa dá o `v`, a travessia);
 * - `trecho`: o começo `a` e a direção `d` do trecho (o `s` sai da projeção, como na referência);
 * - `faixa`: s em `a`, w no lado `v = 0` e no `v = 1`, e a meia largura (o miolo `hi`, o contorno `t / 2`);
 * - `corte`: o `s` preso na quina (de, até), o contorno e o comprimento da cadeia aberta (-1 = fechada);
 * - `modulo`: s0 e s1 do módulo, o x dele na imagem e o comprimento (px do traço; 0 = liso);
 * - `extra`: o espelho (+1 ou -1), a linha da rampa no atlas.
 */
export interface MalhaDaParede {
  readonly posicoes: Float32Array
  readonly quadA: Float32Array
  readonly quadB: Float32Array
  readonly trecho: Float32Array
  readonly faixa: Float32Array
  readonly corte: Float32Array
  readonly modulo: Float32Array
  readonly extra: Float32Array
  readonly indices: Uint32Array
}

interface Quad {
  readonly q0: Pt
  readonly q1: Pt
  readonly q2: Pt
  readonly q3: Pt
}

interface DoPedaco {
  readonly quad: Quad
  readonly a: Pt
  readonly d: Pt
  readonly faixa: readonly [number, number, number, number]
  readonly corte: readonly [number, number, number, number]
  readonly modulo: readonly [number, number, number, number]
  readonly extra: readonly [number, number, number, number]
}

class Montador {
  private readonly pos: number[] = []
  private readonly qa: number[] = []
  private readonly qb: number[] = []
  private readonly tr: number[] = []
  private readonly fx: number[] = []
  private readonly ct: number[] = []
  private readonly md: number[] = []
  private readonly ex: number[] = []
  private readonly idx: number[] = []

  poligono(pts: readonly Pt[], p: DoPedaco): void {
    if (pts.length < 3) return
    const { q0, q1, q2, q3 } = p.quad
    const e: Pt = [q1[0] - q0[0], q1[1] - q0[1]]
    const f: Pt = [q3[0] - q0[0], q3[1] - q0[1]]
    const g: Pt = [q0[0] - q1[0] + q2[0] - q3[0], q0[1] - q1[1] + q2[1] - q3[1]]
    const base = this.pos.length / 2
    for (const c of pts) {
      this.pos.push(c[0], c[1])
      this.qa.push(q0[0], q0[1], e[0], e[1])
      this.qb.push(f[0], f[1], g[0], g[1])
      this.tr.push(p.a[0], p.a[1], p.d[0], p.d[1])
      this.fx.push(...p.faixa)
      this.ct.push(...p.corte)
      this.md.push(...p.modulo)
      this.ex.push(...p.extra)
    }
    for (let i = 1; i + 1 < pts.length; i += 1) this.idx.push(base, base + i, base + i + 1)
  }

  pronta(): MalhaDaParede | null {
    if (this.idx.length === 0) return null
    return {
      posicoes: new Float32Array(this.pos),
      quadA: new Float32Array(this.qa),
      quadB: new Float32Array(this.qb),
      trecho: new Float32Array(this.tr),
      faixa: new Float32Array(this.fx),
      corte: new Float32Array(this.ct),
      modulo: new Float32Array(this.md),
      extra: new Float32Array(this.ex),
      indices: new Uint32Array(this.idx),
    }
  }
}

/** O polígono convexo cortado pelo semiplano `dot(x - a, d) + s0 >= lim` (`lado` +1) ou `<= lim` (-1). */
function cortar(pts: readonly Pt[], a: Pt, d: Pt, sA: number, lim: number, lado: 1 | -1): Pt[] {
  const val = (p: Pt): number => lado * (sA + (p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] - lim)
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const vp = val(p)
    const vq = val(q)
    if (vp >= 0) out.push(p)
    if ((vp >= 0) !== (vq >= 0)) {
      const t = vp / (vp - vq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out
}

function quadDoTrecho(g: Geo, i: number, w0: number, w1: number, antes: number, depois: number): Quad {
  const n = g.P.length
  const a = g.P[i]
  const b = g.P[(i + 1) % n]
  const oa = g.o[i]
  const ob = g.o[(i + 1) % n]
  const [dx, dy] = g.d[i]
  const A: Pt = [a[0] - dx * antes, a[1] - dy * antes]
  const B: Pt = [b[0] + dx * depois, b[1] + dy * depois]
  return {
    q0: [A[0] + oa[0] * w0, A[1] + oa[1] * w0],
    q1: [B[0] + ob[0] * w0, B[1] + ob[1] * w0],
    q2: [B[0] + ob[0] * w1, B[1] + ob[1] * w1],
    q3: [A[0] + oa[0] * w1, A[1] + oa[1] * w1],
  }
}

function cantos(q: Quad): Pt[] {
  return [q.q0, q.q1, q.q2, q.q3]
}

/** Um lote de miolos seguidos na ordem da referência com a mesma imagem (altura). */
export interface LoteDoMiolo {
  readonly altura: AlturaDoTraco
  readonly malhas: Readonly<Record<ItemDaParede, MalhaDaParede | null>>
}

export interface MalhasDasParedes {
  /** A faixa inteira de cada trecho desenhado, exata (para a sombra): 4 cantos em px do mundo. */
  readonly faixas: readonly (readonly Pt[])[]
  /** O passe 1: a faixa inteira no valor do contorno, de todas as cadeias. */
  readonly contorno: MalhaDaParede | null
  /** O passe 2: os miolos, na ordem (o T primeiro, a mais fina, a fechada por último). */
  readonly miolos: readonly LoteDoMiolo[]
  /** O passe 3 (lote 18): as folhas das portas paradas, por cima de todos os miolos. */
  readonly folhas: readonly LoteDoMiolo[]
  /** As portas que a parede desenha (o vão sempre; a folha se parada), com a meia espessura da folha em px do mundo. */
  readonly portas: ReadonlyMap<string, number>
}

function montadores(): Record<ItemDaParede, Montador> {
  return { parede: new Montador(), janela: new Montador(), grade: new Montador(), porta: new Montador(), 'porta-dupla': new Montador(), 'porta-portao': new Montador() }
}

/** Os lotes seguidos com a mesma imagem: troca de altura fecha o lote. */
class Lotes {
  readonly lotes: LoteDoMiolo[] = []
  private atual: { altura: AlturaDoTraco; m: Record<ItemDaParede, Montador> } | null = null

  de(altura: AlturaDoTraco): Record<ItemDaParede, Montador> {
    if (this.atual === null || this.atual.altura !== altura) {
      this.fechar()
      this.atual = { altura, m: montadores() }
    }
    return this.atual.m
  }

  fechar(): void {
    if (this.atual === null) return
    const m = this.atual.m
    const malhas = Object.fromEntries(ITENS_DA_PAREDE.map((item) => [item, m[item].pronta()])) as Record<ItemDaParede, MalhaDaParede | null>
    if (ITENS_DA_PAREDE.some((item) => malhas[item] !== null)) this.lotes.push({ altura: this.atual.altura, malhas })
    this.atual = null
  }
}

const SEM_CORTE = 1e9

/**
 * As malhas de todas as cadeias de um nó. `grid` dá `k`; `pxDaTela` é o px do mundo
 * que um px da tela cobre (a margem do anti-serrilhado, feito no shader).
 */
export function malhasDasParedes(cadeias: readonly CadeiaDaParede[], faces: FacesDaParede, p: ParamsDaParede, grid: number, pxDaTela: number): MalhasDasParedes {
  const k = grid / 64
  const m = 1.5 * pxDaTela
  const faixas: Pt[][] = []
  const contorno = new Montador()
  const geos = new Map<CadeiaDaParede, Geo>(cadeias.map((c) => [c, geoDa(c)]))
  // 1. A faixa inteira (a sombra) e o contorno (o anti-serrilhado do lado e da ponta no shader).
  for (const c of cadeias) {
    const g = geos.get(c)
    if (g === undefined || g.len <= 1e-6) continue
    const meia = (c.espessura * k) / 2
    const lenAberta = c.fechada ? -1 : g.len
    for (let i = 0; i < g.nSeg; i += 1) {
      if (!c.desenha[i]) continue
      faixas.push(cantos(quadDoTrecho(g, i, -meia, meia, 0, 0)))
      const antes = !c.fechada && i === 0 ? m : 0
      const depois = !c.fechada && i === g.nSeg - 1 ? m : 0
      const quad = quadDoTrecho(g, i, -meia - m, meia + m, antes, depois)
      contorno.poligono(cantos(quad), {
        quad,
        a: g.P[i],
        d: g.d[i],
        faixa: [g.s[i], -meia - m, meia + m, meia],
        corte: [-SEM_CORTE, SEM_CORTE, 0, lenAberta],
        modulo: [0, 1, 0, 0],
        extra: [1, c.linha, 0, 0],
      })
    }
  }
  // 2. Os miolos: primeiro quem encosta a ponta no meio de outra, depois a mais fina, a fechada por último.
  const ordem = cadeias
    .map((c) => ({ c, t: encosta(c, cadeias, k) }))
    .sort((a, b) => Number(b.t) - Number(a.t) || a.c.espessura - b.c.espessura || Number(a.c.fechada) - Number(b.c.fechada))
    .map((x) => x.c)
  const miolos = new Lotes()
  const folhas = new Lotes()
  const portas = new Map<string, number>()
  for (const c of ordem) {
    const g = geos.get(c)
    if (g === undefined || g.len <= 1e-6) continue
    const tt = c.espessura * k
    const cont = contornoDa(c.espessura, p.contorno) * k
    const hi = tt / 2 - cont
    if (hi <= 0.25 * k) continue
    const altura = alturaDaParede(c.espessura, faces.parede.limites)
    const mm = miolos.de(altura)
    const { pedacos, folhas: daFolha } = pedacosDa(c, g, faces, p, k, cont)
    if (pedacos.length === 0) continue
    for (const q of pedacos) if (q.item !== 'parede' && q.item !== 'janela' && q.item !== 'grade') {
      const i = trechoEm(g, q.s0, q.s1)
      const porta = c.portas?.[i]
      if (porta != null && c.desenha[i]) portas.set(porta.id, meiaDaFolhaNoMundo(faceDoItem(q.item, faces).alturas[altura].hPx, hi))
    }
    const primeiro = pedacos[0]
    const ultimo = pedacos[pedacos.length - 1]
    const lenAberta = c.fechada ? -1 : g.len
    const desvios = c.fechada ? [-g.len, 0, g.len] : [0]
    for (let i = 0; i < g.nSeg; i += 1) {
      if (!c.desenha[i]) continue
      const quad = quadDoTrecho(g, i, -hi - m, hi + m, 0, 0)
      const poli = cantos(quad)
      const a = g.P[i]
      const d = g.d[i]
      // O s de cada canto do quad (a projeção) e o s preso na quina: além dela, a coluna da ponta esticada.
      const ss = poli.map((q) => g.s[i] + (q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1])
      const lo = ehQuina(g, c.fechada, i) ? g.s[i] + 1e-3 : -SEM_CORTE
      const hiS = ehQuina(g, c.fechada, i + 1) ? g.s[i + 1] - 1e-3 : SEM_CORTE
      const rMin = Math.max(lo, Math.min(...ss))
      const rMax = Math.min(hiS, Math.max(...ss))
      for (const desvio of desvios) {
        for (const q of pedacos) {
          const p0 = q.s0 + desvio
          const p1 = q.s1 + desvio
          if (p1 <= rMin || p0 >= rMax) continue
          // A ponta da cadeia aberta: a margem deixa o shader fazer a borda suave do contorno da ponta.
          const de = p0 <= lo ? -SEM_CORTE : q === primeiro && !c.fechada ? p0 - m : p0
          const ate = p1 >= hiS ? SEM_CORTE : q === ultimo && !c.fechada ? p1 + m : p1
          let corte = de > -SEM_CORTE ? cortar(poli, a, d, g.s[i], de, 1) : poli
          if (ate < SEM_CORTE) corte = cortar(corte, a, d, g.s[i], ate, -1)
          mm[q.item].poligono(corte, {
            quad,
            a,
            d,
            faixa: [g.s[i], -hi - m, hi + m, hi],
            corte: [lo, hiS, cont, lenAberta],
            modulo: [p0, p1, q.xPx, q.comprimentoPx],
            extra: [q.espelho ? -1 : 1, c.linha, 0, 0],
          })
        }
      }
    }
    // 3. As folhas desta cadeia, guardadas para depois de todos os miolos (a folha fica por cima do vão).
    if (daFolha.length === 0) continue
    const mf = folhas.de(altura)
    for (const q of daFolha) {
      const i = q.trecho
      if (!c.desenha[i]) continue
      const quad = quadDoTrecho(g, i, -hi - m, hi + m, 0, 0)
      const a = g.P[i]
      const d = g.d[i]
      const lo = ehQuina(g, c.fechada, i) ? g.s[i] + 1e-3 : -SEM_CORTE
      const hiS = ehQuina(g, c.fechada, i + 1) ? g.s[i + 1] - 1e-3 : SEM_CORTE
      const corte = cortar(cortar(cantos(quad), a, d, g.s[i], q.s0, 1), a, d, g.s[i], q.s1, -1)
      mf[q.item].poligono(corte, {
        quad,
        a,
        d,
        faixa: [g.s[i], -hi - m, hi + m, hi],
        corte: [lo, hiS, cont, lenAberta],
        modulo: [q.s0, q.s1, q.xPx, q.comprimentoPx],
        extra: [1, q.linha, 0, 0],
      })
    }
  }
  miolos.fechar()
  folhas.fechar()
  return { faixas, contorno: contorno.pronta(), miolos: miolos.lotes, folhas: folhas.lotes, portas }
}

/** O trecho que contém o meio de [s0, s1] (o vão da porta é um trecho só). */
function trechoEm(g: Geo, s0: number, s1: number): number {
  const s = ((((s0 + s1) / 2) % g.len) + g.len) % g.len
  for (let i = 0; i < g.nSeg; i += 1) if (s < g.s[i + 1]) return i
  return g.nSeg - 1
}
