/**
 * PRELÚDIO F3b, correção da revisão: no Livro do mestre, a seção do roteiro que
 * só tem a citação do quadro aparece. Antes ela contava como vazia, e a seção e
 * a citação sumiam do mapa. Dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import type { TextoRico } from '../../lib/preparo/tipos'
import { temTexto } from './TextoDoRoteiro'

const paragrafo = (...content: unknown[]): TextoRico => ({ type: 'doc', content: [{ type: 'paragraph', content }] })

describe('o que conta como texto no roteiro', () => {
  it('a citação do quadro sozinha conta, com o espaço que a inserção põe; o parágrafo só de espaço, não', () => {
    const citacao = { type: 'citacaoQuadro', attrs: { quadroId: 'quadro-inventado', formaId: 'shape:cena-3', rotulo: 'Cena 3' } }
    expect(temTexto(paragrafo(citacao, { type: 'text', text: ' ' }))).toBe(true)
    expect(temTexto(paragrafo({ type: 'text', text: '   ' }))).toBe(false)
    expect(temTexto({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false)
  })
})
