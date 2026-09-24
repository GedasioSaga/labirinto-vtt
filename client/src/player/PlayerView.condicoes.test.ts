/**
 * CONDIÇÃO NA FICHA na TELA DE QUEM JOGA: a ficha que chega marcada (a
 * própria ou outra que ele vê) é desenhada com a mesma pastilha do editor, e
 * o mestre desmarcar tira a marca. O redesenho só acontece quando a chave da
 * view muda — sem a condição na chave, a tela do jogador ficaria com a marca
 * velha até a ficha mudar de nome.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Token, TokenCondition } from '../types/map'
import { TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import { CONDITION_MARKS_LABEL } from '../pixi/drawTokenConditions'
import { createTokenView, paintTokenView, tokenViewKey } from './PlayerView'

const GRADE = 50

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'ogro', characterId: null, name: 'Ogro', x: 625, y: 325, size: 1, image: null, color: '#ff5a00', ...extra }
}

function corDa(condicao: TokenCondition): number {
  return Number.parseInt(TOKEN_CONDITION_SYMBOLS[condicao].fill.slice(1), 16)
}

function marcasDa(view: ReturnType<typeof createTokenView>): Graphics {
  const marcas = view.wrapper.children.find((c) => c.label === CONDITION_MARKS_LABEL)
  if (!(marcas instanceof Graphics)) throw new Error('a ficha do jogador não tem a camada de marcas de condição')
  return marcas
}

function coresPreenchidas(g: Graphics): number[] {
  return g.context.instructions
    .filter((i) => i.action === 'fill')
    .map((i) => (i.data as { style?: { color?: number } }).style?.color)
    .filter((c): c is number => typeof c === 'number')
}

describe('jogador — ficha com condição', () => {
  it('ficha de OUTRO que chega com "Caído" aparece com a marca em cima dela', () => {
    const view = createTokenView(ficha({ conditions: ['caido'] }), GRADE, false)
    const marcas = marcasDa(view)
    expect(coresPreenchidas(marcas)).toContain(corDa('caido'))
    expect(marcas.getLocalBounds().maxY).toBeLessThan(0)
    // Por cima do disco: a marca vem depois do corpo da ficha na pilha.
    expect(view.wrapper.getChildIndex(marcas)).toBeGreaterThan(view.wrapper.getChildIndex(view.body))
  })

  it('a PRÓPRIA ficha marcada "Envenenado" também mostra a marca', () => {
    const view = createTokenView(ficha({ id: 'lanterna', name: 'Lanterna', color: '#3cff00', conditions: ['envenenado'] }), GRADE, true)
    expect(coresPreenchidas(marcasDa(view))).toContain(corDa('envenenado'))
  })

  it('ficha sem condição não ganha marca nenhuma', () => {
    const view = createTokenView(ficha(), GRADE, false)
    expect(marcasDa(view).context.instructions).toHaveLength(0)
  })

  it('marcar e desmarcar mudam a chave da view (é o que manda repintar a ficha no snapshot seguinte)', () => {
    const sem = tokenViewKey(ficha(), GRADE, false)
    const caido = tokenViewKey(ficha({ conditions: ['caido'] }), GRADE, false)
    const dormindo = tokenViewKey(ficha({ conditions: ['dormindo'] }), GRADE, false)
    expect(caido).not.toBe(sem)
    expect(dormindo).not.toBe(caido)
    expect(tokenViewKey(ficha({ conditions: [] }), GRADE, false)).toBe(sem)
  })

  it('repintar sem a condição apaga a marca (o mestre desmarcou)', () => {
    const view = createTokenView(ficha({ conditions: ['caido'] }), GRADE, false)
    paintTokenView(view, ficha(), GRADE, false)
    expect(marcasDa(view).context.instructions).toHaveLength(0)
  })

  it('valor desconhecido que escapasse até aqui não vira marca', () => {
    const suja = { ...ficha(), conditions: ['veneno do mestre'] as unknown as TokenCondition[] }
    expect(marcasDa(createTokenView(suja, GRADE, false)).context.instructions).toHaveLength(0)
    expect(tokenViewKey(suja, GRADE, false)).toBe(tokenViewKey(ficha(), GRADE, false))
  })
})
