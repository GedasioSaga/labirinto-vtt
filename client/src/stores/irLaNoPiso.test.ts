/**
 * PISOS NA MESMA CENA — o "Ir lá" até uma FICHA leva o editor ao piso dela.
 *
 * Cenário do revisor: o "Ir lá" do painel Grupo, o do aviso de chegada, o do
 * "Levar para…" e o Seguir levavam a câmera até a ficha, mas o editor ficava
 * no piso de antes (ou no térreo, que `loadMap` põe ao trocar de cena). A
 * câmera parava num lugar onde a ficha não aparecia: o mestre via o piso
 * errado, e o clique ali pegava o que é de outro piso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ''),
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
const { useToastStore } = await import('./toastStore')
const { levarFichaPara } = await import('./levarFicha')
const { createEmptyMap } = await import('../lib/mapFactory')
const { partyMembers } = await import('../lib/party')

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

/** Lia no 1º piso, Grog no térreo, os dois no Vale. */
const LIA = ficha('lia', 500, 500, { piso: 1 })
const GROG = ficha('grog', 300, 300)
const ZUMBI = ficha('zumbi', 320, 320, { name: 'Zumbi', npc: true })
/** A chegada no 1º piso da Torre. */
const SACADA: Pin = { id: 'sacada', x: 900, y: 600, kind: 'viagem', description: 'Sacada', image: null, destino: null, piso: 1 }

function vale(): MapData {
  return { ...createEmptyMap('map_vale', 'Vale', 30, 20, 64), tokens: [LIA, GROG, ZUMBI] }
}

const editor = () => useMapStore.getState()
const aventura = () => useAdventureStore.getState()

beforeEach(() => {
  aventura().reset()
  editor().loadMap(vale())
  useSessionStore.getState().markSaved()
  useToastStore.setState({ toasts: [] })
})

describe('goToPointNoPiso — a câmera e o piso vão juntos até a ficha', () => {
  it('na cena aberta: o editor, no térreo, vai ao 1º piso da Lia com ela no centro', () => {
    expect(editor().pisoAtivo).toBe(0)
    expect(aventura().goToPointNoPiso(null, { x: LIA.x, y: LIA.y }, 1)).toBe(true)
    expect(editor().pisoAtivo).toBe(1)
    expect(aventura().cameraRequest).toEqual({ camera: null, focus: { x: 500, y: 500 } })
    // E de volta ao térreo, até o Grog.
    expect(aventura().goToPointNoPiso(null, { x: GROG.x, y: GROG.y }, 0)).toBe(true)
    expect(editor().pisoAtivo).toBe(0)
  })

  it('em outra cena: a troca de cena põe o térreo, e o piso da ficha vem depois dela', () => {
    const torre = aventura().createScene('Torre', null)
    const valeId = aventura().adventure?.scenes[0]?.id ?? ''
    expect(aventura().activeSceneId).toBe(torre)
    editor().setPisoAtivo(3)
    expect(aventura().goToPointNoPiso(valeId, { x: LIA.x, y: LIA.y }, 1)).toBe(true)
    expect(aventura().activeSceneId).toBe(valeId)
    expect(editor().map.tokens.some((t) => t.id === 'lia')).toBe(true)
    expect(editor().pisoAtivo).toBe(1)
  })

  it('cena que não abre: não mexe no piso', () => {
    editor().setPisoAtivo(2)
    expect(aventura().goToPointNoPiso('cena-que-nao-existe', { x: 1, y: 1 }, 1)).toBe(false)
    expect(editor().pisoAtivo).toBe(2)
  })
})

describe('os "Ir lá" até uma ficha levam o piso dela', () => {
  it('"Levar para…" um pino do 1º piso: a ficha chega lá, e o "Ir lá" do aviso abre a Torre no 1º piso', () => {
    const torre = aventura().createScene('Torre', null)
    const valeId = aventura().adventure?.scenes[0]?.id ?? ''
    useMapStore.setState({ map: { ...editor().map, pins: [SACADA] } })
    expect(aventura().switchScene(valeId)).toBe(true)

    expect(levarFichaPara('zumbi', torre, 'sacada')).toBe(true)
    const irLa = useToastStore.getState().toasts.at(-1)?.actions?.find((action) => action.label === 'Ir lá')
    expect(irLa).toBeDefined()
    irLa?.run()
    expect(aventura().activeSceneId).toBe(torre)
    expect(editor().map.tokens.find((t) => t.id === 'zumbi')?.piso).toBe(1)
    expect(editor().pisoAtivo).toBe(1)
  })

  it('painel Grupo: a linha de quem está no 1º piso diz o piso da ficha (o "Ir lá" usa este número)', () => {
    const world = { open: { sceneId: null, name: 'Vale', map: editor().map }, background: [] }
    const base = { clientId: 'c', name: 'x', status: 'playing' as const, connected: true, visionRadius: 700 }
    const [lia, grog] = partyMembers(
      [
        { ...base, playerId: 'p-lia', name: 'Lia', tokenIds: ['lia'] },
        { ...base, playerId: 'p-grog', name: 'Grog', tokenIds: ['grog'] },
      ],
      world,
    )
    expect(lia?.token).toMatchObject({ id: 'lia', piso: 1 })
    // Térreo: sem o campo, como no arquivo.
    expect(grog?.token).toMatchObject({ id: 'grog' })
    expect(grog?.token !== null && grog?.token !== undefined && 'piso' in grog.token).toBe(false)
  })
})
