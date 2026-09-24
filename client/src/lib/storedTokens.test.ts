/**
 * GUARDAR FICHA nunca apaga ficha do ARQUIVO: quem grava passa as fichas
 * guardadas por `withStoredTokens`, cada uma na cena de onde saiu.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Token } from '../types/map'
import { storedTokensOfScene, withStoredTokens, type StoredToken } from './storedTokens'

function ficha(id: string, name: string, x: number): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'Mapa', 30, 10, 50), tokens }
}

const ESCUDO = ficha('f-escudo', 'Escudo', 300)
const LIRIO = ficha('f-lirio', 'Lírio', 100)

describe('withStoredTokens', () => {
  it('o Escudo guardado volta ao mapa que vai para o disco, igual ao que era', () => {
    const noEditor = mapa([LIRIO])
    const noDisco = withStoredTokens(noEditor, [{ token: ESCUDO, sceneId: null }])
    expect(noDisco.tokens).toEqual([LIRIO, ESCUDO])
    // O mapa do editor não muda: a ficha continua fora dele.
    expect(noEditor.tokens).toEqual([LIRIO])
  })

  it('ficha que já está no mapa (o mestre desfez a retirada) não entra duas vezes', () => {
    const noEditor = mapa([LIRIO, ESCUDO])
    expect(withStoredTokens(noEditor, [{ token: ESCUDO, sceneId: null }])).toBe(noEditor)
  })

  it('sem ficha guardada, o mapa é o mesmo (mesma referência)', () => {
    const noEditor = mapa([LIRIO])
    const noDisco = withStoredTokens(noEditor, [])
    expect(noDisco).toBe(noEditor)
    expect(noDisco.tokens).toHaveLength(1)
  })
})

describe('storedTokensOfScene', () => {
  const guardadas: StoredToken[] = [
    { token: ESCUDO, sceneId: 's-hall' },
    { token: ficha('f-machado', 'Machado', 700), sceneId: 's-cripta' },
    { token: ficha('f-arco', 'Arco', 500), sceneId: 's-sumida' },
    { token: ficha('f-adaga', 'Adaga', 200), sceneId: null },
  ]
  const cenas = { ids: new Set(['s-hall', 's-cripta']), activeId: 's-hall' }

  it('cada ficha vai para a cena de onde saiu', () => {
    expect(storedTokensOfScene(guardadas, 's-cripta', cenas).map((s) => s.token.id)).toEqual(['f-machado'])
  })

  it('a cena aberta leva também a de cena apagada e a do mapa solto: nenhuma fica sem arquivo', () => {
    expect(storedTokensOfScene(guardadas, 's-hall', cenas).map((s) => s.token.id)).toEqual(['f-escudo', 'f-arco', 'f-adaga'])
  })
})
