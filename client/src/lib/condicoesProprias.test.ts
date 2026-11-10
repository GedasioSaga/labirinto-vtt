import { describe, expect, it } from 'vitest'
import type { CondicaoPropria, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  CONDICAO_NOME_MAX,
  CONDICOES_POR_FICHA_MAX,
  SIMBOLO_DIGITADO_MAX,
  alternarCondicaoPropria,
  condicoesPropriasOf,
  cortarNomeDeCondicao,
  lerCondicaoPropria,
  limparNomeDeCondicao,
  limparSimboloDigitado,
  simboloDaCondicaoPropria,
  tirarCondicaoPropriaDasFichas,
  trocarCondicaoPropriaNasFichas,
} from './condicoesProprias'

/** CONDIÇÃO CRIADA PELO MESTRE (pedido de 09/11/2026). Dados inventados. */

const QUEIMANDO: CondicaoPropria = { id: 'cond_queimando', nome: 'Queimando', cor: '#ff8a5c', simbolo: 'chama' }
const MARCADO: CondicaoPropria = { id: 'cond_marcado', nome: 'Marcado', cor: '#7fb8f0', simbolo: 'alvo' }

function ficha(id: string, overrides: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 0, y: 0, size: 1, image: null, ...overrides }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('mapa-de-teste', 'Clareira', 10, 10, 64), tokens }
}

describe('lerCondicaoPropria: o que vem do disco, da rede e do armazenamento', () => {
  it('condição boa passa, com o nome enxugado e a cor em minúsculas', () => {
    expect(lerCondicaoPropria({ id: 'cond_1', nome: '  Em   chamas  ', cor: '#FF8A5C', simbolo: 'chama', sobra: 'lixo' })).toEqual({
      id: 'cond_1',
      nome: 'Em chamas',
      cor: '#ff8a5c',
      simbolo: 'chama',
    })
  })

  it('lixo não vira marca, e a ficha não leva repetida nem passa do teto', () => {
    expect(lerCondicaoPropria({ id: 'cond_1', nome: '', cor: '#ff8a5c', simbolo: 'chama' })).toBeNull()
    expect(lerCondicaoPropria({ id: 'cond_1', nome: 'Torta', cor: 'red', simbolo: 'chama' })).toBeNull()
    expect(lerCondicaoPropria({ id: 'cond_1', nome: 'Torta', cor: '#ff8a5c', simbolo: '<svg onload=x>' })).toBeNull()
    expect(lerCondicaoPropria({ id: 'a b', nome: 'Torta', cor: '#ff8a5c', simbolo: 'chama' })).toBeNull()
    const muitas = Array.from({ length: CONDICOES_POR_FICHA_MAX + 3 }, (_, i) => ({ ...QUEIMANDO, id: `cond_${i}` }))
    const lidas = condicoesPropriasOf({ condicoesProprias: [QUEIMANDO, QUEIMANDO, 'lixo', null, ...muitas] })
    expect(lidas).toHaveLength(CONDICOES_POR_FICHA_MAX)
    expect(lidas.filter((c) => c.id === QUEIMANDO.id)).toHaveLength(1)
  })
})

describe('símbolo digitado: letra, número ou emoji no lugar do desenho', () => {
  it('conta por caractere visto, não por unidade de código: emoji composto vale um, e o terceiro é cortado', () => {
    const familia = '👨‍👩‍👧'
    expect(familia.length).toBeGreaterThan(SIMBOLO_DIGITADO_MAX)
    expect(limparSimboloDigitado(`${familia}A`)).toBe(`${familia}A`)
    expect(limparSimboloDigitado(' 🔥 ')).toBe('🔥')
    expect(limparSimboloDigitado('abc')).toBe('ab')
    expect(limparSimboloDigitado('7️⃣9')).toBe('7️⃣9')
    // Espaço, controle e marca de direção de texto não são símbolo; o que não é texto vira vazio.
    expect(limparSimboloDigitado('‮\n\t')).toBe('')
    expect(limparSimboloDigitado(42)).toBe('')
  })

  it('a condição lida guarda o símbolo e a pastilha o leva na tinta que contrasta; símbolo torto só some', () => {
    const lida = lerCondicaoPropria({ ...QUEIMANDO, cor: '#101820', texto: ' 🔥F ' })
    expect(lida).toEqual({ ...QUEIMANDO, cor: '#101820', texto: '🔥F' })
    const pastilha = simboloDaCondicaoPropria(lida ?? QUEIMANDO)
    expect(pastilha).toMatchObject({ fill: '#101820', texto: '🔥F', strokes: [] })
    // Cor escura pede tinta clara; cor clara, a escura de sempre.
    expect(pastilha.ink).not.toBe(simboloDaCondicaoPropria({ ...QUEIMANDO, texto: 'F' }).ink)
    expect(lerCondicaoPropria({ ...QUEIMANDO, texto: '\u0000' })).toEqual(QUEIMANDO)
    expect(simboloDaCondicaoPropria(QUEIMANDO).texto).toBeUndefined()
  })
})

/* Segunda auditoria (09/11/2026): pastilha vazia e metade de emoji chegando a quem joga. */
describe('símbolo sem tinta e nome cortado ao meio', () => {
  it('branco que passa por letra ou por símbolo não vira símbolo digitado: a pastilha não sai vazia', () => {
    // Braille em branco (símbolo) e preenchedores de hangul (letras): nenhum deixa tinta.
    expect(limparSimboloDigitado('⠀')).toBe('')
    expect(limparSimboloDigitado('ㅤ')).toBe('')
    expect(limparSimboloDigitado('ᅟᅠﾠ')).toBe('')
    expect(limparSimboloDigitado('⠀Aㅤ')).toBe('A')
    // O emoji composto leva seletor e junção invisíveis por dentro e continua inteiro.
    expect(limparSimboloDigitado('7️⃣👨‍👩‍👧')).toBe('7️⃣👨‍👩‍👧')
    // Símbolo torto só some: a condição fica, com o desenho.
    expect(lerCondicaoPropria({ ...QUEIMANDO, texto: 'ㅤ' })).toEqual(QUEIMANDO)
  })

  it('o nome é cortado no teto só entre caracteres: nenhuma metade de emoji fica no fim, na leitura do host e no campo do formulário', () => {
    const metadeSolta = /\p{Cs}/u
    // 19 letras e um emoji de 2 unidades: o teto cai no meio dele.
    const fogoNoTeto = 'Queimando muito for🔥'
    expect(fogoNoTeto.length).toBe(CONDICAO_NOME_MAX + 1)
    expect(lerCondicaoPropria({ ...QUEIMANDO, nome: fogoNoTeto })?.nome).toBe('Queimando muito for')
    // Emoji composto que não cabe inteiro sai inteiro, e o espaço que sobra no fim também.
    const comFamilia = limparNomeDeCondicao('Marcado pela 👨‍👩‍👧')
    expect(comFamilia).toBe('Marcado pela')
    expect(metadeSolta.test(comFamilia)).toBe(false)
    // O que cabe inteiro fica.
    expect(limparNomeDeCondicao('Em chamas 🔥')).toBe('Em chamas 🔥')
    // Metade solta que já vem no texto (arquivo editado à mão) não é nome.
    expect(limparNomeDeCondicao('Queimando\uD83D')).toBe('Queimando')
    // O campo do formulário corta enquanto o mestre digita, sem enxugar o espaço da palavra seguinte.
    expect(cortarNomeDeCondicao('Em chamas ')).toBe('Em chamas ')
    expect(cortarNomeDeCondicao(fogoNoTeto)).toBe('Queimando muito for')
  })
})

describe('condição criada nas fichas do mapa', () => {
  it('o clique marca e o segundo clique desmarca, apagando o campo', () => {
    const mapa = mapaCom([ficha('aira'), ficha('urso')])
    const marcado = alternarCondicaoPropria(mapa, 'aira', QUEIMANDO)
    expect(condicoesPropriasOf(marcado.tokens[0])).toEqual([QUEIMANDO])
    expect(marcado.tokens[1]).toBe(mapa.tokens[1])
    const desmarcado = alternarCondicaoPropria(marcado, 'aira', QUEIMANDO)
    expect('condicoesProprias' in desmarcado.tokens[0]).toBe(false)
    expect(alternarCondicaoPropria(mapa, 'ninguem', QUEIMANDO)).toBe(mapa)
  })

  it('editar troca em toda ficha que a leva; excluir tira de todas; o resto fica como estava', () => {
    const mapa = mapaCom([
      ficha('aira', { condicoesProprias: [QUEIMANDO, MARCADO] }),
      ficha('urso', { condicoesProprias: [QUEIMANDO] }),
      ficha('javali'),
    ])
    const editada: CondicaoPropria = { ...QUEIMANDO, nome: 'Em chamas', cor: '#ef6f6c' }
    const trocado = trocarCondicaoPropriaNasFichas(mapa, editada)
    expect(condicoesPropriasOf(trocado.tokens[0])).toEqual([editada, MARCADO])
    expect(condicoesPropriasOf(trocado.tokens[1])).toEqual([editada])
    expect(trocado.tokens[2]).toBe(mapa.tokens[2])
    expect(trocarCondicaoPropriaNasFichas(trocado, editada)).toBe(trocado)
    const tirado = tirarCondicaoPropriaDasFichas(trocado, QUEIMANDO.id)
    expect(condicoesPropriasOf(tirado.tokens[0])).toEqual([MARCADO])
    expect('condicoesProprias' in tirado.tokens[1]).toBe(false)
    expect(tirarCondicaoPropriaDasFichas(tirado, QUEIMANDO.id)).toBe(tirado)
  })
})
