import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Pin } from '../types/map'
import { setPinPassageFromRequest } from './pinPassageFromRequest'

/**
 * MODO POR SAÍDA, do lado do App: o "Passar para pede" do pedido pela saída
 * trancada chega da ponte com `exitId` e grava o modo DAQUELA saída
 * (`setExitPassage`). O modo do pino — e o das outras saídas — fica como está.
 * Sem `exitId` (a principal), é o modo do pino, como sempre foi.
 */

const CENA_SALAO = 'cena-salao'

function encruzilhada(): Pin {
  return {
    id: 'cruz',
    x: 400,
    y: 200,
    kind: 'viagem',
    description: 'Encruzilhada',
    image: null,
    destino: { sceneId: 'cena-cripta', pinId: 'escada-b' },
    passagem: 'livre',
    saidas: [
      { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'cena-torre', pinId: 'chegada-torre' } },
      { id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: 'cena-poco', pinId: 'boca-poco' }, passagem: 'trancada' },
    ],
  }
}

function salao(): MapData {
  return { ...createEmptyMap('mapa-salao', 'Salão', 1000, 500, 50), pins: [encruzilhada()] }
}

function pinoEm(map: MapData | null | undefined): Pin {
  const pino = map?.pins.find((p) => p.id === 'cruz')
  if (pino === undefined) throw new Error('a encruzilhada sumiu do mapa')
  return pino
}

function mapaDeFundo(): MapData | null {
  const slot = useAdventureStore.getState().cache[CENA_SALAO]
  return slot?.status === 'ok' ? slot.map : null
}

beforeEach(() => {
  useMapStore.getState().loadMap(createEmptyMap('mapa-aberto', 'Aberto', 1000, 500, 50))
  useAdventureStore.setState({ cache: {}, dirty: {} })
})

describe('setPinPassageFromRequest: "Passar para pede" na cena aberta', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap(salao())
  })

  it('com exitId de uma saída extra: só aquela saída passa a pedir; o pino e a outra saída ficam', () => {
    setPinPassageFromRequest('cruz', 'pede', undefined, 'saida_poco')
    const pino = pinoEm(useMapStore.getState().map)
    expect(pino.passagem).toBe('livre')
    expect(pino.saidas).toEqual([
      { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'cena-torre', pinId: 'chegada-torre' } },
      { id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: 'cena-poco', pinId: 'boca-poco' }, passagem: 'pede' },
    ])
  })

  it('é passo do Ctrl+Z do mestre, como o painel: desfazer devolve a saída trancada', () => {
    setPinPassageFromRequest('cruz', 'pede', undefined, 'saida_poco')
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(pinoEm(useMapStore.getState().map).saidas?.[1]?.passagem).toBe('trancada')
  })

  it('sem exitId (a principal): o modo do pino muda, e as saídas extras ficam como estavam', () => {
    setPinPassageFromRequest('cruz', 'pede')
    const pino = pinoEm(useMapStore.getState().map)
    expect(pino.passagem).toBe('pede')
    expect(pino.saidas).toEqual(encruzilhada().saidas)
  })

  it('exitId de uma saída que não é deste pino: nada muda, nem o modo do pino', () => {
    const antes = useMapStore.getState().map
    setPinPassageFromRequest('cruz', 'pede', undefined, 'saida_inventada')
    expect(pinoEm(useMapStore.getState().map)).toEqual(pinoEm(antes))
  })

  it('pino que sumiu do mapa: nada muda', () => {
    const antes = useMapStore.getState().map
    setPinPassageFromRequest('pino-sumido', 'pede', undefined, 'saida_poco')
    expect(useMapStore.getState().map.pins).toEqual(antes.pins)
  })
})

describe('setPinPassageFromRequest: "Passar para pede" numa cena de fundo', () => {
  beforeEach(() => {
    useAdventureStore.setState({ cache: { [CENA_SALAO]: { status: 'ok', map: salao(), past: [], future: [], camera: null } }, dirty: {} })
  })

  it('com exitId: só aquela saída da cena de fundo passa a pedir; a cena aberta não é tocada', () => {
    const aberta = useMapStore.getState().map
    setPinPassageFromRequest('cruz', 'pede', CENA_SALAO, 'saida_poco')
    const pino = pinoEm(mapaDeFundo())
    expect(pino.passagem).toBe('livre')
    expect(pino.saidas?.map((s) => s.passagem)).toEqual([undefined, 'pede'])
    expect(useMapStore.getState().map).toBe(aberta)
    expect(useAdventureStore.getState().dirty[CENA_SALAO]).toBe(true)
  })

  it('sem exitId: o modo do pino na cena de fundo muda', () => {
    setPinPassageFromRequest('cruz', 'pede', CENA_SALAO)
    const pino = pinoEm(mapaDeFundo())
    expect(pino.passagem).toBe('pede')
    expect(pino.saidas?.map((s) => s.passagem)).toEqual([undefined, 'trancada'])
  })
})
