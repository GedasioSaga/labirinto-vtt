import { describe, expect, it } from 'vitest'
import { buildColorLayers } from '../pixi/drawFloor'
import type { FloorPiece, MapData, Token, Wall } from '../types/map'
import { linhasDeCamada, proximoNomeDeCamada } from './camadasDoChao'
import { alvoDoPincel, apagarNaCamada, corDoPincel, encherNaCamada, NOVA_CAMADA, pintarNaCamada } from './camadasDoPincel'
import { buildBlocosShape, centroDoBloco, type Bloco } from './floorBlocks'
import { compileFloor } from './floorSdf'
import { buildFloorPiece } from './floorTool'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * CAMADAS DO PINCEL (pedido de 03/10/2026: "crie camadas para as ferramentas
 * de pincel, uma fica em cima da outra"). Cada camada é uma peça de blocos; o
 * pincel e o balde pintam só na ativa, e a de cima cobre a de baixo sem apagar.
 */

const CELL = 40
const AGUA = '#2f6690'
const GRAMA = '#4a6b35'

function blocos(...pares: [number, number][]): Bloco[] {
  return pares.map(([col, row]) => ({ col, row }))
}

function faixa(row: number, de: number, ate: number): Bloco[] {
  const out: Bloco[] = []
  for (let col = de; col <= ate; col += 1) out.push({ col, row })
  return out
}

function camada(id: string, cells: Bloco[], extra: Partial<FloorPiece> = {}): FloorPiece {
  const shape = buildBlocosShape(CELL, cells)
  if (!shape) throw new Error('camada sem célula')
  return { ...buildFloorPiece(id, shape, 'add'), ...extra }
}

function mapa(floor: FloorPiece[] = [], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('m', 'Teste', 20, 15, CELL), floor, walls }
}

let contador = 0
const opcoes = (cor: string | null = null) => ({ novoId: () => `nova-${(contador += 1)}`, cor })

function celulasDe(map: MapData, id: string): string[] {
  const peca = map.floor.find((p) => p.id === id)
  if (peca?.shape.kind !== 'blocos') return []
  return peca.shape.cells.map((c) => `${c.col},${c.row}`).sort()
}

function temChao(pecas: FloorPiece[], col: number, row: number): boolean {
  const c = centroDoBloco({ col, row }, CELL)
  return compileFloor(pecas).sample(c.x, c.y) < 0
}

describe('pintarNaCamada — o pincel pinta só na camada ativa', () => {
  it('primeira pincelada num mapa sem camada cria a "Camada 1" com a tinta escolhida, e ela vira a ativa', () => {
    const r = pintarNaCamada(mapa(), 0, null, faixa(2, 1, 3), CELL, opcoes(AGUA))
    expect(r.map.floor).toHaveLength(1)
    expect(r.map.floor[0]).toMatchObject({ nome: 'Camada 1', fillColor: AGUA, op: 'add', shape: { kind: 'blocos' } })
    expect(r.ativaId).toBe(r.map.floor[0].id)
  })

  it('pintar na ativa soma nela e NÃO mexe na outra camada, nem onde as duas se cruzam', () => {
    const baixo = camada('agua', faixa(5, 0, 9), { fillColor: AGUA })
    const cima = camada('grama', faixa(1, 0, 2), { fillColor: GRAMA })
    const antes = mapa([baixo, cima])
    const r = pintarNaCamada(antes, 0, 'grama', [...faixa(5, 3, 5), ...blocos([0, 1])], CELL, opcoes())
    // A de baixo é a MESMA peça: a pincelada por cima não tirou bloco nenhum dela.
    expect(r.map.floor[0]).toBe(baixo)
    expect(celulasDe(r.map, 'grama')).toEqual(['0,1', '1,1', '2,1', '3,5', '4,5', '5,5'])
    expect(r.ativaId).toBe('grama')
  })

  it('pincelada que só repassa por células já pintadas da ativa devolve o próprio mapa (sem Ctrl+Z à toa)', () => {
    const antes = mapa([camada('agua', faixa(5, 0, 3))])
    expect(pintarNaCamada(antes, 0, 'agua', faixa(5, 1, 2), CELL, opcoes()).map).toBe(antes)
  })

  it('"Nova camada" abre uma camada nova no topo, com o próximo número', () => {
    const antes = mapa([camada('agua', faixa(5, 0, 3), { fillColor: AGUA })])
    const r = pintarNaCamada(antes, 0, NOVA_CAMADA, faixa(5, 2, 4), CELL, opcoes(GRAMA))
    expect(r.map.floor.map((p) => p.nome ?? null)).toEqual([null, 'Camada 2'])
    expect(r.map.floor[1].fillColor).toBe(GRAMA)
    expect(r.ativaId).toBe(r.map.floor[1].id)
    expect(r.map.floor[0]).toBe(antes.floor[0])
  })

  it('a camada de CIMA cobre a de baixo onde as duas têm bloco, e a de baixo continua inteira por baixo', () => {
    const agua = camada('agua', faixa(5, 0, 5), { fillColor: AGUA })
    const grama = camada('grama', faixa(5, 3, 8), { fillColor: GRAMA })
    const camadas = buildColorLayers([agua, grama], undefined)
    // Ordem de pintura: a água primeiro, a grama por cima.
    expect(camadas.map((c) => c.color)).toEqual([AGUA, GRAMA])
    // A água não perdeu o pedaço que a grama cobre (sem tirar bloco).
    expect(temChao([agua], 4, 5)).toBe(true)
    expect(temChao([grama], 4, 5)).toBe(true)
  })

  it('camada travada ou escondida recusa a tinta e diz o nome dela', () => {
    const travada = mapa([camada('agua', faixa(5, 0, 3), { locked: true })])
    const r1 = pintarNaCamada(travada, 0, 'agua', faixa(6, 0, 3), CELL, opcoes())
    expect(r1).toMatchObject({ recusa: 'travada', nome: 'Camada 1' })
    expect(r1.map).toBe(travada)

    const escondida = mapa([camada('agua', faixa(5, 0, 3), { hidden: true, nome: 'Água' })])
    const r2 = pintarNaCamada(escondida, 0, 'agua', faixa(6, 0, 3), CELL, opcoes())
    expect(r2).toMatchObject({ recusa: 'escondida', nome: 'Água' })
    expect(r2.map).toBe(escondida)
  })

  it('no 1º piso a tinta cai na camada do 1º piso; a do térreo no mesmo lugar fica intocada', () => {
    const terreo = camada('terreo', faixa(5, 0, 3))
    const antes = mapa([terreo])
    const r = pintarNaCamada(antes, 1, null, faixa(5, 0, 3), CELL, opcoes())
    expect(r.map.floor[0]).toBe(terreo)
    expect(r.map.floor[1]).toMatchObject({ piso: 1, nome: 'Camada 2' })
  })
})

describe('apagarNaCamada — o botão direito apaga só na camada ativa', () => {
  it('as células saem da ativa; a outra camada no mesmo lugar fica', () => {
    const agua = camada('agua', faixa(5, 0, 5))
    const grama = camada('grama', faixa(5, 0, 5))
    const r = apagarNaCamada(mapa([agua, grama]), 0, 'grama', faixa(5, 0, 2), CELL, opcoes().novoId)
    expect(r.map.floor[0]).toBe(agua)
    expect(celulasDe(r.map, 'grama')).toEqual(['3,5', '4,5', '5,5'])
  })

  it('apagar onde a ativa não tem bloco não muda nada (mesmo com outra camada ali)', () => {
    const antes = mapa([camada('agua', faixa(5, 0, 5)), camada('grama', faixa(1, 0, 1))])
    expect(apagarNaCamada(antes, 0, 'grama', faixa(5, 0, 5), CELL, opcoes().novoId).map).toBe(antes)
  })

  it('a camada que fica sem bloco sai da lista e a ativa volta a ser a de cima', () => {
    const antes = mapa([camada('agua', faixa(5, 0, 1)), camada('grama', faixa(1, 0, 1))])
    const r = apagarNaCamada(antes, 0, 'grama', faixa(1, 0, 1), CELL, opcoes().novoId)
    expect(r.map.floor.map((p) => p.id)).toEqual(['agua'])
    expect(r.ativaId).toBeNull()
    expect(alvoDoPincel(r.map.floor, 0, r.ativaId)).toMatchObject({ tipo: 'camada', peca: { id: 'agua' } })
  })

  it('camada travada recusa a borracha', () => {
    const antes = mapa([camada('agua', faixa(5, 0, 3), { locked: true })])
    expect(apagarNaCamada(antes, 0, 'agua', faixa(5, 0, 1), CELL, opcoes().novoId)).toMatchObject({ recusa: 'travada', map: antes })
  })

  it('sem camada do pincel nenhuma, a borracha segue abrindo buraco no chão de outra forma (retângulo)', () => {
    const sala = buildFloorPiece('sala', { kind: 'rect', cx: 5 * CELL, cy: 5 * CELL, w: 4 * CELL, h: 4 * CELL }, 'add')
    const r = apagarNaCamada(mapa([sala]), 0, null, blocos([4, 4]), CELL, () => 'buraco')
    expect(r.map.floor.map((p) => [p.id, p.op])).toEqual([
      ['sala', 'add'],
      ['buraco', 'subtract'],
    ])
  })
})

/** Caixa de paredes fechada nas células col0..col1 × row0..row1 (bordas na grade). */
function caixa(col0: number, row0: number, col1: number, row1: number): Wall[] {
  const [x0, y0, x1, y1] = [col0 * CELL, row0 * CELL, (col1 + 1) * CELL, (row1 + 1) * CELL]
  const parede = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
    id,
    x1: ax,
    y1: ay,
    x2: bx,
    y2: by,
    blocksLight: true,
    blocksMove: true,
    door: null,
  })
  return [parede('n', x0, y0, x1, y0), parede('l', x1, y0, x1, y1), parede('s', x1, y1, x0, y1), parede('o', x0, y1, x0, y0)]
}

describe('encherNaCamada — o balde ignora a tinta das outras camadas e para na parede', () => {
  it('a tinta de OUTRA camada no meio da sala não segura o balde; a parede segura', () => {
    // Sala de paredes nas células 2..6 × 2..5; a água risca a sala ao meio.
    const agua = camada('agua', faixa(4, 0, 10), { fillColor: AGUA })
    const antes = mapa([agua], caixa(2, 2, 6, 5))
    const r = encherNaCamada(antes, 0, NOVA_CAMADA, centroDoBloco({ col: 3, row: 3 }, CELL), opcoes(GRAMA))
    const nova = r.map.floor[1]
    expect(nova).toMatchObject({ nome: 'Camada 2', fillColor: GRAMA })
    // Encheu por cima da faixa de água, dos dois lados dela...
    expect(temChao([nova], 4, 4)).toBe(true)
    expect(temChao([nova], 5, 5)).toBe(true)
    expect(temChao([nova], 2, 2)).toBe(true)
    // ...e não passou da parede.
    expect(temChao([nova], 8, 4)).toBe(false)
    expect(temChao([nova], 4, 7)).toBe(false)
    // A água ficou como estava.
    expect(r.map.floor[0]).toBe(agua)
  })

  it('a tinta da PRÓPRIA camada segura o balde (anel pintado, miolo cheio)', () => {
    const anel = [...faixa(2, 2, 6), ...faixa(6, 2, 6), ...blocos([2, 3], [2, 4], [2, 5], [6, 3], [6, 4], [6, 5])]
    const antes = mapa([camada('anel', anel)])
    const r = encherNaCamada(antes, 0, 'anel', centroDoBloco({ col: 4, row: 4 }, CELL), opcoes())
    expect(r.map.floor).toHaveLength(1)
    expect(celulasDe(r.map, 'anel')).toHaveLength(anel.length + 9)
    expect(temChao(r.map.floor, 9, 9)).toBe(false)
  })

  it('clicar em cima da própria camada não enche nada (vazio)', () => {
    const antes = mapa([camada('agua', faixa(4, 0, 5))])
    const r = encherNaCamada(antes, 0, 'agua', centroDoBloco({ col: 2, row: 4 }, CELL), opcoes())
    expect(r).toMatchObject({ vazio: true, map: antes })
  })

  it('camada escondida recusa o balde', () => {
    const antes = mapa([camada('agua', faixa(4, 0, 5), { hidden: true })], caixa(2, 2, 6, 5))
    expect(encherNaCamada(antes, 0, 'agua', centroDoBloco({ col: 3, row: 3 }, CELL), opcoes())).toMatchObject({ recusa: 'escondida', map: antes })
  })
})

describe('mapa antigo e nomes', () => {
  it('a folha de pincel de um mapa salvo antes das camadas abre como "Camada 1", e a próxima é a 2', () => {
    const antigo = mapa([camada('folha', faixa(5, 0, 3))])
    const aberto = deserializeMap(serializeMap(antigo))
    expect(aberto.floor[0].nome).toBeUndefined()
    expect(linhasDeCamada(aberto.floor, '#a8776a').map((l) => [l.nome, l.pincel])).toEqual([['Camada 1', true]])
    expect(proximoNomeDeCamada(aberto.floor)).toBe('Camada 2')
    expect(alvoDoPincel(aberto.floor, 0, null)).toMatchObject({ tipo: 'camada', peca: { id: 'folha' } })
  })

  it('nome que não é texto (arquivo editado à mão) sai ao abrir; o nome dado fica', () => {
    const json = serializeMap(mapa([camada('a', faixa(1, 0, 1), { nome: 'Água' }), camada('b', faixa(2, 0, 1))]))
    const torto = json.replace('"id":"b"', '"id":"b","nome":42')
    const aberto = deserializeMap(torto)
    expect(aberto.floor[0].nome).toBe('Água')
    expect('nome' in aberto.floor[1]).toBe(false)
  })

  it('a prévia do traço usa a cor da camada ativa; a camada nova, a tinta do menu', () => {
    const map = mapa([camada('agua', faixa(1, 0, 1), { fillColor: AGUA })])
    expect(corDoPincel(map, 0, 'agua', GRAMA)).toBe(AGUA)
    expect(corDoPincel(map, 0, NOVA_CAMADA, GRAMA)).toBe(GRAMA)
    expect(corDoPincel(map, 0, NOVA_CAMADA, null)).toBe(map.floorStyle.fillColor)
  })
})

describe('recorte do jogador', () => {
  it('a camada sai sem o nome que o mestre deu, e a camada escondida não sai', () => {
    const heroi: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 60, y: 60, size: 1, image: null }
    const map: MapData = {
      ...mapa([camada('covil', faixa(1, 0, 3), { nome: 'Covil do dragão', fillColor: AGUA }), camada('segredo', faixa(3, 0, 3), { hidden: true })]),
      tokens: [heroi],
    }
    const view = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700)
    expect(view.map.floor.map((p) => p.id)).toEqual(['covil'])
    expect('nome' in view.map.floor[0]).toBe(false)
    expect(view.map.floor[0].fillColor).toBe(AGUA)
    expect(JSON.stringify(view.map)).not.toContain('Covil do dragão')
  })
})
