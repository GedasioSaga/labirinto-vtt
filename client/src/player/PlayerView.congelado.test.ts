// @vitest-environment node
/**
 * CONGELAR FICHA na TELA DE QUEM JOGA: a PRÓPRIA ficha congelada ganha o
 * floco, no canto de cima à esquerda (o lugar do cadeado) — o jogador vê que
 * ela não anda antes de arrastar. Descongelar tira o floco: o campo entra na
 * chave da view. Travada E congelada mostra o cadeado, que segura mais.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Token } from '../types/map'
import { TOKEN_FROST_LABEL } from '../pixi/drawTokenFrozen'
import { TOKEN_LOCK_LABEL } from '../pixi/drawTokenLock'
import { createTokenView, paintTokenView, tokenViewKey } from './PlayerView'

const GRADE = 50

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'lanterna', characterId: null, name: 'Lanterna', x: 425, y: 325, size: 1, image: null, ...extra }
}

function camada(view: ReturnType<typeof createTokenView>, label: string): Graphics {
  const achada = view.wrapper.children.find((c) => c.label === label)
  if (!(achada instanceof Graphics)) throw new Error(`a ficha do jogador não tem a camada ${label}`)
  return achada
}

const floco = (view: ReturnType<typeof createTokenView>) => camada(view, TOKEN_FROST_LABEL)

describe('jogador — floco na ficha congelada pelo mestre', () => {
  it('a PRÓPRIA ficha congelada mostra o floco, por cima do disco e à esquerda do topo', () => {
    const view = createTokenView(ficha({ congelado: true }), GRADE, true)
    const desenho = floco(view)
    expect(desenho.context.instructions.length).toBeGreaterThan(0)
    const caixa = desenho.getLocalBounds()
    expect(caixa.maxX).toBeLessThan(0)
    expect(caixa.maxY).toBeLessThan(0)
    expect(view.wrapper.getChildIndex(desenho)).toBeGreaterThan(view.wrapper.getChildIndex(view.body))
  })

  it('solta, nada de floco', () => {
    expect(floco(createTokenView(ficha(), GRADE, true)).context.instructions).toHaveLength(0)
    expect(floco(createTokenView(ficha({ congelado: false }), GRADE, true)).context.instructions).toHaveLength(0)
  })

  it('ficha de OUTRO nunca mostra floco, nem se o campo escapasse até aqui', () => {
    expect(floco(createTokenView(ficha({ id: 'guarda', congelado: true }), GRADE, false)).context.instructions).toHaveLength(0)
  })

  it('travada e congelada: o cadeado fica no canto, sem o floco por cima dele', () => {
    const view = createTokenView(ficha({ congelado: true, locked: true }), GRADE, true)
    expect(camada(view, TOKEN_LOCK_LABEL).context.instructions.length).toBeGreaterThan(0)
    expect(floco(view).context.instructions).toHaveLength(0)
  })

  it('congelar e soltar mudam a chave da view, e repintar solta apaga o floco', () => {
    const solta = tokenViewKey(ficha(), GRADE, true)
    const congelada = tokenViewKey(ficha({ congelado: true }), GRADE, true)
    expect(congelada).not.toBe(solta)
    expect(tokenViewKey(ficha({ congelado: false }), GRADE, true)).toBe(solta)
    expect(tokenViewKey(ficha({ congelado: true }), GRADE, false)).toBe(tokenViewKey(ficha(), GRADE, false))

    const view = createTokenView(ficha({ congelado: true }), GRADE, true)
    paintTokenView(view, ficha(), GRADE, true)
    expect(floco(view).context.instructions).toHaveLength(0)
  })
})
