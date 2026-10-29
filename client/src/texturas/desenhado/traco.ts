import { hash } from '../ruido'

/**
 * O NÚCLEO DO TRAÇO DESENHADO (plano de 29/10/2026, F4; CONTRATO.md seção 11):
 * a conta que deita a face e a borda de um traço do pacote ao longo de uma
 * linha do mapa. Sem Pixi e sem I/O: a leitura do `textura.json`, a sequência
 * de módulos sorteada pelo id, a escolha da imagem pela espessura vista, a luz
 * e a montagem da malha (os números de cada vértice). O desenho na placa é de
 * `pixi/malhaDoTraco.ts`; quem usa: o barranco (`pixi/drawBarranco.ts`, F4a) e
 * a parede, a janela e a grade (F4b).
 *
 * A referência é `godot/desenhado/ferramentas/traco.ts` (`pintarDesenhado`, por
 * pixel): o shader faz, em cada pixel, a mesma inversa do quadrilátero do
 * `varrerTrecho` de lá, com os números que esta malha leva em cada vértice.
 *
 * Unidades: "px do traço" = px do mundo a 64 px por casa (o pacote mede assim);
 * o app converte pelo grid (`k = grid / 64`). A imagem tem 2 px por px do traço.
 */

export type AlturaDoTraco = 'baixo' | 'medio' | 'alto'
export const ALTURAS_DO_TRACO: readonly AlturaDoTraco[] = ['baixo', 'medio', 'alto']
/** A luz do app: de cima à esquerda (CONTRATO 11.5). */
export const LUZ_DO_TRACO: readonly [number, number] = [-Math.SQRT1_2, -Math.SQRT1_2]
/** A casa em que o pacote mede, em px do mundo. */
export const CASA_DO_TRACO = 64
/** Px da imagem por px do traço (11.3: 128 por casa). */
export const IMAGEM_POR_PX = 2

type Pt = readonly [number, number]

export interface ModuloDaFace {
  readonly casas: number
  /** Comprimento em px do traço. */
  readonly comprimentoPx: number
  /** Onde o módulo começa na imagem (depois da folga), em px da imagem. */
  readonly xPx: number
}

export interface ImagemDaAltura {
  /** A altura da face em px do traço (20, 32, 48 no penhasco). */
  readonly hPx: number
  readonly cor: string
  readonly relevo: string
  readonly largura: number
  readonly altura: number
}

export interface SombraDoTraco {
  readonly jeito: 'pe' | 'nenhuma'
  readonly comprimentoPx: number
  readonly borraoPx: number
  readonly cor: string
  readonly alfa: number
}

/** O `textura.json` de uma face (`"parte": "face"`), conferido. */
export interface FaceDoTraco {
  readonly id: string
  readonly alturas: Readonly<Record<AlturaDoTraco, ImagemDaAltura>>
  readonly modulos: readonly ModuloDaFace[]
  readonly acimaPx: number
  readonly abaixoPx: number
  /** `tv` abaixo do primeiro usa o Baixo, abaixo do segundo o Médio (11.4). */
  readonly limites: readonly [number, number]
  readonly semente: number
  readonly luz: { readonly face: number; readonly relevo: number }
  readonly sombra: SombraDoTraco
  /** O id da borda que anda junto (`penhasco-borda`), ou `null`. */
  readonly borda: string | null
  /** O jeito de pegar a cor do mestre (11.8); `null` = a face tem o tom próprio. */
  readonly tingir: string | null
}

export interface LinhaDaBorda {
  readonly nome: string
  readonly ancora: 'beira' | 'pe'
  readonly chao: readonly string[]
  /** Onde a linha começa na imagem, em px da imagem. */
  readonly yPx: number
}

/** O `textura.json` de uma borda (`"parte": "borda"`), conferido. */
export interface BordaDoTraco {
  readonly id: string
  readonly arquivo: string
  /** O período ao longo, em px do traço. */
  readonly comprimentoPx: number
  readonly acimaPx: number
  readonly abaixoPx: number
  /** A altura de cada linha na imagem, em px da imagem. */
  readonly linhaPx: number
  readonly linhas: readonly LinhaDaBorda[]
  readonly largura: number
  readonly altura: number
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

function lista(o: unknown, k: string): readonly unknown[] | null {
  const v = campo(o, k)
  return Array.isArray(v) ? v : null
}

function dentro(v: number | null, min: number, max: number): v is number {
  return v !== null && v >= min && v <= max
}

/** `[largura, altura]` em px inteiros positivos. */
function tamanho(o: unknown): readonly [number, number] | null {
  const v = lista(o, 'imagem')
  if (v === null || v.length !== 2) return null
  const [w, h] = v
  return typeof w === 'number' && typeof h === 'number' && Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 8192 && h <= 8192 ? [w, h] : null
}

const COR_HEX = /^#[0-9a-f]{6}$/i
const ARQUIVO_PNG = /^[a-z0-9-]+\.png$/

function lerAltura(bruto: unknown, acima: number, abaixo: number): ImagemDaAltura | null {
  const hPx = numero(bruto, 'hPx')
  const arquivos = campo(bruto, 'arquivos')
  const cor = texto(arquivos, 'cor')
  const relevo = texto(arquivos, 'relevo')
  const t = tamanho(bruto)
  if (!dentro(hPx, 1, 256) || cor === null || relevo === null || !ARQUIVO_PNG.test(cor) || !ARQUIVO_PNG.test(relevo) || t === null) return null
  // A imagem tem de ter a altura da conta (11.3): acima + face + abaixo, a 2 px por px.
  if (Math.abs(t[1] - IMAGEM_POR_PX * (acima + hPx + abaixo)) > 0.5) return null
  return { hPx, cor, relevo, largura: t[0], altura: t[1] }
}

function lerModulo(bruto: unknown, largura: number): ModuloDaFace | null {
  const casas = numero(bruto, 'casas')
  const comprimentoPx = numero(bruto, 'comprimentoPx')
  const xPx = numero(bruto, 'xPx')
  if (!dentro(casas, 0.25, 16) || !dentro(comprimentoPx, 8, 1024) || !dentro(xPx, 0, largura)) return null
  if (xPx + IMAGEM_POR_PX * comprimentoPx > largura) return null
  return { casas, comprimentoPx, xPx }
}

function lerSombraDoTraco(bruto: unknown): SombraDoTraco | null {
  const jeito = texto(bruto, 'jeito')
  const comprimentoPx = numero(bruto, 'comprimentoPx') ?? 0
  const borraoPx = numero(bruto, 'borraoPx') ?? 0
  const cor = texto(bruto, 'cor') ?? '#0a1c28'
  const alfa = numero(bruto, 'alfa') ?? 0.25
  if (jeito !== 'pe' && jeito !== 'nenhuma') return null
  if (!dentro(comprimentoPx, 0, 64) || !dentro(borraoPx, 0, 64) || !COR_HEX.test(cor) || !dentro(alfa, 0, 1)) return null
  return { jeito, comprimentoPx, borraoPx, cor, alfa }
}

/** O `textura.json` de uma face do pacote; `null` = não serve (o app fica no Atual). */
export function lerFaceDoTraco(bruto: unknown): FaceDoTraco | null {
  const id = texto(bruto, 'id')
  if (id === null || texto(bruto, 'tipo') !== 'traco' || texto(bruto, 'parte') !== 'face' || numero(bruto, 'contrato') !== 1) return null
  const face = campo(bruto, 'face')
  const acimaPx = numero(face, 'acimaPx')
  const abaixoPx = numero(face, 'abaixoPx')
  if (!dentro(acimaPx, 0, 64) || !dentro(abaixoPx, 0, 64)) return null
  const brutas = campo(bruto, 'alturas')
  const baixo = lerAltura(campo(brutas, 'baixo'), acimaPx, abaixoPx)
  const medio = lerAltura(campo(brutas, 'medio'), acimaPx, abaixoPx)
  const alto = lerAltura(campo(brutas, 'alto'), acimaPx, abaixoPx)
  if (baixo === null || medio === null || alto === null) return null
  // Os módulos têm o mesmo x nas três imagens: a menor largura vale para todos.
  const largura = Math.min(baixo.largura, medio.largura, alto.largura)
  const brutos = lista(face, 'modulos')
  if (brutos === null || brutos.length < 1 || brutos.length > 6) return null
  const modulos: ModuloDaFace[] = []
  for (const m of brutos) {
    const lido = lerModulo(m, largura)
    if (lido === null) return null
    modulos.push(lido)
  }
  const escolha = lista(campo(face, 'escolha'), 'limitesPx')
  const l0 = escolha?.[0]
  const l1 = escolha?.[1]
  const limites: readonly [number, number] = typeof l0 === 'number' && typeof l1 === 'number' && l0 > 0 && l1 > l0 ? [l0, l1] : [26, 40]
  const semente = numero(campo(bruto, 'sequencia'), 'semente')
  const luzFace = numero(campo(bruto, 'luz'), 'face')
  const luzRelevo = numero(campo(bruto, 'luz'), 'relevo')
  const sombra = lerSombraDoTraco(campo(bruto, 'sombra'))
  if (semente === null || !Number.isInteger(semente) || !dentro(luzFace, 0, 2) || !dentro(luzRelevo, 0, 2) || sombra === null) return null
  const borda = texto(bruto, 'borda')
  const tingir = texto(bruto, 'tingir')
  return { id, alturas: { baixo, medio, alto }, modulos, acimaPx, abaixoPx, limites, semente, luz: { face: luzFace, relevo: luzRelevo }, sombra, borda, tingir }
}

/** O `textura.json` de uma borda do pacote; `null` = não serve (a face sai sem borda). */
export function lerBordaDoTraco(bruto: unknown): BordaDoTraco | null {
  const id = texto(bruto, 'id')
  if (id === null || texto(bruto, 'tipo') !== 'traco' || texto(bruto, 'parte') !== 'borda' || numero(bruto, 'contrato') !== 1) return null
  const b = campo(bruto, 'borda')
  const arquivo = texto(b, 'arquivo')
  const comprimentoPx = numero(b, 'comprimentoPx')
  const acimaPx = numero(b, 'acimaPx')
  const abaixoPx = numero(b, 'abaixoPx')
  const linhaPx = numero(b, 'linhaPx')
  const t = tamanho(b)
  if (arquivo === null || !ARQUIVO_PNG.test(arquivo) || t === null) return null
  if (!dentro(comprimentoPx, 64, 4096) || !dentro(acimaPx, 0, 64) || !dentro(abaixoPx, 0, 64) || !dentro(linhaPx, 1, 512)) return null
  if (Math.abs(t[0] - IMAGEM_POR_PX * comprimentoPx) > 0.5) return null
  const brutas = lista(b, 'linhas')
  if (brutas === null || brutas.length < 1) return null
  const linhas: LinhaDaBorda[] = []
  for (const l of brutas) {
    const nome = texto(l, 'nome')
    const ancora = texto(l, 'ancora')
    const yPx = numero(l, 'yPx')
    const chao = lista(l, 'chao') ?? []
    if (nome === null || (ancora !== 'beira' && ancora !== 'pe') || !dentro(yPx, 0, t[1] - linhaPx)) return null
    linhas.push({ nome, ancora, yPx, chao: chao.filter((c): c is string => typeof c === 'string') })
  }
  return { id, arquivo, comprimentoPx, acimaPx, abaixoPx, linhaPx, linhas, largura: t[0], altura: t[1] }
}

// ---------- a sequência de módulos (11.6) ----------

/** O hash do id do traço (FNV-1a de 32 bits): risco = o id; área = `area:<nível>:<n>`. */
export function hashDoId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) & 0x7fffffff
}

/** Um módulo no comprimento da linha: de `s0` a `s1` (px do traço), o índice e o espelho. */
export interface PecaDoTraco {
  readonly s0: number
  readonly s1: number
  readonly m: number
  readonly espelho: boolean
}

/** Teto de módulos por linha: uma beira de 20 000 casas, muito além de qualquer mapa. */
const MODULOS_NO_MAXIMO = 10000

/**
 * Os módulos ao longo de uma linha de `len` px do traço (11.6). No laço fechado
 * os comprimentos escalam para fechar exatamente no começo, sem meio módulo.
 */
export function sequenciaDeModulos(face: Pick<FaceDoTraco, 'modulos' | 'semente'>, id: string, len: number, fechado: boolean): PecaDoTraco[] {
  const mods = face.modulos
  const N = mods.length
  const sem = face.semente + hashDoId(id)
  const pedidos: { m: number; espelho: boolean; L: number }[] = []
  let soma = 0
  let antes = -1
  for (let j = 0; soma < len || pedidos.length === 0; j += 1) {
    let m = Math.min(N - 1, Math.floor(hash(j, 0, sem) * N))
    if (N > 1 && m === antes) m = (m + 1) % N
    antes = m
    pedidos.push({ m, espelho: hash(j, 1, sem) < 0.5, L: mods[m].comprimentoPx })
    soma += mods[m].comprimentoPx
    if (j > MODULOS_NO_MAXIMO) break
  }
  // Fechado: o último entra ou sai pelo que fica mais perto, e todos escalam.
  const ultimo = pedidos[pedidos.length - 1]
  if (fechado && pedidos.length > 1 && soma - len > ultimo.L / 2) {
    soma -= ultimo.L
    pedidos.pop()
  }
  const k = fechado && soma > 0 ? len / soma : 1
  const out: PecaDoTraco[] = []
  let s = 0
  for (const q of pedidos) {
    out.push({ s0: s, s1: s + q.L * k, m: q.m, espelho: q.espelho })
    s += q.L * k
  }
  return out
}

// ---------- a imagem pela espessura vista (11.4) ----------

/**
 * A imagem de um módulo pela espessura VISTA no meio dele (px do traço), nunca
 * acima da altura da beira: a face do norte de um Alto (36%) usa a do Baixo.
 */
export function alturaDaVista(tPx: number, teto: AlturaDoTraco, limites: readonly [number, number]): AlturaDoTraco {
  const a: AlturaDoTraco = tPx < limites[0] ? 'baixo' : tPx < limites[1] ? 'medio' : 'alto'
  return ALTURAS_DO_TRACO.indexOf(a) < ALTURAS_DO_TRACO.indexOf(teto) ? a : teto
}

// ---------- a luz (11.5) e a borda (11.11) ----------

/** A parte da luz que vem da normal do trecho (o resto é do relevo, por pixel, no shader). */
export function luzDaFace(face: Pick<FaceDoTraco, 'luz'>, baixo: Pt): number {
  return face.luz.face * (baixo[0] * LUZ_DO_TRACO[0] + baixo[1] * LUZ_DO_TRACO[1])
}

/** Onde a borda começa no período (px do traço), pelo id do traço: duas beiras vizinhas não batem o mesmo desenho. */
export function desvioDaBorda(borda: Pick<BordaDoTraco, 'comprimentoPx'>, id: string): number {
  return hash(0, 2, hashDoId(id)) * borda.comprimentoPx
}

/**
 * A linha da borda de cima pelo chão do lado ALTO (o id da textura de chão do
 * pacote); chão desconhecido = a primeira linha de beira. A do pé só existe
 * onde o lado baixo é água (`agua` = true).
 */
export function linhaDaBorda(borda: Pick<BordaDoTraco, 'linhas'>, ancora: 'beira' | 'pe', chao: string | null): LinhaDaBorda | null {
  const candidatas = borda.linhas.filter((l) => l.ancora === ancora)
  if (ancora === 'pe') return chao === 'agua' ? (candidatas[0] ?? null) : null
  return (chao === null ? undefined : candidatas.find((l) => l.chao.includes(chao))) ?? candidatas[0] ?? null
}

/** A rampa suave de 0 a 1 entre `a` e `b` (o alfa da borda onde a beira afina). */
export function suave(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

// ---------- a malha (os números de cada vértice; o shader faz a conta por pixel) ----------

/**
 * Um trecho da linha como o `varrerTrecho` da referência: o quadrilátero de
 * `q0` (começo, em cima) a `q1` (fim, em cima), `q2` (fim, embaixo) e `q3`
 * (começo, embaixo), em px do mundo. O shader acha (u, v) de cada pixel pela
 * inversa exata dele; u anda de `sIni` a `sFim` (px do traço) e v de `vDe` a
 * `vAte` (o que v quer dizer é de quem desenha: a fração da altura na face).
 */
export interface QuadDoTraco {
  readonly q0: Pt
  readonly q1: Pt
  readonly q2: Pt
  readonly q3: Pt
  readonly sIni: number
  readonly sFim: number
  readonly vDe: number
  readonly vAte: number
  /** A normal do trecho para o lado baixo (`sn`): o "baixo" da face. */
  readonly baixo: Pt
  /** O trecho anda contra o "ao longo" da face: lê a imagem de trás para frente. */
  readonly contra: boolean
  /** Livres para quem desenha (na borda: a espessura no começo e no fim, e a altura da face no mundo). */
  readonly extraIni: number
  readonly extraFim: number
  readonly extraFixo: number
}

/** Os números de uma malha de quadriláteros (4 vértices e 6 índices por pedaço). */
export interface MalhaDoTraco {
  /** x, y por vértice (px do mundo). */
  readonly posicoes: Float32Array
  /** q0.x, q0.y, e.x, e.y por vértice (o mesmo nos 4 do pedaço). */
  readonly quadA: Float32Array
  /** f.x, f.y, g.x, g.y por vértice. */
  readonly quadB: Float32Array
  /** sIni, sFim, vDe, vAte por vértice. */
  readonly aoLongo: Float32Array
  /** s0, s1, xPx e comprimentoPx do módulo por vértice (na borda: os extras). */
  readonly modulo: Float32Array
  /** baixo.x, baixo.y, espelho (+1 ou -1), contra (0 ou 1) por vértice. */
  readonly quadro: Float32Array
  readonly indices: Uint32Array
}

/** O que um pedaço leva do módulo (a borda manda `null`: não tem módulos). */
interface ModuloNoPedaco {
  readonly s0: number
  readonly s1: number
  readonly xPx: number
  readonly comprimentoPx: number
  readonly espelho: boolean
}

class Montador {
  private readonly pos: number[] = []
  private readonly a: number[] = []
  private readonly b: number[] = []
  private readonly l: number[] = []
  private readonly m: number[] = []
  private readonly q: number[] = []
  private readonly idx: number[] = []

  get vazio(): boolean {
    return this.pos.length === 0
  }

  /** O pedaço do quad entre u0 e u1 (as linhas de u constante do quadrilátero são retas). */
  pedaco(quad: QuadDoTraco, u0: number, u1: number, mod: ModuloNoPedaco | null): void {
    const { q0, q1, q2, q3 } = quad
    const e: Pt = [q1[0] - q0[0], q1[1] - q0[1]]
    const f: Pt = [q3[0] - q0[0], q3[1] - q0[1]]
    const g: Pt = [q0[0] - q1[0] + q2[0] - q3[0], q0[1] - q1[1] + q2[1] - q3[1]]
    const emCima = (u: number): Pt => [q0[0] + e[0] * u, q0[1] + e[1] * u]
    const embaixo = (u: number): Pt => [q3[0] + (q2[0] - q3[0]) * u, q3[1] + (q2[1] - q3[1]) * u]
    const cantos = [emCima(u0), emCima(u1), embaixo(u1), embaixo(u0)]
    const base = this.pos.length / 2
    for (const c of cantos) {
      this.pos.push(c[0], c[1])
      this.a.push(q0[0], q0[1], e[0], e[1])
      this.b.push(f[0], f[1], g[0], g[1])
      this.l.push(quad.sIni, quad.sFim, quad.vDe, quad.vAte)
      if (mod === null) this.m.push(quad.extraIni, quad.extraFim, quad.extraFixo, 0)
      else this.m.push(mod.s0, mod.s1, mod.xPx, mod.comprimentoPx)
      this.q.push(quad.baixo[0], quad.baixo[1], mod?.espelho === true ? -1 : 1, quad.contra ? 1 : 0)
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  pronta(): MalhaDoTraco | null {
    if (this.vazio) return null
    return {
      posicoes: new Float32Array(this.pos),
      quadA: new Float32Array(this.a),
      quadB: new Float32Array(this.b),
      aoLongo: new Float32Array(this.l),
      modulo: new Float32Array(this.m),
      quadro: new Float32Array(this.q),
      indices: new Uint32Array(this.idx),
    }
  }
}

/** Uma peça da sequência com a imagem que ela usa (a escolha pela espessura vista). */
export interface PecaComAltura extends PecaDoTraco {
  readonly altura: AlturaDoTraco
}

/**
 * A face em três malhas, uma por imagem (Baixo, Médio, Alto): cada quad é
 * partido onde muda o módulo, e cada pedaço leva o módulo dele. As peças estão
 * em ordem de s; os quads, em qualquer ordem.
 */
export function malhasDaFace(face: Pick<FaceDoTraco, 'modulos'>, quads: readonly QuadDoTraco[], pecas: readonly PecaComAltura[]): Readonly<Record<AlturaDoTraco, MalhaDoTraco | null>> {
  const porAltura: Record<AlturaDoTraco, Montador> = { baixo: new Montador(), medio: new Montador(), alto: new Montador() }
  for (const quad of quads) {
    const a = Math.min(quad.sIni, quad.sFim)
    const b = Math.max(quad.sIni, quad.sFim)
    const ds = quad.sFim - quad.sIni
    if (b - a < 1e-9) continue
    for (let p = primeiraPeca(pecas, a); p < pecas.length && pecas[p].s0 < b; p += 1) {
      const peca = pecas[p]
      // A primeira peça começa em 0 e a última vai até o fim da linha: nada fica de fora.
      const ini = p === 0 ? a : Math.max(a, peca.s0)
      const fim = p === pecas.length - 1 ? b : Math.min(b, peca.s1)
      if (fim - ini < 1e-9) continue
      const u0 = (ini - quad.sIni) / ds
      const u1 = (fim - quad.sIni) / ds
      const m = face.modulos[peca.m]
      porAltura[peca.altura].pedaco(quad, Math.min(u0, u1), Math.max(u0, u1), { s0: peca.s0, s1: peca.s1, xPx: m.xPx, comprimentoPx: m.comprimentoPx, espelho: peca.espelho })
    }
  }
  return { baixo: porAltura.baixo.pronta(), medio: porAltura.medio.pronta(), alto: porAltura.alto.pronta() }
}

/** A malha da borda (ou de qualquer faixa sem módulos): um pedaço por quad, os extras no lugar do módulo. */
export function malhaSemModulos(quads: readonly QuadDoTraco[]): MalhaDoTraco | null {
  const m = new Montador()
  for (const quad of quads) m.pedaco(quad, 0, 1, null)
  return m.pronta()
}

/** A primeira peça que pode cobrir s (busca binária: as peças estão em ordem). */
function primeiraPeca(pecas: readonly PecaDoTraco[], s: number): number {
  let lo = 0
  let hi = pecas.length - 1
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (pecas[m].s0 <= s) lo = m
    else hi = m - 1
  }
  return lo
}
