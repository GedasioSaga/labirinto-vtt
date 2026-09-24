/**
 * ESTADO DO MUNDO pela TELA, de ponta a ponta: o mestre abre a porta (e a luz)
 * no painel de propriedades DE VERDADE, escolhe "Depende do estado: Maré",
 * diz o efeito da maré baixa e troca a Maré — e a porta abre, a luz apaga.
 * Nenhuma regra é montada à mão: ela nasce dos cliques no painel, pela mesma
 * ligação que o App passa (`useAdventureStore.amarrarAoEstado`).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState, Light, Token, Wall } from '../types/map'

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

const { useAdventureStore } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { amarradosPorEstado } = await import('../lib/estadoDoMundo')
const { relevantPropertyGroups } = await import('../lib/toolProperties')
const { PropertiesPanel } = await import('./PropertiesPanel')
const { propsDoPainel } = await import('./propertiesPanelTestProps')
const { EstadoDaLuz, EstadoDaPorta } = await import('./DependeDoEstadoControls')

const FICHA: Token = { id: 'ninguem', characterId: null, name: 'Ninguém', x: 0, y: 0, size: 1, image: null }
const COMPORTA: Wall = {
  id: 'comporta',
  x1: 0,
  y1: 0,
  x2: 50,
  y2: 0,
  blocksLight: true,
  blocksMove: true,
  door: { open: false, locked: false, kind: 'normal' },
}
const LAMPADA: Light = { id: 'lampada', x: 200, y: 200, radius: 120, color: '#ffdd88', intensity: 1 }

describe('"Depende do estado" no painel de propriedades', () => {
  let container: HTMLDivElement
  let root: Root
  let mare: string

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('map_andar0', 'Andar 0', 30, 20, 64))
    useSessionStore.getState().markSaved()
    // A aventura nasce com a segunda cena; a cena aberta passa a ser "Galerias".
    useAdventureStore.getState().createScene('Galerias', null)
    useMapStore.setState((state) => ({ map: { ...state.map, walls: [COMPORTA], lights: [LAMPADA] } }))
    const id = useAdventureStore.getState().criarEstadoDoMundo('Maré', 'alta, baixa')
    if (id === null) throw new Error('não criou o estado')
    mare = id
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function porta(): Wall {
    const wall = useMapStore.getState().map.walls.find((w) => w.id === 'comporta')
    if (wall === undefined) throw new Error('a comporta sumiu')
    return wall
  }

  function portaAgora(): DoorState | null {
    return porta().door
  }

  function lampada(): Light {
    const light = useMapStore.getState().map.lights.find((l) => l.id === 'lampada')
    if (light === undefined) throw new Error('a lâmpada sumiu')
    return light
  }

  function estados() {
    return useAdventureStore.getState().adventure?.estados ?? []
  }

  /** O painel com a comporta selecionada, como o App monta a cada mudança da store. */
  function renderPainelDaPorta(): void {
    const wall = porta()
    const props = propsDoPainel(FICHA, {
      selectedToken: null,
      groups: relevantPropertyGroups('select', { wall: true, wallHasDoor: true }),
      selectedWall: wall,
      // A mesma ligação de App.tsx (`estadoDaPorta`).
      estadoDaPorta: <EstadoDaPorta wall={wall} estados={estados()} onAmarrar={(amarra) => useAdventureStore.getState().amarrarAoEstado(amarra)} />,
    })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  function renderPainelDaLuz(): void {
    const light = lampada()
    const props = propsDoPainel(FICHA, {
      selectedToken: null,
      groups: relevantPropertyGroups('select', { light: true }),
      selectedLight: light,
      // A mesma ligação de App.tsx (`estadoDaLuz`).
      estadoDaLuz: <EstadoDaLuz light={light} estados={estados()} onAmarrar={(amarra) => useAdventureStore.getState().amarrarAoEstado(amarra)} />,
    })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  function lista(rotulo: string): HTMLSelectElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').trim().startsWith(rotulo))
    const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
    if (!(alvo instanceof HTMLSelectElement)) throw new Error(`sem lista "${rotulo}" no painel`)
    return alvo
  }

  function escolher(rotulo: string, valor: string): void {
    const select = lista(rotulo)
    act(() => {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('porta: amarrar pelo painel e trocar a Maré abre a comporta (e ela conta como amarrada)', () => {
    renderPainelDaPorta()
    const antes = useMapStore.getState().past.length
    escolher('Depende do estado', mare)
    // Amarrar é edição do mestre: um passo no desfazer, sem mexer no estado real da porta.
    expect(useMapStore.getState().past.length).toBe(antes + 1)
    expect(portaAgora()).toEqual(expect.objectContaining({ open: false, locked: false }))
    expect(portaAgora()?.porEstado?.estadoId).toBe(mare)

    renderPainelDaPorta()
    escolher('baixa', 'aberta')
    expect(amarradosPorEstado([useMapStore.getState().map]).get(mare)).toBe(1)

    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(mare, 'baixa')
    expect(resumo).toEqual({ elementos: 1, cenas: 1 })
    expect(portaAgora()).toEqual(expect.objectContaining({ open: true, locked: false }))

    // E volta: "alta" ficou no efeito de antes (fechada).
    useAdventureStore.getState().trocarEstadoDoMundo(mare, 'alta')
    expect(portaAgora()).toEqual(expect.objectContaining({ open: false, locked: false }))
  })

  it('luz: amarrar à Maré com "baixa → Apagada" e trocar apaga a lâmpada', () => {
    renderPainelDaLuz()
    escolher('Depende do estado', mare)
    renderPainelDaLuz()
    escolher('baixa', 'apagada')
    expect(lampada().apagada).toBeUndefined()

    useAdventureStore.getState().trocarEstadoDoMundo(mare, 'baixa')
    expect(lampada().apagada).toBe(true)
    useAdventureStore.getState().trocarEstadoDoMundo(mare, 'alta')
    expect(lampada().apagada).toBeUndefined()
  })

  it('com a maré já baixa, dizer "baixa → Aberta" abre a porta na hora', () => {
    useAdventureStore.getState().trocarEstadoDoMundo(mare, 'baixa')
    renderPainelDaPorta()
    escolher('Depende do estado', mare)
    renderPainelDaPorta()
    escolher('baixa', 'aberta')
    expect(portaAgora()).toEqual(expect.objectContaining({ open: true }))
  })
})
