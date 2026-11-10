import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BATIDA_DE_CARREGANDO_MS,
  combinarLargada,
  entrarNaLargadaDoMestre,
  esperarLargadaDoJogador,
  FOLGA_DA_LARGADA_MS,
  largarAgora,
  PRAZO_DA_LARGADA_MS,
  telasQueFaltam,
  TETO_DA_TELA_CARREGANDO_MS,
} from './largada'

/**
 * A largada combinada: larga quando a última tela avisa "pronta" ou quando o
 * prazo vence, o que vier antes. Tela muda (cliente antigo, aba travada) vale o
 * prazo curto; tela viva que ainda carrega estica até o teto maior; e o mestre
 * pode largar já ("Tocar agora").
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

  it('tela viva e carregando segura a largada além do prazo curto, e larga quando fica pronta', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['lenta'], aoLargar })
    // A cada batida a tela diz "ainda carrego": o prazo curto (o de tela muda) não vence para ela.
    for (let passou = 0; passou < PRAZO_DA_LARGADA_MS * 2; passou += BATIDA_DE_CARREGANDO_MS) {
      combinado.carregando('lenta')
      vi.advanceTimersByTime(BATIDA_DE_CARREGANDO_MS)
    }
    expect(aoLargar).not.toHaveBeenCalled()
    expect(telasQueFaltam()).toBe(1)
    combinado.pronta('lenta')
    expect(aoLargar).toHaveBeenCalledTimes(1)
  })

  it('tela viva que nunca fica pronta: larga no teto maior, não antes', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['lenta'], aoLargar })
    const bater = setInterval(() => combinado.carregando('lenta'), BATIDA_DE_CARREGANDO_MS)
    combinado.carregando('lenta')
    vi.advanceTimersByTime(TETO_DA_TELA_CARREGANDO_MS - 1)
    expect(aoLargar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(aoLargar).toHaveBeenCalledTimes(1)
    clearInterval(bater)
  })

  it('tela que carregava e calou (travou, a aba morreu) volta a valer o prazo curto, contado da última batida', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['calou'], aoLargar })
    vi.advanceTimersByTime(1000)
    combinado.carregando('calou')
    vi.advanceTimersByTime(PRAZO_DA_LARGADA_MS - 1)
    expect(aoLargar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(aoLargar).toHaveBeenCalledTimes(1)
  })

  it('tela muda não segura a mesa pela tela viva: sai da conta no prazo curto, e a viva segue esperada', () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['muda', 'lenta'], aoLargar })
    const bater = setInterval(() => combinado.carregando('lenta'), BATIDA_DE_CARREGANDO_MS)
    combinado.carregando('lenta')
    vi.advanceTimersByTime(PRAZO_DA_LARGADA_MS)
    expect(aoLargar).not.toHaveBeenCalled()
    expect(telasQueFaltam()).toBe(1)
    combinado.pronta('lenta')
    expect(aoLargar).toHaveBeenCalledTimes(1)
    clearInterval(bater)
  })

  it('"Tocar agora": o mestre larga já, sem esperar quem carrega', async () => {
    const aoLargar = vi.fn()
    const combinado = combinarLargada({ telas: ['lenta'], aoLargar })
    combinado.carregando('lenta')
    const lugar = entrarNaLargadaDoMestre()
    lugar?.pronta()
    let largou = false
    void lugar?.largada.then(() => {
      largou = true
    })
    expect(aoLargar).not.toHaveBeenCalled()
    largarAgora()
    expect(aoLargar).toHaveBeenCalledTimes(1)
    expect(telasQueFaltam()).toBe(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(largou).toBe(true)
    // Nada armado sobra para largar de novo.
    vi.advanceTimersByTime(TETO_DA_TELA_CARREGANDO_MS)
    expect(aoLargar).toHaveBeenCalledTimes(1)
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
    await vi.advanceTimersByTimeAsync(TETO_DA_TELA_CARREGANDO_MS + FOLGA_DA_LARGADA_MS)
    expect(instantes).toEqual([1234])
  })

  it('a ordem nunca chega (o fio caiu): o teto solta a tela, depois do maior prazo do mestre', async () => {
    const espera = esperarLargadaDoJogador()
    let soltou = false
    void espera.largada.then(() => {
      soltou = true
    })
    // O mestre pode esperar uma tela viva até o teto maior: a tela pronta não toca sozinha antes disso.
    await vi.advanceTimersByTimeAsync(TETO_DA_TELA_CARREGANDO_MS)
    expect(soltou).toBe(false)
    await vi.advanceTimersByTimeAsync(FOLGA_DA_LARGADA_MS)
    expect(soltou).toBe(true)
  })
})
