import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiceStore } from '../../stores/diceStore'
import { DICE_FEED_MAX, type HostDiceRoll } from '../dice'
import { TRAVEL_LOG_MAX, type TravelLogEntry } from '../travelLog'
import type { SomId } from './receitas'
import { comSomDePassagem, instalarSonsDoMestre } from './sonsDoMestre'

/**
 * SONS DO MESTRE: só evento de jogo toca no app do mestre — dado rolado na
 * sala e ficha que trocou de cena na sessão. O que tocaria é registrado por um
 * `tocar` de mentira; como cada som soa já está em `tocarSom.test.ts`.
 */

const rolagem = (id: string): HostDiceRoll => ({ id, from: 'Ana', count: 1, sides: 6, modifier: 0, results: [3], total: 3, at: 0 })

function viagem(id: string, ficha = 'Ana'): TravelLogEntry {
  return {
    id,
    at: 0,
    playerId: `p-${ficha}`,
    tokenId: `t-${ficha}`,
    tokenName: ficha,
    fromSceneId: 'cena-salao',
    fromSceneName: 'Salão',
    fromX: 125,
    fromY: 125,
    toSceneId: 'cena-cripta',
    toSceneName: 'Cripta',
  }
}

function instalar() {
  const tocados: SomId[] = []
  const tocar = vi.fn((id: SomId) => {
    tocados.push(id)
  })
  const pararDeDestravar = vi.fn()
  const destravar = vi.fn((_alvo: EventTarget) => pararDeDestravar)
  const alvoDoGesto = new EventTarget()
  const desinstalar = instalarSonsDoMestre({ tocar, destravar, alvoDoGesto })
  return { tocados, tocar, destravar, pararDeDestravar, alvoDoGesto, desinstalar }
}

describe('sons do mestre: dado rolado na sala', () => {
  beforeEach(() => useDiceStore.getState().clear())

  it('cada rolagem nova da mesa (de jogador ou do mestre) toca o dado', () => {
    const { tocados, desinstalar } = instalar()
    useDiceStore.getState().push(rolagem('r1'))
    expect(tocados).toEqual(['dado'])
    useDiceStore.getState().push({ ...rolagem('r2'), hidden: true })
    expect(tocados).toEqual(['dado', 'dado'])
    desinstalar()
  })

  it('o que já estava na lista ao instalar não toca, nem a lista regravada sem rolagem nova', () => {
    useDiceStore.getState().push(rolagem('r1'))
    const { tocados, desinstalar } = instalar()
    useDiceStore.setState({ rolls: [...useDiceStore.getState().rolls] })
    expect(tocados).toEqual([])
    desinstalar()
  })

  it('sala fechada limpa a lista: não é rolagem, nada toca', () => {
    useDiceStore.getState().push(rolagem('r1'))
    const { tocados, desinstalar } = instalar()
    useDiceStore.getState().clear()
    expect(tocados).toEqual([])
    desinstalar()
  })

  it('com a lista cheia ainda toca: a mais velha sai e a nova entra', () => {
    for (let i = 0; i < DICE_FEED_MAX; i += 1) useDiceStore.getState().push(rolagem(`velha-${i}`))
    const { tocados, desinstalar } = instalar()
    useDiceStore.getState().push(rolagem('nova'))
    expect(useDiceStore.getState().rolls).toHaveLength(DICE_FEED_MAX)
    expect(tocados).toEqual(['dado'])
    desinstalar()
  })

  it('destrava o áudio no gesto feito no alvo; desinstalado, tira os ouvintes e rolagem não toca mais', () => {
    const { tocar, destravar, pararDeDestravar, alvoDoGesto, desinstalar } = instalar()
    expect(destravar).toHaveBeenCalledTimes(1)
    expect(destravar).toHaveBeenCalledWith(alvoDoGesto)
    desinstalar()
    expect(pararDeDestravar).toHaveBeenCalledTimes(1)
    useDiceStore.getState().push(rolagem('r1'))
    expect(tocar).not.toHaveBeenCalled()
  })

  it('som que falha não corta a rolagem: quem assina a lista depois dos sons fica sabendo dela', () => {
    const desinstalar = instalarSonsDoMestre({
      tocar: () => {
        throw new Error('sem saída de áudio')
      },
      destravar: () => () => undefined,
      alvoDoGesto: new EventTarget(),
    })
    const depois = vi.fn()
    const pararDepois = useDiceStore.subscribe(depois)
    expect(() => useDiceStore.getState().push(rolagem('r1'))).not.toThrow()
    expect(depois).toHaveBeenCalledTimes(1)
    pararDepois()
    desinstalar()
  })
})

describe('sons do mestre: passagem de verdade, pelo diário de viagens', () => {
  function diario(tocar: (id: SomId) => unknown = () => undefined) {
    const mostrados: TravelLogEntry[][] = []
    const aoMudar = comSomDePassagem((linhas: TravelLogEntry[]) => {
      mostrados.push(linhas)
    }, tocar)
    return { mostrados, aoMudar }
  }

  it('linha nova em cima do diário (uma ficha trocou de cena na sessão) toca a passagem, e o diário segue para a tela', () => {
    const tocados: SomId[] = []
    const { mostrados, aoMudar } = diario((id) => tocados.push(id))
    const primeira = [viagem('viagem-1')]
    aoMudar(primeira)
    expect(tocados).toEqual(['passagem'])
    expect(mostrados).toEqual([primeira])
    aoMudar([viagem('viagem-2', 'Bruno'), ...primeira])
    expect(tocados).toEqual(['passagem', 'passagem'])
  })

  it('"Desfazer" tira a linha e não toca: a volta corrige um engano, não é viagem', () => {
    const tocados: SomId[] = []
    const { mostrados, aoMudar } = diario((id) => tocados.push(id))
    const ana = viagem('viagem-1')
    const bruno = viagem('viagem-2', 'Bruno')
    aoMudar([ana])
    aoMudar([bruno, ana])
    tocados.length = 0
    aoMudar([ana])
    aoMudar([])
    expect(tocados).toEqual([])
    expect(mostrados.at(-1)).toEqual([])
  })

  it('fechar a sala zera o diário sem tocar; a primeira viagem da sala seguinte toca, mesmo com o id de antes', () => {
    const tocados: SomId[] = []
    const { aoMudar } = diario((id) => tocados.push(id))
    aoMudar([viagem('viagem-1')])
    aoMudar([])
    expect(tocados).toEqual(['passagem'])
    aoMudar([viagem('viagem-1')])
    expect(tocados).toEqual(['passagem', 'passagem'])
  })

  it('com o diário cheio ainda toca: a viagem nova entra em cima e a mais velha sai', () => {
    const tocados: SomId[] = []
    const { aoMudar } = diario((id) => tocados.push(id))
    const cheio = Array.from({ length: TRAVEL_LOG_MAX }, (_, i) => viagem(`viagem-${TRAVEL_LOG_MAX - i}`))
    aoMudar(cheio)
    tocados.length = 0
    aoMudar([viagem('viagem-nova'), ...cheio.slice(0, TRAVEL_LOG_MAX - 1)])
    expect(tocados).toEqual(['passagem'])
  })

  it('som que falha não corta a viagem: o diário chega à tela antes do som, e nada lança', () => {
    const { mostrados, aoMudar } = diario(() => {
      throw new Error('sem saída de áudio')
    })
    expect(() => aoMudar([viagem('viagem-1')])).not.toThrow()
    expect(mostrados).toHaveLength(1)
  })
})
