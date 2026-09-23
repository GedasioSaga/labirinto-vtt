import { describe, expect, it } from 'vitest'
import { Container, EventBoundary, Graphics, Rectangle } from 'pixi.js'
// Sem Application não há ambiente do browser: liga à mão os eventos (eventMode, hit test) no Container.
import 'pixi.js/events'
import { applyTokenTouch, prepareTokenLayer } from './tokenTouch'

const RADIUS = 25

/**
 * Ficha como o PlayerView monta: um wrapper com o disco dentro. O disco é
 * desenhado já no ponto, com o wrapper na origem: sem renderer ninguém calcula
 * a transformação de mundo, e o hit test do Pixi a lê.
 */
function ficha(x: number, y: number): Container {
  const wrapper = new Container()
  wrapper.addChild(new Graphics().circle(x, y, RADIUS).fill({ color: 0xffffff }))
  return wrapper
}

/** Palco do jogador: estático, com área de toque (é ele que rola o mapa). */
function palco(): { stage: Container; tokens: Container } {
  const stage = new Container()
  stage.eventMode = 'static'
  stage.hitArea = new Rectangle(0, 0, 1000, 1000)
  const tokens = new Container()
  prepareTokenLayer(tokens)
  stage.addChild(tokens)
  return { stage, tokens }
}

/** O wrapper de ficha que recebe o toque no ponto, ou o próprio palco. */
function quemPegaOToque(stage: Container, fichas: Container[], x: number, y: number): Container | null {
  let alvo: Container | null = new EventBoundary(stage).hitTest(x, y)
  while (alvo !== null && alvo !== stage && !fichas.includes(alvo)) alvo = alvo.parent
  return alvo
}

describe('toque nas fichas do jogador', () => {
  it('7 fichas empilhadas: o toque no bolo pega sempre a PRÓPRIA, mesmo sendo a primeira (a de baixo)', () => {
    const { stage, tokens } = palco()
    const propria = ficha(100, 100)
    const alheias = Array.from({ length: 6 }, () => ficha(100, 100))
    tokens.addChild(propria, ...alheias)
    applyTokenTouch(propria, true)
    for (const outra of alheias) applyTokenTouch(outra, false)
    tokens.sortChildren()

    expect(quemPegaOToque(stage, [propria, ...alheias], 100, 100)).toBe(propria)
    // Desenhada por cima também: é a última filha depois da ordenação.
    expect(tokens.children.at(-1)).toBe(propria)
  })

  it('ficha alheia deixa o toque passar para o palco (rola o mapa, toca pino e porta)', () => {
    const { stage, tokens } = palco()
    const propria = ficha(100, 100)
    const bruno = ficha(300, 100)
    tokens.addChild(propria, bruno)
    applyTokenTouch(propria, true)
    applyTokenTouch(bruno, false)

    expect(quemPegaOToque(stage, [propria, bruno], 300, 100)).toBe(stage)
    expect(bruno.cursor).not.toBe('grab')
  })

  it('ficha que deixa de ser do jogador (mestre reatribuiu) para de pegar o toque', () => {
    const { stage, tokens } = palco()
    const f = ficha(100, 100)
    tokens.addChild(f)
    applyTokenTouch(f, true)
    expect(quemPegaOToque(stage, [f], 100, 100)).toBe(f)
    applyTokenTouch(f, false)
    expect(quemPegaOToque(stage, [f], 100, 100)).toBe(stage)
  })
})
