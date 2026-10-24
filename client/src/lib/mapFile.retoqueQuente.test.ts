/**
 * MEIO-TERMO, RETOQUE Q (MT9) no disco: `Room.chamine`, `Prop.mobiliaDesenho`,
 * `MapData.vistaDosMoveis` e `Wall.grade` são campos NOVOS e OPCIONAIS.
 * Mapa de antes abre sem nenhum deles e salva byte a byte igual (as cópias
 * congeladas `roundtrip-924c2bdd`); o mapa com os quatro faz ida e volta
 * idêntica; valor torto sai sem derrubar o arquivo e sem deixar a chave.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Region, Wall } from '../types/map'
import legacyMapJson from './__fixtures__/legacy-map.json'
import legacyRoomDoorJson from './__fixtures__/legacy-room-door.json'
import l1Json from '../../../maps/L1.json'
import antesL1 from './__fixtures__/roundtrip-924c2bdd/L1.json'
import antesLegacyMap from './__fixtures__/roundtrip-924c2bdd/legacy-map.json'
import antesLegacyRoomDoor from './__fixtures__/roundtrip-924c2bdd/legacy-room-door.json'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

const CHAVES_NOVAS = ['"chamine"', '"mobiliaDesenho"', '"vistaDosMoveis"', '"grade"']
const TORTOS = ['false', 'null', '0', '1', '""', '"sim"', '"Linhas"', '"tres_quartos"', '{}', '[]', '["linhas"]']

const CASA: Region = {
  id: 'casa',
  points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
  tag: '',
  fillColor: '#3a7ad0',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Casa', roof: true, chamine: true },
}
const CELA: Wall = { id: 'cela', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: false, blocksMove: true, door: null, janela: true, grade: true }
const MESA: Prop = { id: 'mesa', src: '', x: 50, y: 50, width: 64, height: 64, linkedMapPath: null, mobilia: 'mesa', mobiliaDesenho: 'linhas' }

function comOsQuatro(): MapData {
  return { ...createEmptyMap('m-q', 'Vila', 10, 10, 64), regions: [CASA], walls: [CELA], props: [MESA], vistaDosMoveis: 'tres-quartos' }
}

describe('retoque Q no arquivo: mapa de antes', () => {
  // O L1 real e as duas cópias congeladas; o terceiro valor é a saída de
  // serializeMap(deserializeMap(x)) congelada antes das camadas (924c2bdd).
  const fixtures: [string, string, unknown][] = [
    ['maps/L1.json', JSON.stringify(l1Json), antesL1],
    ['__fixtures__/legacy-map.json', JSON.stringify(legacyMapJson), antesLegacyMap],
    ['__fixtures__/legacy-room-door.json', JSON.stringify(legacyRoomDoorJson), antesLegacyRoomDoor],
  ]

  for (const [nome, bruto, antes] of fixtures) {
    it(`${nome}: abre sem os campos e salva byte a byte igual`, () => {
      const lido = deserializeMap(bruto)
      const uma = serializeMap(lido)
      expect(uma).toBe(JSON.stringify(antes, null, 2))
      expect(serializeMap(deserializeMap(uma))).toBe(uma)
      for (const chave of CHAVES_NOVAS) expect(uma).not.toContain(chave)
      expect('vistaDosMoveis' in lido).toBe(false)
    })
  }
})

describe('retoque Q no arquivo: mapa com os quatro campos', () => {
  it('faz ida e volta idêntica, com os quatro valores no lugar', () => {
    const uma = serializeMap(deserializeMap(serializeMap(comOsQuatro())))
    expect(serializeMap(deserializeMap(uma))).toBe(uma)
    const lido = deserializeMap(uma)
    expect(lido.vistaDosMoveis).toBe('tres-quartos')
    expect(lido.regions[0]?.room?.chamine).toBe(true)
    expect(lido.walls[0]?.grade).toBe(true)
    expect(lido.walls[0]?.janela).toBe(true)
    expect(lido.props[0]?.mobiliaDesenho).toBe('linhas')
  })
})

describe('retoque Q no arquivo: leitura estrita', () => {
  /** O mesmo mapa com o valor cru de cada campo trocado por `torto`. */
  function comTorto(torto: string): string {
    const base = JSON.parse(serializeMap(comOsQuatro())) as Record<string, unknown>
    const json = JSON.stringify(base)
      .replace('"chamine":true', `"chamine":${torto}`)
      .replace('"grade":true', `"grade":${torto}`)
      .replace('"mobiliaDesenho":"linhas"', `"mobiliaDesenho":${torto}`)
      .replace('"vistaDosMoveis":"tres-quartos"', `"vistaDosMoveis":${torto}`)
    for (const chave of CHAVES_NOVAS) expect(json).toContain(chave)
    return json
  }

  const semOsQuatro: MapData = (() => {
    const { vistaDosMoveis: _vista, ...mapa } = comOsQuatro()
    const { chamine: _chamine, ...room } = CASA.room ?? { shape: 'rect', name: '' }
    const { grade: _grade, ...cela } = CELA
    const { mobiliaDesenho: _desenho, ...mesa } = MESA
    return { ...mapa, regions: [{ ...CASA, room }], walls: [cela], props: [mesa] }
  })()

  for (const torto of TORTOS) {
    it(`valor ${torto} sai dos quatro campos sem derrubar o mapa`, () => {
      const lido = deserializeMap(comTorto(torto))
      expect(lido.regions).toHaveLength(1)
      expect(lido.walls).toHaveLength(1)
      expect(lido.props).toHaveLength(1)
      const gravado = serializeMap(lido)
      for (const chave of CHAVES_NOVAS) expect(gravado).not.toContain(chave)
      expect(gravado).toBe(serializeMap(deserializeMap(serializeMap(semOsQuatro))))
    })
  }

  it('desenho "linhas" num objeto sem tipo do catálogo sai com o resto do móvel', () => {
    const lido = deserializeMap(JSON.stringify({ id: 'x', props: [{ ...MESA, mobilia: 'trono' }, { ...MESA, id: 'img', mobilia: undefined }] }))
    for (const p of lido.props) expect('mobiliaDesenho' in p).toBe(false)
  })
})
