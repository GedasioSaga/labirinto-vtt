/**
 * SIMULAÇÃO DO TIRO AO ALVO: dificuldades, alvos, a agenda da rodada sorteada
 * pela semente, o tiro e o passo fixo de 1/120 s, mais o robô que joga como
 * gente. Porte fiel do bloco SIM do protótipo aprovado
 * (docs/design/minigame-tiro/prototipo/index.html, tambor de 12 balas e as
 * medalhas de 18/10/2026); puro, sem DOM, para o jogo, o robô, o host e a
 * prova rodarem a mesma conta com a mesma semente. A ordem de cada sorteio é
 * a do protótipo: trocar uma linha de lugar muda a rodada.
 */

import type { DificuldadeTiro, MedalhaTiro } from './tipos'

export type DificuldadeSim = DificuldadeTiro

/** Passo fixo, em s: com passo variável a mesma semente daria outra rodada em outro aparelho. */
export const DT = 1 / 120
/** O palco, em pixels de arte: 256 × 144, ampliado pelo CSS sem suavizar. */
export const W = 256
export const H = 144
export const BALAS = 12
/** Quanto o goblin leva para subir (e descer) do caixote, em s. */
export const SUBIR = 0.14
/** Linhas do palco: trilho de cima, trilho de baixo, boca dos caixotes e chão. */
export const Y = { t1: 36, t2: 66, pop: 100, chao: 114 } as const
export const POP_X: readonly number[] = [42, 100, 158, 214]
/** As cortinas: fora delas não há tiro que acerte. */
export const BORDA = [14, 242] as const

type Faixa2 = readonly [number, number]

export interface ParametrosDaDificuldade {
  /** Duração da rodada, em s. */
  tempo: number
  /** Multiplicador dos pontos (o bônus ×1,5 do Extremo). */
  valor: number
  /** Duração da recarga do tambor inteiro, em s. */
  recarga: number
  /** Cão: tempo mínimo entre dois tiros, em s. */
  cao: number
  /** Tamanho dos alvos (1 = o desenho do Normal). */
  escala: number
  vel: number
  janela: Faixa2
  trilho: Faixa2
  pop: Faixa2
  rato: Faixa2
  morcego: Faixa2
  moeda: Faixa2
  moedaDura: number
  /** Chance de o caixote soltar o aldeão no lugar do goblin. */
  proibido: number
  /** Chance de o trilho de baixo trazer o gato de lata. */
  gato: number
  /** Bronze, prata e ouro, em pontos. */
  medalhas: readonly [number, number, number]
}

export const DIF: Readonly<Record<DificuldadeSim, ParametrosDaDificuldade>> = {
  normal: { tempo: 40, valor: 1, recarga: 1.0, cao: 0.22, escala: 1, vel: 1, janela: [1.6, 2.2], trilho: [1.7, 2.5], pop: [1.5, 2.2], rato: [5, 8], morcego: [5, 8], moeda: [6, 9], moedaDura: 1.5, proibido: 0, gato: 0, medalhas: [1025, 1200, 1350] },
  extremo: { tempo: 32, valor: 1.5, recarga: 1.6, cao: 0.22, escala: 0.75, vel: 1.5, janela: [0.85, 1.25], trilho: [1.0, 1.5], pop: [0.8, 1.25], rato: [3.2, 5], morcego: [3.2, 5], moeda: [5, 7], moedaDura: 0.9, proibido: 0.3, gato: 0.2, medalhas: [850, 950, 1075] },
}

export type TipoDeAlvo = 'anel' | 'garrafa' | 'goblin' | 'rato' | 'morcego' | 'moeda' | 'aldeao' | 'gato'
export type Material = 'madeira' | 'vidro' | 'moeda' | 'lata'
export type Faixa = 't1' | 't2' | 'pop' | 'chao' | 'ar' | 'moeda'

export interface TipoDoAlvo {
  nome: string
  pts: number
  /** Bônus do tiro no miolo (só o anel). */
  centro?: number
  w: number
  h: number
  redondo?: boolean
  proibido?: boolean
  mat: Material
}

export const TIPOS: Readonly<Record<TipoDeAlvo, TipoDoAlvo>> = {
  anel: { nome: 'Alvo de anel', pts: 10, centro: 10, w: 7, h: 7, redondo: true, mat: 'madeira' },
  garrafa: { nome: 'Garrafa', pts: 20, w: 3, h: 7, mat: 'vidro' },
  goblin: { nome: 'Goblin de papelão', pts: 20, w: 7, h: 10, mat: 'madeira' },
  rato: { nome: 'Rato de madeira', pts: 30, w: 7, h: 4, mat: 'madeira' },
  morcego: { nome: 'Morcego de pano', pts: 35, w: 8, h: 4, mat: 'madeira' },
  moeda: { nome: 'Moeda de latão', pts: 50, w: 4, h: 4, redondo: true, mat: 'moeda' },
  aldeao: { nome: 'Aldeão de papelão', pts: -50, w: 7, h: 10, proibido: true, mat: 'madeira' },
  gato: { nome: 'Gato de lata', pts: -50, w: 6, h: 6, proibido: true, mat: 'lata' },
}

const VEL = { t1: 24, t2: -32, chao: 60, ar: 30 } as const
/** Quem fica na frente quando dois alvos dividem o mesmo pixel: o menor número leva o tiro. */
const ORDEM: Readonly<Record<Faixa, number>> = { moeda: 0, chao: 1, pop: 2, t2: 3, ar: 4, t1: 5 }
export const MEDALHAS: readonly MedalhaTiro[] = ['bronze', 'prata', 'ouro']
/** O combo sobe o multiplicador em 0,5 a cada 5 acertos, até 4 degraus (×3). */
const DEGRAUS_DO_COMBO = 4
const ACERTOS_POR_DEGRAU = 5

const lim = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

export type Rng = () => number

/** FNV-1a da semente em texto e mulberry32, como no protótipo. */
export function semear(s: string | number): Rng {
  let h = 2166136261
  const texto = String(s)
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const uni = (r: Rng, f: Faixa2): number => f[0] + (f[1] - f[0]) * r()
const gauss = (r: Rng): number => {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

/** Um alvo que a agenda manda nascer no instante `t`. */
export interface Surgimento {
  t: number
  faixa: Faixa
  tipo: TipoDeAlvo
  /** pop: o caixote pedido (0..3) e quanto o goblin fica de pé. */
  vaga?: number
  janela?: number
  /** chão e ar: 1 = da esquerda para a direita. */
  dir?: number
  /** ar: a altura do voo e a fase do balanço; moeda: onde surge. */
  y?: number
  fase?: number
  x?: number
}

/** Toda a rodada sorteada de antemão pela semente: quem surge, onde e quando. */
export function agenda(dif: DificuldadeSim, semente: string): Surgimento[] {
  const D = DIF[dif]
  const r = semear(`agenda|${dif}|${semente}`)
  const L: Surgimento[] = []
  // No `for` do protótipo o surgimento sorteia antes do intervalo seguinte: a ordem dos `r()` é essa.
  const fila = (cada: Faixa2, ini: number, f: () => Omit<Surgimento, 't'>): void => {
    for (let t = ini; t < D.tempo - 0.5; t += uni(r, cada)) L.push({ t, ...f() })
  }
  fila(D.trilho, uni(r, [0.1, 0.6]), () => ({ faixa: 't1', tipo: r() < 0.7 ? 'anel' : 'garrafa' }))
  fila(D.trilho, uni(r, [0.4, 1.1]), () => ({ faixa: 't2', tipo: r() < D.gato ? 'gato' : r() < 0.6 ? 'anel' : 'garrafa' }))
  fila(D.pop, uni(r, [0.6, 1.3]), () => {
    const tipo: TipoDeAlvo = r() < D.proibido ? 'aldeao' : 'goblin'
    const vaga = Math.floor(r() * 4)
    return { faixa: 'pop', tipo, vaga, janela: uni(r, D.janela) }
  })
  fila(D.rato, uni(r, [2, 4]), () => ({ faixa: 'chao', tipo: 'rato', dir: r() < 0.5 ? 1 : -1 }))
  fila(D.morcego, uni(r, [2.5, 4.5]), () => {
    const dir = r() < 0.5 ? 1 : -1
    const y = 16 + r() * 10
    return { faixa: 'ar', tipo: 'morcego', dir, y, fase: r() * 6.283 }
  })
  fila(D.moeda, uni(r, [3, 6]), () => {
    const x = 36 + r() * 184
    return { faixa: 'moeda', tipo: 'moeda', x, y: 22 + r() * 54 }
  })
  return L.sort((a, b) => a.t - b.t)
}

export type EstadoDoAlvo = 'ativo' | 'caindo'

export interface Alvo {
  id: number
  tipo: TipoDeAlvo
  faixa: Faixa
  w: number
  h: number
  vx: number
  x: number
  y: number
  idade: number
  /** pop e moeda: quanto já surgiu (0..1). */
  sub: number
  estado: EstadoDoAlvo
  /** Tempo caindo, em s. */
  te: number
  proibido: boolean
  fora: boolean
  vaga?: number
  janela?: number
  dura?: number
  y0?: number
  fase?: number
  /** Onde o tiro furou, relativo ao centro. */
  furo?: readonly [number, number]
}

interface EventoBase {
  t: number
}
export type EventoDaRodada = EventoBase & (
  | { nome: 'travado' | 'pronto' | 'fim' }
  | { nome: 'seco'; x: number; y: number }
  | { nome: 'erro'; x: number; y: number }
  | { nome: 'acerto' | 'proibido'; x: number; y: number; id: number; tipo: TipoDeAlvo; ganho: number; mat: Material; centro: boolean }
  | { nome: 'recarga'; dura: number }
)
type SemTempo<T> = T extends EventoBase ? Omit<T, 't'> : never

export interface Rodada {
  dif: DificuldadeSim
  D: ParametrosDaDificuldade
  t: number
  ag: Surgimento[]
  /** Índice do próximo surgimento da agenda. */
  ia: number
  alvos: Alvo[]
  prox: number
  /** Id do goblin em cada caixote (0 = livre). */
  vagas: number[]
  mira: { x: number; y: number }
  balas: number
  /** Segundos de recarga que faltam (0 = parado). */
  recarga: number
  cao: number
  pontos: number
  combo: number
  comboMax: number
  tiros: number
  acertos: number
  proibidos: number
  secos: number
  recargas: number
  derrubados: Partial<Record<TipoDeAlvo, number>>
  fim: boolean
  ev: EventoDaRodada[]
}

export function criarRodada(dif: DificuldadeSim, semente: string): Rodada {
  return {
    dif, D: DIF[dif], t: 0, ag: agenda(dif, semente), ia: 0, alvos: [], prox: 1, vagas: [0, 0, 0, 0], mira: { x: W / 2, y: 76 },
    balas: BALAS, recarga: 0, cao: 0, pontos: 0, combo: 0, comboMax: 0, tiros: 0, acertos: 0, proibidos: 0, secos: 0, recargas: 0,
    derrubados: {}, fim: false, ev: [],
  }
}

const ev = (R: Rodada, e: SemTempo<EventoDaRodada>): void => {
  R.ev.push({ ...e, t: Math.round(R.t * 1000) / 1000 })
}

function nascer(R: Rodada, s: Surgimento): void {
  const T = TIPOS[s.tipo]
  const e = R.D.escala
  const v = R.D.vel
  const a: Alvo = { id: R.prox++, tipo: s.tipo, faixa: s.faixa, w: T.w * e, h: T.h * e, vx: 0, x: 0, y: 0, idade: 0, sub: 1, estado: 'ativo', te: 0, proibido: T.proibido === true, fora: false }
  if (s.faixa === 'pop') {
    let k = s.vaga ?? 0
    for (let i = 0; i < 4 && R.vagas[k]; i++) k = (k + 1) % 4
    if (R.vagas[k]) return
    R.vagas[k] = a.id
    a.vaga = k
    a.x = POP_X[k] ?? 0
    a.janela = s.janela ?? 0
    a.sub = 0
    a.y = Y.pop + a.h + 1
  } else if (s.faixa === 'moeda') {
    a.x = s.x ?? 0
    a.y = s.y ?? 0
    a.dura = R.D.moedaDura
    a.sub = 0
  } else {
    const dir = s.faixa === 't1' ? 1 : s.faixa === 't2' ? -1 : (s.dir ?? 1)
    a.vx = Math.abs(VEL[s.faixa]) * v * dir
    a.x = dir > 0 ? -a.w - 2 : W + a.w + 2
    if (s.faixa === 'ar') {
      a.y0 = s.y ?? 0
      a.fase = s.fase ?? 0
      a.y = a.y0 + 3.5 * Math.sin(a.fase)
    } else a.y = Y[s.faixa] - a.h
  }
  R.alvos.push(a)
}

function mover(R: Rodada, a: Alvo): void {
  a.idade += DT
  if (a.estado === 'caindo') {
    a.te += DT
    if (a.faixa !== 'pop' && a.faixa !== 'moeda') a.x += a.vx * DT
    if (a.te > 0.5) a.fora = true
    return
  }
  if (a.faixa === 'pop') {
    const k = a.idade
    const janela = a.janela ?? 0
    a.sub = k < SUBIR ? k / SUBIR : k < SUBIR + janela ? 1 : Math.max(0, 1 - (k - SUBIR - janela) / SUBIR)
    a.y = Y.pop + a.h + 1 - (2 * a.h + 2) * a.sub
    if (k >= 2 * SUBIR + janela) a.fora = true
    return
  }
  if (a.faixa === 'moeda') {
    a.sub = Math.min(1, a.idade / 0.12)
    if (a.idade >= (a.dura ?? 0)) a.fora = true
    return
  }
  a.x += a.vx * DT
  if (a.faixa === 'ar') a.y = (a.y0 ?? 0) + 3.5 * Math.sin((a.fase ?? 0) + a.idade * 5.6 * R.D.vel)
  if (a.x < -24 || a.x > W + 24) a.fora = true
}

export const visivel = (a: Alvo): boolean => (a.faixa === 'pop' ? a.sub > 0.3 : a.faixa === 'moeda' ? a.sub > 0.5 : a.x > BORDA[0] && a.x < BORDA[1])

export function atingivel(a: Alvo): boolean {
  if (a.estado !== 'ativo') return false
  if (a.faixa === 'pop') return a.sub >= 0.6
  if (a.faixa === 'moeda') return a.sub >= 1
  return a.x > BORDA[0] - a.w && a.x < BORDA[1] + a.w
}

function dentro(a: Alvo, x: number, y: number): boolean {
  if (x < BORDA[0] || x > BORDA[1] || (a.faixa === 'pop' && y > Y.pop)) return false
  const dx = x - a.x
  const dy = y - a.y
  return TIPOS[a.tipo].redondo === true ? dx * dx + dy * dy <= a.w * a.w : Math.abs(dx) <= a.w && Math.abs(dy) <= a.h
}

function restante(a: Alvo): number {
  if (a.faixa === 'pop') return SUBIR + (a.janela ?? 0) - a.idade
  if (a.faixa === 'moeda') return (a.dura ?? 0) - a.idade
  return ((a.vx > 0 ? BORDA[1] : BORDA[0]) - a.x) / a.vx
}

export const mult = (combo: number): number => 1 + 0.5 * Math.min(DEGRAUS_DO_COMBO, Math.floor(combo / ACERTOS_POR_DEGRAU))

/** Um tiro em (x, y). Sem bala = clique seco, que não conta como tiro. */
export function atirar(R: Rodada, x: number, y: number): void {
  if (R.recarga > 0) {
    ev(R, { nome: 'travado' })
    return
  }
  if (R.cao > 0) return
  if (R.balas <= 0) {
    R.secos++
    R.cao = 0.15
    ev(R, { nome: 'seco', x, y })
    return
  }
  R.balas--
  R.tiros++
  R.cao = R.D.cao
  let alvo: Alvo | null = null
  for (const a of R.alvos) if (atingivel(a) && dentro(a, x, y) && (alvo === null || ORDEM[a.faixa] < ORDEM[alvo.faixa])) alvo = a
  if (alvo === null) {
    R.combo = 0
    ev(R, { nome: 'erro', x, y })
    return
  }
  const T = TIPOS[alvo.tipo]
  alvo.estado = 'caindo'
  alvo.te = 0
  alvo.furo = [x - alvo.x, y - alvo.y]
  let ganho: number
  let centro = false
  if (T.proibido === true) {
    ganho = T.pts
    R.combo = 0
    R.proibidos++
  } else {
    centro = T.centro !== undefined && Math.hypot(x - alvo.x, y - alvo.y) <= alvo.w * 0.4
    ganho = Math.round((T.pts + (centro && T.centro !== undefined ? T.centro : 0)) * mult(R.combo) * R.D.valor)
    R.combo++
    R.comboMax = Math.max(R.comboMax, R.combo)
    R.acertos++
    R.derrubados[alvo.tipo] = (R.derrubados[alvo.tipo] ?? 0) + 1
  }
  R.pontos = Math.max(0, R.pontos + ganho)
  ev(R, { nome: T.proibido === true ? 'proibido' : 'acerto', x, y, id: alvo.id, tipo: alvo.tipo, ganho, mat: T.mat, centro })
}

/** O que o jogador (ou o robô) faz num passo: a mira em pixels do palco e os dois gatilhos. */
export interface EntradaDoPasso {
  x: number
  y: number
  atirar: boolean
  recarregar: boolean
}

/** Um passo de 1/120 s. */
export function passo(R: Rodada, ent: EntradaDoPasso | null): void {
  if (R.fim) return
  if (ent !== null) {
    R.mira.x = lim(ent.x, 0, W)
    R.mira.y = lim(ent.y, 0, H)
    if (ent.recarregar && R.recarga <= 0 && R.balas < BALAS) {
      R.recarga = R.D.recarga
      R.recargas++
      ev(R, { nome: 'recarga', dura: R.D.recarga })
    }
    if (ent.atirar) atirar(R, R.mira.x, R.mira.y)
  }
  R.t += DT
  if (R.cao > 0) R.cao -= DT
  if (R.recarga > 0 && (R.recarga -= DT) <= 1e-9) {
    R.recarga = 0
    R.balas = BALAS
    ev(R, { nome: 'pronto' })
  }
  while (R.ia < R.ag.length) {
    const s = R.ag[R.ia]
    if (s === undefined || s.t > R.t) break
    R.ia++
    nascer(R, s)
  }
  let n = 0
  for (const a of R.alvos) {
    mover(R, a)
    if (!a.fora) R.alvos[n++] = a
    else if (a.vaga !== undefined && R.vagas[a.vaga] === a.id) R.vagas[a.vaga] = 0
  }
  R.alvos.length = n
  if (R.t >= R.D.tempo - 1e-9) {
    R.fim = true
    R.recarga = 0
    ev(R, { nome: 'fim' })
  }
}

export function medalha(dif: DificuldadeSim, p: number): MedalhaTiro | null {
  const m = DIF[dif].medalhas
  return p >= m[2] ? 'ouro' : p >= m[1] ? 'prata' : p >= m[0] ? 'bronze' : null
}

export const passou = (med: MedalhaTiro | null, meta: MedalhaTiro): boolean => med !== null && MEDALHAS.indexOf(med) >= MEDALHAS.indexOf(meta)

export const pontosDaMedalha = (dif: DificuldadeSim, med: MedalhaTiro): number => DIF[dif].medalhas[MEDALHAS.indexOf(med)] ?? 0

// ------------------------------------------------------------------ tetos para o host

/** O tiro que mais vale: a moeda (50) acima do anel com miolo (10 + 10). */
const PONTOS_MAX_DE_UM_ALVO = Math.max(...Object.values(TIPOS).map((t) => t.pts + (t.centro ?? 0)))
const MULT_MAX = mult(DEGRAUS_DO_COMBO * ACERTOS_POR_DEGRAU)

/**
 * Teto de tiros em `t` s de rodada: o cão segura um tiro por `cao` s, e a
 * recarga só atrasa — o teto ignora a recarga e fica acima do possível. Só
 * barra mentira do jogador; jogo de verdade nunca chega perto.
 */
export function tirosMaximos(dif: DificuldadeSim, t: number): number {
  const D = DIF[dif]
  return Math.floor(lim(t, 0, D.tempo) / D.cao) + 1
}

/** Teto de pontos em `t` s: todo tiro no alvo que mais vale, com o combo no topo e o bônus da dificuldade. */
export function pontosMaximos(dif: DificuldadeSim, t: number): number {
  return tirosMaximos(dif, t) * Math.round(PONTOS_MAX_DE_UM_ALVO * MULT_MAX * DIF[dif].valor)
}

/**
 * Teto de pontos com `acertos` acertos: todos no alvo que mais vale, num combo
 * só (o k-ésimo acerto vale `mult(k)`), mais meio ponto de arredondamento
 * por acerto. Mais apertado que o do tempo: o combo sobe devagar.
 */
export function pontosMaximosPorAcertos(dif: DificuldadeSim, acertos: number): number {
  let soma = 0
  for (let k = 0; k < acertos; k++) soma += PONTOS_MAX_DE_UM_ALVO * mult(k) * DIF[dif].valor + 0.5
  return Math.floor(soma)
}

// ------------------------------------------------------------------ robô que joga como gente

/** Reação ~250 ms, mira pela lei de Fitts, erro gaussiano, às vezes atira no proibido. */
export interface ParametrosDoRobo {
  reacao: number
  reacaoDP: number
  reacaoMin: number
  fittsA: number
  fittsB: number
  erro: number
  piso: number
  tempoDP: number
  velErro: number
  confunde: number
  seco: number
  tatica: number
  conferir: number
  pronto: number
}

export const ROBO: Readonly<ParametrosDoRobo> = { reacao: 0.25, reacaoDP: 0.06, reacaoMin: 0.13, fittsA: 0.1, fittsB: 0.15, erro: 1, piso: 0.45, tempoDP: 0.035, velErro: 0.15, confunde: 0.12, seco: 0.5, tatica: 0.4, conferir: 0.08, pronto: 0.12 }

interface PlanoDoRobo {
  a: Alvo
  t0: number
  mt: number
  vx: number
  x0: number
  y0: number
  x1: number
  y1: number
  chegou: boolean
}

export interface Robo {
  decidir(R: Rodada): EntradaDoPasso
  reacoes: number[]
  param: ParametrosDoRobo
}

export function criarRobo(param: Partial<ParametrosDoRobo>, semente: string): Robo {
  const p: ParametrosDoRobo = { ...ROBO, ...param }
  const r = semear('robo|' + semente)
  const s = {
    x: W / 2, y: 76, plano: null as PlanoDoRobo | null, viu: new Map<number, { em: number; quer: boolean }>(), livre: 0, recarregarEm: -1,
    vazio: false, secar: false, tatica: false, prontoEm: 0, tAnt: 0, reacoes: [] as number[],
  }
  const reacao = (): number => {
    const v = Math.max(p.reacaoMin, p.reacao + gauss(r) * p.reacaoDP)
    s.reacoes.push(v)
    return v
  }
  const fitts = (d: number, we: number): number => p.fittsA + p.fittsB * Math.log2(d / we + 1)
  const alvoY = (a: Alvo): number => (a.faixa === 'pop' ? Y.pop - a.h - 1 : a.y)
  function planejar(a: Alvo, t: number): void {
    const we = 2 * Math.min(a.w, a.h)
    const vx = a.vx * (1 + gauss(r) * p.velErro)
    let mt = fitts(Math.hypot(a.x - s.x, alvoY(a) - s.y), we)
    mt = fitts(Math.hypot(a.x + vx * mt - s.x, alvoY(a) - s.y), we)
    const sig = (p.erro * we) / 4.133 + p.piso
    const x1 = a.x + vx * mt + gauss(r) * sig + a.vx * gauss(r) * p.tempoDP
    const y1 = alvoY(a) + gauss(r) * sig
    s.plano = { a, t0: t, mt, vx, x0: s.x, y0: s.y, x1, y1, chegou: false }
  }
  function decidir(R: Rodada): EntradaDoPasso {
    const t = R.t
    const dt = Math.max(0, t - s.tAnt)
    const out: EntradaDoPasso = { x: s.x, y: s.y, atirar: false, recarregar: false }
    s.tAnt = t
    if (R.fim) return out
    for (const a of R.alvos) {
      if (a.estado === 'ativo' && !s.viu.has(a.id) && visivel(a)) {
        const em = t + reacao()
        s.viu.set(a.id, { em, quer: !a.proibido || r() < p.confunde })
      }
    }
    if (R.recarga > 0) s.prontoEm = t + p.pronto
    if (R.balas > 0) {
      s.vazio = false
      if (R.balas > 2) s.tatica = false
    } else if (R.recarga <= 0) {
      if (!s.vazio) {
        s.vazio = true
        s.secar = r() < p.seco
        s.recarregarEm = s.secar ? -1 : t + reacao()
      }
      if (s.recarregarEm >= 0 && t >= s.recarregarEm) {
        out.recarregar = true
        s.recarregarEm = -1
      }
    }
    let P = s.plano
    if (P !== null && (P.a.estado !== 'ativo' || P.a.fora || (P.a.faixa === 'pop' ? P.a.idade > SUBIR + (P.a.janela ?? 0) : !visivel(P.a)))) {
      s.plano = P = null
      s.livre = t + reacao()
    }
    if (P === null && t >= s.livre) {
      let melhor: Alvo | null = null
      let nota = 0
      for (const a of R.alvos) {
        const v = s.viu.get(a.id)
        if (v === undefined || !v.quer || t < v.em || a.estado !== 'ativo') continue
        const we = 2 * Math.min(a.w, a.h)
        const mt = fitts(Math.hypot(a.x - s.x, alvoY(a) - s.y), we)
        if (restante(a) < mt + 0.1) continue
        const val = ((a.proibido ? 20 : TIPOS[a.tipo].pts) / (mt + 0.25)) * (we / (we + 0.12 * Math.abs(a.vx) + (a.faixa === 'ar' ? 4 : 0)))
        if (val > nota) {
          nota = val
          melhor = a
        }
      }
      if (melhor !== null) {
        planejar(melhor, t)
        P = s.plano
      } else if (R.balas > 0 && R.balas <= 2 && R.recarga <= 0 && !s.tatica) {
        s.tatica = true
        if (r() < p.tatica) out.recarregar = true
      }
    }
    if (P !== null) {
      const k = (t - P.t0) / P.mt
      if (k < 1) {
        const m = k * k * k * (10 - 15 * k + 6 * k * k)
        s.x = P.x0 + (P.x1 - P.x0) * m
        s.y = P.y0 + (P.y1 - P.y0) * m
      } else {
        if (!P.chegou) {
          P.chegou = true
          s.x = P.x1
          s.y = P.y1
        } else s.x += P.vx * dt
        if (R.recarga <= 0 && R.cao <= 0 && t >= s.prontoEm && atingivel(P.a) && (R.balas > 0 || s.secar)) {
          out.atirar = true
          if (R.balas === 0) {
            s.secar = false
            s.recarregarEm = t + reacao()
          }
          s.plano = null
          s.livre = t + p.conferir
        }
      }
    }
    out.x = s.x
    out.y = s.y
    return out
  }
  return { decidir, reacoes: s.reacoes, param: p }
}

export interface ResultadoSimulado {
  dif: DificuldadeSim
  pontos: number
  tiros: number
  acertos: number
  precisao: number
  comboMax: number
  proibidos: number
  secos: number
  recargas: number
  medalha: MedalhaTiro | null
}

/** Uma rodada inteira com o robô, sem desenhar. */
export function simular(dif: DificuldadeSim, semente: string, param: Partial<ParametrosDoRobo> = {}): ResultadoSimulado {
  const R = criarRodada(dif, semente)
  const robo = criarRobo(param, `${dif}|${semente}`)
  while (!R.fim) passo(R, robo.decidir(R))
  return {
    dif, pontos: R.pontos, tiros: R.tiros, acertos: R.acertos, precisao: R.tiros ? R.acertos / R.tiros : 0, comboMax: R.comboMax,
    proibidos: R.proibidos, secos: R.secos, recargas: R.recargas, medalha: medalha(dif, R.pontos),
  }
}
