/**
 * `stores/adventureStore.ts` — várias cenas no editor do mestre.
 *
 * O que se cobra aqui e a jornada não mede: cada cena tem o PRÓPRIO desfazer,
 * mudança numa cena de fundo não entra no desfazer da cena aberta, cena
 * indisponível não abre, e gravar escreve a pasta da aventura inteira.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Token } from '../types/map'

const arquivos = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async (path: string) => arquivos.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
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

const { useAdventureStore, sceneList, hasUnsavedWork } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')
const { deserializeMap } = await import('../lib/mapFile')

subscribeToDirtyFlag()

function token(id: string): Token {
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null }
}

function abrirMapaSolto(map: MapData): void {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(map)
  useSessionStore.getState().markSaved()
}

beforeEach(() => {
  arquivos.clear()
  abrirMapaSolto(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
})

describe('mapa solto', () => {
  it('a lista mostra só ele, sem aventura e sem nada pendente', () => {
    const state = useAdventureStore.getState()
    expect(state.adventure).toBeNull()
    expect(sceneList(state, useMapStore.getState().map)).toEqual([
      { id: '', name: 'Vale', tokenCount: 0, available: true, active: true, renamable: false },
    ])
    expect(hasUnsavedWork()).toBe(false)
  })
})

describe('createScene + switchScene', () => {
  it('a aventura nasce com duas cenas e a nova abre vazia', () => {
    useMapStore.getState().addToken(token('grog'))
    const id = useAdventureStore.getState().createScene('  Cripta  ', null)

    const state = useAdventureStore.getState()
    expect(state.adventure?.scenes.map((c) => c.name)).toEqual(['Vale', 'Cripta'])
    expect(state.activeSceneId).toBe(id)
    expect(useMapStore.getState().map.name).toBe('Cripta')
    expect(useMapStore.getState().map.tokens).toEqual([])
    expect(useMapStore.getState().past).toEqual([])
    expect(sceneList(state, useMapStore.getState().map).map((c) => [c.name, c.tokenCount, c.active])).toEqual([
      ['Vale', 1, false],
      ['Cripta', 0, true],
    ])
    expect(hasUnsavedWork()).toBe(true)
  })

  it('cada cena guarda o próprio desfazer: trocar e voltar devolve o histórico de cada uma', () => {
    useMapStore.getState().addToken(token('grog'))
    const raiz = useAdventureStore.getState().adventure
    expect(raiz).toBeNull()
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useMapStore.getState().addToken(token('esqueleto'))
    useMapStore.getState().addToken(token('zumbi'))

    expect(useAdventureStore.getState().switchScene(vale)).toBe(true)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['grog'])
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useAdventureStore.getState().previousSceneId).toBe(cripta)

    // Desfazer no Vale desfaz o Grog, e não um token da Cripta.
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens).toEqual([])

    expect(useAdventureStore.getState().switchScene(cripta)).toBe(true)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['esqueleto', 'zumbi'])
    expect(useMapStore.getState().past).toHaveLength(2)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['esqueleto'])
  })

  it('trocar para a própria cena não faz nada', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    expect(useAdventureStore.getState().switchScene(cripta)).toBe(false)
  })
})

describe('câmera por cena', () => {
  it('a cena que sai guarda a câmera; voltar a ela pede essa câmera; cena nunca vista pede enquadrar', () => {
    useMapStore.getState().setCamera({ x: -300, y: -120, scale: 3.75 })
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''

    // Cripta é nova: nenhuma câmera guardada, o canvas enquadra.
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null })
    const slotVale = useAdventureStore.getState().cache[vale]
    expect(slotVale.status === 'ok' ? slotVale.camera : 'indisponível').toEqual({ x: -300, y: -120, scale: 3.75 })

    useMapStore.getState().setCamera({ x: 10, y: 20, scale: 0.5 })
    useAdventureStore.getState().switchScene(vale)
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: { x: -300, y: -120, scale: 3.75 } })

    useAdventureStore.getState().switchScene(cripta)
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: { x: 10, y: 20, scale: 0.5 } })
  })

  it('cena aberta do disco (depois de reiniciar) não herda câmera: pede enquadrar', () => {
    const vale = createEmptyMap('map_vale', 'Vale', 30, 20, 64)
    const cripta = createEmptyMap('map_cripta', 'Cripta', 30, 20, 64)
    useAdventureStore.getState().open({
      path: 'C:/appdata/maps/map_vale/map.json',
      map: vale,
      adventure: {
        version: 1,
        id: 'adv',
        name: 'Vale',
        startSceneId: 's_vale',
        scenes: [
          { id: 's_vale', name: 'Vale', file: 'map.json' },
          { id: 's_cripta', name: 'Cripta', file: 'scenes/s_cripta/map.json' },
        ],
      },
      adventureDir: 'C:/appdata/maps/map_vale',
      activeSceneId: 's_vale',
      scenes: [
        { entry: { id: 's_vale', name: 'Vale', file: 'map.json' }, status: 'ok', map: vale },
        { entry: { id: 's_cripta', name: 'Cripta', file: 'scenes/s_cripta/map.json' }, status: 'ok', map: cripta },
      ],
      changedSceneIds: [],
      adventureChanged: false,
    })
    expect(useAdventureStore.getState().cameraRequest).toBeNull()
    useMapStore.getState().setCamera({ x: -900, y: -400, scale: 3.75 })

    useAdventureStore.getState().switchScene('s_cripta')

    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null })
  })
})

describe('updateBackgroundScene', () => {
  it('muda a cena de fundo sem tocar no desfazer nem no mapa da cena aberta', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useMapStore.getState().addToken(token('esqueleto'))
    const mapaAberto = useMapStore.getState().map
    const pastAntes = useMapStore.getState().past

    useAdventureStore.getState().updateBackgroundScene(vale, (map) => ({ ...map, tokens: [...map.tokens, token('viajante')] }))

    expect(useMapStore.getState().map).toBe(mapaAberto)
    expect(useMapStore.getState().past).toBe(pastAntes)
    expect(useAdventureStore.getState().dirty[vale]).toBe(true)
    // A cena de fundo tem o token, e o desfazer dela não o conhece.
    expect(useAdventureStore.getState().switchScene(vale)).toBe(true)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['viajante'])
    expect(useMapStore.getState().past).toEqual([])
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
    expect(useAdventureStore.getState().previousSceneId).toBe(cripta)
  })
})

describe('cena indisponível', () => {
  it('aparece na lista como indisponível e não abre', () => {
    const vale = createEmptyMap('map_vale', 'Vale', 30, 20, 64)
    useAdventureStore.getState().open({
      path: 'C:/appdata/maps/map_vale/map.json',
      map: vale,
      adventure: {
        version: 1,
        id: 'adv',
        name: 'Vale',
        startSceneId: 's_vale',
        scenes: [
          { id: 's_vale', name: 'Vale', file: 'map.json' },
          { id: 's_sumiu', name: 'Cripta', file: 'scenes/s_sumiu/map.json' },
        ],
      },
      adventureDir: 'C:/appdata/maps/map_vale',
      activeSceneId: 's_vale',
      scenes: [
        { entry: { id: 's_vale', name: 'Vale', file: 'map.json' }, status: 'ok', map: vale },
        { entry: { id: 's_sumiu', name: 'Cripta', file: 'scenes/s_sumiu/map.json' }, status: 'indisponivel', reason: 'arquivo não encontrado' },
      ],
      changedSceneIds: [],
      adventureChanged: false,
    })

    const lista = sceneList(useAdventureStore.getState(), useMapStore.getState().map)
    expect(lista.map((c) => [c.name, c.available, c.tokenCount])).toEqual([
      ['Vale', true, 0],
      ['Cripta', false, null],
    ])
    expect(useAdventureStore.getState().switchScene('s_sumiu')).toBe(false)
    expect(useMapStore.getState().map.id).toBe('map_vale')
    expect(hasUnsavedWork()).toBe(false)
  })
})

describe('flush', () => {
  it('mapa nunca salvo: grava a pasta da aventura em maps/<id>, as duas cenas e o adventure.json', async () => {
    useMapStore.getState().addToken(token('grog'))
    useAdventureStore.getState().createScene('Cripta', null)
    useMapStore.getState().addToken(token('esqueleto'))

    const caminho = await useAdventureStore.getState().flush()

    const aventura = parseAdventure(arquivos.get('C:/appdata/maps/map_raiz/adventure.json') ?? '')
    const cripta = aventura.scenes[1]
    expect(caminho).toBe(`C:/appdata/maps/map_raiz/scenes/${cripta.id}/map.json`)
    expect(aventura.scenes.map((c) => [c.name, c.file])).toEqual([
      ['Vale', 'map.json'],
      ['Cripta', `scenes/${cripta.id}/map.json`],
    ])
    expect(deserializeMap(arquivos.get('C:/appdata/maps/map_raiz/map.json') ?? '').tokens.map((t) => t.id)).toEqual(['grog'])
    expect(deserializeMap(arquivos.get(caminho) ?? '').tokens.map((t) => t.id)).toEqual(['esqueleto'])
    expect(hasUnsavedWork()).toBe(false)
  })

  it('mapa solto já salvo: a pasta é a do arquivo dele e a primeira cena é o próprio arquivo', async () => {
    useAdventureStore.getState().createScene('Cripta', 'C:/mesa/torre/torre.json')

    await useAdventureStore.getState().flush()

    const aventura = parseAdventure(arquivos.get('C:/mesa/torre/adventure.json') ?? '')
    expect(aventura.scenes[0].file).toBe('torre.json')
    expect(arquivos.has(`C:/mesa/torre/${aventura.scenes[1].file}`)).toBe(true)
  })

  it('renomear a cena grava o nome novo e vazio vira "Cena sem nome"', async () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    useAdventureStore.getState().renameScene(cripta, '   ')
    await useAdventureStore.getState().flush()
    const aventura = parseAdventure(arquivos.get('C:/appdata/maps/map_raiz/adventure.json') ?? '')
    expect(aventura.scenes[1].name).toBe('Cena sem nome')
  })
})
