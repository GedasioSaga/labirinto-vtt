import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { drawHover } from '../pixi/drawHover'
import type { FloorPiece, MapData, Region, Token, Wall } from '../types/map'
import { selectEntitiesInArea } from './areaSelection'
import { buildBlocosShape, centroDoBloco, type Bloco } from './floorBlocks'
import { compileFloor } from './floorSdf'
import { baldeNoPonto, buildFloorPiece, findFloorPieceAt } from './floorTool'
import { resolveHoverHit, type HoverHitInput, type HoverTarget } from './hoverHitTest'
import { createEmptyMap } from './mapFactory'
import { apagarBlocosNoPiso, baldeNoPiso, camadaTravadaNoPiso, hoverNoPiso, pecaDeChaoNoPiso, selecaoDoLacoNoPiso } from './pisoEmEdicao'
import { mapaDoPiso, pisoDe } from './pisos'
import { findLockedLayerAt } from './selectionHitTest'

/**
 * PISOS NA MESMA CENA — cenário do revisor: a Biblioteca do 1º piso ocupa o
 * mesmo lugar do Hall do térreo. O mestre, editando o 1º piso, não vê o Hall;
 * nenhuma ferramenta que mira o mapa pode pegá-lo, furá-lo ou tropeçar nele.
 */
const CELL = 40

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, name: string, extra: Partial<Region> = {}): Region {
  const points = [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 900 },
    { x: 100, y: 900 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
}

const paredesDaSala = (prefixo: string, regionId: string, extra: Partial<Wall> = {}): Wall[] => [
  wall(`${prefixo}-n`, 100, 100, 900, 100, { regionId, ...extra }),
  wall(`${prefixo}-l`, 900, 100, 900, 900, { regionId, ...extra }),
  wall(`${prefixo}-s`, 900, 900, 100, 900, { regionId, ...extra }),
  wall(`${prefixo}-o`, 100, 900, 100, 100, { regionId, ...extra }),
]

/** Quadrado de células de `de` a `ate` (inclusive); `oco` deixa só a borda. */
function quadrado(de: number, ate: number, oco = false): Bloco[] {
  const out: Bloco[] = []
  for (let col = de; col <= ate; col += 1) {
    for (let row = de; row <= ate; row += 1) {
      const borda = col === de || col === ate || row === de || row === ate
      if (!oco || borda) out.push({ col, row })
    }
  }
  return out
}

function pecaDeBlocos(id: string, blocos: Bloco[], extra: Partial<FloorPiece> = {}): FloorPiece {
  const shape = buildBlocosShape(CELL, blocos)
  if (shape === null) throw new Error('quadrado sem célula')
  return { ...buildFloorPiece(id, shape, 'add'), ...extra }
}

function torre(): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 25, 25, CELL),
    regions: [sala('hall', 'Hall de entrada'), sala('biblioteca', 'Biblioteca', { piso: 1 })],
    walls: [...paredesDaSala('hall', 'hall'), ...paredesDaSala('bib', 'biblioteca', { piso: 1 })],
  }
}

const temChaoEm = (floor: FloorPiece[], bloco: Bloco): boolean => {
  const centro = centroDoBloco(bloco, CELL)
  return compileFloor(floor).sample(centro.x, centro.y) < 0
}

const CENTRO: Bloco = { col: 4, row: 4 }
const LACO = { x1: 50, y1: 50, x2: 950, y2: 950 }

describe('selecaoDoLacoNoPiso — o laço pega só o piso em edição', () => {
  it('no 1º piso, o laço sobre a Biblioteca não leva o Hall nem as paredes hall-*', () => {
    const map = torre()
    // O defeito: o laço sobre o mapa inteiro levava o térreo junto.
    const antigo = selectEntitiesInArea(map, LACO)
    expect(antigo.regions).toContain('hall')

    const selecao = selecaoDoLacoNoPiso(map, 1, LACO)
    const ids = selecao.map((item) => item.id)
    expect(ids).toContain('biblioteca')
    expect(ids).toEqual(expect.arrayContaining(['bib-n', 'bib-l', 'bib-s', 'bib-o']))
    expect(ids).not.toContain('hall')
    expect(ids.filter((id) => id.startsWith('hall'))).toEqual([])
  })

  it('no térreo, o laço leva o Hall e não a Biblioteca', () => {
    const ids = selecaoDoLacoNoPiso(torre(), 0, LACO).map((item) => item.id)
    expect(ids).toEqual(expect.arrayContaining(['hall', 'hall-n', 'hall-l', 'hall-s', 'hall-o']))
    expect(ids.filter((id) => id === 'biblioteca' || id.startsWith('bib'))).toEqual([])
  })

  it('mapa sem pisos: o laço no térreo é o laço de sempre', () => {
    const semPisos: MapData = { ...createEmptyMap('m', 'M', 25, 25, CELL), regions: [sala('hall', 'Hall')], walls: paredesDaSala('hall', 'hall') }
    const esperado = selectEntitiesInArea(semPisos, LACO)
    const ids = selecaoDoLacoNoPiso(semPisos, 0, LACO).map((item) => item.id)
    expect(ids).toEqual([...esperado.walls, ...esperado.regions])
  })
})

describe('baldeNoPiso — "já tem chão" é o chão do piso em edição', () => {
  it('no 1º piso, o balde enche o miolo do anel mesmo com chão do térreo embaixo', () => {
    const map: MapData = {
      ...torre(),
      floor: [pecaDeBlocos('chao-hall', quadrado(2, 6)), pecaDeBlocos('anel-bib', quadrado(2, 6, true), { piso: 1 })],
    }
    const ponto = centroDoBloco(CENTRO, CELL)
    // O defeito: sobre o mapa inteiro, o térreo já tem chão ali e o balde recusava.
    expect(baldeNoPonto(map, ponto, () => 'x')).toBeNull()

    const peca = baldeNoPiso(map, 1, ponto, () => 'miolo')
    expect(peca?.id).toBe('miolo')
    expect(peca?.shape.kind).toBe('blocos')
    expect(peca !== null && temChaoEm([peca], CENTRO)).toBe(true)
  })

  it('no térreo, onde já tem chão, o balde continua recusando', () => {
    const map: MapData = { ...torre(), floor: [pecaDeBlocos('chao-hall', quadrado(2, 6))] }
    expect(baldeNoPiso(map, 0, centroDoBloco(CENTRO, CELL), () => 'x')).toBeNull()
  })
})

describe('pecaDeChaoNoPiso — clique só acha o chão do piso em edição', () => {
  it('no 1º piso, o clique sobre o chão invisível do térreo não acha peça nenhuma', () => {
    const map: MapData = { ...torre(), floor: [pecaDeBlocos('chao-hall', quadrado(2, 6))] }
    const ponto = centroDoBloco(CENTRO, CELL)
    expect(findFloorPieceAt(map, ponto)?.id).toBe('chao-hall')
    expect(pecaDeChaoNoPiso(map, 1, ponto)).toBeNull()
    expect(pecaDeChaoNoPiso(map, 0, ponto)?.id).toBe('chao-hall')
  })

  it('com chão nos dois pisos, cada piso acha o dele', () => {
    const map: MapData = {
      ...torre(),
      floor: [pecaDeBlocos('chao-hall', quadrado(2, 6)), pecaDeBlocos('chao-bib', quadrado(2, 6), { piso: 1 })],
    }
    const ponto = centroDoBloco(CENTRO, CELL)
    expect(pecaDeChaoNoPiso(map, 1, ponto)?.id).toBe('chao-bib')
    expect(pecaDeChaoNoPiso(map, 0, ponto)?.id).toBe('chao-hall')
  })
})

describe('apagarBlocosNoPiso — a borracha fura só o chão do piso em edição', () => {
  it('no 1º piso, apagar blocos corta a peça da Biblioteca e deixa o Hall inteiro', () => {
    const map: MapData = {
      ...torre(),
      floor: [pecaDeBlocos('chao-hall', quadrado(2, 6)), pecaDeBlocos('chao-bib', quadrado(2, 6), { piso: 1 })],
    }
    const depois = apagarBlocosNoPiso(map, 1, [CENTRO], CELL, () => 'buraco')
    const hall = depois.floor.find((p) => p.id === 'chao-hall')
    const bib = depois.floor.find((p) => p.id === 'chao-bib')
    expect(hall).toBe(map.floor[0])
    expect(bib?.shape.kind === 'blocos' ? bib.shape.cells.length : -1).toBe(24)
    expect(pisoDe(bib ?? { piso: -1 })).toBe(1)
    expect(depois.floor.map((p) => p.id)).toEqual(['chao-hall', 'chao-bib'])
    expect(temChaoEm(mapaDoPiso(depois, 0).floor, CENTRO)).toBe(true)
    expect(temChaoEm(mapaDoPiso(depois, 1).floor, CENTRO)).toBe(false)
  })

  it('no 1º piso, sobre chão só do térreo, não apaga nada e devolve o próprio mapa', () => {
    const map: MapData = { ...torre(), floor: [pecaDeBlocos('chao-hall', quadrado(2, 6))] }
    expect(apagarBlocosNoPiso(map, 1, [CENTRO], CELL, () => 'buraco')).toBe(map)
  })

  it('chão de outra forma no 1º piso: o buraco nasce NO 1º piso e o térreo segue com chão', () => {
    const tapete: FloorPiece = { id: 'tapete', op: 'add', shape: { kind: 'rect', cx: 180, cy: 180, w: 200, h: 200 }, modifiers: {}, piso: 1 }
    const map: MapData = { ...torre(), floor: [pecaDeBlocos('chao-hall', quadrado(2, 6)), tapete] }
    const depois = apagarBlocosNoPiso(map, 1, [CENTRO], CELL, () => 'buraco')
    const buraco = depois.floor.find((p) => p.id === 'buraco')
    expect(buraco?.op).toBe('subtract')
    expect(buraco?.piso).toBe(1)
    expect(depois.floor.find((p) => p.id === 'chao-hall')).toBe(map.floor[0])
    expect(temChaoEm(mapaDoPiso(depois, 0).floor, CENTRO)).toBe(true)
    expect(temChaoEm(mapaDoPiso(depois, 1).floor, CENTRO)).toBe(false)
  })

  it('peças de outros pisos ficam na mesma posição da lista', () => {
    const map: MapData = {
      ...torre(),
      floor: [
        pecaDeBlocos('a-terreo', quadrado(10, 12)),
        pecaDeBlocos('b-bib', quadrado(2, 6), { piso: 1 }),
        pecaDeBlocos('c-terreo', quadrado(2, 6)),
        pecaDeBlocos('d-bib', quadrado(14, 15), { piso: 1 }),
      ],
    }
    const depois = apagarBlocosNoPiso(map, 1, quadrado(2, 6), CELL, () => 'buraco')
    // A peça b-bib inteira apagada sai; as do térreo não andam de posição.
    expect(depois.floor.map((p) => p.id)).toEqual(['a-terreo', 'c-terreo', 'd-bib'])
    expect(depois.floor[1]).toBe(map.floor[2])
  })
})

/** Ficha no centro da torre (500,500): em cima do Hall e da Biblioteca. */
function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 500, y: 500, size: 1, image: null, ...extra }
}

const MEIO = { x: 500, y: 500 }

/** O guarda fica no térreo; o mestre edita a torre com a ferramenta Selecionar. */
function torreComGuarda(extra: Partial<MapData> = {}): MapData {
  return { ...torre(), tokens: [ficha('guarda')], ...extra }
}

const hoverEm = (map: MapData): HoverHitInput => ({ map, selection: null, areaSelection: null, activeTool: 'select', worldPoint: MEIO })

/** Instruções de contorno de fato empilhadas no Graphics (mesmo padrão de drawHover.test.ts). */
const contornos = (g: Graphics) => g.context.instructions.filter((instrucao) => instrucao.action === 'stroke')

describe('hoverNoPiso — o hover só aponta o que está no piso em edição', () => {
  it('no 1º piso, sobre o guarda do térreo, o hover aponta a Biblioteca, não o guarda', () => {
    const map = torreComGuarda()
    // O defeito: sobre o mapa inteiro, o hover prometia o guarda invisível.
    expect(resolveHoverHit(hoverEm(map)).target).toEqual({ kind: 'token', id: 'guarda' })

    const hover = hoverNoPiso(hoverEm(map), 1)
    expect(hover.kind).toBe('selectable')
    expect(hover.target).toEqual({ kind: 'region', id: 'biblioteca' })
  })

  it('no térreo, o mesmo ponto aponta o guarda', () => {
    expect(hoverNoPiso(hoverEm(torreComGuarda()), 0).target).toEqual({ kind: 'token', id: 'guarda' })
  })

  it('ficha do 1º piso no mesmo lugar: cada piso aponta a sua', () => {
    const map = torreComGuarda({ tokens: [ficha('guarda'), ficha('arqueiro', { piso: 1 })] })
    expect(hoverNoPiso(hoverEm(map), 1).target).toEqual({ kind: 'token', id: 'arqueiro' })
    expect(hoverNoPiso(hoverEm(map), 0).target).toEqual({ kind: 'token', id: 'guarda' })
  })

  it('piso vazio no ponto: nada clicável, cursor comum', () => {
    const map: MapData = { ...createEmptyMap('m', 'M', 25, 25, CELL), tokens: [ficha('guarda')] }
    expect(hoverNoPiso(hoverEm(map), 1)).toEqual({ kind: 'none', corner: null, target: null })
  })

  it('o anel de hover desenhado a partir do piso em edição não desenha o guarda do térreo', () => {
    const map = torreComGuarda()
    const alvo: HoverTarget = { kind: 'token', id: 'guarda' }
    const inteiro = new Graphics()
    drawHover(inteiro, map, alvo)
    // O defeito: o mapa inteiro tem o guarda e desenhava o anel dele.
    expect(contornos(inteiro)).toHaveLength(1)

    const doPiso = new Graphics()
    drawHover(doPiso, mapaDoPiso(map, 1), alvo)
    expect(contornos(doPiso)).toHaveLength(0)
    const bib = new Graphics()
    drawHover(bib, mapaDoPiso(map, 1), { kind: 'region', id: 'biblioteca' })
    expect(contornos(bib)).toHaveLength(1)
  })
})

describe('camadaTravadaNoPiso — só o item do piso em edição barra o gesto', () => {
  it('no 1º piso, Fichas travada e o guarda do térreo embaixo: o clique não é barrado', () => {
    const map = torreComGuarda({ lockedLayers: ['tokens'] })
    // O defeito: sobre o mapa inteiro, o guarda invisível barrava o clique.
    expect(findLockedLayerAt(map, MEIO)).toBe('tokens')

    expect(camadaTravadaNoPiso(map, 1, MEIO)).toBeNull()
  })

  it('no térreo, o guarda em camada travada continua barrando', () => {
    expect(camadaTravadaNoPiso(torreComGuarda({ lockedLayers: ['tokens'] }), 0, MEIO)).toBe('tokens')
  })

  it('ficha do 1º piso em camada travada barra no 1º piso', () => {
    const map = torreComGuarda({ tokens: [ficha('arqueiro', { piso: 1 })], lockedLayers: ['tokens'] })
    expect(camadaTravadaNoPiso(map, 1, MEIO)).toBe('tokens')
    expect(camadaTravadaNoPiso(map, 0, MEIO)).toBeNull()
  })

  it('sem camada travada: nada barra, em piso nenhum', () => {
    const map = torreComGuarda()
    expect(camadaTravadaNoPiso(map, 0, MEIO)).toBeNull()
    expect(camadaTravadaNoPiso(map, 1, MEIO)).toBeNull()
  })
})
