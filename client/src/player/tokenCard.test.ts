import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { findOtherTokenAt, tokenActionNoticeText, tokenCardName } from './tokenCard'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

describe('findOtherTokenAt (toque curto na ficha alheia)', () => {
  const GRID = 50

  it('acha a ficha alheia sob o dedo, dentro do raio dela mais a folga do dedo', () => {
    const tokens = [ficha('minha', 100, 100), ficha('npc', 300, 100)]
    expect(findOtherTokenAt(tokens, ['minha'], { x: 310, y: 105 }, GRID, 0)?.id).toBe('npc')
    // Fora do raio (25 px) mas dentro da folga (10 px): ainda pega.
    expect(findOtherTokenAt(tokens, ['minha'], { x: 334, y: 100 }, GRID, 10)?.id).toBe('npc')
    expect(findOtherTokenAt(tokens, ['minha'], { x: 334, y: 100 }, GRID, 0)).toBeNull()
  })

  it('a própria ficha nunca abre o cartão (ela é arrastada, não lida)', () => {
    const tokens = [ficha('minha', 100, 100)]
    expect(findOtherTokenAt(tokens, ['minha'], { x: 100, y: 100 }, GRID, 0)).toBeNull()
  })

  it('duas fichas no mesmo lugar: ganha a desenhada por último (a de cima)', () => {
    const tokens = [ficha('baixo', 200, 200), ficha('cima', 205, 200)]
    expect(findOtherTokenAt(tokens, [], { x: 203, y: 200 }, GRID, 0)?.id).toBe('cima')
  })

  it('ficha grande: o raio cresce com o tamanho', () => {
    const tokens = [ficha('ogro', 400, 400, { size: 2 })]
    expect(findOtherTokenAt(tokens, [], { x: 445, y: 400 }, GRID, 0)?.id).toBe('ogro')
  })
})

describe('texto do cartão e do aviso', () => {
  it('nome vazio (o mestre escondeu o nome) vira "Alguém", nunca some', () => {
    expect(tokenCardName(ficha('x', 0, 0, { name: '' }))).toBe('Alguém')
    expect(tokenCardName(ficha('x', 0, 0, { name: '  Mulher de capuz ' }))).toBe('Mulher de capuz')
  })

  it('cada fase do pedido diz o que aconteceu, com a ação e a ficha', () => {
    expect(tokenActionNoticeText({ id: 1, phase: 'waiting', action: 'empurrar', targetName: 'Severa' })).toBe('Pedido ao mestre: Empurrar Severa. Aguardando…')
    expect(tokenActionNoticeText({ id: 1, phase: 'accepted', action: 'falar', targetName: 'Severa' })).toBe('O mestre aceitou: Falar com Severa')
    expect(tokenActionNoticeText({ id: 1, phase: 'refused', action: 'oferecer', targetName: 'Severa' })).toBe('O mestre recusou: Oferecer a Severa')
    expect(tokenActionNoticeText({ id: 1, phase: 'rejected', reason: 'unavailable', action: 'empurrar', targetName: 'Severa' })).toBe('Não dá para fazer isso agora.')
    expect(tokenActionNoticeText({ id: 1, phase: 'rejected', reason: 'pending', action: 'empurrar', targetName: 'Severa' })).toBe('Você já tem um pedido esperando o mestre.')
    expect(tokenActionNoticeText({ id: 1, phase: 'rejected', reason: 'too_soon', action: 'empurrar', targetName: 'Severa' })).toBe('Espere um instante antes de pedir de novo.')
  })
})
