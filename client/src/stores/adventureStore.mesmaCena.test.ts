/**
 * ATALHO NA MESMA CENA no editor do mestre: "Leva a…" oferece "Esta cena",
 * e a ligação grava os DOIS pinos do mapa aberto num passo só do desfazer —
 * não existe par em cena de fundo para o guardião manter.
 */
import { describe, expect, it, vi } from 'vitest'
import type { MapData, Pin } from '../types/map'

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

const { useAdventureStore, pinExitsTravelOf, hereSceneOption, pinTravelOptions, unlinkedTravelPinIds, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap, addPin } = await import('../lib/mapFactory')
const { SAIDA_PRINCIPAL } = await import('../lib/pinTravel')

subscribeToTravelLinks()

function viagem(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
}

function pinoAberto(pinId: string): Pin {
  const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
  if (pin === undefined) throw new Error(`pino ${pinId} não está na cena aberta`)
  return pin
}

/** Torre aberta (numa aventura com a Cripta) com a escada de baixo "a" e a de cima "b", soltas. */
function montar(): { torre: string; cripta: string } {
  useAdventureStore.getState().reset()
  const mapa: MapData = createEmptyMap('map_raiz', 'Torre', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const torre = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(torre)
  useMapStore.getState().addPin(viagem('a', { description: 'Escada do térreo' }))
  useMapStore.getState().addPin(viagem('b', { x: 1400, y: 900, description: 'Escada do topo' }))
  return { torre, cripta }
}

describe('adventureStore: atalho na mesma cena', () => {
  it('"Esta cena" é uma opção do "Leva a…", com o id da cena aberta', () => {
    const { torre } = montar()
    expect(hereSceneOption(useAdventureStore.getState())).toEqual({ id: torre, name: 'Esta cena', available: true, here: true })
    const opcoes = pinTravelOptions(useAdventureStore.getState(), useMapStore.getState().map, torre, 'a')
    expect(opcoes.map((o) => o.id)).toEqual(['b'])
  })

  it('ligar a um pino que já está no mapa: os dois lados, num passo só do desfazer', () => {
    const { torre } = montar()
    expect(useAdventureStore.getState().linkPinToExisting('a', torre, 'b')).toBe(true)
    expect(pinoAberto('a').destino).toEqual({ sceneId: torre, pinId: 'b' })
    expect(pinoAberto('b').destino).toEqual({ sceneId: torre, pinId: 'a' })
    const [saida] = pinExitsTravelOf(useAdventureStore.getState(), useMapStore.getState().map, pinoAberto('a'))
    expect(saida?.travel).toMatchObject({ status: 'ligado', sameScene: true, partner: { id: 'b' } })
    expect(unlinkedTravelPinIds(useAdventureStore.getState(), useMapStore.getState().map).size).toBe(0)
    useMapStore.getState().undo()
    expect(pinoAberto('a').destino ?? null).toBeNull()
    expect(pinoAberto('b').destino ?? null).toBeNull()
  })

  it('criar a chegada: nasce perto da escada, no mapa aberto, já ligada de volta', () => {
    const { torre } = montar()
    const antes = useMapStore.getState().map.pins.length
    const nova = useAdventureStore.getState().linkPinToNewArrival('a', torre)
    if (nova === null) throw new Error('a chegada deveria nascer')
    const chegada = pinoAberto(nova)
    expect(useMapStore.getState().map.pins.length).toBe(antes + 1)
    expect(chegada.kind).toBe('viagem')
    expect(chegada.destino).toEqual({ sceneId: torre, pinId: 'a' })
    expect(pinoAberto('a').destino).toEqual({ sceneId: torre, pinId: nova })
    // Perto da escada de origem, e não em cima dela.
    const distancia = Math.hypot(chegada.x - 200, chegada.y - 200)
    expect(distancia).toBeGreaterThan(0)
    expect(distancia).toBeLessThanOrEqual(64 * 3)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.pins.length).toBe(antes)
    expect(pinoAberto('a').destino ?? null).toBeNull()
  })

  it('desligar um lado desliga os dois', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    useAdventureStore.getState().unlinkPin('b', SAIDA_PRINCIPAL)
    expect(pinoAberto('a').destino ?? null).toBeNull()
    expect(pinoAberto('b').destino ?? null).toBeNull()
  })

  it('mão única na mesma cena: marca a chegada no mapa aberto', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    expect(useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)).toBe(true)
    expect(pinoAberto('b').soChegada).toBe(true)
  })

  it('apagar a origem de uma mão única: a chegada volta a ser pino comum, e o Ctrl+Z devolve os dois num passo', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)
    expect(pinoAberto('b').soChegada).toBe(true)
    useMapStore.getState().removePin('a')
    expect(useMapStore.getState().map.pins.map((p) => p.id)).toEqual(['b'])
    // Sem origem, B não pode ficar escondido do jogador para sempre.
    expect(pinoAberto('b').destino ?? null).toBeNull()
    expect(pinoAberto('b').soChegada).toBeUndefined()
    useMapStore.getState().undo()
    expect(pinoAberto('a').destino).toEqual({ sceneId: torre, pinId: 'b' })
    expect(pinoAberto('b').destino).toEqual({ sceneId: torre, pinId: 'a' })
    expect(pinoAberto('b').soChegada).toBe(true)
    useMapStore.getState().redo()
    expect(useMapStore.getState().map.pins.map((p) => p.id)).toEqual(['b'])
    expect(pinoAberto('b').soChegada).toBeUndefined()
  })

  it('a origem deixa de ser pino de viagem: o par perde a volta e a marca de chegada oculta', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)
    useMapStore.getState().updatePin('a', { kind: 'exclamacao' })
    expect(pinoAberto('b').destino ?? null).toBeNull()
    expect(pinoAberto('b').soChegada).toBeUndefined()
  })

  it('religar a origem a OUTRA cena pelo "Leva a…": o par desta cena perde a volta, o de lá ganha', () => {
    const { torre, cripta } = montar()
    useAdventureStore.getState().updateBackgroundScene(cripta, (map) => addPin(map, viagem('c', { description: 'Porta da cripta' })))
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)
    expect(useAdventureStore.getState().linkPinToExisting('a', cripta, 'c')).toBe(true)
    expect(pinoAberto('a').destino).toEqual({ sceneId: cripta, pinId: 'c' })
    expect(pinoAberto('b').destino ?? null).toBeNull()
    expect(pinoAberto('b').soChegada).toBeUndefined()
    const slot = useAdventureStore.getState().cache[cripta]
    if (slot?.status !== 'ok') throw new Error('a Cripta deveria estar de fundo')
    expect(slot.map.pins.find((p) => p.id === 'c')?.destino).toEqual({ sceneId: torre, pinId: 'a' })
  })

  it('"Ir" pelo atalho do mestre: não troca de cena, centra no par e o seleciona', () => {
    const { torre } = montar()
    useAdventureStore.getState().linkPinToExisting('a', torre, 'b')
    expect(useAdventureStore.getState().travelThroughPin('a')).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe(torre)
    expect(useAdventureStore.getState().cameraRequest?.focus).toBeDefined()
    expect(useMapStore.getState().selectedPinId).toBe('b')
  })
})
