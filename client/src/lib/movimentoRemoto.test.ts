import { beforeEach, describe, expect, it } from 'vitest'
import { comMovimentoRemoto, consumirMovimentosRemotos } from './movimentoRemoto'
import { createEmptyMap } from './mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { subscribeToTokensRedraw } from '../stores/tokensSubscription'
import { hostPlayerChanges } from '../net/playerChanges'
import type { MapData, Token } from '../types/map'

/**
 * FICHA MOVIDA PELO JOGADOR — a marca que diz ao redraw do mestre "esta ficha
 * andou pela mão do jogador, pode deslizar". Ela só vale para o redraw que o
 * próprio movimento acorda: depois dele, não sobra para animar a próxima
 * edição do mestre (o desfazer, as setas, um arrasto).
 */

const heroi: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }

function mapa(): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), tokens: [heroi] }
}

beforeEach(() => {
  consumirMovimentosRemotos()
  useMapStore.getState().loadMap(mapa())
  useAdventureStore.setState({ cache: {}, dirty: {} })
})

describe('comMovimentoRemoto / consumirMovimentosRemotos', () => {
  it('dentro da aplicação a ficha está marcada; consumir devolve e esvazia', () => {
    let vistas: string[] = []
    comMovimentoRemoto('heroi', () => {
      vistas = [...consumirMovimentosRemotos()]
      expect(consumirMovimentosRemotos().size).toBe(0)
    })
    expect(vistas).toEqual(['heroi'])
  })

  it('movimento que ninguém desenhou (nada mudou na tela) não deixa marca para depois', () => {
    comMovimentoRemoto('heroi', () => {})
    expect(consumirMovimentosRemotos().size).toBe(0)
  })

  it('CASO OBRIGATÓRIO: a aplicação lança — a marca sai do mesmo jeito e o erro sobe', () => {
    expect(() =>
      comMovimentoRemoto('heroi', () => {
        throw new Error('ponte caiu')
      }),
    ).toThrow('ponte caiu')
    expect(consumirMovimentosRemotos().size).toBe(0)
  })

  it('sem marca nenhuma: conjunto vazio', () => {
    expect(consumirMovimentosRemotos().size).toBe(0)
  })
})

describe('applyMove do jogador marca a ficha ANTES do redraw que a store dispara', () => {
  it('o redraw das fichas, síncrono dentro do set da store, vê a ficha marcada', () => {
    const vistasNoRedraw: string[][] = []
    const parar = subscribeToTokensRedraw(() => vistasNoRedraw.push([...consumirMovimentosRemotos()]))
    try {
      hostPlayerChanges.applyMove('heroi', 240, 200)
    } finally {
      parar()
    }
    expect(vistasNoRedraw).toEqual([['heroi']])
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ x: 240, y: 200 })
    expect(consumirMovimentosRemotos().size).toBe(0)
  })

  it('movimento para onde a ficha já está (nada a redesenhar): a marca não fica esperando o Ctrl+Z do mestre', () => {
    hostPlayerChanges.applyMove('heroi', 200, 200)
    expect(consumirMovimentosRemotos().size).toBe(0)
  })

  it('movimento numa cena de fundo: nada marcado na cena aberta', () => {
    hostPlayerChanges.applyMove('heroi', 240, 200, 'cena-de-fundo')
    expect(consumirMovimentosRemotos().size).toBe(0)
  })

  it('o movimento do MESTRE (ação de edição) nunca chega marcado ao redraw', () => {
    const vistasNoRedraw: string[][] = []
    const parar = subscribeToTokensRedraw(() => vistasNoRedraw.push([...consumirMovimentosRemotos()]))
    try {
      useMapStore.getState().moveTokenLive('heroi', 280, 200)
    } finally {
      parar()
    }
    expect(vistasNoRedraw).toEqual([[]])
  })
})
