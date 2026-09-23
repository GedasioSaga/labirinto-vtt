/**
 * ABRIR AVENTURA RÁPIDO, do lado do editor (`stores/adventureStore.ts`): a
 * cena pedida entra no editor na hora; as outras aparecem na lista como
 * "carregando" e passam a abrir quando chegam do disco. O que o mestre fizer
 * nelas nesse meio-tempo (a volta de um pino de viagem) não se perde.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin } from '../types/map'

const arquivos = new Map<string, string>()

/** Portão das leituras em `scenes/`: fechado, a cena de fundo não chega até `soltarCenas()`. */
let portao: Promise<void> = Promise.resolve()
let abrirPortao: () => void = () => undefined
function segurarCenas(): void {
  portao = new Promise<void>((resolve) => {
    abrirPortao = resolve
  })
}

/** Portão só da Torre: fechado, ela não chega até `abrirPortaoTorre()`; as outras cenas passam. */
let portaoTorre: Promise<void> = Promise.resolve()
let abrirPortaoTorre: () => void = () => undefined
function segurarTorre(): void {
  portaoTorre = new Promise<void>((resolve) => {
    abrirPortaoTorre = resolve
  })
}

/** Portão das escritas: fechado, a gravação fica parada no meio até `soltarEscrita()`. */
let portaoEscrita: Promise<void> = Promise.resolve()
let abrirPortaoEscrita: () => void = () => undefined
function segurarEscrita(): void {
  portaoEscrita = new Promise<void>((resolve) => {
    abrirPortaoEscrita = resolve
  })
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    await portaoEscrita
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
    if (path.includes('/scenes/')) await portao
    if (path.includes('/scenes/s_torre/')) await portaoTorre
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

const { useAdventureStore, sceneList, hasUnsavedWork, subscribeToTravelLinks, subscribeToServedScenes, hostWorldOf, pinTravelOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { subscribeToDirtyFlag } = await import('./sessionStore')
const { openMapFileFirst } = await import('../lib/mapFileIO')
const { createEmptyMap, buildPin } = await import('../lib/mapFactory')
const { serializeMap } = await import('../lib/mapFile')
const { serializeAdventure } = await import('../lib/adventure')

subscribeToDirtyFlag()
subscribeToTravelLinks()

const PASTA = 'C:/appdata/maps/map_vale'

function mapa(id: string, name: string, overrides: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, name, 30, 20, 64), ...overrides }
}

function pinoDeViagem(id: string, destino: Pin['destino']): Pin {
  return { ...buildPin(id, { x: 64, y: 64 }, 'viagem'), destino }
}

/** Vale (aberto), Cripta e Torre no disco. O pino `ida` do Vale leva ao `volta` da Cripta e vice-versa. */
function gravarAventura(): void {
  const cenas = [
    { id: 's_vale', name: 'Vale', file: 'map.json' },
    { id: 's_cripta', name: 'Cripta', file: 'scenes/s_cripta/map.json' },
    { id: 's_torre', name: 'Torre', file: 'scenes/s_torre/map.json' },
  ]
  arquivos.set(`${PASTA}/map.json`, serializeMap(mapa('map_vale', 'Vale', { pins: [pinoDeViagem('ida', { sceneId: 's_cripta', pinId: 'volta' })] })))
  arquivos.set(
    `${PASTA}/scenes/s_cripta/map.json`,
    serializeMap(
      mapa('map_cripta', 'Cripta', {
        pins: [pinoDeViagem('volta', { sceneId: 's_vale', pinId: 'ida' })],
        tokens: [{ id: 'rato', characterId: null, name: 'Rato', x: 64, y: 64, size: 1, image: null }],
      }),
    ),
  )
  arquivos.set(`${PASTA}/scenes/s_torre/map.json`, serializeMap(mapa('map_torre', 'Torre')))
  arquivos.set(`${PASTA}/adventure.json`, serializeAdventure({ version: 1, id: 'adv', name: 'Vale', startSceneId: 's_vale', scenes: cenas }))
}

function lista(): ReturnType<typeof sceneList> {
  const state = useAdventureStore.getState()
  return sceneList(state, useMapStore.getState().map)
}

beforeEach(() => {
  arquivos.clear()
  portao = Promise.resolve()
  portaoTorre = Promise.resolve()
  portaoEscrita = Promise.resolve()
  useAdventureStore.getState().reset()
})

describe('abrir aventura: a cena pedida primeiro, as outras chegando', () => {
  it('a cena aberta entra no editor na hora; as outras ficam "carregando" até chegarem', async () => {
    gravarAventura()
    segurarCenas()
    const aberto = await openMapFileFirst(`${PASTA}/map.json`)

    const pronto = useAdventureStore.getState().open(aberto)

    expect(useMapStore.getState().map.name).toBe('Vale')
    expect(lista().map((c) => [c.name, c.available, c.loading === true])).toEqual([
      ['Vale', true, false],
      ['Cripta', false, true],
      ['Torre', false, true],
    ])
    // Ainda não chegou: não dá para entrar nela.
    expect(useAdventureStore.getState().switchScene('s_cripta')).toBe(false)

    abrirPortao()
    await pronto

    expect(lista().map((c) => [c.name, c.available, c.loading === true, c.tokenCount])).toEqual([
      ['Vale', true, false, 0],
      ['Cripta', true, false, 1],
      ['Torre', true, false, 0],
    ])
    // Chegar do disco não é mudança: nada a gravar.
    expect(hasUnsavedWork()).toBe(false)
    expect(useAdventureStore.getState().switchScene('s_cripta')).toBe(true)
    expect(useMapStore.getState().map.name).toBe('Cripta')
  })

  it('a cena que chega primeiro já abre, sem esperar a mais lenta', async () => {
    gravarAventura()
    segurarTorre()
    const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))

    // A Cripta chega enquanto a Torre ainda está no disco: já dá para entrar nela.
    await vi.waitFor(() => expect(lista().find((c) => c.name === 'Cripta')?.available).toBe(true))
    expect(lista().map((c) => [c.name, c.available, c.loading === true])).toEqual([
      ['Vale', true, false],
      ['Cripta', true, false],
      ['Torre', false, true],
    ])
    expect(hasUnsavedWork()).toBe(false)
    expect(useAdventureStore.getState().switchScene('s_cripta')).toBe(true)
    expect(useMapStore.getState().map.name).toBe('Cripta')

    abrirPortaoTorre()
    await pronto

    // A Torre chega depois sem mexer na Cripta, que agora é a cena aberta.
    expect(useMapStore.getState().map.name).toBe('Cripta')
    expect(lista().map((c) => [c.name, c.available, c.loading === true])).toEqual([
      ['Vale', true, false],
      ['Cripta', true, false],
      ['Torre', true, false],
    ])
    expect(hasUnsavedWork()).toBe(false)
  })

  it('mudança esperando uma cena que chega antes das outras é aplicada na chegada dela', async () => {
    gravarAventura()
    segurarTorre()
    const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))
    useAdventureStore.getState().unlinkPin('ida')

    await vi.waitFor(() => expect(useAdventureStore.getState().cache.s_cripta?.status).toBe('ok'))
    const cripta = useAdventureStore.getState().cache.s_cripta
    expect(cripta?.status === 'ok' ? cripta.map.pins[0].destino : 'sem mapa').toBeNull()
    expect(useAdventureStore.getState().dirty.s_cripta).toBe(true)

    abrirPortaoTorre()
    await pronto
    expect(useAdventureStore.getState().dirty.s_cripta).toBe(true)
    expect(useAdventureStore.getState().dirty.s_torre).toBeUndefined()
  })

  it('desligar um pino cujo par ainda está carregando: a volta é desligada quando o par chega', async () => {
    gravarAventura()
    segurarCenas()
    const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))

    useAdventureStore.getState().unlinkPin('ida')
    // A mudança espera a cena chegar, e conta como trabalho não salvo.
    expect(hasUnsavedWork()).toBe(true)

    abrirPortao()
    await pronto

    const cripta = useAdventureStore.getState().cache.s_cripta
    expect(cripta?.status === 'ok' ? cripta.map.pins[0].destino : 'sem mapa').toBeNull()
    expect(useAdventureStore.getState().dirty.s_cripta).toBe(true)
  })

  it('abrir outro mapa antes das cenas chegarem: as cenas da aventura antiga não entram na nova', async () => {
    gravarAventura()
    segurarCenas()
    const antigo = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))

    arquivos.set('C:/appdata/maps/map_solto/map.json', serializeMap(mapa('map_solto', 'Casebre')))
    await useAdventureStore.getState().open(await openMapFileFirst('C:/appdata/maps/map_solto/map.json'))
    abrirPortao()
    await antigo

    expect(useAdventureStore.getState().adventure).toBeNull()
    expect(useAdventureStore.getState().cache).toEqual({})
    expect(useMapStore.getState().map.name).toBe('Casebre')
  })

  it('gravar enquanto o par do pino ainda chega: a volta desligada continua pendente depois da gravação', async () => {
    gravarAventura()
    segurarCenas()
    const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))
    useAdventureStore.getState().unlinkPin('ida')

    // A gravação para no meio; a Cripta chega (com a volta desligada) nesse intervalo.
    segurarEscrita()
    const gravando = useAdventureStore.getState().flush()
    abrirPortao()
    await pronto
    expect(useAdventureStore.getState().dirty.s_cripta).toBe(true)
    abrirPortaoEscrita()
    await gravando

    // A Cripta não foi para o disco nesta gravação: continua a gravar.
    expect(arquivos.get(`${PASTA}/scenes/s_cripta/map.json`)).toContain('"s_vale"')
    expect(useAdventureStore.getState().dirty.s_cripta).toBe(true)
    expect(hasUnsavedWork()).toBe(true)

    // A próxima gravação leva a volta desligada ao disco.
    await useAdventureStore.getState().flush()
    expect(arquivos.get(`${PASTA}/scenes/s_cripta/map.json`)).not.toContain('"s_vale"')
    expect(hasUnsavedWork()).toBe(false)
  })

  it('gravar enquanto chega uma cena com portal antigo: a cena nova e a lista continuam a gravar', async () => {
    gravarAventura()
    const destino = 'C:/appdata/maps/map_poco/map.json'
    arquivos.set(destino, serializeMap(mapa('map_poco', 'Poço')))
    arquivos.set(
      `${PASTA}/scenes/s_torre/map.json`,
      serializeMap(mapa('map_torre', 'Torre', { props: [{ id: 'alcapao', src: 'C:/imgs/escada.png', x: 64, y: 64, width: 64, height: 64, linkedMapPath: destino }] })),
    )
    segurarCenas()
    const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))

    segurarEscrita()
    const gravando = useAdventureStore.getState().flush()
    abrirPortao()
    await pronto
    abrirPortaoEscrita()
    await gravando

    const state = useAdventureStore.getState()
    const poco = state.adventure?.scenes.find((c) => c.name === 'Poço')
    expect(poco).toBeDefined()
    expect(state.dirty.s_torre).toBe(true)
    expect(state.dirty[poco?.id ?? '']).toBe(true)
    expect(state.structureDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('cena que não abriu continua indisponível (e não "carregando") depois que as outras chegam', async () => {
    gravarAventura()
    arquivos.delete(`${PASTA}/scenes/s_torre/map.json`)

    await useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))

    const torre = lista().find((c) => c.name === 'Torre')
    expect(torre?.available).toBe(false)
    expect(torre?.loading === true).toBe(false)
  })
})

describe('abrir aventura com a sala aberta: quem está numa cena de fundo não fica esperando', () => {
  it('a chegada das cenas de fundo avisa quem serve os jogadores, já com elas no mundo', async () => {
    gravarAventura()
    segurarCenas()
    /** As cenas de fundo que o host serviria no momento de cada aviso. */
    const servidas: string[][] = []
    const parar = subscribeToServedScenes(() => {
      const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
      servidas.push(world.background.map((scene) => scene.name))
    })
    try {
      const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))
      const antesDeChegar = servidas.length

      abrirPortao()
      await pronto

      // Depois do open (com as cenas ainda "carregando"), chegou pelo menos um
      // aviso novo, e nele a Cripta e a Torre já estão no mundo servido.
      expect(servidas.length).toBeGreaterThan(antesDeChegar)
      expect(servidas.at(-1)).toEqual(['Cripta', 'Torre'])
    } finally {
      parar()
    }
  })

  it('mexer só no mapa aberto não é aviso de cenas servidas (esse vai pelo mapa vivo)', async () => {
    gravarAventura()
    await useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))
    let avisos = 0
    const parar = subscribeToServedScenes(() => {
      avisos += 1
    })
    try {
      useMapStore.getState().setTokenPosition('inexistente', 1, 1)
      useAdventureStore.getState().updateBackgroundScene('s_cripta', (m) => ({ ...m, name: 'Cripta velha' }))
      expect(avisos).toBe(0)
    } finally {
      parar()
    }
  })
})

describe('pino de viagem cujo destino ainda está carregando', () => {
  it('diz que a cena está carregando, e não que ela não abriu', async () => {
    gravarAventura()
    segurarCenas()
    const pronto = useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))
    const live = useMapStore.getState().map
    const ida = live.pins.find((p) => p.id === 'ida')
    if (ida === undefined) throw new Error('o Vale gravado tem o pino ida')

    expect(pinTravelOf(useAdventureStore.getState(), live, ida)).toEqual({ status: 'indisponivel', sceneId: 's_cripta', sceneName: 'Cripta', loading: true })

    abrirPortao()
    await pronto
    expect(pinTravelOf(useAdventureStore.getState(), useMapStore.getState().map, ida).status).toBe('ligado')
  })

  it('cena que não abriu continua "indisponível" sem "carregando"', async () => {
    gravarAventura()
    arquivos.delete(`${PASTA}/scenes/s_cripta/map.json`)
    await useAdventureStore.getState().open(await openMapFileFirst(`${PASTA}/map.json`))
    const live = useMapStore.getState().map
    const ida = live.pins.find((p) => p.id === 'ida')
    if (ida === undefined) throw new Error('o Vale gravado tem o pino ida')

    expect(pinTravelOf(useAdventureStore.getState(), live, ida)).toStrictEqual({ status: 'indisponivel', sceneId: 's_cripta', sceneName: 'Cripta' })
  })
})
