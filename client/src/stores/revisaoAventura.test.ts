/**
 * O conserto do revisor aplicado na aventura: na cena aberta vira um passo de
 * desfazer; numa cena de fundo muda o cache e marca a cena para salvar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin } from '../types/map'

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
const { consertarNaAventura } = await import('./revisaoAventura')

function pinoMestre(id: string): Pin {
  return { id, x: 80, y: 80, kind: 'exclamacao', description: 'MESTRE: segredo', image: null }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
  const mapa: MapData = createEmptyMap('map_raiz', 'Vale', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
})

describe('consertarNaAventura', () => {
  it('mapa solto (id vazio): conserta a cena aberta num passo de desfazer, e Ctrl+Z volta', () => {
    useMapStore.getState().addPin(pinoMestre('p1'))
    const passos = useMapStore.getState().past.length
    expect(consertarNaAventura('', { tipo: 'ocultar-pino', pinId: 'p1' })).toBe(true)
    expect(useMapStore.getState().map.pins[0].secret).toBe(true)
    expect(useMapStore.getState().past.length).toBe(passos + 1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.pins[0].secret).toBeUndefined()
  })

  it('conserto que não muda nada devolve false e não gasta passo de desfazer', () => {
    const passos = useMapStore.getState().past.length
    expect(consertarNaAventura('', { tipo: 'ocultar-pino', pinId: 'nao-existe' })).toBe(false)
    expect(useMapStore.getState().past.length).toBe(passos)
  })

  it('cena de fundo: muda o mapa do cache e marca a cena para salvar, sem tocar na cena aberta', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().switchScene(cripta)
    useMapStore.getState().addPin(pinoMestre('pc'))
    useAdventureStore.getState().switchScene(vale)
    const abertoAntes = useMapStore.getState().map

    expect(consertarNaAventura(cripta, { tipo: 'ocultar-pino', pinId: 'pc' })).toBe(true)
    const slot = useAdventureStore.getState().cache[cripta]
    if (slot === undefined || slot.status !== 'ok') throw new Error('a Cripta não está no cache')
    expect(slot.map.pins.find((p) => p.id === 'pc')?.secret).toBe(true)
    expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
    expect(useMapStore.getState().map).toBe(abertoAntes)
  })
})
