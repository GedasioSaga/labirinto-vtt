/**
 * ABALO POR DISTÂNCIA — a parte pura: de que lado veio (seta de 8 rumos, com
 * o norte no alto da tela) e quais cenas são "vizinhas" da origem na árvore de
 * pastas da aventura (a mesma pasta, a de fora e as de dentro).
 */
import { describe, expect, it } from 'vitest'
import { ABALO_SETA_ROTULO, cenasVizinhas, faixaDoAbalo, setaDoAbalo } from './abalo'

describe('setaDoAbalo (de onde o jogador ouve)', () => {
  const ficha = { x: 500, y: 500 }
  it('o y cresce para BAIXO na tela: origem acima é norte, abaixo é sul', () => {
    expect(setaDoAbalo(ficha, { x: 500, y: 100 }, 50)).toBe('n')
    expect(setaDoAbalo(ficha, { x: 500, y: 900 }, 50)).toBe('s')
    expect(setaDoAbalo(ficha, { x: 900, y: 500 }, 50)).toBe('l')
    expect(setaDoAbalo(ficha, { x: 100, y: 500 }, 50)).toBe('o')
  })

  it('as diagonais caem no rumo do meio', () => {
    expect(setaDoAbalo(ficha, { x: 900, y: 100 }, 50)).toBe('ne')
    expect(setaDoAbalo(ficha, { x: 100, y: 100 }, 50)).toBe('no')
    expect(setaDoAbalo(ficha, { x: 900, y: 900 }, 50)).toBe('se')
    expect(setaDoAbalo(ficha, { x: 100, y: 900 }, 50)).toBe('so')
  })

  it('dentro do raio de "aqui" não há rumo: foi em cima do jogador', () => {
    expect(setaDoAbalo(ficha, { x: 520, y: 490 }, 50)).toBe('aqui')
    expect(setaDoAbalo(ficha, ficha, 50)).toBe('aqui')
    // Um passo além do raio já tem rumo.
    expect(setaDoAbalo(ficha, { x: 551, y: 500 }, 50)).toBe('l')
  })

  it('todo rumo tem glifo e nome para a tela', () => {
    for (const seta of ['n', 'ne', 'l', 'se', 's', 'so', 'o', 'no', 'aqui'] as const) {
      expect(ABALO_SETA_ROTULO[seta].nome.length).toBeGreaterThan(0)
      expect(ABALO_SETA_ROTULO[seta].glifo.length).toBeGreaterThan(0)
    }
  })
})

describe('cenasVizinhas (a faixa do meio)', () => {
  const cenas = [
    { id: 'torre' },
    { id: 'andar-1', parentId: 'torre' },
    { id: 'andar-2', parentId: 'torre' },
    { id: 'andar-3', parentId: 'torre' },
    { id: 'cela', parentId: 'andar-2' },
    { id: 'porao', parentId: 'andar-1' },
    { id: 'vila' },
  ]

  it('mesma pasta, a de fora e as de dentro; nunca a própria origem', () => {
    expect([...cenasVizinhas(cenas, 'andar-2')].sort()).toEqual(['andar-1', 'andar-3', 'cela', 'torre'])
  })

  it('no primeiro nível, as irmãs são as outras de primeiro nível', () => {
    expect([...cenasVizinhas(cenas, 'vila')].sort()).toEqual(['torre'])
  })

  it('origem que não está na lista não tem vizinha', () => {
    expect(cenasVizinhas(cenas, 'sumiu').size).toBe(0)
  })
})

describe('faixaDoAbalo', () => {
  const vizinhas = new Set(['andar-1'])
  it('mesma cena é perto, vizinha é a do meio, o resto é longe', () => {
    expect(faixaDoAbalo('andar-2', 'andar-2', vizinhas)).toBe('perto')
    expect(faixaDoAbalo('andar-1', 'andar-2', vizinhas)).toBe('andar')
    expect(faixaDoAbalo('vila', 'andar-2', vizinhas)).toBe('longe')
  })

  it('mapa solto (sem id de cena dos dois lados) é tudo perto', () => {
    expect(faixaDoAbalo(null, null, vizinhas)).toBe('perto')
  })
})
