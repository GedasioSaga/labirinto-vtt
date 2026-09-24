/**
 * ESCADA QUE LEVA A OUTRO ANDAR no editor do mestre: "Leva a: 1º andar" na
 * escada do Térreo cria o pino invisível dela, a escada par ("desce") no 1º
 * andar com o pino dela, e liga os dois em mão dupla. Nenhum pino à vista em
 * nenhuma das duas cenas. Arrastar a escada leva a ligação; apagar desliga o par.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin, Stair } from '../types/map'

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

const { useAdventureStore, subscribeToTravelLinks, stairTravelOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { visiblePins } = await import('../lib/layers')
const { filterMapForPlayer } = await import('../lib/fogFilter')

// O guardião da mão dupla, ligado como o App liga.
subscribeToTravelLinks()

const ESCADA: Stair = { id: 'escada-terreo', shape: 'straight', direction: 'up', segments: [{ x1: 400, y1: 300, x2: 400, y2: 180 }], stepWidth: 64 }

function mapaDoFundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`cena ${sceneId} fora do cache`)
  return slot.map
}

function pinoDaEscada(map: MapData, stairId: string): Pin {
  const pin = map.pins.find((p) => p.escadaId === stairId)
  if (pin === undefined) throw new Error(`a escada ${stairId} não tem pino`)
  return pin
}

/** Térreo (aberto, com a escada) e 1º andar (de fundo). */
function montar(): { terreo: string; andar1: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Térreo', 30, 20, 64))
  useSessionStore.getState().markSaved()
  const andar1 = useAdventureStore.getState().createScene('1º andar', null)
  const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(terreo)
  useMapStore.getState().addStair(ESCADA)
  return { terreo, andar1 }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('escada: Leva a… outro andar', () => {
  it('livre: nenhum pino à vista, o 1º andar ganha a escada "desce", e as duas se ligam em mão dupla', () => {
    const m = montar()
    const parId = useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'livre')
    if (parId === null) throw new Error('não ligou')

    const aberto = useMapStore.getState().map
    expect(visiblePins(aberto.pins, aberto.hiddenLayers)).toEqual([])
    const daqui = pinoDaEscada(aberto, 'escada-terreo')
    expect(daqui).toMatchObject({ kind: 'viagem', passagem: 'livre', x: 400, y: 300 })

    const cima = mapaDoFundo(m.andar1)
    expect(visiblePins(cima.pins, cima.hiddenLayers)).toEqual([])
    const escadaDeCima = cima.stairs.find((s) => s.id === parId)
    expect(escadaDeCima?.direction).toBe('down')
    const deLa = pinoDaEscada(cima, parId)
    expect(deLa.passagem).toBe('livre')
    expect(daqui.destino).toEqual({ sceneId: m.andar1, pinId: deLa.id })
    expect(deLa.destino).toEqual({ sceneId: m.terreo, pinId: daqui.id })
    expect(useAdventureStore.getState().dirty[m.andar1]).toBe(true)

    // O painel da escada lê para onde ela leva.
    const travel = stairTravelOf(useAdventureStore.getState(), aberto, ESCADA)
    expect(travel.status === 'ligado' && travel.sceneName).toBe('1º andar')
  })

  it('arrastar a escada leva a ligação junto', () => {
    const m = montar()
    useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'livre')
    useMapStore.getState().moveStair('escada-terreo', 128, 64)
    const pin = pinoDaEscada(useMapStore.getState().map, 'escada-terreo')
    expect(pin).toMatchObject({ x: 528, y: 364 })
    expect(pin.destino?.sceneId).toBe(m.andar1)
    expect(stairTravelOf(useAdventureStore.getState(), useMapStore.getState().map, ESCADA).status).toBe('ligado')
  })

  it('o modo de passagem troca no pino da escada, com desfazer', () => {
    const m = montar()
    useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'pede')
    useAdventureStore.getState().setStairPassage('escada-terreo', 'trancada')
    expect(pinoDaEscada(useMapStore.getState().map, 'escada-terreo').passagem).toBe('trancada')
    useMapStore.getState().undo()
    expect(pinoDaEscada(useMapStore.getState().map, 'escada-terreo').passagem).toBe('pede')
  })

  it('"não leva a lugar nenhum" tira o pino daqui e desliga o de cima; a escada de cima fica', () => {
    const m = montar()
    const parId = useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'livre')
    if (parId === null) throw new Error('não ligou')
    useAdventureStore.getState().unlinkStair('escada-terreo')
    expect(useMapStore.getState().map.pins).toEqual([])
    const cima = mapaDoFundo(m.andar1)
    expect(cima.stairs.map((s) => s.id)).toEqual([parId])
    expect(pinoDaEscada(cima, parId).destino ?? null).toBeNull()
  })

  it('apagar a escada desliga o par do outro andar', () => {
    const m = montar()
    const parId = useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'livre')
    if (parId === null) throw new Error('não ligou')
    useMapStore.getState().removeStair('escada-terreo')
    expect(useMapStore.getState().map.pins).toEqual([])
    expect(pinoDaEscada(mapaDoFundo(m.andar1), parId).destino ?? null).toBeNull()
  })

  it('duplicar o andar: a escada copiada sai solta, sem pino órfão da escada antiga', () => {
    const m = montar()
    useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'livre')
    const copiaId = useAdventureStore.getState().duplicateScene(m.terreo)
    if (copiaId === null) throw new Error('não duplicou')
    const copia = mapaDoFundo(copiaId)
    expect(copia.stairs).toHaveLength(1)
    const escadaCopiada = copia.stairs[0]
    expect(escadaCopiada.id).not.toBe('escada-terreo')
    // Nenhum pino de escada sobra na cópia: nem com o id da escada antiga (órfão), nem solto sem destino.
    expect(copia.pins.filter((p) => p.escadaId !== undefined)).toEqual([])
    expect(copia.pins).toEqual([])
    // O original continua ligado.
    expect(stairTravelOf(useAdventureStore.getState(), useMapStore.getState().map, ESCADA).status).toBe('ligado')
  })

  it('não liga para a própria cena, nem escada que não existe', () => {
    const m = montar()
    expect(useAdventureStore.getState().linkStairToFloor('escada-terreo', m.terreo, 'livre')).toBeNull()
    expect(useAdventureStore.getState().linkStairToFloor('nao-existe', m.andar1, 'livre')).toBeNull()
    expect(useMapStore.getState().map.pins).toEqual([])
  })
})

/**
 * O que o jogador que está no 1º andar recebe da escada de lá: com a ligação
 * viva, o pino dela; depois que a de baixo deixa de levar lá (desligada,
 * apagada ou religada a outro andar), a escada continua desenhada, mas o pino
 * morto não sai — tocar nela não pode abrir "Descer por aqui?" para o host recusar.
 */
describe('escada: o outro andar nunca leva o jogador a lugar nenhum', () => {
  const POSSE = { p1: ['bruno'] }
  const RAIO = 300

  function recorteDeCima(andar1: string, parId: string): MapData {
    const cima = mapaDoFundo(andar1)
    const pino = pinoDaEscada(cima, parId)
    const bruno = { id: 'bruno', characterId: null, name: 'Bruno', x: pino.x, y: pino.y, size: 1, image: null }
    return filterMapForPlayer({ ...cima, tokens: [bruno] }, 'p1', POSSE, RAIO).map
  }

  function ligado(): { m: { terreo: string; andar1: string }; parId: string } {
    const m = montar()
    const parId = useAdventureStore.getState().linkStairToFloor('escada-terreo', m.andar1, 'livre')
    if (parId === null) throw new Error('não ligou')
    // Piso: com a ligação viva, o jogador lá em cima recebe o pino da escada.
    expect(recorteDeCima(m.andar1, parId).pins.map((p) => p.escadaId)).toEqual([parId])
    return { m, parId }
  }

  it('"Nenhum outro andar" embaixo: a escada de cima sai, o pino dela não', () => {
    const { m, parId } = ligado()
    useAdventureStore.getState().unlinkStair('escada-terreo')
    const view = recorteDeCima(m.andar1, parId)
    expect(view.stairs.map((s) => s.id)).toEqual([parId])
    expect(view.pins).toEqual([])
  })

  it('apagar a escada de baixo: o pino de cima não sai', () => {
    const { m, parId } = ligado()
    useMapStore.getState().removeStair('escada-terreo')
    expect(recorteDeCima(m.andar1, parId).pins).toEqual([])
  })

  it('religar a escada de baixo a outro andar: o pino do andar antigo não sai', () => {
    const { m, parId } = ligado()
    const porao = useAdventureStore.getState().createScene('Porão', null)
    useAdventureStore.getState().switchScene(m.terreo)
    const novoPar = useAdventureStore.getState().linkStairToFloor('escada-terreo', porao, 'livre')
    expect(novoPar).not.toBeNull()
    expect(stairTravelOf(useAdventureStore.getState(), useMapStore.getState().map, ESCADA).status).toBe('ligado')
    expect(recorteDeCima(m.andar1, parId).pins).toEqual([])
  })

  it('desfazer o "Nenhum outro andar" religa, e o jogador de cima volta a receber o pino', () => {
    const { m, parId } = ligado()
    useAdventureStore.getState().unlinkStair('escada-terreo')
    expect(recorteDeCima(m.andar1, parId).pins).toEqual([])
    useMapStore.getState().undo()
    expect(recorteDeCima(m.andar1, parId).pins.map((p) => p.escadaId)).toEqual([parId])
  })
})
