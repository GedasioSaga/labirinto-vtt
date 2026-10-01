import { describe, expect, it, vi } from 'vitest'
import type { PreferenciaDeSom } from '../../stores/somStore'
import { criarAudioFalso, type AudioFalso, type NoFalso } from './audioFalso.fixture'
import { destravarAudioNoPrimeiroGesto, type SaidaDeSom } from './contexto'
import type { SomId } from './receitas'
import { criarTocador, tocarSom } from './tocarSom'

interface Montagem {
  preferencia?: PreferenciaDeSom
  audio?: AudioFalso
  saida?: SaidaDeSom<NoFalso> | null
  produziu?: boolean
}

function montar({ preferencia = { volume: 0.35, mudo: false }, audio = criarAudioFalso(), saida = audio.saida, produziu = true }: Montagem = {}) {
  let relogio = 10_000
  const produzir = vi.fn((_saida: SaidaDeSom<NoFalso>, _id: SomId, _volume: number) => produziu)
  const tocar = criarTocador({
    obterSaida: () => saida,
    lerPreferencia: () => preferencia,
    agora: () => relogio,
    produzir,
  })
  return {
    audio,
    produzir,
    tocar,
    avancar: (ms: number) => {
      relogio += ms
    },
  }
}

describe('tocarSom', () => {
  it('mudo: nada é produzido', () => {
    const { tocar, produzir } = montar({ preferencia: { volume: 0.8, mudo: true } })
    expect(tocar('item')).toBe(false)
    expect(produzir).not.toHaveBeenCalled()
  })

  it('volume 0: nada é produzido', () => {
    const { tocar, produzir } = montar({ preferencia: { volume: 0, mudo: false } })
    expect(tocar('item')).toBe(false)
    expect(produzir).not.toHaveBeenCalled()
  })

  it('antes do destravamento nada toca: sem saída, ou com o contexto ainda suspenso', () => {
    const semGesto = montar({ saida: null })
    expect(semGesto.tocar('dado')).toBe(false)
    expect(semGesto.produzir).not.toHaveBeenCalled()

    const suspenso = montar({ audio: criarAudioFalso({ estado: 'suspended' }) })
    expect(suspenso.tocar('dado')).toBe(false)
    expect(suspenso.produzir).not.toHaveBeenCalled()
    suspenso.audio.definirEstado('running')
    expect(suspenso.tocar('dado')).toBe(true)
  })

  it('toca o som pedido na saída, com o volume da barra', () => {
    const { tocar, produzir, audio } = montar({ preferencia: { volume: 0.6, mudo: false } })
    expect(tocar('portaAbre')).toBe(true)
    expect(produzir).toHaveBeenCalledWith(audio.saida, 'portaAbre', 0.6)
  })

  it('passagem duas vezes em 1000 ms toca uma vez só; com 1600 ms toca de novo', () => {
    const { tocar, produzir, avancar } = montar()
    expect(tocar('passagem')).toBe(true)
    avancar(1000)
    expect(tocar('passagem')).toBe(false)
    avancar(600)
    expect(tocar('passagem')).toBe(true)
    expect(produzir).toHaveBeenCalledTimes(2)
  })

  it('item e dado no mesmo instante tocam os dois: o intervalo é por som', () => {
    const { tocar, produzir } = montar()
    expect(tocar('item')).toBe(true)
    expect(tocar('dado')).toBe(true)
    expect(tocar('item')).toBe(false)
    expect(produzir.mock.calls.map(([, id]) => id)).toEqual(['item', 'dado'])
  })

  it('toque que falhou não conta para o intervalo', () => {
    const falha = montar({ produziu: false })
    expect(falha.tocar('aviso')).toBe(false)
    expect(falha.tocar('aviso')).toBe(false)
    expect(falha.produzir).toHaveBeenCalledTimes(2)
  })

  it('sem produzir injetado, sintetiza a receita do som com o volume ao quadrado num ganho do toque, sem mexer no mestre', () => {
    const audio = criarAudioFalso()
    const tocar = criarTocador({
      obterSaida: () => audio.saida,
      lerPreferencia: () => ({ volume: 0.5, mudo: false }),
      agora: () => 0,
    })
    expect(tocar('item')).toBe(true)
    expect(audio.osciladores).toHaveLength(8)
    const [volumeDoToque, ...outros] = audio.ganhos.filter((ganho) => ganho.destino === audio.mestre)
    if (volumeDoToque === undefined) throw new Error('nenhum ganho entrega o toque ao mestre')
    expect(outros).toEqual([])
    expect(volumeDoToque.gain.setValueAtTime).toHaveBeenCalledWith(0.25, expect.any(Number))
    expect(audio.mestre.gain.setValueAtTime).not.toHaveBeenCalled()
  })

  it('a instância do app sem Web Audio: mesmo depois do gesto que destravaria o áudio, devolve false e não lança', () => {
    // Sem o gesto o false viria só de ainda não haver saída. A contagem prova que o gesto chegou ao
    // motor e que ele procurou o AudioContext (e não achou) antes de o tocarSom ser chamado.
    let procurasPeloAudioContext = 0
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      get: () => {
        procurasPeloAudioContext += 1
        return undefined
      },
    })
    const parar = destravarAudioNoPrimeiroGesto(window)
    try {
      window.dispatchEvent(new Event('pointerup'))
      expect(procurasPeloAudioContext).toBe(1)
      expect(() => tocarSom('item')).not.toThrow()
      expect(tocarSom('passagem')).toBe(false)
    } finally {
      parar()
      Reflect.deleteProperty(globalThis, 'AudioContext')
    }
  })
})
