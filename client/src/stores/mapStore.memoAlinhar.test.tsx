import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alignableUnitCount } from '../lib/alignDistribute'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import type { SelectionItem } from '../lib/selectionModel'
import type { Drawing, MapData, Region, Wall } from '../types/map'
import { selectAlignableUnitCount, useMapStore } from './mapStore'

/**
 * O App lê a contagem do painel "Alinhar e distribuir" com
 * `useMapStore(selectAlignableUnitCount)`, e o zustand reavalia o seletor a
 * cada `set()` da store — inclusive o `setCamera` de cada pointermove de pan e
 * de cada evento de roda. Com o mapa e a seleção iguais a conta dá o mesmo
 * número, então o seletor devolve o último sem refazê-la (com 40 Salas
 * selecionadas na a09-blocos ela custa ~3 a 11 ms, e o pan dispara 60 por
 * segundo). Os outros casos provam que o memo não segura número velho.
 */

// Conta as chamadas da conta de verdade sem mudar o que ela devolve.
vi.mock('../lib/alignDistribute', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/alignDistribute')>()
  return { ...real, alignableUnitCount: vi.fn(real.alignableUnitCount) }
})
const contaDeVerdade = vi.mocked(alignableUnitCount)

/** 2 s de pan a 60 pointermove/s e um giro de roda: cada um é um `setCamera`. */
const EVENTOS_DE_PAN = 120
const EVENTOS_DE_RODA = 30

function salas(n: number): { regions: Region[]; walls: Wall[] } {
  const regions: Region[] = []
  const walls: Wall[] = []
  for (let i = 0; i < n; i += 1) {
    const x = (i % 8) * 200
    const y = Math.floor(i / 8) * 200
    const ids: [string, string, string, string] = [`r${i}w0`, `r${i}w1`, `r${i}w2`, `r${i}w3`]
    const sala = buildRoomFromDraft(`r${i}`, ids, { x, y }, { x: x + 100, y: y + 100 }, undefined, undefined, `Sala ${i}`)
    regions.push(sala.region)
    walls.push(...sala.walls)
  }
  return { regions, walls }
}

/** O que o laço seleciona numa Sala: a região e as paredes dela. */
function selecaoDeSalas(regions: readonly Region[], walls: readonly Wall[]): SelectionItem[] {
  const items: SelectionItem[] = []
  for (const region of regions) {
    items.push({ kind: 'region', id: region.id })
    for (const wall of walls) if (wall.regionId === region.id) items.push({ kind: 'wall', id: wall.id })
  }
  return items
}

function pilar(id: string, x: number, y: number): Drawing {
  return { id, kind: 'rect', x, y, w: 60, h: 60, color: '#1e32d2', width: 2, filled: true, fillAlpha: 1 }
}

function mapaCom(partes: Partial<MapData>): MapData {
  return {
    ...useMapStore.getState().map,
    tokens: [],
    lights: [],
    stairs: [],
    props: [],
    regions: [],
    walls: [],
    drawings: [],
    floor: [],
    ...partes,
  }
}

/** O painel como o App o alimenta: a contagem vem do seletor, pela store. */
function ContagemDoPainel() {
  return <output>{useMapStore(selectAlignableUnitCount)}</output>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montarPainel() {
  act(() => root.render(<ContagemDoPainel />))
}

describe('selectAlignableUnitCount guarda a última contagem', () => {
  it('pan e roda com 40 Salas selecionadas não refazem a conta', () => {
    const { regions, walls } = salas(40)
    useMapStore.setState({ map: mapaCom({ regions, walls }), selection: selecaoDeSalas(regions, walls), past: [], future: [] })
    montarPainel()
    expect(container.textContent).toBe('40')

    contaDeVerdade.mockClear()
    const { setCamera } = useMapStore.getState()
    act(() => {
      for (let i = 0; i < EVENTOS_DE_PAN; i += 1) setCamera({ x: i * 3, y: i * 2, scale: 1 })
      for (let i = 0; i < EVENTOS_DE_RODA; i += 1) setCamera({ x: 360, y: 240, scale: 1 + i * 0.05 })
    })

    expect(contaDeVerdade).toHaveBeenCalledTimes(0)
    expect(container.textContent).toBe('40')
  })

  it('só refaz a conta quando o mapa ou a seleção trocam de referência', () => {
    const { regions, walls } = salas(2)
    const mapa = mapaCom({ regions, walls })
    const selecao = selecaoDeSalas(regions, walls)

    contaDeVerdade.mockClear()
    expect(selectAlignableUnitCount({ map: mapa, selection: selecao })).toBe(2)
    expect(selectAlignableUnitCount({ map: mapa, selection: selecao })).toBe(2)
    expect(contaDeVerdade).toHaveBeenCalledTimes(1)

    expect(selectAlignableUnitCount({ map: { ...mapa }, selection: selecao })).toBe(2)
    expect(contaDeVerdade).toHaveBeenCalledTimes(2)

    expect(selectAlignableUnitCount({ map: mapa, selection: [...selecao] })).toBe(2)
    expect(contaDeVerdade).toHaveBeenCalledTimes(3)
  })

  it('seleção nova muda a contagem na hora: o memo não segura número velho', () => {
    const { regions, walls } = salas(3)
    useMapStore.setState({ map: mapaCom({ regions, walls }), selection: [], past: [], future: [] })
    montarPainel()
    expect(container.textContent).toBe('0')

    act(() => useMapStore.getState().setSelection(selecaoDeSalas(regions.slice(0, 1), walls)))
    expect(container.textContent).toBe('1')

    act(() => useMapStore.getState().setSelection(selecaoDeSalas(regions, walls)))
    expect(container.textContent).toBe('3')

    act(() => useMapStore.getState().setSelection([]))
    expect(container.textContent).toBe('0')
  })

  it('mapa novo com a MESMA seleção refaz a conta, e voltar ao mapa antigo também', () => {
    const selecao: SelectionItem[] = [{ kind: 'drawing', id: 'p' }, { kind: 'drawing', id: 'q' }]
    const comOsDois = mapaCom({ drawings: [pilar('p', 0, 0), pilar('q', 200, 0)] })
    const semQ: MapData = { ...comOsDois, drawings: [pilar('p', 0, 0)] }
    useMapStore.setState({ map: comOsDois, selection: selecao, past: [], future: [] })
    montarPainel()
    expect(container.textContent).toBe('2')

    act(() => useMapStore.setState({ map: semQ }))
    expect(container.textContent).toBe('1')

    // O Ctrl+Z devolve o retrato guardado, a MESMA referência de antes: a
    // contagem tem de voltar junto, mesmo o memo tendo visto outro mapa no meio.
    act(() => useMapStore.setState({ map: comOsDois }))
    expect(container.textContent).toBe('2')
  })

  it('dá o mesmo número que a conta pura, para cada seleção', () => {
    const { regions, walls } = salas(4)
    const mapa = mapaCom({ regions, walls, drawings: [pilar('p', 900, 900)] })
    const pilarSelecionado: SelectionItem = { kind: 'drawing', id: 'p' }
    const duasParedesDaMesmaSala: SelectionItem[] = [
      { kind: 'wall', id: 'r0w0' },
      { kind: 'wall', id: 'r0w1' },
    ]
    const selecoes: SelectionItem[][] = [
      [],
      selecaoDeSalas(regions.slice(0, 2), walls),
      [...selecaoDeSalas(regions, walls), pilarSelecionado],
      duasParedesDaMesmaSala,
      [...duasParedesDaMesmaSala, ...selecaoDeSalas(regions.slice(0, 1), walls)],
    ]

    for (const selecao of selecoes) {
      const esperado = alignableUnitCount(mapa, selecao)
      expect(selectAlignableUnitCount({ map: mapa, selection: selecao })).toBe(esperado)
      expect(selectAlignableUnitCount({ map: mapa, selection: selecao })).toBe(esperado)
    }
  })
})
