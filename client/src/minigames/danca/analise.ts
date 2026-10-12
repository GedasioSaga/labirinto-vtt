import { gerarChart, gradeImportada, type RitmoAnalisado } from './coreografia'
import { limitar } from './curvas'
import type { DificuldadeDanca, NotaDaDanca } from './tipos'

/**
 * ANÁLISE DA MÚSICA IMPORTADA: acha BPM, primeira batida e a força dos ataques,
 * offline, a partir do áudio decodificado (fluxo de energia em 3 faixas,
 * autocorrelação, ajuste fino por DFT, fase). Roda UMA vez no mestre ao
 * importar: decodificar o mesmo mp3 em navegadores diferentes daria setas
 * diferentes, então as coreografias prontas vão gravadas no pino.
 */

/** O pedaço do `AudioBuffer` que a análise lê; um buffer de verdade serve, e o teste monta um de mentira. */
export interface AudioDecodificado {
  readonly sampleRate: number
  readonly length: number
  readonly duration: number
  readonly numberOfChannels: number
  getChannelData(canal: number): Float32Array
}

export interface AnaliseDaMusica extends RitmoAnalisado {
  bpm: number
  /** 0-1: quanto o melhor tempo se destaca da mediana dos candidatos. */
  confianca: number
}

/** Quadro de análise: 10 ms. */
const HOP_S = 0.01
/** Ajuste fixo entre o pico do fluxo e o ataque ouvido (medido na faixa demo). */
const DESVIO_ATAQUE = 0
const BPM_MIN = 60
const BPM_MAX = 200
/** Os tempos perto de 118 BPM são os mais prováveis (música de dança); a 0,9 oitava a chance cai pela metade. */
const BPM_PREFERIDO = 118
const LARGURA_DA_PREFERENCIA_OITAVAS = 0.9
/** O ajuste fino por DFT procura de 98% a 102% do melhor tempo da autocorrelação, de 0,01 em 0,01 BPM. */
const AJUSTE_FINO_DE = 0.98
const AJUSTE_FINO_ATE = 1.02
const PASSO_DO_AJUSTE_FINO = 0.01
/** Tempo de estúdio quase sempre é inteiro: fica com o inteiro se ele explica pelo menos 98,5% do melhor. */
const DISTANCIA_DO_INTEIRO = 0.15
const FATOR_DO_INTEIRO = 0.985
/** Média móvel de ±0,2 s tirada do fluxo: sobra só o que é ataque. */
const RAIO_DA_MEDIA_S = 0.2
/** A primeira batida não fica antes do som começar (30% do maior ataque). */
const LIMIAR_DO_INICIO = 0.3
/** Busca da fase: ±40 ms em passos de 2 ms em volta da fase da DFT. */
const BUSCA_DA_FASE_S = 0.04
const PASSO_DA_FASE_S = 0.002

type Biquad = readonly [number, number, number, number, number]
type TipoDoFiltro = 'lp' | 'hp' | 'bp'
/** As 3 faixas do fluxo: grave (bumbo), médio (caixa, voz) e agudo (chimbal), com o peso de cada uma. */
const FAIXAS: readonly { tipo: TipoDoFiltro; f: number; q: number; peso: number }[] = [
  { tipo: 'lp', f: 150, q: 0.707, peso: 1 },
  { tipo: 'bp', f: 1400, q: 0.8, peso: 0.8 },
  { tipo: 'hp', f: 6000, q: 0.707, peso: 0.5 },
]

const ceder = (): Promise<void> => new Promise((ok) => setTimeout(ok, 0))

function coef(tipo: TipoDoFiltro, f: number, q: number, sr: number): Biquad {
  const w = (2 * Math.PI * f) / sr
  const cs = Math.cos(w)
  const al = Math.sin(w) / (2 * q)
  const a0 = 1 + al
  const a1 = -2 * cs
  const a2 = 1 - al
  let b0: number
  let b1: number
  let b2: number
  if (tipo === 'lp') {
    b0 = (1 - cs) / 2
    b1 = 1 - cs
    b2 = b0
  } else if (tipo === 'hp') {
    b0 = (1 + cs) / 2
    b1 = -(1 + cs)
    b2 = b0
  } else {
    b0 = al
    b1 = 0
    b2 = -al
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

function energiaPorQuadro(x: Float32Array, c: Biquad, hop: number, quadros: number): Float32Array {
  const [b0, b1, b2, a1, a2] = c
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  const e = new Float32Array(quadros)
  for (let q = 0, i = 0; q < quadros; q += 1) {
    let s = 0
    for (let k = 0; k < hop; k += 1, i += 1) {
      const xi = x[i]
      const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = xi
      y2 = y1
      y1 = y
      s += y * y
    }
    e[q] = s / hop
  }
  return e
}

function autocorr(env: Float32Array, topo: number): Float32Array {
  const n = env.length
  const acf = new Float32Array(topo + 1)
  for (let L = 1; L <= topo; L += 1) {
    let s = 0
    for (let i = 0; i + L < n; i += 1) s += env[i] * env[i + L]
    acf[L] = s / (n - L)
  }
  return acf
}

/** Um termo da DFT do fluxo, na frequência dada: força e ângulo da batida. */
function magnitude(env: Float32Array, ciclosPorQuadro: number): { mag: number; ang: number } {
  const w = 2 * Math.PI * ciclosPorQuadro
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  let c = 1
  let s = 0
  let re = 0
  let im = 0
  for (let i = 0; i < env.length; i += 1) {
    re += env[i] * c
    im += env[i] * s
    const nc = c * cw - s * sw
    s = s * cw + c * sw
    c = nc
  }
  return { mag: Math.hypot(re, im), ang: Math.atan2(im, re) }
}

function estimarTempo(env: Float32Array, hopS: number): { periodo: number; confianca: number } {
  const minL = Math.floor(60 / BPM_MAX / hopS)
  const maxL = Math.ceil(60 / BPM_MIN / hopS)
  const topo = Math.min(env.length - 2, maxL * 4 + 2)
  const acf = autocorr(env, topo)
  const at = (k: number): number => (k >= 1 && k <= topo ? acf[k] : 0)
  const nota = (L: number): number => {
    const bpm = 60 / (L * hopS)
    const pri = Math.exp(-0.5 * (Math.log2(bpm / BPM_PREFERIDO) / LARGURA_DA_PREFERENCIA_OITAVAS) ** 2)
    // O tempo certo também explica o dobro e o quádruplo do período.
    return (at(L) + 0.5 * at(2 * L) + 0.25 * at(4 * L)) * pri
  }
  let melhorL = minL
  let melhor = -Infinity
  const todas: number[] = []
  for (let L = minL; L <= maxL; L += 1) {
    const s = nota(L)
    todas.push(s)
    if (s > melhor) {
      melhor = s
      melhorL = L
    }
  }
  // Parábola pelos vizinhos: o período cai entre dois quadros.
  const y0 = nota(melhorL - 1)
  const y2 = nota(melhorL + 1)
  const den = y0 - 2 * melhor + y2
  const Lf = melhorL + (den !== 0 ? (0.5 * (y0 - y2)) / den : 0)
  const bpm0 = 60 / (Lf * hopS)
  let melhorMag = -1
  let bpm = bpm0
  for (let b = bpm0 * AJUSTE_FINO_DE; b <= bpm0 * AJUSTE_FINO_ATE; b += PASSO_DO_AJUSTE_FINO) {
    const m = magnitude(env, (b / 60) * hopS).mag
    if (m > melhorMag) {
      melhorMag = m
      bpm = b
    }
  }
  const inteiro = Math.round(bpm)
  if (Math.abs(inteiro - bpm) < DISTANCIA_DO_INTEIRO && magnitude(env, (inteiro / 60) * hopS).mag >= FATOR_DO_INTEIRO * melhorMag) bpm = inteiro
  todas.sort((a, b) => a - b)
  const med = todas[todas.length >> 1] || 1e-9
  return { periodo: 60 / bpm, confianca: limitar((melhor / med - 1) / 3, 0, 1) }
}

function estimarFase(env: Float32Array, grave: Float32Array, hopS: number, P: number): { primeira: number; fase4: number } {
  const n = env.length
  const dur = n * hopS
  let fase = (magnitude(env, hopS / P).ang / (2 * Math.PI)) * P
  fase = ((fase % P) + P) % P
  const pico = (t: number): number => {
    const i = Math.round(t / hopS)
    let m = 0
    for (let k = i - 1; k <= i + 1; k += 1) if (k >= 0 && k < n && env[k] > m) m = env[k]
    return m
  }
  let melhor = -1
  let melhorF = fase
  for (let d = -BUSCA_DA_FASE_S; d <= BUSCA_DA_FASE_S + 1e-5; d += PASSO_DA_FASE_S) {
    const f = (((fase + d) % P) + P) % P
    let s = 0
    for (let t = f; t < dur; t += P) s += pico(t)
    if (s > melhor) {
      melhor = s
      melhorF = f
    }
  }
  let max = 0
  for (let i = 0; i < n; i += 1) if (env[i] > max) max = env[i]
  let ini = 0
  for (let i = 0; i < n; i += 1) {
    if (env[i] > LIMIAR_DO_INICIO * max) {
      ini = i * hopS
      break
    }
  }
  let primeira = melhorF
  while (primeira + P * 0.5 < ini) primeira += P
  // O compasso abre na batida em que o grave (bumbo) mais bate.
  const soma = [0, 0, 0, 0]
  for (let k = 0, t = primeira; t < dur; k += 1, t += P) {
    const i = Math.round(t / hopS)
    let m = 0
    for (let j = i - 2; j <= i + 2; j += 1) if (j >= 0 && j < n && grave[j] > m) m = grave[j]
    soma[k % 4] += m
  }
  return { primeira: primeira + DESVIO_ATAQUE, fase4: soma.indexOf(Math.max(...soma)) }
}

/** Lê o áudio decodificado e devolve BPM, primeira batida e a força dos ataques. Cede a vez entre etapas. */
export async function analisar(buffer: AudioDecodificado, aoProgredir: (fracao: number) => void = () => undefined): Promise<AnaliseDaMusica> {
  const sr = buffer.sampleRate
  const hop = Math.round(sr * HOP_S)
  const hopS = hop / sr
  const n = buffer.length
  const quadros = Math.floor(n / hop)
  const mono = new Float32Array(n)
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const d = buffer.getChannelData(c)
    const k = 1 / buffer.numberOfChannels
    for (let i = 0; i < n; i += 1) mono[i] += d[i] * k
  }
  aoProgredir(0.1)
  await ceder()
  const fluxos: Float32Array[] = []
  const energias: Float32Array[] = []
  for (const faixa of FAIXAS) {
    const e = energiaPorQuadro(mono, coef(faixa.tipo, faixa.f, faixa.q, sr), hop, quadros)
    const fl = new Float32Array(quadros)
    let ant = Math.log1p(1e4 * e[0])
    for (let i = 1; i < quadros; i += 1) {
      const v = Math.log1p(1e4 * e[i])
      fl[i] = Math.max(0, v - ant)
      ant = v
    }
    fluxos.push(fl)
    energias.push(e)
    aoProgredir(0.1 + 0.2 * fluxos.length)
    await ceder()
  }
  const bruto = new Float32Array(quadros)
  for (let i = 0; i < quadros; i += 1) bruto[i] = FAIXAS.reduce((s, faixa, f) => s + faixa.peso * fluxos[f][i], 0)
  const r = Math.round(RAIO_DA_MEDIA_S / hopS)
  const acum = new Float64Array(quadros + 1)
  for (let i = 0; i < quadros; i += 1) acum[i + 1] = acum[i] + bruto[i]
  const env = new Float32Array(quadros)
  const rms = new Float32Array(quadros)
  for (let i = 0; i < quadros; i += 1) {
    const a = Math.max(0, i - r)
    const b = Math.min(quadros, i + r + 1)
    env[i] = Math.max(0, bruto[i] - (acum[b] - acum[a]) / (b - a))
    rms[i] = Math.sqrt(energias[0][i] + energias[1][i] + energias[2][i])
  }
  aoProgredir(0.75)
  await ceder()
  const tempo = estimarTempo(env, hopS)
  aoProgredir(0.9)
  await ceder()
  const fase = estimarFase(env, fluxos[0], hopS, tempo.periodo)
  aoProgredir(1)
  return {
    bpm: 60 / tempo.periodo,
    periodo: tempo.periodo,
    confianca: tempo.confianca,
    primeiraBatida: fase.primeira,
    fase4: fase.fase4,
    env,
    rms,
    hopS,
    duracao: buffer.duration,
  }
}

/** Toques aceitos no "bater o tempo": precisa de 4 para a reta. */
const TOQUES_MINIMOS = 4
/** Período batido fora de 40-240 BPM é toque errado, não música. */
const PERIODO_MIN_S = 0.25
const PERIODO_MAX_S = 1.5

/** Tempo batido à mão: reta pelos toques (mínimos quadrados) dá período e fase juntos. */
export function ajustarToques(tempos: readonly number[]): { periodo: number; fase: number } | null {
  if (tempos.length < TOQUES_MINIMOS) return null
  const ints: number[] = []
  for (let i = 1; i < tempos.length; i += 1) ints.push(tempos[i] - tempos[i - 1])
  const med = ints.slice().sort((a, b) => a - b)[ints.length >> 1]
  // Toque pulado: o intervalo vale 2 batidas, não 1.
  const k = [0]
  for (let i = 1; i < tempos.length; i += 1) k.push(k[i - 1] + Math.max(1, Math.round((tempos[i] - tempos[i - 1]) / med)))
  const n = k.length
  const mk = k.reduce((a, b) => a + b, 0) / n
  const mt = tempos.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (k[i] - mk) * (tempos[i] - mt)
    den += (k[i] - mk) ** 2
  }
  const P = num / den
  const a = mt - P * mk
  return P > PERIODO_MIN_S && P < PERIODO_MAX_S ? { periodo: P, fase: a } : null
}

// ------------------------------------------------------------------ o que o mestre grava no pino

/** O ritmo e as duas coreografias que vão no pino (`MusicaDaDanca` do tipo 'arquivo', sem mídia e nome). */
export interface RitmoGravado {
  bpm: number
  primeiraBatida: number
  fase4: number
  duracaoS: number
  coreografias: Record<DificuldadeDanca, NotaDaDanca[]>
}

/**
 * `ritmo` vai para o pino; `analise` fica só na memória do painel do mestre,
 * para `reajustar` sem decodificar de novo (leva Float32Array: não grave).
 */
export interface MusicaPreparada {
  ritmo: RitmoGravado
  analise: AnaliseDaMusica
}

function ritmoDe(analise: AnaliseDaMusica, semente: string): RitmoGravado {
  const grade = gradeImportada(analise)
  return {
    bpm: analise.bpm,
    primeiraBatida: analise.primeiraBatida,
    fase4: analise.fase4,
    duracaoS: analise.duracao,
    coreografias: {
      diversao: gerarChart(grade, 'diversao', semente),
      expert: gerarChart(grade, 'expert', semente),
    },
  }
}

/** Analisa a música importada e gera as duas coreografias. `semente` é o id do pino. */
export async function prepararMusicaImportada(
  buffer: AudioDecodificado,
  semente: string,
  aoProgredir?: (fracao: number) => void,
): Promise<MusicaPreparada> {
  const analise = await analisar(buffer, aoProgredir)
  return { ritmo: ritmoDe(analise, semente), analise }
}

/**
 * O mestre corrigiu o tempo (±0,1 BPM, ±10 ms ou batendo): refaz a grade e as
 * coreografias com o BPM e a primeira batida dados, sem tocar na análise
 * recebida. A fase do compasso (`fase4`) fica a detectada, como no protótipo.
 */
export function reajustar(analise: AnaliseDaMusica, novo: { bpm: number; primeiraBatida: number }, semente: string): MusicaPreparada {
  if (!Number.isFinite(novo.bpm) || novo.bpm <= 0) throw new RangeError(`BPM inválido: ${novo.bpm}`)
  if (!Number.isFinite(novo.primeiraBatida) || novo.primeiraBatida < 0) throw new RangeError(`primeira batida inválida: ${novo.primeiraBatida}`)
  const nova: AnaliseDaMusica = { ...analise, bpm: novo.bpm, periodo: 60 / novo.bpm, primeiraBatida: novo.primeiraBatida }
  return { ritmo: ritmoDe(nova, semente), analise: nova }
}

/** Limites dos botões ±0,1 BPM do painel do mestre. */
export const BPM_AJUSTE_MIN = 50
export const BPM_AJUSTE_MAX = 220
/** A primeira batida não passa de 1 s antes do fim da música. */
const FOLGA_DA_PRIMEIRA_BATIDA_S = 1

const arredondarBpm = (bpm: number): number => Math.round(bpm * 10) / 10

/** Os botões ±0,1 BPM e ±10 ms: o tempo novo, arredondado a 0,1 BPM e dentro dos limites. */
export function tempoMexido(analise: AnaliseDaMusica, dBpm: number, dFase: number): { bpm: number; primeiraBatida: number } {
  return {
    bpm: arredondarBpm(limitar(analise.bpm + dBpm, BPM_AJUSTE_MIN, BPM_AJUSTE_MAX)),
    // Música de menos de 1 s: o teto vira 0, nunca negativo (reajustar recusaria).
    primeiraBatida: limitar(analise.primeiraBatida + dFase, 0, Math.max(0, analise.duracao - FOLGA_DA_PRIMEIRA_BATIDA_S)),
  }
}

/**
 * "Bater o tempo": os instantes dos toques (s de música) viram BPM, arredondado
 * a 0,1, e a primeira batida trazida para a primeira batida da música.
 * `null` = toques irregulares demais.
 */
export function tempoDosToques(toques: readonly number[]): { bpm: number; primeiraBatida: number } | null {
  const r = ajustarToques(toques)
  if (r === null) return null
  const bpm = arredondarBpm(60 / r.periodo)
  const periodo = 60 / bpm
  let f = r.fase
  while (f - periodo > 0) f -= periodo
  while (f < 0) f += periodo
  return { bpm, primeiraBatida: f }
}
