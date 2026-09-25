import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Pin, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * VER PELA PORTA ABERTA DE PRÉDIO FECHADO, lado da REDE.
 *
 * Quem está no vão da porta aberta de um prédio de teto fechado enxerga o lado
 * de dentro SÓ no cone que passa pela porta; o teto continua fechado para o
 * resto. A asserção é sobre o PACOTE (`JSON.stringify` do recorte), não sobre
 * a tela: o que o cone não alcança não pode atravessar a rede.
 *
 * Geometria (px de mundo, 1000 x 1000, grade 40):
 *   casa        200..600 x 200..600, teto ligado; porta ABERTA no muro sul,
 *               x 380..420 em y = 600;
 *   divisória   y = 400, de parede a parede: separa a sala da frente
 *               (400..600) do quarto dos fundos (200..400);
 *   herói       (400, 630), 30 px ao sul da porta: no vão, ao alcance dela;
 *   cone        da porta até a divisória, x ~247..553 em y = 400.
 */
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
const NO_VAO = { x: 400, y: 630 }
const LONGE_DA_PORTA = { x: 400, y: 800 }
const RADIUS = 700

function sala(id: string, points: Region['points'], extra: Partial<Region> = {}, roof?: boolean): Region {
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}`, roof }, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number): Pin {
  return { id, kind: 'exclamacao', x, y, description: `texto-${id}`, image: null }
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

interface Porta {
  open: boolean
  locked?: boolean
}

function vila(heroi: { x: number; y: number }, porta: Porta = { open: true }): MapData {
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
      // Desenhada à mão, sem `regionId`: o vão é achado pela geometria do contorno.
      parede('porta-da-casa', 380, 600, 420, 600, { door: { open: porta.open, locked: porta.locked ?? false, kind: 'normal' } }),
      parede('muro-sul-b', 420, 600, 600, 600, { regionId: 'casa' }),
      parede('divisoria', 200, 400, 600, 400, { regionId: 'sala-da-frente' }),
      parede('parede-dos-fundos', 250, 300, 550, 300, { regionId: 'quarto-dos-fundos' }),
    ],
    // O chão da casa avança 10 px sob a rua: peças só encostadas deixam uma
    // costura no contorno do chão, e a costura segura a visão como parede.
    floor: [chao('chao-rua', 500, 800, 1000, 400), chao('chao-casa', 400, 405, 400, 410)],
    tokens: [
      ficha('heroi', heroi.x, heroi.y),
      // Na sala da frente, bem na frente da porta: dentro do cone.
      ficha('aliado', 400, 500),
      // No quarto dos fundos, atrás da divisória.
      ficha('vulto-dos-fundos', 400, 300),
      // Na sala da frente, mas encostado no muro sul a oeste: o muro tapa.
      ficha('espreita-no-canto', 230, 580),
    ],
    pins: [pino('pino-na-sala', 450, 450), pino('pino-nos-fundos', 400, 250)],
    lights: [{ id: 'tocha-na-sala', x: 420, y: 480, radius: 100, color: '#fff', intensity: 1 }],
  }
}

const OWNERSHIP = { p1: ['heroi'] }

/** O que é INTERIOR e fica fora do cone: nenhum destes pode chegar ao jogador. */
const FORA_DO_CONE = ['vulto-dos-fundos', 'espreita-no-canto', 'pino-nos-fundos', 'texto-pino-nos-fundos', 'parede-dos-fundos', 'nome-quarto-dos-fundos']
/** Interior de qualquer jeito: sem porta aberta com a ficha no vão, nada disto sai. */
const INTERIOR = [...FORA_DO_CONE, 'aliado', 'pino-na-sala', 'divisoria', 'tocha-na-sala', 'nome-sala-da-frente', 'chao-casa']

describe('filterMapForPlayer — ver pela porta aberta de prédio fechado', () => {
  it('no vão da porta aberta, o jogador recebe o colega, o pino e a divisória que o cone alcança', () => {
    const view = filterMapForPlayer(vila(NO_VAO), 'p1', OWNERSHIP, RADIUS)
    const out = view.map

    expect(out.tokens.map((t) => t.id).sort()).toEqual(['aliado', 'heroi'])
    expect((out.pins ?? []).map((p) => p.id)).toEqual(['pino-na-sala'])

    // A divisória sai SÓ no trecho que o cone alcança, não de parede a parede.
    const divisoria = out.walls.filter((w) => w.id.startsWith('divisoria'))
    expect(divisoria.length).toBeGreaterThan(0)
    const xs = divisoria.flatMap((w) => [w.x1, w.x2])
    expect(Math.min(...xs)).toBeGreaterThan(240)
    expect(Math.max(...xs)).toBeLessThan(560)
    expect(divisoria.every((w) => w.y1 === 400 && w.y2 === 400)).toBe(true)
  })

  it('SEGURANÇA: o que o cone não alcança continua fora do pacote, e o teto continua fechado', () => {
    const view = filterMapForPlayer(vila(NO_VAO), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(view.map)

    for (const id of FORA_DO_CONE) expect(json).not.toContain(id)
    // Tocha dentro do prédio não sai: o halo dela desenharia o interior fora do cone.
    expect(json).not.toContain('tocha-na-sala')
    // Os cômodos de dentro não saem: o polígono deles contaria o que o cone não mostra.
    expect(view.map.regions.map((r) => r.id)).toEqual(['casa'])
    const casa = view.map.regions[0]
    expect(casa.room?.roof).toBe(true)
    expect(casa.room?.name).toBe('')
    // O chão da casa sai recortado nas células do cone, nunca a peça inteira.
    expect(json).not.toContain('"w":400')
    const recortes = view.map.floor.filter((f) => f.id.startsWith('chao-casa'))
    expect(recortes.length).toBe(1)
    const forma = recortes[0].shape
    expect(forma.kind).toBe('blocos')
    if (forma.kind !== 'blocos') return
    expect(forma.cells.length).toBeGreaterThan(0)
    // Nenhuma célula atrás da divisória (linha 39 = y 390..400) nem fora do muro.
    expect(forma.cells.every((c) => c.row >= 40 && c.row < 60)).toBe(true)
  })

  it('a visão enviada entra pela porta e para na divisória', () => {
    const view = filterMapForPlayer(vila(NO_VAO), 'p1', OWNERSHIP, RADIUS)
    const anel = view.vision[0]

    // Entra: há ponto da visão dentro da casa, bem além do muro sul.
    expect(anel.some((p) => p.y < 500 && p.x > 200 && p.x < 600)).toBe(true)
    // E não passa da divisória: nada do quarto dos fundos desenha na névoa.
    const dentroDaCasa = anel.filter((p) => p.x > 201 && p.x < 599 && p.y < 599)
    expect(dentroDaCasa.length).toBeGreaterThan(0)
    expect(dentroDaCasa.every((p) => p.y >= 399.5)).toBe(true)
  })

  it('a espiada sai marcada com o prédio e a visão de quem espia — e só isso', () => {
    const view = filterMapForPlayer(vila(NO_VAO), 'p1', OWNERSHIP, RADIUS)
    expect(view.peek).toEqual({ roofIds: ['casa'], vision: [view.vision[0]] })
  })

  it('porta FECHADA: nada de dentro sai e não há espiada', () => {
    const view = filterMapForPlayer(vila(NO_VAO, { open: false }), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(view.map)
    for (const id of INTERIOR) expect(json).not.toContain(id)
    expect(view.peek).toBe(null)
  })

  it('porta aberta mas TRANCADA (mapa antigo): não abre a espiada', () => {
    const view = filterMapForPlayer(vila(NO_VAO, { open: true, locked: true }), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(view.map)
    for (const id of INTERIOR) expect(json).not.toContain(id)
    expect(view.peek).toBe(null)
  })

  it('longe da porta aberta, olhando da rua: o teto esconde tudo como antes', () => {
    const view = filterMapForPlayer(vila(LONGE_DA_PORTA), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(view.map)
    for (const id of INTERIOR) expect(json).not.toContain(id)
    expect(view.peek).toBe(null)
  })

  it('a espiada é de quem está no vão: outro jogador na rua não recebe nada de dentro', () => {
    const map = { ...vila(NO_VAO), tokens: [...vila(NO_VAO).tokens, ficha('ficha-bruno', 800, 900)] }
    const view = filterMapForPlayer(map, 'p2', { p1: ['heroi'], p2: ['ficha-bruno'] }, RADIUS)
    const json = JSON.stringify(view.map)
    for (const id of INTERIOR) expect(json).not.toContain(id)
    expect(view.peek).toBe(null)
  })
})
