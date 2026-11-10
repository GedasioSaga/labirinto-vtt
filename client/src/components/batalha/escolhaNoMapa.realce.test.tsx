import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { selectionOfItem } from '../../lib/selectionModel'
import { PixiCanvas } from '../../pixi/PixiCanvas'
import { useMapStore } from '../../stores/mapStore'
import type { Token } from '../../types/map'
import { abrirDestaqueDaFaixa, abrirEscolhaNoMapa } from './escolhaNoMapa'

/**
 * Segunda auditoria da batalha (09/11/2026, achado 3): a carta da faixa e a
 * linha da lista acendem a ficha pela seleção DE VERDADE do editor. Com o
 * mouse parado numa carta, Delete ou Backspace apagava a ficha acesa. Com o
 * PixiCanvas montado (é ele que trata a tecla), no arranjo sem navegador de
 * `pixi/PixiCanvas.camadaTravada.test.tsx`. Dados inventados; no máximo 2 testes.
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

const URSO: Token = { id: 'tok_urso', characterId: null, name: 'Urso de Teste', x: 200, y: 200, size: 1, image: null, npc: true }
const CAPITA: Token = { id: 'tok_capita', characterId: null, name: 'Capitã de Teste', x: 400, y: 200, size: 1, image: null }

/** O tanto que a carta da faixa espera para acender (`ESPERA_DA_INTENCAO_MS`), com folga. */
const DEPOIS_DA_INTENCAO_MS = 200

let raiz: HTMLDivElement
let root: Root

const fichasNoMapa = (): string[] => useMapStore.getState().map.tokens.map((token) => token.id)
const selecionadas = (): string[] => useMapStore.getState().selection.map((item) => item.id)

function teclar(tecla: { key: string; ctrlKey?: boolean }): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { ...tecla, bubbles: true }))
  })
}

beforeEach(async () => {
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
    map: { ...createEmptyMap('m_realce', 'Clareira de Teste', 40, 20, 64), tokens: [URSO, CAPITA] },
    selection: [],
    selectedPinId: null,
    past: [],
    future: [],
    activeTool: 'select',
    camera: { x: 0, y: 0, scale: 1 },
  })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  // `onImageExporterChange` é das últimas coisas do setup do canvas: com ele chamado, o ouvinte do teclado está ligado.
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  vi.unstubAllGlobals()
})

describe('a ficha acesa por uma lista não é seleção do mestre', () => {
  it('com a ficha acesa pela linha da lista ou pela carta da faixa, Delete, Backspace e Ctrl+X não a apagam', async () => {
    const lista = abrirEscolhaNoMapa(() => undefined)
    act(() => lista.destacar(URSO.id))
    expect(selecionadas()).toEqual([URSO.id])
    teclar({ key: 'Delete' })
    teclar({ key: 'Backspace' })
    teclar({ key: 'x', ctrlKey: true })
    expect(fichasNoMapa()).toEqual([URSO.id, CAPITA.id])
    act(() => lista.soltar())

    const faixa = abrirDestaqueDaFaixa()
    faixa.apontar(CAPITA.id)
    await act(() => new Promise((ok) => setTimeout(ok, DEPOIS_DA_INTENCAO_MS)))
    expect(selecionadas()).toEqual([CAPITA.id])
    teclar({ key: 'Delete' })
    expect(fichasNoMapa()).toEqual([URSO.id, CAPITA.id])
    act(() => faixa.soltar())
  })

  it('sem realce, Delete apaga a ficha que o mestre selecionou, como sempre (mesmo logo depois de uma lista a ter acendido)', () => {
    const lista = abrirEscolhaNoMapa(() => undefined)
    act(() => lista.destacar(URSO.id))
    act(() => lista.soltar())
    act(() => useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: URSO.id })))
    teclar({ key: 'Delete' })
    expect(fichasNoMapa()).toEqual([CAPITA.id])
  })
})
