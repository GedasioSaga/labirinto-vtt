import { beforeEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft, buildWallFromDraft } from '../lib/drawingFactory'
import { findTokenPath } from '../lib/collision'
import { hasLineOfSight, visionSegments } from '../lib/visibility'
import { buildFloorMask } from '../pixi/floorMask'
import type { MapData, RegionPoint, Wall } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PAREDE PARCIAL. O mestre apaga o lado oeste do Quarto e desenha, com a
 * ferramenta Parede, só um trecho dele: do canto de cima até y=192. O resto do
 * lado (y de 192 a 384) fica aberto.
 *
 * O trecho é parede da Sala, não um risco solto por cima dela: bloqueia passo
 * e visão só onde foi desenhado, e continua no lugar quando o mestre arrasta
 * ou redimensiona a Sala. (Parede solta ficava para trás, barrando o nada.)
 */
const GRADE = 64
/** Quarto de x 320..832 e y 64..384; o lado oeste é a aresta 3, de (320,384) a (320,64). */
const QUARTO = { de: { x: 320, y: 64 }, ate: { x: 832, y: 384 } }
const LADO_OESTE = 3
const TRECHO = { de: { x: 320, y: 64 }, ate: { x: 320, y: 192 } }

function quartoSemLadoOeste(): MapData {
  const quarto = buildRoomFromDraft('r-quarto', ['q0', 'q1', 'q2', 'q3'], QUARTO.de, QUARTO.ate, undefined, undefined, 'Quarto')
  const map = addRoom(createEmptyMap('m_parede_parcial', 'Parede parcial', 40, 20, GRADE), quarto.region, quarto.walls)
  return { ...map, walls: map.walls.filter((w) => w.id !== 'q3') }
}

function desenhar(id: string, de: RegionPoint, ate: RegionPoint): Wall {
  useMapStore.getState().addWall(buildWallFromDraft(id, de, ate))
  const wall = useMapStore.getState().map.walls.find((w) => w.id === id)
  if (wall === undefined) throw new Error(`parede ${id} não entrou no mapa`)
  return wall
}

function paredeAtual(id: string): Wall {
  const wall = useMapStore.getState().map.walls.find((w) => w.id === id)
  if (wall === undefined) throw new Error(`parede ${id} sumiu`)
  return wall
}

/** A ficha atravessa de `de` a `ate` com as paredes de agora? */
function passa(de: RegionPoint, ate: RegionPoint): boolean {
  return findTokenPath(de, ate, useMapStore.getState().map.walls) !== null
}

/** A visão vai de `de` a `ate` com as paredes de agora? */
function ve(de: RegionPoint, ate: RegionPoint): boolean {
  return hasLineOfSight(de, ate, visionSegments(useMapStore.getState().map))
}

describe('mapStore: o mestre desenha só um trecho de parede num lado da Sala', () => {
  beforeEach(() => {
    useMapStore.setState({ map: quartoSemLadoOeste(), selection: [], past: [], future: [], pisoAtivo: 0 })
  })

  it('o trecho sobre o lado da Sala nasce vinculado a ela, naquela aresta, num passo de histórico', () => {
    const antes = useMapStore.getState().map
    const trecho = desenhar('trecho', TRECHO.de, TRECHO.ate)
    expect(trecho.regionId).toBe('r-quarto')
    expect(trecho.regionEdgeIndex).toBe(LADO_OESTE)
    expect([trecho.x1, trecho.y1, trecho.x2, trecho.y2]).toEqual([320, 64, 320, 192])
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('colisão: a ficha é barrada no trecho e passa pela parte aberta do lado', () => {
    desenhar('trecho', TRECHO.de, TRECHO.ate)
    expect(passa({ x: 128, y: 128 }, { x: 576, y: 128 })).toBe(false)
    expect(passa({ x: 128, y: 320 }, { x: 576, y: 320 })).toBe(true)
  })

  it('visão: o trecho tapa a visão e a parte aberta deixa ver', () => {
    desenhar('trecho', TRECHO.de, TRECHO.ate)
    expect(ve({ x: 128, y: 128 }, { x: 576, y: 128 })).toBe(false)
    expect(ve({ x: 128, y: 320 }, { x: 576, y: 320 })).toBe(true)
  })

  it('arrastar a Sala leva o trecho junto: barra e tapa no lugar novo, e o lugar velho fica livre', () => {
    desenhar('trecho', TRECHO.de, TRECHO.ate)
    useMapStore.getState().moveRegion('r-quarto', 128, 0)
    const trecho = paredeAtual('trecho')
    expect([trecho.x1, trecho.y1, trecho.x2, trecho.y2]).toEqual([448, 64, 448, 192])
    // Entre o lugar velho (x=320) e o novo (x=448): nada barra mais em x=320.
    expect(passa({ x: 128, y: 128 }, { x: 384, y: 128 })).toBe(true)
    expect(ve({ x: 128, y: 128 }, { x: 384, y: 128 })).toBe(true)
    // Atravessar o lado oeste novo pelo trecho: barrado e tapado.
    expect(passa({ x: 128, y: 128 }, { x: 640, y: 128 })).toBe(false)
    expect(ve({ x: 128, y: 128 }, { x: 640, y: 128 })).toBe(false)
    // Pela parte aberta, no lugar novo: passa e vê.
    expect(passa({ x: 128, y: 320 }, { x: 640, y: 320 })).toBe(true)
    expect(ve({ x: 128, y: 320 }, { x: 640, y: 320 })).toBe(true)
  })

  it('redimensionar a Sala pelo canto leva o trecho junto, no mesmo pedaço do lado', () => {
    desenhar('trecho', TRECHO.de, TRECHO.ate)
    // Canto de cima à esquerda (vértice 0) para (256, 64): o lado oeste tomba
    // e vai de (320,384) a (256,64). O trecho ocupava de 60% a 100% dele.
    useMapStore.getState().updateRegionPoint('r-quarto', 0, 256, 64)
    const trecho = paredeAtual('trecho')
    expect(trecho.x1).toBeCloseTo(256)
    expect(trecho.y1).toBeCloseTo(64)
    expect(trecho.x2).toBeCloseTo(281.6)
    expect(trecho.y2).toBeCloseTo(192)
    expect(trecho.regionEdgeIndex).toBe(LADO_OESTE)
  })

  it('apagar a Sala leva o trecho junto, e um Ctrl+Z devolve os dois', () => {
    desenhar('trecho', TRECHO.de, TRECHO.ate)
    const comTrecho = useMapStore.getState().map
    useMapStore.getState().removeRegion('r-quarto')
    expect(useMapStore.getState().map.walls.map((w) => w.id)).not.toContain('trecho')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(comTrecho)
  })

  it('Sala cujas paredes são só trechos desenhados continua sendo piso', () => {
    useMapStore.setState({ map: { ...quartoSemLadoOeste(), walls: [] } })
    desenhar('trecho', TRECHO.de, TRECHO.ate)
    const { regions, walls } = useMapStore.getState().map
    expect(buildFloorMask(new Graphics(), regions, walls, [])).toBe(true)
  })

  it('traço fora de qualquer lado de Sala continua parede solta', () => {
    const solta = desenhar('solta', { x: 576, y: 128 }, { x: 576, y: 256 })
    expect(solta.regionId).toBeUndefined()
    expect(solta.regionEdgeIndex).toBeUndefined()
  })

  it('traço que passa do canto da Sala continua solto (não é trecho do lado)', () => {
    const comprida = desenhar('comprida', { x: 320, y: 0 }, { x: 320, y: 192 })
    expect(comprida.regionId).toBeUndefined()
  })

  it('trecho na divisa de duas Salas encostadas continua solto (a divisa é das duas)', () => {
    const vizinha = buildRoomFromDraft('r-vizinha', ['v0', 'v1', 'v2', 'v3'], { x: 0, y: 64 }, { x: 320, y: 384 }, undefined, undefined, 'Vizinha')
    const semDivisa = (m: MapData): MapData => ({ ...m, walls: m.walls.filter((w) => w.id !== 'v1') })
    useMapStore.setState({ map: semDivisa(addRoom(quartoSemLadoOeste(), vizinha.region, vizinha.walls)) })
    const divisa = desenhar('divisa', TRECHO.de, TRECHO.ate)
    expect(divisa.regionId).toBeUndefined()
  })

  it('divisa com duas Salas vizinhas empilhadas continua solta, mesmo sem aresta delas que cubra o traço inteiro', () => {
    const cima = buildRoomFromDraft('r-cima', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 64 }, { x: 320, y: 192 }, undefined, undefined, 'Cima')
    const baixo = buildRoomFromDraft('r-baixo', ['b0', 'b1', 'b2', 'b3'], { x: 0, y: 192 }, { x: 320, y: 384 }, undefined, undefined, 'Baixo')
    useMapStore.setState({ map: addRoom(addRoom(quartoSemLadoOeste(), cima.region, []), baixo.region, []) })
    expect(desenhar('divisa', { x: 320, y: 128 }, { x: 320, y: 320 }).regionId).toBeUndefined()
  })

  it('traço no lado de Sala secreta continua solto: vinculado, sumiria da tela do jogador e seguiria barrando', () => {
    const map = quartoSemLadoOeste()
    useMapStore.setState({ map: { ...map, regions: map.regions.map((r) => ({ ...r, secret: true })) } })
    expect(desenhar('trecho', TRECHO.de, TRECHO.ate).regionId).toBeUndefined()
  })

  it.each([
    ['oculta', { hidden: true }],
    ['secreta', { secret: true }],
  ])('traço no lado de Sala dentro de Sala %s continua solto, pelo mesmo motivo', (_, extra) => {
    const casarao = buildRoomFromDraft('r-casarao', ['c0', 'c1', 'c2', 'c3'], { x: 0, y: 0 }, { x: 1024, y: 640 }, undefined, undefined, 'Casarão')
    const map = addRoom(quartoSemLadoOeste(), { ...casarao.region, ...extra }, casarao.walls)
    useMapStore.setState({ map: { ...map, regions: map.regions.map((r) => (r.id === 'r-quarto' ? { ...r, parentId: 'r-casarao' } : r)) } })
    expect(desenhar('trecho', TRECHO.de, TRECHO.ate).regionId).toBeUndefined()
  })

  describe('Quarto dentro de Prédio de teto, com fachada oeste em x=320 e vértice no meio (y=224)', () => {
    const FACHADA: RegionPoint[] = [{ x: 320, y: 0 }, { x: 1024, y: 0 }, { x: 1024, y: 640 }, { x: 320, y: 640 }, { x: 320, y: 224 }]
    beforeEach(() => {
      const map = quartoSemLadoOeste()
      const quarto = map.regions[0]
      const predio = { ...quarto, id: 'r-predio', points: FACHADA, room: { shape: 'rect' as const, name: 'Prédio', roof: true } }
      useMapStore.setState({ map: { ...map, regions: [predio, { ...quarto, parentId: 'r-predio' }] } })
    })

    it('traço na fachada continua solto: vinculado ao Quarto, viraria mobília do teto e sumiria da tela de quem está na rua', () => {
      // Nenhuma aresta do Prédio cobre o traço inteiro (passa do vértice); só a do Quarto.
      expect(desenhar('fachada', { x: 320, y: 128 }, { x: 320, y: 320 }).regionId).toBeUndefined()
    })

    it('divisória de dentro, longe da fachada, se vincula ao Quarto normalmente', () => {
      expect(desenhar('divisoria', { x: 832, y: 64 }, { x: 832, y: 192 }).regionId).toBe('r-quarto')
    })
  })

  it('trecho no lugar de uma Sala de outro piso não se vincula a ela', () => {
    const map = quartoSemLadoOeste()
    useMapStore.setState({ map: { ...map, regions: map.regions.map((r) => ({ ...r, piso: 1 })), walls: map.walls.map((w) => ({ ...w, piso: 1 })) } })
    const trecho = desenhar('trecho', TRECHO.de, TRECHO.ate)
    expect(trecho.regionId).toBeUndefined()
    expect(trecho.piso).toBeUndefined()
  })

  it('no piso de cima, o trecho se vincula à Sala de cima e nasce nesse piso', () => {
    const map = quartoSemLadoOeste()
    useMapStore.setState({ map: { ...map, regions: map.regions.map((r) => ({ ...r, piso: 1 })), walls: map.walls.map((w) => ({ ...w, piso: 1 })) }, pisoAtivo: 1 })
    const trecho = desenhar('trecho', TRECHO.de, TRECHO.ate)
    expect(trecho.regionId).toBe('r-quarto')
    expect(trecho.piso).toBe(1)
  })
})
