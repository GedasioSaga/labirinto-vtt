import { vi, type Mock } from 'vitest'
import type { BufferDeSom, ContextoDeSom, SaidaDeSom } from './contexto'

/**
 * WEB AUDIO DE MENTIRA para os testes dos sons (o jsdom não tem áudio). Cada
 * nó guarda para onde foi ligado e cada parâmetro é um espião: dá para seguir
 * o caminho de uma voz até a saída e conferir o envelope sem tocar nada.
 */

export interface NoFalso {
  nome: string
  /** Para onde este nó foi ligado; `null` = solto, ou a própria saída. */
  destino: NoFalso | null
  connect(destino: NoFalso): void
}

export interface ParametroFalso {
  setValueAtTime: Mock<(valor: number, quando: number) => void>
  exponentialRampToValueAtTime: Mock<(valor: number, quando: number) => void>
  setValueCurveAtTime: Mock<(valores: Float32Array, quando: number, duracao: number) => void>
}

export interface GanhoFalso extends NoFalso {
  gain: ParametroFalso
}

export interface FiltroFalso extends NoFalso {
  type: BiquadFilterType
  frequency: ParametroFalso
  Q: ParametroFalso
}

export interface OsciladorFalso extends NoFalso {
  type: OscillatorType
  frequency: ParametroFalso
  start: Mock<(quando: number) => void>
  stop: Mock<(quando: number) => void>
}

export interface FonteFalsa extends NoFalso {
  buffer: BufferDeSom | null
  start: Mock<(quando: number, deslocamento?: number) => void>
  stop: Mock<(quando: number) => void>
}

export interface BufferFalso extends BufferDeSom {
  quadros: number
}

export interface AudioFalso {
  ctx: ContextoDeSom<NoFalso>
  /** Saída pronta para o sintetizador: ganho mestre ligado direto ao destination. */
  saida: SaidaDeSom<NoFalso>
  destination: NoFalso
  /** Mestre da `saida`; criado fora do contexto, então não entra em `ganhos`. */
  mestre: GanhoFalso
  osciladores: OsciladorFalso[]
  ganhos: GanhoFalso[]
  filtros: FiltroFalso[]
  fontes: FonteFalsa[]
  createBuffer: Mock<(canais: number, quadros: number, taxa: number) => BufferFalso>
  resume: Mock<() => Promise<void>>
  definirEstado(estado: AudioContextState): void
  /** Anda o relógio do áudio: o toque seguinte dispara mais tarde, com o anterior ainda soando. */
  avancar(segundos: number): void
}

export interface OpcoesDoAudioFalso {
  estado?: AudioContextState
  agora?: number
  taxa?: number
}

export function noFalso(nome: string): NoFalso {
  const no: NoFalso = {
    nome,
    destino: null,
    connect: (destino) => {
      no.destino = destino
    },
  }
  return no
}

export function parametroFalso(): ParametroFalso {
  return {
    setValueAtTime: vi.fn<(valor: number, quando: number) => void>(),
    exponentialRampToValueAtTime: vi.fn<(valor: number, quando: number) => void>(),
    setValueCurveAtTime: vi.fn<(valores: Float32Array, quando: number, duracao: number) => void>(),
  }
}

export function ganhoFalso(nome = 'ganho'): GanhoFalso {
  return Object.assign(noFalso(nome), { gain: parametroFalso() })
}

function guardar<T>(lista: T[], item: T): T {
  lista.push(item)
  return item
}

export function criarAudioFalso(opcoes: OpcoesDoAudioFalso = {}): AudioFalso {
  let estado: AudioContextState = opcoes.estado ?? 'running'
  let agora = opcoes.agora ?? 3
  const destination = noFalso('saida')
  const osciladores: OsciladorFalso[] = []
  const ganhos: GanhoFalso[] = []
  const filtros: FiltroFalso[] = []
  const fontes: FonteFalsa[] = []
  const formaInicial: OscillatorType = 'sine'
  const filtroInicial: BiquadFilterType = 'lowpass'
  const createBuffer = vi.fn((_canais: number, quadros: number, _taxa: number): BufferFalso => {
    const dados = new Float32Array(quadros)
    return { quadros, getChannelData: () => dados }
  })
  const resume = vi.fn(async () => {
    estado = 'running'
  })

  const ctx: ContextoDeSom<NoFalso> = {
    get currentTime() {
      return agora
    },
    sampleRate: opcoes.taxa ?? 48000,
    get state() {
      return estado
    },
    destination,
    resume,
    createGain: () => guardar(ganhos, ganhoFalso()),
    createOscillator: () =>
      guardar<OsciladorFalso>(osciladores, Object.assign(noFalso('oscilador'), {
        type: formaInicial,
        frequency: parametroFalso(),
        start: vi.fn<(quando: number) => void>(),
        stop: vi.fn<(quando: number) => void>(),
      })),
    createBiquadFilter: () =>
      guardar<FiltroFalso>(filtros, Object.assign(noFalso('filtro'), {
        type: filtroInicial,
        frequency: parametroFalso(),
        Q: parametroFalso(),
      })),
    createBuffer,
    createBufferSource: () =>
      guardar<FonteFalsa>(fontes, Object.assign(noFalso('fonte'), {
        buffer: null,
        start: vi.fn<(quando: number, deslocamento?: number) => void>(),
        stop: vi.fn<(quando: number) => void>(),
      })),
  }

  const mestre = ganhoFalso('mestre')
  mestre.connect(destination)

  return {
    ctx,
    saida: { ctx, mestre },
    destination,
    mestre,
    osciladores,
    ganhos,
    filtros,
    fontes,
    createBuffer,
    resume,
    definirEstado: (novo) => {
      estado = novo
    },
    avancar: (segundos) => {
      agora += segundos
    },
  }
}

/** Nomes do caminho de um nó até a ponta solta (normalmente a saída). */
export function caminhoAteASaida(no: NoFalso): string[] {
  const nomes: string[] = []
  let atual: NoFalso | null = no
  // Teto contra ciclo acidental no grafo: nenhuma voz passa de 5 nós.
  while (atual !== null && nomes.length < 12) {
    nomes.push(atual.nome)
    atual = atual.destino
  }
  return nomes
}
