/**
 * ITEM PEGÁVEL no editor do mestre: a troca de lugar do item (pino que sai,
 * mochila que muda) vale para TODO passo do desfazer da cena onde aconteceu
 * — aberta ou de fundo. Senão um Ctrl+Z do mestre, depois, devolve a chave ao
 * chão com ela ainda na mochila (duplica) ou tira da mochila (some).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco no teste')
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

const { useAdventureStore, applyItemsInScene } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { buildPin, createEmptyMap } = await import('../lib/mapFactory')

const CHAVE = { id: 'pino-chave', nome: 'Chave do Escudo' }

function diego(): Token {
  return { id: 'diego', characterId: null, name: 'Diego', x: 64, y: 64, size: 1, image: null }
}

function pinoChave(): Pin {
  return { ...buildPin(CHAVE.id, { x: 96, y: 64 }, 'exclamacao'), item: { nome: CHAVE.nome } }
}

/** A chave pega pelo Diego, na cena `sceneId` (ausente = a aberta). */
function pegar(sceneId?: string) {
  applyItemsInScene({ ...(sceneId === undefined ? {} : { sceneId }), removePinId: CHAVE.id, mochilas: [{ tokenId: 'diego', mochila: [CHAVE] }] })
}

function estado(map: MapData): { pinos: string[]; mochila: unknown } {
  return { pinos: map.pins.map((p) => p.id), mochila: map.tokens.find((t) => t.id === 'diego')?.mochila }
}

/** Vale com o pino e o Diego (dois passos no desfazer); a Cripta nasce e fica aberta, o Vale vai ao fundo. */
function valeAoFundo(): { vale: string; cripta: string } {
  useMapStore.getState().addPin(pinoChave())
  useMapStore.getState().addToken(diego())
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
  return { vale, cripta }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
  useSessionStore.getState().markSaved()
})

describe('applyItemsInScene: a pegada entra em todo passo do desfazer', () => {
  it('cena de FUNDO: depois de abrir o Vale, Ctrl+Z não devolve a chave ao chão nem esvazia a mochila', () => {
    const { vale } = valeAoFundo()
    pegar(vale)

    expect(useAdventureStore.getState().switchScene(vale)).toBe(true)
    expect(estado(useMapStore.getState().map)).toEqual({ pinos: [], mochila: [CHAVE] })

    // Desfaz o "Diego entra": a ficha some, mas a chave NÃO volta ao chão.
    useMapStore.getState().undo()
    expect(estado(useMapStore.getState().map)).toEqual({ pinos: [], mochila: undefined })
    // Refaz: a ficha volta COM a chave.
    useMapStore.getState().redo()
    expect(estado(useMapStore.getState().map)).toEqual({ pinos: [], mochila: [CHAVE] })
    expect(useAdventureStore.getState().dirty[vale]).toBe(true)
  })

  it('cena de fundo não mexe no mapa nem no desfazer da cena aberta', () => {
    const { vale } = valeAoFundo()
    useMapStore.getState().addToken({ ...diego(), id: 'esqueleto' })
    const antes = useMapStore.getState()
    pegar(vale)
    expect(useMapStore.getState().map).toBe(antes.map)
    expect(useMapStore.getState().past).toBe(antes.past)
  })

  it('cena ABERTA (mapa solto): o mapa e todo o desfazer mudam juntos, e a pegada não é um passo do Ctrl+Z', () => {
    useMapStore.getState().addPin(pinoChave())
    useMapStore.getState().addToken(diego())
    const passos = useMapStore.getState().past.length
    pegar()
    expect(estado(useMapStore.getState().map)).toEqual({ pinos: [], mochila: [CHAVE] })
    expect(useMapStore.getState().past).toHaveLength(passos)
    useMapStore.getState().undo()
    expect(estado(useMapStore.getState().map)).toEqual({ pinos: [], mochila: undefined })
  })

  it('a cena da pegada virou a aberta antes de gravar (o mestre trocou no meio): grava no editor, não no cache velho', () => {
    const { vale } = valeAoFundo()
    useAdventureStore.getState().switchScene(vale)
    pegar(vale)
    expect(estado(useMapStore.getState().map)).toEqual({ pinos: [], mochila: [CHAVE] })
    useMapStore.getState().undo()
    expect(estado(useMapStore.getState().map).pinos).toEqual([])
  })
})
