/**
 * SOM DA PESCA: lance, splash, beliscada, fisgada, catraca, pegou, escapou e
 * baú, sintetizados em WebAudio. Porte fiel do bloco SOM do protótipo
 * aprovado; todo nó recebe o contexto e o destino por parâmetro.
 */

/** Ganho do barramento de efeitos da pesca (os sons saem baixos; o mestre fica em 1). */
export const GANHO = 1.7

const QUASE_ZERO = 0.0001
const SEMENTE_DO_RUIDO = 0x2545f491
/** Passo pelo buffer de ruído: cada ataque lê um trecho diferente, até 0,7 s. */
const PASSO_NO_RUIDO = 0.173
const TRECHO_DO_RUIDO = 0.7

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

/** Ganho que nasce em 0 (o padrão do GainNode é 1 e deixava passar 1 amostra cheia antes do envelope). */
export function vca(ctx: BaseAudioContext): GainNode {
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

/** Zunido da linha: ruído em passa-banda que sobe e desce, com um assobio fino por baixo. */
export function lance(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const n = fonteRuido(ctx, t, 0.62)
  const f = filtro(ctx, 'bandpass', 1200, 4)
  const g = vca(ctx)
  f.frequency.setValueAtTime(1200, t)
  f.frequency.exponentialRampToValueAtTime(5200, t + 0.18)
  f.frequency.exponentialRampToValueAtTime(1500, t + 0.56)
  envelope(g.gain, t, 0.9, 0.06, 0.5)
  n.connect(f).connect(g).connect(out)
  const o = tom(ctx, out, 'sine', 900, t, 0.07, 0.05, 0.5)
  o.frequency.setValueAtTime(900, t)
  o.frequency.exponentialRampToValueAtTime(1900, t + 0.2)
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.55)
}

/** Boia caindo: chuá de ruído que fecha o filtro e um "bloop" grave. */
export function splash(ctx: BaseAudioContext, out: AudioNode, t: number, forca = 1): void {
  const n = fonteRuido(ctx, t, 0.5)
  const f = filtro(ctx, 'lowpass', 2600, 0.8)
  const g = vca(ctx)
  f.frequency.setValueAtTime(2600, t)
  f.frequency.exponentialRampToValueAtTime(380, t + 0.4)
  envelope(g.gain, t, 0.45 * forca, 0.004, 0.42)
  n.connect(f).connect(g).connect(out)
  const o = tom(ctx, out, 'sine', 340, t + 0.01, 0.3 * forca, 0.005, 0.15)
  o.frequency.setValueAtTime(340, t + 0.01)
  o.frequency.exponentialRampToValueAtTime(110, t + 0.15)
}

/** Beliscada: plic curto e baixo, para dar a falsa esperança. */
export function beliscada(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = tom(ctx, out, 'sine', 720, t, 0.2, 0.003, 0.07)
  o.frequency.setValueAtTime(720, t)
  o.frequency.exponentialRampToValueAtTime(420, t + 0.07)
}

/** "!" da fisgada: dois bipes quadrados subindo. */
export function fisgada(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  tom(ctx, out, 'square', 988, t, 0.28, 0.003, 0.1, 3800)
  tom(ctx, out, 'square', 1480, t + 0.07, 0.28, 0.003, 0.12, 3800)
}

/** Um dente da catraca do molinete; o jogo toca um por trecho de barra subido. */
export function catraca(ctx: BaseAudioContext, out: AudioNode, t: number, v = 1): void {
  const n = fonteRuido(ctx, t, 0.03)
  const f = filtro(ctx, 'bandpass', 3400, 5)
  const g = vca(ctx)
  envelope(g.gain, t, 1.4 * v, 0.001, 0.02)
  n.connect(f).connect(g).connect(out)
}

/** Pegou: arpejo curto em triângulo com a oitava de baixo em quadrada. */
export function pegou(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  ;[72, 76, 79, 84].forEach((m, i) => {
    const d = i * 0.075
    const dur = i === 3 ? 0.42 : 0.1
    tom(ctx, out, 'triangle', mtof(m), t + d, 0.34, 0.006, dur)
    tom(ctx, out, 'square', mtof(m - 12), t + d, 0.06, 0.006, dur, 2000)
  })
}

/** Escapou: tom que despenca com vibrato e a linha frouxa. */
export function escapou(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = tom(ctx, out, 'triangle', 520, t, 0.34, 0.01, 0.52)
  const lfo = osc(ctx, 'sine', 9)
  // Profundidade do vibrato em Hz, ligada à frequência do tom: não é ganho de saída, por isso não nasce em 0.
  const prof = ctx.createGain()
  o.frequency.setValueAtTime(520, t)
  o.frequency.exponentialRampToValueAtTime(190, t + 0.5)
  prof.gain.value = 18
  lfo.connect(prof).connect(o.frequency)
  lfo.start(t)
  lfo.stop(t + 0.6)
  const s = tom(ctx, out, 'sawtooth', 150, t, 0.14, 0.004, 0.3, 700)
  s.frequency.setValueAtTime(150, t)
  s.frequency.exponentialRampToValueAtTime(90, t + 0.3)
}

/** Baú: quatro sinos subindo. */
export function bau(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  ;[1568, 2093, 2637, 3136].forEach((f, i) => tom(ctx, out, 'sine', f, t + i * 0.06, 0.16, 0.004, 0.5))
}

/** Um som da pesca; `v` é a força (splash) ou a intensidade (catraca), ignorado nos outros. */
export type SomDaPesca = (ctx: BaseAudioContext, out: AudioNode, t: number, v?: number) => void
export type NomeDoSom = 'lance' | 'splash' | 'beliscada' | 'fisgada' | 'catraca' | 'pegou' | 'escapou' | 'bau'

export const SONS: Readonly<Record<NomeDoSom, SomDaPesca>> = { lance, splash, beliscada, fisgada, catraca, pegou, escapou, bau }

/** [som, instante em s, v opcional]. */
export type EventoDaSequencia = readonly [NomeDoSom, number, number?]

/** Linha do tempo das provas: um ciclo inteiro com todos os sons. */
function montarSequencia(): EventoDaSequencia[] {
  const seq: EventoDaSequencia[] = [['lance', 0.1], ['splash', 0.75, 0.9], ['beliscada', 1.5], ['fisgada', 2.2]]
  for (let k = 0; k < 18; k++) seq.push(['catraca', 2.6 + k * 0.055, 0.7 + (k % 3) * 0.1])
  seq.push(['bau', 3.8], ['pegou', 4.5], ['escapou', 5.6])
  return seq
}
export const SEQ: readonly EventoDaSequencia[] = montarSequencia()
export const DURACAO_SEQ = 6.4

export function sequencia(ctx: BaseAudioContext, out: AudioNode, t0: number): void {
  for (const [nome, t, v] of SEQ) SONS[nome](ctx, out, t0 + t, v)
}
