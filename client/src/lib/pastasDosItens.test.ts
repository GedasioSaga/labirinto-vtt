import { describe, expect, it } from 'vitest'
import type { ItemDoCatalogo } from './acervoDeItens'
import { contasComAsDeDentro, lugarDoItemNovo, pastaMovida, pastasPorPai, recusaParaMoverAPasta, semAPasta, type PastaDeItens } from './pastasDosItens'

/**
 * AS PASTAS DO ACERVO DE ITENS (18/11/2026, "Pastas como no Prelúdio"): a
 * árvore em qualquer profundidade, mover sem laço, apagar sem perder item e
 * o lugar do item novo.
 */

// Comida > Frutas > Cítricas; Armas.
const PASTAS: PastaDeItens[] = [
  { id: 'comida', nome: 'Comida' },
  { id: 'frutas', nome: 'Frutas', paiId: 'comida' },
  { id: 'citricas', nome: 'Cítricas', paiId: 'frutas' },
  { id: 'armas', nome: 'Armas' },
]

describe('pastas do acervo de itens', () => {
  it('mover recusa o laço; para outra pasta vai com as de dentro, e a contagem da de cima soma as de dentro', () => {
    expect(recusaParaMoverAPasta(PASTAS, 'comida', 'comida')).toBe('ela-mesma')
    expect(recusaParaMoverAPasta(PASTAS, 'comida', 'citricas')).toBe('dentro-dela')
    expect(recusaParaMoverAPasta(PASTAS, 'frutas', 'comida')).toBe('ja-esta')
    expect(recusaParaMoverAPasta(PASTAS, 'comida', null)).toBe('ja-esta')
    expect(recusaParaMoverAPasta(PASTAS, 'frutas', 'armas')).toBeNull()
    const movidas = pastaMovida(PASTAS, 'frutas', 'armas')
    const porPai = pastasPorPai(movidas)
    expect([porPai.get('armas')?.map((pasta) => pasta.id), porPai.get('frutas')?.map((pasta) => pasta.id)]).toEqual([['frutas'], ['citricas']])
    expect(contasComAsDeDentro(movidas, ['citricas', 'frutas', null]).get('armas')).toBe(2)
  })

  it('um laço gravado por fora aparece em cima em vez de sumir; apagar a pasta sobe o que estava dentro um nível', () => {
    const laco: PastaDeItens[] = [
      { id: 'b', nome: 'B', paiId: 'a' },
      { id: 'a', nome: 'A', paiId: 'b' },
    ]
    expect(pastasPorPai(laco).get(null)?.map((pasta) => pasta.id)).toEqual(['a', 'b'])
    const { pastas, ondeMoram } = semAPasta(
      PASTAS,
      [
        { id: 'item_limao', pasta: 'frutas' },
        { id: 'item_espada', pasta: 'armas' },
      ],
      'frutas',
    )
    expect(pastas.map((pasta) => [pasta.id, pasta.paiId])).toEqual([
      ['comida', undefined],
      ['citricas', 'comida'],
      ['armas', undefined],
    ])
    expect([...ondeMoram]).toEqual([['item_limao', 'comida']])
  })

  it('o item novo sem pasta entra na pasta de cima com o nome da categoria (sem ligar para caixa), criada se faltar', () => {
    const faca: ItemDoCatalogo = { id: 'item_faca', nome: 'Faca', imagem: null, descricao: '', categoria: 'armas', preco: null, empilhavel: false }
    expect(lugarDoItemNovo(PASTAS, faca).item.pasta).toBe('armas')
    const reliquia = lugarDoItemNovo(PASTAS, { ...faca, categoria: 'Relíquia' }, () => 'pasta_nova')
    expect([reliquia.item.pasta, reliquia.pastas.at(-1)]).toEqual(['pasta_nova', { id: 'pasta_nova', nome: 'Relíquia' }])
  })
})
