/**
 * MAPA POR ANDARES: o mestre marca cenas como andares do mesmo prédio (nome
 * do prédio + rótulo curto do andar). O rótulo é o que o jogador lê na aba
 * (1F, 2F, B1); o nome do prédio fica no mestre.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { cleanFloorLabel, FLOOR_BUILDING_MAX_LENGTH, readSceneFloor, sameBuilding, sortFloorLabels } from './buildingFloors'

describe('cleanFloorLabel', () => {
  it('rótulo curto vira maiúsculo e sem espaço', () => {
    expect(cleanFloorLabel(' 1f ')).toBe('1F')
    expect(cleanFloorLabel('b1')).toBe('B1')
    expect(cleanFloorLabel('R F')).toBe('RF')
  })

  it('SEGURANÇA: rótulo que não é rótulo de andar (longo, com símbolo, vazio) é recusado — não vira canal para o nome da cena', () => {
    expect(cleanFloorLabel('')).toBeNull()
    expect(cleanFloorLabel('   ')).toBeNull()
    expect(cleanFloorLabel('Porao')).toBeNull()
    expect(cleanFloorLabel('2-F')).toBeNull()
    expect(cleanFloorLabel('<b>')).toBeNull()
  })
})

describe('readSceneFloor', () => {
  it('lê prédio e rótulo, limpando o rótulo', () => {
    expect(readSceneFloor({ predio: ' Mansao ', rotulo: '1f' })).toEqual({ predio: 'Mansao', rotulo: '1F' })
  })

  it('prédio longo é cortado no teto', () => {
    const lido = readSceneFloor({ predio: 'x'.repeat(FLOOR_BUILDING_MAX_LENGTH + 40), rotulo: '2F' })
    expect(lido?.predio.length).toBe(FLOOR_BUILDING_MAX_LENGTH)
    expect(lido?.rotulo).toBe('2F')
  })

  it('forma torta volta ausente', () => {
    for (const cru of [undefined, null, 'B1', [], {}, { predio: 'M' }, { rotulo: '1F' }, { predio: '', rotulo: '1F' }, { predio: 'M', rotulo: 'Porao' }, { predio: 3, rotulo: '1F' }]) {
      expect(readSceneFloor(cru), JSON.stringify(cru)).toBeUndefined()
    }
  })
})

describe('sameBuilding', () => {
  it('compara o prédio sem maiúsculas nem espaços', () => {
    expect(sameBuilding({ predio: 'Mansão Spencer', rotulo: '1F' }, { predio: 'mansão  spencer', rotulo: 'B1' })).toBe(true)
    expect(sameBuilding({ predio: 'Mansão', rotulo: '1F' }, { predio: 'Delegacia', rotulo: '1F' })).toBe(false)
  })
})

describe('sortFloorLabels', () => {
  it('subsolo embaixo à esquerda, andares em ordem, o resto no fim', () => {
    expect(sortFloorLabels(['2F', 'RF', 'B1', '1F', 'B2'])).toEqual(['B2', 'B1', '1F', '2F', 'RF'])
  })
})

describe('mapFile: andar', () => {
  it('vai e volta do disco', () => {
    const map = { ...createEmptyMap('m', 'Porao', 5, 5, 50), andar: { predio: 'Mansao', rotulo: 'B1' } }
    expect(deserializeMap(serializeMap(map)).andar).toEqual({ predio: 'Mansao', rotulo: 'B1' })
  })

  it('mapa antigo e lixo editado à mão abrem sem o campo', () => {
    expect(deserializeMap('{"id": "antigo"}').andar).toBeUndefined()
    expect(deserializeMap('{"id": "torto", "andar": {"predio": "M", "rotulo": "Sotao escuro"}}').andar).toBeUndefined()
    expect(serializeMap(deserializeMap('{"id": "antigo"}'))).not.toContain('andar')
  })
})
