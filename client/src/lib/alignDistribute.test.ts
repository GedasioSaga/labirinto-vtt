import { describe, expect, it } from 'vitest'
import { alignSelectionItems, distributeSelectionItems, alignableUnitCount } from './alignDistribute'
import { createEmptyMap } from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'
import type { Drawing, MapData, Prop, Token } from '../types/map'
import type { SelectionItem } from './selectionModel'

const LADO = 60

function pilar(id: string, x: number, y: number): Drawing {
  return { id, kind: 'rect', x, y, w: LADO, h: LADO, color: '#d21e1e', width: 2, filled: true, fillAlpha: 1 }
}

/** Os três pilares tortos da régua e2e (mesmas coordenadas). */
function mapaDosPilares(): MapData {
  const base = createEmptyMap('m', 'Pátio', 20, 16, 50)
  return { ...base, drawings: [pilar('v', 250, 230), pilar('a', 380, 320), pilar('m', 800, 600)] }
}

const TRES: SelectionItem[] = [
  { kind: 'drawing', id: 'v' },
  { kind: 'drawing', id: 'a' },
  { kind: 'drawing', id: 'm' },
]

function rect(map: MapData, id: string): { x: number; y: number } {
  const d = map.drawings.find((item) => item.id === id)
  if (!d || d.kind !== 'rect') throw new Error(`sem retângulo ${id}`)
  return { x: d.x, y: d.y }
}

describe('alignSelectionItems', () => {
  it('à esquerda: todos vão para a borda esquerda do mais à esquerda; y não muda', () => {
    const next = alignSelectionItems(mapaDosPilares(), TRES, 'left')
    expect(rect(next, 'v')).toEqual({ x: 250, y: 230 })
    expect(rect(next, 'a')).toEqual({ x: 250, y: 320 })
    expect(rect(next, 'm')).toEqual({ x: 250, y: 600 })
  })

  it('à direita: a borda direita de todos vai para a do mais à direita', () => {
    const next = alignSelectionItems(mapaDosPilares(), TRES, 'right')
    expect(rect(next, 'v').x).toBe(800)
    expect(rect(next, 'a').x).toBe(800)
    expect(rect(next, 'm')).toEqual({ x: 800, y: 600 })
  })

  it('ao centro: os centros ficam na mesma vertical, no centro da caixa do conjunto', () => {
    const next = alignSelectionItems(mapaDosPilares(), TRES, 'center')
    // Caixa do conjunto: 250..860 → centro 555 → canto 525.
    for (const id of ['v', 'a', 'm']) expect(rect(next, id).x).toBe(525)
    expect(rect(next, 'a').y).toBe(320)
  })

  it('ao topo, ao meio e à base alinham no eixo vertical sem mexer em x', () => {
    const topo = alignSelectionItems(mapaDosPilares(), TRES, 'top')
    expect(['v', 'a', 'm'].map((id) => rect(topo, id).y)).toEqual([230, 230, 230])
    expect(rect(topo, 'm').x).toBe(800)

    const meio = alignSelectionItems(mapaDosPilares(), TRES, 'middle')
    // Caixa 230..660 → meio 445 → canto 415.
    expect(['v', 'a', 'm'].map((id) => rect(meio, id).y)).toEqual([415, 415, 415])

    const base = alignSelectionItems(mapaDosPilares(), TRES, 'bottom')
    expect(['v', 'a', 'm'].map((id) => rect(base, id).y)).toEqual([600, 600, 600])
    expect(rect(base, 'v').x).toBe(250)
  })

  it('alinha tipos de centro (Token, Objeto) pela caixa deles, não pelo ponto guardado', () => {
    const base = createEmptyMap('m', 'x', 20, 16, 50)
    const token: Token = { id: 't', characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null }
    const prop: Prop = { id: 'p', src: '/a.png', x: 300, y: 300, width: 40, height: 40, linkedMapPath: null }
    const map: MapData = { ...base, tokens: [token], props: [prop] }
    const next = alignSelectionItems(map, [{ kind: 'token', id: 't' }, { kind: 'prop', id: 'p' }], 'left')
    // Token de raio 25 em x=100 → borda esquerda 75; o objeto (meia largura 20) vai para centro 95.
    expect(next.tokens[0].x).toBe(100)
    expect(next.props[0].x).toBe(95)
    expect(next.props[0].y).toBe(300)
  })

  it('Sala e as paredes dela contam como UM item e andam juntas uma vez só', () => {
    const base = createEmptyMap('m', 'x', 20, 16, 50)
    const room = buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 100, y: 100 }, { x: 200, y: 200 })
    const map: MapData = { ...base, regions: [room.region], walls: room.walls, drawings: [pilar('v', 400, 50)] }
    const items: SelectionItem[] = [
      { kind: 'region', id: 'r1' },
      ...room.walls.map((w): SelectionItem => ({ kind: 'wall', id: w.id })),
      { kind: 'drawing', id: 'v' },
    ]
    expect(alignableUnitCount(map, items)).toBe(2)
    const next = alignSelectionItems(map, items, 'top')
    const ys = next.regions[0].points.map((p) => p.y)
    expect(Math.min(...ys)).toBe(50)
    expect(Math.max(...ys)).toBe(150)
    for (const wall of next.walls) {
      expect(Math.min(wall.y1, wall.y2)).toBeGreaterThanOrEqual(50)
      expect(Math.max(wall.y1, wall.y2)).toBeLessThanOrEqual(150)
    }
  })

  it('com menos de 2 itens devolve o MESMO mapa (nada a alinhar)', () => {
    const map = mapaDosPilares()
    expect(alignSelectionItems(map, [TRES[0]], 'left')).toBe(map)
    expect(alignSelectionItems(map, [], 'left')).toBe(map)
  })

  it('já alinhados devolve o MESMO mapa (nenhum passo vazio no desfazer)', () => {
    const map = alignSelectionItems(mapaDosPilares(), TRES, 'left')
    expect(alignSelectionItems(map, TRES, 'left')).toBe(map)
  })

  it('ignora id que não existe mais no mapa', () => {
    const map = mapaDosPilares()
    const next = alignSelectionItems(map, [...TRES, { kind: 'token', id: 'sumiu' }], 'left')
    expect(rect(next, 'm').x).toBe(250)
  })
})

describe('distributeSelectionItems', () => {
  it('na horizontal: as pontas ficam e o do meio vai para o espaço igual; y não muda', () => {
    const next = distributeSelectionItems(mapaDosPilares(), TRES, 'horizontal')
    expect(rect(next, 'v')).toEqual({ x: 250, y: 230 })
    expect(rect(next, 'm')).toEqual({ x: 800, y: 600 })
    // Vão total 860-250=610, menos 3×60 = 430 → 215 de cada lado → canto do meio em 525.
    expect(rect(next, 'a')).toEqual({ x: 525, y: 320 })
  })

  it('na vertical: as pontas ficam e o do meio vai para o espaço igual; x não muda', () => {
    const next = distributeSelectionItems(mapaDosPilares(), TRES, 'vertical')
    expect(rect(next, 'v')).toEqual({ x: 250, y: 230 })
    expect(rect(next, 'm')).toEqual({ x: 800, y: 600 })
    // 660-230=430, menos 180 = 250 → 125 de cada lado → topo do meio em 415.
    expect(rect(next, 'a')).toEqual({ x: 380, y: 415 })
  })

  it('ordena pela posição, não pela ordem da seleção', () => {
    const embaralhado: SelectionItem[] = [TRES[2], TRES[1], TRES[0]]
    const next = distributeSelectionItems(mapaDosPilares(), embaralhado, 'horizontal')
    expect(rect(next, 'v').x).toBe(250)
    expect(rect(next, 'a').x).toBe(525)
    expect(rect(next, 'm').x).toBe(800)
  })

  it('com 2 itens devolve o MESMO mapa (distribuir precisa de 3)', () => {
    const map = mapaDosPilares()
    expect(distributeSelectionItems(map, TRES.slice(0, 2), 'horizontal')).toBe(map)
  })
})

describe('veículo na seleção: quem está a bordo anda UMA vez só', () => {
  function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
    return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
  }

  /** Cesto de 2 lugares em (320,320) com o Gui a bordo em (256,400) — o repro do revisor. */
  function cestoComGui(extra: Token[] = []): MapData {
    const base = createEmptyMap('a06', 'Poço', 20, 20, 64)
    const cesto = ficha('cesto', 320, 320, { veiculo: { lugares: 2, passageiros: ['gui'] } })
    return { ...base, tokens: [cesto, ficha('gui', 256, 400), ...extra] }
  }

  const x = (map: MapData, id: string) => map.tokens.find((t) => t.id === id)?.x
  const aBordo = (map: MapData) => map.tokens.find((t) => t.id === 'cesto')?.veiculo?.passageiros

  const CESTO_E_GUI: SelectionItem[] = [
    { kind: 'token', id: 'cesto' },
    { kind: 'token', id: 'gui' },
  ]

  it('alinhar à esquerda o cesto e o Gui: cada um vai para a borda uma vez e o Gui continua a bordo', () => {
    const next = alignSelectionItems(cestoComGui(), CESTO_E_GUI, 'left')
    expect(x(next, 'gui')).toBe(256)
    expect(x(next, 'cesto')).toBe(256)
    expect(aBordo(next)).toEqual(['gui'])
  })

  it('distribuir com o cesto no meio e o Gui na ponta: o Gui fica parado e continua a bordo', () => {
    const base = cestoComGui([ficha('bia', 100, 100)])
    const map: MapData = { ...base, tokens: base.tokens.map((t) => (t.id === 'gui' ? { ...t, x: 500 } : t.id === 'cesto' ? { ...t, x: 200 } : t)) }
    const next = distributeSelectionItems(map, [...CESTO_E_GUI, { kind: 'token', id: 'bia' }], 'horizontal')
    expect(x(next, 'bia')).toBe(100)
    expect(x(next, 'cesto')).toBe(300)
    expect(x(next, 'gui')).toBe(500)
    expect(aBordo(next)).toEqual(['gui'])
  })

  it('o cesto alinhado SEM o Gui na seleção ainda leva o Gui junto', () => {
    const map = cestoComGui([ficha('bia', 128, 100)])
    const next = alignSelectionItems(map, [{ kind: 'token', id: 'cesto' }, { kind: 'token', id: 'bia' }], 'left')
    expect(x(next, 'cesto')).toBe(128)
    expect(x(next, 'gui')).toBe(64)
    expect(aBordo(next)).toEqual(['gui'])
  })

  it('o Gui alinhado SEM o cesto desce dele, como no arrasto', () => {
    const map = cestoComGui([ficha('bia', 128, 100)])
    const next = alignSelectionItems(map, [{ kind: 'token', id: 'gui' }, { kind: 'token', id: 'bia' }], 'left')
    expect(x(next, 'gui')).toBe(128)
    expect(x(next, 'cesto')).toBe(320)
    expect(aBordo(next)).toBeUndefined()
  })

  it('cesto e Gui já alinhados devolvem o MESMO mapa (nenhum passo vazio no desfazer)', () => {
    const base = cestoComGui()
    const map: MapData = { ...base, tokens: base.tokens.map((t) => (t.id === 'cesto' ? { ...t, x: 256 } : t)) }
    expect(alignSelectionItems(map, CESTO_E_GUI, 'left')).toBe(map)
  })
})
