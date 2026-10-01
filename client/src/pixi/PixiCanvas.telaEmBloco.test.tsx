import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { PixiCanvas } from './PixiCanvas'

/**
 * A TELA DO PIXI ENTRA COMO BLOCO (conferência guias-4e5, achado medido).
 *
 * O `<canvas>` nasce `inline`, e elemento inline mora numa linha de texto: a
 * linha reserva embaixo dele o espaço das letras que descem (g, p, q). Com o
 * contêiner de 100% de altura, essa sobra de 5 px vazava do mapa e deixava o
 * `.lb-editor` 5 px mais alto que a janela; ao escolher uma forma no menu
 * "Opções de Desenho" o editor rolava esses 5 px, subia inteiro e mostrava uma
 * faixa preta embaixo. O layout de verdade é provado no navegador
 * (`e2e/task-editor-sem-faixa-preta.spec.ts`); aqui, sem layout (jsdom), fica
 * a regra que tira a sobra.
 *
 * Mesmo arranjo sem placa de vídeo de `PixiCanvas.objetos.test.tsx`: só o
 * `Application` (pede WebGL) e a medida do texto (sem canvas 2d) são trocados.
 */

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 1200, 800)
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
    readonly ticker = { add: () => {}, remove: () => {} }
    readonly canvas = document.createElement('canvas')
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

let raiz: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // O jsdom não tem ResizeObserver, e o canvas acompanha o tamanho do contêiner com ele.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  useMapStore.setState({
    map: createEmptyMap('m_canvas_bloco', 'Tela em bloco', 30, 20, 64),
    selection: [],
    past: [],
    future: [],
    activeTool: 'select',
    camera: { x: 0, y: 0, scale: 1 },
  })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  vi.unstubAllGlobals()
})

it('a tela do Pixi entra no contêiner como bloco: sem a linha de texto que sobrava 5 px embaixo do mapa', async () => {
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  // `onImageExporterChange` é das últimas coisas do setup: com ele chamado, o canvas já foi anexado.
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())

  const tela = raiz.querySelector('canvas')
  if (!(tela instanceof HTMLCanvasElement)) throw new Error('o PixiCanvas não anexou o canvas')
  expect(getComputedStyle(tela).display).toBe('block')
})
