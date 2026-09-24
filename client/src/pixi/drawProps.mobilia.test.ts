import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Sprite } from 'pixi.js'
import { createPropsRenderer } from './drawProps'
import { SECRET_ITEM_ALPHA } from './constants'
import { PROP_SILHOUETTE_EDGE_SCREEN_PX } from './drawPropSilhouettes'
import { MAX_SCALE, MIN_SCALE } from './world'
import type { Prop } from '../types/map'

/** Zoom 1, sem alta densidade: o quadro de todo teste que não é sobre zoom. */
const ZOOM_1 = { cameraScale: 1, rendererResolution: 1 }

const convertFileSrc = vi.fn((path: string) => `mocked://${path}`)
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => convertFileSrc(path),
}))

/**
 * MOBÍLIA DESENHADA no EDITOR: o móvel não tem imagem, então o renderizador
 * do editor não pode pedir arquivo nenhum (nem avisar "imagem não carregou");
 * desenha a mesma silhueta chapada com o glifo que o jogador vê.
 */

function movel(extra: Partial<Prop> = {}): Prop {
  return { id: 'catre', src: '', x: 100, y: 100, width: 40, height: 80, linkedMapPath: null, mobilia: 'catre', ...extra }
}

function desenhosDoMovel(container: Container): Graphics[] {
  return container.children.filter((c): c is Graphics => c instanceof Graphics && c.label === 'mobilia')
}

describe('createPropsRenderer — mobília desenhada', () => {
  it('não vira sprite nem pede imagem: vira desenho chapado com o glifo', () => {
    convertFileSrc.mockClear()
    const container = new Container()
    createPropsRenderer().draw(container, [movel()], null, ZOOM_1)

    expect(container.children.some((c) => c instanceof Sprite)).toBe(false)
    expect(convertFileSrc).not.toHaveBeenCalled()
    const [desenho] = desenhosDoMovel(container)
    expect(desenho).toBeDefined()
    const acoes = desenho?.context.instructions.map((i) => i.action) ?? []
    // Silhueta (fill + contorno) e o traço do glifo.
    expect(acoes).toEqual(['fill', 'stroke', 'stroke'])
  })

  it('oculto para jogadores fica meio transparente no editor, como o objeto de imagem', () => {
    const container = new Container()
    createPropsRenderer().draw(container, [movel({ secret: true })], null, ZOOM_1)
    expect(desenhosDoMovel(container)[0]?.alpha).toBe(SECRET_ITEM_ALPHA)
  })

  it('apagar o móvel tira o desenho; mover redesenha no lugar novo sem duplicar', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(container, [movel()], null, ZOOM_1)
    renderer.draw(container, [movel({ x: 300 })], null, ZOOM_1)
    expect(desenhosDoMovel(container)).toHaveLength(1)

    renderer.draw(container, [], null, ZOOM_1)
    expect(desenhosDoMovel(container)).toHaveLength(0)
  })

  /** Larguras dos traços do móvel (contorno e glifo), em px de MUNDO. */
  function largurasDosTracos(container: Container): number[] {
    const [desenho] = desenhosDoMovel(container)
    return (desenho?.context.instructions ?? []).flatMap((i) => (i.action === 'stroke' ? [i.data.style.width] : []))
  }

  it('o fio do móvel fica com 1 px de TELA em qualquer zoom, como a parede (nunca engrossa com o zoom)', () => {
    for (const escala of [MIN_SCALE, 1, MAX_SCALE]) {
      const container = new Container()
      createPropsRenderer().draw(container, [movel()], null, { cameraScale: escala, rendererResolution: 1 })
      const larguras = largurasDosTracos(container)
      // Contorno e glifo.
      expect(larguras).toHaveLength(2)
      for (const largura of larguras) {
        expect(largura).toBeGreaterThan(0)
        expect(largura * escala).toBeCloseTo(PROP_SILHOUETTE_EDGE_SCREEN_PX, 6)
      }
    }
  })

  it('em tela de alta densidade o fio cobre pixels físicos inteiros (1 px de tela = 2 físicos em DPR 2)', () => {
    const container = new Container()
    createPropsRenderer().draw(container, [movel()], null, { cameraScale: MAX_SCALE, rendererResolution: 2 })
    const larguras = largurasDosTracos(container)
    expect(larguras).toHaveLength(2)
    for (const largura of larguras) expect(largura * MAX_SCALE * 2).toBe(2)
  })

  it('o mesmo renderizador, redesenhado depois do zoom, troca a espessura do fio sem duplicar o móvel', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(container, [movel()], null, { cameraScale: 1, rendererResolution: 1 })
    renderer.draw(container, [movel()], null, { cameraScale: MAX_SCALE, rendererResolution: 1 })
    expect(desenhosDoMovel(container)).toHaveLength(1)
    expect(largurasDosTracos(container)).toEqual([1 / MAX_SCALE, 1 / MAX_SCALE])
  })

  it('selecionado ganha o destaque de seleção de sempre', () => {
    const container = new Container()
    createPropsRenderer().draw(container, [movel()], 'catre', ZOOM_1)
    const destaque = container.children.find((c): c is Graphics => c instanceof Graphics && c.label !== 'mobilia')
    expect(destaque?.context.instructions.filter((i) => i.action === 'stroke')).toHaveLength(1)
  })
})
