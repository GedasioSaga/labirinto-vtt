import { describe, expect, it } from 'vitest'
import type { MapData, Stair, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'
import { deserializeMap, serializeMap } from './mapFile'
import { findStairAt } from './selectionHitTest'
import { escadaDaFicha } from './pisos'
import { guideBoxOfStair } from './guideBoxes'
import { eraseDecisionForStair } from './eraseGeometry'
import { buildPartnerStair } from './stairTravel'
import { stairCenterlineSamples, stairMidpoint } from './stairCurve'

/**
 * Escada curva para baixo: corda de (0,0) a (280,0), meio do arco em (140,100).
 * O meio da CORDA, (140,0), fica fora da escada curva — 100 px acima do arco,
 * mais que meia largura (35) mais a folga de clique.
 */
function curva(overrides: Partial<Stair> = {}): Stair {
  return { id: 'c', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 280, y2: 0 }], stepWidth: 70, curva: 100, ...overrides }
}

describe('a escada curva responde onde está desenhada', () => {
  it('clique: pega no meio do arco, não no meio da corda', () => {
    expect(findStairAt([curva()], { x: 140, y: 100 })?.id).toBe('c')
    expect(findStairAt([curva()], { x: 140, y: 0 })).toBeNull()
    // A reta de sempre continua pegando na corda.
    expect(findStairAt([curva({ curva: undefined })], { x: 140, y: 0 })?.id).toBe('c')
  })

  it('ficha em cima do arco está na escada que leva a outro piso', () => {
    const ficha = { id: 't', x: 140, y: 100 } as Token // só x/y e piso interessam aqui
    const map = { grid: 70, stairs: [curva({ levaAoPiso: 1 })] }
    expect(escadaDaFicha(map, ficha)?.stairId).toBe('c')
    const longe = { id: 't', x: 140, y: -60 } as Token // na corda, fora do arco
    expect(escadaDaFicha(map, longe)).toBeNull()
  })

  it('caixa de guia cobre a barriga do arco', () => {
    const caixa = guideBoxOfStair(curva())
    expect(caixa?.maxY).toBeGreaterThanOrEqual(135 - 1)
  })

  it('borracha encostando no arco apaga; no meio da corda, não', () => {
    expect(eraseDecisionForStair(curva(), { x: 140, y: 100 }, 5)).toBe('remove')
    expect(eraseDecisionForStair(curva(), { x: 140, y: 0 }, 5)).toBe('keep')
  })

  it('névoa: o meio e as amostras da escada estão sobre o arco', () => {
    expect(stairMidpoint(curva())).toEqual({ x: 140, y: 100 })
    const amostras = stairCenterlineSamples(curva())
    expect(amostras).toHaveLength(5)
    expect(amostras[2].x).toBeCloseTo(140, 9)
    expect(amostras[2].y).toBeCloseTo(100, 9)
    // Reta: as mesmas três por lance de antes.
    expect(stairCenterlineSamples(curva({ curva: undefined }))).toEqual([{ x: 0, y: 0 }, { x: 140, y: 0 }, { x: 280, y: 0 }])
  })

  it('jogador sob a névoa recebe a escada curva igual, com a curva; atrás da parede, nada', () => {
    const base = createEmptyMap('m', 'M', 1000, 1000, 40)
    const heroi: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 140, y: 600, size: 1, image: null }
    const mapa: MapData = { ...base, tokens: [heroi], stairs: [curva({ segments: [{ x1: 40, y1: 200, x2: 320, y2: 200 }] })] }
    const { map: doJogador } = filterMapForPlayer(mapa, 'p1', { p1: ['heroi'] }, 700)
    expect(doJogador.stairs).toEqual(mapa.stairs)
    const parede: Wall = { id: 'w', x1: 0, y1: 450, x2: 1000, y2: 450, blocksLight: true, blocksMove: true, door: null }
    const { map: escondido } = filterMapForPlayer({ ...mapa, walls: [parede] }, 'p1', { p1: ['heroi'] }, 700)
    expect(escondido.stairs).toEqual([])
  })

  it('salvar e reabrir: a curva volta; o mapa antigo, sem curva, abre idêntico', () => {
    const base = createEmptyMap('m', 'M', 1000, 1000, 40)
    const comCurva: MapData = { ...base, stairs: [curva()] }
    expect(deserializeMap(serializeMap(comCurva)).stairs).toEqual(comCurva.stairs)
    const antigo: MapData = { ...base, stairs: [curva({ curva: undefined })] }
    const reaberto = deserializeMap(serializeMap(antigo)).stairs[0]
    expect(reaberto).not.toHaveProperty('curva')
    expect(reaberto.segments).toEqual(antigo.stairs[0].segments)
  })

  it('a escada par do outro andar nasce com a mesma curva', () => {
    const par = buildPartnerStair('p', curva(), { x: 0, y: 0 })
    expect(par?.curva).toBe(100)
    expect(buildPartnerStair('p', curva({ curva: undefined }), { x: 0, y: 0 })).not.toHaveProperty('curva')
  })
})
