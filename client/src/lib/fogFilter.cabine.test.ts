import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import type { CabineDeTransporte } from './cabine'
import { comCabineParaJogador, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { parseAdventure, serializeAdventure } from './adventure'

/**
 * CABINE DE TRANSPORTE no recorte do jogador: a parada que o recorte já
 * mandou ganha só `cabine: 'aqui' | 'longe'`. Nunca o nome ou o id da cabine,
 * nunca onde ela está. E o campo não nasce de um `map.json` editado à mão.
 */

const CENA = 'cena-terreo'
const ESPINHA: CabineDeTransporte = {
  id: 'cab-espinha-secreta',
  nome: 'Espinha do Farol',
  paradas: [
    { sceneId: CENA, pinId: 'parada-terreo' },
    { sceneId: 'cena-topo-secreta', pinId: 'parada-topo' },
  ],
  atual: { sceneId: 'cena-topo-secreta', pinId: 'parada-topo' },
}

function viagem(id: string, x: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y: 200, kind: 'viagem', description: 'Porta de grade', image: null, ...extra }
}

describe('comCabineParaJogador', () => {
  it('a parada diz "longe" e nada da cabine vai junto', () => {
    const pins = comCabineParaJogador([viagem('parada-terreo', 200)], CENA, [ESPINHA])
    expect(pins).toEqual([{ ...viagem('parada-terreo', 200), cabine: 'longe' }])
    const json = JSON.stringify(pins)
    expect(json).not.toContain('Espinha')
    expect(json).not.toContain('cab-espinha-secreta')
    expect(json).not.toContain('cena-topo-secreta')
    expect(json).not.toContain('parada-topo')
  })

  it('a parada onde a cabine está diz "aqui"', () => {
    const aqui = { ...ESPINHA, atual: { sceneId: CENA, pinId: 'parada-terreo' } }
    expect(comCabineParaJogador([viagem('parada-terreo', 200)], CENA, [aqui])[0].cabine).toBe('aqui')
  })

  it('pino que não é parada, pino "!" e mapa sem cabine ficam como vieram', () => {
    const marcador: Pin = { id: 'parada-terreo', x: 1, y: 1, kind: 'exclamacao', description: '', image: null }
    const outro = viagem('outro', 300)
    expect(comCabineParaJogador([marcador, outro], CENA, [ESPINHA])).toEqual([marcador, outro])
    expect(comCabineParaJogador([viagem('parada-terreo', 200)], CENA, undefined)).toEqual([viagem('parada-terreo', 200)])
  })

  it('só marca o que o recorte mandou: parada escondida pela névoa não ganha nada (nem aparece)', () => {
    const map: MapData = {
      ...createEmptyMap('m', 'M', 4000, 1000, 40),
      tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
      // Longe do raio de visão: a névoa não manda o pino.
      pins: [viagem('parada-terreo', 3800)],
    }
    const view = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 300)
    expect(comCabineParaJogador(view.map.pins, CENA, [ESPINHA])).toEqual([])
  })

  it('um `cabine` escrito no map.json à mão não passa pelo recorte nem fica no mapa do mestre', () => {
    const lido = deserializeMap(
      `{"id": "torto", "pins": [{"id": "p", "x": 200, "y": 200, "kind": "viagem", "description": "", "image": null, "cabine": "aqui"}]}`,
    )
    expect(lido.pins[0].cabine).toBeUndefined()
    expect(serializeMap(lido)).not.toContain('cabine')
    const map: MapData = {
      ...createEmptyMap('m', 'M', 1000, 1000, 40),
      tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
      pins: [viagem('p', 220, { cabine: 'aqui' })],
    }
    const view = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 300)
    expect(view.map.pins).toHaveLength(1)
    expect(view.map.pins[0].cabine).toBeUndefined()
  })
})

describe('adventure.json: cabines', () => {
  const BASE = { version: 1, id: 'adv', name: 'Farol', startSceneId: 'a', scenes: [{ id: 'a', name: 'A', file: 'scenes/a/map.json' }] }

  it('aventura antiga abre sem a chave e grava sem ela', () => {
    const antiga = parseAdventure(JSON.stringify(BASE))
    expect(antiga.cabines).toBeUndefined()
    expect(serializeAdventure(antiga)).not.toContain('cabines')
  })

  it('cabine vai e volta do disco', () => {
    const lida = parseAdventure(JSON.stringify({ ...BASE, cabines: [ESPINHA] }))
    expect(lida.cabines).toEqual([ESPINHA])
    expect(parseAdventure(serializeAdventure(lida)).cabines).toEqual([ESPINHA])
  })
})
