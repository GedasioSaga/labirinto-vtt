/**
 * RECADO PARA ESCOLHIDOS com PISOS NA MESMA CENA: a Sala do atalho "Quem está
 * em: <sala>" é a do PISO da ficha. A Adega do térreo e a Biblioteca do 1º
 * piso ocupam o mesmo lugar do plano; quem está na Biblioteca não está na Adega.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { HostWorld } from '../net/hostSession'
import type { Region } from '../types/map'
import { peopleByScene, type PartyMember } from './party'

function sala(id: string, name: string, piso?: number): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name },
    ...(piso === undefined ? {} : { piso }),
  }
}

const TORRE: HostWorld = {
  open: {
    sceneId: 's-torre',
    name: 'Torre',
    map: { ...createEmptyMap('m-torre', 'Torre', 20, 20, 50), regions: [sala('adega', 'Adega'), sala('biblioteca', 'Biblioteca', 1)] },
  },
  background: [],
}

function membro(playerId: string, piso?: number): PartyMember {
  const token = { id: `t-${playerId}`, color: '#3cff00', x: 100, y: 100, ...(piso === undefined ? {} : { piso }) }
  return { playerId, name: playerId, connected: true, sceneId: 's-torre', sceneName: null, token, travelPending: false, mochila: [] }
}

function salasDe(playerId: string): string[] | undefined {
  return peopleByScene([membro('lia', 1), membro('rui')], TORRE)
    .get('s-torre')
    ?.people.find((p) => p.playerId === playerId)
    ?.rooms?.map((r) => `${r.id}:${r.name}`)
}

describe('peopleByScene com pisos: a Sala é a do piso da ficha', () => {
  it('ficha no 1º piso está na Biblioteca, não na Adega do térreo embaixo dela', () => {
    expect(salasDe('lia')).toEqual(['biblioteca:Biblioteca'])
  })

  it('ficha no térreo está na Adega, não na Biblioteca de cima', () => {
    expect(salasDe('rui')).toEqual(['adega:Adega'])
  })
})
