/**
 * O painel da escada, como o App monta (`stairTravelPanel` sobre as stores de
 * verdade): "Criar andar de cima" (ou "de baixo", conforme o sentido) cria a
 * cena nova e já liga a escada nela, com o modo de passagem que o mestre
 * escolheu antes; e o segmento "Forma" troca a escada para "Espiral".
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

describe('StairControls: criar andar e escada em espiral', () => {
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
    useAdventureStore.getState().createScene('Praça', null)
    const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().switchScene(terreo)
    useMapStore.getState().addStair(ESCADA)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useAdventureStore.getState().reset()
  })

  function escadaAtual(): Stair {
    return useMapStore.getState().map.stairs.find((s) => s.id === ESCADA.id) ?? ESCADA
  }

  /** Renderiza como o App: tudo relido das stores a cada render. */
  function renderizar(): void {
    const map = useMapStore.getState().map
    const stair = escadaAtual()
    const travel = stairTravelPanel(useAdventureStore.getState(), map, stair)
    act(() =>
      root.render(
        <StairControls
          direction={stair.direction}
          onDirectionChange={() => {}}
          shape={stair.shape}
          onShapeChange={(shape) => useMapStore.getState().setStairShape(stair.id, shape)}
          stepWidth={64}
          onStepWidthChange={() => {}}
          grid={64}
          travel={travel}
        />,
      ),
    )
  }

  function botao(texto: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)
  }

  function clicar(texto: string): void {
    const alvo = botao(texto)
    if (alvo === undefined) throw new Error(`sem o botão "${texto}"`)
    act(() => alvo.click())
  }

  it('"Criar andar de cima" cria a cena, liga a escada com o modo escolhido, e o botão sai do painel', () => {
    renderizar()
    clicar('Livre')
    clicar('Criar andar de cima')

    const cenas = useAdventureStore.getState().adventure?.scenes ?? []
    const nova = cenas.find((s) => s.name === 'Térreo – andar de cima')
    if (nova === undefined) throw new Error('o andar não nasceu')
    expect(mapaDoFundo(nova.id).stairs.map((s) => s.direction)).toEqual(['down'])
    expect(useMapStore.getState().map.pins.map((p) => p.passagem)).toEqual(['livre'])

    renderizar()
    const campo = container.querySelector<HTMLSelectElement>('#lb-stair-leva-a')
    expect(campo?.value).toBe(nova.id)
    expect(botao('Criar andar de cima')).toBeUndefined()
  })

  it('escada que desce oferece "Criar andar de baixo"', () => {
    useMapStore.getState().setStairDirection(ESCADA.id, 'down')
    renderizar()
    expect(botao('Criar andar de cima')).toBeUndefined()
    clicar('Criar andar de baixo')
    const nova = useAdventureStore.getState().adventure?.scenes.find((s) => s.name === 'Térreo – andar de baixo')
    expect(nova).toBeDefined()
  })

  it('Forma: "Espiral" troca a escada selecionada, com desfazer', () => {
    renderizar()
    const forma = container.querySelector('[aria-label="Forma da escada"]')
    expect(Array.from(forma?.querySelectorAll('[role="radio"]') ?? []).map((b) => b.textContent?.trim())).toEqual(['Reta', 'Espiral'])
    expect(botao('Reta')?.getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('[aria-label="Tamanho da escada"]')).not.toBeNull()

    clicar('Espiral')
    expect(escadaAtual().shape).toBe('spiral')
    renderizar()
    expect(botao('Espiral')?.getAttribute('aria-checked')).toBe('true')
    expect(botao('Reta')?.getAttribute('aria-checked')).toBe('false')
    // A largura do lance não muda nada no círculo: o controle sai em vez de mentir.
    expect(container.querySelector('[aria-label="Tamanho da escada"]')).toBeNull()
    expect(container.querySelector('#lb-stair-step-width')).toBeNull()

    useMapStore.getState().undo()
    expect(escadaAtual().shape).toBe('straight')
  })
})
