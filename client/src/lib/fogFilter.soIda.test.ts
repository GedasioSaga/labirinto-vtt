import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { SAIDA_PRINCIPAL, type OneWayExits } from './pinTravel'

/**
 * PASSAGEM SÓ DE IDA no recorte do jogador: quando o par de uma saída é a
 * chegada oculta (mão única), o pino de partida sai com `semVolta` (pino de
 * uma saída) ou a escolha com `soIda` (encruzilhada). É só um booleano: o
 * destino, a cena e o id do par continuam fora do recorte. Quem decide o que
 * é só de ida é o host (`oneWayExits`); marca que venha gravada no pino do
 * mestre (arquivo editado à mão) não atravessa.
 */

const RAIO = 300
const POSSE = { p1: ['heroi'] }

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

const CALHA: Pin = {
  id: 'calha',
  x: 240,
  y: 200,
  kind: 'viagem',
  description: 'Calha de varredura',
  image: null,
  destino: { sceneId: 'scene_mecanismo_secreto', pinId: 'par_do_mecanismo' },
}

const CRUZ: Pin = {
  id: 'cruz',
  x: 260,
  y: 200,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  destino: { sceneId: 'scene_cripta_secreta', pinId: 'par_da_cripta' },
  rotulo: 'Porta da cripta',
  saidas: [{ id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: 'scene_poco_secreto', pinId: 'par_do_poco' } }],
}

const soIda = (entries: [string, string[]][]): OneWayExits => new Map(entries.map(([pinId, exits]) => [pinId, new Set(exits)]))

describe('fogFilter: passagem só de ida', () => {
  it('pino de uma saída com o par só de chegada sai com semVolta, e nada do destino', () => {
    const view = filterMapForPlayer(mapaCom([CALHA]), 'p1', POSSE, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, soIda([['calha', [SAIDA_PRINCIPAL]]]))
    expect(view.map.pins).toHaveLength(1)
    expect(view.map.pins[0].semVolta).toBe(true)
    expect(view.map.pins[0].destino).toBeUndefined()
    const rede = JSON.stringify(view)
    expect(rede).not.toContain('scene_mecanismo_secreto')
    expect(rede).not.toContain('par_do_mecanismo')
  })

  it('sem a lista do host, o pino sai como sempre: sem semVolta', () => {
    const view = filterMapForPlayer(mapaCom([CALHA]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual(['calha'])
    expect(view.map.pins[0].semVolta).toBeUndefined()
  })

  it('marca gravada no pino do mestre (arquivo à mão) não atravessa: quem decide é o host', () => {
    const forjado: Pin = { ...CALHA, semVolta: true }
    const view = filterMapForPlayer(mapaCom([forjado]), 'p1', POSSE, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, soIda([]))
    expect(view.map.pins.map((p) => p.id)).toEqual(['calha'])
    expect(view.map.pins[0].semVolta).toBeUndefined()
  })

  it('encruzilhada: só a saída cujo par é chegada oculta ganha soIda; o pino não ganha semVolta', () => {
    const view = filterMapForPlayer(mapaCom([CRUZ]), 'p1', POSSE, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, soIda([['cruz', ['saida_poco']]]))
    const pino = view.map.pins[0]
    expect(pino.escolhas).toEqual([
      { id: SAIDA_PRINCIPAL, rotulo: 'Porta da cripta' },
      { id: 'saida_poco', rotulo: 'Poço', soIda: true },
    ])
    expect(pino.semVolta).toBeUndefined()
    expect(JSON.stringify(view)).not.toContain('par_do_poco')
  })

  it('pino fora da visão não sai — nem a marca de só ida dele', () => {
    const longe: Pin = { ...CALHA, x: 900, y: 900 }
    const view = filterMapForPlayer(mapaCom([longe]), 'p1', POSSE, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, soIda([['calha', [SAIDA_PRINCIPAL]]]))
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view)).not.toContain('semVolta')
  })
})
