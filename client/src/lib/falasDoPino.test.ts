import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import type { FalaDoPino } from '../types/cenarioEFalas'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * Pedido de 16/11/2026 ("pino não ta aparecendo no 2 piso"): o mestre pôs um
 * "?" novo e escreveu uma entrada, oculta como toda entrada nova. O "?" sumia
 * para o jogador em qualquer piso, porque sem entrada dita ou livre o recorte
 * jogava o pino fora. O pino tem de chegar (o marcador está no mapa, o mestre
 * o vê ali), vazio: a entrada oculta e a contagem delas continuam fora.
 */
describe('"?" só com entrada oculta (pedido de 16/11/2026)', () => {
  const OCULTA = 'TEXTO-OCULTO-DO-MESTRE'
  const falas: FalaDoPino[] = [{ id: 'oculta', etiqueta: 'Fala', quem: 'Bento', texto: `${OCULTA} ainda não dito` }]
  const mapa: MapData = {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'ficha-saga', characterId: null, name: 'Saga', x: 200, y: 200, size: 1, image: null, piso: 1 }],
    pins: [{ id: 'pergunta', x: 240, y: 200, kind: 'interrogacao', description: '', image: null, piso: 1, falas }],
  }

  it('chega ao jogador do mesmo piso como marcador vazio, sem o texto oculto nem quem diz', () => {
    const recorte = filterMapForPlayer(mapa, 'p-saga', { 'p-saga': ['ficha-saga'] }, 300)
    const pino = recorte.map.pins.find((p) => p.id === 'pergunta')
    expect(pino?.falasVisiveis).toEqual([])
    expect(pino?.description).toBe('')
    expect(pino !== undefined && 'falas' in pino).toBe(false)
    const json = JSON.stringify(recorte)
    expect(json).not.toContain(OCULTA)
    expect(json).not.toContain('Bento')
  })
})
