/**
 * OLHOS DO GUARDA, a marca do MESTRE (pedido de 09/11/2026): "mesmo a ficha
 * tendo vigilância não aparece para mim o ponto de interrogação nem o de
 * exclamação". A marca do mestre conta as fichas de JOGADOR mesmo com a sala
 * fechada: a ligada a uma ficha de jogador, a marcada "Ficha de jogador" e a
 * que tem dono na sala. O guarda do print é um token ligado a uma ficha de NPC.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenWatch } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { fichasDeJogadorNoMapa, guardAlerts } from './npcWatch'

const GRADE = 50
/** Vê em volta, 6 quadrados (300 px): até 150 px é "!", dali a 300 px é "?". */
const EM_VOLTA: TokenWatch = { direcao: 0, abertura: 360, alcance: 6 }
const FICHAS = [
  { id: 'ficha-aira', tipo: 'jogador' as const },
  { id: 'ficha-urso', tipo: 'npc' as const },
]
const SALA_FECHADA = {}

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 40, 20, GRADE), tokens }
}

/** O Urso do print: criado sem ficha e depois ligado à ficha de NPC, com a vigia ligada. */
const urso = token('urso', 500, 300, { characterId: 'ficha-urso', vigia: EM_VOLTA })

describe('fichasDeJogadorNoMapa: quem o guarda do mestre considera', () => {
  it('sala fechada: a ligada a ficha de jogador e a marcada "Ficha de jogador" contam; NPC e token sem ficha, não', () => {
    const tokens = [
      urso,
      token('aira', 600, 300, { characterId: 'ficha-aira' }),
      token('convidado', 620, 300, { playerCharacter: true }),
      token('lobo', 640, 300),
      token('orfa', 660, 300, { characterId: 'ficha-apagada' }),
    ]
    expect([...fichasDeJogadorNoMapa(tokens, FICHAS, SALA_FECHADA)].sort()).toEqual(['aira', 'convidado'])
  })

  it('sala aberta: a ficha que tem dono conta, mesmo sendo um NPC emprestado', () => {
    const tokens = [urso, token('lobo', 640, 300, { npc: true })]
    expect([...fichasDeJogadorNoMapa(tokens, FICHAS, { 'jogador-1': ['lobo'] })]).toEqual(['lobo'])
  })
})

describe('a marca do guarda no mapa do mestre, com a sala fechada', () => {
  const marcaCom = (aira: Token): string | undefined => {
    const map = mapa([urso, aira])
    return guardAlerts(map, fichasDeJogadorNoMapa(map.tokens, FICHAS, SALA_FECHADA)).get('urso')
  }

  it('ficha de jogador na borda do círculo: "?"; perto: "!"', () => {
    expect(marcaCom(token('aira', 500 + 250, 300, { characterId: 'ficha-aira' }))).toBe('?')
    expect(marcaCom(token('aira', 500 + 100, 300, { characterId: 'ficha-aira' }))).toBe('!')
  })

  it('fora do círculo a marca some, e NPC dentro dele não acende nada', () => {
    expect(marcaCom(token('aira', 500 + 400, 300, { characterId: 'ficha-aira' }))).toBeUndefined()
    expect(marcaCom(token('javali', 500 + 100, 300, { characterId: 'ficha-urso' }))).toBeUndefined()
  })
})
