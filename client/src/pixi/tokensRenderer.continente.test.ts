import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text, Ticker } from 'pixi.js'
import { createTokensRenderer, type TokensMotion } from './tokensRenderer'
import { MARCADOR_LABEL } from './vistaDoMarcador'
import { HEALTH_BAR_LABEL } from './drawTokenHealth'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * MAPA DE CONTINENTE no editor do mestre: a ficha de jogador vira o pino
 * (só o nome embaixo, sem vida, condições nem anel da vez), o NPC continua
 * disco, trocar o tipo da cena repinta, e o relógio de quadros só roda
 * enquanto há pino girando.
 */

const GRID = 50

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 100, y: 100, size: 1, image: null, ...extra }
}

function relogio(reduzido = false) {
  const ticker = new Ticker()
  const add = vi.spyOn(ticker, 'add')
  const remove = vi.spyOn(ticker, 'remove')
  let agora = 1000
  const motion: TokensMotion = { ticker, reducedMotion: () => reduzido, now: () => agora }
  return {
    motion,
    add,
    remove,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

function wrapperDe(container: Container, index: number): Container {
  const wrapper = container.children[index]
  if (!(wrapper instanceof Container)) throw new Error('sem wrapper')
  return wrapper
}

function marcadorDe(wrapper: Container): Container | undefined {
  return wrapper.children.find((c) => c.label === MARCADOR_LABEL)
}

/** As camadas da raiz do pino, nesta ordem: anel de seleção, chão, giro (pirâmide), corpo (cristal), nome. */
function camadaDe(marcador: Container, index: 1 | 2 | 3): Graphics {
  const camada = marcador.children[index]
  if (!(camada instanceof Graphics)) throw new Error(`sem a camada ${index} do pino`)
  return camada
}

const giroDe = (marcador: Container): Graphics => camadaDe(marcador, 2)

const ANA = ficha('ana', { health: { current: 3, max: 10, shownToPlayers: true }, conditions: ['caido'] })
const NPC = ficha('npc', { x: 300 })
const PINOS = new Map([['ana', '#64b5f6']])

describe('tokensRenderer — mapa de continente', () => {
  it('a ficha de jogador vira pino: o disco, a vida e o nome da ficha somem; o nome vai no pino', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ANA, NPC], GRID, null, 1, null, undefined, undefined, PINOS)
    const ana = wrapperDe(container, 0)
    const marcador = marcadorDe(ana)
    expect(marcador?.visible).toBe(true)
    // Fora do pino nada desenhado à vista: nem disco, nem anel, nem marca de condição.
    for (const filho of ana.children) {
      if (filho !== marcador && filho instanceof Graphics && filho.visible) expect(filho.context.instructions.length).toBe(0)
    }
    const nomes = ana.children.filter((c): c is Text => c instanceof Text)
    expect(nomes.every((t) => !t.visible)).toBe(true)
    const rotulo = marcador?.children.find((c): c is Text => c instanceof Text)
    expect(rotulo?.text).toBe('ana')
    // Sem barra de vida: a ficha tem vida, mas o pino não leva a barra.
    expect(ana.children.some((c) => c.label === HEALTH_BAR_LABEL)).toBe(false)
  })

  it('NPC continua disco, sem pino', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ANA, NPC], GRID, null, 1, null, undefined, undefined, PINOS)
    const npc = wrapperDe(container, 1)
    expect(marcadorDe(npc)).toBeUndefined()
    expect(npc.children[0].visible).toBe(true)
  })

  it('tamanho fixo na tela: a raiz do pino tem a escala inversa ao zoom, e acompanha o zoom', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ANA], GRID, null, 0.5, null, undefined, undefined, PINOS)
    const marcador = marcadorDe(wrapperDe(container, 0))
    expect(marcador?.scale.x).toBeCloseTo(2)
    renderer.setCameraScale(2)
    expect(marcador?.scale.x).toBeCloseTo(0.5)
  })

  it('cena volta a Normal: o pino some e o disco e o nome voltam; Continente de novo reaproveita o mesmo pino', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ANA], GRID, null, 1, null, undefined, undefined, PINOS)
    const ana = wrapperDe(container, 0)
    const primeiro = marcadorDe(ana)
    renderer.draw(container, [ANA], GRID, null, 1)
    expect(primeiro?.visible).toBe(false)
    expect(ana.children[0].visible).toBe(true)
    expect(ana.children.filter((c): c is Text => c instanceof Text)[0].visible).toBe(true)
    renderer.draw(container, [ANA], GRID, null, 1, null, undefined, undefined, PINOS)
    expect(marcadorDe(ana)).toBe(primeiro)
    expect(primeiro?.visible).toBe(true)
  })

  it('o relógio liga com o pino na cena, a pirâmide gira a cada quadro, e desliga quando a cena volta a Normal', () => {
    const { motion, add, remove, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ANA], GRID, null, 1, null, undefined, undefined, PINOS)
    expect(add).toHaveBeenCalledTimes(1)
    const marcador = marcadorDe(wrapperDe(container, 0))
    if (marcador === undefined) throw new Error('sem pino')
    const giro = giroDe(marcador)
    const refazer = vi.spyOn(giro, 'clear')
    const refazerChao = vi.spyOn(camadaDe(marcador, 1), 'clear')
    const refazerCorpo = vi.spyOn(camadaDe(marcador, 3), 'clear')
    quadro(500)
    quadro(500)
    // Só a pirâmide é refeita por quadro; o chão e o corpo (cristal), não.
    expect(refazer).toHaveBeenCalledTimes(2)
    expect(refazerChao).not.toHaveBeenCalled()
    expect(refazerCorpo).not.toHaveBeenCalled()
    expect(giro.context.instructions.length).toBeGreaterThan(0)
    renderer.draw(container, [ANA], GRID, null, 1)
    quadro(16)
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('a ficha-pino que sai do desenho (apagada, ou foi para outra cena) desliga o relógio no quadro seguinte', () => {
    const { motion, add, remove, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ANA, NPC], GRID, null, 1, null, undefined, undefined, PINOS)
    expect(add).toHaveBeenCalledTimes(1)
    quadro(16)
    expect(remove).not.toHaveBeenCalled()
    renderer.draw(container, [NPC], GRID, null, 1, null, undefined, undefined, PINOS)
    quadro(16)
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('cena Normal não liga relógio nenhum', () => {
    const { motion, add } = relogio()
    createTokensRenderer(motion).draw(new Container(), [ANA, NPC], GRID, null, 1)
    expect(add).not.toHaveBeenCalled()
  })

  it('movimento reduzido: o pino aparece parado, sem relógio', () => {
    const { motion, add } = relogio(true)
    const container = new Container()
    createTokensRenderer(motion).draw(container, [ANA], GRID, null, 1, null, undefined, undefined, PINOS)
    expect(add).not.toHaveBeenCalled()
    const marcador = marcadorDe(wrapperDe(container, 0))
    if (marcador === undefined) throw new Error('sem pino')
    expect(giroDe(marcador).context.instructions.length).toBeGreaterThan(0)
  })

  it('movimento reduzido ligado no meio da sessão: o pino para no próximo quadro e o relógio desliga', () => {
    const ticker = new Ticker()
    const remove = vi.spyOn(ticker, 'remove')
    let agora = 1000
    let reduzido = false
    const motion: TokensMotion = { ticker, reducedMotion: () => reduzido, now: () => agora }
    const container = new Container()
    createTokensRenderer(motion).draw(container, [ANA], GRID, null, 1, null, undefined, undefined, PINOS)
    const marcador = marcadorDe(wrapperDe(container, 0))
    if (marcador === undefined) throw new Error('sem pino')
    const refazer = vi.spyOn(giroDe(marcador), 'clear')
    agora += 16
    ticker.update(agora)
    reduzido = true
    agora += 16
    ticker.update(agora)
    expect(remove).toHaveBeenCalledTimes(1)
    const vezes = refazer.mock.calls.length
    agora += 500
    ticker.update(agora)
    expect(refazer).toHaveBeenCalledTimes(vezes)
  })

  it('selecionada, a ficha-pino ganha o anel no chão; desmarcar o tira', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ANA], GRID, 'ana', 1, null, undefined, undefined, PINOS)
    const marcador = marcadorDe(wrapperDe(container, 0))
    const anel = marcador?.children[0]
    if (!(anel instanceof Graphics)) throw new Error('sem anel de seleção')
    expect(anel.context.instructions.length).toBeGreaterThan(0)
    renderer.draw(container, [ANA], GRID, null, 1, null, undefined, undefined, PINOS)
    expect(anel.context.instructions.length).toBe(0)
  })
})
