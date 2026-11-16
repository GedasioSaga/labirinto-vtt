/**
 * PEÇAS DE SÍNTESE DOS JOGOS DE ABRIR: ruído, envelope, filtro, oscilador e
 * ganho que nasce em zero, iguais aos da pesca do app (client/src/minigames/
 * pesca/som.ts). Todo nó recebe o contexto e o destino por parâmetro, para o
 * mesmo código tocar ao vivo e renderizar offline nas provas.
 */

export const QUASE_ZERO = 0.0001
const SEMENTE_DO_RUIDO = 0x2545f491
/** Passo pelo buffer de ruído: cada ataque lê um trecho diferente, até 0,7 s. */
const PASSO_NO_RUIDO = 0.173
const TRECHO_DO_RUIDO = 0.7

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>()
let giro = 0

/**
 * Volta o giro do ruído ao começo. Ao vivo o giro segue (cada ataque lê um
 * trecho diferente); nas provas cada renderização começa do zero, para a
 * medida de um som não depender de quantos sons foram renderizados antes
 * (dava ~1 dB de diferença no pico, 15/11/2026).
 */
export function reiniciarRuido(): void {
  giro = 0
}

/** 1 s de ruído branco determinístico (xorshift), um por contexto. */
export function ruido(ctx: BaseAudioContext): AudioBuffer {
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

/** Ataque e queda exponenciais, de quase zero a `pico` e de volta. */
export function envelope(p: AudioParam, t: number, pico: number, ataque: number, queda: number): void {
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(pico, t + ataque)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + ataque + queda)
}

/** Fonte de ruído que começa em `t` e dura `dur` s. */
export function fonteRuido(ctx: BaseAudioContext, t: number, dur: number): AudioBufferSourceNode {
  const n = ctx.createBufferSource()
  n.buffer = ruido(ctx)
  n.loop = true
  giro = (giro + PASSO_NO_RUIDO) % TRECHO_DO_RUIDO
  n.start(t, giro)
  n.stop(t + dur)
  return n
}

export function filtro(ctx: BaseAudioContext, tipo: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ctx.createBiquadFilter()
  b.type = tipo
  b.frequency.value = f
  b.Q.value = q
  return b
}

export function osc(ctx: BaseAudioContext, tipo: OscillatorType, f: number): OscillatorNode {
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

/** Um tom com envelope, opcionalmente passando por um passa-baixa. Devolve o oscilador. */
export function tom(
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

/** Rajada de ruído filtrado com envelope (batida, estalo, chiado). Devolve o filtro. */
export function rajada(
  ctx: BaseAudioContext, out: AudioNode, tipo: BiquadFilterType, f: number, q: number,
  t: number, pico: number, ataque: number, queda: number,
): BiquadFilterNode {
  const n = fonteRuido(ctx, t, ataque + queda + 0.03)
  const fi = filtro(ctx, tipo, f, q)
  const g = vca(ctx)
  envelope(g.gain, t, pico, ataque, queda)
  n.connect(fi).connect(g).connect(out)
  return fi
}
