/**
 * SISTEMA DE RPG e PERSONAGENS no editor do mestre (`stores/adventureStore.ts`):
 * escolher o sistema, criar, trocar, importar e apagar personagem pedem Salvar
 * como a agenda, chegam ao `adventure.json` — e o jogador não recebe nada: o
 * mundo que o host serve não carrega a aventura.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'

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

const { useAdventureStore, hasUnsavedWork, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')
const { novoPersonagem } = await import('../lib/personagem')
const { garantirAventura, PERGUNTA_VIRAR_AVENTURA } = await import('./virarAventura')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')

subscribeToDirtyFlag()

const PASTA = 'C:/appdata/maps/map_navio'

function mapa(id: string, name: string): MapData {
  return createEmptyMap(`map_${id}`, name, 20, 16, 64)
}

function abrirNavio(): void {
  const cenas = [
    { id: 'convés', name: 'Convés', file: 'map.json' },
    { id: 'porao', name: 'Porão', file: 'scenes/porao/map.json' },
  ]
  const conves = mapa('conves', 'Convés')
  useAdventureStore.getState().open({
    path: `${PASTA}/map.json`,
    map: conves,
    adventure: { version: 1, id: 'adv_navio', name: 'Navio', startSceneId: 'convés', scenes: cenas },
    adventureDir: PASTA,
    activeSceneId: 'convés',
    scenes: cenas.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'convés' ? conves : mapa(entry.id, entry.name) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

const vagn = () => ({ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn Kane'), descricao: 'Ferreiro lunariano' })

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
  useSessionStore.getState().markSaved()
  abrirNavio()
})

describe('sistema de RPG da aventura', () => {
  it('escolher pede Salvar, sem entrar no desfazer da cena aberta; null tira', () => {
    expect(hasUnsavedWork()).toBe(false)
    expect(useAdventureStore.getState().setSistemaDeRpg('one-piece')).toBe(true)
    expect(useAdventureStore.getState().adventure?.sistemaDeRpg).toBe('one-piece')
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
    expect(useMapStore.getState().past).toEqual([])

    useAdventureStore.getState().setSistemaDeRpg(null)
    const semSistema = useAdventureStore.getState().adventure
    expect(semSistema).not.toBeNull()
    expect(Object.keys(semSistema ?? {})).not.toContain('sistemaDeRpg')
  })

  it('mapa solto não tem sistema nem personagens', () => {
    useAdventureStore.getState().reset()
    expect(useAdventureStore.getState().setSistemaDeRpg('one-piece')).toBe(false)
    expect(useAdventureStore.getState().salvarPersonagem(vagn())).toBe(false)
    expect(useAdventureStore.getState().adicionarPersonagens([vagn()])).toBe(false)
    expect(useAdventureStore.getState().apagarPersonagem('qualquer')).toBe(false)
  })
})

describe('personagens da aventura', () => {
  it('salvar cria no fim e, com o mesmo id, troca no lugar', () => {
    const primeiro = vagn()
    const segundo = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Smoker') }
    useAdventureStore.getState().salvarPersonagem(primeiro)
    useAdventureStore.getState().salvarPersonagem(segundo)
    useAdventureStore.getState().salvarPersonagem({ ...primeiro, nome: 'Vagn' })
    expect(useAdventureStore.getState().adventure?.personagens?.map((personagem) => personagem.nome)).toEqual(['Vagn', 'Smoker'])
    expect(useMapStore.getState().past).toEqual([])
  })

  it('importar acrescenta na ordem; lista vazia não pede Salvar', () => {
    useAdventureStore.getState().adicionarPersonagens([])
    expect(useAdventureStore.getState().structureDirty).toBe(false)
    useAdventureStore.getState().adicionarPersonagens([vagn(), novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira')])
    expect(useAdventureStore.getState().adventure?.personagens?.map((personagem) => personagem.nome)).toEqual(['Vagn Kane', 'Aira'])
    expect(useAdventureStore.getState().structureDirty).toBe(true)
  })

  it('apagar tira só ele; id que não existe não muda nada', () => {
    const primeiro = vagn()
    useAdventureStore.getState().adicionarPersonagens([primeiro, novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira')])
    expect(useAdventureStore.getState().apagarPersonagem('nao-existe')).toBe(false)
    expect(useAdventureStore.getState().apagarPersonagem(primeiro.id)).toBe(true)
    expect(useAdventureStore.getState().adventure?.personagens?.map((personagem) => personagem.nome)).toEqual(['Aira'])
  })

  it('Salvar grava sistema e personagens no adventure.json', async () => {
    const personagem = vagn()
    useAdventureStore.getState().setSistemaDeRpg('one-piece')
    useAdventureStore.getState().salvarPersonagem(personagem)

    await useAdventureStore.getState().flush()

    const gravada = parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '')
    expect(gravada.sistemaDeRpg).toBe('one-piece')
    expect(gravada.personagens).toEqual([personagem])
    expect(useAdventureStore.getState().structureDirty).toBe(false)
  })

  it('o mundo que o host serve ao jogador não leva nada dos personagens', () => {
    useAdventureStore.getState().setSistemaDeRpg('one-piece')
    useAdventureStore.getState().salvarPersonagem(vagn())
    const mundo = JSON.stringify(hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map))
    expect(mundo).toContain('Porão')
    expect(mundo).not.toContain('Vagn')
    expect(mundo).not.toContain('Ferreiro lunariano')
    expect(mundo).not.toContain('personagens')
    expect(mundo).not.toContain('one-piece')
  })
})

describe('mapa solto vira aventura para guardar sistema e fichas', () => {
  const ARQUIVO = 'C:/mesa/arquipelago/arquipelago.json'

  function abrirArquipelago(): MapData {
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(mapa('arquipelago', 'Arquipélago'))
    useSessionStore.getState().markSaved()
    return useMapStore.getState().map
  }

  it('virarAventura: só o próprio mapa (sem cena nova), no mesmo arquivo e com os mesmos ids; pede Salvar', () => {
    const antes = abrirArquipelago()
    expect(useAdventureStore.getState().virarAventura(ARQUIVO)).toBe(true)

    const state = useAdventureStore.getState()
    const cenas = state.adventure?.scenes ?? []
    expect(cenas).toHaveLength(1)
    expect(cenas[0]).toMatchObject({ name: 'Arquipélago', file: 'arquipelago.json' })
    expect(state.adventure?.startSceneId).toBe(cenas[0]?.id)
    expect(state.activeSceneId).toBe(cenas[0]?.id)
    expect(state.rootPath).toBe(ARQUIVO)
    expect(state.rootMapId).toBe('map_arquipelago')
    // O mapa do editor é o MESMO objeto: nenhum id muda, nada entra no desfazer.
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toEqual([])
    expect(state.cache).toEqual({})
    expect(hasUnsavedWork()).toBe(true)
  })

  it('virarAventura numa aventura não muda nada', () => {
    const antes = useAdventureStore.getState().adventure
    expect(useAdventureStore.getState().virarAventura(ARQUIVO)).toBe(false)
    expect(useAdventureStore.getState().adventure).toBe(antes)
  })

  it('Salvar depois grava o adventure.json ao lado do arquivo do mapa, que continua sendo a primeira cena', async () => {
    abrirArquipelago()
    useAdventureStore.getState().virarAventura(ARQUIVO)
    useAdventureStore.getState().setSistemaDeRpg('one-piece')

    await useAdventureStore.getState().flush()

    const aventura = parseAdventure(arquivos.get('C:/mesa/arquipelago/adventure.json') ?? '')
    expect(aventura.scenes.map((cena) => cena.file)).toEqual(['arquipelago.json'])
    expect(aventura.sistemaDeRpg).toBe('one-piece')
    expect(arquivos.has(ARQUIVO)).toBe(true)
    expect(hasUnsavedWork()).toBe(false)
  })

  it('garantirAventura: já é aventura, segue sem perguntar', async () => {
    const perguntar = vi.fn(async () => true)
    expect(await garantirAventura({ perguntar, caminhoDoMapaSolto: () => ARQUIVO })).toBe(true)
    expect(perguntar).not.toHaveBeenCalled()
  })

  it('garantirAventura no mapa solto: pergunta; "não" (ou pergunta que falha) deixa solto, "sim" vira aventura com o caminho de depois da resposta', async () => {
    abrirArquipelago()
    expect(await garantirAventura({ perguntar: async () => false, caminhoDoMapaSolto: () => ARQUIVO })).toBe(false)
    expect(await garantirAventura({ perguntar: async () => Promise.reject(new Error('janela fechou')), caminhoDoMapaSolto: () => ARQUIVO })).toBe(false)
    expect(useAdventureStore.getState().adventure).toBeNull()

    let caminho: string | null = null
    const perguntar = vi.fn(async (texto: string) => {
      expect(texto).toBe(PERGUNTA_VIRAR_AVENTURA)
      caminho = ARQUIVO
      return true
    })
    expect(await garantirAventura({ perguntar, caminhoDoMapaSolto: () => caminho })).toBe(true)
    expect(useAdventureStore.getState().adventure?.scenes.map((cena) => cena.file)).toEqual(['arquipelago.json'])
  })

  it('garantirAventura: outro mapa entrou enquanto a pergunta esperava, o sim não vale para ele', async () => {
    abrirArquipelago()
    const perguntar = async () => {
      useMapStore.getState().loadMap(mapa('outro', 'Outro'))
      return true
    }
    expect(await garantirAventura({ perguntar, caminhoDoMapaSolto: () => ARQUIVO })).toBe(false)
    expect(useAdventureStore.getState().adventure).toBeNull()
  })
})
