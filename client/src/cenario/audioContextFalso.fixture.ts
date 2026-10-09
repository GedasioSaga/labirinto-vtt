import { vi, type Mock } from 'vitest'

/**
 * `AudioContext` DE MENTIRA, posto no `globalThis` (o jsdom não tem Web Audio).
 * Diferente de `lib/sons/audioFalso.fixture.ts`, que entrega um contexto por
 * parâmetro: aqui o código chama `new AudioContext()` sozinho (revelação e
 * vento), então o teste só consegue ver os contextos pela classe global. Cada
 * contexto guarda os ganhos e as fontes que criou e conta `close()`; cada
 * parâmetro é um espião, para conferir fade, corte e mudo sem tocar nada.
 */

export interface ParametroFalso {
  value: number
  setValueAtTime: Mock<(valor: number, quando: number) => void>
  linearRampToValueAtTime: Mock<(valor: number, quando: number) => void>
  exponentialRampToValueAtTime: Mock<(valor: number, quando: number) => void>
  setTargetAtTime: Mock<(alvo: number, quando: number, tau: number) => void>
  setValueCurveAtTime: Mock<(valores: Float32Array, quando: number, duracao: number) => void>
}

export interface NoFalso {
  connect<T>(destino: T): T
  disconnect: Mock<() => void>
}

export interface GanhoFalso extends NoFalso {
  gain: ParametroFalso
}

/** Fonte de buffer ou oscilador: o que de fato soa quando `start` é chamado. */
export interface FonteFalsa extends NoFalso {
  tipo: 'buffer' | 'oscilador'
  loop: boolean
  buffer: unknown
  frequency: ParametroFalso
  start: Mock<(quando?: number, deslocamento?: number) => void>
  stop: Mock<(quando?: number) => void>
}

function parametroFalso(): ParametroFalso {
  return {
    value: 0,
    setValueAtTime: vi.fn<(valor: number, quando: number) => void>(),
    linearRampToValueAtTime: vi.fn<(valor: number, quando: number) => void>(),
    exponentialRampToValueAtTime: vi.fn<(valor: number, quando: number) => void>(),
    setTargetAtTime: vi.fn<(alvo: number, quando: number, tau: number) => void>(),
    setValueCurveAtTime: vi.fn<(valores: Float32Array, quando: number, duracao: number) => void>(),
  }
}

function noFalso(): NoFalso {
  return { connect: (destino) => destino, disconnect: vi.fn<() => void>() }
}

function fonteFalsa(tipo: FonteFalsa['tipo']): FonteFalsa {
  return Object.assign(noFalso(), {
    tipo,
    loop: false,
    buffer: null,
    frequency: parametroFalso(),
    start: vi.fn<(quando?: number, deslocamento?: number) => void>(),
    stop: vi.fn<(quando?: number) => void>(),
  })
}

let registro: AudioContextFalso[] = []

export class AudioContextFalso {
  readonly sampleRate = 8000
  currentTime = 0
  readonly destination = noFalso()
  readonly ganhos: GanhoFalso[] = []
  readonly fontes: FonteFalsa[] = []
  readonly close = vi.fn(async () => undefined)
  readonly resume = vi.fn(async () => undefined)

  constructor() {
    registro.push(this)
  }

  get fechado(): boolean {
    return this.close.mock.calls.length > 0
  }

  /** Quantas vozes já foram postas para tocar neste contexto. */
  get iniciadas(): number {
    return this.fontes.reduce((soma, fonte) => soma + fonte.start.mock.calls.length, 0)
  }

  createGain(): GanhoFalso {
    const ganho = Object.assign(noFalso(), { gain: parametroFalso() })
    ganho.gain.value = 1
    this.ganhos.push(ganho)
    return ganho
  }

  createBufferSource(): FonteFalsa {
    const fonte = fonteFalsa('buffer')
    this.fontes.push(fonte)
    return fonte
  }

  createOscillator(): FonteFalsa {
    const fonte = fonteFalsa('oscilador')
    this.fontes.push(fonte)
    return fonte
  }

  createBiquadFilter() {
    return Object.assign(noFalso(), { type: 'lowpass', frequency: parametroFalso(), Q: parametroFalso() })
  }

  createBuffer(_canais: number, quadros: number) {
    const dados = new Float32Array(quadros)
    return { getChannelData: () => dados }
  }
}

/** Troca o `AudioContext` global pelo falso; devolve a lista (viva) dos contextos criados. */
export function instalarAudioContextFalso(): AudioContextFalso[] {
  registro = []
  vi.stubGlobal('AudioContext', AudioContextFalso)
  return registro
}
