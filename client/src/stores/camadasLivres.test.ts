/**
 * CAMADAS LIVRES na store (fatia 7, `docs/planos/camadas-fase3-2026-10-22.md`):
 * um passo de Ctrl+Z por gesto (criar, renomear, ordenar, apagar), o Ctrl+Z
 * desfaz tudo e o Ctrl+Y refaz; a lista mora na AVENTURA (todas as cenas) e
 * chega ao `adventure.json`; mapa solto pergunta antes de virar aventura.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CamadaId, MapData } from '../types/map'

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

const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useToastStore } = await import('./toastStore')
const { acoesDoModeloDeCamadasCom, PERGUNTA_VIRAR_AVENTURA_CAMADAS, garantirAventuraParaCamadas } = await import('./virarAventura')
const { createEmptyMap, addToken } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')
const { deserializeMap } = await import('../lib/mapFile')
const { contextoDeCamadas } = await import('../lib/camadas/consulta')
const { CAMADAS_PADRAO } = await import('../lib/camadas/padrao')

const PASTA = 'C:/appdata/maps/map_torre'

function mapa(id: string, name: string): MapData {
  let map = createEmptyMap(`map_${id}`, name, 20, 16, 64)
  map = addToken(map, { id: `${id}-t1`, characterId: null, name: 'Ana', x: 64, y: 64, size: 1, image: null })
  return addToken(map, { id: `${id}-t2`, characterId: null, name: 'Bia', x: 128, y: 64, size: 1, image: null })
}

function abrirTorre(camadas?: MapData['modeloCamadas']): void {
  const cenas = [
    { id: 'salao', name: 'Salão', file: 'map.json' },
    { id: 'cripta', name: 'Cripta', file: 'scenes/cripta/map.json' },
  ]
  const salao = mapa('salao', 'Salão')
  useAdventureStore.getState().open({
    path: `${PASTA}/map.json`,
    map: salao,
    adventure: { version: 1, id: 'adv_torre', name: 'Torre', startSceneId: 'salao', scenes: cenas, ...(camadas === undefined ? {} : { camadas }) },
    adventureDir: PASTA,
    activeSceneId: 'salao',
    scenes: cenas.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'salao' ? salao : mapa(entry.id, entry.name) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

const ordem = (): CamadaId[] => contextoDeCamadas(useMapStore.getState().map).ordem.slice()
const passos = (): number => useMapStore.getState().past.length

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useToastStore.setState({ toasts: [] })
})

describe('um passo de Ctrl+Z por gesto, e o Ctrl+Z desfaz tudo', () => {
  it('criar, renomear, ordenar e apagar (com 2 fichas dentro): 4 passos; 4 Ctrl+Z voltam ao mapa de antes; 4 Ctrl+Y refazem', () => {
    abrirTorre()
    const antes = useMapStore.getState().map
    const loja = useMapStore.getState()
    const id = loja.criarCamadaLivre()
    if (id === null) throw new Error('não criou')
    expect(passos()).toBe(1)
    useMapStore.getState().renomearCamada(id, 'Cripta secreta')
    expect(passos()).toBe(2)
    useMapStore.getState().moverCamada(id, 0)
    expect(ordem()[0]).toBe(id)
    expect(passos()).toBe(3)
    // Duas fichas na camada (o painel de mover item é a fatia 8; aqui o dado direto, fora do histórico).
    useMapStore.setState((s) => ({ map: { ...s.map, tokens: s.map.tokens.map((t) => ({ ...t, camada: id })) } }))
    const comFichas = useMapStore.getState().map
    useMapStore.getState().apagarCamadaLivre(id)
    expect(passos()).toBe(4)
    expect(useMapStore.getState().map.tokens.every((t) => t.camada === undefined)).toBe(true)
    const aviso = useToastStore.getState().toasts.at(-1)
    expect(aviso?.text).toBe('Camada "Cripta secreta" apagada: 2 itens voltaram às camadas padrão.')
    expect(aviso?.actions?.map((a) => a.label)).toEqual(['Desfazer'])

    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(comFichas)
    for (let i = 0; i < 3; i += 1) useMapStore.getState().undo()
    expect(useMapStore.getState().map.modeloCamadas).toBeUndefined()
    expect(ordem()).toEqual(CAMADAS_PADRAO)
    expect(useMapStore.getState().map.tokens).toEqual(antes.tokens)
    for (let i = 0; i < 4; i += 1) useMapStore.getState().redo()
    expect(ordem()).toEqual(CAMADAS_PADRAO)
    expect(useMapStore.getState().map.tokens.every((t) => t.camada === undefined)).toBe(true)
  })

  it('o "Desfazer" do aviso desfaz a remoção, e não faz nada se outra coisa mudou depois', () => {
    abrirTorre()
    const id = useMapStore.getState().criarCamadaLivre()
    if (id === null) throw new Error('não criou')
    useMapStore.getState().apagarCamadaLivre(id)
    useToastStore.getState().toasts.at(-1)?.actions?.[0].run()
    expect(ordem()).toContain(id)
    useMapStore.getState().apagarCamadaLivre(id)
    useMapStore.getState().moverCamada('chao', 3)
    const depois = useMapStore.getState().map
    useToastStore.getState().toasts.at(-1)?.actions?.[0].run()
    expect(useMapStore.getState().map).toBe(depois)
  })

  it('renomear para o mesmo nome, em branco, ou mover para o mesmo lugar: nenhum passo', () => {
    abrirTorre()
    const id = useMapStore.getState().criarCamadaLivre()
    if (id === null) throw new Error('não criou')
    useMapStore.getState().renomearCamada(id, '   ')
    useMapStore.getState().renomearCamada(id, 'Nova camada')
    useMapStore.getState().moverCamada(id, CAMADAS_PADRAO.length)
    expect(passos()).toBe(1)
  })
})

describe('a lista mora na aventura', () => {
  it('criar e renomear chegam ao adventure.json (com o nome); o map.json não leva a lista; o Ctrl+Z tira da aventura', async () => {
    abrirTorre()
    const id = useMapStore.getState().criarCamadaLivre()
    if (id === null) throw new Error('não criou')
    useMapStore.getState().renomearCamada(id, 'Segredo do Lich')
    expect(useAdventureStore.getState().adventure?.camadas?.ordem.at(-1)).toEqual({ id, nome: 'Segredo do Lich' })
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    await useAdventureStore.getState().flush()
    const aventura = parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '')
    expect(aventura.camadas?.ordem.find((c) => c.id === id)?.nome).toBe('Segredo do Lich')
    expect(arquivos.get(`${PASTA}/map.json`)).not.toContain('Segredo do Lich')
    useMapStore.getState().undo()
    useMapStore.getState().undo()
    expect(useAdventureStore.getState().adventure?.camadas).toBeUndefined()
  })

  it('a aventura que abre com a lista põe a lista no editor (e a cena trocada também a recebe)', () => {
    const livre: CamadaId = 'livre_0a1b2c3d'
    const camadas = { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: livre, nome: 'Cripta' }] }
    abrirTorre(camadas)
    expect(useMapStore.getState().map.modeloCamadas).toBe(camadas)
    useMapStore.getState().moverCamada(livre, 0)
    const novaOrdem = useMapStore.getState().map.modeloCamadas
    expect(useAdventureStore.getState().switchScene('cripta')).toBe(true)
    expect(useMapStore.getState().map.modeloCamadas).toBe(novaOrdem)
    expect(useAdventureStore.getState().switchScene('salao')).toBe(true)
    expect(ordem()[0]).toBe(livre)
  })

  it('reaberta do disco: a mesma lista, os mesmos nomes, os itens na camada deles', async () => {
    abrirTorre()
    const id = useMapStore.getState().criarCamadaLivre()
    if (id === null) throw new Error('não criou')
    useMapStore.setState((s) => ({ map: { ...s.map, tokens: s.map.tokens.map((t) => ({ ...t, camada: id })) } }))
    await useAdventureStore.getState().flush()
    const aventura = parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '')
    const map = { ...deserializeMap(arquivos.get(`${PASTA}/map.json`) ?? ''), modeloCamadas: aventura.camadas }
    expect(map.tokens.map((t) => contextoDeCamadas(map).camadaDe('ficha', t))).toEqual([id, id])
  })
})

describe('mapa solto: a lista precisa da aventura', () => {
  it('criar pergunta; no "não" nada muda; no "sim" o mapa vira aventura e a camada nasce nela', async () => {
    useAdventureStore.getState().open({ path: 'C:/appdata/maps/solto/map.json', map: mapa('solto', 'Solto'), adventure: null, adventureDir: null, activeSceneId: null, scenes: [], changedSceneIds: [], adventureChanged: false, legacySources: [] })
    const perguntas: string[] = []
    const nao = acoesDoModeloDeCamadasCom(() => garantirAventuraParaCamadas({ perguntar: async (t) => (perguntas.push(t), false), caminhoDoMapaSolto: () => null }))
    expect(await nao.criar()).toBeNull()
    expect(perguntas).toEqual([PERGUNTA_VIRAR_AVENTURA_CAMADAS])
    expect(useMapStore.getState().map.modeloCamadas).toBeUndefined()
    expect(useAdventureStore.getState().adventure).toBeNull()
    const sim = acoesDoModeloDeCamadasCom(() => garantirAventuraParaCamadas({ perguntar: async () => true, caminhoDoMapaSolto: () => null }))
    const id = await sim.criar()
    expect(id).toMatch(/^livre_[0-9a-f]{8}$/)
    expect(useAdventureStore.getState().adventure?.camadas?.ordem.map((c) => c.id)).toContain(id)
  })
})
