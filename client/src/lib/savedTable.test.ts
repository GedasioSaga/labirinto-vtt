import { describe, expect, it } from 'vitest'
import { loadSavedTable, parseSavedTable, reclaimText, savedTableKey, savedTableSummary, storeSavedTable, type SavedTable, type TableStorage } from './savedTable'

/**
 * RETOMAR A MESA: o arquivo da mesa guarda, por NOME de jogador, as fichas, o
 * raio e a cena. É dado do mestre (localStorage do app dele): nunca vai pela
 * rede. Aqui mora só a leitura/gravação, que precisa aguentar arquivo
 * corrompido e storage que lança.
 */

const MESA: SavedTable = {
  version: 1,
  code: 'AB12CD',
  seats: [
    { name: 'Ana', tokenIds: ['lirio'], visionRadius: 350, sceneKey: 'm-salao' },
    { name: 'Bruno', tokenIds: ['grog', 'corvo'], visionRadius: null, sceneKey: null },
  ],
}

function memoria(): TableStorage & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return {
    dados,
    getItem: (key) => dados.get(key) ?? null,
    setItem: (key, value) => {
      dados.set(key, value)
    },
  }
}

describe('savedTable: o arquivo da mesa', () => {
  it('grava e relê a mesma mesa, na chave da aventura', () => {
    const storage = memoria()
    storeSavedTable(storage, 'adv_1', MESA)
    expect([...storage.dados.keys()]).toEqual([savedTableKey('adv_1')])
    expect(loadSavedTable(storage, 'adv_1')).toEqual(MESA)
    // Outra aventura não herda a mesa desta.
    expect(loadSavedTable(storage, 'adv_2')).toBeNull()
  })

  it('arquivo corrompido, de outra versão ou sem ninguém com ficha não oferece retomar', () => {
    expect(parseSavedTable('lixo')).toBeNull()
    expect(parseSavedTable(null)).toBeNull()
    expect(parseSavedTable({ ...MESA, version: 2 })).toBeNull()
    expect(parseSavedTable({ ...MESA, seats: [] })).toBeNull()
    expect(parseSavedTable({ ...MESA, code: 42 })).toBeNull()
    // Assento torto sai; o resto da mesa continua valendo.
    const torta = parseSavedTable({ ...MESA, seats: [...MESA.seats, { name: '', tokenIds: ['x'] }, { name: 'Zé', tokenIds: 'x' }, { name: 'Sem', tokenIds: [] }] })
    expect(torta?.seats.map((s) => s.name)).toEqual(['Ana', 'Bruno'])
    // Raio fora de número vira "sem ajuste"; cena que não é texto vira "sem cena".
    const raio = parseSavedTable({ ...MESA, seats: [{ name: 'Ana', tokenIds: ['lirio'], visionRadius: 'x', sceneKey: 7 }] })
    expect(raio?.seats).toEqual([{ name: 'Ana', tokenIds: ['lirio'], visionRadius: null, sceneKey: null }])
  })

  it('storage que lança ou não existe: ler dá null e gravar não derruba nada', () => {
    const quebrado: TableStorage = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('cheio')
      },
    }
    expect(loadSavedTable(quebrado, 'adv_1')).toBeNull()
    expect(() => storeSavedTable(quebrado, 'adv_1', MESA)).not.toThrow()
    expect(loadSavedTable(null, 'adv_1')).toBeNull()
    expect(() => storeSavedTable(null, 'adv_1', MESA)).not.toThrow()
    const storage = memoria()
    storage.dados.set(savedTableKey('adv_1'), '{nao é json')
    expect(loadSavedTable(storage, 'adv_1')).toBeNull()
  })

  it('o resumo lista quem tem ficha guardada, e o aviso da volta diz o que foi devolvido', () => {
    expect(savedTableSummary(MESA)).toBe('Ana e Bruno')
    expect(savedTableSummary({ ...MESA, seats: [MESA.seats[0], MESA.seats[1], { ...MESA.seats[0], name: 'Carla' }] })).toBe('Ana, Bruno e Carla')
    expect(reclaimText('Ana', ['Lírio'])).toBe('Ana voltou: Lírio devolvida')
    expect(reclaimText('Bruno', ['Grog', 'Corvo'])).toBe('Bruno voltou: Grog e Corvo devolvidas')
    expect(reclaimText('Bruno', ['Grog', 'Corvo', 'Lua'])).toBe('Bruno voltou: Grog, Corvo e Lua devolvidas')
  })
})
