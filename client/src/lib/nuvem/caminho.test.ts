import { describe, expect, it } from 'vitest'
import { alvoDoCaminho, chaveDaEtiqueta, lerMudanca, quemEscreve, segmentoValido } from './caminho'
import { lerJsonSeguro } from './json'
import type { Acao, Mudanca } from './tipos'

/**
 * ESQUEMA E PROTEÇÃO (plano do Lobby §4.7; testes liberados pela 12.18, grupo
 * a): caminho com chave de protótipo, valor hostil aninhado, objeto em campo
 * de texto, NaN e infinito, tetos e quem escreve em cada caminho.
 */

const FICHA = 'pers_teste'
const CHAVES_DE_PROTOTIPO = ['__proto__', 'prototype', 'constructor']

function mudanca(caminho: string[], acao: Acao, extra: Partial<Mudanca> = {}): Mudanca {
  return { fichaId: FICHA, caminho, acao, ...extra }
}

/** 'ok' ou o motivo da recusa. */
function veredito(m: Mudanca): string {
  const leitura = lerMudanca(m)
  return leitura.ok ? 'ok' : leitura.motivo
}

describe('segmento do caminho', () => {
  it('recusa __proto__, prototype e constructor em qualquer posição', () => {
    for (const chave of CHAVES_DE_PROTOTIPO) {
      expect(segmentoValido(chave)).toBe(false)
      expect(veredito(mudanca(['escolhas', chave], 'definir', { valor: 'x' }))).toBe('fora-do-esquema')
      expect(veredito(mudanca(['recursos', chave], 'definir', { valor: 1 }))).toBe('fora-do-esquema')
      expect(veredito(mudanca(['abas', chave, 'cart_1'], 'apagar'))).toBe('fora-do-esquema')
      expect(veredito(mudanca(['abas', 'tecnicas', 'cart_1', 'campos', chave], 'definir', { valor: 'x' }))).toBe('fora-do-esquema')
      expect(veredito(mudanca([chave], 'definir', { valor: 'x' }))).toBe('fora-do-esquema')
      expect(veredito({ fichaId: chave, caminho: ['nome'], acao: 'definir', valor: 'x' })).toBe('fora-do-esquema')
    }
  })

  it('recusa segmento vazio, com espaço, com barra ou maior que 80', () => {
    for (const torto of ['', 'com espaço', 'a/b', 'a'.repeat(81), 'ção']) {
      expect(veredito(mudanca(['escolhas', torto], 'definir', { valor: 'x' }))).toBe('fora-do-esquema')
    }
    expect(veredito(mudanca(['escolhas', 'a'.repeat(80)], 'definir', { valor: 'x' }))).toBe('ok')
  })

  it('recusa campo fora da tabela e ação que o campo não aceita', () => {
    expect(alvoDoCaminho(['historico'])).toBeNull()
    expect(alvoDoCaminho(['id'])).toBeNull()
    expect(alvoDoCaminho(['tipo'])).toBeNull()
    expect(alvoDoCaminho(['abas', 'tecnicas'])).toBeNull()
    expect(alvoDoCaminho(['mochila', 'vaga_1', 'id'])).toBeNull()
    expect(alvoDoCaminho(['dbt', 'versao'])).toBeNull()
    expect(veredito(mudanca(['nome'], 'somar', { delta: 1 }))).toBe('fora-do-esquema')
    expect(veredito(mudanca(['moedas'], 'criar', { valor: 1 }))).toBe('fora-do-esquema')
    expect(veredito(mudanca(['mochila', 'vaga_1'], 'apagar', { valor: 'x' }))).toBe('fora-do-esquema')
  })

  it('acha o alvo dentro de subcartões', () => {
    expect(alvoDoCaminho(['abas', 'tecnicas', 'cart_a', 'subcartoes', 'cart_b', 'campos', 'dano'])).toEqual({
      regra: 'textoDoCartao',
      aba: 'tecnicas',
      trilha: ['cart_a', 'cart_b'],
      campoId: 'dano',
    })
    expect(alvoDoCaminho(['abas', 'tecnicas', 'cart_a', 'subcartoes', '#ordem'])).toEqual({ regra: 'ordemDosCartoes', aba: 'tecnicas', trilha: ['cart_a'] })
  })
})

describe('valor hostil', () => {
  it('__proto__ aninhado no valor é recusado (cartão, item e ficha inteira)', () => {
    // JSON.parse cru, como chegaria um frame forjado sem passar por `lerJsonSeguro`.
    const cartao = JSON.parse(
      '{"id":"cart_1","nome":"Gomu Gomu","campos":{"__proto__":{"dano":"10"}},"extras":[],"atributos":[],"imagem":null,"modificadores":[],"subcartoes":[]}',
    )
    const item = JSON.parse('{"id":"vaga_1","nome":"Carne","constructor":{"prototype":{"x":1}}}')
    const doc = JSON.parse('{"id":"pers_teste","nome":"X","escolhas":{"__proto__":{"admin":"sim"}}}')
    const casos = [
      lerMudanca(mudanca(['abas', 'tecnicas', 'cart_1'], 'criar', { valor: cartao })),
      lerMudanca(mudanca(['mochila', 'vaga_1'], 'criar', { valor: item })),
      lerMudanca(mudanca([], 'criar', { valor: doc })),
    ]
    for (const caso of casos) expect(caso).toMatchObject({ ok: false, motivo: 'fora-do-esquema', detalhe: expect.stringMatching(/proibida/) })
    expect(Object.prototype).not.toHaveProperty('admin')
  })

  it('lerJsonSeguro descarta as três chaves em qualquer nível', () => {
    const lido = lerJsonSeguro('{"a":{"__proto__":{"x":1},"constructor":{"y":2},"b":[{"prototype":3,"c":4}]}}')
    expect(lido).toEqual({ a: { b: [{ c: 4 }] } })
    expect(Object.prototype).not.toHaveProperty('x')
  })

  it('objeto em campo de texto é recusado', () => {
    const casos: Mudanca[] = [
      mudanca(['nome'], 'definir', { valor: {} }),
      mudanca(['descricao'], 'definir', { valor: ['a'] }),
      mudanca(['escolhas', 'raca'], 'definir', { valor: 5 }),
      mudanca(['abas', 'tecnicas', 'cart_1', 'campos', 'dano'], 'definir', { valor: { x: 1 } }),
      mudanca(['abas', 'tecnicas', 'cart_1', 'nome'], 'definir', { valor: { x: 1 } }),
      mudanca(['abas', 'tecnicas', 'cart_1', 'extras'], 'definir', { valor: [{ nome: {}, valor: 'x' }] }),
      mudanca(['mochila', 'vaga_1', 'descricao'], 'definir', { valor: { x: 1 } }),
      mudanca(['etiquetas', chaveDaEtiqueta('x')], 'criar', { valor: { texto: 'x' } }),
      mudanca(['notaDoMestre'], 'definir', { valor: {} }),
      mudanca(['dbt', 'historia'], 'definir', { valor: {} }),
    ]
    for (const caso of casos) expect(veredito(caso)).toBe('fora-do-esquema')
  })

  it('NaN e infinito são recusados, soltos ou aninhados', () => {
    for (const ruim of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(veredito(mudanca(['recursos', 'hp'], 'definir', { valor: ruim }))).toBe('fora-do-esquema')
      expect(veredito(mudanca(['moedas'], 'somar', { delta: ruim }))).toBe('fora-do-esquema')
      expect(veredito(mudanca(['abas', 'tecnicas', 'cart_1', 'modificadores'], 'definir', { valor: [{ atributo: 'forca', delta: ruim }] }))).toBe(
        'fora-do-esquema',
      )
      expect(veredito(mudanca(['dbt', 'pdl'], 'definir', { valor: ruim }))).toBe('fora-do-esquema')
    }
    expect(veredito(mudanca(['mochila', 'vaga_1', 'quantidade'], 'somar', { delta: 1.5 }))).toBe('fora-do-esquema')
  })

  it('tetos da tabela: nome, texto, número, etiqueta, campo do cartão', () => {
    expect(veredito(mudanca(['nome'], 'definir', { valor: 'a'.repeat(120) }))).toBe('ok')
    expect(veredito(mudanca(['nome'], 'definir', { valor: 'a'.repeat(121) }))).toBe('acima-do-teto')
    expect(veredito(mudanca(['descricao'], 'definir', { valor: 'a'.repeat(16 * 1024 + 1) }))).toBe('acima-do-teto')
    expect(veredito(mudanca(['recursos', 'hp'], 'definir', { valor: 1e7 }))).toBe('ok')
    expect(veredito(mudanca(['recursos', 'hp'], 'definir', { valor: -1e7 - 1 }))).toBe('acima-do-teto')
    const longa = 'e'.repeat(61)
    expect(veredito(mudanca(['etiquetas', chaveDaEtiqueta(longa)], 'criar', { valor: longa }))).toBe('acima-do-teto')
    expect(veredito(mudanca(['abas', 'tecnicas', 'cart_1', 'campos', 'dano'], 'definir', { valor: 'ã'.repeat(4097) }))).toBe('acima-do-teto')
  })

  it('nome vazio e dono torto são recusados', () => {
    expect(veredito(mudanca(['nome'], 'definir', { valor: '   ' }))).toBe('fora-do-esquema')
    expect(veredito(mudanca(['dono'], 'definir', { valor: 'conta com espaço' }))).toBe('fora-do-esquema')
    expect(veredito(mudanca(['dono'], 'definir', { valor: 'conta_luffy' }))).toBe('ok')
    expect(veredito(mudanca(['dono'], 'definir'))).toBe('ok')
  })
})

describe('quem escreve', () => {
  it('dono, combate, soCenario, nomeDoJogador, notaDoMestre, o NPC do Dragon Ball e a ficha inteira são só do mestre', () => {
    for (const caminho of [['dono'], ['combate'], ['soCenario'], ['nomeDoJogador'], ['notaDoMestre'], ['dbt', 'npc'], []]) {
      expect(quemEscreve(caminho)).toBe('mestre')
    }
  })

  it('imagem (retrato e cartão) é só do mestre na v1 (pergunta 12.4)', () => {
    expect(quemEscreve(['retrato'])).toBe('mestre')
    expect(quemEscreve(['abas', 'tecnicas', 'cart_1', 'imagem'])).toBe('mestre')
    expect(quemEscreve(['abas', 'tecnicas', 'cart_1', 'subcartoes', 'cart_2', 'imagem'])).toBe('mestre')
  })

  it('ficha, cartões, mochila, moedas e etiquetas são do dono ou do mestre', () => {
    const caminhos = [
      ['nome'],
      ['recursos', 'hp'],
      ['abas', 'tecnicas', 'cart_1'],
      ['abas', 'tecnicas', '#ordem'],
      ['mochila', 'vaga_1'],
      ['mochila', 'vaga_1', 'quantidade'],
      ['moedas'],
      ['etiquetas', chaveDaEtiqueta('Pirata')],
      ['dbt', 'historia'],
    ]
    for (const caminho of caminhos) expect(quemEscreve(caminho)).toBe('donoOuMestre')
    expect(quemEscreve(['historico'])).toBeNull()
  })
})

describe('etiqueta', () => {
  it('a chave cabe no segmento mesmo com acento e espaço, e o criar confere o texto', () => {
    const chave = chaveDaEtiqueta('Usuário de Akuma no Mi')
    expect(segmentoValido(chave)).toBe(true)
    expect(chaveDaEtiqueta('Usuário de Akuma no Mi')).toBe(chave)
    expect(chaveDaEtiqueta('Usuario de Akuma no Mi')).not.toBe(chave)
    expect(veredito(mudanca(['etiquetas', chave], 'criar', { valor: 'Usuário de Akuma no Mi' }))).toBe('ok')
    expect(veredito(mudanca(['etiquetas', chave], 'criar', { valor: 'Outra etiqueta' }))).toBe('fora-do-esquema')
  })
})
