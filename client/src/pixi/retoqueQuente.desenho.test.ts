/**
 * MEIO-TERMO, RETOQUE Q (MT9), lado do DESENHO: o editor e o jogador montam o
 * telhado pelo MESMO helper (`telhadoParaDesenhar`, que leva a camada e a
 * chaminé) e passam a vista dos móveis da cena ao desenho dos móveis. Nada
 * muda na tela: quem desenha chaminé e 3/4 são a MT10 e a MT11.
 *
 * `PixiCanvas` e `PlayerView` não montam em teste de unidade (Pixi + WebGL):
 * a guarda dos dois é no texto; o helper e o editor de móveis são medidos de verdade.
 */
import { describe, expect, it, vi } from 'vitest'
import { Container } from 'pixi.js'
import type { Prop, Region } from '../types/map'
import { createPropsRenderer, type PropsView } from './drawProps'
import { drawPropSilhouettes } from './drawPropSilhouettes'
import { telhadoParaDesenhar } from './telhadosRenderer'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

vi.mock('./drawPropSilhouettes', async (importOriginal) => {
  const original = await importOriginal<typeof import('./drawPropSilhouettes')>()
  return { ...original, drawPropSilhouettes: vi.fn(original.drawPropSilhouettes) }
})

const SALA: Region = {
  id: 'sala',
  points: [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 128 }, { x: 0, y: 128 }],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Casa', roof: true },
}

/** O fonte como está no disco (mesmo jeito de `PixiCanvas.desenhosPeloMapa.test.ts`: o jsdom não lê `new URL`). */
async function lerFonte(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
}

describe('telhadoParaDesenhar', () => {
  it('leva a camada que recebeu, o modelo e a cor padrão (telha barro) e nada de chaminé', () => {
    const camada = new Container()
    const outra = new Container()
    const t = telhadoParaDesenhar(SALA, camada)
    expect(t.camada).toBe(camada)
    expect(telhadoParaDesenhar(SALA, outra).camada).toBe(outra)
    expect(t).toMatchObject({ id: 'sala', points: SALA.points, modelo: 'telhas', cor: '#8a5a46' })
    expect('chamine' in t).toBe(false)
  })

  it('modelo, cor e chaminé da Sala', () => {
    const t = telhadoParaDesenhar({ ...SALA, room: { shape: 'rect', name: 'Casa', roof: true, modeloDoTeto: 'palha', corDoTeto: '#D2BF8C', chamine: true } }, new Container())
    expect(t).toMatchObject({ modelo: 'palha', cor: '#d2bf8c', chamine: true })
  })
})

describe('móveis do editor: a vista da cena chega ao desenho', () => {
  const movel: Prop = { id: 'mesa', src: '', x: 100, y: 100, width: 64, height: 64, linkedMapPath: null, mobilia: 'mesa' }
  const ZOOM_1: PropsView = { cameraScale: 1, rendererResolution: 1 }

  it('passa a vista adiante e repinta quando ela muda (e só então)', () => {
    const desenhar = vi.mocked(drawPropSilhouettes)
    const renderer = createPropsRenderer()
    const container = new Container()
    renderer.draw(container, [movel], null, ZOOM_1)
    expect(desenhar.mock.lastCall?.[4]).toBeUndefined()
    desenhar.mockClear()
    renderer.draw(container, [movel], null, { ...ZOOM_1, vistaDosMoveis: 'tres-quartos' })
    expect(desenhar).toHaveBeenCalledTimes(1)
    expect(desenhar.mock.lastCall?.[4]).toBe('tres-quartos')
    desenhar.mockClear()
    renderer.draw(container, [movel], null, { ...ZOOM_1, vistaDosMoveis: 'tres-quartos' })
    expect(desenhar).not.toHaveBeenCalled()
    renderer.destruir()
  })
})

describe('guardas no fonte: editor e jogador pelo mesmo caminho', () => {
  it('PixiCanvas monta o telhado pelo helper e passa a vista aos móveis', async () => {
    const fonte = await lerFonte('PixiCanvas.tsx')
    expect(fonte).toMatch(/telhadoParaDesenhar\(r, /)
    expect(fonte).not.toContain('corDoTetoOuPadrao(')
    expect(fonte).toContain('vistaDosMoveis: map.vistaDosMoveis')
    expect(fonte).toMatch(/subscribe\(\(state\) => state\.map\.vistaDosMoveis, \(\) => redrawProps\(\)\)/)
  })

  it('PlayerView monta o telhado pelo helper (a chaminé na chave) e passa a vista aos móveis (a vista na chave)', async () => {
    const fonte = await lerFonte('../player/PlayerView.tsx')
    expect(fonte).toMatch(/telhadoParaDesenhar\(r, peekedSet\.has\(r\.id\) \? scene\.peekedRoofs : scene\.roofs\)/)
    expect(fonte).not.toContain('corDoTetoOuPadrao(')
    expect(fonte).toContain('r.room?.chamine ?? null')
    expect(fonte).toContain('drawPropSilhouettes(no, itens, scale, res, vistaDosMoveis)')
    expect(fonte).toContain('nos, vistaDosMoveis ?? null])')
  })
})
