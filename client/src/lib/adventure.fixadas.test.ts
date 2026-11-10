/**
 * HOJE NA SESSÃO no arquivo: as fixadas vão no `adventure.json` (campo
 * `fixadas`), e a aventura de antes do campo abre e regrava byte a byte igual.
 */
import { describe, expect, it } from 'vitest'
import { comFixadas, parseAdventure, serializeAdventure } from './adventure'

const ANTIGA = JSON.stringify(
  {
    version: 1,
    id: 'adv_vila',
    name: 'Vila Pedra-Lume',
    startSceneId: 'vila',
    scenes: [
      { id: 'vila', name: 'Vila Pedra-Lume', file: 'maps/vila.json' },
      { id: 'praca', name: 'Praça da Vila', file: 'maps/praca.json', parentId: 'vila' },
      { id: 'clareira', name: 'Bosque – clareira ao anoitecer', file: 'maps/clareira.json', parentId: 'vila' },
    ],
  },
  null,
  2,
)

describe('fixadas no adventure.json', () => {
  it('aventura antiga, sem o campo, abre sem fixadas e regrava igual; tirar a última volta ao arquivo de antes', () => {
    const antiga = parseAdventure(ANTIGA)
    expect(antiga.fixadas).toBeUndefined()
    expect(serializeAdventure(antiga)).toBe(ANTIGA)
    const comUma = comFixadas(antiga, ['clareira'])
    expect(serializeAdventure(comUma)).toContain('"fixadas"')
    expect(serializeAdventure(comFixadas(comUma, []))).toBe(ANTIGA)
  })

  it('reabrir mantém a ordem; id que não existe, repetido ou que não é texto sai, e lixo vira sem campo', () => {
    const salva = serializeAdventure(comFixadas(parseAdventure(ANTIGA), ['clareira', 'vila']))
    expect(parseAdventure(salva).fixadas).toEqual(['clareira', 'vila'])
    const torta = JSON.parse(ANTIGA) as Record<string, unknown>
    torta.fixadas = ['praca', 'sumiu', 'praca', 7, 'vila', 'clareira']
    expect(parseAdventure(JSON.stringify(torta)).fixadas).toEqual(['praca', 'vila', 'clareira'])
    torta.fixadas = 'lixo'
    expect(parseAdventure(JSON.stringify(torta)).fixadas).toBeUndefined()
  })
})
