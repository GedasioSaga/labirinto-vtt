import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { PixiCanvas } from '../pixi/PixiCanvas'
import type { MapData, Stair } from '../types/map'
import { StairControls } from './StairControls'

/**
 * A seta no seg da escada com o MAPA montado ao lado, como no app: o mapa
 * ouve o teclado no `window` e faz da seta um empurrão da seleção. Com o foco
 * numa opção do seg a seta é da opção (escolhe a vizinha); se ela subisse até
 * o mapa, a escada trocava de sentido E andava uma casa no mesmo toque, com
 * duas entradas no histórico. O teste do StairControls sozinho não vê isso.
 *
 * Mesmo arranjo sem navegador de `PixiCanvas.movimento.test.tsx`.
 */

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 1200, 800)
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
    readonly ticker = new pixi.Ticker()
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

const GRADE = 64
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 320, y1: 320, x2: 576, y2: 320 }], stepWidth: GRADE }

function mapa(): MapData {
  return { ...createEmptyMap('m_setas_no_seg', 'Setas no seg', 40, 20, GRADE), stairs: [ESCADA] }
}

/** O painel da escada ligado à store como o App liga (`App.tsx`, `stairControls`). */
function PainelDaEscada() {
  const escada = useMapStore((state) => state.map.stairs.find((s) => s.id === ESCADA.id))
  if (escada === undefined) return null
  const { setStairDirection, setStairShape, setStairStepWidthForStair } = useMapStore.getState()
  return (
    <StairControls
      direction={escada.direction}
      onDirectionChange={(direction) => setStairDirection(escada.id, direction)}
      shape={escada.shape}
      onShapeChange={(shape) => setStairShape(escada.id, shape)}
      stepWidth={escada.stepWidth}
      onStepWidthChange={(stepWidth) => setStairStepWidthForStair(escada.id, stepWidth)}
      grid={GRADE}
      travel={null}
      parte="essencial"
    />
  )
}

const empurraoDeVerdade = useMapStore.getState().moveSelectionBy
/** O que o `nudgeSelected` do mapa chama: espiado, mas ainda movendo de verdade. */
const empurrao = vi.fn(empurraoDeVerdade)

let raiz: HTMLDivElement
let root: Root
const exportador = vi.fn()

beforeEach(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  empurrao.mockClear()
  useMapStore.setState({
    map: mapa(),
    selection: [{ kind: 'stair', id: ESCADA.id }],
    past: [],
    future: [],
    activeTool: 'select',
    camera: { x: 0, y: 0, scale: 1 },
    moveSelectionBy: empurrao,
  })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
  await act(async () => {
    root.render(
      <>
        <PixiCanvas onImageExporterChange={exportador} />
        <PainelDaEscada />
      </>,
    )
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  useMapStore.setState({ moveSelectionBy: empurraoDeVerdade })
  vi.unstubAllGlobals()
})

const escada = (): Stair => {
  const achada = useMapStore.getState().map.stairs.find((s) => s.id === ESCADA.id)
  if (achada === undefined) throw new Error('a escada sumiu do mapa')
  return achada
}

function opcaoMarcada(grupo: string): HTMLElement {
  const marcada = raiz.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${grupo}"] [role="radio"][aria-checked="true"]`)
  if (marcada === null) throw new Error(`nenhuma opção marcada em ${grupo}`)
  return marcada
}

function teclar(el: Element, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('StairControls com o mapa montado: a seta no seg não empurra a escada', () => {
  it('controle: a seta fora do painel ainda é o empurrão do mapa (o ouvinte está vivo)', () => {
    teclar(document.body, 'ArrowRight')
    expect(empurrao).toHaveBeenCalledTimes(1)
    expect(escada().segments[0]).toMatchObject({ x1: 320 + GRADE, x2: 576 + GRADE })
  })

  it('foco em "Sobe", ArrowRight: vira "Desce", a escada fica onde estava e o histórico ganha UMA entrada', () => {
    const sobe = opcaoMarcada('Sentido da escada')
    act(() => sobe.focus())
    teclar(sobe, 'ArrowRight')
    expect(escada().direction).toBe('down')
    expect(empurrao).not.toHaveBeenCalled()
    expect(escada().segments).toEqual(ESCADA.segments)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(document.activeElement?.textContent).toBe('Desce')
  })

  it('Tamanho: a seta troca o preset e a escada não anda', () => {
    const media = opcaoMarcada('Tamanho da escada')
    expect(media.textContent).toBe('Média')
    act(() => media.focus())
    teclar(media, 'ArrowRight')
    expect(opcaoMarcada('Tamanho da escada').textContent).toBe('Grande')
    expect(escada().stepWidth).toBeGreaterThan(GRADE)
    expect(empurrao).not.toHaveBeenCalled()
    expect(escada().segments).toEqual(ESCADA.segments)
  })

  it('Forma: a seta escolhe a Espiral sem empurrar a escada', () => {
    const reta = opcaoMarcada('Forma da escada')
    act(() => reta.focus())
    teclar(reta, 'ArrowRight')
    expect(escada().shape).toBe('spiral')
    expect(empurrao).not.toHaveBeenCalled()
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})
