import { describe, expect, it } from 'vitest'
import { createExploration, encodeExploration } from './exploration'
import {
  loadSavedExploration,
  loadSavedTable,
  parseSavedExploration,
  savedExplorationKey,
  savedTableKey,
  storeSavedExploration,
  storeSavedTable,
  type SavedExploration,
  type SavedSceneMemory,
  type TableStorage,
} from './savedTable'

/**
 * O MAPA EXPLORADO DA MESA: por nome de jogador, o que ele explorou em cada
 * cena e o último estado das portas que viu. Mora numa chave SEPARADA da mesa:
 * é o pedaço grande, e a pergunta "Retomar a mesa?" (lida a cada desenho do
 * painel) não pode pagar por ele. Storage cheio não pode custar a mesa.
 */

function cena(mapId: string): SavedSceneMemory {
  const exp = createExploration({ width: 1500, height: 500, grid: 50 })
  exp.bits[0] = 0b1011
  return { mapId, width: 30, height: 10, grid: 50, explored: encodeExploration(exp), doors: [{ wallId: 'porta-1', open: true, locked: false, kind: 'normal' }] }
}

const EXPLORADO: SavedExploration = {
  version: 1,
  seats: [
    { name: 'Carla', scenes: [cena('m-terreo'), cena('m-porao')] },
    { name: 'Diego', scenes: [cena('m-porao')] },
  ],
}

function memoria(limite = Number.POSITIVE_INFINITY): TableStorage & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return {
    dados,
    getItem: (key) => dados.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > limite) throw new Error('QuotaExceededError')
      dados.set(key, value)
    },
  }
}

describe('savedTable: o mapa explorado de cada jogador', () => {
  it('grava e relê o mesmo explorado, numa chave separada da mesa', () => {
    const storage = memoria()
    storeSavedExploration(storage, 'adv_1', EXPLORADO)
    expect([...storage.dados.keys()]).toEqual([savedExplorationKey('adv_1')])
    expect(savedExplorationKey('adv_1')).not.toBe(savedTableKey('adv_1'))
    expect(loadSavedExploration(storage, 'adv_1')).toEqual(EXPLORADO)
    expect(loadSavedExploration(storage, 'adv_2')).toBeNull()
    // A pergunta "Retomar a mesa?" lê só a mesa: o explorado não a faz aparecer.
    expect(loadSavedTable(storage, 'adv_1')).toBeNull()
  })

  it('arquivo torto: jogador, cena ou porta fora do formato sai; o resto vale', () => {
    expect(parseSavedExploration('lixo')).toBeNull()
    expect(parseSavedExploration({ ...EXPLORADO, version: 2 })).toBeNull()
    expect(parseSavedExploration({ version: 1, seats: 'x' })).toBeNull()
    const boa = cena('m-porao')
    const torta = parseSavedExploration({
      version: 1,
      seats: [
        { name: 'Carla', scenes: [boa, { ...boa, mapId: '' }, { ...boa, width: -1 }, { ...boa, explored: { cell: 'x' } }, { ...boa, doors: 'x' }] },
        { name: '', scenes: [boa] },
        { name: 'Sem', scenes: [] },
        { name: 'Porta', scenes: [{ ...boa, doors: [{ wallId: 'p', open: 'sim', locked: false, kind: 'normal' }, { wallId: 'q', open: false, locked: true, kind: 'alçapão' }] }] },
      ],
    })
    expect(torta?.seats.map((seat) => [seat.name, seat.scenes.length])).toEqual([
      ['Carla', 1],
      ['Porta', 1],
    ])
    // Porta torta sai sozinha: a cena continua.
    expect(torta?.seats[1]?.scenes[0]?.doors).toEqual([])
  })

  it('storage cheio: grava só a cena mais recente de cada um, e a mesa continua gravada', () => {
    const cheia = JSON.stringify(EXPLORADO).length
    const storage = memoria(cheia - 1)
    storeSavedTable(storage, 'adv_1', { version: 1, code: 'AB12CD', seats: [{ name: 'Carla', tokenIds: ['carla-f'], visionRadius: 250, sceneKey: 'm-porao' }] })
    storeSavedExploration(storage, 'adv_1', EXPLORADO)
    expect(loadSavedTable(storage, 'adv_1')?.seats[0]?.name).toBe('Carla')
    const lida = loadSavedExploration(storage, 'adv_1')
    expect(lida?.seats.map((seat) => [seat.name, seat.scenes.map((scene) => scene.mapId)])).toEqual([
      ['Carla', ['m-porao']],
      ['Diego', ['m-porao']],
    ])
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
    expect(loadSavedExploration(quebrado, 'adv_1')).toBeNull()
    expect(() => storeSavedExploration(quebrado, 'adv_1', EXPLORADO)).not.toThrow()
    expect(loadSavedExploration(null, 'adv_1')).toBeNull()
    expect(() => storeSavedExploration(null, 'adv_1', EXPLORADO)).not.toThrow()
    const storage = memoria()
    storage.dados.set(savedExplorationKey('adv_1'), '{nao é json')
    expect(loadSavedExploration(storage, 'adv_1')).toBeNull()
  })
})
