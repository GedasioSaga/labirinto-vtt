/**
 * TEXTO DE CHEGADA DA CENA: o mestre escreve um texto curto na cena, e quem
 * chega nela lê uma vez. Aqui, a forma do dado: o que vale como texto, o teto
 * e o campo no disco (novo e opcional — mapa antigo abre igual).
 */
import { describe, expect, it } from 'vitest'
import { ARRIVAL_TEXT_MAX_LENGTH, readArrivalText, setArrivalText } from './arrivalText'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

describe('readArrivalText', () => {
  it('apara as pontas e guarda o miolo como o mestre escreveu', () => {
    expect(readArrivalText('  O ar cheira a enxofre.\nAlguém sussurra.  ')).toBe('O ar cheira a enxofre.\nAlguém sussurra.')
  })

  it('vazio, só espaço ou o que não é texto: nenhum texto', () => {
    for (const valor of ['', '   \n ', 42, null, undefined, {}, ['oi'], true]) {
      expect(readArrivalText(valor), JSON.stringify(valor)).toBeUndefined()
    }
  })

  it('corta no teto sem partir um emoji ao meio', () => {
    expect(readArrivalText('x'.repeat(ARRIVAL_TEXT_MAX_LENGTH + 30))).toBe('x'.repeat(ARRIVAL_TEXT_MAX_LENGTH))
    // O emoji começa na última posição: fica o texto sem a metade órfã.
    const cortado = readArrivalText(`${'x'.repeat(ARRIVAL_TEXT_MAX_LENGTH - 1)}🐉fim`)
    expect(cortado).toBe('x'.repeat(ARRIVAL_TEXT_MAX_LENGTH - 1))
  })
})

describe('setArrivalText', () => {
  const base = createEmptyMap('m', 'Cripta', 10, 10, 50)

  it('grava o texto limpo na cena', () => {
    expect(setArrivalText(base, '  Frio.  ').textoChegada).toBe('Frio.')
  })

  it('apagar tira o campo: a cena volta igual a um mapa sem texto', () => {
    const comTexto = setArrivalText(base, 'Frio.')
    const sem = setArrivalText(comTexto, '   ')
    expect('textoChegada' in sem).toBe(false)
    expect(sem).toEqual(base)
  })

  it('o mesmo texto devolve o MESMO mapa (não vira passo do desfazer)', () => {
    const comTexto = setArrivalText(base, 'Frio.')
    expect(setArrivalText(comTexto, ' Frio. ')).toBe(comTexto)
    expect(setArrivalText(base, '')).toBe(base)
  })
})

describe('mapFile: textoChegada', () => {
  it('vai e volta do disco', () => {
    const map = setArrivalText(createEmptyMap('m', 'Cripta', 10, 10, 50), 'Frio e silêncio.')
    expect(deserializeMap(serializeMap(map)).textoChegada).toBe('Frio e silêncio.')
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap('{"id": "antigo"}')
    expect(antigo.textoChegada).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('textoChegada')
  })

  it('valor fora da forma (editado à mão) abre sem o campo', () => {
    for (const valor of ['42', 'null', '""', '"   "', '{}', '["a"]']) {
      const lido = deserializeMap(`{"id": "torto", "textoChegada": ${valor}}`)
      expect(lido.textoChegada, valor).toBeUndefined()
      expect(serializeMap(lido), valor).not.toContain('textoChegada')
    }
  })
})
