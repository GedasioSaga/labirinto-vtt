/**
 * ATALHO NA MESMA CENA — o pino de viagem que leva a OUTRO PONTO do mesmo
 * mapa (a escada do 3º ao 5º andar, o alçapão que cai no porão da mesma
 * torre). As regras são as da viagem entre cenas: só vale o par que aponta de
 * volta, e a ligação mora nos dois pinos. A diferença é que os dois moram no
 * MESMO mapa, então ligar e desligar grava os dois lados de uma vez.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  linkWithinScene,
  resolvePinTravel,
  SAIDA_PRINCIPAL,
  travelPinOptions,
  unlinkWithinScene,
  type TravelScene,
} from './pinTravel'

const TORRE = 'cena-torre'

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: '', image: null, ...extra }
}

function torre(pins: Pin[]): MapData {
  return { ...createEmptyMap('map_torre', 'Torre', 30, 20, 64), pins }
}

function lugares(map: MapData, outras: Record<string, { name: string; map: MapData | null }> = {}): (sceneId: string) => TravelScene | null {
  return (sceneId) => (sceneId === TORRE ? { name: 'Torre', map } : (outras[sceneId] ?? null))
}

const achar = (map: MapData, id: string): Pin => {
  const pin = map.pins.find((p) => p.id === id)
  if (pin === undefined) throw new Error(`pino ${id} sumiu`)
  return pin
}

describe('resolvePinTravel na mesma cena', () => {
  it('par que aponta de volta, no mesmo mapa: ligado, marcado como mesma cena', () => {
    const map = torre([
      pino('escada-3', { destino: { sceneId: TORRE, pinId: 'escada-5' } }),
      pino('escada-5', { x: 900, destino: { sceneId: TORRE, pinId: 'escada-3' } }),
    ])
    const travel = resolvePinTravel(achar(map, 'escada-3'), TORRE, lugares(map))
    expect(travel).toMatchObject({ status: 'ligado', sceneId: TORRE, sameScene: true, partner: { id: 'escada-5' } })
  })

  it('meia ligação, pino que aponta para si mesmo ou par que sumiu: sem destino', () => {
    const meia = torre([pino('a', { destino: { sceneId: TORRE, pinId: 'b' } }), pino('b')])
    expect(resolvePinTravel(achar(meia, 'a'), TORRE, lugares(meia)).status).toBe('sem-destino')
    const siMesmo = torre([pino('a', { destino: { sceneId: TORRE, pinId: 'a' } })])
    expect(resolvePinTravel(achar(siMesmo, 'a'), TORRE, lugares(siMesmo)).status).toBe('sem-destino')
    const sumiu = torre([pino('a', { destino: { sceneId: TORRE, pinId: 'b' } })])
    expect(resolvePinTravel(achar(sumiu, 'a'), TORRE, lugares(sumiu)).status).toBe('sem-destino')
  })

  it('a viagem entre cenas continua sem a marca de mesma cena', () => {
    const map = torre([pino('a', { destino: { sceneId: 'cripta', pinId: 'b' } })])
    const cripta = { ...createEmptyMap('map_cripta', 'Cripta', 30, 20, 64), pins: [pino('b', { destino: { sceneId: TORRE, pinId: 'a' } })] }
    const travel = resolvePinTravel(achar(map, 'a'), TORRE, lugares(map, { cripta: { name: 'Cripta', map: cripta } }))
    expect(travel.status).toBe('ligado')
    expect(travel).not.toHaveProperty('sameScene')
  })
})

describe('linkWithinScene', () => {
  it('liga os dois pinos do mesmo mapa de uma vez, em mão dupla', () => {
    const map = torre([pino('a'), pino('b', { x: 800 })])
    const ligado = linkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL, 'b', 'saida_nova')
    expect(achar(ligado, 'a').destino).toEqual({ sceneId: TORRE, pinId: 'b' })
    expect(achar(ligado, 'b').destino).toEqual({ sceneId: TORRE, pinId: 'a' })
    expect(resolvePinTravel(achar(ligado, 'b'), TORRE, lugares(ligado))).toMatchObject({ status: 'ligado', partner: { id: 'a' } })
  })

  it('religar a outro ponto desliga o par antigo da mesma cena, e quem o novo par trazia perde a volta', () => {
    const map = torre([
      pino('a', { destino: { sceneId: TORRE, pinId: 'b' } }),
      pino('b', { destino: { sceneId: TORRE, pinId: 'a' } }),
      pino('c', { destino: { sceneId: TORRE, pinId: 'd' } }),
      pino('d', { destino: { sceneId: TORRE, pinId: 'c' } }),
    ])
    const religado = linkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL, 'd', 'saida_nova')
    expect(achar(religado, 'a').destino).toEqual({ sceneId: TORRE, pinId: 'd' })
    expect(achar(religado, 'd').destino).toEqual({ sceneId: TORRE, pinId: 'a' })
    expect(achar(religado, 'b').destino).toBeNull()
    expect(achar(religado, 'c').destino).toBeNull()
  })

  it('recusa sem mexer: o próprio pino, pino que não é de viagem, pino que não existe', () => {
    const map = torre([pino('a'), pino('marca', { kind: 'exclamacao' })])
    expect(linkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL, 'a', 'x')).toBe(map)
    expect(linkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL, 'marca', 'x')).toBe(map)
    expect(linkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL, 'fantasma', 'x')).toBe(map)
  })

  it('saída nova (encruzilhada): a principal fica, a saída extra leva ao ponto da mesma cena', () => {
    const map = torre([pino('a', { destino: { sceneId: 'cripta', pinId: 'z' } }), pino('b')])
    const ligado = linkWithinScene(map, TORRE, 'a', null, 'b', 'saida_escada')
    expect(achar(ligado, 'a').destino).toEqual({ sceneId: 'cripta', pinId: 'z' })
    expect(achar(ligado, 'a').saidas).toEqual([{ id: 'saida_escada', rotulo: '', destino: { sceneId: TORRE, pinId: 'b' } }])
    expect(achar(ligado, 'b').destino).toEqual({ sceneId: TORRE, pinId: 'a' })
  })
})

describe('unlinkWithinScene', () => {
  it('desligar um lado desliga o outro no mesmo mapa (e a chegada oculta volta a aparecer)', () => {
    const map = torre([
      pino('a', { destino: { sceneId: TORRE, pinId: 'b' } }),
      pino('b', { destino: { sceneId: TORRE, pinId: 'a' }, soChegada: true }),
    ])
    const desligado = unlinkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL)
    expect(achar(desligado, 'a').destino).toBeNull()
    expect(achar(desligado, 'b').destino).toBeNull()
    expect(achar(desligado, 'b')).not.toHaveProperty('soChegada')
  })

  it('ligação para OUTRA cena: só o lado daqui (o par de lá é do guardião da aventura)', () => {
    const map = torre([pino('a', { destino: { sceneId: 'cripta', pinId: 'b' } }), pino('b', { destino: { sceneId: 'cripta', pinId: 'x' } })])
    const desligado = unlinkWithinScene(map, TORRE, 'a', SAIDA_PRINCIPAL)
    expect(achar(desligado, 'a').destino).toBeNull()
    expect(achar(desligado, 'b').destino).toEqual({ sceneId: 'cripta', pinId: 'x' })
  })
})

describe('travelPinOptions na mesma cena', () => {
  it('lista os OUTROS pinos de viagem do mapa, nunca o próprio', () => {
    const map = torre([pino('a', { description: 'Escada do 3º' }), pino('b', { description: 'Escada do 5º' }), pino('c', { kind: 'exclamacao' })])
    const opcoes = travelPinOptions(TORRE, TORRE, 'a', lugares(map))
    expect(opcoes.map((o) => o.id)).toEqual(['b'])
    expect(opcoes[0]?.note).toBeNull()
  })

  it('o par atual aparece como destino atual; o que já liga a outro ponto, com o motivo', () => {
    const map = torre([
      pino('a', { destino: { sceneId: TORRE, pinId: 'b' } }),
      pino('b', { destino: { sceneId: TORRE, pinId: 'a' } }),
      pino('c', { destino: { sceneId: TORRE, pinId: 'd' } }),
      pino('d', { destino: { sceneId: TORRE, pinId: 'c' } }),
    ])
    const opcoes = travelPinOptions(TORRE, TORRE, 'a', lugares(map))
    expect(opcoes.map((o) => [o.id, o.note])).toEqual([
      ['b', 'destino atual'],
      ['c', 'já leva a outro ponto desta cena'],
      ['d', 'já leva a outro ponto desta cena'],
    ])
  })
})
