/**
 * MARCAÇÃO LEVE: o Markdown do Discord que as regras usam vira blocos e
 * trechos; marca sem par é texto; e nenhuma entrada (marcas aninhadas sem
 * fim, linha gigante cheia de marcas soltas) derruba o leitor.
 */
import { describe, expect, it } from 'vitest'
import { lerMarcacao, textoSemMarcacao, trechosDaLinha } from './marcacaoLeve'

describe('marcação leve: trechos', () => {
  it('negrito, itálico, sublinhado, riscado e código; um dentro do outro', () => {
    expect(trechosDaLinha('**Força:** *Determina* __a__ ~~b~~ `c`')).toEqual([
      { tipo: 'forte', filhos: [{ tipo: 'texto', texto: 'Força:' }] },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'enfase', filhos: [{ tipo: 'texto', texto: 'Determina' }] },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'sublinhado', filhos: [{ tipo: 'texto', texto: 'a' }] },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'riscado', filhos: [{ tipo: 'texto', texto: 'b' }] },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'codigo', texto: 'c' },
    ])
    expect(trechosDaLinha('**fora *dentro* fora**')).toEqual([
      { tipo: 'forte', filhos: [{ tipo: 'texto', texto: 'fora ' }, { tipo: 'enfase', filhos: [{ tipo: 'texto', texto: 'dentro' }] }, { tipo: 'texto', texto: ' fora' }] },
    ])
  })

  it('marca sem par, vazia ou "* " é texto', () => {
    expect(trechosDaLinha('Rank 10 (2700 ♪)*')).toEqual([{ tipo: 'texto', texto: 'Rank 10 (2700 ♪)*' }])
    expect(trechosDaLinha('a **** b')).toEqual([{ tipo: 'texto', texto: 'a **** b' }])
    expect(trechosDaLinha('2 * 3 * 4')).toEqual([{ tipo: 'texto', texto: '2 * 3 * 4' }])
  })

  it('HTML é texto como outro qualquer', () => {
    expect(trechosDaLinha('<script>alert(1)</script>')).toEqual([{ tipo: 'texto', texto: '<script>alert(1)</script>' }])
  })

  it('aninhamento sem fim para no teto (vira texto), sem estourar a pilha', () => {
    const fundo = `${'**a '.repeat(30_000)}x${' a**'.repeat(30_000)}`
    const trechos = trechosDaLinha(fundo)
    expect(trechos.length).toBeGreaterThan(0)
  })

  it('linha gigante cheia de marcas soltas é lida rápido (cada marca procura o par uma vez)', () => {
    const linha = '*a _b `c ~~d '.repeat(20_000)
    const inicio = performance.now()
    trechosDaLinha(linha)
    expect(performance.now() - inicio).toBeLessThan(1000)
  })
})

describe('marcação leve: blocos', () => {
  it('títulos, parágrafos com quebra simples, listas, citação e régua', () => {
    const blocos = lerMarcacao(['# Perícias', 'Linha um', 'linha dois', '', '- item A', '* item B', '1. primeiro', '2) segundo', '> citado', '---', '#semespaco'].join('\n'))
    expect(blocos.map((b) => b.tipo)).toEqual(['titulo', 'paragrafo', 'lista', 'lista', 'citacao', 'regua', 'paragrafo'])
    expect(blocos[1]).toEqual({ tipo: 'paragrafo', linhas: [[{ tipo: 'texto', texto: 'Linha um' }], [{ tipo: 'texto', texto: 'linha dois' }]] })
    expect(blocos[2]).toMatchObject({ tipo: 'lista', ordenada: false })
    expect(blocos[3]).toMatchObject({ tipo: 'lista', ordenada: true })
    // "#mecânicas" (sem espaço) é a etiqueta do Discord, não título.
    expect(blocos[6]).toEqual({ tipo: 'paragrafo', linhas: [[{ tipo: 'texto', texto: '#semespaco' }]] })
  })

  it('o preenchedor invisível do Discord (U+3164) conta como linha vazia', () => {
    expect(lerMarcacao('antes\nㅤ\ndepois').map((b) => b.tipo)).toEqual(['paragrafo', 'paragrafo'])
  })

  it('níveis de título: 1, 2 e 3 ou mais', () => {
    expect(lerMarcacao('# a\n## b\n###### c').map((b) => (b.tipo === 'titulo' ? b.nivel : 0))).toEqual([1, 2, 3])
  })

  it('o texto sem marcas, para a busca', () => {
    expect(textoSemMarcacao('## **Atributos Físicos**\n\n**Força:** *Determina* a força.\n- item')).toBe('Atributos Físicos\nForça: Determina a força.\nitem')
  })
})
