/**
 * Ficha sem chão debaixo dela, pela rede. O mestre apagou o chão onde a ficha
 * da Ana estava; o primeiro arrasto dela é aceito no chão mais próximo que a
 * ficha alcança, e a resposta leva `landing: 'nearest_floor'` para a tela dela
 * explicar por que a ficha foi parar ali. O recorte continua valendo: o chão
 * escondido em zona oculta não vira destino (o ponto devolvido diria à Ana
 * que ali existe chão), e a resposta vai só para quem pediu.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { ConcealZone, FloorPiece, MapData, Token } from '../types/map'
import { createHostSession } from './hostSession'

const CODE = 'AB12CD'
const GRID = 40

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

/** Zona oculta cobrindo a sala A (x 150..250) inteira. */
const ZONA: ConcealZone = {
  id: 'z',
  name: 'Tesouro do mestre',
  revealed: false,
  points: [
    { x: 140, y: 440 },
    { x: 260, y: 440 },
    { x: 260, y: 560 },
    { x: 140, y: 560 },
  ],
}

/** A ficha da Ana em x=300, sem chão; sala A (escondida) a 50 px, sala B a 150 px. A Bia está na sala B. */
function mapaSemChao(concealZones: ConcealZone[]): MapData {
  return {
    ...createEmptyMap('m', 'Cripta', 1000, 1000, GRID),
    floor: [chao('a', 200, 500, 100, 100), chao('b', 500, 500, 100, 100)],
    tokens: [ficha('heroi', 300, 500), ficha('aliado', 520, 500)],
    concealZones,
  }
}

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrar = (clientId: string, name: string, tokenId: string): void => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  }
  entrar('c1', 'Ana', 'heroi')
  entrar('c2', 'Bia', 'aliado')
  s.broadcast(map)
  return s
}

describe('ficha sem chão, pela rede', () => {
  it('primeiro arrasto é aceito no chão mais perto, com o motivo, só para quem pediu', () => {
    const map = mapaSemChao([])
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 310, y: 500 }, map)
    expect(r.outbound).toHaveLength(1)
    const saida = r.outbound[0]
    expect(saida?.clientId).toBe('c1')
    const msg = saida?.msg
    if (msg?.type !== 'token.move.accepted') throw new Error(`esperava accepted, veio ${String(msg?.type)}`)
    expect(msg.landing).toBe('nearest_floor')
    // Sem zona: a sala A (a mais perto) é o destino.
    expect(msg.x).toBeGreaterThanOrEqual(150)
    expect(msg.x).toBeLessThanOrEqual(250)
    expect(r.applyMove).toEqual({ tokenId: 'heroi', x: msg.x, y: msg.y })
  })

  it('chão em zona oculta não é destino: o ponto escondido não chega ao jogador', () => {
    const map = mapaSemChao([ZONA])
    const s = mesa(map)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 310, y: 500 }, map)
    const msg = r.outbound[0]?.msg
    if (msg?.type !== 'token.move.accepted') throw new Error(`esperava accepted, veio ${String(msg?.type)}`)
    expect(msg.landing).toBe('nearest_floor')
    expect(msg.x).toBeGreaterThanOrEqual(450)
    const dentroDaZona = msg.x > 140 && msg.x < 260 && msg.y > 440 && msg.y < 560
    expect(dentroDaZona).toBe(false)
    // Nada além do x/y da própria ficha e do motivo: nem o nome da zona, nem outro ponto.
    expect(Object.keys(msg).sort()).toEqual(['landing', 'reqId', 'type', 'x', 'y'])
    expect(JSON.stringify(r.outbound)).not.toContain('Tesouro')
  })

  it('movimento normal, com chão debaixo, não leva o motivo', () => {
    const map = mapaSemChao([])
    const s = mesa(map)
    const r = s.handleMessage('c2', { type: 'token.move', reqId: 'r2', tokenId: 'aliado', x: 500, y: 510 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'token.move.accepted', reqId: 'r2', x: 500, y: 510 } }])
  })
})
