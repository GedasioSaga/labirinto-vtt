import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { deserializeMap, serializeMap } from '../lib/mapFile'
import type { MapData, Pin } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { CENARIO_PADRAO } from './catalogo'

/** ANIMAÇÃO DO CENÁRIO gravada no pino "!": disco e Ctrl+Z. */
const pino: Pin = { id: 'pino', x: 100, y: 100, kind: 'exclamacao', description: 'Fortaleza', image: 'data:image/png;base64,AAAA' }
const mapa = (pins: Pin[] = [pino]): MapData => ({ ...createEmptyMap('m', 'M', 20, 20, 40), pins })
const atual = (): Pin => useMapStore.getState().map.pins[0]

beforeEach(() => {
  useMapStore.getState().loadMap(mapa())
})

describe('animação do cenário no disco e no editor', () => {
  it('o pino guarda a animação; forma errada volta ausente', () => {
    const lido = deserializeMap(serializeMap(mapa([{ ...pino, cenario: { ...CENARIO_PADRAO, movimento: 'desce', duracaoS: 9 } }])))
    expect(lido.pins[0].cenario).toEqual({ ...CENARIO_PADRAO, movimento: 'desce', duracaoS: 9 })
    const torto = JSON.parse(serializeMap(mapa())) as { pins: Record<string, unknown>[] }
    torto.pins[0].cenario = { quando: 'talvez', movimento: 'sobe' }
    expect(deserializeMap(JSON.stringify(torto)).pins[0].cenario).toBeUndefined()
  })

  it('ligar, trocar o movimento e desligar: um passo de Ctrl+Z cada; gravar o mesmo não empilha', () => {
    useMapStore.getState().updatePin('pino', { cenario: CENARIO_PADRAO })
    useMapStore.getState().updatePin('pino', { cenario: { ...CENARIO_PADRAO } })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().updatePin('pino', { cenario: { ...CENARIO_PADRAO, movimento: 'aproxima' } })
    useMapStore.getState().updatePin('pino', { cenario: undefined })
    expect(atual().cenario).toBeUndefined()
    useMapStore.getState().undo()
    expect(atual().cenario?.movimento).toBe('aproxima')
  })
})
