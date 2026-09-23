/**
 * INICIATIVA pela rede: o jogador recebe DE QUEM É A VEZ só quando a ficha da
 * vez está no recorte dele (`lib/fogFilter.ts`). Ficha secreta, atrás da
 * parede, fora da visão ou de outra cena: o campo nem vai — nem o id.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { turnForPlayer } from '../lib/fogFilter'
import type { TurnRef } from '../lib/initiative'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number, secret = false): Token {
  const t: Token = { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
  return secret ? { ...t, secret: true } : t
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Herói (do jogador), goblin à vista, vulto SECRETO à vista, ladino atrás da parede em x=500. */
function ponte(): MapData {
  return {
    ...createEmptyMap('mapa-ponte', 'Ponte Velha', 1000, 1000, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    tokens: [ficha('heroi', 200, 200), ficha('goblin', 320, 200), ficha('vulto', 260, 260, true), ficha('ladino', 800, 200)],
  }
}

function snapshotCom(turn: TurnRef | null, map: MapData = ponte()): Extract<HostMessage, { type: 'snapshot' }> {
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, getTurn: () => turn })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  const msg = s.broadcast(map).outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

describe('iniciativa no snapshot do jogador', () => {
  it('a vez de uma ficha à vista chega pelo id; a da própria ficha também', () => {
    expect(snapshotCom({ mapId: 'mapa-ponte', tokenId: 'goblin' }).turn).toBe('goblin')
    expect(snapshotCom({ mapId: 'mapa-ponte', tokenId: 'heroi' }).turn).toBe('heroi')
  })

  it('SEGURANÇA: na vez da ficha SECRETA o jogador não recebe o campo, nem o id, nem o nome', () => {
    const msg = snapshotCom({ mapId: 'mapa-ponte', tokenId: 'vulto' })
    expect('turn' in msg).toBe(false)
    const fio = JSON.stringify(msg)
    expect(fio).not.toContain('vulto')
    expect(fio).not.toContain('nome-vulto')
  })

  it('SEGURANÇA: ficha atrás da parede (fora da visão) não vira vez no jogador', () => {
    const msg = snapshotCom({ mapId: 'mapa-ponte', tokenId: 'ladino' })
    expect('turn' in msg).toBe(false)
    expect(JSON.stringify(msg)).not.toContain('ladino')
  })

  it('SEGURANÇA: a vez de outra cena (outro mapa) não vaza para quem está nesta, mesmo com id igual', () => {
    const msg = snapshotCom({ mapId: 'mapa-cripta', tokenId: 'goblin' })
    expect('turn' in msg).toBe(false)
  })

  it('sem vez nenhuma, o snapshot sai como sempre saiu', () => {
    expect('turn' in snapshotCom(null)).toBe(false)
  })
})

describe('turnForPlayer (recorte)', () => {
  const recorte = { ...ponte(), tokens: [ficha('heroi', 200, 200), ficha('goblin', 320, 200)] }

  it('só devolve o id quando a ficha está no recorte e a vez é deste mapa', () => {
    expect(turnForPlayer(recorte, { mapId: 'mapa-ponte', tokenId: 'goblin' })).toBe('goblin')
    expect(turnForPlayer(recorte, { mapId: 'mapa-ponte', tokenId: 'vulto' })).toBeNull()
    expect(turnForPlayer(recorte, { mapId: 'outro', tokenId: 'goblin' })).toBeNull()
    expect(turnForPlayer(recorte, null)).toBeNull()
  })
})
