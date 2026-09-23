/**
 * MÃO ÚNICA no editor do mestre: "Mão única" no pino de ORIGEM põe (e tira)
 * a marca de chegada oculta no PAR, na cena de fundo; a ligação continua nos
 * dois lados. Apagar a origem deixa o par ÓRFÃO como pino de viagem COMUM,
 * sem par e sem a marca — ele não some, e volta a existir para o jogador.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
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

const { useAdventureStore, pinExitsTravelOf, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { SAIDA_PRINCIPAL } = await import('../lib/pinTravel')

// O guardião da mão dupla, ligado como o App liga.
subscribeToTravelLinks()

function viagem(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
}

function pinoDoFundo(sceneId: string, pinId: string): Pin | undefined {
  const slot = useAdventureStore.getState().cache[sceneId]
  return slot?.status === 'ok' ? slot.map.pins.find((p) => p.id === pinId) : undefined
}

function pinoAberto(pinId: string): Pin {
  const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
  if (pin === undefined) throw new Error(`pino ${pinId} não está na cena aberta`)
  return pin
}

/** Vale com o alçapão "a" ligado a uma chegada nova na Cripta. Termina no Vale. */
function montar(): { vale: string; cripta: string; par: string } {
  useAdventureStore.getState().reset()
  const mapa: MapData = createEmptyMap('map_raiz', 'Vale', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useMapStore.getState().addPin(viagem('a', { description: 'Alçapão' }))
  const par = useAdventureStore.getState().linkPinToNewArrival('a', cripta)
  if (par === null) throw new Error('não ligou')
  return { vale, cripta, par }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('mão única: a marca mora no par', () => {
  it('marcar põe soChegada no par (cena de fundo) e mantém a ligação nos dois lados; desmarcar tira a chave', () => {
    const m = montar()
    expect(useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)).toBe(true)
    const marcado = pinoDoFundo(m.cripta, m.par)
    expect(marcado?.soChegada).toBe(true)
    expect(marcado?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
    expect(pinoAberto('a').destino).toEqual({ sceneId: m.cripta, pinId: m.par })
    // A cena de fundo fica suja: a marca tem de ir para o disco.
    expect(useAdventureStore.getState().dirty[m.cripta]).toBe(true)
    // O painel da origem continua lendo "ligado" — e é pelo par que ele sabe da mão única.
    const [saida] = pinExitsTravelOf(useAdventureStore.getState(), useMapStore.getState().map, pinoAberto('a'))
    expect(saida.travel.status === 'ligado' && saida.travel.partner.soChegada).toBe(true)

    expect(useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, false)).toBe(true)
    const desmarcado = pinoDoFundo(m.cripta, m.par)
    expect(desmarcado !== undefined && 'soChegada' in desmarcado).toBe(false)
    expect(desmarcado?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
  })

  it('saída sem par não marca nada', () => {
    const m = montar()
    useAdventureStore.getState().unlinkPin('a')
    expect(useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)).toBe(false)
    expect(pinoDoFundo(m.cripta, m.par)?.soChegada).toBeUndefined()
  })

  it('par que é encruzilhada não vira chegada oculta (esconderia as outras saídas dele)', () => {
    const m = montar()
    useAdventureStore.getState().updateBackgroundScene(m.cripta, (map) => ({
      ...map,
      pins: map.pins.map((p) =>
        p.id === m.par ? { ...p, saidas: [{ id: 'saida_x', rotulo: '', destino: { sceneId: 'outra', pinId: 'y' } }] } : p,
      ),
    }))
    expect(useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)).toBe(false)
    expect(pinoDoFundo(m.cripta, m.par)?.soChegada).toBeUndefined()
  })

  it('o mestre não atravessa de volta pela chegada oculta; atravessa pela origem', () => {
    const m = montar()
    useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)
    expect(useAdventureStore.getState().travelThroughPin('a')).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe(m.cripta)
    expect(useAdventureStore.getState().travelThroughPin(m.par)).toBe(false)
    expect(useAdventureStore.getState().activeSceneId).toBe(m.cripta)
  })
})

describe('mão única: apagar a origem', () => {
  it('o par ÓRFÃO volta a ser pino de viagem comum: continua no mapa, sem destino e sem a marca', () => {
    const m = montar()
    useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)
    useMapStore.getState().removePin('a')
    const orfao = pinoDoFundo(m.cripta, m.par)
    expect(orfao).toMatchObject({ id: m.par, kind: 'viagem', destino: null })
    expect(orfao !== undefined && 'soChegada' in orfao).toBe(false)
  })

  it('religar a origem a outro par também desmarca o antigo', () => {
    const m = montar()
    useAdventureStore.getState().setPinOneWay('a', SAIDA_PRINCIPAL, true)
    const novo = useAdventureStore.getState().linkPinToNewArrival('a', m.cripta)
    if (novo === null) throw new Error('não religou')
    expect(pinoDoFundo(m.cripta, m.par)?.soChegada).toBeUndefined()
    expect(pinoDoFundo(m.cripta, m.par)?.destino).toBeNull()
    // O par novo nasce comum: a mão única era da ligação antiga.
    expect(pinoDoFundo(m.cripta, novo)?.soChegada).toBeUndefined()
  })
})
