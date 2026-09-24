/**
 * DUPLICAR, APAGAR E REORDENAR CENA (`stores/adventureStore.ts`).
 *
 * Cobra o que o menu "…" da lista Cenas promete: a cópia nasce logo abaixo,
 * com ids novos, sem as fichas dos jogadores e com os pinos de viagem soltos;
 * apagar conta e solta os pinos que levavam à cena apagada (também no desfazer
 * da cena aberta) e recusa com jogador lá; Subir/Descer andam uma posição.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin, Region, Token, Wall } from '../types/map'

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

const { useAdventureStore, sceneDeletionInfo, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')
const { deserializeMap } = await import('../lib/mapFile')

subscribeToDirtyFlag()
subscribeToTravelLinks()

const CAIS = 'cena-cais'
const CASA = 'cena-casa'
const NOVE = 'cena-9'
const DIR = 'C:/aventuras/porto'

/** Fichas dos jogadores à mesa: Ana está no cais, Bruno na casa. */
const JOGADORES = [
  { name: 'Ana', tokenIds: ['ficha-ana'] },
  { name: 'Bruno', tokenIds: ['ficha-bruno'] },
]
const FICHAS_DE_JOGADOR = new Set(['ficha-ana', 'ficha-bruno'])

function token(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null, ...extra }
}

function pinoViagem(id: string, sceneId: string | null, pinId: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 128, y: 128, kind: 'viagem', description: '', image: null, destino: sceneId === null ? null : { sceneId, pinId }, ...extra }
}

function sala(id: string, nome: string, parentId?: string): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 128, y: 0 },
      { x: 128, y: 128 },
      { x: 0, y: 128 },
    ],
    tag: '',
    fillColor: '#222222',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...(parentId === undefined ? {} : { parentId }),
  }
}

function parede(id: string, regionId: string, regionEdgeIndex: number): Wall {
  return { id, x1: 0, y1: 0, x2: 128, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' }, regionId, regionEdgeIndex }
}

function mapaCais(): MapData {
  return {
    ...createEmptyMap('map_cais', 'PC - Cais', 30, 20, 64),
    tokens: [token('ficha-ana'), token('guarda', { npc: true })],
    pins: [pinoViagem('p-cais', CASA, 'p-casa')],
  }
}

function mapaCasa(): MapData {
  return {
    ...createEmptyMap('map_casa', 'Casa genérica', 30, 20, 64),
    regions: [sala('r-casa', 'Sala de estar'), sala('r-quarto', 'Quarto', 'r-casa')],
    walls: [parede('w-norte', 'r-casa', 0), parede('w-quarto', 'r-quarto', 0)],
    lights: [{ id: 'luz-1', x: 10, y: 10, radius: 100, color: '#ffffff', intensity: 1 }],
    tokens: [token('ficha-bruno'), token('zumbi')],
    pins: [
      pinoViagem('p-casa', CAIS, 'p-cais'),
      pinoViagem('p-casa9', NOVE, 'p-9', { saidas: [{ id: 'saida_x', rotulo: 'Porão', destino: { sceneId: CAIS, pinId: 'p-outro' } }] }),
      { id: 'p-pista', x: 40, y: 40, kind: 'exclamacao', description: 'Carta', image: null },
    ],
  }
}

function mapaNove(): MapData {
  return { ...createEmptyMap('map_9', 'Cena 9', 30, 20, 64), pins: [pinoViagem('p-9', CASA, 'p-casa9', { soChegada: true })] }
}

function abrirAventura(): void {
  const cais = mapaCais()
  const adventure = {
    version: 1,
    id: 'adv_porto',
    name: 'Porto',
    startSceneId: CAIS,
    scenes: [
      { id: CAIS, name: 'PC - Cais', file: 'map.json' },
      { id: CASA, name: 'Casa genérica', file: `scenes/${CASA}/map.json` },
      { id: NOVE, name: 'Cena 9', file: `scenes/${NOVE}/map.json` },
    ],
  }
  useAdventureStore.getState().open({
    path: `${DIR}/map.json`,
    map: cais,
    adventure,
    adventureDir: DIR,
    activeSceneId: CAIS,
    scenes: [
      { entry: adventure.scenes[0], status: 'ok', map: cais },
      { entry: adventure.scenes[1], status: 'ok', map: mapaCasa() },
      { entry: adventure.scenes[2], status: 'ok', map: mapaNove() },
    ],
    changedSceneIds: [],
    adventureChanged: false,
  })
}

function nomes(): string[] {
  return (useAdventureStore.getState().adventure?.scenes ?? []).map((scene) => scene.name)
}

function mapaDe(sceneId: string): MapData {
  const state = useAdventureStore.getState()
  if (sceneId === state.activeSceneId) return useMapStore.getState().map
  const slot = state.cache[sceneId]
  if (slot === undefined || slot.status !== 'ok') throw new Error(`cena ${sceneId} não está no cache`)
  return slot.map
}

function pino(map: MapData, id: string): Pin {
  const achado = map.pins.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`pino ${id} sumiu`)
  return achado
}

beforeEach(() => {
  arquivos.clear()
  abrirAventura()
})

describe('duplicateScene', () => {
  it('Duplicar "Casa genérica" cria a cópia logo abaixo, sem trocar a cena aberta', () => {
    const id = useAdventureStore.getState().duplicateScene(CASA, FICHAS_DE_JOGADOR)
    expect(id).not.toBeNull()
    expect(nomes()).toEqual(['PC - Cais', 'Casa genérica', 'Casa genérica (cópia)', 'Cena 9'])
    const state = useAdventureStore.getState()
    expect(state.activeSceneId).toBe(CAIS)
    expect(state.adventure?.scenes[2]?.id).toBe(id)
    expect(state.structureDirty).toBe(true)
    expect(id !== null && state.dirty[id]).toBe(true)
  })

  it('a cópia tem ids novos, mantém o vínculo sala-parede e a sub-sala, e deixa de fora as fichas de jogador', () => {
    const id = useAdventureStore.getState().duplicateScene(CASA, FICHAS_DE_JOGADOR)
    if (id === null) throw new Error('não duplicou')
    const copia = mapaDe(id)
    const original = mapaCasa()
    expect(copia.id).not.toBe(original.id)
    expect(copia.name).toBe('Casa genérica (cópia)')

    // Fichas: o zumbi vai (com id novo), Bruno não.
    expect(copia.tokens.map((t) => t.name)).toEqual(['zumbi'])
    expect(copia.tokens[0]?.id).not.toBe('zumbi')

    // Salas e paredes: ids novos, nomes iguais, vínculos apontando para as cópias.
    const idsVelhos = new Set([...original.regions, ...original.walls, ...original.lights, ...original.pins].map((e) => e.id))
    for (const e of [...copia.regions, ...copia.walls, ...copia.lights, ...copia.pins]) expect(idsVelhos.has(e.id)).toBe(false)
    const [casa, quarto] = copia.regions
    expect(casa?.room?.name).toBe('Sala de estar')
    expect(quarto?.room?.name).toBe('Quarto')
    expect(quarto?.parentId).toBe(casa?.id)
    expect(copia.walls.map((w) => w.regionId)).toEqual([casa?.id, quarto?.id])
    expect(copia.walls.map((w) => w.regionEdgeIndex)).toEqual([0, 0])
    expect(copia.walls[0]?.door).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('os pinos de viagem da cópia nascem soltos; o original continua ligado', () => {
    const id = useAdventureStore.getState().duplicateScene(NOVE, FICHAS_DE_JOGADOR)
    if (id === null) throw new Error('não duplicou')
    const copiaNove = mapaDe(id)
    expect(copiaNove.pins).toHaveLength(1)
    expect(copiaNove.pins[0]?.destino ?? null).toBeNull()
    expect(copiaNove.pins[0]?.soChegada).toBeUndefined()

    const idCasa = useAdventureStore.getState().duplicateScene(CASA, FICHAS_DE_JOGADOR)
    if (idCasa === null) throw new Error('não duplicou')
    const copiaCasa = mapaDe(idCasa)
    for (const p of copiaCasa.pins) {
      expect(p.destino ?? null).toBeNull()
      expect(p.saidas).toBeUndefined()
    }
    // O "!" continua sendo "!", com a descrição.
    expect(copiaCasa.pins.find((p) => p.kind === 'exclamacao')?.description).toBe('Carta')
    // O original não foi tocado.
    expect(pino(mapaDe(CASA), 'p-casa').destino).toEqual({ sceneId: CAIS, pinId: 'p-cais' })
    expect(pino(mapaDe(CAIS), 'p-cais').destino).toEqual({ sceneId: CASA, pinId: 'p-casa' })
  })

  it('duplicar a cena ABERTA copia o mapa vivo, com a edição que ainda não foi gravada', () => {
    useMapStore.getState().addToken(token('barqueiro'))
    const id = useAdventureStore.getState().duplicateScene(CAIS, FICHAS_DE_JOGADOR)
    if (id === null) throw new Error('não duplicou')
    expect(nomes()).toEqual(['PC - Cais', 'PC - Cais (cópia)', 'Casa genérica', 'Cena 9'])
    expect(mapaDe(id).tokens.map((t) => t.name)).toEqual(['guarda', 'barqueiro'])
  })

  it('gravar escreve o arquivo da cópia e a lista com ela', async () => {
    const id = useAdventureStore.getState().duplicateScene(CASA, FICHAS_DE_JOGADOR)
    if (id === null) throw new Error('não duplicou')
    await useAdventureStore.getState().flush()
    const lista = parseAdventure(arquivos.get(`${DIR}/adventure.json`) ?? '')
    expect(lista.scenes.map((s) => s.name)).toEqual(['PC - Cais', 'Casa genérica', 'Casa genérica (cópia)', 'Cena 9'])
    const gravado = arquivos.get(`${DIR}/scenes/${id}/map.json`)
    expect(gravado).toBeDefined()
    expect(deserializeMap(gravado ?? '').tokens.map((t) => t.name)).toEqual(['zumbi'])
  })
})

describe('moveScene', () => {
  it('Subir move uma posição; a primeira não sobe e a última não desce', () => {
    expect(useAdventureStore.getState().moveScene(NOVE, -1)).toBe(true)
    expect(nomes()).toEqual(['PC - Cais', 'Cena 9', 'Casa genérica'])
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(useAdventureStore.getState().moveScene(CAIS, -1)).toBe(false)
    expect(useAdventureStore.getState().moveScene(CASA, 1)).toBe(false)
    expect(useAdventureStore.getState().moveScene(CAIS, 1)).toBe(true)
    expect(nomes()).toEqual(['Cena 9', 'PC - Cais', 'Casa genérica'])
  })
})

describe('sceneDeletionInfo', () => {
  it('conta os pinos de outras cenas que ficam sem destino e diz quem está lá', () => {
    const state = useAdventureStore.getState()
    const live = useMapStore.getState().map
    // p-cais (no cais) e p-9 (na Cena 9) levam à casa.
    expect(sceneDeletionInfo(state, live, CASA, JOGADORES)).toEqual({ orphanPins: 2, blockers: ['Bruno'] })
    // p-casa e p-casa9 (saída extra "Porão") levam ao cais.
    expect(sceneDeletionInfo(state, live, CAIS, JOGADORES)).toEqual({ orphanPins: 2, blockers: ['Ana'] })
    expect(sceneDeletionInfo(state, live, NOVE, JOGADORES)).toEqual({ orphanPins: 1, blockers: [] })
  })
})

describe('deleteScene', () => {
  it('"Cena 9" sai da lista e o pino que levava a ela fica sem destino', () => {
    expect(useAdventureStore.getState().deleteScene(NOVE, FICHAS_DE_JOGADOR)).toBe(true)
    expect(nomes()).toEqual(['PC - Cais', 'Casa genérica'])
    const state = useAdventureStore.getState()
    expect(state.cache[NOVE]).toBeUndefined()
    expect(state.structureDirty).toBe(true)
    // A encruzilhada perde só a saída para a Cena 9: a extra "Porão" sobe para principal.
    const p = pino(mapaDe(CASA), 'p-casa9')
    expect(p.destino).toEqual({ sceneId: CAIS, pinId: 'p-outro' })
    expect(p.saidas).toBeUndefined()
    expect(state.dirty[CASA]).toBe(true)
  })

  it('recusa com jogador lá, sem mexer em nada', () => {
    expect(useAdventureStore.getState().deleteScene(CASA, FICHAS_DE_JOGADOR)).toBe(false)
    expect(nomes()).toEqual(['PC - Cais', 'Casa genérica', 'Cena 9'])
    expect(pino(mapaDe(CAIS), 'p-cais').destino).toEqual({ sceneId: CASA, pinId: 'p-casa' })
  })

  it('o pino da cena aberta perde a ligação também no desfazer', () => {
    useMapStore.getState().updatePin('p-cais', { description: 'Rua do porto' })
    expect(useAdventureStore.getState().deleteScene(CASA, new Set(['ficha-ana']))).toBe(true)
    expect(pino(useMapStore.getState().map, 'p-cais').destino ?? null).toBeNull()
    useMapStore.getState().undo()
    const depois = pino(useMapStore.getState().map, 'p-cais')
    expect(depois.description).toBe('')
    expect(depois.destino ?? null).toBeNull()
    // A chegada oculta da Cena 9, que vinha da casa, volta a ser pino comum.
    expect(pino(mapaDe(NOVE), 'p-9').soChegada).toBeUndefined()
  })

  it('apagar a cena ABERTA abre outra antes e muda a cena de início', () => {
    expect(useAdventureStore.getState().deleteScene(CAIS, new Set())).toBe(true)
    const state = useAdventureStore.getState()
    expect(nomes()).toEqual(['Casa genérica', 'Cena 9'])
    expect(state.activeSceneId).toBe(CASA)
    expect(state.previousSceneId).toBeNull()
    expect(state.adventure?.startSceneId).toBe(CASA)
    expect(useMapStore.getState().map.id).toBe('map_casa')
    expect(pino(useMapStore.getState().map, 'p-casa').destino ?? null).toBeNull()
  })

  it('a última cena não se apaga', () => {
    const { deleteScene } = useAdventureStore.getState()
    expect(deleteScene(NOVE, new Set())).toBe(true)
    expect(deleteScene(CASA, new Set())).toBe(true)
    expect(deleteScene(CAIS, new Set())).toBe(false)
    expect(nomes()).toEqual(['PC - Cais'])
  })

  it('gravar depois de apagar escreve a lista sem a cena apagada', async () => {
    expect(useAdventureStore.getState().deleteScene(NOVE, new Set())).toBe(true)
    await useAdventureStore.getState().flush()
    const lista = parseAdventure(arquivos.get(`${DIR}/adventure.json`) ?? '')
    expect(lista.scenes.map((s) => s.id)).toEqual([CAIS, CASA])
    expect(useSessionStore.getState().isDirty).toBe(false)
  })
})
