/**
 * SOM DA REVELAÇÃO — máquina de escrever e a porta batendo no batente,
 * sintetizados com Web Audio (sem arquivo de som: o app roda sem internet).
 * Todo som nasce de ganho 0 e morre em ganho ~0 (10 constantes de tempo antes
 * do stop): nada de estalo no corte. Sem rangido (pedido do usuário). Porte de
 * `som.js` do protótipo v3; o vento continua com a panorâmica
 * (`AnimacaoCenario.tsx`), que já o toca.
 */

import { SEMENTE, mulberry32, type EventoDeSom, type TipoDeSom } from './tempo'

/** Ganho das teclas no volume máximo da mesa. Medido no protótipo: pico abaixo de -1 dBFS. */
export const GANHO_TECLAS = 0.9
export const GANHO_MECANISMO = 0.85

function bufferDeRuido(ctx: BaseAudioContext): AudioBuffer {
  const rnd = mulberry32(91)
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = rnd() * 2 - 1
  return buffer
}

interface OpcoesDaRajada {
  freq: number
  q?: number
  tipo?: BiquadFilterType
  ganho: number
  tau: number
  rnd: () => number
}

interface OpcoesDoBaque {
  freq: number
  ganho: number
  tau: number
  queda?: number
}

interface OpcoesDoPing {
  freq: number
  ganho: number
  tau: number
  ataque?: number
  /** A partir daqui (s) a queda passa a ter 50 ms de constante: abafa. */
  solta?: number
}

interface OpcoesDoSopro {
  freq: number
  q: number
  tipo: BiquadFilterType
  ganho: number
  curva: readonly number[]
}

export interface Maquina {
  /** Agenda `evento` no relógio do contexto, em `quando` segundos. */
  tocar(evento: EventoDeSom, quando: number): void
}

/** Monta o kit numa saída. */
export function criarMaquina(ctx: BaseAudioContext, saida: AudioNode): Maquina {
  const ruido = bufferDeRuido(ctx)

  /** Rajada de ruído filtrado com ataque de 0,6 ms e queda exponencial. */
  function rajada(t: number, { freq, q = 1, tipo = 'bandpass', ganho, tau, rnd }: OpcoesDaRajada): void {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruido
    const filtro = ctx.createBiquadFilter()
    filtro.type = tipo
    filtro.frequency.value = freq
    filtro.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(ganho, t + 0.0006)
    g.gain.setTargetAtTime(0, t + 0.0006, tau)
    fonte.connect(filtro).connect(g).connect(saida)
    fonte.start(t, rnd() * 0.8)
    fonte.stop(t + 10 * tau + 0.002)
  }

  /** Baque grave com o tom caindo. */
  function baque(t: number, { freq, ganho, tau, queda = 1.6 }: OpcoesDoBaque): void {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(freq * queda, t)
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.018)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(ganho, t + 0.001)
    g.gain.setTargetAtTime(0, t + 0.001, tau)
    osc.connect(g).connect(saida)
    osc.start(t)
    osc.stop(t + 10 * tau + 0.003)
  }

  /** Senoide curta (metal vibrando, sino). */
  function ping(t: number, { freq, ganho, tau, ataque = 0.0015, solta }: OpcoesDoPing): void {
    const osc = ctx.createOscillator()
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(ganho, t + ataque)
    g.gain.setTargetAtTime(0, t + ataque, tau)
    let fim = t + 10 * tau + 0.004
    if (solta !== undefined) {
      g.gain.setTargetAtTime(0, t + solta, 0.05)
      fim = Math.min(fim, t + solta + 0.5)
    }
    osc.connect(g).connect(saida)
    osc.start(t)
    osc.stop(fim)
  }

  /** Ruído contínuo filtrado com a envoltória `curva` (0 a 1) ao longo de `dur`. */
  function sopro(t: number, dur: number, { freq, q, tipo, ganho, curva }: OpcoesDoSopro): void {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruido
    fonte.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = tipo
    filtro.frequency.value = freq
    filtro.Q.value = q
    const g = ctx.createGain()
    const pontos = new Float32Array(curva.length)
    for (let i = 0; i < curva.length; i++) pontos[i] = curva[i] * ganho
    pontos[0] = 0
    pontos[pontos.length - 1] = 0
    g.gain.setValueAtTime(0, t)
    g.gain.setValueCurveAtTime(pontos, t, dur)
    fonte.connect(filtro).connect(g).connect(saida)
    fonte.start(t)
    fonte.stop(t + dur + 0.02)
  }

  /** Uma tecla: estalo do tipo, baque no rolo, braço vibrando e o escape do carro ("tac-tic"). */
  function tecla(t: number, forca: number, rnd: () => number): void {
    rajada(t, { freq: 2600 + rnd() * 1400, q: 1.1, ganho: 0.3 * forca, tau: 0.0045, rnd })
    rajada(t, { freq: 6500, q: 0.7, tipo: 'highpass', ganho: 0.1 * forca, tau: 0.0018, rnd })
    baque(t + 0.0015, { freq: 190 + rnd() * 60, ganho: 0.2 * forca, tau: 0.016 })
    ping(t + 0.002, { freq: 1150 + rnd() * 500, ganho: 0.035 * forca, tau: 0.022 })
    rajada(t + 0.026 + rnd() * 0.012, { freq: 4300, q: 1.4, ganho: 0.07 * forca, tau: 0.0022, rnd })
  }

  const sons: Record<TipoDeSom, (t: number, forca: number, rnd: () => number, evento: EventoDeSom) => void> = {
    // Várias letras caídas juntas (datilografia rápida): duas batidas coladas, "trac", não zumbido.
    tecla(t, forca, rnd, evento) {
      tecla(t, forca, rnd)
      if (evento.n >= 2) rajada(t + 0.008 + rnd() * 0.004, { freq: 3000 + rnd() * 900, q: 1.2, ganho: 0.17 * forca, tau: 0.0035, rnd })
    },
    espaco(t, forca, rnd) {
      rajada(t, { freq: 900, q: 0.8, tipo: 'lowpass', ganho: 0.16 * forca, tau: 0.009, rnd })
      baque(t, { freq: 112 + rnd() * 20, ganho: 0.17 * forca, tau: 0.026, queda: 1.3 })
      rajada(t + 0.018, { freq: 4300, q: 1.4, ganho: 0.06 * forca, tau: 0.0022, rnd })
    },
    maiuscula(t, forca, rnd) {
      baque(t, { freq: 85, ganho: 0.1 * forca, tau: 0.035, queda: 1.2 })
      rajada(t, { freq: 600, q: 0.7, tipo: 'lowpass', ganho: 0.05 * forca, tau: 0.012, rnd })
    },
    ding(t, forca, rnd) {
      rajada(t, { freq: 5000, q: 1.2, ganho: 0.05, tau: 0.002, rnd })
      // O sino é abafado 0,38 s depois da batida: o rabo dele não passa dos 5 s da regra.
      ping(t, { freq: 2340, ganho: 0.1 * forca, tau: 0.45, ataque: 0.002, solta: 0.38 })
      ping(t, { freq: 2340 * 2.76, ganho: 0.035 * forca, tau: 0.18, ataque: 0.002, solta: 0.38 })
      ping(t, { freq: 2340 * 5.4, ganho: 0.012 * forca, tau: 0.07, ataque: 0.002 })
    },
    // Retorno do carro, curto (0,26 s) para caber nos 5 s.
    retorno(t, forca, rnd) {
      const dur = 0.26
      for (let k = 0; k < 9; k++) rajada(t + dur * Math.pow(k / 8, 0.85), { freq: 3000 + rnd() * 600, q: 2, ganho: 0.06 * forca, tau: 0.0018, rnd })
      sopro(t, dur + 0.03, { freq: 260, q: 0.7, tipo: 'lowpass', ganho: 0.07 * forca, curva: [0, 1, 0.85, 0.75, 0.7, 0] })
      baque(t + dur + 0.01, { freq: 95, ganho: 0.18 * forca, tau: 0.04, queda: 1.4 })
      rajada(t + dur + 0.01, { freq: 1200, q: 0.7, tipo: 'lowpass', ganho: 0.12 * forca, tau: 0.008, rnd })
    },
    // A porta bate no batente: grave e pesado, sem rangido nem quique.
    clunk(t, forca, rnd) {
      baque(t, { freq: 92, ganho: 0.36 * forca, tau: 0.045, queda: 1.5 })
      rajada(t, { freq: 700, q: 1.2, ganho: 0.22 * forca, tau: 0.01, rnd })
      rajada(t, { freq: 2400, q: 1.5, ganho: 0.08 * forca, tau: 0.003, rnd })
      ping(t + 0.001, { freq: 620, ganho: 0.05 * forca, tau: 0.06 })
      ping(t + 0.001, { freq: 1530, ganho: 0.03 * forca, tau: 0.03 })
      rajada(t + 0.019, { freq: 4000, q: 2, ganho: 0.06 * forca, tau: 0.002, rnd })
    },
  }

  return {
    tocar(evento, quando) {
      const rnd = mulberry32(SEMENTE + evento.i * 7 + evento.tipo.length)
      sons[evento.tipo](quando, evento.forca, rnd, evento)
    },
  }
}

/** Quanto à frente o som é agendado no relógio do áudio: casa com as letras sem atrasar. */
export const AGENDA_A_FRENTE_S = 0.12

export interface SomDaRevelacao {
  /** Agenda os eventos da fila que caem até `t + AGENDA_A_FRENTE_S` (t = s desde o começo). */
  agendar(fila: readonly EventoDeSom[], t: number, soMecanismo: boolean): void
  /** Corta o que já estava agendado num fade de ~20 ms: nada sobra em rajada. */
  cortar(): void
  volume(v: number): void
  fechar(): void
}

/**
 * O som de uma revelação, no volume da mesa (0 = mudo). `null` sem Web Audio.
 * Um contexto por revelação, fechado ao sair, como o vento da panorâmica.
 */
export function criarSomDaRevelacao(volume: number): SomDaRevelacao | null {
  const Contexto = typeof AudioContext === 'undefined' ? null : AudioContext
  if (Contexto === null) return null
  let ctx: AudioContext
  try {
    ctx = new Contexto()
  } catch {
    return null
  }
  const mestre = ctx.createGain()
  mestre.gain.value = volume
  mestre.connect(ctx.destination)
  void ctx.resume().catch(() => undefined)
  let teclas: GainNode
  let mecanismo: GainNode
  let maquinaTeclas: Maquina
  let maquinaMecanismo: Maquina
  function novosBarramentos(): void {
    teclas = ctx.createGain()
    teclas.gain.value = GANHO_TECLAS
    teclas.connect(mestre)
    mecanismo = ctx.createGain()
    mecanismo.gain.value = GANHO_MECANISMO
    mecanismo.connect(mestre)
    maquinaTeclas = criarMaquina(ctx, teclas)
    maquinaMecanismo = criarMaquina(ctx, mecanismo)
  }
  novosBarramentos()
  let proximo = 0
  /** Desligar os barramentos cortados: o `fechar` cancela o que sobrou (nada vivo depois de sair). */
  const desligamentos = new Set<ReturnType<typeof setTimeout>>()
  return {
    agendar(fila, t, soMecanismo) {
      while (proximo < fila.length && fila[proximo].t <= t + AGENDA_A_FRENTE_S) {
        const evento = fila[proximo++]
        const ehTecla = evento.i >= 0
        if (ehTecla && soMecanismo) continue
        const atraso = evento.t - t
        // Passou (aba escondida, quadro perdido): não toca atrasado.
        if (atraso < -0.04) continue
        ;(ehTecla ? maquinaTeclas : maquinaMecanismo).tocar(evento, ctx.currentTime + Math.max(0, atraso) + 0.01)
      }
    },
    cortar() {
      for (const velho of [teclas, mecanismo]) {
        velho.gain.setTargetAtTime(0, ctx.currentTime, 0.005)
        const id = setTimeout(() => {
          desligamentos.delete(id)
          velho.disconnect()
        }, 200)
        desligamentos.add(id)
      }
      novosBarramentos()
    },
    volume(v) {
      mestre.gain.setTargetAtTime(v, ctx.currentTime, 0.01)
    },
    fechar() {
      // O contexto fechado leva os nós junto; desligar depois seria trabalho para nada.
      for (const id of desligamentos) clearTimeout(id)
      desligamentos.clear()
      void ctx.close().catch(() => undefined)
    },
  }
}
