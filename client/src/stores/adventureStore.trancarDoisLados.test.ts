/**
 * TRANCAR OS DOIS LADOS: um toque no pino da cena aberta tranca ele e o PAR,
 * na cena de fundo — "cortar a corda" sem abrir a outra cena no meio de uma
 * perseguição. Numa encruzilhada, todos os pares. Destrancar devolve os dois
 * lados ao modo de sempre, "Pede ao mestre".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const { useAdventureStore, subscribeToTravelLinks, pinExitsTravelOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { passageOf } = await import('../lib/pins')
const { exitPassageOf, setExitPassage } = await import('../lib/pinTravel')
const { subscribeToPlayerWorldChanges } = await import('./playerWorldSubscription')

// O guardião da mão dupla, ligado como o App liga.
subscribeToTravelLinks()

function viagem(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
}

function pinoDoFundo(sceneId: string, pinId: string): Pin {
  const slot = useAdventureStore.getState().cache[sceneId]
  const pin = slot?.status === 'ok' ? slot.map.pins.find((p) => p.id === pinId) : undefined
  if (pin === undefined) throw new Error(`pino ${pinId} não está na cena de fundo ${sceneId}`)
  return pin
}

function pinoAberto(pinId: string): Pin {
  const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
  if (pin === undefined) throw new Error(`pino ${pinId} não está na cena aberta`)
  return pin
}

/** Vale com a porta "a" ligada a uma chegada nova na Cripta. Termina no Vale. */
function montar(extra: Partial<Pin> = {}): { vale: string; cripta: string; par: string } {
  useAdventureStore.getState().reset()
  const mapa: MapData = createEmptyMap('map_raiz', 'Vale', 30, 20, 64)
  useMapStore.getState().loadMap(mapa)
  useSessionStore.getState().markSaved()
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useMapStore.getState().addPin(viagem('a', { description: 'Poço', ...extra }))
  const par = useAdventureStore.getState().linkPinToNewArrival('a', cripta)
  if (par === null) throw new Error('não ligou')
  return { vale, cripta, par }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('trancar os dois lados', () => {
  it('trancar põe "trancada" neste pino e no par da cena de fundo, que fica suja para gravar', () => {
    const m = montar()
    expect(passageOf(pinoDoFundo(m.cripta, m.par))).toBe('pede')
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(pinoAberto('a').passagem).toBe('trancada')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('trancada')
    expect(useAdventureStore.getState().dirty[m.cripta]).toBe(true)
    // A cena aberta continua a mesma: o mestre não saiu de onde estava.
    expect(useAdventureStore.getState().activeSceneId).toBe(m.vale)
    // A ligação fica como estava, nos dois lados.
    expect(pinoAberto('a').destino).toEqual({ sceneId: m.cripta, pinId: m.par })
    expect(pinoDoFundo(m.cripta, m.par).destino).toEqual({ sceneId: m.vale, pinId: 'a' })
  })

  it('o motivo deste lado vai junto para o par ("Desabou" nos dois)', () => {
    const m = montar({ motivo: 'desabou' })
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(pinoDoFundo(m.cripta, m.par).motivo).toBe('desabou')
    expect(pinoAberto('a').motivo).toBe('desabou')
  })

  it('destrancar devolve os dois lados a "Pede ao mestre"', () => {
    const m = montar()
    useAdventureStore.getState().setPassageBothSides('a', true)
    expect(useAdventureStore.getState().setPassageBothSides('a', false)).toBe(true)
    expect(pinoAberto('a').passagem).toBe('pede')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('pede')
  })

  it('encruzilhada: tranca todos os pares, cada um na sua cena', () => {
    const m = montar()
    const poco = useAdventureStore.getState().createScene('Poço', null)
    useAdventureStore.getState().switchScene(m.vale)
    const par2 = useAdventureStore.getState().linkPinToNewArrival('a', poco, null)
    if (par2 === null) throw new Error('segunda saída não ligou')
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(pinoAberto('a').passagem).toBe('trancada')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('trancada')
    expect(pinoDoFundo(poco, par2).passagem).toBe('trancada')
  })

  it('pino sem destino: não há outro lado, nada muda', () => {
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('map_solto', 'Solto', 10, 10, 64))
    useMapStore.getState().addPin(viagem('s'))
    expect(useAdventureStore.getState().setPassageBothSides('s', true)).toBe(false)
    expect(pinoAberto('s').passagem).toBeUndefined()
  })

  it('este lado já trancado e o par aberto: tranca o par e avisa os jogadores', () => {
    const m = montar()
    useMapStore.getState().updatePin('a', { passagem: 'trancada' })
    expect(passageOf(pinoDoFundo(m.cripta, m.par))).toBe('pede')
    // O App liga o envio aos jogadores nesta assinatura (`notifyMapChanged`).
    const avisar = vi.fn()
    const parar = subscribeToPlayerWorldChanges(avisar)
    try {
      expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    } finally {
      parar()
    }
    expect(pinoAberto('a').passagem).toBe('trancada')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('trancada')
    expect(avisar).toHaveBeenCalled()
  })

  it('a assinatura dos jogadores para de avisar depois de desligada', () => {
    const m = montar()
    const avisar = vi.fn()
    subscribeToPlayerWorldChanges(avisar)()
    useAdventureStore.getState().setPassageBothSides('a', true)
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('trancada')
    expect(avisar).not.toHaveBeenCalled()
  })

  it('pino que não existe: false', () => {
    montar()
    expect(useAdventureStore.getState().setPassageBothSides('nao-existe', true)).toBe(false)
  })
})

/**
 * MODO POR SAÍDA: a encruzilhada pode ter uma extra "Livre" ou "Trancada" por
 * conta própria. O botão vale para o pino INTEIRO — nenhuma saída fica
 * abrindo com "Destrancar os dois lados" à vista, nem trancada depois de o
 * texto dizer que tudo "volta a pedir a você".
 */
describe('trancar os dois lados com modo por saída', () => {
  /** O Vale com a porta "a" (principal na Cripta) e a extra "Escada" no Poço. */
  function encruzilhada(): { vale: string; cripta: string; par: string; poco: string; par2: string; escada: string } {
    const m = montar()
    const poco = useAdventureStore.getState().createScene('Poço', null)
    useAdventureStore.getState().switchScene(m.vale)
    const par2 = useAdventureStore.getState().linkPinToNewArrival('a', poco, null)
    if (par2 === null) throw new Error('segunda saída não ligou')
    const escada = pinoAberto('a').saidas?.[0]?.id
    if (escada === undefined) throw new Error('a extra não nasceu')
    return { ...m, poco, par2, escada }
  }

  function modoDaExtra(pinId: string, exitId: string, passagem: 'livre' | 'pede' | 'trancada'): void {
    useMapStore.getState().updatePin(pinId, setExitPassage(pinoAberto(pinId), exitId, passagem))
  }

  it('trancar: a extra "Livre" deste pino passa a ficar trancada', () => {
    const m = encruzilhada()
    modoDaExtra('a', m.escada, 'livre')
    expect(exitPassageOf(pinoAberto('a'), m.escada)).toBe('livre')
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(exitPassageOf(pinoAberto('a'), 'principal')).toBe('trancada')
    expect(exitPassageOf(pinoAberto('a'), m.escada)).toBe('trancada')
    // O modo próprio sai: a extra volta a seguir a principal.
    expect(pinoAberto('a').saidas?.[0]?.passagem).toBeUndefined()
    expect(pinoDoFundo(m.poco, m.par2).passagem).toBe('trancada')
  })

  it('destrancar: a extra "Trancada" por conta própria volta a pedir', () => {
    const m = encruzilhada()
    useAdventureStore.getState().setPassageBothSides('a', true)
    modoDaExtra('a', m.escada, 'trancada')
    expect(useAdventureStore.getState().setPassageBothSides('a', false)).toBe(true)
    expect(exitPassageOf(pinoAberto('a'), 'principal')).toBe('pede')
    expect(exitPassageOf(pinoAberto('a'), m.escada)).toBe('pede')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('pede')
  })

  it('pino sem extras: trancar não inventa "saidas"', () => {
    montar()
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(pinoAberto('a').passagem).toBe('trancada')
    expect(pinoAberto('a').saidas).toBeUndefined()
  })

  it('o par que volta por uma extra "Livre": trancar tranca a volta, e o painel lê isso', () => {
    const m = montar()
    // O par na Cripta também é encruzilhada: a principal já trancada, e a
    // volta ao Vale pela "Escada" livre por conta própria.
    useAdventureStore.getState().updateBackgroundScene(m.cripta, (map) => ({
      ...map,
      pins: map.pins.map((p) =>
        p.id === m.par ? { ...p, passagem: 'trancada' as const, saidas: [{ id: 'volta', rotulo: 'Escada', destino: { sceneId: m.vale, pinId: 'a' }, passagem: 'livre' as const }] } : p,
      ),
    }))
    const painel = () => pinExitsTravelOf(useAdventureStore.getState(), useMapStore.getState().map, pinoAberto('a'))
    expect(painel()[0]?.modoDaVolta).toBe('livre')
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(exitPassageOf(pinoDoFundo(m.cripta, m.par), 'volta')).toBe('trancada')
    expect(painel()[0]?.modoDaVolta).toBe('trancada')
  })

  it('a extra do par que leva a OUTRO lugar guarda o modo dela', () => {
    const m = montar()
    useAdventureStore.getState().updateBackgroundScene(m.cripta, (map) => ({
      ...map,
      pins: map.pins.map((p) =>
        p.id === m.par ? { ...p, saidas: [{ id: 'fora', rotulo: 'Túnel', destino: { sceneId: 'longe', pinId: 'z' }, passagem: 'livre' as const }] } : p,
      ),
    }))
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('trancada')
    expect(exitPassageOf(pinoDoFundo(m.cripta, m.par), 'fora')).toBe('livre')
  })

  /**
   * O par volta só por uma EXTRA: a principal dele leva a outro lugar (o
   * Túnel desabado, trancado de propósito). O botão mexe só na volta.
   */
  function parQueVoltaPorExtra(): { vale: string; cripta: string; par: string } {
    const m = montar({ motivo: 'alagada' })
    useAdventureStore.getState().updateBackgroundScene(m.cripta, (map) => ({
      ...map,
      pins: map.pins.map((p) =>
        p.id === m.par
          ? {
              ...p,
              destino: { sceneId: 'longe', pinId: 'z' },
              passagem: 'trancada' as const,
              motivo: 'desabou' as const,
              saidas: [{ id: 'volta', rotulo: 'Volta', destino: { sceneId: m.vale, pinId: 'a' } }],
            }
          : p,
      ),
    }))
    return m
  }

  it('destrancar com a volta do par numa extra: a principal dele, trancada para outro lugar, continua trancada', () => {
    const m = parQueVoltaPorExtra()
    expect(useAdventureStore.getState().setPassageBothSides('a', false)).toBe(true)
    expect(exitPassageOf(pinoDoFundo(m.cripta, m.par), 'volta')).toBe('pede')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('trancada')
    expect(pinoDoFundo(m.cripta, m.par).motivo).toBe('desabou')
  })

  it('trancar com a volta do par numa extra: tranca a volta e não troca o motivo da principal dele', () => {
    const m = parQueVoltaPorExtra()
    useAdventureStore.getState().updateBackgroundScene(m.cripta, (map) => ({
      ...map,
      pins: map.pins.map((p) => (p.id === m.par ? { ...p, passagem: 'livre' as const } : p)),
    }))
    expect(useAdventureStore.getState().setPassageBothSides('a', true)).toBe(true)
    expect(exitPassageOf(pinoDoFundo(m.cripta, m.par), 'volta')).toBe('trancada')
    expect(pinoDoFundo(m.cripta, m.par).passagem).toBe('livre')
    expect(pinoDoFundo(m.cripta, m.par).motivo).toBe('desabou')
  })
})
