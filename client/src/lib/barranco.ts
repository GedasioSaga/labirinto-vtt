import type { AlturaDoBarranco, BarrancoDoMapa, MapData, QuadradoAlto, RampaDeBarranco, RegionPoint, RiscoDeBarranco, Wall } from '../types/map'
import { caminhosParaJogador } from './penhasco'
import { pisoDe, pisoLido } from './pisos'

/**
 * BARRANCO (protótipo aprovado em 28/10/2026, `docs/design/barranco/`): a
 * parede de terra que dá parte alta e parte baixa nos mapas que não são de
 * continente. O Penhasco continua só no continente (`lib/penhasco.ts`).
 *
 * Dois jeitos de desenhar, que convivem:
 * - RISCO: a beira de cima, cortada livre, com o lado baixo (`lado`) para onde
 *   a parede cai. As pontas afinam até sumir: é por fora delas que a ficha passa.
 * - ÁREA ALTA: quadrados com nível de 1 a 3; a borda de cada nível vira
 *   barranco sozinha, e os meios das arestas viram curva (a beira não segue a
 *   grade, decisão 3 de 28/10).
 * A RAMPA é um vão de terra: o barranco mais perto do ponto abre 2 quadrados.
 *
 * Segura o ANDAR, não a visão: `segmentosQueSeguram` dá a linha do meio da
 * parede (fora das rampas) que o arrasto, o andar por clique e a batalha testam.
 *
 * Folha de propósito (só tipos, `pisos` e o corte de caminho do penhasco):
 * quem desenha (`pixi/drawBarranco.ts`) e quem anda importam daqui.
 */

// ---------------------------------------------------------------------------
// Medidas (as do protótipo, num quadrado de 32 px; o app escala pela grade)

/** O quadrado do protótipo, em px: as medidas abaixo são nele. */
export const QUADRADO_DO_PROTOTIPO = 32
/** Espessura da parede a 100%, em px do protótipo. */
export const ESPESSURA_DO_PROTOTIPO: Readonly<Record<AlturaDoBarranco, number>> = { baixo: 10, medio: 16, alto: 24 }
export const ALTURAS_DO_BARRANCO: readonly AlturaDoBarranco[] = ['baixo', 'medio', 'alto']
/** No máximo 3 degraus acima do chão (decisão 5 de 28/10). */
export const NIVEL_MAXIMO = 3
/** A rampa abre 2 quadrados ao longo do barranco. */
export const RAMPA_EM_QUADRADOS = 2
/** Virar pela alça: a parede recolhe e cresce do outro lado neste tempo. */
export const VIRAR_MS = 220
/** Os três modos da ferramenta (teclas 1, 2 e 3 com a ferramenta aberta). */
export type ModoDoBarranco = 'risco' | 'area' | 'rampa'
/** O que o próximo traço da área faz (Alt troca Subir por Descer). */
export type AreaDoBarranco = 'subir' | 'descer'
/** Raio do pincel da área, em quadrados. */
export type PincelDaArea = 'fino' | 'medio' | 'largo'
export const RAIO_DO_PINCEL_DA_AREA: Readonly<Record<PincelDaArea, number>> = { fino: 0.55, medio: 1.3, largo: 2.3 }
/** Comprimento em que a ponta do risco afina até sumir, em px do protótipo. */
const ROLO_DA_PONTA = 44
/** Risco mais curto que isto (px do protótipo) é um clique, não um risco. */
const RISCO_MINIMO = 30
/**
 * Quanto da parede aparece pela direção para onde ela olha: o mapa é visto de
 * cima e um pouco do sul. A virada para o sul aparece inteira; a do norte e as
 * dos lados ficam com 36% da espessura.
 */
const VISTA_MIN = 0.36

/** px de mundo por px do protótipo, pela grade do mapa. */
export function escalaDoBarranco(grid: number): number {
  return grid > 0 ? grid / QUADRADO_DO_PROTOTIPO : 2
}

/** A altura de um risco (ausente = Médio). */
export function alturaDoRisco(risco: Pick<RiscoDeBarranco, 'altura'>): AlturaDoBarranco {
  return risco.altura ?? 'medio'
}

// ---------------------------------------------------------------------------
// Leitura do disco

function ehAltura(valor: unknown): valor is AlturaDoBarranco {
  return valor === 'baixo' || valor === 'medio' || valor === 'alto'
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null || !('x' in valor) || !('y' in valor)) return null
  const { x, y } = valor
  return numeroFinito(x) && numeroFinito(y) ? { x, y } : null
}

function lerRisco(valor: unknown): RiscoDeBarranco | null {
  if (typeof valor !== 'object' || valor === null || !('id' in valor) || !('pontos' in valor) || !('lado' in valor)) return null
  const { id, pontos, lado } = valor
  if (typeof id !== 'string' || id === '' || !Array.isArray(pontos) || (lado !== 1 && lado !== -1)) return null
  const lidos: RegionPoint[] = []
  for (const p of pontos) {
    const ponto = lerPonto(p)
    // Um ponto quebrado mudaria o risco inteiro: o risco sai todo.
    if (ponto === null) return null
    lidos.push(ponto)
  }
  if (lidos.length < 2) return null
  const altura = 'altura' in valor ? valor.altura : undefined
  return { id, pontos: lidos, lado, ...(altura === 'baixo' || altura === 'alto' ? { altura } : {}), ...pisoLido(valor) }
}

function lerQuadrado(valor: unknown): QuadradoAlto | null {
  if (typeof valor !== 'object' || valor === null || !('x' in valor) || !('y' in valor) || !('alturas' in valor)) return null
  const { x, y, alturas } = valor
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y) || !Array.isArray(alturas)) return null
  const lidas = alturas.filter(ehAltura).slice(0, NIVEL_MAXIMO)
  if (lidas.length === 0 || lidas.length !== alturas.length) return null
  return { x, y, alturas: lidas, ...pisoLido(valor) }
}

function lerRampa(valor: unknown): RampaDeBarranco | null {
  if (typeof valor !== 'object' || valor === null || !('id' in valor) || !('x' in valor) || !('y' in valor)) return null
  const { id, x, y } = valor
  if (typeof id !== 'string' || id === '' || !numeroFinito(x) || !numeroFinito(y)) return null
  return { id, x, y, ...pisoLido(valor) }
}

function lerLista<T>(valor: unknown, ler: (item: unknown) => T | null): T[] {
  if (!Array.isArray(valor)) return []
  const lista: T[] = []
  for (const item of valor) {
    const lido = ler(item)
    if (lido !== null) lista.push(lido)
  }
  return lista
}

/** Quadrado repetido (mesmo x, y e piso): fica o último, como o pincel faria. */
function semRepetidos(quadrados: QuadradoAlto[]): QuadradoAlto[] {
  const porChave = new Map<string, QuadradoAlto>()
  for (const q of quadrados) porChave.set(chaveDoQuadrado(q.x, q.y, pisoDe(q)), q)
  return porChave.size === quadrados.length ? quadrados : [...porChave.values()]
}

/**
 * O barranco do arquivo, ou `undefined` (sem o campo, ou sem nada válido). O
 * arquivo não é confiável: item torto sai, e o resto fica.
 */
export function lerBarranco(valor: unknown): BarrancoDoMapa | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const quadrado = 'quadrado' in valor ? valor.quadrado : undefined
  const origem = 'origem' in valor ? lerPonto(valor.origem) : null
  const riscos = lerLista('riscos' in valor ? valor.riscos : undefined, lerRisco)
  const quadrados = semRepetidos(lerLista('quadrados' in valor ? valor.quadrados : undefined, lerQuadrado))
  const rampas = lerLista('rampas' in valor ? valor.rampas : undefined, lerRampa)
  if (riscos.length === 0 && quadrados.length === 0 && rampas.length === 0) return undefined
  // Quadrado sem medida válida não tem onde ficar: os quadrados saem, o resto fica.
  const medida = numeroFinito(quadrado) && quadrado > 0 ? quadrado : null
  if (medida === null && riscos.length === 0 && rampas.length === 0) return undefined
  return { quadrado: medida ?? QUADRADO_DO_PROTOTIPO, origem: origem ?? { x: 0, y: 0 }, riscos, quadrados: medida === null ? [] : quadrados, rampas }
}

/** Um barranco vazio, com o quadrado na grade de agora do mapa. */
export function barrancoVazio(map: Pick<MapData, 'grid' | 'gridOffset'>): BarrancoDoMapa {
  return { quadrado: map.grid > 0 ? map.grid : 64, origem: map.gridOffset ?? { x: 0, y: 0 }, riscos: [], quadrados: [], rampas: [] }
}

/** O barranco do mapa, ou um vazio na grade dele para começar a desenhar. */
export function barrancoOuVazio(map: Pick<MapData, 'grid' | 'gridOffset' | 'barranco'>): BarrancoDoMapa {
  return map.barranco ?? barrancoVazio(map)
}

/** Não tem risco, quadrado nem rampa? */
export function barrancoEstaVazio(b: BarrancoDoMapa | undefined): boolean {
  return b === undefined || (b.riscos.length === 0 && b.quadrados.length === 0 && b.rampas.length === 0)
}

/** O mapa com este barranco. Vazio tira o campo (o mapa volta a ser o de antes do barranco). */
export function comBarranco(map: MapData, b: BarrancoDoMapa): MapData {
  if (!barrancoEstaVazio(b)) return { ...map, barranco: b }
  if (map.barranco === undefined) return map
  const { barranco: _semBarranco, ...resto } = map
  return resto
}

// ---------------------------------------------------------------------------
// Geometria (porte de `prototipo/index.html`; pontos como [x, y] ou [x, y, t])

type Pt = number[]

function limitar(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

function suave(t: number): number {
  const x = limitar(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function lerpP(a: Pt, b: Pt, u: number): Pt {
  const o: Pt = new Array<number>(a.length)
  for (let i = 0; i < a.length; i += 1) o[i] = a[i] + (b[i] - a[i]) * u
  return o
}

/** Corta os cantos (Chaikin): a forma fica calma sem perder o desenho. Leva junto o 3º valor. */
function chaikin(pts: Pt[], vezes: number, fechado: boolean): Pt[] {
  let p = pts
  for (let k = 0; k < vezes; k += 1) {
    const n = p.length
    if (n < 3) return p
    const q: Pt[] = []
    if (!fechado) q.push(p[0])
    const lim = fechado ? n : n - 1
    for (let i = 0; i < lim; i += 1) {
      const a = p[i]
      const b = p[(i + 1) % n]
      q.push(lerpP(a, b, 0.25), lerpP(a, b, 0.75))
    }
    if (!fechado) q.push(p[n - 1])
    p = q
  }
  return p
}

/** Pontos a cada `passo` px ao longo do traço aberto. */
function reamostrar(pts: Pt[], passo: number): Pt[] {
  const n = pts.length
  if (n < 2) return pts.map((p) => p.slice())
  const out: Pt[] = [pts[0].slice()]
  let resto = passo
  for (let i = 0; i < n - 1; i += 1) {
    const a = pts[i]
    const b = pts[i + 1]
    const l = dist(a, b)
    let pos = 0
    while (l - pos >= resto) {
      pos += resto
      out.push(lerpP(a, b, pos / l))
      resto = passo
    }
    resto -= l - pos
  }
  const ult = pts[n - 1]
  if (dist(out[out.length - 1], ult) > passo * 0.35) out.push(ult.slice())
  else out[out.length - 1] = ult.slice()
  return out
}

interface MaisPerto {
  u: number
  x: number
  y: number
  d: number
}

function maisPerto(px: number, py: number, ax: number, ay: number, bx: number, by: number): MaisPerto {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1
  const u = limitar(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1)
  const x = ax + dx * u
  const y = ay + dy * u
  return { u, x, y, d: Math.hypot(px - x, py - y) }
}

/** Um vão de rampa no barranco: centro a `s` px do começo da beira, `w` px de largura. */
export interface VaoDoBarranco {
  s: number
  w: number
  rampaId: string
}

/**
 * Um barranco pronto para desenhar e colidir: a beira de cima (`lip`), a
 * normal de cada trecho para o lado BAIXO (`sn`), a de cada ponto (`un`, e
 * `vn` em esquadro: a quina reta continua reta) e a espessura de cada ponto (`t`).
 */
export interface GeoDoBarranco {
  tipo: 'risco' | 'area'
  /** O id do risco, ou `area:<nivel>:<n>`. */
  id: string
  /** O degrau da área (1 a 3); 0 no risco. */
  nivel: number
  fechado: boolean
  lip: Pt[]
  s: Float64Array
  len: number
  nSeg: number
  sn: Pt[]
  un: Pt[]
  vn: Pt[]
  t: number[]
  vaos: VaoDoBarranco[]
}

type Base = Omit<GeoDoBarranco, 'tipo' | 'id' | 'nivel' | 't' | 'vaos'>

function completarGeo(lip: Pt[], fechado: boolean, sinal: number): Base {
  const n = lip.length
  const s = new Float64Array(n)
  let acc = 0
  for (let i = 1; i < n; i += 1) {
    acc += dist(lip[i - 1], lip[i])
    s[i] = acc
  }
  const len = fechado ? acc + dist(lip[n - 1], lip[0]) : acc
  const nSeg = fechado ? n : n - 1
  const sn: Pt[] = []
  for (let i = 0; i < nSeg; i += 1) {
    const a = lip[i]
    const b = lip[(i + 1) % n]
    const tx = b[0] - a[0]
    const ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    sn.push([(-ty / l) * sinal, (tx / l) * sinal])
  }
  const un: Pt[] = []
  const vn: Pt[] = []
  for (let i = 0; i < n; i += 1) {
    const n1 = fechado ? sn[(i - 1 + n) % n] : sn[Math.max(0, i - 1)]
    const n2 = fechado ? sn[i % nSeg] : sn[Math.min(nSeg - 1, i)]
    let mx = n1[0] + n2[0]
    let my = n1[1] + n2[1]
    const ml = Math.hypot(mx, my)
    if (ml < 1e-6) {
      mx = n2[0]
      my = n2[1]
    } else {
      mx /= ml
      my /= ml
    }
    const c = Math.max(0.5, mx * n1[0] + my * n1[1])
    un.push([mx, my])
    vn.push([mx / c, my / c])
  }
  return { fechado, lip, s, len, nSeg, sn, un, vn }
}

function fatorDaVista(un: Pt): number {
  return VISTA_MIN + (1 - VISTA_MIN) * Math.max(0, un[1])
}

/** Um ponto da beira a `s` px do começo, com a normal (para o lado baixo) e a espessura dali. */
export interface PontoDaBeira {
  x: number
  y: number
  ux: number
  uy: number
  t: number
}

export function pontoEm(geo: GeoDoBarranco, s: number): PontoDaBeira {
  const { lip, fechado, len } = geo
  const n = lip.length
  const ss = fechado ? ((s % len) + len) % len : limitar(s, 0, len)
  let i = 0
  let lo = 0
  let hi = n - 1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (geo.s[m] <= ss) {
      i = m
      lo = m + 1
    } else hi = m - 1
  }
  if (!fechado && i >= n - 1) i = n - 2
  const j = (i + 1) % n
  const s0 = geo.s[i]
  const s1 = j === 0 ? len : geo.s[j]
  const u = s1 > s0 ? (ss - s0) / (s1 - s0) : 0
  const a = lip[i]
  const b = lip[j]
  const ux = geo.un[i][0] + (geo.un[j][0] - geo.un[i][0]) * u
  const uy = geo.un[i][1] + (geo.un[j][1] - geo.un[i][1]) * u
  const ul = Math.hypot(ux, uy) || 1
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ux: ux / ul, uy: uy / ul, t: geo.t[i] + (geo.t[j] - geo.t[i]) * u }
}

/** O ponto da beira mais perto de `p`: distância, posição ao longo (`s`) e o trecho (`i`). */
export function pertoDoGeo(geo: GeoDoBarranco, p: RegionPoint): { d: number; s: number; x: number; y: number; i: number } {
  let melhor = { d: Infinity, s: 0, x: 0, y: 0, i: 0 }
  const n = geo.lip.length
  for (let i = 0; i < geo.nSeg; i += 1) {
    const a = geo.lip[i]
    const b = geo.lip[(i + 1) % n]
    const r = maisPerto(p.x, p.y, a[0], a[1], b[0], b[1])
    if (r.d < melhor.d) {
      const s1 = (i + 1) % n === 0 ? geo.len : geo.s[i + 1]
      melhor = { d: r.d, s: geo.s[i] + (s1 - geo.s[i]) * r.u, x: r.x, y: r.y, i }
    }
  }
  return melhor
}

/** O trecho `i` cai inteiro dentro de uma rampa? (Inteiro: a rampa cobre a emenda e não sobra fresta.) */
export function trechoNaRampa(geo: GeoDoBarranco, i: number): boolean {
  if (geo.vaos.length === 0) return false
  const s0 = geo.s[i]
  const s1 = (i + 1) % geo.lip.length === 0 ? geo.len : geo.s[i + 1]
  for (const v of geo.vaos) {
    const ini = v.s - v.w / 2
    if (geo.fechado) {
      const a = (((s0 - ini) % geo.len) + geo.len) % geo.len
      if (a + (s1 - s0) <= v.w) return true
    } else if (s0 >= ini && s1 <= ini + v.w) return true
  }
  return false
}

/** Corridas contínuas de pontos (índices) cujos trechos não são rampa. */
export interface Corrida {
  idx: number[]
  fechada: boolean
}

export function corridas(geo: GeoDoBarranco): Corrida[] {
  const { nSeg, fechado, lip } = geo
  const n = lip.length
  const pula = (i: number): boolean => trechoNaRampa(geo, i)
  const lista: Corrida[] = []
  let atual: number[] | null = null
  if (fechado) {
    let ini = -1
    for (let i = 0; i < nSeg; i += 1) {
      if (pula(i)) {
        ini = i
        break
      }
    }
    if (ini < 0) return [{ idx: Array.from({ length: n }, (_, i) => i), fechada: true }]
    for (let k = 1; k <= nSeg; k += 1) {
      const i = (ini + k) % nSeg
      if (pula(i)) {
        if (atual !== null) lista.push({ idx: atual, fechada: false })
        atual = null
      } else {
        if (atual === null) atual = [i]
        atual.push((i + 1) % n)
      }
    }
  } else {
    for (let i = 0; i < nSeg; i += 1) {
      if (pula(i)) {
        if (atual !== null) lista.push({ idx: atual, fechada: false })
        atual = null
      } else {
        if (atual === null) atual = [i]
        atual.push(i + 1)
      }
    }
  }
  if (atual !== null) lista.push({ idx: atual, fechada: false })
  return lista
}

function geoDoRisco(r: RiscoDeBarranco, escala: number, mostra: number): GeoDoBarranco | null {
  const pts = r.pontos.map((p) => [p.x, p.y])
  const lip = reamostrar(chaikin(reamostrar(pts, 10 * escala), 2, false), 5 * escala)
  if (lip.length < 2) return null
  const base = completarGeo(lip, false, mostra >= 0 ? 1 : -1)
  if (base.len < 8 * escala) return null
  const t0 = ESPESSURA_DO_PROTOTIPO[alturaDoRisco(r)] * escala * Math.abs(mostra)
  // As pontas afinam até sumir: o barranco morre no chão, e é por ali que a ficha passa.
  const rolo = Math.min(ROLO_DA_PONTA * escala, base.len * 0.3)
  const t = Array.from(base.s, (s, i) => t0 * suave(Math.min(s, base.len - s) / rolo) * fatorDaVista(base.un[i]))
  return { ...base, tipo: 'risco', id: r.id, nivel: 0, t, vaos: [] }
}

/** O lado baixo de um risco novo: a parede cai para o sul; na vertical, para o leste. */
export function ladoInicial(pontos: readonly RegionPoint[]): 1 | -1 {
  let nx = 0
  let ny = 0
  for (let i = 1; i < pontos.length; i += 1) {
    nx += -(pontos[i].y - pontos[i - 1].y)
    ny += pontos[i].x - pontos[i - 1].x
  }
  const l = Math.hypot(nx, ny) || 1
  if (Math.abs(ny / l) > 0.2) return ny > 0 ? 1 : -1
  return nx > 0 ? 1 : -1
}

function chaveDoQuadrado(x: number, y: number, piso: number): string {
  return `${x},${y},${piso}`
}

interface Aresta {
  a: Pt
  b: Pt
  t: number
}

/** As beiras da região `nivel >= k`, por aresta de quadrado, encadeadas em laços (o de dentro do buraco também). */
function lacosDoNivel(k: number, nivelEm: (x: number, y: number) => number, alturaEm: (x: number, y: number, k: number) => number, quadrados: readonly QuadradoAlto[]): Aresta[][] {
  const dentro = (x: number, y: number): boolean => nivelEm(x, y) >= k
  const arestas: Aresta[] = []
  for (const q of quadrados) {
    const { x, y } = q
    if (!dentro(x, y)) continue
    const t = alturaEm(x, y, k)
    if (!dentro(x, y - 1)) arestas.push({ a: [x + 1, y], b: [x, y], t })
    if (!dentro(x, y + 1)) arestas.push({ a: [x, y + 1], b: [x + 1, y + 1], t })
    if (!dentro(x - 1, y)) arestas.push({ a: [x, y], b: [x, y + 1], t })
    if (!dentro(x + 1, y)) arestas.push({ a: [x + 1, y + 1], b: [x + 1, y], t })
  }
  const porInicio = new Map<string, number[]>()
  arestas.forEach((e, i) => {
    const chave = `${e.a[0]},${e.a[1]}`
    const lista = porInicio.get(chave)
    if (lista === undefined) porInicio.set(chave, [i])
    else lista.push(i)
  })
  const usada = new Uint8Array(arestas.length)
  const curva = (dx: number, dy: number, e: Aresta): number => dx * (e.b[1] - e.a[1]) - dy * (e.b[0] - e.a[0])
  const lacos: Aresta[][] = []
  for (let i0 = 0; i0 < arestas.length; i0 += 1) {
    if (usada[i0]) continue
    const laco: Aresta[] = []
    let i = i0
    for (;;) {
      usada[i] = 1
      const e = arestas[i]
      laco.push(e)
      const cands = (porInicio.get(`${e.b[0]},${e.b[1]}`) ?? []).filter((j) => usada[j] === 0)
      if (cands.length === 0) break
      // No cruzamento em diagonal, vira para dentro: quadrados só de quina ficam em laços separados.
      const dx = e.b[0] - e.a[0]
      const dy = e.b[1] - e.a[1]
      cands.sort((p, q) => curva(dx, dy, arestas[p]) - curva(dx, dy, arestas[q]))
      i = cands[0]
    }
    if (laco.length >= 4) lacos.push(laco)
  }
  return lacos
}

function geoDoLaco(laco: Aresta[], k: number, n: number, b: BarrancoDoMapa): GeoDoBarranco {
  const q = b.quadrado
  // Os meios das arestas viram curva: a escada da diagonal some e a quina arredonda meio quadrado.
  const meios = laco.map((e): Pt => [b.origem.x + ((e.a[0] + e.b[0]) / 2) * q, b.origem.y + ((e.a[1] + e.b[1]) / 2) * q, e.t])
  const lip = chaikin(meios, 3, true)
  const base = completarGeo(
    lip.map((p) => [p[0], p[1]]),
    true,
    1,
  )
  const t = lip.map((p, i) => p[2] * fatorDaVista(base.un[i]))
  return { ...base, tipo: 'area', id: `area:${k}:${n}`, nivel: k, t, vaos: [] }
}

/** O nível de cada quadrado do piso, por chave. */
function niveisDoPiso(b: BarrancoDoMapa, piso: number): Map<string, QuadradoAlto> {
  const mapa = new Map<string, QuadradoAlto>()
  for (const q of b.quadrados) if (pisoDe(q) === piso) mapa.set(chaveDoQuadrado(q.x, q.y, piso), q)
  return mapa
}

const cacheDeGeos = new WeakMap<BarrancoDoMapa, Map<string, GeoDoBarranco[]>>()

/**
 * Todos os barrancos do piso (áreas e riscos), com as rampas já abertas no
 * barranco mais perto de cada uma. Guardado pela referência do barranco: o
 * mapa é imutável, então só refaz quando o barranco muda.
 *
 * `mostras`: o lado de cada risco no meio da virada (de -1 a 1), só para o
 * desenho da alça Virar; com ele, nada é guardado.
 */
export function geosDoBarranco(b: BarrancoDoMapa | undefined, piso: number, grid: number, mostras?: ReadonlyMap<string, number>): GeoDoBarranco[] {
  if (b === undefined) return []
  const chave = `${piso}:${grid}`
  if (mostras === undefined) {
    const guardado = cacheDeGeos.get(b)?.get(chave)
    if (guardado !== undefined) return guardado
  }
  const escala = escalaDoBarranco(grid)
  const doPiso = niveisDoPiso(b, piso)
  const quadrados = [...doPiso.values()]
  const nivelEm = (x: number, y: number): number => doPiso.get(chaveDoQuadrado(x, y, piso))?.alturas.length ?? 0
  const alturaEm = (x: number, y: number, k: number): number => {
    const alturas = doPiso.get(chaveDoQuadrado(x, y, piso))?.alturas ?? []
    return ESPESSURA_DO_PROTOTIPO[alturas[k - 1] ?? 'medio'] * escala
  }
  const geos: GeoDoBarranco[] = []
  for (let k = 1; k <= NIVEL_MAXIMO; k += 1) {
    lacosDoNivel(k, nivelEm, alturaEm, quadrados).forEach((laco, n) => geos.push(geoDoLaco(laco, k, n, b)))
  }
  for (const r of b.riscos) {
    if (pisoDe(r) !== piso) continue
    const g = geoDoRisco(r, escala, mostras?.get(r.id) ?? r.lado)
    if (g !== null) geos.push(g)
  }
  // Cada rampa vai para o barranco mais perto dela.
  for (const rampa of b.rampas) {
    if (pisoDe(rampa) !== piso) continue
    let melhor: { g: GeoDoBarranco; s: number; d: number } | null = null
    for (const g of geos) {
      const p = pertoDoGeo(g, rampa)
      const alcance = Math.max(8 * escala, pontoEm(g, p.s).t) + 14 * escala
      if (p.d <= alcance && (melhor === null || p.d < melhor.d)) melhor = { g, s: p.s, d: p.d }
    }
    if (melhor !== null) melhor.g.vaos.push({ s: melhor.s, w: RAMPA_EM_QUADRADOS * QUADRADO_DO_PROTOTIPO * escala, rampaId: rampa.id })
  }
  if (mostras === undefined) {
    let porChave = cacheDeGeos.get(b)
    if (porChave === undefined) {
      porChave = new Map()
      cacheDeGeos.set(b, porChave)
    }
    porChave.set(chave, geos)
  }
  return geos
}

// ---------------------------------------------------------------------------
// Andar: a linha que segura a ficha

/** Um trecho da linha do meio da parede, fora das rampas. */
export interface SegmentoDeBarranco {
  ax: number
  ay: number
  bx: number
  by: number
}

const cacheDeSegmentos = new WeakMap<GeoDoBarranco[], SegmentoDeBarranco[]>()

/** Distância de `p` à reta de `a` até `b`. */
function distanciaAoTrecho(p: Pt, a: Pt, b: Pt): number {
  return maisPerto(p[0], p[1], a[0], a[1], b[0], b[1]).d
}

/**
 * A linha que segura a ficha: o meio da parede de cada trecho que não é rampa.
 * Do lado baixo a ficha para no pé, do lado alto para na beira. As pontas do
 * risco afinam, mas a linha segura até o fim: a ficha passa por fora da ponta.
 * A visão não usa isto (decisão 2 de 28/10).
 *
 * O desenho tem um ponto a cada poucos px; aqui o ponto que fica a menos de
 * meio px da reta entre os vizinhos sai: a reta do platô vira um trecho só, e
 * o arrasto, a malha e os blocos da batalha testam bem menos linhas.
 */
export function segmentosQueSeguram(geos: GeoDoBarranco[]): SegmentoDeBarranco[] {
  const guardado = cacheDeSegmentos.get(geos)
  if (guardado !== undefined) return guardado
  const segs: SegmentoDeBarranco[] = []
  for (const g of geos) {
    const meio = (i: number): Pt => [g.lip[i][0] + g.vn[i][0] * g.t[i] * 0.5, g.lip[i][1] + g.vn[i][1] * g.t[i] * 0.5]
    for (const corrida of corridas(g)) {
      const idx = corrida.fechada ? [...corrida.idx, corrida.idx[0]] : corrida.idx
      if (idx.length < 2) continue
      let ancora = meio(idx[0])
      for (let k = 1; k < idx.length; k += 1) {
        const atual = meio(idx[k])
        const ultimo = k === idx.length - 1
        if (!ultimo && distanciaAoTrecho(atual, ancora, meio(idx[k + 1])) < 0.5) continue
        segs.push({ ax: ancora[0], ay: ancora[1], bx: atual[0], by: atual[1] })
        ancora = atual
      }
    }
  }
  cacheDeSegmentos.set(geos, segs)
  return segs
}

const cacheDeParedes = new WeakMap<readonly Wall[], WeakMap<SegmentoDeBarranco[], Wall[]>>()

/**
 * As paredes que seguram o ANDAR neste piso: as do mapa mais a linha do
 * barranco, como parede que deixa ver (`blocksLight: false`) e não deixa
 * passar. Só para as contas de andar (arrasto, andar por clique, batalha):
 * nunca vai para `map.walls`, para o desenho nem para a visão. Guardado pelas
 * duas listas: a mesma entrada devolve o MESMO array (as malhas e os blocos
 * guardam cache pela referência das paredes).
 */
export function paredesParaAndar(walls: Wall[], map: Pick<MapData, 'barranco' | 'grid'>, piso: number): Wall[] {
  const segs = segmentosDoMapa(map, piso)
  if (segs.length === 0) return walls
  let porSegs = cacheDeParedes.get(walls)
  if (porSegs === undefined) {
    porSegs = new WeakMap()
    cacheDeParedes.set(walls, porSegs)
  }
  const guardado = porSegs.get(segs)
  if (guardado !== undefined) return guardado
  const doBarranco = segs.map(
    (s, i): Wall => ({ id: `barranco:${i}`, x1: s.ax, y1: s.ay, x2: s.bx, y2: s.by, blocksLight: false, blocksMove: true, door: null, ...(piso !== 0 ? { piso } : {}) }),
  )
  const todas = [...walls, ...doBarranco]
  porSegs.set(segs, todas)
  return todas
}

/** O id é de uma linha de barranco (e não de uma parede do mapa)? */
export function ehParedeDoBarranco(id: string): boolean {
  return id.startsWith('barranco:')
}

const cacheDeMapas = new WeakMap<MapData, Map<number, MapData>>()

/** O mapa com as paredes de andar do piso (`paredesParaAndar`), para quem planeja caminho. O MESMO mapa sem barranco. */
export function mapaParaAndar(map: MapData, piso: number): MapData {
  const walls = paredesParaAndar(map.walls, map, piso)
  if (walls === map.walls) return map
  let porPiso = cacheDeMapas.get(map)
  if (porPiso === undefined) {
    porPiso = new Map()
    cacheDeMapas.set(map, porPiso)
  }
  const guardado = porPiso.get(piso)
  if (guardado !== undefined && guardado.walls === walls) return guardado
  const novo = { ...map, walls }
  porPiso.set(piso, novo)
  return novo
}

/** Os segmentos que seguram a ficha neste mapa e piso (vazio sem barranco). */
export function segmentosDoMapa(map: Pick<MapData, 'barranco' | 'grid'>, piso: number): SegmentoDeBarranco[] {
  if (map.barranco === undefined) return []
  return segmentosQueSeguram(geosDoBarranco(map.barranco, piso, map.grid))
}

/**
 * Onde o caminho de `a` até `b` bate num barranco pela primeira vez: a fração
 * do caminho (0 a 1) e o ponto. `null` = passa livre. Encostar na linha sem
 * cruzar não conta: a ficha parada em cima da linha pode sair.
 */
export function primeiroBarranco(a: RegionPoint, b: RegionPoint, segs: readonly SegmentoDeBarranco[]): { t: number; x: number; y: number } | null {
  const rx = b.x - a.x
  const ry = b.y - a.y
  if (rx === 0 && ry === 0) return null
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  let melhor: { t: number; x: number; y: number } | null = null
  for (const s of segs) {
    if (Math.max(s.ax, s.bx) < minX || Math.min(s.ax, s.bx) > maxX || Math.max(s.ay, s.by) < minY || Math.min(s.ay, s.by) > maxY) continue
    const sx = s.bx - s.ax
    const sy = s.by - s.ay
    const den = rx * sy - ry * sx
    if (Math.abs(den) < 1e-9) continue
    const qx = s.ax - a.x
    const qy = s.ay - a.y
    const t = (qx * sy - qy * sx) / den
    const u = (qx * ry - qy * rx) / den
    // `t > 0`: sair de cima da linha não é cruzar; `u` em [0, 1): a emenda entre dois trechos conta uma vez só.
    if (t > 1e-9 && t <= 1 && u >= 0 && u < 1 && (melhor === null || t < melhor.t)) melhor = { t, x: a.x + rx * t, y: a.y + ry * t }
  }
  return melhor
}

/** O caminho de `a` até `b` atravessa algum barranco? */
export function cruzaBarranco(a: RegionPoint, b: RegionPoint, segs: readonly SegmentoDeBarranco[]): boolean {
  return segs.length > 0 && primeiroBarranco(a, b, segs) !== null
}

/** O caminho (lista de pontos) atravessa algum barranco em algum trecho? */
export function caminhoCruzaBarranco(pontos: readonly RegionPoint[], segs: readonly SegmentoDeBarranco[]): boolean {
  if (segs.length === 0) return false
  for (let i = 1; i < pontos.length; i += 1) if (primeiroBarranco(pontos[i - 1], pontos[i], segs) !== null) return true
  return false
}

// ---------------------------------------------------------------------------
// Editar (funções puras: o barranco de antes não muda)

/** O nível do chão neste ponto (0 = chão, 1 a 3 = degraus da área). */
export function nivelNoPonto(b: BarrancoDoMapa | undefined, p: RegionPoint, piso: number): number {
  if (b === undefined || b.quadrado <= 0) return 0
  const x = Math.floor((p.x - b.origem.x) / b.quadrado)
  const y = Math.floor((p.y - b.origem.y) / b.quadrado)
  const q = b.quadrados.find((c) => c.x === x && c.y === y && pisoDe(c) === piso)
  return q === undefined ? 0 : q.alturas.length
}

function comPisoDoItem(piso: number): { piso?: number } {
  return piso !== 0 ? { piso } : {}
}

/** Comprimento de um caminho, em px. */
function comprimento(pontos: readonly RegionPoint[]): number {
  let l = 0
  for (let i = 1; i < pontos.length; i += 1) l += Math.hypot(pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y)
  return l
}

/** O arrasto é comprido o bastante para virar risco (e não um clique de escolher)? */
export function arrastoViraRisco(pontos: readonly RegionPoint[], grid: number): boolean {
  return pontos.length > 3 && comprimento(pontos) > RISCO_MINIMO * escalaDoBarranco(grid)
}

/** Um risco novo no barranco. O lado baixo começa para o sul (`ladoInicial`). */
export function riscarBarranco(b: BarrancoDoMapa, pontos: readonly RegionPoint[], altura: AlturaDoBarranco, piso: number, id: string): BarrancoDoMapa {
  const risco: RiscoDeBarranco = {
    id,
    pontos: pontos.map((p) => ({ x: p.x, y: p.y })),
    lado: ladoInicial(pontos),
    ...(altura === 'medio' ? {} : { altura }),
    ...comPisoDoItem(piso),
  }
  return { ...b, riscos: [...b.riscos, risco] }
}

function trocarRisco(b: BarrancoDoMapa, id: string, mudar: (r: RiscoDeBarranco) => RiscoDeBarranco): BarrancoDoMapa {
  let mudou = false
  const riscos = b.riscos.map((r) => {
    if (r.id !== id) return r
    const novo = mudar(r)
    if (novo !== r) mudou = true
    return novo
  })
  return mudou ? { ...b, riscos } : b
}

/** Vira o lado alto do risco. */
export function virarRisco(b: BarrancoDoMapa, id: string): BarrancoDoMapa {
  return trocarRisco(b, id, (r) => ({ ...r, lado: r.lado === 1 ? -1 : 1 }))
}

/** Muda a altura do risco (o Médio não escreve o campo). */
export function mudarAlturaDoRisco(b: BarrancoDoMapa, id: string, altura: AlturaDoBarranco): BarrancoDoMapa {
  return trocarRisco(b, id, (r) => {
    if (alturaDoRisco(r) === altura) return r
    const { altura: _antes, ...semAltura } = r
    return altura === 'medio' ? semAltura : { ...semAltura, altura }
  })
}

/** Tira o risco. */
export function apagarRiscoDoBarranco(b: BarrancoDoMapa, id: string): BarrancoDoMapa {
  const riscos = b.riscos.filter((r) => r.id !== id)
  return riscos.length === b.riscos.length ? b : { ...b, riscos }
}

/**
 * Um toque do pincel da área: só os quadrados no nível onde o traço começou
 * (`ini`) mudam, um degrau para cima (ou para baixo com `descer`). Devolve o
 * MESMO barranco quando nada mudou.
 */
export function pincelarArea(
  b: BarrancoDoMapa,
  centro: RegionPoint,
  raioEmQuadrados: number,
  ini: number,
  descer: boolean,
  altura: AlturaDoBarranco,
  piso: number,
): BarrancoDoMapa {
  const alvo = descer ? ini - 1 : ini + 1
  if (alvo < 0 || alvo > NIVEL_MAXIMO || b.quadrado <= 0) return b
  const q = b.quadrado
  const raio = raioEmQuadrados * q
  const x0 = Math.floor((centro.x - raio - b.origem.x) / q)
  const x1 = Math.floor((centro.x + raio - b.origem.x) / q)
  const y0 = Math.floor((centro.y - raio - b.origem.y) / q)
  const y1 = Math.floor((centro.y + raio - b.origem.y) / q)
  const doPiso = niveisDoPiso(b, piso)
  const mudados = new Map<string, QuadradoAlto | null>()
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (Math.hypot(b.origem.x + (x + 0.5) * q - centro.x, b.origem.y + (y + 0.5) * q - centro.y) > raio) continue
      const chave = chaveDoQuadrado(x, y, piso)
      const antes = doPiso.get(chave)
      const alturas = antes?.alturas ?? []
      if (alturas.length !== ini) continue
      if (alvo === 0) mudados.set(chave, null)
      else mudados.set(chave, { x, y, alturas: descer ? alturas.slice(0, alvo) : [...alturas, altura], ...comPisoDoItem(piso) })
    }
  }
  if (mudados.size === 0) return b
  const quadrados: QuadradoAlto[] = []
  for (const c of b.quadrados) if (!mudados.has(chaveDoQuadrado(c.x, c.y, pisoDe(c)))) quadrados.push(c)
  for (const novo of mudados.values()) if (novo !== null) quadrados.push(novo)
  return { ...b, quadrados }
}

/** O alvo da ferramenta Rampa com o ponteiro em `p`: tirar uma rampa, ou pôr numa parede. */
export type AlvoDaRampa = { tirar: true; rampaId: string; x: number; y: number } | { tirar: false; x: number; y: number; ponto: PontoDaBeira }

export function alvoDaRampa(geos: readonly GeoDoBarranco[], p: RegionPoint, folga: number): AlvoDaRampa | null {
  for (const g of geos) {
    for (const v of g.vaos) {
      const P = pontoEm(g, v.s)
      const mx = P.x + P.ux * P.t * 0.5
      const my = P.y + P.uy * P.t * 0.5
      if (Math.hypot(p.x - mx, p.y - my) < v.w / 2) return { tirar: true, rampaId: v.rampaId, x: mx, y: my }
    }
  }
  let melhor: { d: number; P: PontoDaBeira } | null = null
  for (const g of geos) {
    const q = pertoDoGeo(g, p)
    const P = pontoEm(g, q.s)
    const alcance = Math.max(8, P.t) + folga
    if (q.d <= alcance && P.t > 2 && (melhor === null || q.d < melhor.d)) melhor = { d: q.d, P }
  }
  if (melhor === null) return null
  const { P } = melhor
  return { tirar: false, x: P.x + P.ux * P.t * 0.5, y: P.y + P.uy * P.t * 0.5, ponto: P }
}

/** Põe ou tira a rampa do alvo. */
export function aplicarRampa(b: BarrancoDoMapa, alvo: AlvoDaRampa, piso: number, id: string): BarrancoDoMapa {
  if (alvo.tirar) return { ...b, rampas: b.rampas.filter((r) => r.id !== alvo.rampaId) }
  return { ...b, rampas: [...b.rampas, { id, x: alvo.x, y: alvo.y, ...comPisoDoItem(piso) }] }
}

/** O risco mais perto de `p` (conta a parede também: clicar na terra do barranco escolhe o risco). */
export function riscoPerto(geos: readonly GeoDoBarranco[], p: RegionPoint, raio: number): string | null {
  let melhor: { id: string; d: number } | null = null
  for (const g of geos) {
    if (g.tipo !== 'risco') continue
    const q = pertoDoGeo(g, p)
    const naParede = (p.x - q.x) * g.un[q.i][0] + (p.y - q.y) * g.un[q.i][1] > 0
    const alcance = raio + (naParede ? g.t[q.i] : 0)
    if (q.d <= alcance && (melhor === null || q.d < melhor.d)) melhor = { id: g.id, d: q.d }
  }
  return melhor === null ? null : melhor.id
}

/** A alça Virar de um risco: no meio da parede, com a seta (`ux`, `uy`) apontando para o lado baixo. */
export function alcaDoRisco(geo: GeoDoBarranco, grid: number): { x: number; y: number; raio: number; ux: number; uy: number } {
  const P = pontoEm(geo, geo.len / 2)
  return { x: P.x + P.ux * P.t * 0.5, y: P.y + P.uy * P.t * 0.5, raio: Math.max(10, grid * 0.28), ux: P.ux, uy: P.uy }
}

// ---------------------------------------------------------------------------
// Jogador

/** A borda do quadrado (o centro e os 8 vizinhos): o recorte leva um quadrado de folga, e o corte cai na névoa. */
const VIZINHOS: readonly (readonly [number, number])[] = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
]

/**
 * O barranco que vai ao jogador: só o que encosta no que ele conhece
 * (`conhece`: visão, explorado, cômodo lembrado). Os riscos saem em pedaços,
 * como o penhasco (`caminhosParaJogador`); o quadrado alto sai se ele ou um
 * vizinho é conhecido (a folga põe a beira inventada pelo corte dentro da
 * névoa); a rampa, se o vão encosta no conhecido. Ponto em lugar escondido
 * nunca sai. O resto ficaria dizendo onde há barranco na névoa.
 */
export function barrancoParaJogador(
  b: BarrancoDoMapa | undefined,
  piso: number,
  grid: number,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
): BarrancoDoMapa | undefined {
  if (b === undefined) return undefined
  const escala = escalaDoBarranco(grid)
  const raio = ROLO_DA_PONTA * escala
  // Só o piso do grupo: o barranco do andar de cima não existe na tela dele.
  const doPiso = <T extends { piso?: number }>(item: T): boolean => pisoDe(item) === piso
  const riscos = caminhosParaJogador(
    b.riscos.filter(doPiso).map((r) => ({ ...r, raio })),
    conhece,
    escondido,
  )
    .filter((r) => r.pontos.length >= 2)
    .map(({ raio: _raio, ...r }) => r)
  const q = b.quadrado
  const centro = (x: number, y: number): RegionPoint => ({ x: b.origem.x + (x + 0.5) * q, y: b.origem.y + (y + 0.5) * q })
  const quadrados = b.quadrados.filter((c) => doPiso(c) && !escondido(centro(c.x, c.y)) && VIZINHOS.some(([dx, dy]) => conhece(centro(c.x + dx, c.y + dy))))
  const meioVao = (RAMPA_EM_QUADRADOS * QUADRADO_DO_PROTOTIPO * escala) / 2
  const rampas = b.rampas.filter((r) => doPiso(r) && !escondido(r) && (conhece(r) || conhece({ x: r.x - meioVao, y: r.y }) || conhece({ x: r.x + meioVao, y: r.y }) || conhece({ x: r.x, y: r.y - meioVao }) || conhece({ x: r.x, y: r.y + meioVao })))
  const recorte = { quadrado: b.quadrado, origem: b.origem, riscos, quadrados, rampas }
  return barrancoEstaVazio(recorte) ? undefined : recorte
}

/** O piso do barranco do RECORTE (todos os itens são do piso do grupo, `barrancoParaJogador`); 0 sem item. */
export function pisoDoRecorte(b: BarrancoDoMapa): number {
  const item = b.riscos[0] ?? b.quadrados[0] ?? b.rampas[0]
  return item === undefined ? 0 : pisoDe(item)
}
