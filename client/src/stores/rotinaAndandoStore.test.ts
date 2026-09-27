/**
 * ROTINA ANDANDO no editor do mestre: ligada, a ficha anda sozinha pelo
 * relógio, passo a passo, sem o mestre apertar nada — na cena aberta ou numa
 * de fundo, com a mesma mecânica do apito (mudança de mesa, fora do Ctrl+Z).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenedMapFile, SceneLoad } from '../lib/mapFileIO'
import type { MapData, Token } from '../types/map'

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

const { useAdventureStore, hasUnsavedWork } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { useRotinaAndandoStore } = await import('./rotinaAndandoStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { deserializeMap, serializeMap } = await import('../lib/mapFile')
const { parseAdventure, serializeAdventure } = await import('../lib/adventure')
const { ESPERA_NO_POSTO_MS, PASSO_DA_ROTINA_MS, passoEmPx } = await import('../lib/rotinaAndando')

// Como na raiz do App: sem esta assinatura, `isDirty` não acompanha o mapa.
subscribeToDirtyFlag()

const GRID = 50
const PASSO = passoEmPx(GRID)

function fichaDe(map: MapData, id: string): Token | undefined {
  return map.tokens.find((t) => t.id === id)
}

function fundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error('cena de fundo fora do ar')
  return slot.map
}

/**
 * Capela (fundo) e Confessionário (aberta). O Tobias está no Confessionário,
 * no posto da Aurora (100,100); o da Brasa fica no mesmo cômodo (300,100) e o
 * do Meio, se `meioNaCapela`, na Capela.
 */
function montar(meioNaCapela = false): { capela: string; conf: string } {
  useMapStore.getState().loadMap(createEmptyMap('map_capela', 'Capela', 30, 20, GRID))
  useSessionStore.getState().markSaved()
  const conf = useAdventureStore.getState().createScene('Confessionário', null)
  const capela = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  const apito = useAdventureStore.getState().criarEstadoDoMundo('Apito', 'Aurora, Meio, Brasa')
  if (apito === null) throw new Error('não criou o estado')
  const tobias: Token = {
    id: 'tobias',
    characterId: null,
    name: 'Irmão Tobias',
    x: 100,
    y: 100,
    size: 1,
    image: null,
    npc: true,
    rotina: {
      estadoId: apito,
      postos: [
        { valor: 'Aurora', sceneId: conf, x: 100, y: 100 },
        ...(meioNaCapela ? [{ valor: 'Meio', sceneId: capela, x: 400, y: 300 }] : []),
        { valor: 'Brasa', sceneId: conf, x: 300, y: 100 },
      ],
    },
  }
  useMapStore.getState().addToken(tobias)
  return { capela, conf }
}

beforeEach(() => {
  vi.useFakeTimers()
  useAdventureStore.getState().reset()
})

afterEach(() => {
  useRotinaAndandoStore.getState().reset()
  useRotinaAndandoStore.getState().setFixas(new Set())
  vi.useRealTimers()
})

describe('rotina ligada: o NPC anda sozinho', () => {
  it('liga e anda um passo por tique, sem o mestre apertar nada', () => {
    montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    expect(useRotinaAndandoStore.getState().andando.has('tobias')).toBe(true)
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100 + PASSO, y: 100 }))
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100 + 2 * PASSO, y: 100 }))
  })

  it('os passos são mudança de mesa: o Ctrl+Z do mestre não devolve a ficha', () => {
    montar()
    useMapStore.getState().addToken({ id: 'banco', characterId: null, name: 'Banco', x: 0, y: 0, size: 1, image: null })
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(3 * PASSO_DA_ROTINA_MS)
    useMapStore.getState().undo()
    expect(fichaDe(useMapStore.getState().map, 'banco')).toBeUndefined()
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100 + 3 * PASSO }))
  })

  it('em loop: chega na Brasa, espera, volta à Aurora e sai de novo', () => {
    montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    // 200 px a PASSO por tique: chega na Brasa.
    vi.advanceTimersByTime((200 / PASSO) * PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 300 }))
    // Espera no posto e faz a volta: parada de novo, agora na Aurora.
    vi.advanceTimersByTime(ESPERA_NO_POSTO_MS + (200 / PASSO) * PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100 }))
    vi.advanceTimersByTime(ESPERA_NO_POSTO_MS + 2 * PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')?.x).toBeGreaterThan(100)
    expect(useRotinaAndandoStore.getState().andando.has('tobias')).toBe(true)
  })

  it('ficha que um jogador segura fica onde está', () => {
    montar()
    useRotinaAndandoStore.getState().setFixas(new Set(['tobias']))
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(5 * PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100, y: 100 }))
  })
})

describe('desligar', () => {
  it('desligada, para onde está e o relógio para', () => {
    montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(2 * PASSO_DA_ROTINA_MS)
    useRotinaAndandoStore.getState().desligar('tobias')
    vi.advanceTimersByTime(10 * PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100 + 2 * PASSO }))
    expect(useRotinaAndandoStore.getState().andando.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ficha apagada desliga sozinha e o relógio para', () => {
    montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    useMapStore.getState().removeToken('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    expect(useRotinaAndandoStore.getState().andando.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('cena trocada', () => {
  it('o mestre abre outra cena: a ficha continua andando na de fundo', () => {
    const m = montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    expect(useAdventureStore.getState().switchScene(m.capela)).toBe(true)
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    expect(fichaDe(fundo(m.conf), 'tobias')).toEqual(expect.objectContaining({ x: 100 + 2 * PASSO }))
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toBeUndefined()
  })

  it('posto noutra cena: a ficha sai da aberta, chega lá uma vez só e sai da seleção', () => {
    const m = montar(true)
    useMapStore.getState().setSelection([{ kind: 'token', id: 'tobias' }])
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toBeUndefined()
    expect(useMapStore.getState().selection).toEqual([])
    expect(fichaDe(fundo(m.capela), 'tobias')).toEqual(expect.objectContaining({ x: 400, y: 300 }))
    expect(useRotinaAndandoStore.getState().andando.has('tobias')).toBe(true)
  })
})

/** O mapa como volta do disco: outro objeto, mesmo conteúdo. */
function doDisco(map: MapData): MapData {
  return deserializeMap(serializeMap(map))
}

/**
 * A MESMA aventura relida do disco, como o "Abrir" a traz: mesma pasta, mesmos
 * ids, e o Tobias com a rotina gravada — só não pode voltar andando.
 */
function relida(conf: string): OpenedMapFile {
  const { adventure } = useAdventureStore.getState()
  if (adventure === null) throw new Error('sem aventura')
  const aberta = doDisco(useMapStore.getState().map)
  return {
    path: `C:/aventuras/capela/scenes/${conf}/map.json`,
    map: aberta,
    adventure: parseAdventure(serializeAdventure(adventure)),
    adventureDir: 'C:/aventuras/capela',
    activeSceneId: conf,
    scenes: adventure.scenes.map((entry): SceneLoad => ({ entry, status: 'ok', map: entry.id === conf ? aberta : doDisco(fundo(entry.id)) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  }
}

describe('abrir outro mapa desliga a rotina', () => {
  it('reabrir a mesma aventura: a ficha volta parada, o relógio não corre e nada fica por salvar', () => {
    const m = montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    void useAdventureStore.getState().open(relida(m.conf))
    expect(useRotinaAndandoStore.getState().andando.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10 * PASSO_DA_ROTINA_MS)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100 + PASSO, y: 100 }))
    expect(useSessionStore.getState().isDirty).toBe(false)
    expect(hasUnsavedWork()).toBe(false)
  })

  it('mapa solto, sem aventura, pasta nem cenas: desliga na hora', () => {
    montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    const solto: OpenedMapFile = {
      path: 'C:/mapas/solto.json',
      map: createEmptyMap('map_solto', 'Solto', 20, 20, GRID),
      adventure: null,
      adventureDir: null,
      activeSceneId: null,
      scenes: [],
      changedSceneIds: [],
      adventureChanged: false,
      legacySources: [],
    }
    void useAdventureStore.getState().open(solto)
    expect(useRotinaAndandoStore.getState().andando.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('mapa novo (a aventura volta ao vazio): desliga na hora', () => {
    montar()
    useRotinaAndandoStore.getState().ligar('tobias')
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    useAdventureStore.getState().reset()
    expect(useRotinaAndandoStore.getState().andando.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
