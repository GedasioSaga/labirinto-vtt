/**
 * CENAS EM PASTAS, a costura: a seção Cenas ligada à loja de verdade, do jeito
 * que o `App.tsx` liga (`sceneList` + `moveScene`). O aceite da simulação:
 * "Mercado arrastado sobre Porto Cinza fica recuado" — e pede Salvar.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'

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

const { useAdventureStore, sceneList, hasUnsavedWork } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { ScenesSection } = await import('./ScenesSection')

function mapa(id: string, name: string): MapData {
  return createEmptyMap(`map_${id}`, name, 20, 16, 64)
}

/** A seção como o App a monta: a lista vem da loja, e mover chama a loja. */
function CenasDaLoja() {
  const adventure = useAdventureStore((state) => state.adventure)
  const activeSceneId = useAdventureStore((state) => state.activeSceneId)
  const cache = useAdventureStore((state) => state.cache)
  const map = useMapStore((state) => state.map)
  return (
    <ScenesSection
      scenes={sceneList({ adventure, activeSceneId, cache }, map)}
      onSelect={(sceneId) => useAdventureStore.getState().switchScene(sceneId)}
      onCreate={() => {}}
      onRename={() => {}}
      onMove={adventure === null ? undefined : (sceneId, parentId) => useAdventureStore.getState().moveScene(sceneId, parentId)}
      adventureId={adventure?.id ?? null}
    />
  )
}

describe('ScenesSection + loja: cenas em pastas', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
    useSessionStore.getState().markSaved()
    const cenas = [
      { id: 'costa', name: 'Costa Norte', file: 'map.json' },
      { id: 'porto', name: 'Porto Cinza', file: 'scenes/porto/map.json', parentId: 'costa' },
      { id: 'mercado', name: 'Mercado', file: 'scenes/mercado/map.json' },
      { id: 'vila', name: 'Vila do Vau', file: 'scenes/vila/map.json' },
    ]
    const costa = mapa('costa', 'Costa Norte')
    useAdventureStore.getState().open({
      path: 'C:/appdata/maps/map_costa/map.json',
      map: costa,
      adventure: { version: 1, id: 'adv_loja', name: 'Viagem', startSceneId: 'costa', scenes: cenas },
      adventureDir: 'C:/appdata/maps/map_costa',
      activeSceneId: 'costa',
      scenes: cenas.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'costa' ? costa : mapa(entry.id, entry.name) })),
      changedSceneIds: [],
      adventureChanged: false,
      legacySources: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<CenasDaLoja />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const linhas = () => Array.from(container.querySelectorAll('ul[aria-label="Cenas da aventura"] > li')) as HTMLLIElement[]
  const nome = (li: Element) => li.querySelector<HTMLButtonElement>('.lb-cenas__nome')
  const linha = (texto: string) => {
    const li = linhas().find((item) => nome(item)?.textContent === texto)
    if (li === undefined) throw new Error(`sem a linha "${texto}"`)
    return li
  }

  function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', alvo: Element | null, y: number): void {
    if (alvo === null) throw new Error(`sem alvo para ${tipo}`)
    act(() => {
      alvo.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: 30, clientY: y, button: 0, pointerId: 1, isPrimary: true }))
    })
  }

  it('Mercado arrastado sobre Porto Cinza fica recuado, logo abaixo dele, e a aventura pede Salvar', () => {
    expect(linhas().map((li) => [nome(li)?.textContent, li.getAttribute('aria-level')])).toEqual([
      ['Costa Norte', '1'],
      ['Porto Cinza', '2'],
      ['Mercado', '1'],
      ['Vila do Vau', '1'],
    ])
    expect(hasUnsavedWork()).toBe(false)

    ponteiro('pointerdown', nome(linha('Mercado')), 300)
    ponteiro('pointermove', nome(linha('Mercado')), 290)
    ponteiro('pointermove', nome(linha('Porto Cinza')), 200)
    ponteiro('pointerup', nome(linha('Porto Cinza')), 200)

    expect(linhas().map((li) => [nome(li)?.textContent, li.getAttribute('aria-level')])).toEqual([
      ['Costa Norte', '1'],
      ['Porto Cinza', '2'],
      ['Mercado', '3'],
      ['Vila do Vau', '1'],
    ])
    expect(linha('Mercado').style.getPropertyValue('--lb-cena-nivel')).toBe('2')
    expect(linha('Mercado').querySelector('[role="status"]')?.textContent).toBe('Mercado agora está dentro de Porto Cinza.')
    expect(useAdventureStore.getState().adventure?.scenes.find((s) => s.id === 'mercado')?.parentId).toBe('porto')
    expect(hasUnsavedWork()).toBe(true)
    // Só a lista mudou: a cena aberta continua a mesma.
    expect(useAdventureStore.getState().activeSceneId).toBe('costa')
  })

  it('a cena aberta que vai para dentro de uma pasta recolhida (pino de viagem) abre a pasta; ir para fora dela não mexe', () => {
    const seta = () => container.querySelector<HTMLButtonElement>('button[aria-label="Cenas dentro de Costa Norte"]')
    act(() => seta()?.click())
    expect(linhas().map((li) => nome(li)?.textContent)).toEqual(['Costa Norte', 'Mercado', 'Vila do Vau'])

    // Trocar para a Vila, fora da pasta: a Costa Norte continua recolhida.
    act(() => nome(linha('Vila do Vau'))?.click())
    expect(useAdventureStore.getState().activeSceneId).toBe('vila')
    expect(seta()?.getAttribute('aria-expanded')).toBe('false')

    // Chegar a Porto Cinza por fora da lista (como a travessia de um pino): a pasta abre e a linha destacada fica à vista.
    act(() => {
      useAdventureStore.getState().switchScene('porto')
    })
    expect(seta()?.getAttribute('aria-expanded')).toBe('true')
    expect(linhas().map((li) => nome(li)?.textContent)).toEqual(['Costa Norte', 'Porto Cinza', 'Mercado', 'Vila do Vau'])
    expect(nome(linha('Porto Cinza'))?.getAttribute('aria-current')).toBe('true')
  })
})
