import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ESPIAR PELA PASSAGEM no host, contra as regras de esconder que o recorte do
 * jogador ganhou depois da primeira versão: o MARCO visto de longe (o pino
 * chega pela névoa, mas a ficha não o enxerga) não dá vista, e o recorte do
 * outro lado respeita o PISO do pino par.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 50
const SALAO = 'cena-salao'
const TORRE = 'cena-torre'
const AZUL = '#2e86c1'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `Pino ${id}`, image: null, destino, ...extra }
}

interface Opcoes {
  grade?: Partial<Pin>
  boca?: Partial<Pin>
  /** Parede entre a ficha (x = 240) e a grade (x = 200): a ficha encosta, mas não enxerga. */
  muro?: boolean
}

/** O Salão com a grade que dá vista para a Torre; na Torre, um guarda no térreo e uma sentinela no 1º piso. */
function mundo({ grade = {}, boca = {}, muro = false }: Opcoes = {}): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, GRID),
    tokens: [ficha('heroi', 240, 200)],
    walls: muro ? [parede('muro', 218, 100, 218, 300)] : [],
    pins: [viagem('grade', 200, 200, { sceneId: TORRE, pinId: 'boca' }, { daVista: 3, ...grade })],
  }
  const torre: MapData = {
    ...createEmptyMap('mapa-torre', 'Torre do Mago', 40, 20, GRID),
    tokens: [ficha('guarda', 1000, 300, { color: '#c0392b' }), ficha('sentinela', 1000, 500, { color: AZUL, piso: 1 })],
    pins: [viagem('boca', 1000, 400, { sceneId: SALAO, pinId: 'grade' }, boca)],
  }
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [{ sceneId: TORRE, name: 'Torre do Mago', map: torre }],
  }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

function espiar(w: HostWorld): HostResult {
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1_000_000, randomId: () => 'id-1' })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  s.broadcast(w)
  return s.handleMessage('c1', { type: 'pin.peek', pinId: 'grade' }, w)
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.peek.rejected' ? msg.reason : null
}

describe('hostSession: espiar pela passagem e o recorte de agora', () => {
  it('SEGURANÇA — grade MARCO atrás do muro: a ficha encosta mas não enxerga, então não espia', () => {
    const r = espiar(mundo({ grade: { marco: true }, muro: true }))
    expect(recusa(r)).toBe('unavailable')
    expect(r.pinPeek).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain('view')
  })

  it('a mesma grade marco, sem o muro: espia (controle — é o muro que tira)', () => {
    const r = espiar(mundo({ grade: { marco: true } }))
    expect(r.outbound[0]?.msg.type).toBe('pin.peek.view')
    expect(r.pinPeek?.toSceneId).toBe(TORRE)
  })

  it('SEGURANÇA — boca do poço no 1º piso: o recorte é do 1º piso, e o guarda do térreo não chega', () => {
    const r = espiar(mundo({ boca: { piso: 1 } }))
    const msg = r.outbound[0]?.msg
    if (msg?.type !== 'pin.peek.view') throw new Error('esperava pin.peek.view')
    expect(msg.view.tokens).toEqual([{ x: 0, y: 100, size: 1, color: AZUL }])
    expect(JSON.stringify(msg)).not.toContain('#c0392b')
  })
})
