import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForGroup, filterMapForPlayer, type PinAudiences } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PINO SÓ PARA OS ESCOLHIDOS no recorte do jogador: o pino com lista de quem
 * vê só sai para quem está nela. Quem não está não recebe nem o pino, nem o
 * id, nem a descrição — mesmo no MESMO quarto, com o pino dentro da visão.
 */

const RAIO = 300
const POSSE = { diego: ['ficha-diego'], carla: ['ficha-carla'] }
const ID_DA_FACA = 'pista_faca_ensanguentada'
const TEXTO_DA_FACA = 'Faca com sangue seco no cabo'

const FACA: Pin = { id: ID_DA_FACA, x: 240, y: 200, kind: 'exclamacao', description: TEXTO_DA_FACA, image: null }
const LAREIRA: Pin = { id: 'lareira', x: 160, y: 200, kind: 'interrogacao', description: 'Cinzas mornas', image: null }

/** Diego e Carla lado a lado no mesmo quarto; os dois pinos dentro da visão dos dois. */
function quarto(): MapData {
  return {
    ...createEmptyMap('m', 'Quarto', 1000, 1000, 40),
    tokens: [
      { id: 'ficha-diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null },
      { id: 'ficha-carla', characterId: null, name: 'Carla', x: 200, y: 240, size: 1, image: null },
    ],
    pins: [FACA, LAREIRA],
  }
}

const idsDosPinos = (playerId: string, audiences?: PinAudiences): string[] =>
  filterMapForPlayer(quarto(), playerId, POSSE, RAIO, undefined, undefined, audiences).map.pins.map((p) => p.id)

describe('fogFilter: pino só para os escolhidos', () => {
  it('pino só para Diego: sai para ele e NÃO sai para Carla, nem o id nem a descrição', () => {
    const audiences: PinAudiences = new Map([[ID_DA_FACA, new Set(['diego'])]])
    expect(idsDosPinos('diego', audiences)).toEqual([ID_DA_FACA, 'lareira'])
    const daCarla = filterMapForPlayer(quarto(), 'carla', POSSE, RAIO, undefined, undefined, audiences)
    expect(daCarla.map.pins.map((p) => p.id)).toEqual(['lareira'])
    // O recorte INTEIRO, não só `pins`: tudo o que a rede leva.
    expect(JSON.stringify(daCarla)).not.toContain(ID_DA_FACA)
    expect(JSON.stringify(daCarla)).not.toContain(TEXTO_DA_FACA)
  })

  it('Carla marcada junto: os dois recebem', () => {
    const audiences: PinAudiences = new Map([[ID_DA_FACA, new Set(['diego', 'carla'])]])
    expect(idsDosPinos('diego', audiences)).toContain(ID_DA_FACA)
    expect(idsDosPinos('carla', audiences)).toContain(ID_DA_FACA)
  })

  it('"Só estes" sem ninguém marcado: ninguém recebe o pino', () => {
    const audiences: PinAudiences = new Map([[ID_DA_FACA, new Set<string>()]])
    expect(idsDosPinos('diego', audiences)).toEqual(['lareira'])
    expect(idsDosPinos('carla', audiences)).toEqual(['lareira'])
  })

  it('controle: sem lista (Todos) ou sem o parâmetro, os dois recebem', () => {
    expect(idsDosPinos('carla')).toEqual([ID_DA_FACA, 'lareira'])
    expect(idsDosPinos('carla', new Map())).toEqual([ID_DA_FACA, 'lareira'])
  })

  it('a lista não fura a névoa: escolhido que não enxerga o pino continua sem recebê-lo', () => {
    const longe: MapData = { ...quarto(), pins: [{ ...FACA, x: 900, y: 900 }] }
    const audiences: PinAudiences = new Map([[ID_DA_FACA, new Set(['diego'])]])
    const view = filterMapForPlayer(longe, 'diego', POSSE, RAIO, undefined, undefined, audiences)
    expect(view.map.pins).toEqual([])
  })

  it('"Oculto para jogadores" continua vencendo a lista', () => {
    const secreto: MapData = { ...quarto(), pins: [{ ...FACA, secret: true }] }
    const audiences: PinAudiences = new Map([[ID_DA_FACA, new Set(['diego'])]])
    expect(filterMapForPlayer(secreto, 'diego', POSSE, RAIO, undefined, undefined, audiences).map.pins).toEqual([])
  })

  it('tela da mesa (grupo, sem jogador): o pino com lista NÃO sai, mesmo com o escolhido no grupo', () => {
    // A TV é vista por todos na mesa: o pino só para Diego apareceria para Carla por ela.
    const audiences: PinAudiences = new Map([[ID_DA_FACA, new Set(['diego'])]])
    const grupo = [
      { tokenIds: ['ficha-diego'], visionRadius: RAIO },
      { tokenIds: ['ficha-carla'], visionRadius: RAIO },
    ]
    const tv = filterMapForGroup(quarto(), grupo, undefined, undefined, undefined, { pinAudiences: audiences })
    expect(tv.map.pins.map((p) => p.id)).toEqual(['lareira'])
    expect(JSON.stringify(tv)).not.toContain(ID_DA_FACA)
    // Controle: sem lista nenhuma, a TV mostra os dois pinos.
    const semLista = filterMapForGroup(quarto(), grupo, undefined, undefined, undefined, { pinAudiences: new Map() })
    expect(semLista.map.pins.map((p) => p.id)).toEqual([ID_DA_FACA, 'lareira'])
  })
})
