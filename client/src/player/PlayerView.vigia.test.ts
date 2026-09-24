/**
 * OLHOS DO GUARDA na TELA DE QUEM JOGA: o guarda que chega com a marca (?, !)
 * ganha um balão em cima dele; sem marca, nada. A marca entra na chave da view:
 * sem isso o "!" ficaria na tela depois de o guarda perder o jogador de vista.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Token, WatchAlert } from '../types/map'
import { WATCH_ALERT_LABEL } from '../pixi/drawNpcWatch'
import { createTokenView, paintTokenView, tokenViewKey } from './PlayerView'

const GRADE = 50

function guarda(extra: Partial<Token> = {}): Token {
  return { id: 'guarda', characterId: null, name: 'Guarda', x: 500, y: 300, size: 1, image: null, ...extra }
}

function balaoDa(view: ReturnType<typeof createTokenView>): Graphics {
  const balao = view.wrapper.children.find((c) => c.label === WATCH_ALERT_LABEL)
  if (!(balao instanceof Graphics)) throw new Error('a ficha do jogador não tem a camada da marca do guarda')
  return balao
}

function coresPreenchidas(g: Graphics): number[] {
  return g.context.instructions
    .filter((i) => i.action === 'fill')
    // `as`: `data` é união interna do Pixi; o filtro seguinte descarta o que não tiver cor numérica (mesmo leitor de PlayerView.condicoes.test.ts).
    .map((i) => (i.data as { style?: { color?: number } }).style?.color)
    .filter((c): c is number => typeof c === 'number')
}

describe('jogador — marca de alerta no guarda', () => {
  it('guarda com "!" ganha o balão acima do disco, por cima da ficha', () => {
    const view = createTokenView(guarda({ alerta: '!' }), GRADE, false)
    const balao = balaoDa(view)
    expect(balao.context.instructions.length).toBeGreaterThan(0)
    expect(balao.getLocalBounds().maxY).toBeLessThan(0)
    expect(view.wrapper.getChildIndex(balao)).toBeGreaterThan(view.wrapper.getChildIndex(view.body))
  })

  it('"?" e "!" pintam o balão de cores diferentes', () => {
    const exclamacao = coresPreenchidas(balaoDa(createTokenView(guarda({ alerta: '!' }), GRADE, false)))
    const interrogacao = coresPreenchidas(balaoDa(createTokenView(guarda({ alerta: '?' }), GRADE, false)))
    expect(exclamacao.length).toBeGreaterThan(0)
    expect(interrogacao.length).toBeGreaterThan(0)
    expect(exclamacao[0]).not.toBe(interrogacao[0])
  })

  it('sem marca, nenhum balão', () => {
    expect(balaoDa(createTokenView(guarda(), GRADE, false)).context.instructions).toHaveLength(0)
  })

  it('valor estranho no campo não vira balão', () => {
    // `as`: lixo de propósito — simula campo torto chegando pela rede.
    const suja = { ...guarda(), alerta: 'Ana' as unknown as WatchAlert }
    expect(balaoDa(createTokenView(suja, GRADE, false)).context.instructions).toHaveLength(0)
    expect(tokenViewKey(suja, GRADE, false)).toBe(tokenViewKey(guarda(), GRADE, false))
  })

  it('a marca muda a chave da view, e repintar sem ela apaga o balão', () => {
    const sem = tokenViewKey(guarda(), GRADE, false)
    const duvida = tokenViewKey(guarda({ alerta: '?' }), GRADE, false)
    const viu = tokenViewKey(guarda({ alerta: '!' }), GRADE, false)
    expect(duvida).not.toBe(sem)
    expect(viu).not.toBe(duvida)
    const view = createTokenView(guarda({ alerta: '!' }), GRADE, false)
    paintTokenView(view, guarda(), GRADE, false)
    expect(balaoDa(view).context.instructions).toHaveLength(0)
  })
})
