import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { applyItemChange } from './items'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { partyItemChange } from './party'
import {
  MOEDAS_MAX,
  cleanTradeTerms,
  moedasDe,
  moedasLabel,
  payCoinsChange,
  purseToward,
  readMoedas,
  tradeChange,
  tradeSideText,
  tradeTooBig,
} from './troca'

/**
 * MOEDAS E TROCA ENTRE FICHAS — regras puras. A bolsa é um número na ficha;
 * pagar tira de uma e põe na outra na MESMA mudança; a troca do mestre dá
 * itens novos e moedas e cobra itens da mochila e moedas, tudo ou nada.
 */

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x: 0, y: 0, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 400, 400, 40), tokens }
}

function ids(): () => string {
  let n = 0
  return () => `novo-${++n}`
}

describe('bolsa: leitura do disco e contagem', () => {
  it('ausente é zero; só inteiro positivo até o teto sobrevive ao disco', () => {
    expect(moedasDe(ficha('a'))).toBe(0)
    expect(moedasDe(ficha('a', { moedas: 7 }))).toBe(7)
    expect(readMoedas(12)).toBe(12)
    expect(readMoedas(0)).toBeUndefined()
    expect(readMoedas(-3)).toBeUndefined()
    expect(readMoedas(2.5)).toBeUndefined()
    expect(readMoedas('9')).toBeUndefined()
    expect(readMoedas(MOEDAS_MAX + 1)).toBeUndefined()
    expect(readMoedas(MOEDAS_MAX)).toBe(MOEDAS_MAX)
  })

  it('o rótulo diz singular e plural', () => {
    expect(moedasLabel(1)).toBe('1 moeda')
    expect(moedasLabel(3)).toBe('3 moedas')
  })
})

describe('pagar: moedas de uma ficha para outra', () => {
  it('tira de quem paga e põe em quem recebe, numa mudança só', () => {
    const map = mapaCom([ficha('ana', { moedas: 10 }), ficha('bia', { moedas: 2 })])
    const change = payCoinsChange(ficha('ana', { moedas: 10 }), ficha('bia', { moedas: 2 }), 4)
    expect(change).not.toBeNull()
    const depois = applyItemChange(map, change ?? { mochilas: [] })
    expect(depois.tokens.find((t) => t.id === 'ana')?.moedas).toBe(6)
    expect(depois.tokens.find((t) => t.id === 'bia')?.moedas).toBe(6)
  })

  it('pagar tudo deixa a bolsa AUSENTE (vazia), como o arquivo de antes do campo', () => {
    const map = mapaCom([ficha('ana', { moedas: 3 }), ficha('bia')])
    const change = payCoinsChange(ficha('ana', { moedas: 3 }), ficha('bia'), 3)
    const depois = applyItemChange(map, change ?? { mochilas: [] })
    const ana = depois.tokens.find((t) => t.id === 'ana')
    expect(ana).toBeDefined()
    expect(ana !== undefined && 'moedas' in ana).toBe(false)
    expect(depois.tokens.find((t) => t.id === 'bia')?.moedas).toBe(3)
  })

  it('recusa sem moeda bastante, valor zero, negativo ou quebrado, e pagar a si mesmo', () => {
    expect(payCoinsChange(ficha('ana', { moedas: 2 }), ficha('bia'), 3)).toBeNull()
    expect(payCoinsChange(ficha('ana', { moedas: 2 }), ficha('bia'), 0)).toBeNull()
    expect(payCoinsChange(ficha('ana', { moedas: 2 }), ficha('bia'), -1)).toBeNull()
    expect(payCoinsChange(ficha('ana', { moedas: 2 }), ficha('bia'), 1.5)).toBeNull()
    expect(payCoinsChange(ficha('ana', { moedas: 2 }), ficha('ana', { moedas: 2 }), 1)).toBeNull()
  })

  it('a bolsa de quem recebe não passa do teto', () => {
    expect(payCoinsChange(ficha('ana', { moedas: 5 }), ficha('bia', { moedas: MOEDAS_MAX }), 1)).toBeNull()
  })
})

describe('termos da troca do mestre', () => {
  it('limpa nomes, tira vazios e recusa troca sem nada dos dois lados', () => {
    expect(cleanTradeTerms({ de: '  Zulmira ', dou: { itens: [' Xarope ', ''], moedas: 0 }, peco: { itemIds: ['faca'], moedas: 3 } })).toEqual({
      de: 'Zulmira',
      dou: { itens: ['Xarope'], moedas: 0 },
      peco: { itemIds: ['faca'], moedas: 3 },
    })
    expect(cleanTradeTerms({ de: 'Zulmira', dou: { itens: [], moedas: 0 }, peco: { itemIds: [], moedas: 0 } })).toBeNull()
    expect(cleanTradeTerms({ de: 'Zulmira', dou: { itens: [], moedas: -1 }, peco: { itemIds: [], moedas: 2 } })).toBeNull()
  })

  it('sem quem oferece, a troca é do "Mestre"', () => {
    expect(cleanTradeTerms({ de: '   ', dou: { itens: ['Pão'], moedas: 0 }, peco: { itemIds: [], moedas: 1 } })?.de).toBe('Mestre')
  })

  it('o texto de um lado junta itens e moedas; lado vazio diz "nada"', () => {
    expect(tradeSideText(['Xarope', 'Vela'], 3)).toBe('Xarope, Vela e 3 moedas')
    expect(tradeSideText(['Xarope'], 0)).toBe('Xarope')
    expect(tradeSideText([], 1)).toBe('1 moeda')
    expect(tradeSideText([], 0)).toBe('nada')
  })
})

describe('disco e Grupo: a bolsa grava e volta', () => {
  it('o arquivo guarda a bolsa; valor torto some ao abrir, e ficha sem o campo continua sem', () => {
    const map = mapaCom([ficha('ana', { moedas: 7 }), ficha('bia'), ficha('caio', { moedas: 3 })])
    const cru = JSON.parse(serializeMap(map))
    cru.tokens[2].moedas = -4
    const lido = deserializeMap(JSON.stringify(cru))
    expect(lido.tokens[0]?.moedas).toBe(7)
    const bia = lido.tokens[1]
    const caio = lido.tokens[2]
    expect(bia !== undefined && 'moedas' in bia).toBe(false)
    expect(caio).toBeDefined()
    expect(caio !== undefined && 'moedas' in caio).toBe(false)
  })

  it('"Moedas…" do mestre grava a bolsa na cena da ficha; valor torto não grava', () => {
    const cena = { sceneId: 'cena-a', name: 'A', map: mapaCom([ficha('ana', { moedas: 2 })]) }
    const world = { open: cena, background: [] }
    const member = { playerId: 'p', name: 'Ana', connected: true, sceneId: 'cena-a', sceneName: 'A', token: { id: 'ana', color: '#ffffff', x: 0, y: 0 }, travelPending: false, mochila: [] }
    const change = partyItemChange(world, { kind: 'moedas', member, moedas: 15 }, 'x')
    expect(change).toEqual({ mochilas: [], bolsas: [{ tokenId: 'ana', moedas: 15 }] })
    expect(applyItemChange(cena.map, change ?? { mochilas: [] }).tokens[0]?.moedas).toBe(15)
    expect(partyItemChange(world, { kind: 'moedas', member, moedas: -1 }, 'x')).toBeNull()
  })
})

describe('troca aceita: tudo ou nada', () => {
  const termos = { de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 2 }, peco: { itemIds: ['faca'], moedas: 3 } }

  it('a ficha perde o item e as moedas pedidos e ganha o item novo e as moedas dadas', () => {
    const bruno = ficha('bruno', { moedas: 5, mochila: [{ id: 'faca', nome: 'Faca de rede' }, { id: 'vela', nome: 'Vela' }] })
    const change = tradeChange(bruno, termos.dou, termos.peco, ids())
    expect(change).not.toBeNull()
    const depois = applyItemChange(mapaCom([bruno]), change ?? { mochilas: [] }).tokens[0]
    expect(depois?.mochila).toEqual([
      { id: 'vela', nome: 'Vela' },
      { id: 'novo-1', nome: 'Xarope' },
    ])
    expect(depois?.moedas).toBe(4)
  })

  it('sem o item pedido ou sem moeda bastante, nada muda', () => {
    expect(tradeChange(ficha('bruno', { moedas: 5 }), termos.dou, termos.peco, ids())).toBeNull()
    expect(tradeChange(ficha('bruno', { moedas: 1, mochila: [{ id: 'faca', nome: 'Faca' }] }), termos.dou, termos.peco, ids())).toBeNull()
  })
})

describe('A bolsa que paga um colega (a mesma conta do host)', () => {
  const GRADE = 50
  const rica = ficha('rica', { x: 400, y: 400, moedas: 10 })
  const pobre = ficha('pobre', { x: 100, y: 100, moedas: 2 })
  const diego = ficha('diego', { x: 160, y: 100 })

  it('conta só a ficha dele encostada no colega, não a mais rica', () => {
    expect(purseToward([rica, pobre], diego, GRADE)).toBe(2)
  })

  it('ficha encostada sem o campo moedas: zero', () => {
    expect(purseToward([rica, ficha('semBolsa', { x: 100, y: 100 })], diego, GRADE)).toBe(0)
  })

  it('duas encostadas: a maior delas, como o host tenta uma por uma', () => {
    expect(purseToward([pobre, ficha('outra', { x: 120, y: 140, moedas: 7 })], diego, GRADE)).toBe(7)
  })

  it('nenhuma encostada, ou colega fora do mapa: a maior de todas (o host responde "longe")', () => {
    expect(purseToward([rica, pobre], ficha('longe', { x: 900, y: 900 }), GRADE)).toBe(10)
    expect(purseToward([rica, pobre], undefined, GRADE)).toBe(10)
    expect(purseToward([], undefined, GRADE)).toBe(0)
  })
})

describe('Troca grande demais', () => {
  const vazio = { itens: [], moedas: 0 }
  it('mais de 10 itens de um lado é grande demais; 10 não', () => {
    const onze = Array.from({ length: 11 }, (_, i) => `Item ${i + 1}`)
    expect(tradeTooBig({ de: '', dou: { itens: onze, moedas: 0 }, peco: { itemIds: [], moedas: 0 } })).toBe(true)
    expect(tradeTooBig({ de: '', dou: vazio, peco: { itemIds: onze, moedas: 0 } })).toBe(true)
    expect(tradeTooBig({ de: '', dou: { itens: onze.slice(0, 10), moedas: 0 }, peco: { itemIds: onze.slice(0, 10), moedas: 0 } })).toBe(false)
  })

  it('nome vazio e id repetido não contam, como na oferta limpa', () => {
    const dezEVazios = [...Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`), '  ', '']
    expect(tradeTooBig({ de: '', dou: { itens: dezEVazios, moedas: 0 }, peco: { itemIds: ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'], moedas: 0 } })).toBe(false)
    expect(cleanTradeTerms({ de: '', dou: { itens: dezEVazios, moedas: 0 }, peco: { itemIds: [], moedas: 0 } })?.dou.itens.length).toBe(10)
  })
})
