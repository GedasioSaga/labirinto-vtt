import { vi, type Mock } from 'vitest'
import type { BufferAoVivo, ContextoAoVivo, ElementoDeAudio } from './aoVivo/motor'
import type { BufferDeSom, ContextoDeSom, SaidaDeSom } from './contexto'

/**
 * WEB AUDIO DE MENTIRA para os testes dos sons (o jsdom não tem áudio). Cada
 * nó guarda para onde foi ligado e cada parâmetro é um espião: dá para seguir
 * o caminho de uma voz até a saída e conferir o envelope sem tocar nada.
 * Cobre também o que o motor dos sons ao vivo usa (`aoVivo/motor.ts`):
 * decodificar arquivo, fonte em loop com fim avisado e `<audio>` ligado ao grafo.
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
  linearRampToValueAtTime: Mock<(valor: number, quando: number) => void>
  cancelScheduledValues: Mock<(quando: number) => void>
}

export interface GanhoFalso extends NoFalso {
  gain: ParametroFalso
  /** Solta o nó do grafo: `destino` volta a `null`. */
  disconnect: Mock<() => void>
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
  buffer: (BufferDeSom & BufferAoVivo) | null
  loop: boolean
  start: Mock<(quando: number, deslocamento?: number) => void>
  stop: Mock<(quando: number) => void>
  addEventListener: Mock<(tipo: 'ended', ouvinte: () => void) => void>
  /** O fim da fonte (a última amostra tocou, ou o `stop` chegou): avisa quem ouve `ended`. */
  terminar(): void
}

export interface BufferFalso extends BufferDeSom, BufferAoVivo {
  quadros: number
}

/** Um `<audio>` de mentira: os eventos só acontecem quando o teste chama `disparar`. */
export interface ElementoDeAudioFalso extends ElementoDeAudio {
  duration: number
  play: Mock<() => Promise<void>>
  pause: Mock<() => void>
  disparar(tipo: 'loadedmetadata' | 'ended' | 'error'): void
}

/** Um `<audio>` ligado ao grafo por `createMediaElementSource`, e o nó que o representa. */
export interface ElementoLigado {
  elemento: ElementoDeAudio
  no: NoFalso
}

/** Quantos bytes valem 1 segundo no áudio decodificado de mentira (um mp3 de 128 kbps). */
export const BYTES_POR_SEGUNDO_FALSO = 16000
/** Canais do áudio decodificado de mentira (estéreo). */
export const CANAIS_DECODIFICADOS_FALSOS = 2

export interface AudioFalso {
  ctx: ContextoDeSom<NoFalso> & ContextoAoVivo<NoFalso>
  /** Saída pronta para o sintetizador: ganho mestre ligado direto ao destination. */
  saida: SaidaDeSom<NoFalso>
  destination: NoFalso
  /** Mestre da `saida`; criado fora do contexto, então não entra em `ganhos`. */
  mestre: GanhoFalso
  osciladores: OsciladorFalso[]
  ganhos: GanhoFalso[]
  filtros: FiltroFalso[]
  fontes: FonteFalsa[]
  elementosLigados: ElementoLigado[]
  createBuffer: Mock<(canais: number, quadros: number, taxa: number) => BufferFalso>
  /** Decodifica qualquer coisa: a duração é o tamanho em bytes / `BYTES_POR_SEGUNDO_FALSO`. */
  decodeAudioData: Mock<(dados: ArrayBuffer) => Promise<BufferFalso>>
  resume: Mock<() => Promise<void>>
  /** Muda o estado e, se mudou, avisa na hora quem ouve `statechange`. */
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
    linearRampToValueAtTime: vi.fn<(valor: number, quando: number) => void>(),
    cancelScheduledValues: vi.fn<(quando: number) => void>(),
  }
}

export function ganhoFalso(nome = 'ganho'): GanhoFalso {
  const no = noFalso(nome)
  return Object.assign(no, {
    gain: parametroFalso(),
    disconnect: vi.fn(() => {
      no.destino = null
    }),
  })
}

function fonteFalsa(): FonteFalsa {
  const aoTerminar: (() => void)[] = []
  return Object.assign(noFalso('fonte'), {
    buffer: null,
    loop: false,
    start: vi.fn<(quando: number, deslocamento?: number) => void>(),
    stop: vi.fn<(quando: number) => void>(),
    addEventListener: vi.fn((_tipo: 'ended', ouvinte: () => void) => {
      aoTerminar.push(ouvinte)
    }),
    terminar: () => {
      for (const ouvinte of aoTerminar) ouvinte()
    },
  })
}

export function criarElementoDeAudioFalso(duracao = 120): ElementoDeAudioFalso {
  const ouvintes = new Map<string, (() => void)[]>()
  return {
    src: '',
    loop: false,
    currentTime: 0,
    duration: duracao,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    addEventListener: (tipo, ouvinte) => {
      ouvintes.set(tipo, [...(ouvintes.get(tipo) ?? []), ouvinte])
    },
    disparar: (tipo) => {
      for (const ouvinte of ouvintes.get(tipo) ?? []) ouvinte()
    },
  }
}

function guardar<T>(lista: T[], item: T): T {
  lista.push(item)
  return item
}

export function criarAudioFalso(opcoes: OpcoesDoAudioFalso = {}): AudioFalso {
  let estado: AudioContextState = opcoes.estado ?? 'running'
  let agora = opcoes.agora ?? 3
  const taxa = opcoes.taxa ?? 48000
  const destination = noFalso('saida')
  const osciladores: OsciladorFalso[] = []
  const ganhos: GanhoFalso[] = []
  const filtros: FiltroFalso[] = []
  const fontes: FonteFalsa[] = []
  const elementosLigados: ElementoLigado[] = []
  const formaInicial: OscillatorType = 'sine'
  const filtroInicial: BiquadFilterType = 'lowpass'
  const createBuffer = vi.fn((canais: number, quadros: number, taxaDoBuffer: number): BufferFalso => {
    const dados = new Float32Array(quadros)
    return { quadros, getChannelData: () => dados, duration: quadros / taxaDoBuffer, length: quadros, numberOfChannels: canais }
  })
  const decodeAudioData = vi.fn(async (dados: ArrayBuffer): Promise<BufferFalso> => {
    const duracao = dados.byteLength / BYTES_POR_SEGUNDO_FALSO
    const quadros = Math.round(duracao * taxa)
    return { quadros, getChannelData: () => new Float32Array(0), duration: duracao, length: quadros, numberOfChannels: CANAIS_DECODIFICADOS_FALSOS }
  })
  const ouvintesDoEstado: (() => void)[] = []
  const avisarEstado = (): void => {
    for (const ouvinte of [...ouvintesDoEstado]) ouvinte()
  }
  /** Devolve se mudou: o `statechange` só vem quando o estado muda de fato. */
  const mudarEstado = (novo: AudioContextState): boolean => {
    if (novo === estado) return false
    estado = novo
    return true
  }
  const resume = vi.fn(async () => {
    // Como no navegador: o estado muda já, e o `statechange` chega depois, numa tarefa.
    if (mudarEstado('running')) queueMicrotask(avisarEstado)
  })

  const ctx: ContextoDeSom<NoFalso> & ContextoAoVivo<NoFalso> = {
    get currentTime() {
      return agora
    },
    sampleRate: taxa,
    get state() {
      return estado
    },
    destination,
    resume,
    addEventListener: (_tipo, ouvinte) => {
      ouvintesDoEstado.push(ouvinte)
    },
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
    createBufferSource: () => guardar(fontes, fonteFalsa()),
    createMediaElementSource: (elemento) => guardar(elementosLigados, { elemento, no: noFalso('elemento') }).no,
    decodeAudioData,
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
    elementosLigados,
    createBuffer,
    decodeAudioData,
    resume,
    definirEstado: (novo) => {
      if (mudarEstado(novo)) avisarEstado()
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
