import { describe, expect, it } from 'vitest'
import type { CondicaoPropria, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  CONDICOES_POR_FICHA_MAX,
  SIMBOLO_DIGITADO_MAX,
  alternarCondicaoPropria,
  condicoesPropriasOf,
  lerCondicaoPropria,
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
