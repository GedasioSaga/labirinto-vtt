import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import { WATCH_ALERT_LABEL } from './drawNpcWatch'
import type { Token, WatchAlert } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * OLHOS DO GUARDA no mapa do MESTRE (pedido de 09/11/2026): o balão "?" / "!"
 * que o jogador já via em cima do guarda aparece também para o mestre. Antes,
 * o editor só desenhava o círculo: o mestre não tinha como saber se a ficha
 * chamou atenção.
 */

const GRID = 64
const SEM_ALERTAS = new Map<string, WatchAlert>()

function ficha(id: string, overrides: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 100, y: 200, size: 1, image: null, ...overrides }
}

function balaoDe(container: Container, indice: number): Graphics | null {
  const balao = container.children[indice]?.children.find((filho) => filho.label === WATCH_ALERT_LABEL)
  return balao instanceof Graphics ? balao : null
}

/** A cor chapada do balão: âmbar no "?", vermelho no "!" (`drawWatchAlert`). `null` = sem balão. */
function corDoBalao(container: Container, indice: number): number | null {
  const primeira = balaoDe(container, indice)?.context.instructions[0]
  return primeira !== undefined && primeira.action === 'fill' ? primeira.data.style.color : null
}

function desenhar(renderer: ReturnType<typeof createTokensRenderer>, container: Container, tokens: Token[], alertas: ReadonlyMap<string, WatchAlert>): void {
  renderer.draw(container, tokens, GRID, null, undefined, undefined, undefined, undefined, undefined, undefined, null, undefined, undefined, alertas)
}

describe('createTokensRenderer: balão do guarda no mapa do mestre', () => {
  it('guarda com alguém no olhar: o balão sai no alto à direita; a outra ficha fica como era', () => {
    const container = new Container()
    desenhar(createTokensRenderer(), container, [ficha('urso'), ficha('aira')], new Map([['urso', '!']]))
    const balao = balaoDe(container, 0)
    if (balao === null) throw new Error('o guarda ficou sem balão')
    const caixa = balao.getLocalBounds()
    expect(caixa.width).toBeGreaterThan(0)
    expect(caixa.x + caixa.width / 2).toBeGreaterThan(0)
    expect(caixa.y + caixa.height / 2).toBeLessThan(0)
    expect(balaoDe(container, 1)).toBeNull()
    expect(container.children[1]?.children.length).toBe(4)
  })

  it('a marca troca de "?" para "!" e some quando a regra manda', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const urso = ficha('urso')
    desenhar(renderer, container, [urso], new Map([['urso', '?']]))
    expect(corDoBalao(container, 0)).toBe(0xf2c94c)
    desenhar(renderer, container, [urso], new Map([['urso', '!']]))
    expect(corDoBalao(container, 0)).toBe(0xe8503a)
    desenhar(renderer, container, [urso], SEM_ALERTAS)
    expect(balaoDe(container, 0)).toBeNull()
    expect(container.children[0]?.children.length).toBe(4)
  })
})
