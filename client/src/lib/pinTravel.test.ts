/**
 * `lib/pinTravel.ts` — as regras da ligação do pino de viagem, sem store.
 *
 * O que se cobra aqui: só conta como ligado o par que se aponta DE VOLTA; a
 * lista de mudanças enxerga ligar, desligar, apagar e o desfazer; a volta é
 * gravada no par e quem ele trazia antes perde a volta; e a chegada nasce no
 * centro da cena sem cair em cima de outro pino.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap, updatePin } from './mapFactory'
import {
  arrivalPoint,
  linkBack,
  readPinDestination,
  resolvePinTravel,
  travelLinkChanges,
  travelPinOptions,
  unlinkBack,
  type TravelScene,
} from './pinTravel'

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: '', image: null, ...extra }
}

function cena(id: string, pins: Pin[]): MapData {
  return { ...createEmptyMap(`map_${id}`, id, 30, 20, 64), pins }
}

/** Uma aventura de mentira: nome e mapa de cada cena, por id. */
function aventura(cenas: Record<string, { name: string; map: MapData | null }>): (sceneId: string) => TravelScene | null {
  return (sceneId) => cenas[sceneId] ?? null
}

describe('resolvePinTravel', () => {
  const ida = pino('a', { destino: { sceneId: 'cripta', pinId: 'b' } })

  it('leva quando o par aponta de volta', () => {
    const volta = pino('b', { destino: { sceneId: 'vale', pinId: 'a' } })
    const travel = resolvePinTravel(ida, 'vale', aventura({ cripta: { name: 'Cripta', map: cena('cripta', [volta]) } }))
    expect(travel).toMatchObject({ status: 'ligado', sceneId: 'cripta', sceneName: 'Cripta', partner: { id: 'b' } })
  })

  it('meia ligação é "sem destino": o par não traz de volta', () => {
    const outraVolta = pino('b', { destino: { sceneId: 'torre', pinId: 'z' } })
    const semVolta = pino('b')
    expect(resolvePinTravel(ida, 'vale', aventura({ cripta: { name: 'Cripta', map: cena('cripta', [outraVolta]) } })).status).toBe('sem-destino')
    expect(resolvePinTravel(ida, 'vale', aventura({ cripta: { name: 'Cripta', map: cena('cripta', [semVolta]) } })).status).toBe('sem-destino')
  })

  it('par apagado, cena fora da aventura e pino que não é de viagem são "sem destino"', () => {
    expect(resolvePinTravel(ida, 'vale', aventura({ cripta: { name: 'Cripta', map: cena('cripta', []) } })).status).toBe('sem-destino')
    expect(resolvePinTravel(ida, 'vale', aventura({})).status).toBe('sem-destino')
    const volta = pino('b', { destino: { sceneId: 'vale', pinId: 'a' } })
    const marcador = { ...ida, kind: 'exclamacao' as const }
    expect(resolvePinTravel(marcador, 'vale', aventura({ cripta: { name: 'Cripta', map: cena('cripta', [volta]) } })).status).toBe('sem-destino')
  })

  it('cena que não abriu é "indisponível", com o nome dela', () => {
    expect(resolvePinTravel(ida, 'vale', aventura({ cripta: { name: 'Cripta', map: null } }))).toEqual({
      status: 'indisponivel',
      sceneId: 'cripta',
      sceneName: 'Cripta',
    })
  })
})

describe('travelLinkChanges', () => {
  const ligado = pino('a', { destino: { sceneId: 'cripta', pinId: 'b' } })

  it('ligar, desligar e religar a outro par aparecem com o antes e o depois', () => {
    expect(travelLinkChanges([pino('a')], [ligado])).toEqual([{ pinId: 'a', before: null, after: { sceneId: 'cripta', pinId: 'b' } }])
    expect(travelLinkChanges([ligado], [pino('a', { destino: null })])).toEqual([{ pinId: 'a', before: { sceneId: 'cripta', pinId: 'b' }, after: null }])
    const religado = pino('a', { destino: { sceneId: 'torre', pinId: 'c' } })
    expect(travelLinkChanges([ligado], [religado])).toEqual([
      { pinId: 'a', before: { sceneId: 'cripta', pinId: 'b' }, after: { sceneId: 'torre', pinId: 'c' } },
    ])
  })

  it('apagar o pino e deixar de ser viagem desligam; o desfazer que o devolve religa', () => {
    expect(travelLinkChanges([ligado], [])).toEqual([{ pinId: 'a', before: { sceneId: 'cripta', pinId: 'b' }, after: null }])
    expect(travelLinkChanges([ligado], [{ ...ligado, kind: 'interrogacao' }])).toEqual([
      { pinId: 'a', before: { sceneId: 'cripta', pinId: 'b' }, after: null },
    ])
    expect(travelLinkChanges([], [ligado])).toEqual([{ pinId: 'a', before: null, after: { sceneId: 'cripta', pinId: 'b' } }])
  })

  it('mover ou descrever o pino não é mudança de ligação', () => {
    expect(travelLinkChanges([ligado], [{ ...ligado, x: 999, description: 'Escada' }])).toEqual([])
  })
})

describe('linkBack e unlinkBack', () => {
  const daqui = { sceneId: 'vale', pinId: 'a' }

  it('grava a volta no par e devolve quem ele trazia antes', () => {
    const map = cena('cripta', [pino('b', { destino: { sceneId: 'torre', pinId: 'z' } })])
    const { map: depois, displaced } = linkBack(map, 'b', daqui)
    expect(depois.pins[0].destino).toEqual(daqui)
    expect(displaced).toEqual({ sceneId: 'torre', pinId: 'z' })
  })

  it('par que não é de viagem ou que sumiu não é ligado', () => {
    const map = cena('cripta', [pino('b', { kind: 'exclamacao' })])
    expect(linkBack(map, 'b', daqui).map).toBe(map)
    expect(linkBack(map, 'sumiu', daqui).map).toBe(map)
  })

  it('desliga só o par que ainda voltava para cá', () => {
    const voltava = cena('cripta', [pino('b', { destino: daqui })])
    expect(unlinkBack(voltava, 'b', daqui).pins[0].destino).toBeNull()
    const religado = cena('cripta', [pino('b', { destino: { sceneId: 'torre', pinId: 'c' } })])
    expect(unlinkBack(religado, 'b', daqui)).toBe(religado)
  })

  it('ligar e desligar o par não mexe no modo de passagem dele', () => {
    const trancado = cena('cripta', [pino('b', { passagem: 'trancada' })])
    const ligado = linkBack(trancado, 'b', daqui).map
    expect(ligado.pins[0]).toMatchObject({ destino: daqui, passagem: 'trancada' })
    expect(unlinkBack(ligado, 'b', daqui).pins[0]).toMatchObject({ destino: null, passagem: 'trancada' })
  })
})

describe('updatePin e o modo de passagem', () => {
  it('trocar o modo muda o pino; escolher "pede" num pino sem modo não é mudança', () => {
    const map = cena('vale', [pino('a')])
    expect(updatePin(map, 'a', { passagem: 'pede' })).toBe(map)
    const livre = updatePin(map, 'a', { passagem: 'livre' })
    expect(livre.pins[0].passagem).toBe('livre')
    // O modo não toca no destino, e o destino não toca no modo.
    expect(updatePin(livre, 'a', { destino: { sceneId: 'cripta', pinId: 'b' } }).pins[0].passagem).toBe('livre')
  })
})

describe('arrivalPoint', () => {
  it('a chegada nasce no centro da cena', () => {
    expect(arrivalPoint(cena('cripta', []))).toEqual({ x: 960, y: 640 })
  })

  it('com o centro ocupado, nasce na casa livre mais perto — dois pinos na mesma ponta esconderiam o de baixo', () => {
    const ocupado = cena('cripta', [pino('b', { x: 960, y: 640 })])
    expect(arrivalPoint(ocupado)).toEqual({ x: 1024, y: 640 })
  })
})

describe('travelPinOptions', () => {
  it('lista os pinos de viagem da cena; o que já leva a outro lugar vem com o motivo', () => {
    const livre = pino('livre', { description: 'Portão' })
    const semNome = pino('mudo')
    const ocupado = pino('ocupado', { destino: { sceneId: 'torre', pinId: 't' } })
    const marcador = pino('marca', { kind: 'exclamacao' })
    const torre = cena('torre', [pino('t', { destino: { sceneId: 'cripta', pinId: 'ocupado' } })])
    const lookup = aventura({
      cripta: { name: 'Cripta', map: cena('cripta', [livre, semNome, ocupado, marcador]) },
      torre: { name: 'Torre', map: torre },
    })
    expect(travelPinOptions('cripta', 'vale', 'a', lookup)).toEqual([
      { id: 'livre', label: 'Portão', note: null },
      { id: 'mudo', label: 'Pino de viagem 2', note: null },
      { id: 'ocupado', label: 'Pino de viagem 3', note: 'já leva a Torre' },
    ])
  })
})

describe('readPinDestination', () => {
  it('só a forma certa vira destino, e sem o que mais o arquivo trouxer', () => {
    expect(readPinDestination({ sceneId: 's', pinId: 'p', extra: 1 })).toEqual({ sceneId: 's', pinId: 'p' })
    expect(readPinDestination('Cripta')).toBeNull()
    expect(readPinDestination({ sceneId: '', pinId: 'p' })).toBeNull()
    expect(readPinDestination({ sceneId: 's' })).toBeNull()
    expect(readPinDestination(null)).toBeNull()
  })
})

describe('encruzilhada: saídas extras', () => {
  const cruz = pino('a', {
    destino: { sceneId: 'cripta', pinId: 'b' },
    saidas: [{ id: 'saida_torre', rotulo: 'Escada', destino: { sceneId: 'torre', pinId: 'c' } }],
  })
  const lugares = aventura({
    cripta: { name: 'Cripta', map: cena('cripta', [pino('b', { destino: { sceneId: 'vale', pinId: 'a' } })]) },
    torre: { name: 'Torre', map: cena('torre', [pino('c', { destino: { sceneId: 'vale', pinId: 'a' } })]) },
  })

  it('cada saída resolve o próprio par; saída que não existe é "sem destino"', () => {
    expect(resolvePinTravel(cruz, 'vale', lugares)).toMatchObject({ status: 'ligado', sceneName: 'Cripta', partner: { id: 'b' } })
    expect(resolvePinTravel(cruz, 'vale', lugares, 'saida_torre')).toMatchObject({ status: 'ligado', sceneName: 'Torre', partner: { id: 'c' } })
    expect(resolvePinTravel(cruz, 'vale', lugares, 'saida_inventada').status).toBe('sem-destino')
  })

  it('o par que é encruzilhada vale se QUALQUER saída dele volta', () => {
    const parCruz = pino('b', { destino: { sceneId: 'pantano', pinId: 'p' }, saidas: [{ id: 'volta', rotulo: '', destino: { sceneId: 'vale', pinId: 'a' } }] })
    expect(resolvePinTravel(cruz, 'vale', aventura({ cripta: { name: 'Cripta', map: cena('cripta', [parCruz]) } })).status).toBe('ligado')
  })

  it('travelLinkChanges: acrescentar uma saída é UMA ligação nova; renomear não é mudança; apagar desliga todas', () => {
    const umaSo = pino('a', { destino: { sceneId: 'cripta', pinId: 'b' } })
    expect(travelLinkChanges([umaSo], [cruz])).toEqual([{ pinId: 'a', before: null, after: { sceneId: 'torre', pinId: 'c' } }])
    const renomeada: Pin = { ...cruz, rotulo: 'Porta', saidas: [{ id: 'saida_torre', rotulo: 'Outra', destino: { sceneId: 'torre', pinId: 'c' } }] }
    expect(travelLinkChanges([cruz], [renomeada])).toEqual([])
    expect(travelLinkChanges([cruz], [])).toEqual([
      { pinId: 'a', before: { sceneId: 'cripta', pinId: 'b' }, after: null },
      { pinId: 'a', before: { sceneId: 'torre', pinId: 'c' }, after: null },
    ])
  })

  it('unlinkBack tira só a saída que voltava para lá', () => {
    const depois = unlinkBack(cena('vale', [cruz]), 'a', { sceneId: 'torre', pinId: 'c' })
    expect(depois.pins[0].saidas).toBeUndefined()
    expect(depois.pins[0].destino).toEqual({ sceneId: 'cripta', pinId: 'b' })
  })
})
