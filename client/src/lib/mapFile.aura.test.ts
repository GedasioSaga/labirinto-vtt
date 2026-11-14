import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import type { MapData, Token } from '../types/map'

/**
 * AURA DA FICHA e MUDAR FICHA no disco (pedido de 14/11/2026): `Token.aura`
 * (tipo + interruptor) e `Token.formaVisivel` (o id do cartão de transformação)
 * vão e voltam do arquivo. `fotoDaForma` é campo de FIO (só o recorte do
 * jogador escreve): arquivo que o traga abre sem ele. Aura torta some e a
 * ficha abre sem aura; mapa de antes abre e grava sem os campos.
 */

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 96, y: 96, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'Salão', 5, 5, 64), tokens }
}

describe('mapFile: aura e forma visível da ficha', () => {
  it('a aura (ligada e desligada) e a forma visível vão e voltam do disco', () => {
    const salvo = mapaCom([
      ficha('goku', { characterId: 'p_goku', aura: { tipo: 'eletrica-amarela', ligada: true }, formaVisivel: 'forma_ssj' }),
      ficha('vegeta', { aura: { tipo: 'trevas', ligada: false } }),
      ficha('aldeao'),
    ])

    const aberto = deserializeMap(serializeMap(salvo))

    expect(aberto.tokens.map((t) => t.id)).toEqual(['goku', 'vegeta', 'aldeao'])
    expect(aberto.tokens[0].aura).toEqual({ tipo: 'eletrica-amarela', ligada: true })
    expect(aberto.tokens[0].formaVisivel).toBe('forma_ssj')
    expect(aberto.tokens[1].aura).toEqual({ tipo: 'trevas', ligada: false })
    expect('formaVisivel' in aberto.tokens[1]).toBe(false)
    // Ficha sem aura continua sem o campo: o arquivo de antes não ganha linha nova.
    expect('aura' in aberto.tokens[2]).toBe(false)
    // Salvar de novo o que abriu dá o mesmo arquivo.
    expect(serializeMap(aberto)).toBe(serializeMap(salvo))
  })

  it('arquivo torto: `fotoDaForma` gravada some, aura fora da lista some, forma que não é texto some', () => {
    const base = '"characterId": null, "name": "X", "x": 1, "y": 2, "size": 1, "image": null'
    const lido = deserializeMap(
      `{"id": "torto", "tokens": [
        {"id": "a", ${base}, "aura": {"tipo": "fogo", "ligada": true, "raio": 99}, "formaVisivel": "forma_1", "fotoDaForma": "midia:abc"},
        {"id": "b", ${base}, "aura": {"tipo": "arco-iris", "ligada": true}, "formaVisivel": 7},
        {"id": "c", ${base}, "aura": {"tipo": "fogo", "ligada": "sim"}, "formaVisivel": ""}
      ]}`,
    )

    // A certa volta só com os dois campos; a forma fica; o campo de fio não entra.
    expect(lido.tokens[0].aura).toEqual({ tipo: 'fogo', ligada: true })
    expect(lido.tokens[0].formaVisivel).toBe('forma_1')
    expect('fotoDaForma' in lido.tokens[0]).toBe(false)
    for (const torta of [lido.tokens[1], lido.tokens[2]]) {
      expect('aura' in torta, torta.id).toBe(false)
      expect('formaVisivel' in torta, torta.id).toBe(false)
    }
    const regravado = serializeMap(lido)
    expect(regravado).not.toContain('fotoDaForma')
    expect(regravado).not.toContain('arco-iris')
  })
})
