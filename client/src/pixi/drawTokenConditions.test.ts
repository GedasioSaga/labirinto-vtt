/**
 * CONDIÇÃO NA FICHA no EDITOR do mestre: a marca é desenhada em cima da ficha,
 * cada condição com a própria pastilha, e some quando é desmarcada. O que se
 * prova aqui é o desenho no `Graphics`; a foto de tela é da régua
 * `e2e/task-jornada-condicao-na-ficha.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Sprite } from 'pixi.js'
import type { Token, TokenCondition } from '../types/map'
import { TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import { TOKEN_FRAME_COLOR, TOKEN_FRAME_WIDTH } from './constants'
import { CONDITION_MARKS_LABEL, drawTokenConditions } from './drawTokenConditions'
import { createTokensRenderer } from './tokensRenderer'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const GRADE = 50
/** Raio do disco da ficha de 1 quadrado no editor (`gridSize * size / 2 - 2`). */
const RAIO = GRADE / 2 - 2
/** Ficha COM FOTO de 1 quadrado: o disco vai até `gridSize * size / 2`, sem os 2 px de respiro — é a borda de fora da moldura. */
const RAIO_FOTO = GRADE / 2
/** Borda de dentro da moldura: a foto é recortada em `raio - TOKEN_FRAME_WIDTH` (`pixi/tokensRenderer.ts`). */
const MOLDURA_POR_DENTRO = RAIO_FOTO - TOKEN_FRAME_WIDTH

function corDa(condicao: TokenCondition): number {
  return Number.parseInt(TOKEN_CONDITION_SYMBOLS[condicao].fill.slice(1), 16)
}

function coresPreenchidas(g: Graphics): number[] {
  return g.context.instructions
    .filter((i) => i.action === 'fill')
    .map((i) => (i.data as { style?: { color?: number } }).style?.color)
    .filter((c): c is number => typeof c === 'number')
}

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'lanterna', characterId: null, name: 'Lanterna', x: 425, y: 325, size: 1, image: null, ...extra }
}

function marcasDa(wrapper: Container): Graphics {
  const marcas = wrapper.children.find((c) => c.label === CONDITION_MARKS_LABEL)
  if (!(marcas instanceof Graphics)) throw new Error('a ficha não tem a camada de marcas de condição')
  return marcas
}

/** A moldura da ficha com foto: o desenho que traça o aro na cor de latão (ficha sem cor escolhida). */
function molduraDa(wrapper: Container): Graphics {
  const moldura = wrapper.children.find(
    (c): c is Graphics =>
      c instanceof Graphics &&
      c.context.instructions.some(
        (i) => i.action === 'stroke' && (i.data as { style?: { color?: number } }).style?.color === TOKEN_FRAME_COLOR,
      ),
  )
  if (moldura === undefined) throw new Error('a ficha com foto não tem moldura')
  return moldura
}

describe('drawTokenConditions — a pastilha em cima da ficha', () => {
  it('sem condição, não desenha nada', () => {
    const g = new Graphics()
    drawTokenConditions(g, [], RAIO, GRADE)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('"Envenenado": pastilha na cor dela, inteira ACIMA do centro da ficha e dentro da caixa da régua', () => {
    const g = new Graphics()
    drawTokenConditions(g, ['envenenado'], RAIO, GRADE)
    expect(coresPreenchidas(g)).toContain(corDa('envenenado'))
    const caixa = g.getLocalBounds()
    // Em cima da ficha: nada da marca desce até o meio do disco (o nome fica embaixo).
    expect(caixa.maxY).toBeLessThan(0)
    // Dentro da caixa que a régua fotografa: 2 raios para cada lado, até 3 raios acima.
    expect(caixa.minX).toBeGreaterThanOrEqual(-2 * RAIO)
    expect(caixa.maxX).toBeLessThanOrEqual(2 * RAIO)
    expect(caixa.minY).toBeGreaterThanOrEqual(-3 * RAIO)
    // Grande o bastante para mudar mais que o antisserrilhado: dezenas de pixels.
    expect(caixa.width * caixa.height).toBeGreaterThan(150)
  })

  it('cada condição tem desenho próprio: "Envenenado" e "Caído" não pintam as mesmas cores', () => {
    const veneno = new Graphics()
    const queda = new Graphics()
    drawTokenConditions(veneno, ['envenenado'], RAIO, GRADE)
    drawTokenConditions(queda, ['caido'], RAIO, GRADE)
    expect(coresPreenchidas(queda)).toContain(corDa('caido'))
    expect(coresPreenchidas(queda)).not.toContain(corDa('envenenado'))
    expect(coresPreenchidas(veneno)).not.toContain(corDa('caido'))
  })

  it('duas condições, duas pastilhas; redesenhar sem nenhuma apaga tudo', () => {
    const g = new Graphics()
    drawTokenConditions(g, ['dormindo', 'invisivel'], RAIO, GRADE)
    const cores = coresPreenchidas(g)
    expect(cores).toContain(corDa('dormindo'))
    expect(cores).toContain(corDa('invisivel'))
    drawTokenConditions(g, [], RAIO, GRADE)
    expect(g.context.instructions).toHaveLength(0)
  })
})

describe('createTokensRenderer — a ficha do editor com condição', () => {
  it('ficha marcada ganha a marca por cima; a ficha sem condição não', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha({ conditions: ['envenenado'] }), ficha({ id: 'ogro', name: 'Ogro', x: 625 })], GRADE, null, 1)

    const [lanterna, ogro] = container.children
    const marcas = marcasDa(lanterna)
    expect(coresPreenchidas(marcas)).toContain(corDa('envenenado'))
    expect(marcas.getLocalBounds().maxY).toBeLessThan(0)
    // Por cima do disco e do anel: a marca é o último desenho da ficha.
    expect(lanterna.getChildIndex(marcas)).toBeGreaterThan(1)
    expect(marcasDa(ogro).context.instructions).toHaveLength(0)
  })

  it('desmarcar tira a marca no redesenho seguinte', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha({ conditions: ['caido'] })], GRADE, null, 1)
    renderer.draw(container, [ficha()], GRADE, null, 1)
    expect(marcasDa(container.children[0]).context.instructions).toHaveLength(0)
  })

  it('lixo no campo (mapa editado à mão) não quebra nem desenha marca', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const suja = { ...ficha(), conditions: ['veneno?', 42] as unknown as TokenCondition[] }
    expect(() => renderer.draw(container, [suja], GRADE, null, 1)).not.toThrow()
    expect(marcasDa(container.children[0]).context.instructions).toHaveLength(0)
  })

  it('ficha girada: a marca continua em pé e em cima (não gira junto com o disco)', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha({ conditions: ['dormindo'], rotation: 180 })], GRADE, null, 1)
    const marcas = marcasDa(container.children[0])
    expect(marcas.rotation).toBe(0)
    expect(marcas.getLocalBounds().maxY).toBeLessThan(0)
  })

  it('ficha com foto também mostra a marca, em cima da moldura', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha({ image: 'C:\\imgs\\lanterna.png', conditions: ['atordoado'] })], GRADE, null, 1)
    const wrapper = container.children[0]
    const marcas = marcasDa(wrapper)
    expect(coresPreenchidas(marcas)).toContain(corDa('atordoado'))

    // SENTADA na moldura, e não boiando acima dela: a pastilha atravessa a
    // faixa do aro no alto da ficha. A borda de baixo passa da borda de dentro
    // da moldura, mas não chega ao meio do disco (a metade de baixo é do nome)...
    const caixa = marcas.getLocalBounds()
    expect(caixa.maxY).toBeGreaterThan(-MOLDURA_POR_DENTRO)
    expect(caixa.maxY).toBeLessThan(0)
    // ...e a borda de cima sobe além da borda de fora, sem sair da caixa que a régua fotografa.
    expect(caixa.minY).toBeLessThan(-RAIO_FOTO)
    expect(caixa.minY).toBeGreaterThanOrEqual(-3 * RAIO_FOTO)

    // Por CIMA na pilha de desenho: nem a foto nem a moldura cobrem a marca.
    const foto = wrapper.children.find((c) => c instanceof Sprite)
    if (foto === undefined) throw new Error('a ficha com foto não desenhou a foto')
    expect(wrapper.getChildIndex(marcas)).toBeGreaterThan(wrapper.getChildIndex(foto))
    expect(wrapper.getChildIndex(marcas)).toBeGreaterThan(wrapper.getChildIndex(molduraDa(wrapper)))
  })
})
