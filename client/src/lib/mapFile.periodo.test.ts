/**
 * DIA/TARDE/NOITE (L0) no disco: `MapData.periodoFixo` (no `map.json` da cena)
 * e `Adventure.periodo` (no `adventure.json`) são campos NOVOS e OPCIONAIS.
 * Mapa e aventura de antes abrem e salvam byte a byte iguais; valor torto sai
 * sem derrubar o arquivo; o 'manha' do relógio antigo é lido como 'dia' e
 * nunca é gravado.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Periodo } from '../types/map'
import { parseAdventure, serializeAdventure, type Adventure } from './adventure'
import legacyMapJson from './__fixtures__/legacy-map.json'
import legacyRoomDoorJson from './__fixtures__/legacy-room-door.json'
import l1Json from '../../../maps/L1.json'
import antesL1 from './__fixtures__/roundtrip-924c2bdd/L1.json'
import antesLegacyMap from './__fixtures__/roundtrip-924c2bdd/legacy-map.json'
import antesLegacyRoomDoor from './__fixtures__/roundtrip-924c2bdd/legacy-room-door.json'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

const PERIODOS: Periodo[] = ['dia', 'tarde', 'noite']
const TORTOS = ['"madrugada"', '"Noite"', '""', '0', '3', 'null', 'true', '{}', '["noite"]']

describe('periodoFixo no arquivo: mapa de antes', () => {
  // O L1 real e as duas cópias congeladas; o terceiro valor é a saída de
  // serializeMap(deserializeMap(x)) congelada antes das camadas (924c2bdd).
  const fixtures: [string, string, unknown][] = [
    ['maps/L1.json', JSON.stringify(l1Json), antesL1],
    ['__fixtures__/legacy-map.json', JSON.stringify(legacyMapJson), antesLegacyMap],
    ['__fixtures__/legacy-room-door.json', JSON.stringify(legacyRoomDoorJson), antesLegacyRoomDoor],
  ]

  for (const [nome, bruto, antes] of fixtures) {
    it(`${nome}: abre sem o campo e salva byte a byte igual`, () => {
      const lido = deserializeMap(bruto)
      expect('periodoFixo' in lido).toBe(false)
      const uma = serializeMap(lido)
      expect(uma).toBe(JSON.stringify(antes, null, 2))
      expect(serializeMap(deserializeMap(uma))).toBe(uma)
      for (const chave of ['"periodoFixo"', '"ambientePorPeriodo"', '"visaoPorPeriodo"']) expect(uma).not.toContain(chave)
      expect('ambientePorPeriodo' in lido || 'visaoPorPeriodo' in lido).toBe(false)
    })
  }
})

describe('ambientePorPeriodo e visaoPorPeriodo no arquivo', () => {
  const comCampos: MapData = {
    ...createEmptyMap('m-ambiente', 'Brejo', 10, 10, 64),
    externa: true,
    ambientePorPeriodo: { tarde: { forca: 0.3 }, noite: { cor: '#0a0f1e', forca: 1 } },
    visaoPorPeriodo: { tarde: 8, noite: 0 },
  }

  it('mapa com os campos faz ida e volta idêntica', () => {
    const uma = serializeMap(deserializeMap(serializeMap(comCampos)))
    expect(serializeMap(deserializeMap(uma))).toBe(uma)
    const lido = deserializeMap(uma)
    expect(lido.ambientePorPeriodo).toEqual({ tarde: { forca: 0.3 }, noite: { cor: '#0a0f1e', forca: 1 } })
    expect(lido.visaoPorPeriodo).toEqual({ tarde: 8, noite: 0 })
  })

  it('parte torta sai, a boa fica, e nada que preste tira a chave', () => {
    const lido = deserializeMap(JSON.stringify({
      id: 'torta',
      ambientePorPeriodo: { dia: { cor: '#000000' }, manha: { forca: 1 }, tarde: { cor: 'lixo', forca: '0.5' }, noite: { cor: '#123456', forca: 7, extra: 1 } },
      visaoPorPeriodo: { dia: 3, tarde: 2.5, noite: 6 },
    }))
    expect(lido.ambientePorPeriodo).toEqual({ noite: { cor: '#123456', forca: 1 } })
    expect(lido.visaoPorPeriodo).toEqual({ noite: 6 })

    const semCampo = serializeMap(deserializeMap('{"id": "torta"}'))
    for (const torto of ['null', '3', '"noite"', '[]', '{}', '{"tarde": {"cor": 1}}', '{"noite": -1}', '{"tarde": 201}']) {
      const outro = deserializeMap(`{"id": "torta", "ambientePorPeriodo": ${torto}, "visaoPorPeriodo": ${torto}}`)
      expect('ambientePorPeriodo' in outro || 'visaoPorPeriodo' in outro).toBe(false)
      expect(serializeMap(outro)).toBe(semCampo)
    }
  })
})

describe('periodoFixo no arquivo: campo novo', () => {
  function cena(periodoFixo?: Periodo): MapData {
    const base = createEmptyMap('m-periodo', 'Taverna', 10, 10, 64)
    return periodoFixo === undefined ? base : { ...base, periodoFixo }
  }

  for (const periodo of PERIODOS) {
    it(`'${periodo}' faz ida e volta idêntica`, () => {
      const uma = serializeMap(deserializeMap(serializeMap(cena(periodo))))
      expect(serializeMap(deserializeMap(uma))).toBe(uma)
      expect(deserializeMap(uma).periodoFixo).toBe(periodo)
      expect(deserializeMap(uma)).toEqual(deserializeMap(serializeMap(cena(periodo))))
    })
  }

  it('fixo e externa convivem no arquivo', () => {
    const lido = deserializeMap(serializeMap({ ...cena('noite'), externa: true }))
    expect(lido.periodoFixo).toBe('noite')
    expect(lido.externa).toBe(true)
  })

  it("'manha' antigo abre como 'dia' e nunca é gravado", () => {
    const lido = deserializeMap('{"id": "velha", "periodoFixo": "manha"}')
    expect(lido.periodoFixo).toBe('dia')
    const gravado = serializeMap(lido)
    expect(gravado).toContain('"periodoFixo": "dia"')
    expect(gravado).not.toContain('manha')
  })

  it('valor torto sai sem derrubar o mapa e sem deixar a chave', () => {
    const semCampo = serializeMap(deserializeMap('{"id": "torta", "name": "Torta"}'))
    for (const torto of TORTOS) {
      const lido = deserializeMap(`{"id": "torta", "name": "Torta", "periodoFixo": ${torto}}`)
      expect(lido.id).toBe('torta')
      expect('periodoFixo' in lido).toBe(false)
      expect(serializeMap(lido)).toBe(semCampo)
    }
  })
})

describe('Adventure.periodo no adventure.json', () => {
  const antiga: Adventure = {
    version: 1,
    id: 'adv_antiga',
    name: 'Antiga',
    startSceneId: 's1',
    scenes: [
      { id: 's1', name: 'Vila', file: 'scenes/s1/map.json' },
      { id: 's2', name: 'Taverna', file: 'scenes/s2/map.json', parentId: 's1' },
    ],
  }
  const ANTIGA_JSON = serializeAdventure(antiga)

  it('aventura de antes abre sem o campo e salva byte a byte igual', () => {
    const lida = parseAdventure(ANTIGA_JSON)
    expect('periodo' in lida).toBe(false)
    expect(serializeAdventure(lida)).toBe(ANTIGA_JSON)
    expect(ANTIGA_JSON).not.toContain('"periodo"')
  })

  for (const periodo of PERIODOS) {
    it(`'${periodo}' faz ida e volta idêntica`, () => {
      const json = serializeAdventure({ ...antiga, periodo })
      const lida = parseAdventure(json)
      expect(lida.periodo).toBe(periodo)
      expect(serializeAdventure(lida)).toBe(json)
    })
  }

  it("'manha' antigo abre como 'dia' e nunca é gravado", () => {
    const comManha = ANTIGA_JSON.replace('"name": "Antiga",', '"name": "Antiga",\n  "periodo": "manha",')
    expect(comManha).toContain('"periodo": "manha"')
    const lida = parseAdventure(comManha)
    expect(lida.periodo).toBe('dia')
    const gravado = serializeAdventure(lida)
    expect(gravado).toContain('"periodo": "dia"')
    expect(gravado).not.toContain('manha')
  })

  it('valor torto sai sem derrubar a aventura e sem deixar a chave', () => {
    for (const torto of TORTOS) {
      const comTorto = ANTIGA_JSON.replace('"name": "Antiga",', `"name": "Antiga",\n  "periodo": ${torto},`)
      const lida = parseAdventure(comTorto)
      expect(lida.scenes).toHaveLength(2)
      expect('periodo' in lida).toBe(false)
      expect(serializeAdventure(lida)).toBe(ANTIGA_JSON)
    }
  })
})
