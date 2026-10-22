/**
 * Um item de cada tipo que mora numa camada (`lib/camadas`), montados pelas
 * fábricas de sempre para os testes de camada não reinventarem o formato.
 */
import type { Carimbo, Drawing, FloorPiece, Light, MapLine, MapMarker, Pin, Prop, Region, Stair, Token, Wall } from '../../types/map'
import { buildFreehandDrawing, buildLightAt, buildPathDrawing, buildRegionFromPoints, buildTextDrawing, buildWallFromDraft } from '../drawingFactory'
import { buildFloorPiece } from '../floorTool'
import { buildPin } from '../mapFactory'
import { criarMovel } from '../mobilia'
import { buildStairFromDraft } from '../stairs'

export const GRADE = 64

export const parede: Wall = buildWallFromDraft('w1', { x: 0, y: 0 }, { x: 64, y: 0 })
export const porta: Wall = { ...buildWallFromDraft('w2', { x: 0, y: 64 }, { x: 64, y: 64 }), door: { kind: 'normal', open: false, locked: false } }
export const regiao: Region = buildRegionFromPoints('r1', [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }])
export const escada: Stair = buildStairFromDraft('s1', { x: 0, y: 0 }, { x: 64, y: 128 }, 16)
export const luz: Light = buildLightAt('l1', { x: 32, y: 32 }, GRADE)
export const ficha: Token = { id: 't1', characterId: null, name: 'Ana', x: 32, y: 32, size: 1, image: null }
export const pino: Pin = buildPin('p1', { x: 96, y: 96 }, 'exclamacao')
export const objeto: Prop = criarMovel('barril', { x: 160, y: 160 }, GRADE, 'o1')
export const enfeite: Prop = { ...criarMovel('caixa', { x: 224, y: 160 }, GRADE, 'o2'), layer: 'decoracao' }
export const peca: FloorPiece = buildFloorPiece('f1', { kind: 'rect', cx: 32, cy: 32, w: 64, h: 64 }, 'add')
export const linha: MapLine = { id: 'ml1', points: [{ x: 0, y: 0 }, { x: 64, y: 0 }], closed: false, dotted: false, color: '#000000', width: 2 }
export const marcador: MapMarker = { id: 'mk1', cx: 0, cy: 0, w: 10, h: 10, rotation: 0, color: '#000000' }
export const carimbo: Carimbo = { id: 'c1', tipo: 'pinheiro', x: 10, y: 10, tamanho: 30, giro: 45 }
export const rabisco: Drawing = buildFreehandDrawing('d1', [{ x: 0, y: 0 }, { x: 10, y: 10 }], '#000000', 2)
export const texto: Drawing = buildTextDrawing('d2', { x: 0, y: 0 }, '#000000', 12)
export const caminho: Drawing = buildPathDrawing('d3', [{ x: 0, y: 0 }, { x: 64, y: 0 }], '#8a6a3a', 1, GRADE)
