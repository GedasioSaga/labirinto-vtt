import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AQUECIMENTO das cutscenes (09/11/2026): o código começa a baixar JÁ na
 * entrada da sala (quem recebia a ordem 1 s depois de entrar não via nada),
 * nada é baixado por cima de uma cutscene no ar, e a abertura que o mestre
 * escolheu é pré-compilada pela intenção, uma vez por página.
 */

const motor = vi.hoisted(() => {
  /** O motor de mentira: `noAr` liga uma cutscene tocando; `soltar` a termina. */
  const ar = { noAr: false, soltar: (): void => undefined }
  return {
    ar,
    carregarThree: vi.fn(() => Promise.resolve({})),
    resolverFabricaDaCena: vi.fn((_id: string) => Promise.resolve(null)),
    preCompilarAbertura: vi.fn((_id: string, _reduzirMovimento: boolean) => Promise.resolve(true)),
    preCompilarTransicao: vi.fn((_id: string, _reduzirMovimento: boolean) => Promise.resolve(true)),
    semCutsceneNoAr: vi.fn((): Promise<void> => {
      if (!ar.noAr) return Promise.resolve()
      return new Promise<void>((feito) => {
        ar.soltar = () => {
          ar.noAr = false
          feito()
        }
      })
    }),
  }
})

vi.mock('./motor', () => ({
  temWebGL: () => true,
  carregarThree: motor.carregarThree,
  resolverFabricaDaCena: motor.resolverFabricaDaCena,
  preCompilarAbertura: motor.preCompilarAbertura,
  preCompilarTransicao: motor.preCompilarTransicao,
  semCutsceneNoAr: motor.semCutsceneNoAr,
}))

const MAPA = { pins: [{ transicao: { id: 'porta' } }, { transicao: { id: 'porta' } }, {}], stairs: [{ transicao: { id: 'escada-pedra' } }] }

async function aquecimentoNovo() {
  vi.resetModules()
  return import('./aquecimento')
}

beforeEach(() => {
  vi.useFakeTimers()
  motor.ar.noAr = false
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('aquecimento: o código baixa já na entrada da sala', () => {
  it('o motor é pedido na hora, sem esperar a página ficar ociosa, e uma vez só', async () => {
    const { aquecerMotorDasCutscenes } = await aquecimentoNovo()
    aquecerMotorDasCutscenes()
    expect(motor.carregarThree).toHaveBeenCalledTimes(1)
    aquecerMotorDasCutscenes()
    expect(motor.carregarThree).toHaveBeenCalledTimes(1)
  })

  it('as transições do mapa são pedidas sem espera, cada uma uma vez', async () => {
    const { aquecerTransicoesDoMapa } = await aquecimentoNovo()
    aquecerTransicoesDoMapa(MAPA)
    await vi.advanceTimersByTimeAsync(0)
    expect(motor.resolverFabricaDaCena.mock.calls.map(([id]) => id)).toEqual(['porta', 'escada-pedra'])
    aquecerTransicoesDoMapa(MAPA)
    await vi.advanceTimersByTimeAsync(0)
    expect(motor.resolverFabricaDaCena).toHaveBeenCalledTimes(2)
  })
})

describe('aquecimento: nada por cima de uma cutscene no ar', () => {
  it('o mapa novo chega no meio da travessia: o código das transições dele espera a cena acabar', async () => {
    const { aquecerTransicoesDoMapa } = await aquecimentoNovo()
    motor.ar.noAr = true
    aquecerTransicoesDoMapa(MAPA)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(motor.resolverFabricaDaCena).not.toHaveBeenCalled()
    motor.ar.soltar()
    await vi.advanceTimersByTimeAsync(0)
    expect(motor.resolverFabricaDaCena).toHaveBeenCalledTimes(2)
  })
})

describe('aquecimento pela intenção', () => {
  it('a abertura escolhida é pré-compilada com a página ociosa, uma vez por id', async () => {
    const { aquecerAbertura, ESPERA_DA_OCIOSIDADE_MAX_MS } = await aquecimentoNovo()
    aquecerAbertura('espadas-cruzadas')
    aquecerAbertura('espadas-cruzadas')
    // O download do motor não espera a ociosidade; a parte que pesa na CPU, sim.
    expect(motor.carregarThree).toHaveBeenCalledTimes(1)
    expect(motor.preCompilarAbertura).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(ESPERA_DA_OCIOSIDADE_MAX_MS)
    // Uma vez, no movimento deste aparelho (aqui, sem "reduzir movimento").
    expect(motor.preCompilarAbertura.mock.calls).toEqual([['espadas-cruzadas', false]])
  })

  it('abertura que este app ainda não tem (pacote descendo): a próxima intenção tenta de novo', async () => {
    const { aquecerAbertura, ESPERA_DA_OCIOSIDADE_MAX_MS } = await aquecimentoNovo()
    motor.preCompilarAbertura.mockResolvedValueOnce(false)
    aquecerAbertura('tiro-na-tela')
    await vi.advanceTimersByTimeAsync(ESPERA_DA_OCIOSIDADE_MAX_MS)
    aquecerAbertura('tiro-na-tela')
    await vi.advanceTimersByTimeAsync(ESPERA_DA_OCIOSIDADE_MAX_MS)
    expect(motor.preCompilarAbertura).toHaveBeenCalledTimes(2)
  })
})
