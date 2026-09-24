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

    const view = filterMapForPlayer(casa({ bruno: NO_CORREDOR }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['sala']))
    expect(ids(view.map.regions)).toEqual(['corredor', 'sala'])
    expect(ids(view.map.pins)).toEqual(['armario-do-corredor', 'pino-da-sala'])
    expect(view.rememberedRooms.map((r) => r.id).sort()).toEqual(['corredor', 'sala'])
  })

  it('quarto lido fica com baú, cama e carta tocáveis, sem ficha alheia e sem o pino secreto', () => {
    const view = filterMapForPlayer(casa(), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['quarto']))
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
    const view = filterMapForPlayer(casa({ extra: { concealZones: [zona] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['quarto']))
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
    const comum = filterMapForPlayer(casa({ modo: 'nenhum', extra: { concealZones: [zona(false)] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembrado)
    expect(ids(comum.map.regions)).toEqual(['sala'])

    const view = filterMapForPlayer(casa({ extra: { concealZones: [zona(false)] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembrado)
    expect(ids(view.map.regions)).toEqual(['sala'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('"quarto"')
    expect(json).not.toContain('{"x":100,"y":700}')
    // Nem vira "lembrado de novo" enquanto a zona esconde: o quem chama só soma.
    expect(view.rememberedRooms.map((r) => r.id)).toEqual(['sala'])

    // O mestre revela a zona: a lembrança antiga volta, com o polígono inteiro.
    const revelada = filterMapForPlayer(casa({ extra: { concealZones: [zona(true)] } }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembrado)
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
    const view = filterMapForPlayer(comPredio, 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['sala', 'corredor', 'quarto']))
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
    const view = filterMapForPlayer(comOsDois, 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['corredor']))
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
  it('SEGURANÇA: porta solta dentro de sala secreta, dentro de cômodo lembrado, não vai para o jogador', () => {
    const segredo: Region = {
      id: 'segredo',
      points: [
        { x: 300, y: 600 },
        { x: 390, y: 600 },
        { x: 390, y: 690 },
        { x: 300, y: 690 },
      ],
      tag: '',
      fillColor: '#321',
      fillPattern: 'solid',
      data: {},
      secret: true,
      room: { shape: 'rect', name: 'nome-segredo' },
    }
    // Porta sem regionId: não é parede vinculada à sala, só mora dentro dela.
    const divisoria = porta('divisoria-porta-secreta', 320, 645, 370, 645, false)
    const planta = (modo: Modo): MapData => {
      const map = casa({ modo, bruno: { x: 900, y: 900 } })
      return { ...map, regions: [...map.regions, segredo], walls: [...map.walls, divisoria] }
    }
    const lembrado = new Set(['quarto'])
    // A régua: com Sala comum a porta da sala secreta nunca saiu.
    const comum = filterMapForPlayer(planta('nenhum'), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembrado)
    expect(ids(comum.map.walls)).toContain('quarto-s')
    expect(ids(comum.map.walls)).not.toContain('divisoria-porta-secreta')

    const view = filterMapForPlayer(planta('comodo'), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembrado)
    // O quarto lembrado continua chegando, com a porta dele...
    expect(ids(view.map.regions)).toEqual(['quarto'])
    expect(ids(view.map.walls)).toContain('porta-quarto')
    // ...mas nada da sala secreta: nem a porta, nem o nome.
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('divisoria-porta-secreta')
    expect(json).not.toContain('nome-segredo')
  })
})

/**
 * PRÉDIO DE TETO DENTRO DE CÔMODO LEMBRADO. Pátio 100..800 x 100..500; a casa
 * (teto) 400..700 x 200..450, porta da frente aberta na parede oeste; dentro
 * dela, atrás da divisória x = 550 com porta FECHADA, o quarto (Sala comum)
 * 550..700 com o pino em (650, 400). O Bruno entra na casa (450, 400): o teto
 * abre, mas o quarto continua fora da visão dele.
 */
const PATIO: Region['points'] = [
  { x: 100, y: 100 },
  { x: 800, y: 100 },
  { x: 800, y: 500 },
  { x: 100, y: 500 },
]
const CASA_DE_TETO: Region['points'] = [
  { x: 400, y: 200 },
  { x: 700, y: 200 },
  { x: 700, y: 450 },
  { x: 400, y: 450 },
]
const QUARTO_DA_CASA: Region['points'] = [
  { x: 550, y: 200 },
  { x: 700, y: 200 },
  { x: 700, y: 450 },
  { x: 550, y: 450 },
]
const DENTRO_DA_CASA = { x: 450, y: 400 }

function patioComCasa(patio: Modo, quarto: Modo = 'nenhum'): MapData {
  return {
    ...createEmptyMap('m-patio', 'Patio do prefeito', 25, 25, 40),
    regions: [sala('patio', PATIO, patio), sala('casa', CASA_DE_TETO, 'teto'), sala('quarto', QUARTO_DA_CASA, quarto)],
    walls: [
      parede('patio-n', 100, 100, 800, 100),
      parede('patio-l', 800, 100, 800, 500),
      parede('patio-s', 100, 500, 800, 500),
      parede('patio-o', 100, 100, 100, 500),
      parede('casa-n', 400, 200, 700, 200),
      parede('casa-l', 700, 200, 700, 450),
      parede('casa-s', 400, 450, 700, 450),
      parede('casa-o-1', 400, 200, 400, 300),
      porta('porta-da-casa', 400, 300, 400, 340, true),
      parede('casa-o-2', 400, 340, 400, 450),
      parede('divisoria-1', 550, 200, 550, 300),
      porta('porta-do-quarto', 550, 300, 550, 340, false),
      parede('divisoria-2', 550, 340, 550, 450),
    ],
    pins: [pino('pino-do-quarto', 650, 400)],
    tokens: [ficha('ficha-bruno', DENTRO_DA_CASA)],
  }
}

describe('filterMapForPlayer — prédio de teto dentro de cômodo lembrado', () => {
  const lembraPatio = new Set(['patio'])

  it('SEGURANÇA: entrar na casa não entrega o quarto de porta fechada só porque o pátio é lembrado', () => {
    // A régua: com o pátio Sala comum, o quarto nunca saiu.
    const comum = filterMapForPlayer(patioComCasa('nenhum'), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembraPatio).map
    expect(ids(comum.regions)).toEqual(['casa', 'patio'])
    expect(comum.pins).toEqual([])

    const view = filterMapForPlayer(patioComCasa('comodo'), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembraPatio)
    expect(ids(view.map.regions)).toEqual(['casa', 'patio'])
    expect(view.map.pins).toEqual([])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('nome-quarto')
    expect(json).not.toContain('pino-do-quarto')
    expect(json).not.toContain('descricao-pino-do-quarto')
  })

  it('o pátio lembrado leva o polígono da casa para o host não marcar explorado lá dentro (aberta ou fechada)', () => {
    const aberta = filterMapForPlayer(patioComCasa('comodo'), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembraPatio)
    expect(aberta.rememberedRooms.map((r) => r.id)).toEqual(['patio'])
    expect(aberta.rememberedRooms[0]?.roomsInside).toEqual([CASA_DE_TETO, QUARTO_DA_CASA])

    const naRua = { ...patioComCasa('comodo'), tokens: [ficha('ficha-bruno', { x: 200, y: 300 })] }
    const fechada = filterMapForPlayer(naRua, 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, lembraPatio)
    expect(fechada.rememberedRooms.map((r) => r.id)).toEqual(['patio'])
    expect(fechada.rememberedRooms[0]?.roomsInside).toEqual([CASA_DE_TETO, QUARTO_DA_CASA])
  })

  it('controle: o cômodo lembrado DENTRO da casa aberta continua saindo inteiro, com o pino', () => {
    const view = filterMapForPlayer(
      patioComCasa('comodo', 'comodo'),
      'bruno',
      OWNERSHIP,
      RADIUS,
      undefined,
      undefined,
      undefined,
      undefined,
      new Set(['patio', 'quarto']),
    )
    expect(ids(view.map.regions)).toEqual(['casa', 'patio', 'quarto'])
    expect(view.map.pins.map((p) => p.id)).toEqual(['pino-do-quarto'])
    expect(view.rememberedRooms.find((r) => r.id === 'quarto')?.roomsInside).toEqual([])
  })
})

/**
 * SALA COMUM DENTRO DE CÔMODO LEMBRADO — o padrão Casa > Quarto da vila. A
 * Sala de dentro não é Cômodo nem tem teto: segue a regra de SEMPRE (sai
 * quando o interior dela é visto ou explorado). A lembrança do cômodo de fora
 * não pode entregá-la, nem o pino lá dentro, atrás de porta TRANCADA.
 *
 * Pátio (cômodo) 100..800 x 100..500; a casa (Sala comum) 400..700 x 200..450
 * com porta TRANCADA na parede oeste; pino da casa em (650, 400) e pino do
 * pátio no canto (150, 150).
 */
function trancada(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return parede(id, x1, y1, x2, y2, { open: false, locked: true, kind: 'normal' })
}

function patioComCasaComum(bruno: { x: number; y: number }, patio: Modo = 'comodo'): MapData {
  return {
    ...createEmptyMap('m-patio-comum', 'Patio do prefeito', 25, 25, 40),
    regions: [sala('patio', PATIO, patio), sala('casa', CASA_DE_TETO, 'nenhum')],
    walls: [
      parede('patio-n', 100, 100, 800, 100),
      parede('patio-l', 800, 100, 800, 500),
      parede('patio-s', 100, 500, 800, 500),
      parede('patio-o', 100, 100, 100, 500),
      parede('casa-n', 400, 200, 700, 200),
      parede('casa-l', 700, 200, 700, 450),
      parede('casa-s', 400, 450, 700, 450),
      parede('casa-o-1', 400, 200, 400, 300),
      trancada('porta-da-casa', 400, 300, 400, 340),
      parede('casa-o-2', 400, 340, 400, 450),
    ],
    pins: [pino('pino-na-casa', 650, 400, { description: 'segredo-da-casa' }), pino('pino-no-patio', 150, 150)],
    tokens: [ficha('ficha-bruno', bruno)],
  }
}

/** Casa (cômodo) 400..700 x 200..450; o quarto (Sala comum) 550..700 atrás de divisória com porta TRANCADA. */
function casaComQuartoComum(bruno: { x: number; y: number }, portaDoQuarto: Wall = trancada('porta-do-quarto', 550, 300, 550, 340)): MapData {
  return {
    ...createEmptyMap('m-casa-quarto', 'Casa do prefeito', 25, 25, 40),
    regions: [sala('casa', CASA_DE_TETO, 'comodo'), sala('quarto', QUARTO_DA_CASA, 'nenhum')],
    walls: [
      parede('casa-n', 400, 200, 700, 200),
      parede('casa-l', 700, 200, 700, 450),
      parede('casa-s', 400, 450, 700, 450),
      parede('casa-o', 400, 200, 400, 450),
      parede('divisoria-1', 550, 200, 550, 300),
      portaDoQuarto,
      parede('divisoria-2', 550, 340, 550, 450),
    ],
    pins: [pino('pino-do-quarto', 650, 400, { description: 'a-carta' }), pino('pino-da-frente', 450, 250)],
    tokens: [ficha('ficha-bruno', bruno)],
  }
}

describe('filterMapForPlayer — Sala comum dentro de cômodo lembrado', () => {
  const NO_PATIO = { x: 200, y: 300 }

  it('SEGURANÇA: o pátio lembrado não entrega a casa de porta trancada, nem o pino dela', () => {
    // A régua: com o pátio Sala comum, a casa e o pino dela nunca saíram.
    const comum = filterMapForPlayer(patioComCasaComum(NO_PATIO, 'nenhum'), 'bruno', OWNERSHIP, RADIUS).map
    expect(ids(comum.regions)).toEqual(['patio'])
    expect(ids(comum.pins)).toEqual(['pino-no-patio'])

    const view = filterMapForPlayer(patioComCasaComum(NO_PATIO), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['patio'])
    expect(ids(view.map.pins)).toEqual(['pino-no-patio'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('nome-casa')
    expect(json).not.toContain('pino-na-casa')
    expect(json).not.toContain('segredo-da-casa')
  })

  it('o pátio lembrado leva o polígono da casa para o host não marcar explorado lá dentro', () => {
    const view = filterMapForPlayer(patioComCasaComum(NO_PATIO), 'bruno', OWNERSHIP, RADIUS)
    expect(view.rememberedRooms.map((r) => r.id)).toEqual(['patio'])
    expect(view.rememberedRooms[0]?.roomsInside).toEqual([CASA_DE_TETO])
  })

  it('controle: de FORA do pátio, só pela lembrança, o pino do pátio sai e o da casa não', () => {
    const lembrado = filterMapForPlayer(patioComCasaComum({ x: 950, y: 950 }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['patio']))
    expect(ids(lembrado.map.regions)).toEqual(['patio'])
    expect(ids(lembrado.map.pins)).toEqual(['pino-no-patio'])
  })

  it('SEGURANÇA: Casa > Quarto — quem está na sala da frente não recebe o quarto trancado nem a carta', () => {
    const view = filterMapForPlayer(casaComQuartoComum(DENTRO_DA_CASA), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['casa'])
    expect(ids(view.map.pins)).toEqual(['pino-da-frente'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('nome-quarto')
    expect(json).not.toContain('a-carta')
    expect(view.rememberedRooms[0]?.roomsInside).toEqual([QUARTO_DA_CASA])
  })

  it('controle: com a porta do quarto aberta, o quarto sai pela VISÃO, como Sala comum sempre saiu', () => {
    const view = filterMapForPlayer(casaComQuartoComum(DENTRO_DA_CASA, porta('porta-do-quarto', 550, 300, 550, 340, true)), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['casa', 'quarto'])
  })

  it('SEGURANÇA: Casa > Quarto de fora, só pela lembrança da casa, o quarto trancado e a carta continuam fora', () => {
    const view = filterMapForPlayer(casaComQuartoComum({ x: 950, y: 950 }), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['casa']))
    expect(ids(view.map.regions)).toEqual(['casa'])
    expect(ids(view.map.pins)).toEqual(['pino-da-frente'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('nome-quarto')
    expect(json).not.toContain('a-carta')
    expect(view.rememberedRooms[0]?.roomsInside).toEqual([QUARTO_DA_CASA])
  })

  it('SEGURANÇA: Casa > Quarto > Armário — a Sala comum dentro da Sala comum também não sai pela lembrança da casa', () => {
    const ARMARIO: Region['points'] = [
      { x: 600, y: 380 },
      { x: 690, y: 380 },
      { x: 690, y: 440 },
      { x: 600, y: 440 },
    ]
    const base = casaComQuartoComum(DENTRO_DA_CASA)
    const map: MapData = {
      ...base,
      regions: [...base.regions, { ...sala('armario', ARMARIO, 'nenhum'), parentId: 'quarto' }],
      pins: [...base.pins, pino('no-armario', 650, 420, { description: 'a-chave' })],
    }
    const view = filterMapForPlayer(map, 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['casa'])
    expect(ids(view.map.pins)).toEqual(['pino-da-frente'])
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('nome-armario')
    expect(json).not.toContain('a-chave')
  })

  it('controle: o Bruno dentro do quarto recebe o quarto e a carta', () => {
    const view = filterMapForPlayer(casaComQuartoComum({ x: 650, y: 300 }), 'bruno', OWNERSHIP, RADIUS)
    expect(ids(view.map.regions)).toEqual(['casa', 'quarto'])
    expect(ids(view.map.pins)).toEqual(['pino-da-frente', 'pino-do-quarto'])
  })
})

/**
 * Sala de dentro GRANDE, que divide parede com o cômodo: a pergunta "quem
 * contém quem" é pela ÁREA, e não pela maioria das amostras do cômodo — que
 * caem, em boa parte, dentro da Sala de dentro quando ela ocupa mais da
 * metade dele. Pátio 100..800 x 100..500; o galpão 350..800 (64% do pátio)
 * encostado no canto leste, com o depósito 600..800 atrás de porta trancada.
 */
const GALPAO: Region['points'] = [
  { x: 350, y: 100 },
  { x: 800, y: 100 },
  { x: 800, y: 500 },
  { x: 350, y: 500 },
]
const DEPOSITO: Region['points'] = [
  { x: 600, y: 100 },
  { x: 800, y: 100 },
  { x: 800, y: 500 },
  { x: 600, y: 500 },
]

function patioComGalpao(galpao: Modo, bruno: { x: number; y: number }): MapData {
  return {
    ...createEmptyMap('m-galpao', 'Patio do prefeito', 25, 25, 40),
    regions: [sala('patio', PATIO, 'comodo'), sala('galpao', GALPAO, galpao), sala('deposito', DEPOSITO, 'nenhum')],
    walls: [
      parede('patio-n', 100, 100, 800, 100),
      parede('patio-l', 800, 100, 800, 500),
      parede('patio-s', 100, 500, 800, 500),
      parede('patio-o', 100, 100, 100, 500),
      parede('galpao-o-1', 350, 100, 350, 280),
      porta('porta-do-galpao', 350, 280, 350, 320, true),
      parede('galpao-o-2', 350, 320, 350, 500),
      parede('deposito-o-1', 600, 100, 600, 280),
      trancada('porta-do-deposito', 600, 280, 600, 320),
      parede('deposito-o-2', 600, 320, 600, 500),
    ],
    pins: [pino('pino-do-deposito', 700, 400, { description: 'o-cofre' })],
    tokens: [ficha('ficha-bruno', bruno)],
  }
}

describe('filterMapForPlayer — Sala grande dentro de cômodo lembrado', () => {
  const NO_GALPAO = { x: 450, y: 400 }

  it('SEGURANÇA: galpão de teto aberto com 64% do pátio não entrega o depósito trancado pela lembrança do pátio', () => {
    const view = filterMapForPlayer(patioComGalpao('teto', NO_GALPAO), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['patio']))
    expect(ids(view.map.regions)).toEqual(['galpao', 'patio'])
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('o-cofre')
    expect(view.rememberedRooms[0]?.roomsInside).toEqual([GALPAO, DEPOSITO])
  })

  it('SEGURANÇA: galpão Sala comum com 64% do pátio também não', () => {
    const view = filterMapForPlayer(patioComGalpao('nenhum', NO_GALPAO), 'bruno', OWNERSHIP, RADIUS, undefined, undefined, undefined, undefined, new Set(['patio']))
    expect(ids(view.map.regions)).toEqual(['galpao', 'patio'])
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('o-cofre')
    expect(view.rememberedRooms[0]?.roomsInside).toEqual([GALPAO, DEPOSITO])
  })
})
