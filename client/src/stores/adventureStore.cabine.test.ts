/**
 * CABINE DE TRANSPORTE no editor do mestre: o pino de viagem da cena aberta
 * vira parada de uma cabine (nova ou existente), a cabine é trazida de uma
 * parada para outra, e o host recebe as cabines pelo `hostWorldOf`. Tudo mora
 * na aventura: pede Salvar e não entra no Ctrl+Z da cena.
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

const { useAdventureStore, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

function grade(id: string): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: 'Grade', image: null }
}

/** Térreo (vira fundo) e Topo (aberta), cada um com uma grade de viagem. */
function montar(): { terreo: string; topo: string } {
  useMapStore.getState().loadMap(createEmptyMap('map_terreo', 'Térreo', 30, 20, 64))
  useSessionStore.getState().markSaved()
  const topo = useAdventureStore.getState().createScene('Topo', null)
  const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().updateBackgroundScene(terreo, (map) => ({ ...map, pins: [...map.pins, grade('grade-terreo')] }))
  useMapStore.getState().addPin(grade('grade-topo'))
  return { terreo, topo }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('cabine de transporte no editor', () => {
  it('criar a cabine num pino da cena aberta: ele vira a primeira parada, com a cabine nele, e a aventura pede Salvar', () => {
    const m = montar()
    useAdventureStore.setState({ structureDirty: false })
    const id = useAdventureStore.getState().criarCabine('Espinha', 'grade-topo')
    expect(id).not.toBeNull()
    expect(useAdventureStore.getState().adventure?.cabines).toEqual([
      { id, nome: 'Espinha', paradas: [{ sceneId: m.topo, pinId: 'grade-topo' }], atual: { sceneId: m.topo, pinId: 'grade-topo' } },
    ])
    expect(useAdventureStore.getState().structureDirty).toBe(true)
  })

  it('pôr outro pino na cabine e trazer a cabine para ele', () => {
    const m = montar()
    const id = useAdventureStore.getState().criarCabine('Espinha', 'grade-topo') ?? ''
    useAdventureStore.getState().switchScene(m.terreo)
    expect(useAdventureStore.getState().definirParadaDeCabine('grade-terreo', id)).toBe(true)
    expect(useAdventureStore.getState().moverCabine(id, { sceneId: m.terreo, pinId: 'grade-terreo' })).toBe(true)
    const cabine = useAdventureStore.getState().adventure?.cabines?.[0]
    expect(cabine?.paradas).toEqual([
      { sceneId: m.topo, pinId: 'grade-topo' },
      { sceneId: m.terreo, pinId: 'grade-terreo' },
    ])
    expect(cabine?.atual).toEqual({ sceneId: m.terreo, pinId: 'grade-terreo' })
  })

  it('o host recebe as cabines da aventura pelo mundo', () => {
    montar()
    const id = useAdventureStore.getState().criarCabine('Espinha', 'grade-topo')
    const mundo = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    expect(mundo.cabines?.map((c) => c.id)).toEqual([id])
  })

  it('pino que não é de viagem, nome vazio ou mapa solto não criam cabine', () => {
    montar()
    useMapStore.getState().addPin({ id: 'bau', x: 1, y: 1, kind: 'exclamacao', description: '', image: null })
    expect(useAdventureStore.getState().criarCabine('Espinha', 'bau')).toBeNull()
    expect(useAdventureStore.getState().criarCabine('   ', 'grade-topo')).toBeNull()
    expect(useAdventureStore.getState().adventure?.cabines).toBeUndefined()
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap({ ...createEmptyMap('solto', 'Solto', 10, 10, 64), pins: [grade('g')] })
    expect(useAdventureStore.getState().criarCabine('Espinha', 'g')).toBeNull()
  })

  it('trazer a cabine não mexe no desfazer da cena aberta', () => {
    const m = montar()
    const id = useAdventureStore.getState().criarCabine('Espinha', 'grade-topo') ?? ''
    useAdventureStore.getState().switchScene(m.terreo)
    useAdventureStore.getState().definirParadaDeCabine('grade-terreo', id)
    const passado = useMapStore.getState().past
    useAdventureStore.getState().moverCabine(id, { sceneId: m.terreo, pinId: 'grade-terreo' })
    expect(useMapStore.getState().past).toBe(passado)
  })
})
