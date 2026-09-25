import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterFloorMemory, filterMapForPlayer, type PinAudiences } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { createExploration, markAll } from './exploration'

/**
 * JUNÇÃO DO GRUPO MUNDO com o "QUEM VÊ" do pino (grupo jogador): o mapa-mundi
 * (caravana) e a memória de outro andar (mapa por andares) montam o recorte
 * por caminhos próprios, e os dois precisam levar a lista de quem vê — senão o
 * pino escolhido só para Diego chega à Carla pelo mapa-mundi ou pela aba do
 * andar de cima.
 */

const RAIO = 300
const POSSE = { diego: ['ficha-diego'], carla: ['ficha-carla'] }
const ID_DO_SEGREDO = 'pista_so_do_diego'
const TEXTO_DO_SEGREDO = 'Bilhete escondido na bota'

const SEGREDO: Pin = { id: ID_DO_SEGREDO, x: 240, y: 200, kind: 'exclamacao', description: TEXTO_DO_SEGREDO, image: null }
const MARCO: Pin = { id: 'marco', x: 160, y: 200, kind: 'interrogacao', description: 'Marco de pedra', image: null }
const SO_DIEGO: PinAudiences = new Map([[ID_DO_SEGREDO, new Set(['diego'])]])

function mapa(extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'Estrada', 1000, 1000, 40),
    tokens: [
      { id: 'ficha-diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null },
      { id: 'ficha-carla', characterId: null, name: 'Carla', x: 200, y: 240, size: 1, image: null },
    ],
    pins: [SEGREDO, MARCO],
    ...extra,
  }
}

describe('junção do grupo mundo: "quem vê" do pino nos recortes novos', () => {
  it('mapa-mundi (caravana): o pino só do Diego não chega à Carla', () => {
    const mundi = mapa({ worldMap: true })
    const daCarla = filterMapForPlayer(mundi, 'carla', POSSE, RAIO, undefined, undefined, SO_DIEGO)
    expect(daCarla.map.worldMap).toBe(true)
    expect(daCarla.map.pins.map((p) => p.id)).toEqual(['marco'])
    expect(JSON.stringify(daCarla)).not.toContain(ID_DO_SEGREDO)
    expect(JSON.stringify(daCarla)).not.toContain(TEXTO_DO_SEGREDO)
  })

  it('mapa-mundi (controle): o escolhido recebe, e sem lista os dois recebem', () => {
    const mundi = mapa({ worldMap: true })
    expect(filterMapForPlayer(mundi, 'diego', POSSE, RAIO, undefined, undefined, SO_DIEGO).map.pins.map((p) => p.id)).toContain(ID_DO_SEGREDO)
    expect(filterMapForPlayer(mundi, 'carla', POSSE, RAIO).map.pins.map((p) => p.id)).toContain(ID_DO_SEGREDO)
  })

  it('memória de outro andar: o pino só do Diego não sai para a Carla', () => {
    const andar = mapa()
    const exp = createExploration(andar)
    markAll(exp)
    const daCarla = filterFloorMemory(andar, exp, new Map(), { pinAudiences: SO_DIEGO, playerId: 'carla' })
    expect(daCarla.map.pins.map((p) => p.id)).toEqual(['marco'])
    expect(JSON.stringify(daCarla)).not.toContain(TEXTO_DO_SEGREDO)
    // Controle: o escolhido vê o pino na memória do andar.
    const doDiego = filterFloorMemory(andar, exp, new Map(), { pinAudiences: SO_DIEGO, playerId: 'diego' })
    expect(doDiego.map.pins.map((p) => p.id)).toEqual([ID_DO_SEGREDO, 'marco'])
  })
})
