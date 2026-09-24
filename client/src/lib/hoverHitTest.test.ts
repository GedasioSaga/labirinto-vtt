import { describe, expect, it } from 'vitest'
import { resolveHoverHit } from './hoverHitTest'
import { createEmptyMap, addWall, addToken, addProp, addRegion, addRoom, addDrawing } from './mapFactory'
import type { Drawing, Region, Token, Wall } from '../types/map'
import type { AreaSelection } from './areaSelection'
import { EMPTY_AREA_SELECTION } from './areaSelection'
import { ROOM_ROTATE_HANDLE } from './roomRotation'

const baseMap = createEmptyMap('m1', 'Mapa', 1000, 1000, 50)

function buildToken(id: string, overrides: Partial<Token> = {}): Token {
  return { id, characterId: null, name: 'Herói', x: 50, y: 50, size: 1, image: null, ...overrides }
}

function buildSquareRegion(id: string, overrides: Partial<Region> = {}): Region {
  return {
    id,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
    ...overrides,
  }
}

describe('resolveHoverHit — ferramenta fora de select/token', () => {
  it('ferramenta de criação (ex.: parede): nunca produz hover, mesmo em cima de um token real', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const result = resolveHoverHit({ map, selection: null, areaSelection: null, activeTool: 'wall', worldPoint: { x: 50, y: 50 } })
    expect(result).toEqual({ kind: 'none', corner: null, target: null })
  })
})

describe('resolveHoverHit — hit genérico (fim da cadeia)', () => {
  it('nada sob o cursor: none, sem target', () => {
    const result = resolveHoverHit({ map: baseMap, selection: null, areaSelection: null, activeTool: 'select', worldPoint: { x: 900, y: 900 } })
    expect(result).toEqual({ kind: 'none', corner: null, target: null })
  })

  it('hover sobre token sem nada selecionado: selectable, target aponta pro token', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const result = resolveHoverHit({ map, selection: null, areaSelection: null, activeTool: 'select', worldPoint: { x: 50, y: 50 } })
    expect(result).toEqual({ kind: 'selectable', corner: null, target: { kind: 'token', id: 't1' } })
  })

  it('hover sobre a ferramenta "token" (não só "select"): mesmo comportamento de select', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const result = resolveHoverHit({ map, selection: null, areaSelection: null, activeTool: 'token', worldPoint: { x: 50, y: 50 } })
    expect(result).toEqual({ kind: 'selectable', corner: null, target: { kind: 'token', id: 't1' } })
  })

  it('hover sobre a entidade JÁ selecionada: kind continua selectable (cursor correto) mas target é null — sem anel duplicado sobre quem já tem contorno de SELECIONADO', () => {
    const wall: Wall = { id: 'w1', x1: 0, y1: 60, x2: 100, y2: 60, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(baseMap, wall)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'wall', id: 'w1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 50, y: 60 }, // meio da parede — longe das 2 pontas, não aciona o ramo 'vertex'
    })
    expect(result).toEqual({ kind: 'selectable', corner: null, target: null })
  })

  it('token com hidden=true (oculto no editor por item, não por camada): hitTestMap filtra — não vira target', () => {
    const map = addToken(baseMap, buildToken('t1', { hidden: true }))
    const result = resolveHoverHit({ map, selection: null, areaSelection: null, activeTool: 'select', worldPoint: { x: 50, y: 50 } })
    expect(result).toEqual({ kind: 'none', corner: null, target: null })
  })

  it('seleção aponta pra id que não existe mais no mapa (apagado): não quebra, cai no hit genérico normalmente', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const result = resolveHoverHit({
      map,
      selection: { kind: 'token', id: 'fantasma' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 50, y: 50 },
    })
    expect(result).toEqual({ kind: 'selectable', corner: null, target: { kind: 'token', id: 't1' } })
  })
})

describe('resolveHoverHit — resize-corner (entidade já selecionada)', () => {
  it('token selecionado, hover sobre o canto baixo-direita da caixa: resize-corner 2, sem target', () => {
    const map = addToken(baseMap, buildToken('t1'))
    // grid=50, size=1 → meio-lado 25 → caixa (25,25)-(75,75)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'token', id: 't1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 75, y: 75 },
    })
    expect(result).toEqual({ kind: 'resize-corner', corner: 2, target: null })
  })

  it('prop selecionado, hover sobre canto topo-esquerda: resize-corner 0, sem target', () => {
    const map = addProp(baseMap, { id: 'p1', src: 'x.png', x: 100, y: 100, width: 40, height: 40, linkedMapPath: null })
    const result = resolveHoverHit({
      map,
      selection: { kind: 'prop', id: 'p1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 80, y: 80 }, // canto minX,minY = (80,80)
    })
    expect(result).toEqual({ kind: 'resize-corner', corner: 0, target: null })
  })

  it('Drawing rect selecionado, hover sobre canto: resize-corner, sem target', () => {
    const drawing: Drawing = { id: 'd1', kind: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const map = addDrawing(baseMap, drawing)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'drawing', id: 'd1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 100, y: 50 }, // canto maxX,maxY
    })
    expect(result).toEqual({ kind: 'resize-corner', corner: 2, target: null })
  })

  it('Sala retangular (region.room.shape rect) selecionada por si mesma, hover no canto: resize-corner via findRoomCornerAt', () => {
    const region = buildSquareRegion('r1', { room: { shape: 'rect', name: 'Sala' } })
    const map = addRegion(baseMap, region)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'region', id: 'r1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 100, y: 100 }, // points[2]
    })
    expect(result).toEqual({ kind: 'resize-corner', corner: 2, target: null })
  })

  it('Sala selecionada por uma de suas PAREDES (wall.regionId): mesmo resize-corner da região dona', () => {
    const region = buildSquareRegion('r1', { room: { shape: 'rect', name: 'Sala' } })
    const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 0 }
    const map = addRoom(baseMap, region, [wall])
    const result = resolveHoverHit({
      map,
      selection: { kind: 'wall', id: 'w1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 0, y: 0 }, // points[0]
    })
    expect(result).toEqual({ kind: 'resize-corner', corner: 0, target: null })
  })
})

describe('resolveHoverHit — vertex (ponto de controle da entidade já selecionada)', () => {
  it('Drawing curve selecionado, hover sobre ponto de controle do meio: vertex, sem target', () => {
    const curve: Drawing = { id: 'd1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], color: '#fff', width: 2 }
    const map = addDrawing(baseMap, curve)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'drawing', id: 'd1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 50, y: 0 },
    })
    expect(result).toEqual({ kind: 'vertex', corner: null, target: null })
  })

  it('parede solta (sem regionId) selecionada, hover sobre uma ponta: vertex, sem target', () => {
    const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(baseMap, wall)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'wall', id: 'w1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 0, y: 0 },
    })
    expect(result).toEqual({ kind: 'vertex', corner: null, target: null })
  })

  it('Região comum (sem room, ou room.shape polygon) selecionada, hover num vértice: vertex via findCurveControlPointAt', () => {
    const region = buildSquareRegion('r1')
    const map = addRegion(baseMap, region)
    const result = resolveHoverHit({
      map,
      selection: { kind: 'region', id: 'r1' },
      areaSelection: null,
      activeTool: 'select',
      worldPoint: { x: 0, y: 0 },
    })
    expect(result).toEqual({ kind: 'vertex', corner: null, target: null })
  })
})

// GIRAR SALA: a bolinha acima da Sala selecionada troca o cursor pela seta de
// girar — o mesmo teste do pointerdown, então o cursor nunca promete um giro
// que o clique não faria.
describe('resolveHoverHit — alça de girar sala', () => {
  const sala = buildSquareRegion('r1', { room: { shape: 'rect', name: 'Sala' } })
  // Quadrado 0..100: a bolinha fica acima do meio do topo (x 50, y 0).
  const bolinha = { x: 50, y: -ROOM_ROTATE_HANDLE.offsetPx }
  const pairar = (region: Region, worldPoint: { x: number; y: number }, cameraScale?: number) =>
    resolveHoverHit({
      map: addRegion(baseMap, region),
      selection: { kind: 'region', id: region.id },
      areaSelection: null,
      activeTool: 'select',
      worldPoint,
      cameraScale,
    })

  it('pairar na bolinha da Sala selecionada: rotate', () => {
    expect(pairar(sala, bolinha)).toEqual({ kind: 'rotate', corner: null, target: null })
  })

  it('a alça tem tamanho de TELA: com zoom 2 ela fica na metade da distância em px de mundo', () => {
    expect(pairar(sala, { x: 50, y: -ROOM_ROTATE_HANDLE.offsetPx / 2 }, 2)).toEqual({ kind: 'rotate', corner: null, target: null })
    expect(pairar(sala, bolinha, 2).kind).not.toBe('rotate')
  })

  it('Sala travada não tem alça, então não tem cursor de girar', () => {
    expect(pairar({ ...sala, locked: true }, bolinha).kind).not.toBe('rotate')
  })

  it('Sala travada não tem chip de canto, então o canto não promete redimensionar', () => {
    const canto = { x: 100, y: 100 }
    // Controle: destravada, o mesmo ponto é canto de verdade.
    expect(pairar(sala, canto)).toEqual({ kind: 'resize-corner', corner: 2, target: null })
    expect(pairar({ ...sala, locked: true }, canto).kind).not.toBe('resize-corner')
  })

  it('região comum travada: o vértice não promete arrastar', () => {
    const comum = buildSquareRegion('r1')
    expect(pairar(comum, { x: 0, y: 0 })).toEqual({ kind: 'vertex', corner: null, target: null })
    expect(pairar({ ...comum, locked: true }, { x: 0, y: 0 }).kind).not.toBe('vertex')
  })

  it('região comum não é Sala e não gira', () => {
    expect(pairar(buildSquareRegion('r1'), bolinha).kind).not.toBe('rotate')
  })

  it('Sala retangular girada torta: o canto não promete redimensionar (a conta a desmontaria)', () => {
    const torta: Region = {
      ...sala,
      points: [{ x: 50, y: -20.71 }, { x: 120.71, y: 50 }, { x: 50, y: 120.71 }, { x: -20.71, y: 50 }],
      room: { shape: 'rect', name: 'Sala', rotation: 45 },
    }
    expect(pairar(torta, { x: 120.71, y: 50 }).kind).not.toBe('resize-corner')
  })
})

describe('resolveHoverHit — área selecionada (marquee)', () => {
  it('hover dentro do bounding box do grupo de área selecionada: area-selection, sem target', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const areaSelection: AreaSelection = { ...EMPTY_AREA_SELECTION, tokens: ['t1'] }
    const result = resolveHoverHit({
      map,
      selection: null,
      areaSelection,
      activeTool: 'select',
      worldPoint: { x: 50, y: 50 },
    })
    expect(result).toEqual({ kind: 'area-selection', corner: null, target: null })
  })

  it('area-selection vazia (todo campo default, nenhum id): não é encontrada bounds nenhum — cai no hit genérico', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const result = resolveHoverHit({
      map,
      selection: null,
      areaSelection: EMPTY_AREA_SELECTION,
      activeTool: 'select',
      worldPoint: { x: 50, y: 50 },
    })
    expect(result).toEqual({ kind: 'selectable', corner: null, target: { kind: 'token', id: 't1' } })
  })
})

// ALÇAS COM ZOOM: a alça tem tamanho fixo na TELA, e o hover tem de achar a
// alça onde ela aparece — senão, com zoom abaixo de 1, o cursor de arrastar
// aparece em cima do quadradinho amarelo do canto.
describe('resolveHoverHit — área das alças acompanha o zoom', () => {
  const pairar = (map: typeof baseMap, selection: { kind: 'token' | 'region'; id: string }, worldPoint: { x: number; y: number }, cameraScale: number) =>
    resolveHoverHit({ map, selection, areaSelection: null, activeTool: 'select', worldPoint, cameraScale })

  // Token 25..75 (grade 50). A 0,25 o chip tem 22 px de mundo de meio-lado.
  const comToken = addToken(baseMap, buildToken('t1'))
  const tokenSel = { kind: 'token' as const, id: 't1' }

  it('zoom 0,25: pairar a 4 px de tela do canto, dentro do chip, promete redimensionar', () => {
    expect(pairar(comToken, tokenSel, { x: 41, y: 41 }, 0.25)).toEqual({ kind: 'resize-corner', corner: 0, target: null })
  })

  it('zoom 0,25: o centro do Token continua prometendo arrastar', () => {
    expect(pairar(comToken, tokenSel, { x: 50, y: 50 }, 0.25)).toEqual({ kind: 'selectable', corner: null, target: null })
  })

  it('zoom 0,5: a ponta diagonal do chip promete redimensionar', () => {
    expect(pairar(comToken, tokenSel, { x: 37, y: 37 }, 0.5)).toEqual({ kind: 'resize-corner', corner: 0, target: null })
    expect(pairar(comToken, tokenSel, { x: 39, y: 39 }, 0.5).kind).toBe('selectable')
  })

  it('zoom 0,25: vértice de região comum pega dentro da bolinha (14 px de mundo)', () => {
    const map = addRegion(baseMap, buildSquareRegion('r1'))
    expect(pairar(map, { kind: 'region', id: 'r1' }, { x: 12, y: 0 }, 0.25)).toEqual({ kind: 'vertex', corner: null, target: null })
  })

  it('zoom 0,25: canto de Sala pega a 7 px de tela', () => {
    const map = addRegion(baseMap, buildSquareRegion('r1', { room: { shape: 'rect', name: 'Sala' } }))
    expect(pairar(map, { kind: 'region', id: 'r1' }, { x: 20, y: 20 }, 0.25)).toEqual({ kind: 'resize-corner', corner: 0, target: null })
  })
})
