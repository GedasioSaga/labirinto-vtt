import type { BufferDeSom, ContextoDeSom, ParametroDeSom } from '../lib/sons/contexto'
import { criarCurvaBezier, type CurvaBezier } from './curvaBezier'

/**
 * SOM DAS CINCO ANIMAÇÕES DO PACOTE (22/10/2026): Dupla, Grade que sobe,
 * Arrombada, Sanfona e Cortina de contas, sintetizados na hora (Web Audio, sem
 * arquivo). A síntese é a do protótipo aprovado (`docs/design/porta-animacoes/
 * prototipo/som.ts`), no molde de `somDePorta.ts`: recebe o contexto, o destino
 * e o instante, então o MESMO código toca no app e nas provas (um
 * `OfflineAudioContext`, de onde sai o `.wav` entregue).
 *
 * Cada evento sonoro cai num ponto do DESENHO (o baque da grade em 0,42, a
 * folha da dupla que encosta em 0,78), convertido em tempo pela curva do
 * sentido. O caminho pode ser só um pedaço (inverteu no meio, `de`): o que já
 * passou não toca.
 *
 * Volume baixo de propósito, perto de -32 LUFS no volume máximo da mesa: porta
 * é som de interface, ouvido dezenas de vezes por sessão. Movimento reduzido
 * deixa tudo mudo (`criarTocadorDePorta`).
 */
export const SONS_DO_PACOTE = ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina'] as const
export type SomDoPacote = (typeof SONS_DO_PACOTE)[number]

export function somDoPacote(valor: unknown): valor is SomDoPacote {
  return SONS_DO_PACOTE.some((som) => som === valor)
}

/** O caminho que a porta vai andar, como o animador o começou. */
export interface CaminhoDoSom {
  abrindo: boolean
  /** Duração do pedaço que vai andar, em s. */
  duracaoS: number
  /** De onde parte (0 = fechada, 1 = aberta): o meio do caminho, se inverteu. */
  de: number
  /** A curva do sentido; ausente = `easeOutCubic`. */
  curva?: CurvaBezier
}

/** Cauda máxima depois do fim da animação. */
const CAUDA_S = 0.22
const RUIDO_S = 2
const SEMENTE_DO_RUIDO = 1337
const PONTOS_DA_ENVOLTORIA = 96

/**
 * Ganho depois do compressor, em dB, por som e sentido: calibrado pelas provas
 * (`docs/design/porta-animacoes/app/provas/testes.json`) para cair perto de
 * -32 LUFS no volume máximo, com o passa-baixa da mesa (`lib/sons/contexto.ts`).
 * Os do protótipo deixavam a cortina a -37 LUFS e o baque da grade a -10 dBTP
 * no app (o abafador da mesa come os agudos da cortina): a cortina subiu 5,6 e
 * 4,3 dB, e o abrir da grade desceu 2,2 dB para o pico ficar abaixo de -12.
 */
export const GANHO_FINAL_DB: Record<SomDoPacote, { abrir: number; fechar: number }> = {
  dupla: { abrir: -1.2, fechar: -1.7 },
  grade: { abrir: 0.3, fechar: -4 },
  arrombada: { abrir: -2, fechar: -4 },
  sanfona: { abrir: 3.1, fechar: 3.3 },
  cortina: { abrir: 14, fechar: 11.3 },
}

/** Sorteio com semente (mulberry32): o mesmo som a cada toque, e o `.wav` da prova é o que toca. */
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

const ruidos = new WeakMap<object, BufferDeSom>()

function ruidoDe<N>(ctx: ContextoDeSom<N>): BufferDeSom {
  const pronto = ruidos.get(ctx)
  if (pronto !== undefined) return pronto
  const buffer = ctx.createBuffer(1, Math.round(RUIDO_S * ctx.sampleRate), ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  const sorte = sorteador(SEMENTE_DO_RUIDO)
  for (let i = 0; i < dados.length; i += 1) dados[i] = sorte() * 2 - 1
  ruidos.set(ctx, buffer)
  return buffer
}

/** Envoltória: sobe em `ataque` s, cai exponencial e termina EXATAMENTE em zero (sem corte nem estalo). */
function envoltoria(ganho: number, dur: number, ataque: number): Float32Array {
  const curva = new Float32Array(PONTOS_DA_ENVOLTORIA)
  const tau = Math.max(0.004, (dur - ataque) / 3.2)
  for (let i = 0; i < PONTOS_DA_ENVOLTORIA; i += 1) {
    const fracao = i / (PONTOS_DA_ENVOLTORIA - 1)
    const x = fracao * dur
    const subida = x < ataque ? x / ataque : Math.exp(-(x - ataque) / tau)
    const fim = fracao > 0.8 ? Math.cos(((fracao - 0.8) / 0.2) * (Math.PI / 2)) : 1
    curva[i] = ganho * subida * fim
  }
  curva[0] = 0
  curva[PONTOS_DA_ENVOLTORIA - 1] = 0
  return curva
}

interface Cena<N> {
  ctx: ContextoDeSom<N>
  saida: N
  sorte: () => number
}

function envelope<N>(c: Cena<N>, t: number, ganho: number, dur: number, ataque: number): N {
  const env = c.ctx.createGain()
  env.gain.setValueAtTime(0, Math.max(0, t - 0.002))
  env.gain.setValueCurveAtTime(envoltoria(ganho, dur, ataque), t, dur)
  env.connect(c.saida)
  return env
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
function rajada<N>(c: Cena<N>, t: number, o: Rajada): void {
  const fonte = c.ctx.createBufferSource()
  fonte.buffer = ruidoDe(c.ctx)
  const filtro = c.ctx.createBiquadFilter()
  filtro.type = o.tipo
  filtro.frequency.setValueAtTime(o.freq, t)
  if (o.freqFim !== undefined) filtro.frequency.exponentialRampToValueAtTime(o.freqFim, t + o.dur)
  filtro.Q.setValueAtTime(o.q ?? 0.707, t)
  fonte.connect(filtro)
  filtro.connect(envelope(c, t, o.ganho, o.dur, o.ataque ?? 0.002))
  fonte.start(t, Math.max(0, c.sorte() * (RUIDO_S - o.dur - 0.05)))
  fonte.stop(t + o.dur + 0.01)
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
function tom<N>(c: Cena<N>, t: number, o: Tom): void {
  const osc = c.ctx.createOscillator()
  osc.type = o.tipo ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t)
  if (o.freqFim !== undefined) osc.frequency.exponentialRampToValueAtTime(o.freqFim, t + o.dur)
  osc.connect(envelope(c, t, o.ganho, o.dur, o.ataque ?? 0.003))
  osc.start(t)
  osc.stop(t + o.dur + 0.01)
}

/**
 * Instante em que o desenho chega ao progresso `s`, ou `null` se `s` não está
 * neste caminho (já passou: a porta inverteu depois dele). A curva é
 * monotônica, então a bisseção acha o ponto.
 */
function quandoChega(caminho: CaminhoDoSom, t0: number, s: number): number | null {
  const para = caminho.abrindo ? 1 : 0
  const distancia = para - caminho.de
  if (distancia === 0) return null
  const alvo = (s - caminho.de) / distancia
  if (alvo < 0 || alvo > 1) return null
  const f = caminho.curva === undefined ? (x: number) => 1 - (1 - x) ** 3 : criarCurvaBezier(caminho.curva)
  let baixo = 0
  let alto = 1
  for (let i = 0; i < 40; i += 1) {
    const meio = (baixo + alto) / 2
    if (f(meio) < alvo) baixo = meio
    else alto = meio
  }
  return t0 + ((baixo + alto) / 2) * caminho.duracaoS
}

/** O que toca em cada som, no caminho dado. `em(s)` = instante do progresso `s`; `ate(s)` = o mesmo, ou o fim do caminho. */
function compor<N>(c: Cena<N>, som: SomDoPacote, caminho: CaminhoDoSom, t0: number): void {
  const { abrindo } = caminho
  const em = (s: number): number | null => quandoChega(caminho, t0, s)
  const ate = (s: number): number => em(s) ?? t0 + caminho.duracaoS
  const noPonto = (s: number, tocar: (t: number) => void): void => {
    const t = em(s)
    if (t !== null) tocar(t)
  }
  switch (som) {
    case 'dupla':
      if (abrindo) {
        rajada(c, t0, { dur: 0.03, tipo: 'highpass', freq: 2600, ganho: 0.1, ataque: 0.0015 })
        rajada(c, t0 + 0.01, { dur: Math.max(0.12, ate(0.78) - t0), tipo: 'lowpass', freq: 500, freqFim: 1300, ganho: 0.05, ataque: 0.05 })
        noPonto(0.78, (t) => {
          tom(c, t, { dur: 0.08, freq: 190, freqFim: 130, ganho: 0.06 })
          rajada(c, t, { dur: 0.05, tipo: 'bandpass', freq: 750, q: 2, ganho: 0.04 })
        })
      } else {
        rajada(c, t0, { dur: Math.max(0.1, ate(0.04) - t0), tipo: 'lowpass', freq: 1300, freqFim: 500, ganho: 0.045, ataque: 0.03 })
        noPonto(0.02, (t) => {
          tom(c, t, { dur: 0.09, freq: 165, freqFim: 112, ganho: 0.08 })
          rajada(c, t, { dur: 0.05, tipo: 'bandpass', freq: 900, q: 3, ganho: 0.06 })
          rajada(c, t + 0.014, { dur: 0.025, tipo: 'highpass', freq: 2600, ganho: 0.07, ataque: 0.0015 })
        })
      }
      return
    case 'grade':
      if (abrindo) {
        tom(c, t0, { dur: 0.18, freq: 96, freqFim: 70, tipo: 'triangle', ganho: 0.07 })
        rajada(c, t0, { dur: 0.08, tipo: 'lowpass', freq: 420, ganho: 0.06 })
        for (let i = 0; i < 9; i += 1) {
          const jitter = c.sorte() * 0.008
          const freq = 2800 + 2000 * c.sorte()
          const ganho = 0.025 + 0.02 * c.sorte()
          noPonto(0.18 + (0.26 * i) / 8, (t) => rajada(c, t + jitter, { dur: 0.018, tipo: 'bandpass', freq, q: 6, ganho, ataque: 0.001 }))
        }
        for (let i = 0; i < 6; i += 1) {
          const freq = 3200 + 1600 * c.sorte()
          const ganho = 0.012 + 0.012 * c.sorte()
          noPonto(0.46 + (0.4 * i) / 5, (t) => rajada(c, t, { dur: 0.016, tipo: 'bandpass', freq, q: 6, ganho, ataque: 0.001 }))
        }
        noPonto(0.4, (t) => rajada(c, t, { dur: Math.max(0.12, ate(0.95) - t), tipo: 'lowpass', freq: 260, ganho: 0.03, ataque: 0.04 }))
      } else {
        for (let i = 0; i < 6; i += 1) {
          const freq = 3000 + 1800 * c.sorte()
          const ganho = 0.015 + 0.012 * c.sorte()
          noPonto(0.92 - (0.48 * i) / 5, (t) => rajada(c, t, { dur: 0.016, tipo: 'bandpass', freq, q: 6, ganho, ataque: 0.001 }))
        }
        // A grade bate no chão quando as barras terminam de descer (p = 0,42) e o tranco começa.
        noPonto(0.42, (t) => {
          tom(c, t, { dur: 0.22, freq: 82, freqFim: 56, tipo: 'triangle', ganho: 0.09 })
          rajada(c, t, { dur: 0.12, tipo: 'bandpass', freq: 1800, q: 4, ganho: 0.035 })
          tom(c, t + 0.005, { dur: 0.2, freq: 1250, ganho: 0.008 })
        })
        for (let i = 0; i < 3; i += 1) noPonto(0.36 - 0.08 * i, (t) => rajada(c, t, { dur: 0.016, tipo: 'bandpass', freq: 3600, q: 7, ganho: 0.02 - 0.005 * i, ataque: 0.001 }))
      }
      return
    case 'arrombada':
      if (abrindo) {
        tom(c, t0, { dur: 0.16, freq: 74, freqFim: 44, ganho: 0.16, ataque: 0.002 })
        rajada(c, t0, { dur: 0.09, tipo: 'lowpass', freq: 340, ganho: 0.12 })
        for (const s of [0.15, 0.21, 0.28]) {
          noPonto(s, (t) => {
            tom(c, t, { dur: 0.045, freq: 210, freqFim: 160, ganho: 0.04 })
            rajada(c, t, { dur: 0.025, tipo: 'bandpass', freq: 1200, q: 3, ganho: 0.03 })
          })
        }
        noPonto(0.34, (t) => rajada(c, t, { dur: 0.07, tipo: 'bandpass', freq: 2200, q: 1.5, ganho: 0.07, ataque: 0.0015 }))
        for (let i = 0; i < 5; i += 1) {
          const s = 0.36 + 0.05 * i + 0.02 * c.sorte()
          const freq = 3500 + 2500 * c.sorte()
          const ganho = 0.015 + 0.015 * c.sorte()
          noPonto(s, (t) => rajada(c, t, { dur: 0.012, tipo: 'bandpass', freq, q: 8, ganho, ataque: 0.001 }))
        }
        noPonto(0.34, (t) => rajada(c, t, { dur: Math.max(0.12, ate(0.8) - t), tipo: 'lowpass', freq: 600, freqFim: 900, ganho: 0.035, ataque: 0.03 }))
        noPonto(0.86, (t) => tom(c, t, { dur: 0.05, freq: 150, freqFim: 110, ganho: 0.04 }))
      } else {
        rajada(c, t0, { dur: Math.max(0.1, ate(0.34) - t0), tipo: 'lowpass', freq: 900, freqFim: 500, ganho: 0.035, ataque: 0.02 })
        noPonto(0.3, (t) => {
          tom(c, t, { dur: 0.12, freq: 90, freqFim: 55, ganho: 0.11 })
          rajada(c, t, { dur: 0.06, tipo: 'lowpass', freq: 380, ganho: 0.07 })
        })
        noPonto(0.22, (t) => tom(c, t, { dur: 0.04, freq: 205, freqFim: 160, ganho: 0.03 }))
        noPonto(0.12, (t) => tom(c, t, { dur: 0.04, freq: 205, freqFim: 160, ganho: 0.02 }))
      }
      return
    case 'sanfona': {
      const dobras = abrindo ? [0.06, 0.2, 0.36] : [0.36, 0.2, 0.06]
      rajada(c, t0, { dur: Math.max(0.15, ate(abrindo ? 0.7 : 0.05) - t0), tipo: 'bandpass', freq: 1100, q: 0.8, ganho: 0.02, ataque: 0.04 })
      dobras.forEach((s, i) => {
        noPonto(s, (t) => {
          rajada(c, t, { dur: 0.014, tipo: 'bandpass', freq: 1500 + 180 * i, q: 9, ganho: 0.05, ataque: 0.001 })
          tom(c, t, { dur: 0.03, freq: 900 + 90 * i, ganho: 0.012 })
        })
      })
      noPonto(abrindo ? 0.95 : 0.01, (t) => tom(c, t, { dur: 0.045, freq: 220, freqFim: 170, ganho: 0.035 }))
      return
    }
    case 'cortina': {
      const contas = 22
      for (let i = 0; i < contas; i += 1) {
        // Mais batidas no começo do movimento, quando as contas correm mais.
        const u = (i / contas) ** 1.6
        const jitter = c.sorte() * 0.01
        const dur = 0.008 + 0.007 * c.sorte()
        const freq = 4500 + 3000 * c.sorte()
        const ganho = 0.01 + 0.02 * c.sorte()
        noPonto(abrindo ? 0.06 + 0.68 * u : 0.74 - 0.68 * u, (t) => rajada(c, t + jitter, { dur, tipo: 'bandpass', freq, q: 10, ganho, ataque: 0.001 }))
      }
      rajada(c, t0, { dur: Math.max(0.15, ate(abrindo ? 0.7 : 0.06) - t0), tipo: 'highpass', freq: 3000, ganho: 0.01, ataque: 0.05 })
      if (!abrindo) noPonto(0.05, (t) => tom(c, t, { dur: 0.04, freq: 520, freqFim: 420, ganho: 0.012 }))
      return
    }
  }
}

/** O compressor do Web Audio, quando o contexto tem (o de verdade e o offline têm; o falso dos testes, não). */
interface ContextoComCompressor<N> {
  createDynamicsCompressor(): N & { threshold: ParametroDeSom; knee: ParametroDeSom; ratio: ParametroDeSom; attack: ParametroDeSom; release: ParametroDeSom; connect(destino: N): unknown }
}

function temCompressor<N>(ctx: ContextoDeSom<N>): ctx is ContextoDeSom<N> & ContextoComCompressor<N> {
  return 'createDynamicsCompressor' in ctx && typeof ctx.createDynamicsCompressor === 'function'
}

/**
 * Compressor suave na saída: segura o estalo e o baque (que dão o pico) sem
 * mexer no corpo do som, para o volume subir sem passar de -12 dBTP. Sem ele
 * (contexto que não tem), o som sai direto: só o pico pode ficar mais alto.
 */
function saidaComprimida<N>(ctx: ContextoDeSom<N>, destino: N, t: number): N {
  if (!temCompressor(ctx)) return destino
  const c = ctx.createDynamicsCompressor()
  c.threshold.setValueAtTime(-30, t)
  c.knee.setValueAtTime(6, t)
  c.ratio.setValueAtTime(6, t)
  c.attack.setValueAtTime(0.001, t)
  c.release.setValueAtTime(0.06, t)
  c.connect(destino)
  return c
}

/**
 * Agenda o som do caminho em `t0` (s, no relógio do contexto) e devolve o
 * instante em que ele termina. Semente fixa por som e sentido: o mesmo som a
 * cada vez.
 */
export function agendarSomDaPortaDoPacote<N>(ctx: ContextoDeSom<N>, destino: N, t0: number, som: SomDoPacote, caminho: CaminhoDoSom): number {
  const final = ctx.createGain()
  final.gain.setValueAtTime(10 ** (GANHO_FINAL_DB[som][caminho.abrindo ? 'abrir' : 'fechar'] / 20), Math.max(0, t0 - 0.002))
  final.connect(destino)
  const semente = SONS_DO_PACOTE.indexOf(som) * 97 + (caminho.abrindo ? 1 : 2)
  compor({ ctx, saida: saidaComprimida(ctx, final, t0), sorte: sorteador(semente) }, som, caminho, t0)
  return t0 + caminho.duracaoS + CAUDA_S
}
