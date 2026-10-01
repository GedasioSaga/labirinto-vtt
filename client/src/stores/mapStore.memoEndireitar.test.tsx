import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLineDrawing } from '../lib/drawingFactory'
import { endireitarMudariaAlgo } from '../lib/endireitar'
import { createEmptyMap } from '../lib/mapFactory'
import type { SelectionSet } from '../lib/selectionModel'
import type { Drawing, MapData } from '../types/map'
import { selectEndireitarMudaria, useMapStore } from './mapStore'

/**
 * O botão "Endireitar" do painel (`components/EndireitarControl.tsx`) lê
 * `useMapStore(selectEndireitarMudaria)`, e o zustand reavalia o seletor a cada
 * `set()` da store — inclusive o `setCamera` de cada pointermove de pan e de
 * cada evento de roda. A conta procura encostos no mapa inteiro (medido: 3,7 ms
 * com uma linha torta num mapa de 14 mil paredes), então com o mapa e a seleção
 * iguais o seletor devolve a última resposta. Mesmo cuidado de
 * `selectAlignableUnitCount` (`mapStore.memoAlinhar.test.tsx`).
 */

// Conta as chamadas da conta de verdade sem mudar o que ela devolve.
vi.mock('../lib/endireitar', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/endireitar')>()
  return { ...real, endireitarMudariaAlgo: vi.fn(real.endireitarMudariaAlgo) }
})
const contaDeVerdade = vi.mocked(endireitarMudariaAlgo)

/** 2 s de pan a 60 pointermove/s e um giro de roda: cada um é um `setCamera`. */
const EVENTOS_DE_PAN = 120
const EVENTOS_DE_RODA = 30

function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
  return buildLineDrawing(id, { x: x1, y: y1 }, { x: x2, y: y2 }, '#ffffff', 2)
}

const MAPA: MapData = { ...createEmptyMap('m_memo_endireitar', 'Endireitar', 30, 20, 64), drawings: [linha('torta', 300, 200, 360, 420)] }
const SELECAO: SelectionSet = [{ kind: 'drawing', id: 'torta' }]

/** O painel como o botão o lê: a resposta vem do seletor, pela store. */
function RespostaDoPainel() {
  return <output>{String(useMapStore(selectEndireitarMudaria))}</output>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.setState({ map: MAPA, selection: SELECAO, past: [], future: [] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('selectEndireitarMudaria guarda a última resposta', () => {
  it('pan e roda com a linha torta selecionada não refazem a conta', () => {
    act(() => root.render(<RespostaDoPainel />))
    expect(container.textContent).toBe('true')

    contaDeVerdade.mockClear()
    const { setCamera } = useMapStore.getState()
    act(() => {
      for (let i = 0; i < EVENTOS_DE_PAN; i += 1) setCamera({ x: i * 3, y: i * 2, scale: 1 })
      for (let i = 0; i < EVENTOS_DE_RODA; i += 1) setCamera({ x: 360, y: 240, scale: 1 + i * 0.05 })
    })

    expect(contaDeVerdade).toHaveBeenCalledTimes(0)
    expect(container.textContent).toBe('true')
  })

  it('só refaz a conta quando o mapa ou a seleção trocam de referência', () => {
    // Referências que nenhum outro teste usou: a última resposta guardada é do módulo.
    const mapa: MapData = { ...MAPA }
    const selecao: SelectionSet = [...SELECAO]
    contaDeVerdade.mockClear()
    expect(selectEndireitarMudaria({ map: mapa, selection: selecao })).toBe(true)
    expect(selectEndireitarMudaria({ map: mapa, selection: selecao })).toBe(true)
    expect(contaDeVerdade).toHaveBeenCalledTimes(1)

    expect(selectEndireitarMudaria({ map: { ...mapa }, selection: selecao })).toBe(true)
    expect(contaDeVerdade).toHaveBeenCalledTimes(2)

    expect(selectEndireitarMudaria({ map: mapa, selection: [...selecao] })).toBe(true)
    expect(contaDeVerdade).toHaveBeenCalledTimes(3)
  })

  it('a resposta acompanha o mapa: endireitada a linha, some; o Ctrl+Z a traz de volta', () => {
    act(() => root.render(<RespostaDoPainel />))
    expect(container.textContent).toBe('true')

    act(() => {
      useMapStore.getState().endireitarSelecionados()
    })
    expect(container.textContent).toBe('false')

    act(() => useMapStore.getState().undo())
    expect(container.textContent).toBe('true')

    act(() => useMapStore.getState().setSelection([]))
    expect(container.textContent).toBe('false')
  })
})
