/**
 * "Aplicar às fichas desta cena (N)" da janela da cena (`SceneTokenSizeControls`):
 * o botão se desliga quando não sobra ficha a mudar. O foco não pode cair no
 * corpo da página nessa hora — fora da janela, o Esc não a fecha mais e o
 * teclado perde o lugar (achado na prova na tela do FX-FICHA, 12/11/2026).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ''),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { SceneTokenSizeControls } = await import('./SceneTokenSizeControls')

function ficha(id: string, size: number): Token {
  return { id, characterId: null, name: id, x: 125, y: 125, size, image: null }
}

describe('SceneTokenSizeControls: "Aplicar às fichas desta cena (N)"', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useAdventureStore.getState().reset()
    // Mapa solto: a "cena" de id vazio da janela.
    useMapStore.getState().loadMap({ ...createEmptyMap('m1', 'Cripta', 10, 10, 50), tamanhoDaFichaAoEntrar: 2, tokens: [ficha('rato', 1), ficha('zumbi', 3)] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<SceneTokenSizeControls sceneId="" />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('aplica nas duas fichas, o botão vira "(0)" desligado e o foco fica no tamanho escolhido, dentro da janela', () => {
    const aplicar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Aplicar às fichas desta cena'))
    expect(aplicar?.textContent).toBe('Aplicar às fichas desta cena (2)')
    act(() => aplicar?.focus())

    act(() => aplicar?.click())

    expect(useMapStore.getState().map.tokens.map((t) => t.size)).toEqual([2, 2])
    expect(aplicar?.textContent).toBe('Aplicar às fichas desta cena (0)')
    expect(aplicar?.disabled).toBe(true)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('2 casas')
    expect(container.contains(document.activeElement)).toBe(true)
  })
})
