import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import { OUTSIDE_ROOMS_LABEL, UNNAMED_ROOM_LABEL, roomTrailAt, whereAmI, whereAmIText } from './whereAmI'

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function room(id: string, name: string, points: Region['points'], extra: Partial<Region> = {}): Region {
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
}

function rect(x1: number, y1: number, x2: number, y2: number): Region['points'] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

// Farol com dois pisos lado a lado no plano; a Sala do Faroleiro fica no piso 5.
const FAROL = rect(0, 0, 400, 200)
const PISO_5 = rect(10, 10, 190, 190)
const PISO_6 = rect(210, 10, 390, 190)
const FAROLEIRO = rect(20, 20, 100, 100)

function farol(): Region[] {
  return [
    room('farol', 'Farol', FAROL),
    room('piso-5', 'Farol, piso 5', PISO_5, { parentId: 'farol' }),
    room('piso-6', 'Farol, piso 6', PISO_6, { parentId: 'farol' }),
    room('faroleiro', 'Sala do Faroleiro', FAROLEIRO, { parentId: 'piso-5' }),
  ]
}

describe('roomTrailAt: o caminho da sala onde está um ponto', () => {
  it('sobe pela sala-mãe: prédio › piso › cômodo, de fora para dentro', () => {
    expect(roomTrailAt(farol(), { x: 50, y: 50 })).toEqual(['Farol', 'Farol, piso 5', 'Sala do Faroleiro'])
  })

  it('no piso vizinho o caminho é o do piso vizinho, sem o cômodo do outro', () => {
    expect(roomTrailAt(farol(), { x: 300, y: 100 })).toEqual(['Farol', 'Farol, piso 6'])
  })

  it('fora de toda Sala: caminho vazio', () => {
    expect(roomTrailAt(farol(), { x: 900, y: 900 })).toEqual([])
    expect(roomTrailAt([], { x: 0, y: 0 })).toHaveLength(0)
  })

  it('região comum (sem `room`) não entra no caminho', () => {
    const regions: Region[] = [
      { id: 'rua', points: rect(0, 0, 1000, 1000), tag: '', fillColor: '#000', fillPattern: 'solid', data: {} },
      room('taverna', 'Taverna', rect(100, 100, 300, 300)),
    ]
    expect(roomTrailAt(regions, { x: 200, y: 200 })).toEqual(['Taverna'])
  })

  it('cômodo de nome vazio vira "Lugar sem nome"; prédio de nome vazio sai do caminho', () => {
    const regions = farol().map((r) => (r.id === 'faroleiro' || r.id === 'farol' ? { ...r, room: { shape: 'rect' as const, name: '' } } : r))
    expect(roomTrailAt(regions, { x: 50, y: 50 })).toEqual(['Farol, piso 5', UNNAMED_ROOM_LABEL])
    expect(UNNAMED_ROOM_LABEL).toBe('Lugar sem nome')
  })

  it('silhueta de teto fechado (`roof: true`) não entra: o interior não é do jogador', () => {
    const regions = [room('casa', '', rect(0, 0, 400, 400), { room: { shape: 'rect', name: '', roof: true } })]
    expect(roomTrailAt(regions, { x: 50, y: 50 })).toEqual([])
  })

  it('mãe que não chegou (id órfão) encerra o caminho sem quebrar', () => {
    const regions = [room('quarto', 'Quarto 27', FAROLEIRO, { parentId: 'nao-chegou' })]
    expect(roomTrailAt(regions, { x: 50, y: 50 })).toEqual(['Quarto 27'])
  })

  it('ciclo de `parentId` (arquivo corrompido) não trava', () => {
    const regions = [room('a', 'A', rect(0, 0, 100, 100), { parentId: 'b' }), room('b', 'B', rect(0, 0, 100, 100), { parentId: 'a' })]
    const trail = roomTrailAt(regions, { x: 50, y: 50 })
    expect(trail.length).toBe(2)
    expect(new Set(trail)).toEqual(new Set(['A', 'B']))
  })
})

describe('whereAmI: qual ficha a faixa acompanha', () => {
  function mapWith(tokens: Token[]): MapData {
    return { ...createEmptyMap('m', 'M', 1000, 1000, 40), regions: farol(), tokens }
  }

  it('a ficha em foco, quando é do jogador; senão a primeira dele que está no mapa', () => {
    const map = mapWith([token('ana', 50, 50), token('bia', 300, 100)])
    expect(whereAmI(map, ['ana', 'bia'], 'bia')).toEqual({ tokenId: 'bia', tokenName: 'nome-bia', trail: ['Farol', 'Farol, piso 6'] })
    expect(whereAmI(map, ['ana', 'bia'], null)?.tokenId).toBe('ana')
    // Foco numa ficha alheia não conta.
    expect(whereAmI(map, ['bia'], 'ana')?.tokenId).toBe('bia')
    // Ficha dele que ainda não chegou no recorte: pula para a próxima.
    expect(whereAmI(map, ['sumiu', 'bia'], 'sumiu')?.tokenId).toBe('bia')
  })

  it('sem ficha própria no mapa: nada a mostrar', () => {
    expect(whereAmI(mapWith([token('ana', 50, 50)]), [], null)).toBeNull()
    expect(whereAmI(mapWith([]), ['ana'], 'ana')).toBeNull()
  })

  it('texto da faixa: caminho com ›, ou "Fora das salas"', () => {
    expect(whereAmIText(['Farol, piso 5', 'Sala do Faroleiro'])).toBe('Farol, piso 5 › Sala do Faroleiro')
    expect(whereAmIText([])).toBe(OUTSIDE_ROOMS_LABEL)
    expect(OUTSIDE_ROOMS_LABEL).toBe('Fora das salas')
  })
})

/**
 * A faixa lê SÓ o mapa que o jogador recebe (`filterMapForPlayer`). Estes
 * testes passam o mapa do mestre pelo recorte de verdade e conferem que o
 * caminho nunca diz o que o mestre esconde: nome oculto, sala secreta (e as
 * de dentro dela), nome em zona oculta.
 */
describe('whereAmI sobre o recorte do jogador: o escondido não chega', () => {
  const RADIUS = 700
  const ownership = { p1: ['heroi'], p2: ['ladino'] }
  const CASA = rect(100, 100, 400, 400)
  const QUARTO = rect(150, 150, 250, 250)

  function masterMap(regions: Region[], patch: Partial<MapData> = {}): MapData {
    return {
      ...createEmptyMap('m', 'nome-da-cena', 1000, 1000, 40),
      walls: [wall('divisoria', 500, 0, 500, 1000)],
      tokens: [token('heroi', 200, 200), token('ladino', 800, 800)],
      regions,
      ...patch,
    }
  }

  function trailFor(master: MapData): string[] {
    const { map } = filterMapForPlayer(master, 'p1', ownership, RADIUS)
    const where = whereAmI(map, ['heroi'], 'heroi')
    if (where === null) throw new Error('a ficha do próprio jogador sempre chega')
    return where.trail
  }

  it('sem nada escondido, o caminho chega inteiro (controle do teste)', () => {
    const master = masterMap([room('casa', 'nome-casa', CASA), room('quarto', 'nome-quarto', QUARTO, { parentId: 'casa' })])
    expect(trailFor(master)).toEqual(['nome-casa', 'nome-quarto'])
  })

  it('nome oculto do cômodo: "Lugar sem nome", nunca o nome real', () => {
    const master = masterMap([
      room('casa', 'nome-casa', CASA),
      room('quarto', 'nome-quarto-oculto', QUARTO, { parentId: 'casa', room: { shape: 'rect', name: 'nome-quarto-oculto', nameHiddenFromPlayers: true } }),
    ])
    const trail = trailFor(master)
    expect(trail).toEqual(['nome-casa', UNNAMED_ROOM_LABEL])
    expect(JSON.stringify(trail)).not.toContain('nome-quarto-oculto')
  })

  it('nome oculto do prédio: sai do caminho, o cômodo continua', () => {
    const master = masterMap([
      room('casa', 'nome-casa-oculto', CASA, { room: { shape: 'rect', name: 'nome-casa-oculto', nameHiddenFromPlayers: true } }),
      room('quarto', 'nome-quarto', QUARTO, { parentId: 'casa' }),
    ])
    const trail = trailFor(master)
    expect(trail).toEqual(['nome-quarto'])
    expect(JSON.stringify(trail)).not.toContain('nome-casa-oculto')
  })

  it('prédio secreto: nem ele nem o cômodo de dentro aparecem, mesmo com a ficha lá dentro', () => {
    const master = masterMap([
      room('casa', 'nome-casa-secreta', CASA, { secret: true }),
      room('quarto', 'nome-quarto-da-secreta', QUARTO, { parentId: 'casa' }),
    ])
    const trail = trailFor(master)
    expect(trail).toEqual([])
    expect(JSON.stringify(trail)).not.toContain('secreta')
  })

  it('cômodo secreto dentro de prédio visível: só o prédio', () => {
    const master = masterMap([room('casa', 'nome-casa', CASA), room('quarto', 'nome-quarto-secreto', QUARTO, { parentId: 'casa', secret: true })])
    const trail = trailFor(master)
    expect(trail).toEqual(['nome-casa'])
    expect(JSON.stringify(trail)).not.toContain('nome-quarto-secreto')
  })

  it('cômodo dentro de zona oculta ativa: o nome é do que a zona esconde', () => {
    const zone: ConcealZone = { id: 'zona', name: 'zona', revealed: false, points: rect(140, 140, 260, 260) }
    const master = masterMap([room('casa', 'nome-casa', CASA), room('quarto', 'nome-quarto-na-zona', QUARTO, { parentId: 'casa' })], {
      concealZones: [zone],
    })
    const trail = trailFor(master)
    expect(JSON.stringify(trail)).not.toContain('nome-quarto-na-zona')
    expect(trail).toContain('nome-casa')
  })

  it('a sala onde está a ficha de OUTRO jogador nunca entra no caminho deste', () => {
    const master = masterMap([room('casa', 'nome-casa', CASA), room('covil', 'nome-covil-do-ladino', rect(600, 600, 900, 900))])
    const trail = trailFor(master)
    expect(trail).toEqual(['nome-casa'])
    expect(JSON.stringify(trail)).not.toContain('nome-covil-do-ladino')
  })
})
