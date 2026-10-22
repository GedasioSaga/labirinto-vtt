/**
 * SOM das 5 animações novas, sintetizado por WebAudio (sem arquivo). Funciona em
 * qualquer BaseAudioContext: o botão Ouvir usa um AudioContext; as provas, um
 * OfflineAudioContext com o MESMO código (o .wav entregue é este som).
 *
 * Cada evento sonoro cai num ponto do DESENHO (por exemplo, "a folha encosta na
 * parede" = progresso 0,78 da Dupla), convertido em tempo pela curva da própria
 * animação, no sentido em que ela anda. Mudou a curva ou o tempo, o som acompanha.
 *
 * Volume baixo de propósito: porta é som de interface, ouvido dezenas de vezes por
 * sessão. A meta (provas/metas.json) é -36 a -26 LUFS, uns 10 LU abaixo das
 * transições de cena aprovadas (-18,6 LUFS), e pico verdadeiro até -12 dBTP.
 */
import { criarCurvaBezier, type CurvaBezier } from '../proposta/curvaBezier'

export type IdDoSom = 'dupla' | 'grade' | 'arrombada' | 'sanfona' | 'cortina'
export const IDS_COM_SOM: readonly IdDoSom[] = ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina']

export function temSom(id: string | null): id is IdDoSom {
  return id !== null && (IDS_COM_SOM as readonly string[]).includes(id)
}

/** O que o som precisa saber da animação: tempo e curva de cada sentido. */
export interface TempoDaAnimacao {
  duracaoMs: number
  duracaoFecharMs?: number
  curvaAbrir?: CurvaBezier
  curvaFechar?: CurvaBezier
}

/** Cauda máxima depois do fim da animação (meta: até 250 ms). */
export const CAUDA_S = 0.22
const RUIDO_S = 2

interface Cena {
  ctx: BaseAudioContext
  saida: AudioNode
  ruido: AudioBuffer
  sorte: () => number
  /** Fontes criadas, para poder parar (inverter no meio corta o som com uma rampa curta). */
  fontes: AudioScheduledSourceNode[]
}

function sorteador(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>()

/** Ruído branco de 2 s, sempre o mesmo (semente fixa): o som sai idêntico a cada vez. */
function ruidoDe(ctx: BaseAudioContext): AudioBuffer {
  const pronto = ruidos.get(ctx)
  if (pronto !== undefined) return pronto
  const buffer = ctx.createBuffer(1, Math.round(RUIDO_S * ctx.sampleRate), ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  const sorte = sorteador(1337)
  for (let i = 0; i < dados.length; i += 1) dados[i] = sorte() * 2 - 1
  ruidos.set(ctx, buffer)
  return buffer
}

/** Envoltória: sobe em `ataque` s, cai exponencial e termina EXATAMENTE em zero (sem corte nem estalo). */
function envoltoria(ganho: number, dur: number, ataque: number): Float32Array {
  const n = 96
  const curva = new Float32Array(n)
  const tau = Math.max(0.004, (dur - ataque) / 3.2)
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * dur
    const subida = x < ataque ? x / ataque : Math.exp(-(x - ataque) / tau)
    const fim = i / (n - 1) > 0.8 ? Math.cos(((i / (n - 1) - 0.8) / 0.2) * (Math.PI / 2)) : 1
    curva[i] = ganho * subida * fim
  }
  curva[0] = 0
  curva[n - 1] = 0
  return curva
}

interface Rajada {
  dur: number
  tipo: BiquadFilterType
  freq: number
  freqFim?: number
  q?: number
  ganho: number
  ataque?: number
}

/** Ruído filtrado com envoltória: estalo, raspado, sopro, corrente. */
function rajada(c: Cena, t: number, o: Rajada): void {
  const fonte = c.ctx.createBufferSource()
  fonte.buffer = c.ruido
  const filtro = c.ctx.createBiquadFilter()
  filtro.type = o.tipo
  filtro.frequency.setValueAtTime(o.freq, t)
  if (o.freqFim !== undefined) filtro.frequency.exponentialRampToValueAtTime(o.freqFim, t + o.dur)
  filtro.Q.setValueAtTime(o.q ?? 0.707, t)
  const env = c.ctx.createGain()
  env.gain.value = 0
  env.gain.setValueCurveAtTime(envoltoria(o.ganho, o.dur, o.ataque ?? 0.002), t, o.dur)
  fonte.connect(filtro).connect(env).connect(c.saida)
  const desvio = c.sorte() * (RUIDO_S - o.dur - 0.05)
  fonte.start(t, Math.max(0, desvio), o.dur + 0.01)
  c.fontes.push(fonte)
}

interface Tom {
  dur: number
  freq: number
  freqFim?: number
  tipo?: OscillatorType
  ganho: number
  ataque?: number
}

/** Tom curto com queda de altura: baque, batida de madeira, anel de metal. */
function tom(c: Cena, t: number, o: Tom): void {
  const osc = c.ctx.createOscillator()
  osc.type = o.tipo ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t)
  if (o.freqFim !== undefined) osc.frequency.exponentialRampToValueAtTime(o.freqFim, t + o.dur)
  const env = c.ctx.createGain()
  env.gain.value = 0
  env.gain.setValueCurveAtTime(envoltoria(o.ganho, o.dur, o.ataque ?? 0.003), t, o.dur)
  osc.connect(env).connect(c.saida)
  osc.start(t)
  osc.stop(t + o.dur + 0.01)
  c.fontes.push(osc)
}

/** Fração do tempo em que o progresso chega a `s`, no sentido pedido (a curva é monotônica: bisseção). */
function quandoChega(tempo: TempoDaAnimacao, abrindo: boolean, s: number): number {
  const curva = abrindo ? tempo.curvaAbrir : tempo.curvaFechar
  const f = curva === undefined ? (x: number) => 1 - (1 - x) ** 3 : criarCurvaBezier(curva)
  const alvo = abrindo ? s : 1 - s
  let baixo = 0
  let alto = 1
  for (let i = 0; i < 40; i += 1) {
    const meio = (baixo + alto) / 2
    if (f(meio) < alvo) baixo = meio
    else alto = meio
  }
  return (baixo + alto) / 2
}

export function duracaoDoSentidoS(tempo: TempoDaAnimacao, abrindo: boolean): number {
  return (abrindo ? tempo.duracaoMs : (tempo.duracaoFecharMs ?? tempo.duracaoMs)) / 1000
}

/** Proporção entre os eventos de cada som (a mistura). O volume final vem de GANHO_FINAL_DB. */
const GANHO: Record<IdDoSom, number> = { dupla: 1, grade: 1, arrombada: 1, sanfona: 1, cortina: 1 }

/**
 * Ganho depois do compressor, em dB, por som: calibrado pela medida das provas
 * (provas/testes.json) para cair perto de -32 LUFS, no meio da meta de -36 a -26.
 */
const GANHO_FINAL_DB: Record<IdDoSom, { abrir: number; fechar: number }> = {
  dupla: { abrir: -1.2, fechar: -1.7 },
  grade: { abrir: 2.5, fechar: -4 },
  arrombada: { abrir: -2, fechar: -4 },
  sanfona: { abrir: 3.1, fechar: 3.3 },
  cortina: { abrir: 8.4, fechar: 7 },
}

/**
 * Compressor suave na saída: segura o estalo e o baque (que dão o pico) sem
 * mexer no corpo do som, para o volume subir sem passar de -12 dBTP. O mesmo no
 * botão Ouvir e no render das provas.
 */
function compressor(ctx: BaseAudioContext): DynamicsCompressorNode {
  const c = ctx.createDynamicsCompressor()
  c.threshold.value = -30
  c.knee.value = 6
  c.ratio.value = 6
  c.attack.value = 0.001
  c.release.value = 0.06
  return c
}

function compor(c: Cena, id: IdDoSom, abrindo: boolean, t0: number, tempo: TempoDaAnimacao): void {
  const dur = duracaoDoSentidoS(tempo, abrindo)
  /** Tempo absoluto em que o desenho chega ao progresso `s`. */
  const em = (s: number): number => t0 + quandoChega(tempo, abrindo, s) * dur
  const g = GANHO[id]
  switch (id) {
    case 'dupla':
      if (abrindo) {
        rajada(c, t0, { dur: 0.03, tipo: 'highpass', freq: 2600, ganho: 0.1 * g, ataque: 0.0015 })
        rajada(c, t0 + 0.01, { dur: Math.max(0.12, em(0.78) - t0), tipo: 'lowpass', freq: 500, freqFim: 1300, ganho: 0.05 * g, ataque: 0.05 })
        tom(c, em(0.78), { dur: 0.08, freq: 190, freqFim: 130, ganho: 0.06 * g })
        rajada(c, em(0.78), { dur: 0.05, tipo: 'bandpass', freq: 750, q: 2, ganho: 0.04 * g })
      } else {
        rajada(c, t0, { dur: Math.max(0.1, em(0.04) - t0), tipo: 'lowpass', freq: 1300, freqFim: 500, ganho: 0.045 * g, ataque: 0.03 })
        tom(c, em(0.02), { dur: 0.09, freq: 165, freqFim: 112, ganho: 0.08 * g })
        rajada(c, em(0.02), { dur: 0.05, tipo: 'bandpass', freq: 900, q: 3, ganho: 0.06 * g })
        rajada(c, em(0.02) + 0.014, { dur: 0.025, tipo: 'highpass', freq: 2600, ganho: 0.07 * g, ataque: 0.0015 })
      }
      return
    case 'grade':
      if (abrindo) {
        tom(c, t0, { dur: 0.18, freq: 96, freqFim: 70, tipo: 'triangle', ganho: 0.07 * g })
        rajada(c, t0, { dur: 0.08, tipo: 'lowpass', freq: 420, ganho: 0.06 * g })
        for (let i = 0; i < 9; i += 1) {
          const s = 0.18 + (0.26 * i) / 8
          rajada(c, em(s) + c.sorte() * 0.008, { dur: 0.018, tipo: 'bandpass', freq: 2800 + 2000 * c.sorte(), q: 6, ganho: (0.025 + 0.02 * c.sorte()) * g, ataque: 0.001 })
        }
        for (let i = 0; i < 6; i += 1) {
          const s = 0.46 + (0.4 * i) / 5
          rajada(c, em(s), { dur: 0.016, tipo: 'bandpass', freq: 3200 + 1600 * c.sorte(), q: 6, ganho: (0.012 + 0.012 * c.sorte()) * g, ataque: 0.001 })
        }
        rajada(c, em(0.4), { dur: Math.max(0.12, em(0.95) - em(0.4)), tipo: 'lowpass', freq: 260, ganho: 0.03 * g, ataque: 0.04 })
      } else {
        for (let i = 0; i < 6; i += 1) {
          const s = 0.92 - (0.48 * i) / 5
          rajada(c, em(s), { dur: 0.016, tipo: 'bandpass', freq: 3000 + 1800 * c.sorte(), q: 6, ganho: (0.015 + 0.012 * c.sorte()) * g, ataque: 0.001 })
        }
        // A grade bate no chão quando as barras terminam de descer (p = 0,42) e o tranco começa.
        tom(c, em(0.42), { dur: 0.22, freq: 82, freqFim: 56, tipo: 'triangle', ganho: 0.09 * g })
        rajada(c, em(0.42), { dur: 0.12, tipo: 'bandpass', freq: 1800, q: 4, ganho: 0.035 * g })
        tom(c, em(0.42) + 0.005, { dur: 0.2, freq: 1250, ganho: 0.008 * g })
        for (let i = 0; i < 3; i += 1) rajada(c, em(0.36 - 0.08 * i), { dur: 0.016, tipo: 'bandpass', freq: 3600, q: 7, ganho: (0.02 - 0.005 * i) * g, ataque: 0.001 })
      }
      return
    case 'arrombada':
      if (abrindo) {
        tom(c, t0, { dur: 0.16, freq: 74, freqFim: 44, ganho: 0.16 * g, ataque: 0.002 })
        rajada(c, t0, { dur: 0.09, tipo: 'lowpass', freq: 340, ganho: 0.12 * g })
        for (const s of [0.15, 0.21, 0.28]) {
          tom(c, em(s), { dur: 0.045, freq: 210, freqFim: 160, ganho: 0.04 * g })
          rajada(c, em(s), { dur: 0.025, tipo: 'bandpass', freq: 1200, q: 3, ganho: 0.03 * g })
        }
        rajada(c, em(0.34), { dur: 0.07, tipo: 'bandpass', freq: 2200, q: 1.5, ganho: 0.07 * g, ataque: 0.0015 })
        for (let i = 0; i < 5; i += 1) {
          const s = 0.36 + 0.05 * i + 0.02 * c.sorte()
          rajada(c, em(s), { dur: 0.012, tipo: 'bandpass', freq: 3500 + 2500 * c.sorte(), q: 8, ganho: (0.015 + 0.015 * c.sorte()) * g, ataque: 0.001 })
        }
        rajada(c, em(0.34), { dur: Math.max(0.12, em(0.8) - em(0.34)), tipo: 'lowpass', freq: 600, freqFim: 900, ganho: 0.035 * g, ataque: 0.03 })
        tom(c, em(0.86), { dur: 0.05, freq: 150, freqFim: 110, ganho: 0.04 * g })
      } else {
        rajada(c, t0, { dur: Math.max(0.1, em(0.34) - t0), tipo: 'lowpass', freq: 900, freqFim: 500, ganho: 0.035 * g, ataque: 0.02 })
        tom(c, em(0.3), { dur: 0.12, freq: 90, freqFim: 55, ganho: 0.11 * g })
        rajada(c, em(0.3), { dur: 0.06, tipo: 'lowpass', freq: 380, ganho: 0.07 * g })
        tom(c, em(0.22), { dur: 0.04, freq: 205, freqFim: 160, ganho: 0.03 * g })
        tom(c, em(0.12), { dur: 0.04, freq: 205, freqFim: 160, ganho: 0.02 * g })
      }
      return
    case 'sanfona': {
      const dobras = abrindo ? [0.06, 0.2, 0.36] : [0.36, 0.2, 0.06]
      rajada(c, t0, { dur: Math.max(0.15, em(abrindo ? 0.7 : 0.05) - t0), tipo: 'bandpass', freq: 1100, q: 0.8, ganho: 0.02 * g, ataque: 0.04 })
      dobras.forEach((s, i) => {
        rajada(c, em(s), { dur: 0.014, tipo: 'bandpass', freq: 1500 + 180 * i, q: 9, ganho: 0.05 * g, ataque: 0.001 })
        tom(c, em(s), { dur: 0.03, freq: 900 + 90 * i, ganho: 0.012 * g })
      })
      tom(c, em(abrindo ? 0.95 : 0.01), { dur: 0.045, freq: 220, freqFim: 170, ganho: 0.035 * g })
      return
    }
    case 'cortina': {
      const contas = 22
      for (let i = 0; i < contas; i += 1) {
        // Mais batidas no começo do movimento, quando as contas correm mais.
        const u = (i / contas) ** 1.6
        const s = abrindo ? 0.06 + 0.68 * u : 0.74 - 0.68 * u
        rajada(c, em(s) + c.sorte() * 0.01, { dur: 0.008 + 0.007 * c.sorte(), tipo: 'bandpass', freq: 4500 + 3000 * c.sorte(), q: 10, ganho: (0.01 + 0.02 * c.sorte()) * g, ataque: 0.001 })
      }
      rajada(c, t0, { dur: Math.max(0.15, em(abrindo ? 0.7 : 0.06) - t0), tipo: 'highpass', freq: 3000, ganho: 0.01 * g, ataque: 0.05 })
      if (!abrindo) tom(c, em(0.05), { dur: 0.04, freq: 520, freqFim: 420, ganho: 0.012 * g })
      return
    }
  }
}

/** Duração total do som de um sentido (animação + cauda), para o render offline. */
export function duracaoDoSomS(tempo: TempoDaAnimacao, abrindo: boolean): number {
  return duracaoDoSentidoS(tempo, abrindo) + CAUDA_S
}

export interface SomTocando {
  parar: () => void
}

/**
 * Agenda o som em `ctx` a partir de `quando` (s), ligado em `saida`. Semente fixa
 * por animação e sentido: o mesmo som a cada vez (e o .wav das provas é ele).
 */
export function agendarSom(ctx: BaseAudioContext, saida: AudioNode, id: IdDoSom, abrindo: boolean, quando: number, tempo: TempoDaAnimacao): SomTocando {
  const local = ctx.createGain()
  local.gain.setValueAtTime(1, 0)
  const final = ctx.createGain()
  final.gain.value = 10 ** (GANHO_FINAL_DB[id][abrindo ? 'abrir' : 'fechar'] / 20)
  local.connect(compressor(ctx)).connect(final).connect(saida)
  const semente = IDS_COM_SOM.indexOf(id) * 97 + (abrindo ? 1 : 2)
  const cena: Cena = { ctx, saida: local, ruido: ruidoDe(ctx), sorte: sorteador(semente), fontes: [] }
  compor(cena, id, abrindo, quando, tempo)
  let parado = false
  return {
    parar: () => {
      if (parado) return
      parado = true
      // Rampa de 25 ms até zero antes de soltar: parar seco estalaria.
      const agora = ctx.currentTime
      local.gain.cancelScheduledValues(agora)
      local.gain.setValueAtTime(local.gain.value, agora)
      local.gain.linearRampToValueAtTime(0, agora + 0.025)
      for (const fonte of cena.fontes) {
        try {
          fonte.stop(agora + 0.03)
        } catch {
          // fonte que ainda não começou ou já parou: nada a fazer
        }
      }
    },
  }
}
