/**
 * ROTINA DO NPC no editor do mestre: o apito é um ESTADO DO MUNDO ("Apito:
 * Aurora, Meio, Brasa"). Trocar o valor leva cada ficha com posto naquele turno
 * ao posto — dentro da cena, ou para outra cena, sem duplicar a ficha. Ficha
 * que um jogador segura fica onde está. Gravar o posto é edição do mestre e
 * entra no Ctrl+Z; o apito é mudança de mesa e não entra.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

function fichaDe(map: MapData, id: string): Token | undefined {
  return map.tokens.find((t) => t.id === id)
}

function fundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error('cena de fundo fora do ar')
  return slot.map
}

/**
 * Capela (fundo) e Confessionário (aberta). O Tobias começa na cena aberta;
 * posto do Meio na Capela, da Brasa no próprio Confessionário.
 */
function montar(): { capela: string; conf: string; apito: string } {
  useMapStore.getState().loadMap(createEmptyMap('map_capela', 'Capela', 30, 20, 50))
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
        { valor: 'Meio', sceneId: capela, x: 400, y: 300 },
        { valor: 'Brasa', sceneId: conf, x: 600, y: 500 },
      ],
    },
  }
  useMapStore.getState().addToken(tobias)
  return { capela, conf, apito }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('apito: a rotina leva o NPC ao posto', () => {
  it('posto em outra cena: a ficha sai da cena aberta e chega na Capela, uma vez só', () => {
    const m = montar()
    useMapStore.getState().setSelection([{ kind: 'token', id: 'tobias' }])
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Meio')
    expect(resumo).toEqual({ elementos: 0, cenas: 2, fichas: 1 })
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toBeUndefined()
    // A seleção não fica apontando para a ficha que saiu da cena.
    expect(useMapStore.getState().selection).toEqual([])
    expect(fichaDe(fundo(m.capela), 'tobias')).toEqual(expect.objectContaining({ x: 400, y: 300 }))
    // A rotina anda com a ficha: o próximo apito a acha lá.
    expect(fichaDe(fundo(m.capela), 'tobias')?.rotina?.estadoId).toBe(m.apito)
    expect(useAdventureStore.getState().dirty[m.capela]).toBe(true)
  })

  it('posto na mesma cena: a ficha anda e o Ctrl+Z do mestre não a devolve', () => {
    const m = montar()
    useMapStore.getState().addToken({ id: 'banco', characterId: null, name: 'Banco', x: 0, y: 0, size: 1, image: null })
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Brasa')
    expect(resumo).toEqual({ elementos: 0, cenas: 1, fichas: 1 })
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 600, y: 500 }))
    useMapStore.getState().undo()
    // O desfazer tirou o banco (edição do mestre), mas o Tobias segue no posto.
    expect(fichaDe(useMapStore.getState().map, 'banco')).toBeUndefined()
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 600, y: 500 }))
  })

  it('ficha que um jogador segura fica onde está', () => {
    const m = montar()
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Meio', new Set(['tobias']))
    expect(resumo).toEqual({ elementos: 0, cenas: 0 })
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100, y: 100 }))
  })

  it('gravar a rotina pelo painel entra no Ctrl+Z', () => {
    montar()
    useMapStore.getState().setTokenRotina('tobias', undefined)
    expect(fichaDe(useMapStore.getState().map, 'tobias')?.rotina).toBeUndefined()
    useMapStore.getState().undo()
    expect(fichaDe(useMapStore.getState().map, 'tobias')?.rotina?.postos).toHaveLength(2)
  })
})
