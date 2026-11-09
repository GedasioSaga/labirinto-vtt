/**
 * PRELÚDIO F4 (revisão): o link de ficha do Roteiro, no Livro do mestre, com
 * pisos na mesma cena. Dados inventados (o repositório é público).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Token } from '../../types/map'

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
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore } = await import('../../stores/adventureStore')
const { useMapStore } = await import('../../stores/mapStore')
const { useLivroDoMestreStore } = await import('../../stores/livroDoMestreStore')
const { createEmptyMap } = await import('../../lib/mapFactory')
const { abrirFichaNaCena } = await import('./irParaAMesa')

/** O boneco da ficha do Vigia, no 1º piso do Cais; o editor está no térreo. */
const VIGIA: Token = { id: 'tk-vigia', characterId: 'pj-vigia', name: 'Vigia', x: 500, y: 400, size: 1, image: null, piso: 1 }

beforeEach(() => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap({ ...createEmptyMap('map_cais', 'Cais', 30, 20, 64), tokens: [VIGIA] })
  useLivroDoMestreStore.getState().abrirPagina('roteiro')
})

describe('O link de ficha no Livro do mestre', () => {
  it('leva o editor ao piso do boneco, com ele selecionado depois da troca de piso, e abre a Ficha', () => {
    expect(useMapStore.getState().pisoAtivo).toBe(0)
    expect(abrirFichaNaCena({ tipo: 'ficha', pastaId: 'pasta-ilha', personagemId: 'pj-vigia' }, 'Vigia')).toBeNull()
    expect(useMapStore.getState().pisoAtivo).toBe(1)
    expect(JSON.stringify(useMapStore.getState().selection)).toContain('tk-vigia')
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null, focus: { x: 500, y: 400 } })
    expect(useLivroDoMestreStore.getState().pagina).toBe('ficha')
  })
})
