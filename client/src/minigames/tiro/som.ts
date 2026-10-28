/**
 * SOM DO TIRO AO ALVO: tiro, madeira, vidro, moeda, ricochete, clique seco,
 * engatilhar, tambor girando, proibido, sino e o realejo da feira,
 * sintetizados em WebAudio. Porte fiel do bloco SOM do protótipo aprovado,
 * com a cadeia de saída dele (ganho geral e um compressor rápido que segura
 * os picos quando tiros se encostam). Todo nó recebe o contexto e o destino
 * por parâmetro.
 */

/** Ganho geral da cadeia de efeitos do tiro (o mestre fica em 1). */
export const GANHO = 1.0

const QUASE_ZERO = 0.0001
const SEMENTE_DO_RUIDO = 0x2545f491
/** Passo pelo buffer de ruído: cada ataque lê um trecho diferente, até 0,7 s. */
const PASSO_NO_RUIDO = 0.173
const TRECHO_DO_RUIDO = 0.7
/** Dentes da catraca do tambor: um por câmara. */
const DENTES_DO_TAMBOR = 12

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>()
let giro = 0

function ruido(ctx: BaseAudioContext): AudioBuffer {
  const pronto = ruidos.get(ctx)
  if (pronto !== undefined) return pronto
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = b.getChannelData(0)
  let s = SEMENTE_DO_RUIDO
  for (let i = 0; i < d.length; i++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    d[i] = ((s >>> 0) / 4294967296) * 2 - 1
  }
  ruidos.set(ctx, b)
  return b
}

function envelope(p: AudioParam, t: number, pico: number, ataque: number, queda: number): void {
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(pico, t + ataque)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + ataque + queda)
}

function fonteRuido(ctx: BaseAudioContext, t: number, dur: number): AudioBufferSourceNode {
  const n = ctx.createBufferSource()
  n.buffer = ruido(ctx)
  n.loop = true
  giro = (giro + PASSO_NO_RUIDO) % TRECHO_DO_RUIDO
  n.start(t, giro)
  n.stop(t + dur)
  return n
}

function filtro(ctx: BaseAudioContext, tipo: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ctx.createBiquadFilter()
  b.type = tipo
  b.frequency.value = f
  b.Q.value = q
  return b
}

function osc(ctx: BaseAudioContext, tipo: OscillatorType, f: number): OscillatorNode {
  const o = ctx.createOscillator()
  o.type = tipo
  o.frequency.value = f
  return o
}

/** Ganho que nasce em 0 (o padrão do GainNode é 1 e deixaria passar uma amostra cheia antes do envelope). */
function vca(ctx: BaseAudioContext): GainNode {
  const g = ctx.createGain()
  g.gain.value = 0
  return g
}

function tom(
  ctx: BaseAudioContext, out: AudioNode, tipo: OscillatorType, f: number,
  t: number, pico: number, ataque: number, queda: number, corte?: number,
): OscillatorNode {
  const o = osc(ctx, tipo, f)
  const g = vca(ctx)
  envelope(g.gain, t, pico, ataque, queda)
  if (corte) o.connect(filtro(ctx, 'lowpass', corte)).connect(g)
  else o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + ataque + queda + 0.03)
  return o
}

function chiado(
  ctx: BaseAudioContext, out: AudioNode, t: number, tipo: BiquadFilterType, f: number, q: number,
  pico: number, ataque: number, queda: number,
): BiquadFilterNode {
  const n = fonteRuido(ctx, t, ataque + queda + 0.03)
  const b = filtro(ctx, tipo, f, q)
  const g = vca(ctx)
  envelope(g.gain, t, pico, ataque, queda)
  n.connect(b).connect(g).connect(out)
  return b
}

function desce(p: AudioParam, de: number, para: number, t: number, d: number): void {
  p.setValueAtTime(de, t)
  p.exponentialRampToValueAtTime(para, t + d)
}

/** Cadeia de saída: ganho geral e um compressor rápido que segura os picos quando tiros se encostam. Devolve a entrada. */
export function cadeia(ctx: BaseAudioContext, destino: AudioNode): GainNode {
  const g = ctx.createGain()
  const c = ctx.createDynamicsCompressor()
  g.gain.value = GANHO
  c.threshold.value = -9
  c.knee.value = 0
  c.ratio.value = 20
  c.attack.value = 0.001
  c.release.value = 0.12
  g.connect(c).connect(destino)
  return g
}

/** Tiro de revólver: estalo agudo, corpo de ruído que fecha, baque grave e um rabo de sala. */
export function tiro(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  chiado(ctx, out, t, 'highpass', 1800, 0.7, 0.26, 0.001, 0.05)
  desce(chiado(ctx, out, t, 'lowpass', 3200, 0.9, 0.32, 0.002, 0.32).frequency, 3200, 260, t, 0.3)
  desce(tom(ctx, out, 'sine', 150, t, 0.36, 0.002, 0.2).frequency, 150, 42, t, 0.16)
  chiado(ctx, out, t + 0.02, 'bandpass', 700, 0.6, 0.06, 0.03, 0.55)
}

/** Acerto na madeira: "toc" seco, um pouco depois do tiro. */
export function madeira(ctx: BaseAudioContext, out: AudioNode, t0: number): void {
  const t = t0 + 0.025
  desce(tom(ctx, out, 'sine', 620, t, 0.32, 0.002, 0.1).frequency, 620, 280, t, 0.08)
  tom(ctx, out, 'triangle', 1240, t, 0.1, 0.001, 0.04)
  chiado(ctx, out, t, 'bandpass', 1500, 3, 0.3, 0.001, 0.035)
}

/** Garrafa: estilhaço de ruído agudo e quatro tilintares. */
export function vidro(ctx: BaseAudioContext, out: AudioNode, t0: number): void {
  const t = t0 + 0.02
  chiado(ctx, out, t, 'highpass', 3000, 0.7, 0.3, 0.001, 0.12)
  ;[2900, 3700, 4600, 5300].forEach((f, i) => tom(ctx, out, 'sine', f, t + 0.02 + i * 0.035, 0.07, 0.002, 0.18))
}

/** Moeda: dois sinos claros, a segunda nota mais longa. */
export function moeda(ctx: BaseAudioContext, out: AudioNode, t0: number): void {
  const t = t0 + 0.02
  tom(ctx, out, 'sine', 1976, t, 0.2, 0.002, 0.28)
  tom(ctx, out, 'sine', 2637, t + 0.07, 0.2, 0.002, 0.45)
  tom(ctx, out, 'triangle', 3951, t + 0.07, 0.04, 0.002, 0.3)
}

/** Ricochete do erro: assobio que cai com um tremido. */
export function ricochete(ctx: BaseAudioContext, out: AudioNode, t0: number): void {
  const t = t0 + 0.03
  const o = tom(ctx, out, 'sine', 2800, t, 0.12, 0.01, 0.32)
  const lfo = osc(ctx, 'sine', 31)
  // Profundidade do tremido em Hz, ligada à frequência do tom: não é ganho de saída, por isso não nasce em 0.
  const prof = ctx.createGain()
  desce(o.frequency, 2800, 1000, t, 0.3)
  prof.gain.value = 60
  lfo.connect(prof).connect(o.frequency)
  lfo.start(t)
  lfo.stop(t + 0.36)
}

/** Clique seco do cão batendo na câmara vazia; `v` é a força (o travado da recarga sai a 0,5). */
export function seco(ctx: BaseAudioContext, out: AudioNode, t: number, v = 1): void {
  chiado(ctx, out, t, 'bandpass', 4200, 6, 0.55 * v, 0.001, 0.014)
  tom(ctx, out, 'square', 2200, t, 0.04 * v, 0.001, 0.016, 5000)
}

/** Engatilhar: dois estalos metálicos. */
export function engatilhar(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  chiado(ctx, out, t, 'bandpass', 3000, 5, 0.4, 0.001, 0.015)
  chiado(ctx, out, t + 0.08, 'bandpass', 2200, 4, 0.5, 0.001, 0.02)
  tom(ctx, out, 'sine', 900, t + 0.08, 0.05, 0.001, 0.03)
}

/** Tambor girando na recarga: zunido baixo e uma catraca de 12 dentes (passo de até 0,1 s, para soar como giro e não como estalos soltos). */
export function tambor(ctx: BaseAudioContext, out: AudioNode, t: number, dura = 1): void {
  chiado(ctx, out, t, 'lowpass', 700, 0.7, 0.05, 0.05, dura * 0.85)
  const p = Math.min(0.1, (dura * 0.6) / DENTES_DO_TAMBOR)
  for (let i = 0; i < DENTES_DO_TAMBOR; i++) chiado(ctx, out, t + 0.06 + i * p, 'bandpass', 3600, 6, 0.32, 0.001, 0.012)
}

/** Alvo proibido: zumbido dissonante que desce. */
export function proibido(ctx: BaseAudioContext, out: AudioNode, t0: number): void {
  const t = t0 + 0.03
  tom(ctx, out, 'square', 196, t, 0.1, 0.004, 0.34, 1400)
  tom(ctx, out, 'square', 208, t, 0.1, 0.004, 0.34, 1400)
  desce(tom(ctx, out, 'triangle', 330, t, 0.16, 0.004, 0.32).frequency, 330, 160, t, 0.3)
}

/** Parciais do sino: [múltiplo da fundamental, pico, queda]. */
const PARCIAIS_DO_SINO: readonly (readonly [number, number, number])[] = [[1, 0.16, 1.6], [2, 0.07, 1], [2.76, 0.055, 0.7], [4.07, 0.028, 0.4], [5.4, 0.02, 0.25]]

/** Sino do fim: duas batidas com parciais de sino. */
export function sino(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  for (const d of [0, 0.32]) for (const [k, a, q] of PARCIAIS_DO_SINO) tom(ctx, out, 'sine', 740 * k, t + d, a, 0.002, q)
}

/** A valsa do realejo: [nota MIDI, batidas]. */
const MELODIA_DO_REALEJO: readonly (readonly [number, number])[] = [[67, 1], [72, 1], [76, 1], [79, 2], [77, 1], [76, 1], [74, 1], [76, 2], [72, 1], [67, 1], [72, 3]]

/** Realejo de feira: valsa curta e baixa (oom-pa-pa), timbre de tubo. */
export function realejo(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const b = 0.17
  let k = 0
  for (const [m, d] of MELODIA_DO_REALEJO) {
    const ti = t + k * b
    const du = d * b * 0.92
    tom(ctx, out, 'square', mtof(m), ti, 0.035, 0.012, du, 1600)
    tom(ctx, out, 'triangle', mtof(m) * 1.0035, ti, 0.04, 0.012, du)
    k += d
  }
  for (let c = 0; c < Math.ceil(k / 3); c++) {
    const ti = t + c * 3 * b
    const raiz = c % 2 ? 43 : 48
    tom(ctx, out, 'triangle', mtof(raiz), ti, 0.07, 0.01, b * 0.9)
    for (const j of [1, 2]) {
      tom(ctx, out, 'triangle', mtof(raiz + 16), ti + j * b, 0.03, 0.01, b * 0.6)
      tom(ctx, out, 'triangle', mtof(raiz + 19), ti + j * b, 0.03, 0.01, b * 0.6)
    }
  }
}

/** Um som do tiro; `v` é a força (seco) ou a duração (tambor), ignorado nos outros. */
export type SomDoTiro = (ctx: BaseAudioContext, out: AudioNode, t: number, v?: number) => void
export type NomeDoSom = 'tiro' | 'madeira' | 'vidro' | 'moeda' | 'ricochete' | 'seco' | 'engatilhar' | 'tambor' | 'proibido' | 'sino' | 'realejo'

export const SONS: Readonly<Record<NomeDoSom, SomDoTiro>> = { tiro, madeira, vidro, moeda, ricochete, seco, engatilhar, tambor, proibido, sino, realejo }
