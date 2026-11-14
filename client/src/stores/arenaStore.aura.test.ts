// @vitest-environment node
/**
 * ARENA — a cópia herda a AURA do mapa (pedido do mestre, 14/11/2026: "Sim,
 * herda do mapa"): o token da mesma ficha na cena aberta tem aura, a cópia
 * nasce com o mesmo tipo e o mesmo interruptor; a ficha sem token (ou sem
 * aura) na cena nasce sem aura.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { ID_ONE_PIECE, SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { useArenaStore } from './arenaStore'
import { useMapStore } from './mapStore'

function ficha(id: string, nome: string, agilidade: number): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome)
  return { ...base, id, atributos: { ...base.atributos, agilidade }, recursos: { hp: 600, sp: 100, escudo: 0 }, maximos: { hp: 600, sp: 100 } }
}

const BRUNO = ficha('p-bruno', 'Bruno', 30)
const ILO = ficha('p-ilo', 'Ilo', 10)

function tokenNoMapa(id: string, characterId: string, aura?: Token['aura']): Token {
  const token: Token = { id, characterId, name: id, x: 32, y: 32, size: 1, image: null, color: '#ffffff' }
  if (aura !== undefined) token.aura = aura
  return token
}

afterEach(() => {
  useArenaStore.getState().sair()
})

describe('arena: a cópia herda a aura do token da mesma ficha na cena aberta', () => {
  it('Bruno com Fogo desligado no mapa nasce com Fogo desligado; Ilo sem aura nasce sem aura', () => {
    const mapa = createEmptyMap('map_aura', 'Vale', 10, 10, 64)
    useMapStore.getState().loadMap({ ...mapa, tokens: [tokenNoMapa('t-ilo', ILO.id), tokenNoMapa('t-bruno', BRUNO.id, { tipo: 'fogo', ligada: false })] })

    const arena = useArenaStore.getState()
    arena.abrir(ID_ONE_PIECE)
    arena.escolher(BRUNO.id, 'a')
    arena.escolher(ILO.id, 'b')
    expect(useArenaStore.getState().lutar([BRUNO, ILO])).toBe(true)

    const tokens = useArenaStore.getState().sessao?.tokens ?? []
    expect(tokens.find((token) => token.name === 'Bruno')?.aura).toEqual({ tipo: 'fogo', ligada: false })
    const doIlo = tokens.find((token) => token.name === 'Ilo')
    expect(doIlo).toBeDefined()
    expect(doIlo !== undefined && 'aura' in doIlo).toBe(false)
  })
})
