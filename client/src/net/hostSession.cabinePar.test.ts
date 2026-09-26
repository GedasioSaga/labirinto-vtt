/**
 * CABINE CONTÍNUA AO PAR, lado da sessão: a cabine leva a ficha que está NELA,
 * não a primeira ficha do jogador. `sendPlayer(..., tokenId)` troca de cena
 * exatamente essa ficha, e o jogador só recebe `scene.changed` — nunca o nome
 * da cena, nem quem mais estava lá.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { arrivalSpot } from '../lib/pinTravel'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'

const CODE = 'CB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[], pins: Pin[] = []): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens, pins }
}

const parNoPorao: Pin = { id: 'poco-porao', x: 700, y: 200, kind: 'viagem', description: '', image: null, destino: { sceneId: 's-a', pinId: 'poco' } }

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  // Ana tem duas fichas no térreo: o guerreiro (primeira) e o cão, que está na cabine.
  const terreo = mapa('m-terreo', 'Terreo Norte', [ficha('guerreiro', 400, 100), ficha('cao', 75, 75), ficha('npc', 200, 200)])
  const porao = mapa('m-porao', 'Porao Umido', [], [parNoPorao])
  const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Terreo Norte', map: terreo }, background: [{ sceneId: 's-b', name: 'Porao Umido', map: porao }] }
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, mundo)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'guerreiro')
  s.assignToken(welcome.playerId, 'cao')
  return { s, playerId: welcome.playerId, mundo }
}

describe('sendPlayer com a ficha da cabine', () => {
  it('leva a ficha escolhida (o cão), não a primeira dele (o guerreiro), ao par', () => {
    const { s, playerId, mundo } = mesa()
    const r = s.sendPlayer(playerId, 's-b', 'poco-porao', mundo, undefined, 'cao')
    // A casa de chegada é a do pino par, a mesma do "Mandar para…" de sempre.
    const chegada = arrivalSpot(mundo.background[0]?.map ?? mapa('x', 'x', []), parNoPorao, 1, 'cao')
    expect(r.applyTransfer).toMatchObject({ tokenId: 'cao', fromSceneId: 's-a', toSceneId: 's-b', x: chegada.x, y: chegada.y })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', by: 'master' } }])
    expect(JSON.stringify(r.outbound)).not.toContain('Porao Umido')
  })

  it('ficha que não é dele, ou que não está em cena nenhuma, não leva ninguém', () => {
    const { s, playerId, mundo } = mesa()
    expect(s.sendPlayer(playerId, 's-b', 'poco-porao', mundo, undefined, 'npc')).toEqual({ outbound: [] })
    expect(s.sendPlayer(playerId, 's-b', 'poco-porao', mundo, undefined, 'sumiu')).toEqual({ outbound: [] })
  })

  it('sem a ficha, continua levando a primeira dele (o "Mandar para…" de sempre)', () => {
    const { s, playerId, mundo } = mesa()
    expect(s.sendPlayer(playerId, 's-b', 'poco-porao', mundo).applyTransfer?.tokenId).toBe('guerreiro')
  })
})
