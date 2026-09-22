/**
 * ENCRUZILHADA no editor do mestre: cada saída do pino de viagem é ligada em
 * mão dupla ao PRÓPRIO par, e o guardião (`subscribeToTravelLinks`) mantém
 * cada par em dia — desligar uma saída desliga só o par dela, apagar o pino
 * desliga todos, apagar um par desliga só a saída dele.
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

const { useAdventureStore, pinExitsTravelOf, unlinkedTravelPinIds, subscribeToTravelLinks } = await import('./adventureStore')
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

function saidasDoPainel(pinId: string) {
  return pinExitsTravelOf(useAdventureStore.getState(), useMapStore.getState().map, pinoAberto(pinId))
}

interface Mesa {
  vale: string
  cripta: string
  torre: string
  chegadaCripta: string
  chegadaTorre: string
  saidaTorre: string
}

/** Vale com o pino "a" ligado à Cripta (principal) e, por "+ Outra saída", à Torre. Termina no Vale. */
function montar(): Mesa {
  useAdventureStore.getState().reset()
  const mapa: MapData = createEmptyMap('map_raiz', 'Vale', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const torre = useAdventureStore.getState().createScene('Torre', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useMapStore.getState().addPin(viagem('a', { description: 'Encruzilhada' }))
  const chegadaCripta = useAdventureStore.getState().linkPinToNewArrival('a', cripta)
  const chegadaTorre = useAdventureStore.getState().linkPinToNewArrival('a', torre, null)
  if (chegadaCripta === null || chegadaTorre === null) throw new Error('não ligou')
  const saidaTorre = pinoAberto('a').saidas?.[0]?.id
  if (saidaTorre === undefined) throw new Error('"+ Outra saída" não criou a saída')
  return { vale, cripta, torre, chegadaCripta, chegadaTorre, saidaTorre }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('encruzilhada: mão dupla por saída', () => {
  it('"+ Outra saída" acrescenta a saída sem mexer na principal, e cada par volta para o mesmo pino', () => {
    const m = montar()
    const a = pinoAberto('a')
    expect(a.destino).toEqual({ sceneId: m.cripta, pinId: m.chegadaCripta })
    expect(a.saidas).toEqual([{ id: m.saidaTorre, rotulo: '', destino: { sceneId: m.torre, pinId: m.chegadaTorre } }])
    expect(m.saidaTorre).not.toBe(SAIDA_PRINCIPAL)
    // Os dois pares, cada um na sua cena de fundo, voltam para "a".
    expect(pinoDoFundo(m.cripta, m.chegadaCripta)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
    expect(pinoDoFundo(m.torre, m.chegadaTorre)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
    // O painel lê as duas ligadas, na ordem.
    expect(saidasDoPainel('a').map((s) => [s.id, s.travel.status, s.travel.status === 'ligado' ? s.travel.sceneName : null])).toEqual([
      [SAIDA_PRINCIPAL, 'ligado', 'Cripta'],
      [m.saidaTorre, 'ligado', 'Torre'],
    ])
  })

  it('desligar uma saída desliga SÓ o par dela', () => {
    const m = montar()
    useAdventureStore.getState().unlinkPin('a', m.saidaTorre)
    expect(pinoAberto('a').saidas).toBeUndefined()
    expect(pinoDoFundo(m.torre, m.chegadaTorre)?.destino).toBeNull()
    expect(pinoDoFundo(m.cripta, m.chegadaCripta)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
  })

  it('desligar a principal faz a outra saída subir para o lugar dela; o par dela continua ligado', () => {
    const m = montar()
    useAdventureStore.getState().renamePinExit('a', m.saidaTorre, 'Escada da torre')
    useAdventureStore.getState().unlinkPin('a', SAIDA_PRINCIPAL)
    const a = pinoAberto('a')
    expect(a.destino).toEqual({ sceneId: m.torre, pinId: m.chegadaTorre })
    expect(a.rotulo).toBe('Escada da torre')
    expect(a.saidas).toBeUndefined()
    expect(pinoDoFundo(m.cripta, m.chegadaCripta)?.destino).toBeNull()
    expect(pinoDoFundo(m.torre, m.chegadaTorre)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
  })

  it('apagar o pino desliga TODOS os pares; Ctrl+Z religa os dois', () => {
    const m = montar()
    useMapStore.getState().removePin('a')
    expect(pinoDoFundo(m.cripta, m.chegadaCripta)?.destino).toBeNull()
    expect(pinoDoFundo(m.torre, m.chegadaTorre)?.destino).toBeNull()
    useMapStore.getState().undo()
    expect(pinoDoFundo(m.cripta, m.chegadaCripta)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
    expect(pinoDoFundo(m.torre, m.chegadaTorre)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
  })

  it('apagar um par desliga só a saída dele; a encruzilhada continua acesa pela outra', () => {
    const m = montar()
    useAdventureStore.getState().switchScene(m.torre)
    useMapStore.getState().removePin(m.chegadaTorre)
    const a = pinoDoFundo(m.vale, 'a')
    expect(a?.saidas).toBeUndefined()
    expect(a?.destino).toEqual({ sceneId: m.cripta, pinId: m.chegadaCripta })
    useAdventureStore.getState().switchScene(m.vale)
    expect(unlinkedTravelPinIds(useAdventureStore.getState(), useMapStore.getState().map).has('a')).toBe(false)
  })

  it('o nome da saída entra no desfazer da cena aberta, e escrever o mesmo nome de novo não empilha nada', () => {
    const m = montar()
    useAdventureStore.getState().renamePinExit('a', m.saidaTorre, '  Escada da torre  ')
    expect(pinoAberto('a').saidas?.[0]?.rotulo).toBe('Escada da torre')
    const passos = useMapStore.getState().past.length
    useAdventureStore.getState().renamePinExit('a', m.saidaTorre, 'Escada da torre')
    expect(useMapStore.getState().past.length).toBe(passos)
    useAdventureStore.getState().renamePinExit('a', SAIDA_PRINCIPAL, 'Porta da cripta')
    expect(pinoAberto('a').rotulo).toBe('Porta da cripta')
    useMapStore.getState().undo()
    expect(pinoAberto('a').rotulo).toBeUndefined()
    // Renomear não mexe em ligação nenhuma.
    expect(pinoDoFundo(m.torre, m.chegadaTorre)?.destino).toEqual({ sceneId: m.vale, pinId: 'a' })
  })

  it('atravessar pela saída extra leva à cena DELA', () => {
    const m = montar()
    expect(useAdventureStore.getState().travelThroughPin('a', m.saidaTorre)).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe(m.torre)
    expect(useMapStore.getState().selectedPinId).toBe(m.chegadaTorre)
  })
})
