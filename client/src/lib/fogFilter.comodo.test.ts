import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, RoomMeta, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * CÔMODO LEMBRADO, lado do RECORTE. A pergunta é sempre o que o jogador
 * RECEBE (`JSON.stringify` do pacote), nunca o que a tela pinta.
 *
 * Planta (px de mundo, 25 x 25 casas de 40 px):
 *   sala      100..400 x 100..400 — o Bruno em (250, 250);
 *   corredor  400..800 x 100..400 — porta na parede comum x = 400, y 230..270;
 *   quarto    100..400 x 400..700 — porta na parede comum y = 400, x 230..270.
 * O armário do corredor mora no canto (450, 130): pela porta aberta o Bruno
 * enxerga o meio do corredor, mas NÃO esse canto. É o que separa "vê o que a
 * linha de visão alcança" (hoje) de "viu o cômodo, conhece o cômodo" (Cômodo).
 */
const SALA: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
const CORREDOR: Region['points'] = [
  { x: 400, y: 100 },
  { x: 800, y: 100 },
  { x: 800, y: 400 },
  { x: 400, y: 400 },
]
const QUARTO: Region['points'] = [
  { x: 100, y: 400 },
  { x: 400, y: 400 },
  { x: 400, y: 700 },
  { x: 100, y: 700 },
]
const NA_SALA = { x: 250, y: 250 }
const NO_CORREDOR = { x: 600, y: 250 }
const RADIUS = 700
const OWNERSHIP = { bruno: ['ficha-bruno'], ana: ['ficha-ana'] }

type Modo = 'comodo' | 'teto' | 'nenhum'

function sala(id: string, points: Region['points'], modo: Modo): Region {
  const room: RoomMeta = { shape: 'rect', name: `nome-${id}` }
  if (modo === 'comodo') room.comodo = true
  if (modo === 'teto') room.roof = true
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function porta(id: string, x1: number, y1: number, x2: number, y2: number, open: boolean): Wall {
  return parede(id, x1, y1, x2, y2, { open, locked: false, kind: 'normal' })
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, kind: 'exclamacao', x, y, description: `descricao-${id}`, image: null, ...extra }
}

function ficha(id: string, at: { x: number; y: number }): Token {
  return { id, characterId: null, name: `nome-${id}`, x: at.x, y: at.y, size: 1, image: null }
}

interface Casa {
  modo?: Modo
  bruno?: { x: number; y: number }
  portaDoCorredor?: boolean
  extra?: Partial<MapData>
}

function casa({ modo = 'comodo', bruno = NA_SALA, portaDoCorredor = false, extra = {} }: Casa = {}): MapData {
  return {
    ...createEmptyMap('m-casa', 'Casa do prefeito', 25, 25, 40),
    regions: [sala('sala', SALA, modo), sala('corredor', CORREDOR, modo), sala('quarto', QUARTO, modo)],
    walls: [
      parede('sala-n', 100, 100, 400, 100),
      parede('sala-o', 100, 100, 100, 400),
      parede('comum-1', 400, 100, 400, 230),
      porta('porta-corredor', 400, 230, 400, 270, portaDoCorredor),
      parede('comum-2', 400, 270, 400, 400),
      parede('corredor-n', 400, 100, 800, 100),
      parede('corredor-l', 800, 100, 800, 400),
      parede('corredor-s', 400, 400, 800, 400),
      parede('quarto-comum-1', 100, 400, 230, 400),
      porta('porta-quarto', 230, 400, 270, 400, false),
      parede('quarto-comum-2', 270, 400, 400, 400),
      parede('quarto-o', 100, 400, 100, 700),
      parede('quarto-s', 100, 700, 400, 700),
      parede('quarto-l', 400, 400, 400, 700),
    ],
    pins: [
      pino('pino-da-sala', 130, 130),
      pino('armario-do-corredor', 450, 130),
      pino('bau', 150, 450),
      pino('cama', 350, 650),
      pino('carta', 200, 600),
      pino('pino-secreto-do-quarto', 300, 500, { secret: true }),
    ],
    tokens: [ficha('ficha-bruno', bruno), ficha('ficha-ana', { x: 250, y: 550 })],
    ...extra,
  }
}

const ids = (list: readonly { id: string }[]): string[] => list.map((i) => i.id).sort()

describe('filterMapForPlayer — cômodo lembrado', () => {
  it('Bruno na sala não recebe silhueta nem nada dos outros cômodos (com o teto recebia as silhuetas)', () => {
    const comTeto = filterMapForPlayer(casa({ modo: 'teto' }), 'bruno', OWNERSHIP, RADIUS).map
    // O defeito de hoje: cada cômodo de teto sai como silhueta assim que o
    // contorno dele encosta na visão de quem está na sala ao lado.
    expect(ids(comTeto.regions)).toEqual(['corredor', 'quarto', 'sala'])

    const out = filterMapForPlayer(casa(), 'bruno', OWNERSHIP, RADIUS).map
    expect(ids(out.regions)).toEqual(['sala'])
    const json = JSON.stringify(out)
    for (const escondido of ['nome-corredor', 'nome-quarto', 'armario-do-corredor', 'bau', 'cama', 'carta', 'ficha-ana']) {
      expect(json).not.toContain(escondido)
    }
  })

  it('abre a porta e vê o corredor: o cômodo inteiro chega, inclusive o canto que a porta não mostra', () => {
    const view = filterMapForPlayer(casa({ portaDoCorredor: true }), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['corredor', 'sala'])
    expect(view.map.regions.find((r) => r.id === 'corredor')?.room?.name).toBe('nome-corredor')
    expect(ids(view.map.pins)).toEqual(['armario-do-corredor', 'pino-da-sala'])
    // Quem chama guarda: a sala (onde ele está) e o corredor (visto pela porta).
    expect(view.rememberedRooms.map((r) => r.id).sort()).toEqual(['corredor', 'sala'])
    expect(view.rememberedRooms.find((r) => r.id === 'corredor')?.points).toEqual(CORREDOR)
    // O quarto, de porta fechada, continua não visto (ficou fora do pacote), mas
    // é VIZINHO de parede, não está dentro de um lembrado: não trava a marcação.
    expect(JSON.stringify(view.map)).not.toContain('nome-quarto')
    expect(view.unseenInsideRemembered).toEqual([])
  })

  it('sai e a sala fica lembrada: do corredor, de porta fechada, a sala e o pino dela continuam no pacote', () => {
    const semLembranca = filterMapForPlayer(casa({ bruno: NO_CORREDOR }), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(semLembranca.map.regions)).toEqual(['corredor'])

    const view = filterMapForPlayer(casa({ bruno: NO_CORREDOR }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, new Set(['sala']))
    expect(ids(view.map.regions)).toEqual(['corredor', 'sala'])
    expect(ids(view.map.pins)).toEqual(['armario-do-corredor', 'pino-da-sala'])
    expect(view.rememberedRooms.map((r) => r.id).sort()).toEqual(['corredor', 'sala'])
  })

  it('quarto lido fica com baú, cama e carta tocáveis, sem ficha alheia e sem o pino secreto', () => {
    const view = filterMapForPlayer(casa(), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, new Set(['quarto']))
    expect(ids(view.map.regions)).toEqual(['quarto', 'sala'])
    const pinos = view.map.pins.filter((p) => ['bau', 'cama', 'carta'].includes(p.id))
    expect(ids(pinos)).toEqual(['bau', 'cama', 'carta'])
    expect(pinos.find((p) => p.id === 'carta')?.description).toBe('descricao-carta')
    // Ficha é coisa que anda: lembrar do quarto não é espiar quem está nele agora.
    expect(ids(view.map.tokens)).toEqual(['ficha-bruno'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('ficha-ana')
    expect(json).not.toContain('pino-secreto-do-quarto')
    // A porta do quarto, lembrada sem ter sido vista aberta, sai fechada.
    expect(view.map.walls.find((w) => w.id === 'porta-quarto')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    // O modo é configuração do mestre: não atravessa.
    expect(json).not.toContain('comodo')
  })

  it('o que a zona oculta cobre dentro do cômodo lembrado continua fora', () => {
    const zona = {
      id: 'zona-da-cama',
      name: 'nome-da-zona',
      revealed: false,
      points: [
        { x: 320, y: 620 },
        { x: 390, y: 620 },
        { x: 390, y: 690 },
        { x: 320, y: 690 },
      ],
    }
    const view = filterMapForPlayer(casa({ extra: { concealZones: [zona] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, new Set(['quarto']))
    expect(ids(view.map.pins).filter((id) => ['bau', 'cama', 'carta'].includes(id))).toEqual(['bau', 'carta'])
    expect(JSON.stringify(view.map)).not.toContain('descricao-cama')
  })

  it('SEGURANÇA: zona oculta ativa cobrindo o cômodo lembrado inteiro leva o polígono junto, como numa Sala comum', () => {
    const zona = (revealed: boolean) => ({
      id: 'zona-do-quarto',
      name: 'nome-da-zona',
      revealed,
      points: [
        { x: 90, y: 390 },
        { x: 410, y: 390 },
        { x: 410, y: 710 },
        { x: 90, y: 710 },
      ],
    })
    const lembrado = new Set(['quarto'])
    // A régua: a mesma planta com Sala comum não manda o quarto escondido.
    const comum = filterMapForPlayer(casa({ modo: 'nenhum', extra: { concealZones: [zona(false)] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, lembrado)
    expect(ids(comum.map.regions)).toEqual(['sala'])

    const view = filterMapForPlayer(casa({ extra: { concealZones: [zona(false)] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, lembrado)
    expect(ids(view.map.regions)).toEqual(['sala'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('"quarto"')
    expect(json).not.toContain('{"x":100,"y":700}')
    // Nem vira "lembrado de novo" enquanto a zona esconde: o quem chama só soma.
    expect(view.rememberedRooms.map((r) => r.id)).toEqual(['sala'])

    // O mestre revela a zona: a lembrança antiga volta, com o polígono inteiro.
    const revelada = filterMapForPlayer(casa({ extra: { concealZones: [zona(true)] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, lembrado)
    expect(ids(revelada.map.regions)).toEqual(['quarto', 'sala'])
    expect(revelada.map.regions.find((r) => r.id === 'quarto')?.points).toEqual(QUARTO)
  })

  it('SEGURANÇA: cômodo lembrado DENTRO de prédio de teto fechado não vaza nada para quem está fora', () => {
    const predio: Region = {
      id: 'predio',
      points: [
        { x: 50, y: 50 },
        { x: 850, y: 50 },
        { x: 850, y: 750 },
        { x: 50, y: 750 },
      ],
      tag: '',
      fillColor: '#321',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'nome-predio', roof: true },
    }
    const map = casa({ bruno: { x: 900, y: 900 } })
    const comPredio: MapData = { ...map, regions: [predio, ...map.regions] }
    const view = filterMapForPlayer(comPredio, 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, new Set(['sala', 'corredor', 'quarto']))
    expect(ids(view.map.regions)).toEqual(['predio'])
    expect(view.rememberedRooms).toEqual([])
    const json = JSON.stringify(view.map)
    for (const escondido of ['nome-sala', 'nome-quarto', 'bau', 'cama', 'carta', 'pino-da-sala', 'ficha-ana']) {
      expect(json).not.toContain(escondido)
    }
  })

  it('teto ligado vence o Cômodo: a sala com os dois se comporta como teto de prédio', () => {
    const map = casa()
    const comOsDois: MapData = {
      ...map,
      regions: map.regions.map((r) => (r.id === 'corredor' && r.room ? { ...r, room: { ...r.room, roof: true } } : r)),
    }
    const view = filterMapForPlayer(comOsDois, 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, new Set(['corredor']))
    const corredor = view.map.regions.find((r) => r.id === 'corredor')
    expect(corredor?.room?.roof).toBe(true)
    expect(view.rememberedRooms.map((r) => r.id)).toEqual(['sala'])
    expect(JSON.stringify(view.map)).not.toContain('armario-do-corredor')
  })

  it('modo desligado = hoje: pela porta aberta só chega o que a linha de visão alcança, e nada é lembrado', () => {
    const view = filterMapForPlayer(casa({ modo: 'nenhum', portaDoCorredor: true }), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['corredor', 'sala'])
    expect(ids(view.map.pins)).toEqual(['pino-da-sala'])
    expect(view.rememberedRooms).toEqual([])
    expect(view.unseenInsideRemembered).toEqual([])
  })
})
