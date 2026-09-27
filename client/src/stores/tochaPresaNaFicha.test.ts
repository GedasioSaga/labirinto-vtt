/**
 * TOCHA PRESA NA FICHA E VISÃO NO ESCURO. A Carla desce do Vale para o Porão
 * escuro com a tocha presa nela. A tocha tem que descer junto: no escuro, o que
 * a Carla vê é o raio da tocha DELA — o guarda do lado dela aparece; o rato lá
 * no fundo, o espião que o mestre escondeu, a emboscada na zona oculta e o
 * campo "dark" do mestre nunca chegam. Antes, a travessia soltava a tocha e ela
 * ficava acesa no Vale, no lugar de onde a Carla saiu, e a Carla chegava ao
 * Porão enxergando só a própria casa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConcealZone, Light, MapData, RegionPoint, Token } from '../types/map'

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

const { useAdventureStore, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { pointInRing } = await import('../lib/floorContour')
const { passengerIdsOf } = await import('../lib/vehicle')
const { createHostSession } = await import('../net/hostSession')

const CODE = 'TOCHA1'
/** Onde a Carla chega no Porão. */
const CHEGADA = { x: 640, y: 640 }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function luz(id: string, x: number, y: number, extra: Partial<Light> = {}): Light {
  return { id, x, y, radius: 160, color: '#ffaa33', intensity: 1, ...extra }
}

/** Zona oculta a sudoeste da chegada, dentro do raio da tocha, com a emboscada dentro. */
const ZONA: ConcealZone = {
  id: 'zona-emboscada',
  name: 'nome-da-zona-da-emboscada',
  revealed: false,
  points: [
    { x: 520, y: 690 },
    { x: 600, y: 690 },
    { x: 600, y: 770 },
    { x: 520, y: 770 },
  ],
}

/** Vale (aberto, claro) com a Carla e a tocha presa nela; Porão (de fundo, escuro) com quem espera no escuro. */
function montarAventura(): { vale: string; porao: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vale', 'Vale', 30, 20, 64))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('carla', 192, 192))
  useMapStore.getState().addLight(luz('tocha', 192, 192, { attachedTokenId: 'carla' }))
  useMapStore.getState().addLight(luz('lampiao', 900, 192))
  const porao = useAdventureStore.getState().createScene('Porão', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useAdventureStore.getState().updateBackgroundScene(porao, (map) => ({
    ...map,
    dark: true,
    concealZones: [ZONA],
    tokens: [
      ficha('guarda', CHEGADA.x + 96, CHEGADA.y),
      // Fora do raio da tocha (160), dentro do raio de visão (700): só o escuro o esconde.
      ficha('vigia', CHEGADA.x + 300, CHEGADA.y),
      ficha('rato', 1500, CHEGADA.y),
      ficha('espiao', CHEGADA.x + 48, CHEGADA.y - 64, { hidden: true }),
      ficha('emboscada', 560, 730),
    ],
  }))
  return { vale, porao }
}

function mapaDaCena(sceneId: string): MapData {
  if (sceneId === useAdventureStore.getState().activeSceneId) return useMapStore.getState().map
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`a cena ${sceneId} deveria estar carregada`)
  return slot.map
}

/** O snapshot que a Carla recebe pela rede, com o mundo como o host o monta: o Vale aberto na mesa, o Porão de fundo. */
function snapshotDaCarla() {
  const mundo = () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, mundo()).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'carla')
  const snap = s.broadcast(mundo()).outbound.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Carla')
  return snap
}

const inVision = (vision: RegionPoint[][], point: RegionPoint): boolean => vision.some((ring) => ring.length >= 3 && pointInRing(point, ring))

describe('tocha presa na ficha: desce com ela para a cena escura', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a tocha chega ao Porão presa na Carla, no centro dela, e sai do Vale', () => {
    const { vale, porao } = montarAventura()
    expect(useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)).toBe(true)

    expect(mapaDaCena(porao).lights).toEqual([luz('tocha', CHEGADA.x, CHEGADA.y, { attachedTokenId: 'carla' })])
    // A luz solta do Vale fica; a tocha não fica acesa para trás.
    expect(mapaDaCena(vale).lights.map((l) => l.id)).toEqual(['lampiao'])
  })

  it('SEGURANÇA: no Porão escuro a Carla vê só o raio da tocha dela; rato, espião, emboscada, zona e "dark" não chegam', () => {
    const { vale, porao } = montarAventura()
    useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)

    // O mestre continua no Vale; a Carla recebe a cena em que a ficha dela está.
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
    const snap = snapshotDaCarla()
    const json = JSON.stringify(snap)
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'guarda'])
    expect(snap.map.lights.map((l) => l.id)).toEqual(['tocha'])
    expect(inVision(snap.vision, { x: CHEGADA.x + 96, y: CHEGADA.y })).toBe(true)
    // Fora do raio da tocha é escuro, mesmo dentro do raio de visão (700).
    expect(inVision(snap.vision, { x: CHEGADA.x + 300, y: CHEGADA.y })).toBe(false)
    expect(inVision(snap.vision, { x: 1500, y: CHEGADA.y })).toBe(false)
    for (const segredo of ['vigia', 'rato', 'espiao', 'emboscada', 'nome-da-zona-da-emboscada', 'zona-emboscada', '"dark"', 'lampiao']) {
      expect(json).not.toContain(segredo)
    }
  })

  it('Ctrl+Z e Ctrl+Y no Vale nunca trazem a tocha de volta para lá', () => {
    const { vale, porao } = montarAventura()
    // Um passo desfeito no Vale ANTES da travessia: o refazer de lá também tem para onde ir.
    useMapStore.getState().addToken(ficha('pedra', 1600, 1000))
    useMapStore.getState().undo()
    useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)
    expect(useMapStore.getState().past.length).toBeGreaterThan(0)
    expect(useMapStore.getState().future.length).toBeGreaterThan(0)
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(useMapStore.getState().map.lights.map((l) => l.id)).not.toContain('tocha')
    }
    while (useMapStore.getState().future.length > 0) {
      useMapStore.getState().redo()
      expect(useMapStore.getState().map.lights.map((l) => l.id)).not.toContain('tocha')
    }
  })

  it('Ctrl+Z e Ctrl+Y no Porão nunca apagam a tocha que chegou nem a soltam da Carla', () => {
    const { vale, porao } = montarAventura()
    // Passos do mestre no Porão ANTES da Carla chegar: um feito (o desfazer tem para onde voltar) e um desfeito (o refazer também).
    useAdventureStore.getState().switchScene(porao)
    useMapStore.getState().addToken(ficha('barril', 1600, 1000))
    useMapStore.getState().addToken(ficha('caixote', 1700, 1000))
    useMapStore.getState().undo()
    useAdventureStore.getState().switchScene(vale)
    useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)

    useAdventureStore.getState().switchScene(porao)
    const tochaDaCarla = () => useMapStore.getState().map.lights.filter((l) => l.attachedTokenId === 'carla')
    expect(useMapStore.getState().past.length).toBeGreaterThan(0)
    expect(useMapStore.getState().future.length).toBeGreaterThan(0)
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(tochaDaCarla()).toEqual([luz('tocha', CHEGADA.x, CHEGADA.y, { attachedTokenId: 'carla' })])
    }
    while (useMapStore.getState().future.length > 0) {
      useMapStore.getState().redo()
      expect(tochaDaCarla()).toEqual([luz('tocha', CHEGADA.x, CHEGADA.y, { attachedTokenId: 'carla' })])
    }
  })

  it('tocha afastada do centro chega no mesmo afastamento, no piso em que a Carla chega', () => {
    const { vale, porao } = montarAventura()
    useMapStore.getState().updateLight('tocha', { x: 212, y: 180 })
    expect(useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y, 1)).toBe(true)

    const noPorao = mapaDaCena(porao)
    expect(noPorao.tokens.find((t) => t.id === 'carla')).toMatchObject({ x: CHEGADA.x, y: CHEGADA.y, piso: 1 })
    expect(noPorao.lights.find((l) => l.id === 'tocha')).toEqual(luz('tocha', CHEGADA.x + 20, CHEGADA.y - 12, { attachedTokenId: 'carla', piso: 1 }))
  })

  it('no Porão, a tocha segue a Carla quando ela anda', () => {
    const { vale, porao } = montarAventura()
    useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)
    useAdventureStore.getState().switchScene(porao)
    useMapStore.getState().setTokenPosition('carla', CHEGADA.x, CHEGADA.y - 128)
    expect(useMapStore.getState().map.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: CHEGADA.x, y: CHEGADA.y - 128, attachedTokenId: 'carla' })
  })

  it('quem vai a bordo do veículo leva a tocha dele junto, no mesmo afastamento', () => {
    const { vale, porao } = montarAventura()
    useMapStore.getState().addToken(ficha('carroca', 320, 192, { veiculo: { lugares: 1 } }))
    useMapStore.getState().setVehiclePassenger('carroca', 'carla', true)
    expect(useAdventureStore.getState().transferToken('carroca', vale, porao, CHEGADA.x + 128, CHEGADA.y)).toBe(true)

    const noPorao = mapaDaCena(porao)
    expect(passengerIdsOf(noPorao, 'carroca')).toEqual(['carla'])
    const carla = noPorao.tokens.find((t) => t.id === 'carla')
    expect(noPorao.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: carla?.x, y: carla?.y, attachedTokenId: 'carla' })
    expect(mapaDaCena(vale).lights.map((l) => l.id)).toEqual(['lampiao'])
  })

  it('o Porão já tem uma luz com o id da tocha: as duas ficam, com ids diferentes, e a de lá continua onde estava', () => {
    const { vale, porao } = montarAventura()
    useAdventureStore.getState().updateBackgroundScene(porao, (map) => ({ ...map, lights: [luz('tocha', 1200, 300)] }))
    useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)

    const luzes = mapaDaCena(porao).lights
    expect(new Set(luzes.map((l) => l.id)).size).toBe(2)
    expect(luzes.find((l) => l.id === 'tocha')).toEqual(luz('tocha', 1200, 300))
    expect(luzes.find((l) => l.attachedTokenId === 'carla')).toMatchObject({ x: CHEGADA.x, y: CHEGADA.y })
  })

  it('o Porão já tem uma ficha "carla" com tocha própria: ela troca de id e leva a tocha DELA; a que chega segue presa na Carla', () => {
    const { vale, porao } = montarAventura()
    useAdventureStore.getState().updateBackgroundScene(porao, (map) => ({
      ...map,
      tokens: [...map.tokens, ficha('carla', 1200, 300)],
      lights: [luz('tocha-da-outra', 1200, 300, { attachedTokenId: 'carla' })],
    }))
    useAdventureStore.getState().transferToken('carla', vale, porao, CHEGADA.x, CHEGADA.y)

    const noPorao = mapaDaCena(porao)
    const outra = noPorao.tokens.find((t) => t.x === 1200 && t.y === 300)
    expect(outra?.id).toBeDefined()
    expect(outra?.id).not.toBe('carla')
    expect(noPorao.tokens.find((t) => t.id === 'carla')).toMatchObject({ x: CHEGADA.x, y: CHEGADA.y })
    expect(noPorao.lights.find((l) => l.id === 'tocha-da-outra')).toMatchObject({ x: 1200, y: 300, attachedTokenId: outra?.id })
    expect(noPorao.lights.find((l) => l.id === 'tocha')).toEqual(luz('tocha', CHEGADA.x, CHEGADA.y, { attachedTokenId: 'carla' }))
  })
})
