/**
 * MARCAÇÃO LEVE — a tabela do GitHub que o livro do Dragon Ball Tales usa:
 * cabeçalho, separadora com alinhamento, corpo com marcação dentro da célula.
 * E o aditivo: o livro do One Piece não tem linha de tabela e sai igual.
 */
import { describe, expect, it } from 'vitest'
import { LIVRO_ONE_PIECE } from './livroOnePiece'
import { lerMarcacao, textoSemMarcacao, type Bloco, type Tabela } from './marcacaoLeve'

const texto = (valor: string) => [{ tipo: 'texto' as const, texto: valor }]

function unicaTabela(blocos: Bloco[]): Tabela {
  const tabelas = blocos.filter((bloco): bloco is Tabela => bloco.tipo === 'tabela')
  expect(tabelas).toHaveLength(1)
  return tabelas[0]
}

describe('tabela', () => {
  it('lê cabeçalho, alinhamentos e corpo (a tabela de dano por EP, p. 9)', () => {
    const tabela = unicaTabela(lerMarcacao('| Dif. EP | Mínimo | Médio |\n|:---|:-:|---:|\n| -1 | 1 | 2 a 4 |\n| -2 | 0 | 1 a 3 |'))
    expect(tabela.alinhamentos).toEqual(['esquerda', 'centro', 'direita'])
    expect(tabela.cabecalho).toEqual([texto('Dif. EP'), texto('Mínimo'), texto('Médio')])
    expect(tabela.linhas).toEqual([
      [texto('-1'), texto('1'), texto('2 a 4')],
      [texto('-2'), texto('0'), texto('1 a 3')],
    ])
  })

  it('separadora sem dois-pontos = alinhamento padrão', () => {
    expect(unicaTabela(lerMarcacao('| a | b |\n|---|---|')).alinhamentos).toEqual([null, null])
  })

  it('célula com marcação vira trechos; \\| é a barra escrita', () => {
    const tabela = unicaTabela(lerMarcacao('| Nome | Efeito |\n|---|---|\n| **Kamehameha** | dano a \\| b |'))
    expect(tabela.linhas[0]).toEqual([[{ tipo: 'forte', filhos: texto('Kamehameha') }], texto('dano a | b')])
  })

  it('linha com menos células ganha vazias; com mais, perde as do fim', () => {
    const tabela = unicaTabela(lerMarcacao('| a | b | c |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |'))
    expect(tabela.linhas).toEqual([
      [texto('1'), [], []],
      [texto('1'), texto('2'), texto('3')],
    ])
  })

  it('a tabela fecha o parágrafo de antes e acaba na primeira linha sem barra', () => {
    const blocos = lerMarcacao('Antes da tabela\n| a |\n|---|\n| 1 |\nDepois')
    expect(blocos.map((bloco) => bloco.tipo)).toEqual(['paragrafo', 'tabela', 'paragrafo'])
  })

  it('sem separadora válida não é tabela: a linha fica como parágrafo', () => {
    expect(lerMarcacao('| a | b |\n| c | d |').map((bloco) => bloco.tipo)).toEqual(['paragrafo'])
    // Separadora com outro número de colunas também não vale.
    expect(lerMarcacao('| a | b |\n|---|').map((bloco) => bloco.tipo)).toEqual(['paragrafo'])
    // Linha sem barra na ponta não começa tabela.
    expect(lerMarcacao('a | b\n---|---').some((bloco) => bloco.tipo === 'tabela')).toBe(false)
  })

  it('a busca lê uma linha por linha da tabela, células separadas', () => {
    expect(textoSemMarcacao('| Dif. EP | Mínimo |\n|---|---|\n| -1 | **1** |')).toBe('Dif. EP · Mínimo\n-1 · 1')
  })
})

describe('aditivo para o One Piece', () => {
  it('nenhum capítulo do One Piece tem tabela', () => {
    for (const capitulo of LIVRO_ONE_PIECE) {
      expect(lerMarcacao(capitulo.texto).some((bloco) => bloco.tipo === 'tabela')).toBe(false)
    }
  })
})
