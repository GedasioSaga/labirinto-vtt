/**
 * VISÃO GERAL DAS CENAS (G14): de onde sai o mapa de cada miniatura. A cena
 * aberta vem do mapa VIVO (o que o mestre está editando agora, não a cópia
 * velha do cache); as de fundo, do cache; a que não abriu fica de fora.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Token } from '../types/map'

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

const { useAdventureStore, sceneMaps } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

function token(id: string, x = 64, y = 64): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
  useSessionStore.getState().markSaved()
})

describe('sceneMaps', () => {
  it('mapa solto: uma entrada só, o mapa vivo, com o id vazio da lista de Cenas', () => {
    const vivo = useMapStore.getState().map
    const mapas = sceneMaps(useAdventureStore.getState(), vivo)
    expect([...mapas.keys()]).toEqual([''])
    expect(mapas.get('')).toBe(vivo)
  })

  it('aventura: a cena aberta pelo mapa vivo e a de fundo pelo cache, com as fichas de cada uma', () => {
    useMapStore.getState().addToken(token('grog'))
    const raiz = useAdventureStore.getState().createScene('Cripta', null)
    const { adventure, activeSceneId } = useAdventureStore.getState()
    const idDoVale = adventure?.scenes[0]?.id ?? ''
    // A Cripta nasceu aberta; o mestre põe uma ficha nela agora, sem salvar.
    useMapStore.getState().addToken(token('lanterna', 300, 100))
    const vivo = useMapStore.getState().map

    const mapas = sceneMaps(useAdventureStore.getState(), vivo)
    expect(activeSceneId).toBe(raiz)
    expect([...mapas.keys()]).toEqual([idDoVale, raiz])
    expect(mapas.get(raiz)).toBe(vivo)
    expect(mapas.get(raiz)?.tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(mapas.get(idDoVale)?.tokens.map((t) => t.id)).toEqual(['grog'])
  })

  it('cena que não abriu (arquivo sumido) fica de fora: não há mapa para desenhar', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const idDoVale = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
    useAdventureStore.setState({ cache: { [idDoVale]: { status: 'indisponivel', reason: 'arquivo não existe' } } })
    const mapas = sceneMaps(useAdventureStore.getState(), useMapStore.getState().map)
    expect([...mapas.keys()]).toEqual([cripta])
  })

  it('ficha que atravessou para outra cena aparece no mapa da cena de destino', () => {
    useMapStore.getState().addToken(token('grog'))
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
    expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 200, 200)).toBe(true)
    const mapas = sceneMaps(useAdventureStore.getState(), useMapStore.getState().map)
    expect(mapas.get(vale)?.tokens).toEqual([])
    expect(mapas.get(cripta)?.tokens.map((t) => [t.id, t.x, t.y])).toEqual([['grog', 200, 200]])
  })
})
