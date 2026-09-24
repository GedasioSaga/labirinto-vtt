import { describe, expect, it } from 'vitest'
import type { Token, Wall } from '../types/map'
import { findOtherTokenAt, findTappedOtherToken, tokenActionNoticeText, tokenCardName } from './tokenCard'

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

describe('findTappedOtherToken (ficha alheia contra a porta sob o mesmo dedo)', () => {
  const GRID = 50
  // Casa (100..150, 100..150) com o NPC no meio; a porta é a parede da direita dela.
  const npc = ficha('npc', 125, 125)
  const porta: Wall = { id: 'porta', x1: 150, y1: 100, x2: 150, y2: 150, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
  const FOLGA = 18

  it('o toque na porta (meio, pontas e lado de fora) é da porta, não do NPC na casa ao lado', () => {
    for (const ponto of [
      { x: 150, y: 125 },
      { x: 150, y: 100 },
      { x: 150, y: 150 },
      { x: 145, y: 125 },
      { x: 160, y: 125 },
      { x: 167, y: 125 },
    ]) {
      expect(findTappedOtherToken([npc], [], [porta], ponto, GRID, FOLGA)).toBeNull()
    }
  })

  it('o miolo do NPC continua abrindo o cartão com a porta ao lado', () => {
    expect(findTappedOtherToken([npc], [], [porta], { x: 125, y: 125 }, GRID, FOLGA)?.id).toBe('npc')
    expect(findTappedOtherToken([npc], [], [porta], { x: 135, y: 125 }, GRID, FOLGA)?.id).toBe('npc')
    // Zoom afastado: a folga (18 / 0,5 = 36) passa do centro do NPC, e o centro dele ainda é dele.
    expect(findTappedOtherToken([npc], [], [porta], { x: 125, y: 125 }, GRID, 36)?.id).toBe('npc')
  })

  it('sem porta sob o dedo, a folga inteira do NPC vale (e parede sem porta não conta)', () => {
    const parede: Wall = { ...porta, id: 'parede', door: null }
    expect(findTappedOtherToken([npc], [], [], { x: 150, y: 125 }, GRID, FOLGA)?.id).toBe('npc')
    expect(findTappedOtherToken([npc], [], [parede], { x: 160, y: 125 }, GRID, FOLGA)?.id).toBe('npc')
    expect(findTappedOtherToken([npc], ['npc'], [], { x: 125, y: 125 }, GRID, FOLGA)).toBeNull()
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
