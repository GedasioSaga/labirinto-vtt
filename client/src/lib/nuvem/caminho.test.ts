import { describe, expect, it } from 'vitest'
import { alvoDoCaminho, chaveDaEtiqueta, lerMudanca, quemEscreve, quemEscreveAMudanca, segmentoValido } from './caminho'
import { lerJsonSeguro } from './json'
import type { Acao, Mudanca } from './tipos'

/**
 * ESQUEMA E PROTEÇÃO (plano do Lobby §4.7; testes liberados pela 12.18, grupo
 * a): caminho com chave de protótipo, valor hostil aninhado, objeto em campo
 * de texto, NaN e infinito, tetos e quem escreve em cada caminho.
 */

const FICHA = 'pers_teste'
const CHAVES_DE_PROTOTIPO = ['__proto__', 'prototype', 'constructor']
const IMAGEM = `midia:${'a'.repeat(64)}.png`

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

  it('op torta do fio (caminho que não é lista, ação que não existe, nem objeto) vira recusa, nunca erro', () => {
    const tortas = [
      '{"fichaId":"pers_teste","caminho":"nome","acao":"definir","valor":"x"}',
      '{"fichaId":"pers_teste","caminho":{"length":0},"acao":"definir","valor":"x"}',
      '{"fichaId":"pers_teste","caminho":null,"acao":"definir","valor":"x"}',
      '{"fichaId":"pers_teste","caminho":5,"acao":"definir","valor":"x"}',
      '{"fichaId":"pers_teste","acao":"definir","valor":"x"}',
      '{"fichaId":"pers_teste","caminho":["nome"],"acao":"explodir","valor":"x"}',
      '{"fichaId":"pers_teste","caminho":["nome"],"acao":5,"valor":"x"}',
      '{"fichaId":"pers_teste","caminho":["nome"],"valor":"x"}',
      '{"fichaId":5,"caminho":["nome"],"acao":"definir","valor":"x"}',
      '{"fichaId":"pers_teste","caminho":["moedas"],"acao":"somar","delta":"5"}',
      '{"fichaId":"pers_teste","caminho":["nome"],"acao":"definir","valor":"x","atomico":"sim"}',
      'null',
      '5',
      '"texto"',
      '[]',
    ]
    for (const texto of tortas) expect(lerMudanca(lerJsonSeguro(texto)), texto).toMatchObject({ ok: false, motivo: 'fora-do-esquema' })
    for (const caminho of ['nome', null, 5, { length: 0 }]) {
      expect(alvoDoCaminho(caminho)).toBeNull()
      expect(quemEscreve(caminho)).toBeNull()
    }
  })

  it('a mudança conferida volta tipada e sem o envelope da op', () => {
    const doFio = lerJsonSeguro('{"opId":"op_1","baseRev":3,"fichaId":"pers_teste","caminho":["recursos","hp"],"acao":"definir","valor":25}')
    const leitura = lerMudanca(doFio)
    expect(leitura).toMatchObject({ ok: true, mudanca: { fichaId: FICHA, caminho: ['recursos', 'hp'], acao: 'definir', valor: 25 } })
    expect(leitura.ok && Object.keys(leitura.mudanca)).toEqual(['fichaId', 'caminho', 'acao', 'valor'])
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

  it('definir sem valor em quantidade e moedas é a volta ao ausente (1 e 0), para o desfazer', () => {
    expect(lerMudanca(mudanca(['moedas'], 'definir'))).toMatchObject({ ok: true, lida: { regra: 'moedas', acao: 'definir', valor: 0 } })
    expect(lerMudanca(mudanca(['mochila', 'vaga_1', 'quantidade'], 'definir'))).toMatchObject({ ok: true, lida: { regra: 'quantidade', acao: 'definir', valor: 1 } })
    expect(veredito(mudanca(['moedas'], 'definir', { valor: null }))).toBe('fora-do-esquema')
    expect(veredito(mudanca(['mochila', 'vaga_1', 'quantidade'], 'definir', { valor: null }))).toBe('fora-do-esquema')
    expect(veredito(mudanca(['mochila', 'vaga_1', 'quantidade'], 'definir', { valor: 0 }))).toBe('fora-do-esquema')
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

  it('cartão novo que traz imagem, nele ou num subcartão, é só do mestre (12.4); sem imagem é do dono', () => {
    const semImagem = { id: 'cart_1', nome: 'Gomu Gomu', campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
    const comImagem = { ...semImagem, imagem: IMAGEM }
    const subComImagem = { ...semImagem, subcartoes: [{ ...semImagem, id: 'cart_2', imagem: IMAGEM }] }
    const noTopo = ['abas', 'tecnicas', 'cart_1']
    expect(quemEscreveAMudanca(mudanca(noTopo, 'criar', { valor: semImagem }))).toBe('donoOuMestre')
    expect(quemEscreveAMudanca(mudanca(noTopo, 'criar', { valor: comImagem }))).toBe('mestre')
    expect(quemEscreveAMudanca(mudanca(noTopo, 'criar', { valor: subComImagem }))).toBe('mestre')
    expect(quemEscreveAMudanca(mudanca(['abas', 'tecnicas', 'cart_0', 'subcartoes', 'cart_1'], 'criar', { valor: comImagem }))).toBe('mestre')
    expect(quemEscreveAMudanca(mudanca(noTopo, 'apagar'))).toBe('donoOuMestre')
    expect(quemEscreveAMudanca(mudanca([...noTopo, 'imagem'], 'definir', { valor: IMAGEM }))).toBe('mestre')
    expect(quemEscreveAMudanca(mudanca(['dono'], 'definir', { valor: 'conta_luffy' }))).toBe('mestre')
    expect(quemEscreveAMudanca(mudanca(['historico'], 'definir', { valor: 'x' }))).toBeNull()
    // O esquema aceita o cartão com imagem (o mestre pode criá-lo); quem barra o jogador é a permissão.
    expect(veredito(mudanca(noTopo, 'criar', { valor: subComImagem }))).toBe('ok')
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
