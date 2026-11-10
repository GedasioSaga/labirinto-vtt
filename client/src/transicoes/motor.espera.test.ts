import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esquecerTransicoesDeFora, marcarCarregamentoDeFora } from './catalogo'
import { ESPERA_DO_PACOTE_MAX_MS, entradaNaCena, haCutsceneNoAr, semCutsceneNoAr, tocarAberturaDeBatalha, tocarTransicao } from './motor'

/**
 * As esperas do motor têm prazo (09/11/2026): pacote de animações travado não
 * deixa a tela preta em "Preparando a cena…", quem entra atrasado cai no ponto
 * certo da cena, e do pedido ao fim a página sabe que há cutscene no ar (o
 * aquecimento não baixa nada por cima dela).
 */

const pacoteTravado = (): void => marcarCarregamentoDeFora(new Promise<void>(() => undefined))

beforeEach(() => {
  vi.useFakeTimers()
  // Com "WebGL", o motor passa da primeira porta e chega à espera do pacote.
  vi.stubGlobal('WebGLRenderingContext', class {})
})

afterEach(async () => {
  // Solta o pacote "travado" do teste: o próximo começa sem carregamento em curso.
  marcarCarregamentoDeFora(Promise.resolve())
  await vi.advanceTimersByTimeAsync(ESPERA_DO_PACOTE_MAX_MS + 1)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  esquecerTransicoesDeFora()
})

describe('motor: a espera pelo pacote tem teto', () => {
  it('transição pedida com o pacote travado: o jogador volta ao jogo no teto, em vez da tela preta sem fim', async () => {
    pacoteTravado()
    const onFim = vi.fn()
    void tocarTransicao({ canvas: document.createElement('canvas'), escolha: { id: 'tunel' }, volume: 0, reduzirMovimento: true, onFim })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_PACOTE_MAX_MS - 1)
    expect(onFim).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(onFim).toHaveBeenCalledTimes(1)
  })

  it('abertura pedida com o pacote travado e a mesa já largada: idem, uma vez só', async () => {
    pacoteTravado()
    const onFim = vi.fn()
    void tocarAberturaDeBatalha({ canvas: document.createElement('canvas'), id: 'duelo', volume: 0, reduzirMovimento: true, largada: Promise.resolve(performance.now()), onFim })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_PACOTE_MAX_MS + 1)
    expect(onFim).toHaveBeenCalledTimes(1)
    // A vigia da cena perdida, armada antes da espera, não avisa o fim de novo.
    await vi.advanceTimersByTimeAsync(20_000)
    expect(onFim).toHaveBeenCalledTimes(1)
  })
})

describe('motor: entrada na cena pela largada combinada', () => {
  it('pronta antes de a mesa largar: entra no começo', () => {
    expect(entradaNaCena({ largouEm: 1000, agora: 1000, escala: 1, naturalS: 3 })).toEqual({ inicio: 1000, entradaS: 0, perdeu: false })
  })

  it('pronta depois: entra no ponto em que a mesa está; com a cena inteira passada, perdeu', () => {
    expect(entradaNaCena({ largouEm: 1000, agora: 2500, escala: 1, naturalS: 3 })).toEqual({ inicio: 1000, entradaS: 1.5, perdeu: false })
    expect(entradaNaCena({ largouEm: 1000, agora: 4000, escala: 1, naturalS: 3 }).perdeu).toBe(true)
  })
})

describe('motor: cutscene no ar', () => {
  it('do pedido ao fim conta como no ar, e quem espera por ela é solto no fim', async () => {
    pacoteTravado()
    expect(haCutsceneNoAr()).toBe(false)
    void tocarTransicao({ canvas: document.createElement('canvas'), escolha: { id: 'tunel' }, volume: 0, reduzirMovimento: true, onFim: () => undefined })
    expect(haCutsceneNoAr()).toBe(true)
    let livre = false
    void semCutsceneNoAr().then(() => {
      livre = true
    })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_PACOTE_MAX_MS - 1)
    expect(livre).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(haCutsceneNoAr()).toBe(false)
    expect(livre).toBe(true)
  })

  it('quem pulou no meio do preparo também sai do ar; a prévia que repete nunca entra', async () => {
    pacoteTravado()
    const desistencia = new AbortController()
    void tocarTransicao({ canvas: document.createElement('canvas'), escolha: { id: 'tunel' }, volume: 0, reduzirMovimento: true, sinal: desistencia.signal, onFim: () => undefined })
    expect(haCutsceneNoAr()).toBe(true)
    desistencia.abort()
    expect(haCutsceneNoAr()).toBe(false)
    void tocarTransicao({ canvas: document.createElement('canvas'), escolha: { id: 'tunel' }, volume: 0, reduzirMovimento: true, repetir: true, onFim: () => undefined })
    expect(haCutsceneNoAr()).toBe(false)
  })
})
