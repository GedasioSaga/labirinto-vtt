import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { PASS_TOKEN_ELSEWHERE_LABEL, passTokenOptions, readPinPass, tokenHasPass, withPassItem, withPassToken } from './pinPass'
import { PIN_PASSAGE_ORDER, isPinPassage } from './pins'

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

describe('passe do pino', () => {
  it('"passe" é um modo de passagem do pino de viagem', () => {
    expect(isPinPassage('passe')).toBe(true)
    expect(PIN_PASSAGE_ORDER).toContain('passe')
  })

  it('o item do passe vale sem ligar para maiúscula, acento ou espaço em volta', () => {
    const passe = { item: 'Crachá' }
    expect(tokenHasPass(passe, ficha('fabi', { mochila: [{ id: 'i', nome: '  cracha ' }] }))).toBe(true)
    expect(tokenHasPass(passe, ficha('caio', { mochila: [{ id: 'i', nome: 'Lanterna' }] }))).toBe(false)
    expect(tokenHasPass(passe, ficha('sem-mochila'))).toBe(false)
  })

  it('a marca do mestre vale pelo id da ficha, mesmo sem item', () => {
    expect(tokenHasPass({ fichas: ['bia'] }, ficha('bia'))).toBe(true)
    expect(tokenHasPass({ fichas: ['bia'] }, ficha('caio'))).toBe(false)
  })

  it('pino sem passe configurado não deixa ninguém passar sozinho', () => {
    expect(tokenHasPass(undefined, ficha('fabi', { mochila: [{ id: 'i', nome: 'Crachá' }] }))).toBe(false)
    expect(tokenHasPass({}, ficha('fabi'))).toBe(false)
  })

  it('leitura do disco: forma certa fica, lixo volta ausente, ids repetidos ou vazios saem', () => {
    expect(readPinPass({ item: '  Crachá  ', fichas: ['a', 'a', '', 7, 'b'] })).toEqual({ item: 'Crachá', fichas: ['a', 'b'] })
    expect(readPinPass({ item: '   ', fichas: [] })).toBeUndefined()
    expect(readPinPass('Crachá')).toBeUndefined()
    expect(readPinPass(null)).toBeUndefined()
    expect(readPinPass({ fichas: 'a' })).toBeUndefined()
  })

  it('marcar e desmarcar ficha mantém o item; tirar tudo apaga o passe', () => {
    const comItem = withPassItem(undefined, 'Crachá')
    expect(comItem).toEqual({ item: 'Crachá' })
    const marcado = withPassToken(comItem, 'bia', true)
    expect(marcado).toEqual({ item: 'Crachá', fichas: ['bia'] })
    expect(withPassToken(marcado, 'bia', true)).toEqual({ item: 'Crachá', fichas: ['bia'] })
    expect(withPassItem(withPassToken(marcado, 'bia', false), '  ')).toBeUndefined()
  })

  it('painel: fichas de jogador da cena, NPC fora, e a marcada que viajou continua desmarcável', () => {
    const opcoes = passTokenOptions([ficha('fabi'), ficha('guarda', { npc: true }), ficha('caio')], { fichas: ['caio', 'longe'] })
    expect(opcoes).toEqual([
      { id: 'fabi', nome: 'fabi', marcada: false },
      { id: 'caio', nome: 'caio', marcada: true },
      { id: 'longe', nome: PASS_TOKEN_ELSEWHERE_LABEL, marcada: true },
    ])
  })

  it('o passe do pino sobrevive a salvar e abrir; pino antigo não ganha o campo', () => {
    const map = {
      ...createEmptyMap('m', 'Saguão', 10, 10, 50),
      pins: [
        { id: 'catraca', x: 1, y: 2, kind: 'viagem' as const, description: '', image: null, passagem: 'passe' as const, passe: { item: 'Crachá', fichas: ['bia'] } },
        { id: 'antigo', x: 3, y: 4, kind: 'viagem' as const, description: '', image: null },
      ],
    }
    const lido = deserializeMap(serializeMap(map)).pins
    expect(lido[0]).toMatchObject({ passagem: 'passe', passe: { item: 'Crachá', fichas: ['bia'] } })
    expect(lido[1]?.passe).toBeUndefined()
  })
})
