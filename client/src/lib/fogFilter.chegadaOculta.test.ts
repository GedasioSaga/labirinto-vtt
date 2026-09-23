import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * CHEGADA OCULTA (mão única) no recorte do jogador: o pino par marcado
 * `soChegada` não sai — nem o pino, nem o id dele em lugar nenhum do recorte —,
 * mesmo com o token do jogador em cima dele. O pino sem a marca, ao lado,
 * continua saindo: é o controle de que o recorte enxerga a cena.
 */

const RAIO = 300
const POSSE = { p1: ['heroi'] }
const ID_DO_PAR = 'par_oculto_da_cripta'

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

/** O par na Cripta, EXATAMENTE onde o jogador chegou (a ficha assenta na ponta dele). */
const PAR: Pin = {
  id: ID_DO_PAR,
  x: 200,
  y: 200,
  kind: 'viagem',
  description: 'Fundo do alçapão',
  image: null,
  destino: { sceneId: 'scene_salao', pinId: 'alcapao' },
  soChegada: true,
}

const VIZINHO: Pin = { id: 'marcador', x: 240, y: 200, kind: 'exclamacao', description: 'Inscrição', image: null }

describe('fogFilter: chegada oculta (mão única)', () => {
  it('o pino soChegada não sai, e o id dele não aparece em nada do recorte', () => {
    const view = filterMapForPlayer(mapaCom([PAR, VIZINHO]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual(['marcador'])
    // O recorte INTEIRO, não só `pins`: visão, portas, zonas, tudo o que a rede leva.
    expect(JSON.stringify(view)).not.toContain(ID_DO_PAR)
    expect(JSON.stringify(view)).not.toContain('Fundo do alçapão')
  })

  it('controle: sem a marca, o mesmo par sai no recorte (sem destino)', () => {
    const { soChegada: _marca, ...semMarca } = PAR
    const view = filterMapForPlayer(mapaCom([semMarca, VIZINHO]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual([ID_DO_PAR, 'marcador'])
    expect(view.map.pins[0].destino).toBeUndefined()
  })

  it('a marca num pino que deixou de ser de viagem não some com um marcador comum', () => {
    const virouMarcador: Pin = { ...PAR, kind: 'interrogacao' }
    const view = filterMapForPlayer(mapaCom([virouMarcador]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual([ID_DO_PAR])
    // E a marca não atravessa: o recorte é lista do que vai.
    expect(view.map.pins[0].soChegada).toBeUndefined()
  })
})
