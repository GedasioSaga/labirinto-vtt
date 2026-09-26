/**
 * ESTADO DO MUNDO no editor do mestre: criar "Maré" na aventura e trocar o
 * valor muda, de uma vez, a porta amarrada numa cena de FUNDO e o pino
 * amarrado na cena ABERTA. A troca é mudança de mesa: o Ctrl+Z do mestre não
 * a desfaz, e a aventura fica pendente de Salvar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState, MapData, Pin, Wall } from '../types/map'

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

function comporta(estadoId: string): Wall {
  const door: DoorState = {
    open: false,
    locked: true,
    kind: 'normal',
    porEstado: {
      estadoId,
      efeitos: [
        { valor: 'alta', efeito: 'trancada' },
        { valor: 'baixa', efeito: 'aberta' },
      ],
    },
  }
  return { id: 'comporta', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door }
}

function alcapao(estadoId: string): Pin {
  return {
    id: 'alcapao',
    x: 100,
    y: 100,
    kind: 'viagem',
    description: '',
    image: null,
    passagem: 'trancada',
    porEstado: { estadoId, efeitos: [{ valor: 'baixa', efeito: 'livre' }] },
  }
}

function portaDoFundo(sceneId: string): DoorState | null | undefined {
  const slot = useAdventureStore.getState().cache[sceneId]
  return slot?.status === 'ok' ? slot.map.walls.find((w) => w.id === 'comporta')?.door : undefined
}

function pinoAberto(): Pin | undefined {
  return useMapStore.getState().map.pins.find((p) => p.id === 'alcapao')
}

/** Andar 0 (fundo) com a comporta; Galerias (aberta) com o alçapão. Os dois obedecem à Maré. */
function montar(): { andar0: string; galerias: string; mare: string } {
  const mapa: MapData = createEmptyMap('map_andar0', 'Andar 0', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
  const galerias = useAdventureStore.getState().createScene('Galerias', null)
  const andar0 = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  const mare = useAdventureStore.getState().criarEstadoDoMundo('Maré', 'alta, baixa')
  if (mare === null) throw new Error('não criou o estado')
  useAdventureStore.getState().updateBackgroundScene(andar0, (map) => ({ ...map, walls: [...map.walls, comporta(mare)] }))
  useMapStore.getState().addPin(alcapao(mare))
  return { andar0, galerias, mare }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('estado do mundo: um toque muda várias cenas', () => {
  it('criar o estado grava na aventura com o primeiro valor como atual, e pede Salvar', () => {
    const m = montar()
    expect(useAdventureStore.getState().adventure?.estados).toEqual([{ id: m.mare, nome: 'Maré', valores: ['alta', 'baixa'], atual: 'alta' }])
    expect(useAdventureStore.getState().structureDirty).toBe(true)
  })

  it('trocar para baixa abre a comporta da cena de fundo E libera o alçapão da cena aberta', () => {
    const m = montar()
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.mare, 'baixa')
    expect(resumo).toEqual({ elementos: 2, cenas: 2 })
    expect(portaDoFundo(m.andar0)).toEqual(expect.objectContaining({ open: true, locked: false }))
    expect(pinoAberto()?.passagem).toBe('livre')
    expect(useAdventureStore.getState().adventure?.estados?.[0].atual).toBe('baixa')
    // A cena de fundo que mudou fica pendente de gravação.
    expect(useAdventureStore.getState().dirty[m.andar0]).toBe(true)
  })

  it('a troca não entra no Ctrl+Z do mestre: desfazer o último traço não tranca o alçapão de volta', () => {
    const m = montar()
    useMapStore.getState().addPin({ id: 'bau', x: 300, y: 300, kind: 'exclamacao', description: 'Baú', image: null })
    useAdventureStore.getState().trocarEstadoDoMundo(m.mare, 'baixa')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.pins.some((p) => p.id === 'bau')).toBe(false)
    expect(pinoAberto()?.passagem).toBe('livre')
  })

  it('valor que não é do estado, ou estado que não existe, não muda nada e devolve null', () => {
    const m = montar()
    const antes = useMapStore.getState().map
    expect(useAdventureStore.getState().trocarEstadoDoMundo(m.mare, 'cheia')).toBeNull()
    expect(useAdventureStore.getState().trocarEstadoDoMundo('nao-existe', 'baixa')).toBeNull()
    expect(useMapStore.getState().map).toBe(antes)
    expect(portaDoFundo(m.andar0)).toEqual(expect.objectContaining({ open: false, locked: true }))
  })

  it('mapa solto (sem aventura) não cria estado', () => {
    useMapStore.getState().loadMap(createEmptyMap('map_solto', 'Solto', 30, 20, 64))
    expect(useAdventureStore.getState().criarEstadoDoMundo('Maré', 'alta, baixa')).toBeNull()
    expect(useAdventureStore.getState().adventure).toBeNull()
  })
})
