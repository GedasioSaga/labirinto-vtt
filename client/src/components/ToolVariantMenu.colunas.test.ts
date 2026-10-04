import { describe, it, expect } from 'vitest'
import { dividirEmColunas } from './ToolVariantMenu'
import { TOOL_VARIANTS, type ToolVariantEntry, type ToolVariantGroup } from '../lib/toolVariants'

/**
 * Como o menu de Chão se divide em duas colunas — a regra que tira o popover
 * mais alto do app (5 grupos, 24 opções) de dentro
 * de uma coluna só.
 *
 * Os grupos vêm do CATÁLOGO DE VERDADE, não de um duplo escrito à mão: é a
 * única forma de este teste ficar vermelho quando alguém acrescentar um sexto
 * eixo ao Chão e a divisão deixar de fechar. O que ele fixa é a REGRA (ordem
 * preservada, grupo inteiro, pesos equilibrados), não a aparência — quem mede
 * pixel é `e2e/task-jornada-menu-cabe-na-janela.spec.ts`.
 */
function gruposDe(ferramenta: 'floor' | 'roomPolygon'): ToolVariantGroup[] {
  const entrada: ToolVariantEntry | undefined = TOOL_VARIANTS[ferramenta]
  if (!entrada?.available) throw new Error(`${ferramenta} não tem eixo de variante no catálogo`)
  return entrada.groups
}

const rotulos = (colunas: ToolVariantGroup[][]) => colunas.map((coluna) => coluna.map((group) => group.label))
const pesos = (colunas: ToolVariantGroup[][]) =>
  colunas.map((coluna) => coluna.reduce((soma, group) => soma + group.options.length, 0))

describe('dividirEmColunas', () => {
  it('parte o menu de Chão ao meio, com o mesmo peso dos dois lados', () => {
    const colunas = dividirEmColunas(gruposDe('floor'), 2)
    expect(rotulos(colunas)).toEqual([
      ['Forma', 'Tinta'],
      ['Tamanho do pincel', 'Operação', 'Lados do polígono'],
    ])
    // 24 opções, 12 de cada lado, desde que a Tinta (antes Camada) entrou no Chão
    // (28/09/2026).
    expect(pesos(colunas)).toEqual([12, 12])
  })

  it('não parte um grupo ao meio: título e opções migram juntos', () => {
    const original = gruposDe('floor')
    const colunas = dividirEmColunas(original, 2)
    expect(colunas.flat()).toEqual(original)
    // "Lados do polígono" tem 7 opções e nenhuma delas ficou órfã na outra coluna.
    const lados = colunas.flat().filter((group) => group.label === 'Lados do polígono')
    expect(lados).toHaveLength(1)
    expect(lados[0]?.options).toHaveLength(7)
  })

  it('preserva a ordem do catálogo, que é a ordem do Tab', () => {
    const original = gruposDe('floor')
    expect(dividirEmColunas(original, 2).flat()).toEqual(original)
    expect(dividirEmColunas(original, 1).flat()).toEqual(original)
  })

  // CONTROLE POSITIVO da régua: uma coluna tem de devolver UMA coluna, senão
  // os casos acima estariam medindo um repartidor que reparte sempre.
  it('devolve uma coluna só quando é uma coluna só que se pede', () => {
    expect(dividirEmColunas(gruposDe('floor'), 1)).toHaveLength(1)
  })

  it('não inventa segunda coluna para um menu de um grupo só', () => {
    const umGrupo = gruposDe('floor').slice(0, 1)
    expect(dividirEmColunas(umGrupo, 2)).toHaveLength(1)
  })

  it('reparte o menu de Polígono Regular com um grupo de cada lado', () => {
    // 2 grupos, 9 opções (2 de preenchimento + 7 de lados): o alvo de 5 por
    // coluna estoura no segundo grupo, e ele abre a coluna seguinte.
    const colunas = dividirEmColunas(gruposDe('roomPolygon'), 2)
    expect(rotulos(colunas)).toEqual([['Preenchimento'], ['Lados do polígono']])
  })

  it('não deixa coluna vazia quando há menos grupos do que colunas pedidas', () => {
    const colunas = dividirEmColunas(gruposDe('roomPolygon'), 2)
    expect(colunas.every((coluna) => coluna.length > 0)).toBe(true)
  })
})
