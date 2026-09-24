import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PASSAGEM SÓ DE IDA no host: o pino de partida cujo par, na OUTRA cena, é a
 * chegada oculta sai no snapshot com `semVolta` — o jogador lê "Só ida" antes
 * de cair. O snapshot continua sem nada da outra cena: nem o nome, nem o id
 * dela, nem o id do par.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const ARSENAL = 'cena-arsenal'
const MECANISMO = 'cena-mecanismo'
const TORRE = 'cena-torre'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/**
 * O Arsenal (onde a heroína está) com a calha (par só de chegada no
 * Mecanismo), uma escada comum (par de mão dupla na Torre) e uma encruzilhada
 * com uma saída de cada tipo.
 */
function mundo(calhaSoIda: boolean): HostWorld {
  const arsenal: MapData = {
    ...createEmptyMap('mapa-arsenal', 'Arsenal', 40, 10, 50),
    tokens: [token('heroi', 200, 200)],
    pins: [
      viagem('calha', 300, 200, { sceneId: MECANISMO, pinId: 'fundo-da-calha' }),
      viagem('escada', 350, 200, { sceneId: TORRE, pinId: 'topo' }),
      viagem('cruz', 400, 200, { sceneId: TORRE, pinId: 'sacada' }, {
        rotulo: 'Sacada',
        saidas: [{ id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: MECANISMO, pinId: 'boca-do-poco' } }],
      }),
    ],
  }
  const mecanismo: MapData = {
    ...createEmptyMap('mapa-mecanismo', 'Mecanismo Secreto', 40, 10, 50),
    pins: [
      viagem('fundo-da-calha', 1000, 250, { sceneId: ARSENAL, pinId: 'calha' }, calhaSoIda ? { soChegada: true } : {}),
      viagem('boca-do-poco', 1100, 250, { sceneId: ARSENAL, pinId: 'cruz' }, { soChegada: true }),
    ],
  }
  const torre: MapData = {
    ...createEmptyMap('mapa-torre', 'Torre Alta', 40, 10, 50),
    pins: [viagem('topo', 600, 300, { sceneId: ARSENAL, pinId: 'escada' }), viagem('sacada', 700, 300, { sceneId: ARSENAL, pinId: 'cruz' })],
  }
  return {
    open: { sceneId: ARSENAL, name: 'Arsenal', map: arsenal },
    background: [
      { sceneId: MECANISMO, name: 'Mecanismo Secreto', map: mecanismo },
      { sceneId: TORRE, name: 'Torre Alta', map: torre },
    ],
  }
}

/** Os pinos do snapshot que o jogador recebeu, e o snapshot inteiro como a rede o leva. */
function snapshotDe(r: HostResult): { pins: Pin[]; rede: string } {
  const snap = r.outbound.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot')
  return { pins: snap.map.pins, rede: JSON.stringify(snap) }
}

function recebido(w: HostWorld): { pins: Pin[]; rede: string } {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  return snapshotDe(s.broadcast(w))
}

const pino = (pins: Pin[], id: string): Pin => {
  const achado = pins.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`o pino ${id} deveria estar no recorte`)
  return achado
}

describe('hostSession: passagem só de ida', () => {
  it('par só de chegada na outra cena: o pino de partida chega com semVolta', () => {
    const { pins } = recebido(mundo(true))
    expect(pino(pins, 'calha').semVolta).toBe(true)
    // A escada comum, na mesma cena, continua sem a marca.
    expect(pino(pins, 'escada').semVolta).toBeUndefined()
  })

  it('controle: sem a marca no par, a calha chega como sempre', () => {
    const { pins } = recebido(mundo(false))
    expect(pino(pins, 'calha').semVolta).toBeUndefined()
  })

  it('encruzilhada: só a saída do poço (par só de chegada) vem com soIda', () => {
    const { pins } = recebido(mundo(true))
    expect(pino(pins, 'cruz').escolhas).toEqual([
      { id: 'principal', rotulo: 'Sacada' },
      { id: 'saida_poco', rotulo: 'Poço', soIda: true },
    ])
  })

  it('SEGURANÇA — o aviso não leva nada da outra cena: nome, id da cena e id do par ficam fora', () => {
    const { rede } = recebido(mundo(true))
    expect(rede).toContain('semVolta')
    for (const segredo of [MECANISMO, 'Mecanismo Secreto', 'fundo-da-calha', 'boca-do-poco', 'soChegada', TORRE, 'Torre Alta']) {
      expect(rede, segredo).not.toContain(segredo)
    }
  })
})
