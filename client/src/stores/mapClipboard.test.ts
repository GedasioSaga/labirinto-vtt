import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { runClipboardShortcut } from './mapClipboard'
import { useToastStore } from './toastStore'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { EMPTY_SELECTION, selectionOfItem } from '../lib/selectionModel'
import type { Drawing, MapData, Region, Token } from '../types/map'

// Copiar, colar e recortar (item 8 de docs/features-candidatas-2026-09-21.md).
// A régua e2e é client/e2e/task-jornada-copiar-e-colar.spec.ts; aqui o mesmo
// comportamento no nível da store, sem navegador.

const GRADE = 50

/** Salão: um retângulo laranja cheio e a sala azul "Despensa" com as 4 paredes. */
function salao(): MapData {
  const base = mapFactory.createEmptyMap('map_salao', 'Salão', 20, 16, GRADE)
  const desenho: Drawing = { id: 'des-laranja', kind: 'rect', x: 820, y: 100, w: 60, h: 60, color: '#ff5a00', width: 2, filled: true, fillAlpha: 1 }
  const draft = buildRoomFromDraft('sala-despensa', ['p0', 'p1', 'p2', 'p3'], { x: 400, y: 100 }, { x: 600, y: 300 }, '#1e32d2')
  const sala: Region = { ...draft.region, room: { shape: 'rect', name: 'Despensa' } }
  return mapFactory.addDrawing(mapFactory.addRoom(base, sala, draft.walls), desenho)
}

/** Outro mapa (cena ou mapa avulso), vazio: nem desenho nem sala. */
function cripta(): MapData {
  return mapFactory.createEmptyMap('map_cripta', 'Cripta', 20, 16, GRADE)
}

function centroDoDesenho(d: Drawing | undefined): { x: number; y: number } {
  if (d === undefined || d.kind !== 'rect') throw new Error('esperava um retângulo')
  return { x: d.x + d.w / 2, y: d.y + d.h / 2 }
}

function centroDaSala(r: Region | undefined): { x: number; y: number } {
  if (r === undefined) throw new Error('esperava uma sala')
  const xs = r.points.map((p) => p.x)
  const ys = r.points.map((p) => p.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

/** "Perto do cursor": o centro da cópia cai a no máximo meia célula do ponteiro (ajuste à grade). */
function expectPerto(centro: { x: number; y: number }, cursor: { x: number; y: number }): void {
  expect(Math.abs(centro.x - cursor.x)).toBeLessThanOrEqual(GRADE / 2)
  expect(Math.abs(centro.y - cursor.y)).toBeLessThanOrEqual(GRADE / 2)
}

function selecionar(kind: 'drawing' | 'region', id: string): void {
  useMapStore.getState().setSelection(selectionOfItem({ kind, id }))
}

describe('copiar, colar e recortar', () => {
  beforeEach(() => {
    useMapStore.setState({ map: salao(), past: [], future: [], selection: EMPTY_SELECTION, activeTool: 'select', clipboard: null })
    useToastStore.setState({ toasts: [] })
  })

  it('Ctrl+C não muda o mapa nem o histórico', () => {
    const antes = useMapStore.getState().map
    selecionar('drawing', 'des-laranja')
    expect(useMapStore.getState().copySelected()).toBe(true)
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('Ctrl+V cola uma cópia do desenho perto do cursor, com id novo, e o original fica', () => {
    selecionar('drawing', 'des-laranja')
    useMapStore.getState().copySelected()
    const cursor = { x: 300, y: 600 }
    expect(useMapStore.getState().pasteClipboardAt(cursor)).toBe(true)
    const { map, selection, past } = useMapStore.getState()
    const laranjas = map.drawings.filter((d) => d.color === '#ff5a00')
    expect(laranjas).toHaveLength(2)
    expect(map.drawings.find((d) => d.id === 'des-laranja')).toBeDefined()
    const copia = laranjas.find((d) => d.id !== 'des-laranja')
    expectPerto(centroDoDesenho(copia), cursor)
    expect(selection).toEqual([{ kind: 'drawing', id: copia?.id }])
    // Uma entrada de histórico: um Ctrl+Z tira a colagem.
    expect(past).toHaveLength(1)
  })

  it('colar duas vezes põe duas cópias (a área de transferência não se esgota)', () => {
    selecionar('drawing', 'des-laranja')
    useMapStore.getState().copySelected()
    useMapStore.getState().pasteClipboardAt({ x: 300, y: 600 })
    useMapStore.getState().pasteClipboardAt({ x: 500, y: 600 })
    expect(useMapStore.getState().map.drawings.filter((d) => d.color === '#ff5a00')).toHaveLength(3)
  })

  it('copiado no Salão, cola na Cripta (outra cena ou outro mapa) perto do cursor, e o Salão não ganha cópia', () => {
    selecionar('drawing', 'des-laranja')
    useMapStore.getState().copySelected()
    const noSalao = useMapStore.getState().map
    useMapStore.getState().loadMap(cripta())
    const cursor = { x: 250, y: 500 }
    expect(useMapStore.getState().pasteClipboardAt(cursor)).toBe(true)
    const naCripta = useMapStore.getState().map
    expect(naCripta.id).toBe('map_cripta')
    expect(naCripta.drawings).toHaveLength(1)
    expectPerto(centroDoDesenho(naCripta.drawings[0]), cursor)
    expect(noSalao.drawings.filter((d) => d.color === '#ff5a00')).toHaveLength(1)
  })

  it('Ctrl+X tira o desenho do mapa, e Ctrl+V o devolve perto do cursor', () => {
    selecionar('drawing', 'des-laranja')
    expect(useMapStore.getState().cutSelected()).toBe(true)
    expect(useMapStore.getState().map.drawings.find((d) => d.color === '#ff5a00')).toBeUndefined()
    expect(useMapStore.getState().selection).toEqual(EMPTY_SELECTION)
    const cursor = { x: 300, y: 600 }
    useMapStore.getState().pasteClipboardAt(cursor)
    const laranjas = useMapStore.getState().map.drawings.filter((d) => d.color === '#ff5a00')
    expect(laranjas).toHaveLength(1)
    expectPerto(centroDoDesenho(laranjas[0]), cursor)
    // Recortar e colar são dois passos: dois Ctrl+Z voltam ao mapa de antes.
    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('a sala "Despensa" copiada no Salão cola na Cripta com o nome, as 4 paredes e perto do cursor', () => {
    selecionar('region', 'sala-despensa')
    useMapStore.getState().copySelected()
    useMapStore.getState().loadMap(cripta())
    const cursor = { x: 300, y: 500 }
    useMapStore.getState().pasteClipboardAt(cursor)
    const { map } = useMapStore.getState()
    expect(map.regions).toHaveLength(1)
    const colada = map.regions[0]
    expect(colada.id).not.toBe('sala-despensa')
    expect(colada.room?.name.startsWith('Despensa')).toBe(true)
    expect(colada.fillColor).toBe('#1e32d2')
    expectPerto(centroDaSala(colada), cursor)
    expect(map.walls.filter((w) => w.regionId === colada.id)).toHaveLength(4)
  })

  it('ficha colada (copiada ou recortada) sempre ganha id novo, mesmo onde já há uma ficha com o id dela', () => {
    const grog: Token = { id: 'grog', characterId: null, name: 'Grog', x: 100, y: 100, size: 1, image: null }
    useMapStore.setState({ map: mapFactory.addToken(salao(), grog) })
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: 'grog' }))
    useMapStore.getState().copySelected()
    // A outra cena já tem uma ficha "grog" (cena copiada): colar não a substitui.
    useMapStore.getState().loadMap(mapFactory.addToken(cripta(), { ...grog, name: 'Grog da Cripta' }))
    expect(useMapStore.getState().pasteClipboardAt({ x: 300, y: 300 })).toBe(true)
    const naCripta = useMapStore.getState().map.tokens
    expect(naCripta.map((t) => t.name)).toEqual(['Grog da Cripta', 'Grog'])
    expect(naCripta[0]?.id).toBe('grog')
    expect(naCripta[1]?.id).not.toBe('grog')

    // Recortar e colar de volta também não reaproveita o id.
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: 'grog' }))
    useMapStore.getState().cutSelected()
    useMapStore.getState().pasteClipboardAt({ x: 500, y: 500 })
    const depois = useMapStore.getState().map.tokens
    expect(depois).toHaveLength(2)
    expect(depois.some((t) => t.id === 'grog')).toBe(false)
  })

  it('sala recortada e colada mantém o nome exato (não é cópia, é a mesma sala em outro lugar)', () => {
    selecionar('region', 'sala-despensa')
    useMapStore.getState().cutSelected()
    expect(useMapStore.getState().map.regions).toHaveLength(0)
    useMapStore.getState().pasteClipboardAt({ x: 300, y: 500 })
    expect(useMapStore.getState().map.regions[0]?.room?.name).toBe('Despensa')
    // A segunda colagem do mesmo recorte já é cópia.
    useMapStore.getState().pasteClipboardAt({ x: 700, y: 600 })
    expect(useMapStore.getState().map.regions[1]?.room?.name).toBe('Despensa (cópia)')
  })

  it('sub-sala colada em outro mapa não fica apontando para a mãe que ficou no mapa de origem', () => {
    const mae = buildRoomFromDraft('mae', ['m0', 'm1', 'm2', 'm3'], { x: 0, y: 0 }, { x: 400, y: 400 })
    const filhaDraft = buildRoomFromDraft('filha', ['f0', 'f1', 'f2', 'f3'], { x: 100, y: 100 }, { x: 200, y: 200 })
    const filha: Region = { ...filhaDraft.region, parentId: 'mae', room: { shape: 'rect', name: 'Closet' } }
    const casa = mapFactory.addRoom(mapFactory.addRoom(cripta(), mae.region, mae.walls), filha, filhaDraft.walls)
    useMapStore.setState({ map: casa })
    selecionar('region', 'filha')
    useMapStore.getState().copySelected()
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('outro', 'Outro', 20, 16, GRADE))
    useMapStore.getState().pasteClipboardAt({ x: 600, y: 600 })
    const colada = useMapStore.getState().map.regions[0]
    expect(colada?.room?.name.startsWith('Closet')).toBe(true)
    expect(colada?.parentId).toBeUndefined()
  })

  it('sem nada selecionado, Ctrl+C e Ctrl+X não fazem nada e não apagam o que já estava copiado', () => {
    selecionar('drawing', 'des-laranja')
    useMapStore.getState().copySelected()
    const guardado = useMapStore.getState().clipboard
    useMapStore.getState().setSelection(EMPTY_SELECTION)
    expect(useMapStore.getState().copySelected()).toBe(false)
    expect(useMapStore.getState().cutSelected()).toBe(false)
    expect(useMapStore.getState().clipboard).toBe(guardado)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('Ctrl+V sem nada copiado não muda o mapa', () => {
    const antes = useMapStore.getState().map
    expect(useMapStore.getState().pasteClipboardAt({ x: 100, y: 100 })).toBe(false)
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('a peça de chão copiada cola perto do cursor', () => {
    const peca = { id: 'chao-1', shape: { kind: 'rect' as const, cx: 100, cy: 100, w: 100, h: 100 }, op: 'add' as const, modifiers: {} }
    useMapStore.setState({ map: mapFactory.addFloorPiece(cripta(), peca) })
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'floor', id: 'chao-1' }))
    useMapStore.getState().copySelected()
    const cursor = { x: 600, y: 400 }
    useMapStore.getState().pasteClipboardAt(cursor)
    const colada = useMapStore.getState().map.floor.find((p) => p.id !== 'chao-1')
    if (colada === undefined || colada.shape.kind !== 'rect') throw new Error('esperava a peça colada')
    expectPerto({ x: colada.shape.cx, y: colada.shape.cy }, cursor)
  })
})

describe('runClipboardShortcut (o que o teclado do editor chama)', () => {
  beforeEach(() => {
    useMapStore.setState({ map: salao(), past: [], future: [], selection: EMPTY_SELECTION, activeTool: 'select', clipboard: null })
    useToastStore.setState({ toasts: [] })
  })

  it('copy com seleção avisa o que foi copiado e devolve true (quem chama impede o copiar do navegador)', () => {
    selecionar('region', 'sala-despensa')
    expect(runClipboardShortcut('copy', null)).toBe(true)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Sala "Despensa" copiada — Ctrl+V cola perto do cursor'])
  })

  it('copy sem seleção devolve false e fica calado: o Ctrl+C do navegador continua valendo', () => {
    expect(runClipboardShortcut('copy', null)).toBe(false)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('cut avisa que Ctrl+Z desfaz', () => {
    selecionar('drawing', 'des-laranja')
    expect(runClipboardShortcut('cut', null)).toBe(true)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Desenho recortado — Ctrl+V cola perto do cursor, Ctrl+Z desfaz'])
  })

  it('paste cola no cursor quando há cursor', () => {
    selecionar('drawing', 'des-laranja')
    runClipboardShortcut('copy', null)
    const cursor = { x: 300, y: 600 }
    expect(runClipboardShortcut('paste', { cursor, fallback: { x: 0, y: 0 } })).toBe(true)
    const copia = useMapStore.getState().map.drawings.find((d) => d.color === '#ff5a00' && d.id !== 'des-laranja')
    expectPerto(centroDoDesenho(copia), cursor)
  })

  it('paste com o ponteiro fora do mapa cola no ponto de reserva (centro da vista)', () => {
    selecionar('drawing', 'des-laranja')
    runClipboardShortcut('copy', null)
    const centro = { x: 500, y: 400 }
    runClipboardShortcut('paste', { cursor: null, fallback: centro })
    const copia = useMapStore.getState().map.drawings.find((d) => d.color === '#ff5a00' && d.id !== 'des-laranja')
    expectPerto(centroDoDesenho(copia), centro)
  })

  it('paste sem nada copiado explica em vez de ficar mudo', () => {
    expect(runClipboardShortcut('paste', { cursor: { x: 1, y: 1 }, fallback: { x: 0, y: 0 } })).toBe(false)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Nada copiado ainda — selecione algo e use Ctrl+C ou Ctrl+X'])
  })
})
