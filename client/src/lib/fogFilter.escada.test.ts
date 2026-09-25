import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, Stair } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * ESCADA QUE LEVA A OUTRO ANDAR no recorte do jogador: o pino invisível da
 * escada só sai JUNTO com a escada, e sai sem destino. Escada secreta, em sala
 * oculta, no escuro ou apagada: o pino não sai, nem o id dele em lugar nenhum.
 */

const RAIO = 300
const POSSE = { p1: ['bruno'] }
const ID_DO_PINO = 'pino_da_escada_do_terreo'
const ID_DO_PAR = 'pino_da_escada_do_andar1'
const ID_DA_CENA = 'cena_primeiro_andar'

function escada(extra: Partial<Stair> = {}): Stair {
  return { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 240, y1: 200, x2: 240, y2: 120 }], stepWidth: 40, ...extra }
}

const PINO: Pin = {
  id: ID_DO_PINO,
  x: 240,
  y: 200,
  kind: 'viagem',
  description: '',
  image: null,
  passagem: 'livre',
  destino: { sceneId: ID_DA_CENA, pinId: ID_DO_PAR },
  escadaId: 'escada',
}

function mapa(stairs: Stair[], pins: Pin[] = [PINO], regions: Region[] = []): MapData {
  return {
    ...createEmptyMap('m', 'Térreo', 1000, 1000, 40),
    tokens: [{ id: 'bruno', characterId: null, name: 'Bruno', x: 200, y: 200, size: 1, image: null }],
    stairs,
    pins,
    regions,
  }
}

function semVazamento(view: ReturnType<typeof filterMapForPlayer>): void {
  const tudo = JSON.stringify(view)
  expect(tudo).not.toContain(ID_DO_PINO)
  expect(tudo).not.toContain(ID_DO_PAR)
  expect(tudo).not.toContain(ID_DA_CENA)
}

describe('fogFilter: escada que leva a outro andar', () => {
  it('escada à vista: o pino sai com a escada, marcado com ela, sem destino', () => {
    const view = filterMapForPlayer(mapa([escada()]), 'p1', POSSE, RAIO)
    expect(view.map.stairs.map((s) => s.id)).toEqual(['escada'])
    expect(view.map.pins).toEqual([{ id: ID_DO_PINO, x: 240, y: 200, kind: 'viagem', description: '', image: null, passagem: 'livre', escadaId: 'escada' }])
    expect(JSON.stringify(view)).not.toContain(ID_DA_CENA)
    expect(JSON.stringify(view)).not.toContain(ID_DO_PAR)
  })

  it('escada secreta: nem a escada nem o pino saem', () => {
    const view = filterMapForPlayer(mapa([escada({ secret: true })]), 'p1', POSSE, RAIO)
    expect(view.map.stairs).toEqual([])
    expect(view.map.pins).toEqual([])
    semVazamento(view)
  })

  it('escada no escuro, longe da visão: nem a escada nem o pino saem', () => {
    const longe = escada({ segments: [{ x1: 900, y1: 900, x2: 900, y2: 820 }] })
    const pino: Pin = { ...PINO, x: 900, y: 900 }
    const view = filterMapForPlayer(mapa([longe], [pino]), 'p1', POSSE, RAIO)
    expect(view.map.stairs).toEqual([])
    expect(view.map.pins).toEqual([])
    semVazamento(view)
  })

  it('pino à vista de uma escada escondida em outro lugar: a escada manda, o pino não sai', () => {
    // O pino ficou para trás (arquivo editado à mão), à vista do jogador; a escada dele está no escuro.
    const longe = escada({ segments: [{ x1: 900, y1: 900, x2: 900, y2: 820 }] })
    const view = filterMapForPlayer(mapa([longe], [PINO]), 'p1', POSSE, RAIO)
    expect(view.map.pins).toEqual([])
    semVazamento(view)
  })

  it('pino de escada que não existe mais: não sai', () => {
    const view = filterMapForPlayer(mapa([], [PINO]), 'p1', POSSE, RAIO)
    expect(view.map.pins).toEqual([])
    semVazamento(view)
  })

  it('pino secreto numa escada à vista: a escada sai, o pino não', () => {
    const view = filterMapForPlayer(mapa([escada()], [{ ...PINO, secret: true }]), 'p1', POSSE, RAIO)
    expect(view.map.stairs.map((s) => s.id)).toEqual(['escada'])
    expect(view.map.pins).toEqual([])
    semVazamento(view)
  })

  it('controle: um pino de viagem comum no mesmo ponto continua saindo, sem escadaId', () => {
    const { escadaId: _escada, ...comum } = PINO
    const view = filterMapForPlayer(mapa([], [comum]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual([ID_DO_PINO])
    expect(view.map.pins[0].escadaId).toBeUndefined()
  })
})
