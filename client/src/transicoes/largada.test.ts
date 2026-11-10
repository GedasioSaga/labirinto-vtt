import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { combinarLargada, entrarNaLargadaDoMestre, esperarLargadaDoJogador, FOLGA_DA_LARGADA_MS, PRAZO_DA_LARGADA_MS, telasQueFaltam } from './largada'

/**
 * A largada combinada: larga quando a última tela avisa "pronta" ou quando o
 * prazo vence, o que vier antes. Tela muda (cliente antigo) vale o prazo.
 */

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('largada combinada da cutscene', () => {
  it('larga quando a última tela avisa, sem esperar o prazo', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['c1', 'c2'], aoLargar })
    combinado.pronta('c1')
    expect(aoLargar).not.toHaveBeenCalled()
    expect(telasQueFaltam()).toBe(1)
    combinado.pronta('c2')
    expect(aoLargar).toHaveBeenCalledTimes(1)
    expect(telasQueFaltam()).toBe(0)
    // O prazo armado não larga de novo.
    vi.advanceTimersByTime(PRAZO_DA_LARGADA_MS * 2)
    expect(aoLargar).toHaveBeenCalledTimes(1)
  })

  it('tela que nunca responde (cliente antigo): larga no prazo', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['c1', 'antigo'], aoLargar })
    combinado.pronta('c1')
    vi.advanceTimersByTime(PRAZO_DA_LARGADA_MS - 1)
    expect(aoLargar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(aoLargar).toHaveBeenCalledTimes(1)
    // A resposta atrasada não larga outra vez nem volta a contar.
    combinado.pronta('antigo')
    expect(aoLargar).toHaveBeenCalledTimes(1)
    expect(telasQueFaltam()).toBe(0)
  })

  it('tela que caiu deixa de ser esperada', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['c1', 'c2'], aoLargar })
    combinado.pronta('c1')
    combinado.saiu('c2')
    expect(aoLargar).toHaveBeenCalledTimes(1)
  })

  it('a tela do mestre entra: os jogadores esperam por ela e ela larga junto', async () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['c1'], aoLargar })
    const lugar = entrarNaLargadaDoMestre()
    expect(lugar).not.toBeNull()
    let instante: number | null = null
    void lugar?.largada.then((quando) => {
      instante = quando
    })
    combinado.pronta('c1')
    // Só o mestre falta: o aviso "preparando para N telas" não conta a própria tela dele.
    expect(telasQueFaltam()).toBe(0)
    expect(aoLargar).not.toHaveBeenCalled()
    lugar?.pronta()
    expect(aoLargar).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(instante).not.toBeNull()
  })

  it('sem largada em curso, a tela do mestre toca sozinha; sala fechada no meio solta quem esperava', async () => {
    expect(entrarNaLargadaDoMestre()).toBeNull()
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['c1'], aoLargar })
    const lugar = entrarNaLargadaDoMestre()
    let soltou = false
    void lugar?.largada.then(() => {
      soltou = true
    })
    combinado.cancelar()
    await vi.advanceTimersByTimeAsync(0)
    expect(soltou).toBe(true)
    expect(aoLargar).not.toHaveBeenCalled()
  })
})

describe('o jogador espera a ordem de tocar', () => {
  it('a ordem chegou: larga no instante dela, e o teto não larga de novo', async () => {
    const espera = esperarLargadaDoJogador()
    const instantes: number[] = []
    void espera.largada.then((quando) => instantes.push(quando))
    espera.largou(1234)
    await vi.advanceTimersByTimeAsync(PRAZO_DA_LARGADA_MS + FOLGA_DA_LARGADA_MS)
    expect(instantes).toEqual([1234])
  })

  it('a ordem nunca chega (o fio caiu): o teto solta a tela, depois do prazo do mestre', async () => {
    const espera = esperarLargadaDoJogador()
    let soltou = false
    void espera.largada.then(() => {
      soltou = true
    })
    await vi.advanceTimersByTimeAsync(PRAZO_DA_LARGADA_MS)
    expect(soltou).toBe(false)
    await vi.advanceTimersByTimeAsync(FOLGA_DA_LARGADA_MS)
    expect(soltou).toBe(true)
  })
})
