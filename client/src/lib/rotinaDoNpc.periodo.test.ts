/**
 * ROTINA POR PERÍODO (Caminhos F3) no disco: `PostoDaRotina.periodo` é campo
 * NOVO e OPCIONAL. Mapa de antes abre e salva byte a byte igual; o posto com
 * período faz ida e volta idêntica; período torto sai do posto (o posto fica,
 * valendo em todos os períodos, como posto de antes); o 'manha' do relógio
 * antigo é lido como 'dia'. "Gravar aqui" de novo não apaga o período.
 */
import { describe, expect, it } from 'vitest'
import l1Json from '../../../maps/L1.json'
import type { MapData, PostoDaRotina, RotinaDoNpc, Token } from '../types/map'
import legacyMapJson from './__fixtures__/legacy-map.json'
import legacyRoomDoorJson from './__fixtures__/legacy-room-door.json'
import antesL1 from './__fixtures__/roundtrip-924c2bdd/L1.json'
import antesLegacyMap from './__fixtures__/roundtrip-924c2bdd/legacy-map.json'
import antesLegacyRoomDoor from './__fixtures__/roundtrip-924c2bdd/legacy-room-door.json'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { gravarPosto, rotinaDoArquivo } from './rotinaDoNpc'

const APITO = 'estado_apito'

function tobias(postos: PostoDaRotina[]): Token {
  return { id: 'tobias', characterId: null, name: 'Irmão Tobias', x: 100, y: 100, size: 1, image: null, npc: true, rotina: { estadoId: APITO, postos } }
}

function capela(tokens: Token[]): MapData {
  return { ...createEmptyMap('map_capela', 'Capela', 20, 20, 50), tokens }
}

describe('posto por período no arquivo: mapa de antes', () => {
  // O L1 real e as duas cópias congeladas: a saída de serializeMap(deserializeMap(x)) de antes das camadas (924c2bdd).
  const fixtures: [string, string, unknown][] = [
    ['maps/L1.json', JSON.stringify(l1Json), antesL1],
    ['__fixtures__/legacy-map.json', JSON.stringify(legacyMapJson), antesLegacyMap],
    ['__fixtures__/legacy-room-door.json', JSON.stringify(legacyRoomDoorJson), antesLegacyRoomDoor],
  ]
  for (const [nome, bruto, antes] of fixtures) {
    it(`${nome}: salva byte a byte igual, sem "periodo"`, () => {
      const uma = serializeMap(deserializeMap(bruto))
      expect(uma).toBe(JSON.stringify(antes, null, 2))
      expect(uma).not.toContain('"periodo"')
    })
  }

  it('rotina de antes (posto sem período): ida e volta igual, e o posto não ganha a chave', () => {
    const uma = serializeMap(capela([tobias([{ valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 }, { valor: 'Brasa', sceneId: 'capela', x: 600, y: 400 }])]))
    expect(serializeMap(deserializeMap(uma))).toBe(uma)
    expect(uma).not.toContain('"periodo"')
    const postos = deserializeMap(uma).tokens[0]?.rotina?.postos ?? []
    expect(postos.every((p) => !('periodo' in p))).toBe(true)
  })
})

describe('posto por período no arquivo: campo novo', () => {
  it('posto com período faz ida e volta idêntica', () => {
    const postos: PostoDaRotina[] = [
      { valor: 'Aurora', sceneId: 'capela', x: 100, y: 100, periodo: 'dia' },
      { valor: 'Meio', sceneId: 'capela', x: 300, y: 100, periodo: 'tarde' },
      { valor: 'Brasa', sceneId: 'capela', x: 600, y: 400, periodo: 'noite' },
      { valor: 'Sombra', sceneId: 'capela', x: 600, y: 100 },
    ]
    const uma = serializeMap(deserializeMap(serializeMap(capela([tobias(postos)]))))
    expect(serializeMap(deserializeMap(uma))).toBe(uma)
    expect(deserializeMap(uma).tokens[0]?.rotina?.postos).toEqual(postos)
  })

  it("'manha' do relógio antigo vira 'dia'; período torto sai e o posto fica, valendo em todos", () => {
    const TORTOS: unknown[] = ['madrugada', 'Noite', '', 0, 3, null, true, {}, ['noite']]
    for (const torto of TORTOS) {
      const lida = rotinaDoArquivo({ estadoId: APITO, postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 2, periodo: torto }] })
      expect(lida).toEqual({ estadoId: APITO, postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 2 }] })
      expect(lida?.postos.every((p) => !('periodo' in p))).toBe(true)
    }
    expect(rotinaDoArquivo({ estadoId: APITO, postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 2, periodo: 'manha' }] })?.postos).toEqual([
      { valor: 'Aurora', sceneId: 'capela', x: 1, y: 2, periodo: 'dia' },
    ])
    // Pelo mapa inteiro: o torto não derruba a ficha nem a rotina, e não volta ao disco.
    const cru = { ...capela([]), tokens: [{ ...tobias([]), rotina: { estadoId: APITO, postos: [{ valor: 'Aurora', sceneId: 'capela', x: 100, y: 100, periodo: 'madrugada' }] } }] }
    const lido = deserializeMap(JSON.stringify(cru))
    expect(lido.tokens[0]?.rotina?.postos).toEqual([{ valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 }])
    expect(serializeMap(lido)).not.toContain('"periodo"')
  })

  it('"Gravar aqui" de novo no mesmo valor muda o lugar e mantém o período; posto com período próprio troca', () => {
    const rotina: RotinaDoNpc = { estadoId: APITO, postos: [{ valor: 'Brasa', sceneId: 'capela', x: 600, y: 400, periodo: 'noite' }] }
    expect(gravarPosto(rotina, { valor: 'Brasa', sceneId: 'capela', x: 10, y: 20 }).postos).toEqual([{ valor: 'Brasa', sceneId: 'capela', x: 10, y: 20, periodo: 'noite' }])
    expect(gravarPosto(rotina, { valor: 'Brasa', sceneId: 'capela', x: 10, y: 20, periodo: 'tarde' }).postos).toEqual([
      { valor: 'Brasa', sceneId: 'capela', x: 10, y: 20, periodo: 'tarde' },
    ])
    // Valor novo entra sem período (o de sempre).
    expect(gravarPosto(rotina, { valor: 'Aurora', sceneId: 'capela', x: 1, y: 1 }).postos[1]).toEqual({ valor: 'Aurora', sceneId: 'capela', x: 1, y: 1 })
  })
})
