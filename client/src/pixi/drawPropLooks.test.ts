import { describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Text, Texture, TextureSource } from 'pixi.js'
import type { Prop } from '../types/map'
import { createPropLooksRenderer } from './drawPropLooks'

/**
 * OBJETO COM RÓTULO OU IMAGEM, no DESENHO do jogador. O recorte
 * (`lib/fogFilter.ts`) já decidiu o que chega; aqui a prova é que o que chegou
 * vira, na tela: "Guarda-roupa" escrito no meio da silhueta, e o piano com a
 * imagem pequena no lugar, no tamanho e na rotação que o mestre deu.
 */

const IMAGEM_DO_PIANO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const GUARDA_ROUPA: Prop = { id: 'guarda-roupa', x: 150, y: 150, width: 40, height: 80, src: '', linkedMapPath: null, playerLabel: 'Guarda-roupa' }
const PIANO: Prop = { id: 'piano', x: 300, y: 300, width: 80, height: 60, rotation: 30, src: '', linkedMapPath: null, playerImage: IMAGEM_DO_PIANO }
const GRID = 40

/** A cópia pequena que viaja tem proporção própria (256 x 192): o sprite tem de sair no tamanho do objeto, não no dela. */
function texturaDaCopia(): Texture {
  return new Texture({ source: new TextureSource({ width: 256, height: 192 }) })
}

function textos(container: Container): Text[] {
  return container.children.filter((c): c is Text => c instanceof Text)
}

function sprites(container: Container): Sprite[] {
  return container.children.filter((c): c is Sprite => c instanceof Sprite)
}

describe('createPropLooksRenderer — rótulo e imagem do objeto na tela do jogador', () => {
  it('"Guarda-roupa" aparece escrito no centro da silhueta, sem imagem nenhuma', () => {
    const imagens = new Container()
    const rotulos = new Container()
    const carregar = vi.fn(async () => texturaDaCopia())
    const conta = createPropLooksRenderer(carregar).draw(imagens, rotulos, [GUARDA_ROUPA], GRID, 1)

    expect(conta).toEqual({ images: 0, labels: 1 })
    const [rotulo] = textos(rotulos)
    expect(rotulo.text).toBe('Guarda-roupa')
    expect(rotulo.x).toBe(150)
    expect(rotulo.y).toBe(150)
    expect(rotulo.visible).toBe(true)
    expect(sprites(imagens)).toHaveLength(0)
    expect(carregar).not.toHaveBeenCalled()
  })

  it('o piano vira imagem na posição, no tamanho e na rotação do editor — antes e depois de a cópia carregar', async () => {
    const imagens = new Container()
    const rotulos = new Container()
    const carregar = vi.fn(async () => texturaDaCopia())
    const conta = createPropLooksRenderer(carregar).draw(imagens, rotulos, [PIANO], GRID, 1)

    expect(conta).toEqual({ images: 1, labels: 0 })
    expect(carregar).toHaveBeenCalledWith(IMAGEM_DO_PIANO)
    const [imagem] = sprites(imagens)
    expect(imagem.x).toBe(300)
    expect(imagem.y).toBe(300)
    expect(imagem.rotation).toBeCloseTo((30 * Math.PI) / 180, 10)
    expect(imagem.width).toBeCloseTo(80, 6)
    expect(imagem.height).toBeCloseTo(60, 6)

    await vi.waitFor(() => expect(imagem.texture.width).toBe(256))
    expect(imagem.width).toBeCloseTo(80, 6)
    expect(imagem.height).toBeCloseTo(60, 6)
    expect(textos(rotulos)).toHaveLength(0)
  })

  it('imagem que não é a cópia auto-contida (caminho do disco) não vira sprite nem é carregada', () => {
    const imagens = new Container()
    const carregar = vi.fn(async () => texturaDaCopia())
    const conta = createPropLooksRenderer(carregar).draw(imagens, new Container(), [{ ...PIANO, playerImage: 'C:\\m\\piano.png' }], GRID, 1)

    expect(conta).toEqual({ images: 0, labels: 0 })
    expect(sprites(imagens)).toHaveLength(0)
    expect(carregar).not.toHaveBeenCalled()
  })

  it('snapshot seguinte sem o objeto (saiu da visão, teto fechou): rótulo e imagem somem da tela', () => {
    const imagens = new Container()
    const rotulos = new Container()
    const renderer = createPropLooksRenderer(async () => texturaDaCopia())
    renderer.draw(imagens, rotulos, [GUARDA_ROUPA, PIANO], GRID, 1)
    expect(textos(rotulos)).toHaveLength(1)
    expect(sprites(imagens)).toHaveLength(1)

    expect(renderer.draw(imagens, rotulos, [], GRID, 1)).toEqual({ images: 0, labels: 0 })
    expect(textos(rotulos)).toHaveLength(0)
    expect(sprites(imagens)).toHaveLength(0)
  })

  it('o mestre troca o rótulo: o mesmo texto na tela passa a dizer o novo nome', () => {
    const rotulos = new Container()
    const renderer = createPropLooksRenderer(async () => texturaDaCopia())
    renderer.draw(new Container(), rotulos, [GUARDA_ROUPA], GRID, 1)
    renderer.draw(new Container(), rotulos, [{ ...GUARDA_ROUPA, playerLabel: 'Armário' }], GRID, 1)

    expect(textos(rotulos).map((t) => t.text)).toEqual(['Armário'])
  })

  it('planta inteira na tela (zoom bem pequeno): o rótulo se esconde, como o nome da sala; ao aproximar, volta', () => {
    const rotulos = new Container()
    const renderer = createPropLooksRenderer(async () => texturaDaCopia())
    renderer.draw(new Container(), rotulos, [GUARDA_ROUPA], GRID, 1)
    const [rotulo] = textos(rotulos)

    renderer.setCameraScale(0.1)
    expect(rotulo.visible).toBe(false)
    renderer.setCameraScale(1)
    expect(rotulo.visible).toBe(true)
  })
})
