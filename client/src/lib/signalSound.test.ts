import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSignalSound, playSignalSound, type SignalAudioContext } from './signalSound'
import { caminhoAteASaida, criarAudioFalso } from './sons/audioFalso.fixture'

interface FakeNode {
  name: string
}

function fakeParam() {
  return { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
}

function fakeContext(state: AudioContextState = 'running') {
  const destination: FakeNode = { name: 'saida' }
  const gain = { name: 'ganho', gain: fakeParam(), connect: vi.fn() }
  const oscillator = { type: 'square' as OscillatorType, frequency: fakeParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  const context: SignalAudioContext<FakeNode> = {
    currentTime: 2,
    state,
    destination,
    resume: vi.fn(async () => undefined),
    createOscillator: () => oscillator,
    createGain: () => gain,
  }
  return { context, gain, oscillator, destination }
}

describe('signalSound', () => {
  it('sem AudioContext (jsdom) não lança e devolve false', () => {
    expect(() => playSignalSound()).not.toThrow()
    expect(playSignalSound()).toBe(false)
  })

  it('toca um bipe curto ligando oscilador -> ganho -> saída e reaproveita o contexto', () => {
    const fake = fakeContext()
    const create = vi.fn(() => fake.context)
    const play = createSignalSound(create)
    expect(play()).toBe(true)
    expect(play()).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
    expect(fake.oscillator.connect).toHaveBeenCalledWith(fake.gain)
    expect(fake.gain.connect).toHaveBeenCalledWith(fake.destination)
    expect(fake.oscillator.start).toHaveBeenCalledWith(2)
    const stopAt = fake.oscillator.stop.mock.calls[0]?.[0]
    expect(stopAt).toBeGreaterThan(2)
    expect(stopAt).toBeLessThanOrEqual(2.5)
  })

  it('contexto suspenso é retomado; falha ao criar vira false', () => {
    const suspended = fakeContext('suspended')
    createSignalSound(() => suspended.context)()
    expect(suspended.context.resume).toHaveBeenCalled()
    const broken = createSignalSound((): SignalAudioContext<FakeNode> | null => {
      throw new Error('bloqueado')
    })
    expect(broken()).toBe(false)
  })
})

/**
 * O BIPE DO APP (`playSignalSound`) toca no contexto dos sons de clima
 * (`lib/sons/contexto.ts`), o único da página, criado no gesto do mestre. O
 * bipe vem de mensagem de rede, fora de gesto: um contexto só dele nasceria
 * suspenso onde o navegador exige o gesto. Cada teste sobe os módulos do zero
 * (o motor e a preferência de som são da página), com um AudioContext falso.
 */
describe('playSignalSound: o bipe do app', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  async function paginaComAudio() {
    const audio = criarAudioFalso({ estado: 'suspended' })
    const construir = vi.fn()
    // O motor faz `new AudioContext()`: função comum que devolve objeto faz o `new` devolver esse objeto.
    vi.stubGlobal('AudioContext', function AudioContextFalso() {
      construir()
      return audio.ctx
    })
    const { playSignalSound: tocarBipe } = await import('./signalSound')
    const { destravarAudioNoPrimeiroGesto } = await import('./sons/contexto')
    const { useSomStore } = await import('../stores/somStore')
    /** O primeiro gesto do mestre no app. */
    const gesto = () => {
      const parar = destravarAudioNoPrimeiroGesto(window)
      window.dispatchEvent(new Event('pointerup'))
      parar()
    }
    return { audio, construir, tocarBipe, gesto, useSomStore }
  }

  it('toca no contexto que o gesto criou para os sons de clima: a página não abre um segundo AudioContext', async () => {
    const { audio, construir, tocarBipe, gesto } = await paginaComAudio()
    expect(tocarBipe()).toBe(false)
    expect(construir).not.toHaveBeenCalled()
    gesto()
    expect(construir).toHaveBeenCalledTimes(1)
    expect(tocarBipe()).toBe(true)
    expect(tocarBipe()).toBe(true)
    expect(construir).toHaveBeenCalledTimes(1)
    expect(audio.osciladores).toHaveLength(2)
    const [bipe] = audio.osciladores
    if (bipe === undefined) throw new Error('o bipe não criou oscilador')
    // Direto à saída: o bipe é alerta, sem o passa-baixa dos sons de clima.
    expect(caminhoAteASaida(bipe)).toEqual(['oscilador', 'ganho', 'saida'])
  })

  it('o Mudo da mesa cala o bipe: nenhum oscilador; tirado o mudo, volta a tocar', async () => {
    const { audio, tocarBipe, gesto, useSomStore } = await paginaComAudio()
    gesto()
    useSomStore.getState().alternarMudo()
    expect(tocarBipe()).toBe(false)
    expect(audio.osciladores).toEqual([])
    useSomStore.getState().alternarMudo()
    expect(tocarBipe()).toBe(true)
    expect(audio.osciladores).toHaveLength(1)
  })

  it('a barra no 0% cala o bipe, como o alto-falante cortado do botão; acima de zero o alerta toca sempre no mesmo nível', async () => {
    const { audio, tocarBipe, gesto, useSomStore } = await paginaComAudio()
    gesto()
    // 0,4% a barra mostra como 0%: cala também.
    for (const volume of [0, 0.004]) {
      useSomStore.getState().setVolume(volume)
      expect(tocarBipe(), `volume ${volume}`).toBe(false)
    }
    expect(audio.osciladores).toEqual([])
    for (const volume of [0.01, 0.1, 1]) {
      useSomStore.getState().setVolume(volume)
      expect(tocarBipe(), `volume ${volume}`).toBe(true)
    }
    const picos = audio.ganhos
      .filter((ganho) => ganho.destino === audio.destination)
      .map((ganho) => Math.max(...ganho.gain.exponentialRampToValueAtTime.mock.calls.map(([valor]) => valor)))
    expect(picos).toEqual([0.2, 0.2, 0.2])
  })
})
