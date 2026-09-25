/**
 * "Visão nesta cena" (`MapData.visionCells`) é campo NOVO e OPCIONAL: vai e
 * volta do disco, cena salva antes dele abre sem valor (o raio de hoje) e
 * valor torto de arquivo editado à mão vira ausente, nunca raio zero.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap, setSceneVisionCells } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

describe('visionCells no arquivo da cena', () => {
  it('faz ida e volta', () => {
    const mina = { ...createEmptyMap('mina', 'Mina', 20, 20, 64), visionCells: 6 }
    expect(deserializeMap(serializeMap(mina)).visionCells).toBe(6)
    expect(deserializeMap(serializeMap(mina))).toEqual(mina)
  })

  it('cena salva antes do campo abre sem valor', () => {
    const antiga = deserializeMap('{"id": "antiga"}')
    expect(antiga.visionCells).toBeUndefined()
    expect(serializeMap(antiga)).not.toContain('visionCells')
  })

  it('setSceneVisionCells grava o valor; sem valor tira o campo em vez de gravar null', () => {
    const cena = createEmptyMap('c', 'C', 5, 5, 64)
    const comValor = setSceneVisionCells(cena, 6)
    expect(comValor.visionCells).toBe(6)
    const semValor = setSceneVisionCells(comValor, undefined)
    expect('visionCells' in semValor).toBe(false)
    expect(serializeMap(semValor)).toBe(serializeMap(cena))
  })

  it('valor torto volta ausente', () => {
    for (const torto of ['0', '-4', '2.5', '"6"', 'null', '1e9']) {
      expect(deserializeMap(`{"id": "torta", "visionCells": ${torto}}`).visionCells).toBeUndefined()
    }
  })
})
