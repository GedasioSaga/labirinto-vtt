import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * NOME DO LOCAL pela rede (decisão do usuário, 09/10/2026: o nome do pino vira
 * o título da revelação do local). Perto, o pacote do Diego leva o nome junto
 * com a descrição; renomear com a sessão aberta manda o nome novo. Longe, sem
 * descrição, também sem nome: coberto em `lib/fogFilter.pinoNome.test.ts`.
 */

const CODE = 'AB12CD'
const RADIUS = 300
const DESCRICAO = 'Uma lâmina suja de sangue, embaixo do tapete.'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function casa(nome: string): MapData {
  const faca: Pin = { id: 'pino-7', x: 260, y: 200, kind: 'interrogacao', description: DESCRICAO, image: null, nome }
  return { ...createEmptyMap('mapa-casa', 'Casa', 2000, 2000, 50), tokens: [token('ficha-diego', 200, 200)], pins: [faca] }
}

const mundo = (nome: string): HostWorld => ({ open: { sceneId: 'cena-casa', name: 'Casa', map: casa(nome) }, background: [] })

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinosDo(result: HostResult): Pin[] {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === 'c-diego')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para o Diego')
  return msg.map.pins
}

const pacoteDo = (result: HostResult): string => JSON.stringify(result.outbound.filter((o) => o.clientId === 'c-diego'))

function mesa() {
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
  const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, mundo('Faca')))
  s.assignToken(diego, 'ficha-diego')
  return s
}

describe('hostSession: o nome do pino atravessa a rede junto com a descrição', () => {
  it('perto, o cartão do Diego tem a descrição e o nome do local', () => {
    const r = mesa().broadcast(mundo('Faca'))
    const pino = pinosDo(r).find((p) => p.id === 'pino-7')
    expect(pino?.description).toBe(DESCRICAO)
    expect(pino?.nome).toBe('Faca')
  })

  it('o mestre renomeia o pino com a sessão aberta: o nome novo chega ao Diego', () => {
    const s = mesa()
    expect(pinosDo(s.broadcast(mundo('Faca'))).map((p) => p.id)).toEqual(['pino-7'])
    const r = s.broadcast(mundo('Arma do crime'))
    expect(pacoteDo(r)).toContain('Arma do crime')
    expect(pacoteDo(r)).not.toContain('"Faca"')
  })
})
