/**
 * Som curto do sinal no mestre, gerado por WebAudio (sem arquivo de áudio).
 * Só o subconjunto do AudioContext que é usado, para o teste injetar um falso;
 * sem AudioContext (jsdom, navegador antigo) o som vira no-op, nunca erro.
 */

interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown
  exponentialRampToValueAtTime(value: number, time: number): unknown
}

/** `N` é o tipo de nó: `AudioNode` no navegador, um objeto simples no teste. */
interface OscillatorLike<N> {
  type: OscillatorType
  frequency: AudioParamLike
  connect(destination: N): unknown
  start(when: number): void
  stop(when: number): void
}

interface GainLike<N> {
  gain: AudioParamLike
  connect(destination: N): unknown
}

export interface SignalAudioContext<N> {
  readonly currentTime: number
  readonly state: AudioContextState
  readonly destination: N
  resume(): Promise<void>
  createOscillator(): OscillatorLike<N>
  createGain(): GainLike<N> & N
}

const START_HZ = 880
const END_HZ = 1320
const PEAK_GAIN = 0.2
/** Rampa exponencial não aceita 0: "silêncio" é um ganho desprezível. */
const SILENT_GAIN = 0.0001
const ATTACK_S = 0.01
const SWEEP_S = 0.08
const DURATION_S = 0.2

function createBrowserContext(): SignalAudioContext<AudioNode> | null {
  const Ctor = globalThis.AudioContext
  return typeof Ctor === 'function' ? new Ctor() : null
}

/** Devolve a função que toca o bipe; o contexto é criado no primeiro toque e reaproveitado. */
export function createSignalSound<N>(createContext: () => SignalAudioContext<N> | null): () => boolean {
  let context: SignalAudioContext<N> | null = null
  return () => {
    try {
      context ??= createContext()
      if (context === null) return false
      // WebView sem gesto recente deixa o contexto suspenso; retomar pode falhar e tudo bem.
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
      const start = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(START_HZ, start)
      oscillator.frequency.exponentialRampToValueAtTime(END_HZ, start + SWEEP_S)
      gain.gain.setValueAtTime(SILENT_GAIN, start)
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + ATTACK_S)
      gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, start + DURATION_S)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + DURATION_S)
      return true
    } catch {
      // Áudio bloqueado ou indisponível: o sinal continua visível, só sem som.
      return false
    }
  }
}

export const playSignalSound = createSignalSound(createBrowserContext)
