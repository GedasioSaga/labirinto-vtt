/**
 * CABINE DE TRANSPORTE no editor do mestre — a FILA: a chamada que o host
 * aceitou entra na fila da aventura (pede Salvar), "Atender a próxima
 * chamada" leva a cabine à primeira parada da fila e a tira dela, e "Limpar
 * a fila" esvazia. Nada disso entra no Ctrl+Z da cena.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'

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

const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

function grade(id: string): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: 'Grade', image: null }
}

/** Espinha com parada no Topo (aberta, com a cabine) e no Térreo (fundo). */
function montar(): { terreo: string; topo: string; id: string } {
  useMapStore.getState().loadMap(createEmptyMap('map_terreo', 'Térreo', 30, 20, 64))
  useSessionStore.getState().markSaved()
  const topo = useAdventureStore.getState().createScene('Topo', null)
  const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().updateBackgroundScene(terreo, (map) => ({ ...map, pins: [...map.pins, grade('grade-terreo')] }))
  useMapStore.getState().addPin(grade('grade-topo'))
  const id = useAdventureStore.getState().criarCabine('Espinha', 'grade-topo') ?? ''
  useAdventureStore.getState().switchScene(terreo)
  useAdventureStore.getState().definirParadaDeCabine('grade-terreo', id)
  useAdventureStore.getState().switchScene(topo)
  return { terreo, topo, id }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('fila da cabine no editor', () => {
  it('a chamada entra na fila e pede Salvar; a mesma parada não entra de novo', () => {
    const m = montar()
    useAdventureStore.setState({ structureDirty: false })
    const chamada = { parada: { sceneId: m.terreo, pinId: 'grade-terreo' }, tokenId: 'bia-ficha', nome: 'Bia' }
    expect(useAdventureStore.getState().chamarCabine({ cabineId: m.id, chamada })).toBe(true)
    expect(useAdventureStore.getState().adventure?.cabines?.[0].fila).toEqual([chamada])
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(useAdventureStore.getState().chamarCabine({ cabineId: m.id, chamada: { ...chamada, tokenId: 'outra', nome: 'Outra' } })).toBe(false)
  })

  it('"Atender a próxima chamada" leva a cabine à parada que chamou e a tira da fila, sem mexer no desfazer', () => {
    const m = montar()
    const parada = { sceneId: m.terreo, pinId: 'grade-terreo' }
    useAdventureStore.getState().chamarCabine({ cabineId: m.id, chamada: { parada, tokenId: 'bia-ficha', nome: 'Bia' } })
    const passado = useMapStore.getState().past
    expect(useAdventureStore.getState().atenderChamada(m.id)).toBe(true)
    const cabine = useAdventureStore.getState().adventure?.cabines?.[0]
    expect(cabine?.atual).toEqual(parada)
    expect(cabine?.fila).toBeUndefined()
    expect(useMapStore.getState().past).toBe(passado)
    // Fila vazia: nada a atender.
    expect(useAdventureStore.getState().atenderChamada(m.id)).toBe(false)
  })

  it('"Limpar a fila" esvazia; sem fila, nada muda', () => {
    const m = montar()
    useAdventureStore.getState().chamarCabine({ cabineId: m.id, chamada: { parada: { sceneId: m.terreo, pinId: 'grade-terreo' }, tokenId: 'bia-ficha', nome: 'Bia' } })
    expect(useAdventureStore.getState().limparFilaDaCabine(m.id)).toBe(true)
    expect(useAdventureStore.getState().adventure?.cabines?.[0].fila).toBeUndefined()
    expect(useAdventureStore.getState().limparFilaDaCabine(m.id)).toBe(false)
  })
})
