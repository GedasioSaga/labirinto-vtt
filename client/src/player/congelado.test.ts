// @vitest-environment node
/**
 * CONGELAR FICHA na tela de quem joga — as frases. A recusa do passo e a da
 * passagem dizem "Congelado pelo mestre" (a jogadora não acha que o app
 * travou), e o aviso fixo da tela diz quais fichas DELA estão congeladas.
 */
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { avisoDeCongelado } from './congeladoNotice'
import { latestActionNotice, moveNoticeText } from './moveNotice'
import { travelNoticeText } from './travelNoticeText'

function ficha(id: string, name: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 0, y: 0, size: 1, image: null, ...extra }
}

describe('recusas com o motivo `congelado`', () => {
  it('o passo recusado diz que o mestre congelou', () => {
    expect(moveNoticeText('congelado')).toBe('Congelado pelo mestre')
    expect(latestActionNotice(undefined, { id: 4, reason: 'congelado' })).toEqual({ id: 4, text: 'Congelado pelo mestre' })
  })

  it('a passagem recusada diz o mesmo, e que não dá para passar agora', () => {
    expect(travelNoticeText({ id: 1, phase: 'rejected', reason: 'congelado' })).toBe('Congelado pelo mestre: não dá para passar agora')
  })
})

describe('avisoDeCongelado — o aviso fixo da tela', () => {
  it('sem ficha dele congelada, nada', () => {
    expect(avisoDeCongelado([ficha('a', 'Lanterna'), ficha('npc', 'Guarda', { congelado: true })], ['a'])).toBeNull()
    expect(avisoDeCongelado([], [])).toBeNull()
  })

  it('todas as fichas dele congeladas: a frase curta', () => {
    expect(avisoDeCongelado([ficha('a', 'Lanterna', { congelado: true })], ['a'])).toBe('Congelado pelo mestre')
    expect(avisoDeCongelado([ficha('a', 'Lanterna', { congelado: true }), ficha('b', 'Pônei', { congelado: true })], ['a', 'b'])).toBe('Congelado pelo mestre')
  })

  it('só algumas: diz quais', () => {
    const tokens = [ficha('a', 'Lanterna'), ficha('b', 'Pônei', { congelado: true }), ficha('c', 'Coruja', { congelado: true }), ficha('d', 'Cão', { congelado: true })]
    expect(avisoDeCongelado(tokens.slice(0, 2), ['a', 'b'])).toBe('Congelado pelo mestre: Pônei')
    expect(avisoDeCongelado(tokens, ['a', 'b', 'c', 'd'])).toBe('Congelado pelo mestre: Pônei, Coruja e Cão')
  })

  it('ficha sem nome aparece como "sua ficha", nunca como texto vazio', () => {
    expect(avisoDeCongelado([ficha('a', 'Lanterna'), ficha('b', '  ', { congelado: true })], ['a', 'b'])).toBe('Congelado pelo mestre: sua ficha')
  })
})
