// @vitest-environment node
/**
 * FICHA SEGURADA PELO MESTRE na TELA DE QUEM JOGA: a PRÓPRIA ficha que chega
 * travada (`locked`) ganha um cadeado pequeno — o jogador vê por que ela não
 * anda antes mesmo de arrastar. Soltar tira o cadeado; a trava entra na chave
 * da view, senão o cadeado ficaria na tela depois de o mestre soltar.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Token } from '../types/map'
import { TOKEN_LOCK_LABEL } from '../pixi/drawTokenLock'
import { createTokenView, paintTokenView, tokenViewKey } from './PlayerView'

const GRADE = 50

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'lanterna', characterId: null, name: 'Lanterna', x: 425, y: 325, size: 1, image: null, ...extra }
}

function cadeadoDa(view: ReturnType<typeof createTokenView>): Graphics {
  const cadeado = view.wrapper.children.find((c) => c.label === TOKEN_LOCK_LABEL)
  if (!(cadeado instanceof Graphics)) throw new Error('a ficha do jogador não tem a camada do cadeado')
  return cadeado
}

describe('jogador — cadeado na ficha segurada pelo mestre', () => {
  it('a PRÓPRIA ficha travada mostra o cadeado, por cima do disco e à esquerda do topo', () => {
    const view = createTokenView(ficha({ locked: true }), GRADE, true)
    const cadeado = cadeadoDa(view)
    expect(cadeado.context.instructions.length).toBeGreaterThan(0)
    const caixa = cadeado.getLocalBounds()
    expect(caixa.maxX).toBeLessThan(0)
    expect(caixa.maxY).toBeLessThan(0)
    expect(view.wrapper.getChildIndex(cadeado)).toBeGreaterThan(view.wrapper.getChildIndex(view.body))
  })

  it('a própria ficha solta não tem cadeado', () => {
    expect(cadeadoDa(createTokenView(ficha(), GRADE, true)).context.instructions).toHaveLength(0)
    expect(cadeadoDa(createTokenView(ficha({ locked: false }), GRADE, true)).context.instructions).toHaveLength(0)
  })

  it('ficha de OUTRO nunca mostra cadeado, nem se a trava escapasse até aqui', () => {
    expect(cadeadoDa(createTokenView(ficha({ id: 'guarda', locked: true }), GRADE, false)).context.instructions).toHaveLength(0)
  })

  it('travar e soltar mudam a chave da view, e repintar solta apaga o cadeado', () => {
    const solta = tokenViewKey(ficha(), GRADE, true)
    const presa = tokenViewKey(ficha({ locked: true }), GRADE, true)
    expect(presa).not.toBe(solta)
    expect(tokenViewKey(ficha({ locked: false }), GRADE, true)).toBe(solta)
    // Na ficha de outro a trava não conta: nada a repintar.
    expect(tokenViewKey(ficha({ locked: true }), GRADE, false)).toBe(tokenViewKey(ficha(), GRADE, false))

    const view = createTokenView(ficha({ locked: true }), GRADE, true)
    paintTokenView(view, ficha(), GRADE, true)
    expect(cadeadoDa(view).context.instructions).toHaveLength(0)
  })
})
