/**
 * O "Leva a…" da escada de ponta a ponta no editor: o painel que o `App` monta
 * (`stairTravelPanel`, a mesma chamada que ele passa ao `StairControls`) sobre
 * as stores de verdade. Escolher o andar no campo cria a escada par lá; o
 * painel relido mostra a ligação; "Nenhum outro andar" desliga. Nenhuma prop
 * é montada à mão no teste.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Stair } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, subscribeToTravelLinks, stairTravelPanel } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { StairControls } = await import('./StairControls')

subscribeToTravelLinks()

const ESCADA: Stair = { id: 'escada-terreo', shape: 'straight', direction: 'up', segments: [{ x1: 400, y1: 300, x2: 400, y2: 180 }], stepWidth: 64 }

function mapaDoFundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`cena ${sceneId} fora do cache`)
  return slot.map
}

describe('StairControls + stairTravelPanel: o "Leva a…" que o App monta', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Térreo', 30, 20, 64))
    useSessionStore.getState().markSaved()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useAdventureStore.getState().reset()
  })

  /** Renderiza como o App: o painel é relido das stores a cada render. */
  function renderizar(): void {
    const map = useMapStore.getState().map
    const stair = map.stairs.find((s) => s.id === ESCADA.id) ?? ESCADA
    const travel = stairTravelPanel(useAdventureStore.getState(), map, stair)
    act(() =>
      root.render(<StairControls direction={stair.direction} onDirectionChange={() => {}} shape={stair.shape} onShapeChange={() => {}} stepWidth={64} onStepWidthChange={() => {}} grid={64} travel={travel} />),
    )
  }

  function campo(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>('#lb-stair-leva-a')
    if (select === null) throw new Error('sem o campo "Leva a"')
    return select
  }

  function escolher(value: string): void {
    act(() => {
      const select = campo()
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('escolher "1º andar" liga: nasce lá a escada que desce, e o painel relido mostra a ligação', () => {
    const andar1 = useAdventureStore.getState().createScene('1º andar', null)
    const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().switchScene(terreo)
    useMapStore.getState().addStair(ESCADA)

    renderizar()
    expect(campo().value).toBe('')
    expect(Array.from(campo().options).map((o) => o.textContent)).toEqual(['Nenhum outro andar', '1º andar'])
    escolher(andar1)

    expect(mapaDoFundo(andar1).stairs.map((s) => s.direction)).toEqual(['down'])
    renderizar()
    expect(campo().value).toBe(andar1)

    escolher('')
    expect(useMapStore.getState().map.pins).toEqual([])
    renderizar()
    expect(campo().value).toBe('')
  })

  it('mapa solto (sem aventura): o painel não existe e a seção não aparece', () => {
    useMapStore.getState().addStair(ESCADA)
    expect(stairTravelPanel(useAdventureStore.getState(), useMapStore.getState().map, ESCADA)).toBeNull()
    renderizar()
    expect(container.querySelector('#lb-stair-leva-a')).toBeNull()
    expect(container.querySelector('[aria-label="Sentido da escada"]')).not.toBeNull()
  })
})
