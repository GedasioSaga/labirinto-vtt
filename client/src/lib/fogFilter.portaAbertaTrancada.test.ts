import { describe, expect, it } from 'vitest'
import type { DoorState, FloorPiece, MapData, Region, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, type PlanMemory, type PlayerMapView } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PORTA ABERTA E TRANCADA no recorte do jogador. Ela não deveria existir
 * (`closeIfLocked` fecha a porta ao trancar e ao carregar mapa antigo), mas o
 * recorte não confia nisso: a lembrança do host (`seenDoors`) guarda a porta
 * vista inteira, do mapa do mestre. O host a trata como FECHADA
 * (`isDoorPassable`: não passa ninguém nem a visão), então o jogador a recebe
 * fechada — sem cadeado e sem chave, como toda porta — em cada caminho por
 * onde uma porta sai: à vista, lembrada, apagada pelo mestre mas lembrada, e
 * vista pela espiada. Os outros dois casos saem como sempre saíram.
 */

const CHAVE = 'chave-do-porao'
const ABERTA_TRANCADA: DoorState = { open: true, locked: true, kind: 'normal', abreCom: CHAVE }
const FECHADA_TRANCADA: DoorState = { open: false, locked: true, kind: 'normal', abreCom: CHAVE }
const ABERTA: DoorState = { open: true, locked: false, kind: 'normal' }
const FECHADA_PARA_O_JOGADOR: DoorState = { open: false, locked: false, kind: 'normal' }

/** Porta no mapa do mestre e como o jogador tem de recebê-la, em todo caminho. */
const CASOS: [string, DoorState, DoorState][] = [
  ['aberta e trancada sai fechada, sem cadeado e sem chave', ABERTA_TRANCADA, FECHADA_PARA_O_JOGADOR],
  ['fechada e trancada sai fechada, sem cadeado e sem chave', FECHADA_TRANCADA, FECHADA_PARA_O_JOGADOR],
  ['aberta e destrancada continua aberta', ABERTA, ABERTA],
]

function ficha(id: string, at: { x: number; y: number }): Token {
  return { id, characterId: null, name: `nome-${id}`, x: at.x, y: at.y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function portasDe(view: PlayerMapView, id: string): (DoorState | null)[] {
  return view.map.walls.filter((w) => w.id === id).map((w) => w.door)
}

/** Portas que um olho vê agora. A vista pela espiada não entra: separa os dois caminhos da porta à vista. */
function portasDosOlhos(view: PlayerMapView): string[] {
  return view.eyes.flatMap((eye) => eye.doorIds)
}

// --- À vista, lembrada e apagada: salão aberto, sem teto -------------------

/**
 * Salão de 1000 x 1000 px, raio 300: de PERTO a porta fica 120 px ao sul, à
 * vista; de LONGE ela fica explorada e fora da visão.
 */
const RAIO_NO_SALAO = 300
const OWN = { p1: ['heroi'] }
const PERTO = { x: 200, y: 200 }
const LONGE = { x: 800, y: 800 }

function salao(heroi: { x: number; y: number }, porta: DoorState | null): MapData {
  const walls = porta === null ? [] : [parede('porta', 150, 320, 250, 320, { door: { ...porta } })]
  return { ...createEmptyMap('m', 'M', 25, 25, 40), tokens: [ficha('heroi', heroi)], walls }
}

/** Um jogador com memória, como o host guarda: explorado, portas vistas (inteiras, do mapa do mestre) e planta lembrada. */
function jogador(): (map: MapData) => PlayerMapView {
  const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
  const doors = new Map<string, DoorState>()
  let memory: PlanMemory = emptyPlanMemory()
  return (map) => {
    const view = filterMapForPlayer(map, 'p1', OWN, RAIO_NO_SALAO, exp, doors, undefined, undefined, undefined, undefined, undefined, undefined, undefined, memory)
    markRings(exp, view.vision, view.blocked)
    memory = view.plan
    for (const w of map.walls) {
      if (w.door !== null && view.visibleDoorIds.includes(w.id)) doors.set(w.id, { ...w.door })
    }
    return view
  }
}

// --- Espiada: prédio de teto fechado com a porta da rua aberta --------------

/**
 * Casa 200..600 com teto; porta da rua ABERTA em x 380..420 no muro sul
 * (y = 600) e o herói no vão, 30 px ao sul dela: ele espia (`view.peek`), e o
 * cone chega à divisória (y = 400) entre x ~247 e ~553. A porta de dentro fica
 * na divisória, de x = 440 a 580: o meio (510) está no cone, a ponta leste
 * não. Assim só a espiada a leva — o cone pelo vão só leva porta que caiba
 * inteira nele. O chão da casa avança 10 px sob a rua: peças só encostadas
 * deixam costura no contorno do chão, e a costura segura a visão como parede.
 */
const RAIO_NA_CASA = 700
const NO_VAO = { x: 400, y: 630 }
const CASA: Region['points'] = [
  { x: 200, y: 200 },
  { x: 600, y: 200 },
  { x: 600, y: 600 },
  { x: 200, y: 600 },
]
const SALA_DA_FRENTE: Region['points'] = [
  { x: 200, y: 400 },
  { x: 600, y: 400 },
  { x: 600, y: 600 },
  { x: 200, y: 600 },
]
const QUARTO_DOS_FUNDOS: Region['points'] = [
  { x: 200, y: 200 },
  { x: 600, y: 200 },
  { x: 600, y: 400 },
  { x: 200, y: 400 },
]

function sala(id: string, points: Region['points'], extra: Partial<Region> = {}, roof?: boolean): Region {
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}`, roof }, ...extra }
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function casaComPortaInterna(porta: DoorState): MapData {
  return {
    ...createEmptyMap('m-vila', 'Vila', 25, 25, 40),
    regions: [
      sala('casa', CASA, {}, true),
      sala('sala-da-frente', SALA_DA_FRENTE, { parentId: 'casa' }),
      sala('quarto-dos-fundos', QUARTO_DOS_FUNDOS, { parentId: 'casa' }),
    ],
    walls: [
      parede('muro-norte', 200, 200, 600, 200, { regionId: 'casa' }),
      parede('muro-oeste', 200, 200, 200, 600, { regionId: 'casa' }),
      parede('muro-leste', 600, 200, 600, 600, { regionId: 'casa' }),
      parede('muro-sul-a', 200, 600, 380, 600, { regionId: 'casa' }),
      parede('porta-da-casa', 380, 600, 420, 600, { door: { ...ABERTA } }),
      parede('muro-sul-b', 420, 600, 600, 600, { regionId: 'casa' }),
      parede('divisoria-a', 200, 400, 440, 400, { regionId: 'sala-da-frente' }),
      parede('porta-interna', 440, 400, 580, 400, { regionId: 'sala-da-frente', door: { ...porta } }),
      parede('divisoria-b', 580, 400, 600, 400, { regionId: 'sala-da-frente' }),
    ],
    floor: [chao('chao-rua', 500, 800, 1000, 400), chao('chao-casa', 400, 405, 400, 410)],
    tokens: [ficha('heroi', NO_VAO)],
  }
}

describe('filterMapForPlayer: porta aberta e trancada sai fechada em todo caminho', () => {
  it.each(CASOS)('à vista: %s', (_caso, porta, esperada) => {
    const view = jogador()(salao(PERTO, porta))

    expect(view.visibleDoorIds).toEqual(['porta'])
    expect(portasDosOlhos(view)).toEqual(['porta'])
    expect(portasDe(view, 'porta')).toEqual([esperada])
    expect(JSON.stringify(view.map)).not.toContain(CHAVE)
  })

  it.each(CASOS)('lembrada, fora da visão: %s', (_caso, porta, esperada) => {
    const ver = jogador()
    ver(salao(PERTO, porta))
    const view = ver(salao(LONGE, porta))

    expect(view.visibleDoorIds).toEqual([])
    expect(portasDe(view, 'porta')).toEqual([esperada])
    expect(JSON.stringify(view.map)).not.toContain(CHAVE)
  })

  it.each(CASOS)('apagada pelo mestre e ainda lembrada: %s', (_caso, porta, esperada) => {
    const ver = jogador()
    ver(salao(PERTO, porta))
    ver(salao(LONGE, porta))
    const view = ver(salao(LONGE, null))

    expect(portasDe(view, 'porta')).toEqual([esperada])
    expect(JSON.stringify(view.map)).not.toContain(CHAVE)
  })

  it.each(CASOS)('vista pela espiada, dentro do prédio: %s', (_caso, porta, esperada) => {
    const view = filterMapForPlayer(casaComPortaInterna(porta), 'p1', OWN, RAIO_NA_CASA)

    expect(view.peek).not.toBeNull()
    expect(view.visibleDoorIds).toContain('porta-interna')
    expect(portasDosOlhos(view)).not.toContain('porta-interna')
    expect(portasDe(view, 'porta-interna')).toEqual([esperada])
    expect(JSON.stringify(view.map)).not.toContain(CHAVE)
  })
})
