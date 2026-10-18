/**
 * SIMULAÇÃO DA PESCA: dificuldades, peixes, sorteio pelo lance e a puxada em
 * passo fixo. Porte fiel do bloco SIM do protótipo aprovado
 * (docs/design/minigame-pesca/prototipo/index.html); puro, sem DOM, para o
 * jogo, o robô e os testes rodarem a mesma conta com a mesma semente.
 */

export type DificuldadeSim = 'normal' | 'extremo'

/** Passo fixo da puxada, em s: com passo variável a mesma semente daria outra puxada em outro aparelho. */
export const DT = 1 / 120

export type Rng = () => number

const lim = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

function mulberry32(semente: number): Rng {
  let a = semente
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const rngDe = (s: string | number): Rng => mulberry32(hash(String(s)))
const entre = (r: Rng, a: number, b: number): number => a + (b - a) * r()

type Faixa2 = readonly [number, number]

export interface ParametrosDoBau {
  chance: number
  /** Instante em que aparece na coluna, em s desde o começo da puxada. */
  aparece: Faixa2
  /** Segundos visível antes de sumir. */
  vida: number
  /** Segundos dentro da barra para encher. */
  encher: number
}

export interface ParametrosDaDificuldade {
  nome: string
  barra: number
  subida: number
  gravidade: number
  vBarra: number
  quique: number
  vPeixe: number
  mola: number
  intervalo: Faixa2
  tremor: number
  ganho: number
  perda: number
  inicio: number
  janela: number
  espera: Faixa2
  beliscadas: number
  ciclo: number
  bau: ParametrosDoBau
}

/* Posições em fração da coluna de água (0 = fundo, 1 = topo); velocidades em coluna/s. */
export const DIF: Readonly<Record<DificuldadeSim, ParametrosDaDificuldade>> = {
  normal: {
    nome: 'Normal', barra: 0.24, subida: 3.0, gravidade: 2.3, vBarra: 1.4, quique: 0.4,
    vPeixe: 0.6, mola: 20, intervalo: [0.9, 1.8], tremor: 0.3,
    ganho: 0.15, perda: 0.11, inicio: 0.3,
    janela: 0.9, espera: [1.5, 4.0], beliscadas: 1, ciclo: 1.4,
    bau: { chance: 0.2, aparece: [1.2, 3.5], vida: 6, encher: 1.4 },
  },
  extremo: {
    nome: 'Extremo', barra: 0.15, subida: 3.4, gravidade: 2.9, vBarra: 1.7, quique: 0.4,
    vPeixe: 0.75, mola: 38, intervalo: [0.4, 1.1], tremor: 1.0,
    ganho: 0.22, perda: 0.3, inicio: 0.3,
    janela: 0.5, espera: [1.8, 5.0], beliscadas: 3, ciclo: 1.0,
    bau: { chance: 0.3, aparece: [1.0, 3.0], vida: 4, encher: 1.8 },
  },
}

/** O peixe na coluna durante a puxada. */
export interface PeixeNaAgua {
  y: number
  v: number
  alvo: number
  /** Instante do próximo alvo. */
  prox: number
  /** Fase do seno do comportamento suave. */
  fase: number
}

export type IdDoComportamento = 'misto' | 'disparado' | 'suave' | 'afunda' | 'flutua'

export interface Comportamento {
  int: number
  mola: number
  vel: number
  alvo: (p: PeixeNaAgua, r: Rng) => number
}

/* Comportamento: como o peixe escolhe o próximo alvo, e multiplicadores de intervalo, mola e velocidade. */
export const COMP: Readonly<Record<IdDoComportamento, Comportamento>> = {
  misto: { int: 1, mola: 1, vel: 1, alvo: (p, r) => p.y + (r() * 2 - 1) * 0.45 },
  disparado: {
    int: 2.0, mola: 2.2, vel: 1.1,
    alvo: (p, r) => {
      let a = p.y
      for (let i = 0; i < 8 && Math.abs(a - p.y) < 0.3; i++) a = 0.05 + r() * 0.9
      return a
    },
  },
  suave: {
    int: 1.2, mola: 0.5, vel: 0.55,
    alvo: (p, r) => {
      p.fase += 0.7 + r() * 0.8
      return 0.5 + Math.sin(p.fase) * 0.4
    },
  },
  afunda: { int: 1, mola: 1, vel: 1, alvo: (_p, r) => (r() < 0.18 ? 0.55 + r() * 0.4 : 0.04 + Math.pow(r(), 1.8) * 0.5) },
  flutua: { int: 1, mola: 1, vel: 1, alvo: (_p, r) => (r() < 0.18 ? 0.05 + r() * 0.4 : 0.96 - Math.pow(r(), 1.8) * 0.5) },
}

export type Raridade = 'comum' | 'incomum' | 'raro' | 'lendario'

/** Cores da arte, nesta ordem: contorno, dorso, corpo, ventre, barbatana, detalhe. */
export type CoresDoPeixe = readonly [string, string, string, string, string, string]

export interface ArteDoPeixe {
  /** Comprimento e altura do corpo, em pixels. */
  L: number
  A: number
  cauda: 'garfo' | 'fina' | 'leque'
  perfil?: 'longo' | 'oval'
  padrao?: 'runa' | 'pintas' | 'ossos' | 'placas'
  extra?: 'isca' | 'bigode' | 'ventosa' | 'coroa'
  cor: CoresDoPeixe
  olho?: string
}

export type IdDoPeixe =
  | 'carpa-runa' | 'enguia' | 'lume' | 'piaba' | 'bagre'
  | 'truta' | 'linguado' | 'lampreia' | 'esturjao' | 'coroa'

export interface Peixe {
  id: IdDoPeixe
  nome: string
  comp: IdDoComportamento
  rar: Raridade
  /** Tamanho mínimo e máximo, em cm. */
  cm: Faixa2
  /** Multiplica mola, velocidade e frequência de novo alvo. */
  vel: number
  /** Trancos extras por s, somados aos da dificuldade. */
  tremor?: number
  onde: 'ambos' | 'extremo'
  arte: ArteDoPeixe
}

export const PEIXES: readonly Peixe[] = [
  { id: 'carpa-runa', nome: 'Carpa-runa', comp: 'misto', rar: 'comum', cm: [24, 58], vel: 1, onde: 'ambos', arte: { L: 16, A: 7, cauda: 'garfo', padrao: 'runa', cor: ['#1b1208', '#8a5a22', '#c98a36', '#e8c27a', '#a8652a', '#79a9cc'] } },
  { id: 'enguia', nome: 'Enguia de caverna', comp: 'suave', rar: 'comum', cm: [40, 95], vel: 0.95, onde: 'ambos', arte: { L: 22, A: 4, perfil: 'longo', cauda: 'fina', cor: ['#0e1210', '#2f3a26', '#4a5a36', '#9aa77a', '#3a4630', '#9aa77a'], olho: '#d9d4c7' } },
  { id: 'lume', nome: 'Lume-de-poça', comp: 'flutua', rar: 'comum', cm: [7, 16], vel: 1.05, onde: 'ambos', arte: { L: 9, A: 5, cauda: 'leque', extra: 'isca', cor: ['#120f14', '#3a3350', '#5b5079', '#8d82ad', '#463d63', '#f3ba66'], olho: '#f3ba66' } },
  { id: 'piaba', nome: 'Piaba-ossuda', comp: 'disparado', rar: 'comum', cm: [10, 22], vel: 1, onde: 'ambos', arte: { L: 11, A: 5, cauda: 'garfo', padrao: 'ossos', cor: ['#0f0f12', '#2a2a30', '#3c3c44', '#55555e', '#50505a', '#d9d4c7'], olho: '#e2645a' } },
  { id: 'bagre', nome: 'Bagre-de-pedra', comp: 'afunda', rar: 'incomum', cm: [35, 90], vel: 1.1, onde: 'ambos', arte: { L: 17, A: 6, cauda: 'leque', extra: 'bigode', cor: ['#121110', '#4a4640', '#6b665d', '#a29b8c', '#57524a', '#c9c0ad'] } },
  { id: 'truta', nome: 'Truta-do-fosso', comp: 'misto', rar: 'incomum', cm: [20, 46], vel: 1.2, onde: 'ambos', arte: { L: 15, A: 5, cauda: 'garfo', padrao: 'pintas', cor: ['#10141a', '#4f6170', '#8fa3b0', '#e0c4bc', '#6d808e', '#2a3540'] } },
  { id: 'linguado', nome: 'Linguado-espectro', comp: 'afunda', rar: 'raro', cm: [28, 55], vel: 1.15, onde: 'extremo', arte: { L: 13, A: 8, perfil: 'oval', cauda: 'leque', padrao: 'pintas', cor: ['#1a1424', '#6e5d92', '#ab93d6', '#d8cdf0', '#8a77b5', '#eee6ff'] } },
  { id: 'lampreia', nome: 'Lampreia-de-cobre', comp: 'disparado', rar: 'raro', cm: [45, 100], vel: 1, onde: 'extremo', arte: { L: 22, A: 4, perfil: 'longo', cauda: 'fina', extra: 'ventosa', cor: ['#170d08', '#7a3e1c', '#b8642e', '#e09a5c', '#8f4a22', '#f3ba66'] } },
  { id: 'esturjao', nome: 'Esturjão-de-cristal', comp: 'suave', rar: 'raro', cm: [70, 150], vel: 0.95, onde: 'extremo', arte: { L: 22, A: 6, cauda: 'garfo', padrao: 'placas', cor: ['#0b1620', '#3b6d8f', '#79a9cc', '#c3e0f2', '#5a8db0', '#e8f6ff'] } },
  { id: 'coroa', nome: 'Coroa-do-Abismo', comp: 'misto', rar: 'lendario', cm: [140, 210], vel: 2.1, tremor: 3, onde: 'extremo', arte: { L: 22, A: 9, cauda: 'leque', extra: 'coroa', cor: ['#07080a', '#1c2230', '#2b3346', '#4a5670', '#232a3a', '#f2c14e'], olho: '#e2645a' } },
]

export const peixePorId = (id: string): Peixe | undefined => PEIXES.find((p) => p.id === id)
export const cardapio = (dif: DificuldadeSim): Peixe[] => PEIXES.filter((p) => p.onde === 'ambos' || p.onde === dif)

/* Peso no sorteio pela distância do lance (0 a 1): longe favorece o melhor; o lendário só passa de 0,6. */
export function pesoDe(p: Peixe, dist: number): number {
  if (p.rar === 'comum') return 10 * (1.3 - 0.6 * dist)
  if (p.rar === 'incomum') return 6 * (0.7 + 0.6 * dist)
  if (p.rar === 'raro') return 2.5 * (0.3 + 1.4 * dist)
  return dist <= 0.6 ? 0 : 2 * ((dist - 0.6) / 0.4)
}

/** Força do lance no tempo segurado: vai e volta de 0 a 1 a cada `ciclo` s. */
export const forcaNoTempo = (t: number, ciclo: number): number => {
  const f = (t / ciclo) % 2
  return f < 1 ? f : 2 - f
}

export type FaixaDoLance = 'perto' | 'medio' | 'longe'
export const faixa = (dist: number): FaixaDoLance => (dist >= 0.8 ? 'longe' : dist >= 0.4 ? 'medio' : 'perto')
export const estrelas = (dist: number, perfeito: boolean): number =>
  1 + (dist >= 0.4 ? 1 : 0) + (dist >= 0.8 ? 1 : 0) + (perfeito ? 1 : 0)

export interface Sorteio {
  peixe: Peixe
  cm: number
  /** Segundos de espera até morder. */
  espera: number
  /** Instantes das beliscadas falsas, em ordem. */
  beliscadas: number[]
}

export function sortear(dif: DificuldadeSim, dist: number, semente: string): Sorteio {
  const r = rngDe(semente + '|peixe')
  const lista = cardapio(dif)
  const pesos = lista.map((p) => pesoDe(p, dist))
  let x = r() * pesos.reduce((a, b) => a + b, 0)
  let i = 0
  while (i < lista.length - 1 && x >= pesos[i]) {
    x -= pesos[i]
    i++
  }
  const p = lista[i]
  const d = DIF[dif]
  const cm = Math.round(p.cm[0] + (p.cm[1] - p.cm[0]) * Math.pow(r(), 1.6 - 0.9 * dist))
  const espera = entre(r, d.espera[0], d.espera[1]) * (1 + dist * 0.2)
  const n = Math.floor(r() * (d.beliscadas + 1))
  const beliscadas: number[] = []
  for (let k = 0; k < n; k++) beliscadas.push(0.5 + r() * Math.max(0.1, espera - 1.0))
  beliscadas.sort((a, b) => a - b)
  return { peixe: p, cm, espera, beliscadas }
}

/** `nunca` e `sumiu` também marcam o baú que ficou para trás quando a puxada acabou. */
export type EstadoDoBau = 'espera' | 'visivel' | 'pego' | 'sumiu' | 'nunca'

export interface BauNaAgua {
  em: number
  y: number
  prog: number
  estado: EstadoDoBau
}

export interface BarraVerde {
  y: number
  v: number
  tam: number
}

export type FimDaPuxada = 'pegou' | 'escapou'

export interface Puxada {
  dif: DificuldadeSim
  d: ParametrosDaDificuldade
  peixe: Peixe
  c: Comportamento
  r: Rng
  t: number
  fim: FimDaPuxada | null
  /** O peixe nunca saiu da barra. */
  perfeito: boolean
  dentro: boolean
  b: BarraVerde
  p: PeixeNaAgua
  /** Medidor de captura, 0 a 1. */
  m: number
  bau: BauNaAgua | null
}

export function novaPuxada(dif: DificuldadeSim, peixe: Peixe, semente: string): Puxada {
  const d = DIF[dif]
  const r = rngDe(semente + '|puxada')
  const e: Puxada = {
    dif, d, peixe, c: COMP[peixe.comp], r, t: 0, fim: null, perfeito: true, dentro: true,
    b: { y: 0, v: 0, tam: d.barra },
    p: { y: d.barra * 0.5, v: 0, alvo: d.barra * 0.5, prox: 0.6, fase: r() * 6.28 },
    m: d.inicio,
    bau: null,
  }
  if (r() < d.bau.chance) e.bau = { em: entre(r, d.bau.aparece[0], d.bau.aparece[1]), y: 0.1 + r() * 0.8, prog: 0, estado: 'espera' }
  return e
}

/** Avança a puxada um `DT`; `seg` = o jogador está segurando. */
export function passo(e: Puxada, seg: boolean): FimDaPuxada | null {
  if (e.fim) return e.fim
  const { d, c, p, b, r, peixe } = e
  const dt = DT
  e.t += dt
  if (e.t >= p.prox) {
    p.alvo = lim(c.alvo(p, r), 0.03, 0.97)
    p.prox = e.t + entre(r, d.intervalo[0], d.intervalo[1]) * c.int / peixe.vel
  }
  if (e.t > 0.6) {
    const k = d.mola * c.mola * peixe.vel
    const vmax = d.vPeixe * c.vel * peixe.vel
    const tremor = d.tremor + (peixe.tremor ?? 0)
    p.v += ((p.alvo - p.y) * k - p.v * 1.6 * Math.sqrt(k)) * dt
    if (tremor !== 0 && r() < tremor * dt) p.v += (r() * 2 - 1) * vmax * 0.9
    p.v = lim(p.v, -vmax, vmax)
    p.y += p.v * dt
    if (p.y < 0.03) {
      p.y = 0.03
      p.v = Math.abs(p.v) * 0.3
    } else if (p.y > 0.97) {
      p.y = 0.97
      p.v = -Math.abs(p.v) * 0.3
    }
  }
  b.v = lim(b.v + (seg ? d.subida : -d.gravidade) * dt, -d.vBarra, d.vBarra)
  b.y += b.v * dt
  if (b.y <= 0) {
    b.y = 0
    b.v = b.v < -0.3 ? -b.v * d.quique : 0
  } else if (b.y >= 1 - b.tam) {
    b.y = 1 - b.tam
    b.v = Math.min(0, b.v)
  }
  const dentro = p.y >= b.y && p.y <= b.y + b.tam
  const u = e.bau
  let bauDentro = false
  if (u && u.estado === 'espera' && e.t >= u.em) u.estado = 'visivel'
  if (u && u.estado === 'visivel') {
    bauDentro = u.y >= b.y && u.y <= b.y + b.tam
    u.prog = lim(u.prog + (bauDentro ? dt : -dt * 0.5) / d.bau.encher, 0, 1)
    if (u.prog >= 1) u.estado = 'pego'
    else if (e.t >= u.em + d.bau.vida) u.estado = 'sumiu'
  }
  e.dentro = dentro
  if (dentro) e.m += d.ganho * dt
  else {
    e.perfeito = false
    // Baú dentro da barra segura o medidor: dá para ir buscá-lo sem perder o peixe.
    if (!bauDentro) e.m -= d.perda * dt
  }
  if (e.m >= 1) {
    e.m = 1
    e.fim = 'pegou'
  } else if (e.m <= 0) {
    e.m = 0
    e.fim = 'escapou'
  }
  if (e.fim && u) u.estado = u.estado === 'espera' ? 'nunca' : u.estado === 'visivel' ? 'sumiu' : u.estado
  return e.fim
}

export type Politica = (e: Puxada) => boolean

/* Robô simples: vê o peixe com atraso (reação humana) e segura quando ele está acima do meio da barra. */
export function politicaSegue(atraso = 0.12): Politica {
  const fila: number[] = []
  const n = Math.round(atraso / DT)
  return (e) => {
    fila.push(e.p.y)
    if (fila.length > 600) fila.splice(0, 300)
    const y = fila[Math.max(0, fila.length - 1 - n)]
    return y > e.b.y + e.b.tam / 2 + e.b.v * 0.12
  }
}

export const politicaFoge = (): Politica => (e) => e.p.y < 0.5

/** Amostra a cada 0,1 s: [t, peixe, base da barra, topo da barra, medidor]. */
export type AmostraDaPuxada = readonly [number, number, number, number, number]

export interface ResultadoDaSimulacao {
  fim: FimDaPuxada | 'tempo'
  t: number
  perfeito: boolean
  bau: EstadoDoBau | null
  amostras: AmostraDaPuxada[]
}

export function simular(dif: DificuldadeSim, peixeId: IdDoPeixe, semente: string, politica: Politica, maxS = 90): ResultadoDaSimulacao {
  const peixe = peixePorId(peixeId)
  if (!peixe) throw new Error(`peixe desconhecido: ${peixeId}`)
  const e = novaPuxada(dif, peixe, semente)
  const amostras: AmostraDaPuxada[] = []
  for (let i = 0; !e.fim && e.t < maxS; i++) {
    if (i % 12 === 0) amostras.push([Math.round(e.t * 10) / 10, e.p.y, e.b.y, e.b.y + e.b.tam, e.m])
    passo(e, politica(e))
  }
  amostras.push([Math.round(e.t * 100) / 100, e.p.y, e.b.y, e.b.y + e.b.tam, e.m])
  return { fim: e.fim ?? 'tempo', t: e.t, perfeito: e.fim === 'pegou' && e.perfeito, bau: e.bau ? e.bau.estado : null, amostras }
}
