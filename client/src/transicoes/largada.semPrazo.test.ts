import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { combinarLargadaSemPrazo, largarAgora, telasQueFaltam, TETO_DA_TELA_CARREGANDO_MS } from './largada'

/**
 * CUTSCENE EM VÍDEO (14/11/2026): a largada SEM prazo. O vídeo só toca quando
 * todas as telas avisaram "pronta" (o vídeo inteiro baixado) ou caíram; quem
 * entra durante a espera também é esperado; o mestre larga já com "Tocar agora".
 */

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('combinarLargadaSemPrazo', () => {
  it('espera todas as telas sem prazo nenhum, inclui quem entra na espera e não segura por quem cai', async () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargadaSemPrazo({ telas: ['ana', 'bia'], aoLargar })
    combinado.pronta('ana')
    // Muito além de qualquer prazo da largada da batalha: a tela lenta continua esperada.
    await vi.advanceTimersByTimeAsync(TETO_DA_TELA_CARREGANDO_MS * 10)
    combinado.carregando('bia')
    expect(aoLargar).not.toHaveBeenCalled()
    expect(combinado.faltam()).toEqual(['bia'])
    // Entrou na sala durante a espera: passa a ser esperado; entrar de novo não duplica.
    combinado.incluir('caio')
    combinado.incluir('caio')
    combinado.incluir('ana')
    expect(combinado.faltam()).toEqual(['bia', 'caio'])
    combinado.pronta('bia')
    expect(aoLargar).not.toHaveBeenCalled()
    // Caiu: sai da conta e a mesa larga com quem ficou.
    combinado.saiu('caio')
    expect(aoLargar).toHaveBeenCalledTimes(1)
    combinado.pronta('caio')
    expect(aoLargar).toHaveBeenCalledTimes(1)
    // Fora das largadas da batalha: o contador e o "Tocar agora" da abertura não a veem.
    expect(telasQueFaltam()).toBe(0)
  })

  it('"Tocar agora" larga já e só uma vez; sem tela larga sozinha; cancelada nunca larga', async () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargadaSemPrazo({ telas: ['ana', 'bia'], aoLargar })
    largarAgora()
    expect(aoLargar).not.toHaveBeenCalled()
    combinado.largarJa()
    combinado.largarJa()
    combinado.pronta('ana')
    expect(aoLargar).toHaveBeenCalledTimes(1)
    // Depois da largada, quem entra não vira esperado (assiste do início quando baixar).
    combinado.incluir('caio')
    expect(combinado.faltam()).toEqual([])

    const semNinguem = vi.fn()
    combinarLargadaSemPrazo({ telas: [], aoLargar: semNinguem })
    expect(semNinguem).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(semNinguem).toHaveBeenCalledTimes(1)

    const cancelada = vi.fn()
    const parado = combinarLargadaSemPrazo({ telas: ['ana'], aoLargar: cancelada })
    parado.cancelar()
    parado.pronta('ana')
    parado.largarJa()
    expect(cancelada).not.toHaveBeenCalled()
  })
})
