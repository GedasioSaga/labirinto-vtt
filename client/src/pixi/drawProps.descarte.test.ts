import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Texture } from 'pixi.js'
import { createPropsRenderer } from './drawProps'
import { useToastStore } from '../stores/toastStore'
import type { Prop } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

// O carregamento da imagem fica nas mãos do teste. Pelo módulo e não por `vi.spyOn`:
// o tipo do espião só enxerga a última sobrecarga de `Assets.load` (a de lista).
const carregamento = vi.hoisted(() => ({ promessa: Promise.resolve<unknown>(undefined) }))
vi.mock('pixi.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('pixi.js')>()
  return { ...real, Assets: { load: () => carregamento.promessa } }
})

const ZOOM_1 = { cameraScale: 1, rendererResolution: 1 }
const OBJETO: Prop = { id: 'p1', src: 'C:/imgs/barril.png', x: 100, y: 100, width: 64, height: 64, linkedMapPath: null }

afterEach(() => {
  useToastStore.setState({ toasts: [] })
})

/** A imagem do objeto fica carregando até o teste entregar a textura. */
function carregamentoPendente(): { entregar: (textura: Texture) => void } {
  let entregar: (textura: Texture) => void = () => undefined
  carregamento.promessa = new Promise<Texture>((resolve) => {
    entregar = resolve
  })
  return { entregar: (textura) => entregar(textura) }
}

/** Deixa as promessas do `.then` e do `.catch` do carregamento andarem. */
async function esperarAsPromessas(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('createPropsRenderer: nó da camada descartado com a imagem carregando', () => {
  it('a textura que chega depois do descarte não vira o aviso falso "Imagem do objeto não carregou"', async () => {
    const carregamento = carregamentoPendente()
    const no = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(no, [OBJETO], null, ZOOM_1)
    // Como o `descartar` da pilha (PixiCanvas): solta o renderer e destrói o nó com os filhos.
    renderer.destruir()
    no.destroy({ children: true })
    carregamento.entregar(Texture.WHITE)
    await esperarAsPromessas()
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('sem descarte, a textura que chega entra no sprite (o caminho de sempre continua)', async () => {
    const carregamento = carregamentoPendente()
    const no = new Container()
    createPropsRenderer().draw(no, [OBJETO], null, ZOOM_1)
    carregamento.entregar(Texture.WHITE)
    await esperarAsPromessas()
    expect(useToastStore.getState().toasts).toEqual([])
    const sprite = no.children.find((filho) => 'texture' in filho && filho.texture === Texture.WHITE)
    expect(sprite).toBeDefined()
  })
})
