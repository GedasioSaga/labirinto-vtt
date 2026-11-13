import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Region, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, type PlanMemory, type PlayerMapView } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * TERRENO (peça de Chão com material) em lugar que o jogador NÃO CONHECE
 * (F-N02 e F-N14 da 0.5.62). O chão de todo lugar ainda não visto vai no
 * recorte (a forma: a do cômodo Q abaixo vai), e as Texturas não saem do lugar
 * que ele não conhece. A peça com material é as duas coisas: a forma vai como
 * o chão de lá (Lisa), e o material, que é a textura dela, só quando ele
 * conhece algum pedaço dela. Sem isso a praça de Q ia inteira desde o 1º
 * quadro, e trocar só o material dela mudava as beiradas do terreno que ele vê.
 *
 * Mapa de 1000 × 1000 px (25 × 25 casas de 40): cômodo Q fechado em
 * 600..900 × 100..400; o herói longe dele, com memória da planta como o host.
 */

const RADIUS = 200
const OWN = { p1: ['heroi'] }
const Q: Region['points'] = [
  { x: 600, y: 100 },
  { x: 900, y: 100 },
  { x: 900, y: 400 },
  { x: 600, y: 400 },
]

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function ret(id: string, cx: number, cy: number, w: number, h: number, extra: Partial<FloorPiece> = {}): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {}, ...extra }
}

function mapa(heroi: { x: number; y: number }, floor: FloorPiece[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 25, 25, 40),
    regions: [{ id: 'q', points: Q, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Q', comodo: true } }],
    walls: [parede('q-n', 600, 100, 900, 100), parede('q-l', 900, 100, 900, 400), parede('q-s', 900, 400, 600, 400), parede('q-o', 600, 400, 600, 100)],
    floor: [ret('chao', 500, 500, 1000, 1000), ...floor],
    tokens: [{ id: 'heroi', characterId: null, name: 'Heroi', x: heroi.x, y: heroi.y, size: 1, image: null }],
  }
}

/** Um jogador com memória, como o host guarda: explorado e planta lembrada. */
function jogador() {
  const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
  let memory: PlanMemory = emptyPlanMemory()
  return (map: MapData): PlayerMapView => {
    const view = filterMapForPlayer(map, 'p1', OWN, RADIUS, exp, new Map(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, memory)
    markRings(exp, view.vision, view.blocked)
    memory = view.plan
    return view
  }
}

const peca = (view: PlayerMapView, id: string) => view.map.floor.find((f) => f.id === id)

describe('recorte: terreno em lugar que o jogador não conhece', () => {
  it('a praça do cômodo nunca visto vai Lisa, como o chão de lá, e o recorte é o mesmo com calçamento ou terra nela; vista por dentro, o material vai', () => {
    const floor = (material: string) => [
      ret('liso-q', 820, 320, 80, 80),
      ret('praca-q', 700, 200, 120, 120, { material, borda: 0.6 }),
      ret('trilha', 150, 850, 200, 60, { material: 'terra', borda: 0.6 }),
    ]
    const longe = { x: 150, y: 850 }
    const comCalcamento = jogador()(mapa(longe, floor('calcamento')))
    const comTerra = jogador()(mapa(longe, floor('terra')))
    // A forma vai (o chão do lugar não visto vai, como o Liso de lá), sem material e sem borda.
    expect(peca(comCalcamento, 'liso-q')).toBeDefined()
    expect(peca(comCalcamento, 'praca-q')).toEqual(ret('praca-q', 700, 200, 120, 120))
    // A trilha que ele vê guarda o material dela.
    expect(peca(comCalcamento, 'trilha')).toMatchObject({ material: 'terra', borda: 0.6 })
    // Trocar só o material escondido não muda nada do que ele recebe.
    expect(JSON.stringify(comTerra.map)).toBe(JSON.stringify(comCalcamento.map))
    expect(JSON.stringify(comCalcamento.map)).not.toContain('calcamento')

    // Dentro de Q ele conhece o cômodo: a praça vai com o material.
    const dentro = jogador()(mapa({ x: 750, y: 300 }, floor('calcamento')))
    expect(peca(dentro, 'praca-q')).toMatchObject({ material: 'calcamento', borda: 0.6 })
  })

  it('a estrada vista só por uma ponta guarda o material, também depois, longe dela (pelo explorado)', () => {
    // Estrada de 900 px; o herói vê só a ponta oeste (até x ~ 233): as 9 amostras da caixa da peça ficam todas fora.
    const estrada: FloorPiece = {
      id: 'estrada',
      shape: { kind: 'corridor', suave: true, points: [{ x: 60, y: 600, width: 80 }, { x: 500, y: 590, width: 80 }, { x: 960, y: 600, width: 80 }] },
      op: 'add',
      modifiers: {},
      material: 'calcamento',
      borda: 0.6,
    }
    const ver = jogador()
    const perto = ver(mapa({ x: 60, y: 700 }, [estrada]))
    expect(peca(perto, 'estrada')).toMatchObject({ material: 'calcamento' })
    const longe = ver(mapa({ x: 900, y: 950 }, [estrada]))
    expect(peca(longe, 'estrada')).toMatchObject({ material: 'calcamento', borda: 0.6 })
    // Controle: quem nunca chegou perto recebe a estrada Lisa.
    const nunca = jogador()(mapa({ x: 900, y: 950 }, [estrada]))
    expect(peca(nunca, 'estrada')?.material).toBeUndefined()
  })
})
