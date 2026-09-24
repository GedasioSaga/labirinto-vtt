import { describe, expect, it } from 'vitest'
import type { Region, RegionPoint } from '../types/map'
import { buildPlaceTree, placeBounds, visibleRows, type PlaceNode } from './placeTree'

/**
 * ÁRVORE DE LOCAIS — Distrito > Quarteirão > Prédio > Piso > Cômodo, montada
 * só com o `Region.parentId` que o mapa já grava. A lista "Objetos do mapa" é
 * plana; aqui o mestre anda pela cidade de fora para dentro.
 */

function quadrado(x: number, y: number, lado: number): RegionPoint[] {
  return [
    { x, y },
    { x: x + lado, y },
    { x: x + lado, y: y + lado },
    { x, y: y + lado },
  ]
}

function sala(id: string, nome: string, points: RegionPoint[], parentId?: string): Region {
  const region: Region = { id, points, tag: '', fillColor: '#333333', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: nome } }
  return parentId === undefined ? region : { ...region, parentId }
}

/** Uma cidade pequena, na ordem de desenho do mapa (mãe antes das filhas). */
const CIDADE: Region[] = [
  sala('d-porto', 'Distrito do Porto', quadrado(0, 0, 4000)),
  sala('q-2', 'Quarteirão 10', quadrado(2000, 0, 1500), 'd-porto'),
  sala('q-1', 'Quarteirão 2', quadrado(0, 0, 1500), 'd-porto'),
  sala('p-farol', 'Prédio do Farol', quadrado(100, 100, 600), 'q-1'),
  sala('piso-1', 'Piso 1', quadrado(100, 100, 600), 'p-farol'),
  sala('c-cozinha', 'Cozinha', quadrado(120, 120, 200), 'piso-1'),
  sala('c-quarto', 'Quarto', quadrado(400, 120, 200), 'piso-1'),
  sala('d-mercado', 'Distrito do Mercado', quadrado(5000, 0, 3000)),
]

function nomes(rows: readonly PlaceNode[]): string[] {
  return rows.map((row) => `${'  '.repeat(row.depth)}${row.name}`)
}

describe('buildPlaceTree', () => {
  it('monta a hierarquia do parentId: distrito no topo, cômodo no fundo, com a contagem de tudo que há dentro', () => {
    const tree = buildPlaceTree(CIDADE)
    expect(tree.total).toBe(8)
    expect(tree.rootIds).toEqual(['d-mercado', 'd-porto'])
    const porto = tree.nodes.get('d-porto')
    expect(porto?.depth).toBe(0)
    expect(porto?.descendantCount).toBe(6)
    expect(porto?.childIds).toEqual(['q-1', 'q-2'])
    expect(tree.nodes.get('piso-1')?.depth).toBe(3)
    expect(tree.nodes.get('piso-1')?.descendantCount).toBe(2)
    expect(tree.nodes.get('c-quarto')?.depth).toBe(4)
    expect(tree.nodes.get('c-quarto')?.childIds).toEqual([])
    expect(tree.nodes.get('c-quarto')?.parentId).toBe('piso-1')
  })

  it('irmãos em ordem de nome com número natural: "Quarteirão 2" antes de "Quarteirão 10"', () => {
    const tree = buildPlaceTree(CIDADE)
    expect(tree.nodes.get('d-porto')?.childIds).toEqual(['q-1', 'q-2'])
    expect(tree.nodes.get('q-1')?.position).toBe(1)
    expect(tree.nodes.get('q-2')?.position).toBe(2)
    expect(tree.nodes.get('q-2')?.siblings).toBe(2)
  })

  it('parentId órfão vira local de topo e região que não é sala fica de fora', () => {
    const regiaoComum: Region = { id: 'r-mancha', points: quadrado(0, 0, 10), tag: '', fillColor: '#000000', fillPattern: 'solid', data: {} }
    const tree = buildPlaceTree([sala('solta', 'Casa Solta', quadrado(0, 0, 100), 'nao-existe'), regiaoComum, sala('filha', 'Sala da mancha', quadrado(0, 0, 5), 'r-mancha')])
    expect(tree.rootIds).toEqual(['solta', 'filha'])
    expect(tree.nodes.has('r-mancha')).toBe(false)
    expect(tree.total).toBe(2)
  })

  it('arquivo corrompido com ciclo de parentId não trava e cada sala aparece uma vez só', () => {
    const tree = buildPlaceTree([sala('a', 'A', quadrado(0, 0, 10), 'b'), sala('b', 'B', quadrado(0, 0, 10), 'a'), sala('c', 'C', quadrado(0, 0, 10), 'c')])
    expect(tree.total).toBe(3)
    const todas = visibleRows(tree, () => true).map((row) => row.id)
    expect([...todas].sort()).toEqual(['a', 'b', 'c'])
  })

  it('sala sem nome aparece como "Sala sem nome", como na lista de objetos', () => {
    const tree = buildPlaceTree([sala('x', '   ', quadrado(0, 0, 10))])
    expect(tree.nodes.get('x')?.name).toBe('Sala sem nome')
  })
})

describe('visibleRows', () => {
  it('só desce no que está aberto, em ordem de árvore', () => {
    const tree = buildPlaceTree(CIDADE)
    const abertos = new Set(['d-porto', 'q-1'])
    expect(nomes(visibleRows(tree, (node) => abertos.has(node.id)))).toEqual([
      'Distrito do Mercado',
      'Distrito do Porto',
      '  Quarteirão 2',
      '    Prédio do Farol',
      '  Quarteirão 10',
    ])
  })

  it('tudo aberto: do distrito ao cômodo', () => {
    const tree = buildPlaceTree(CIDADE)
    expect(nomes(visibleRows(tree, () => true))).toEqual([
      'Distrito do Mercado',
      'Distrito do Porto',
      '  Quarteirão 2',
      '    Prédio do Farol',
      '      Piso 1',
      '        Cozinha',
      '        Quarto',
      '  Quarteirão 10',
    ])
  })
})

describe('placeBounds', () => {
  it('a caixa do prédio cobre o prédio e tudo que há dentro dele', () => {
    const regions = [sala('p', 'Prédio', quadrado(100, 100, 600)), sala('anexo', 'Anexo', quadrado(650, 650, 200), 'p'), sala('longe', 'Longe', quadrado(5000, 5000, 10))]
    expect(placeBounds(regions, 'p')).toEqual({ minX: 100, minY: 100, maxX: 850, maxY: 850 })
  })

  it('local que saiu do mapa não tem caixa', () => {
    expect(placeBounds(CIDADE, 'sumiu')).toBeNull()
  })
})

/*
 * Escala da cena a09-blocos (2.828 locais): abrir a árvore não pode varrer a
 * cena uma vez por sala. O teste não cronometra (relógio em máquina carregada
 * mente): conta quantas vezes alguém pergunta `parentId` a uma sala. Custo
 * linear dobra quando a cena dobra; quadrático quadruplica.
 */
const LOCAIS_DA_A09 = 2828
/** Linear dobra (×2) quando a cena dobra; quadrático quadruplica (×4). 3 separa os dois com folga. */
const TETO_DE_CRESCIMENTO_AO_DOBRAR = 3

/** Cidade com `total` locais em 5 níveis: 1 distrito, quarteirões, prédios, pisos e cômodos. */
function cidadeContada(total: number, contador: { leituras: number }): Region[] {
  const cena: Region[] = []
  const contada = (id: string, nome: string, parentId?: string): Region => {
    const region: Region = { id, points: quadrado(cena.length * 10, 0, 8), tag: '', fillColor: '#333333', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: nome } }
    Object.defineProperty(region, 'parentId', {
      enumerable: true,
      get() {
        contador.leituras++
        return parentId
      },
    })
    return region
  }
  cena.push(contada('distrito', 'Distrito'))
  for (let q = 0; cena.length < total; q++) {
    cena.push(contada(`q${q}`, `Quarteirão ${q}`, 'distrito'))
    for (let p = 0; p < 4 && cena.length < total; p++) {
      cena.push(contada(`q${q}p${p}`, `Prédio ${p}`, `q${q}`))
      for (let a = 0; a < 2 && cena.length < total; a++) {
        cena.push(contada(`q${q}p${p}a${a}`, `Piso ${a}`, `q${q}p${p}`))
        for (let c = 0; c < 3 && cena.length < total; c++) cena.push(contada(`q${q}p${p}a${a}c${c}`, `Cômodo ${c}`, `q${q}p${p}a${a}`))
      }
    }
  }
  return cena
}

function leiturasParaMontar(total: number): { leituras: number; locais: number } {
  const contador = { leituras: 0 }
  const cena = cidadeContada(total, contador)
  const tree = buildPlaceTree(cena)
  return { leituras: contador.leituras, locais: tree.total }
}

describe('escala da a09 (2.828 locais)', () => {
  it('montar a árvore lê o parentId de cada sala uma vez: custo linear, não quadrático', () => {
    const cheia = leiturasParaMontar(LOCAIS_DA_A09)
    const dobrada = leiturasParaMontar(LOCAIS_DA_A09 * 2)
    expect(cheia.locais).toBe(LOCAIS_DA_A09)
    expect(cheia.leituras).toBeGreaterThanOrEqual(LOCAIS_DA_A09)
    expect(dobrada.leituras / cheia.leituras).toBeLessThan(TETO_DE_CRESCIMENTO_AO_DOBRAR)
  })
})
