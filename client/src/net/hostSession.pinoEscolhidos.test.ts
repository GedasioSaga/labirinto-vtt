import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PINO SÓ PARA OS ESCOLHIDOS no host: a lista de quem vê mora na sessão. O
 * snapshot de quem não está nela não leva o pino, o pedido de passagem por
 * ele é recusado com o motivo genérico, e marcar alguém faz o pino aparecer no
 * próximo broadcast, sem o jogador recarregar.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const TEXTO_DA_FACA = 'Faca com sangue seco no cabo'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

const FACA: Pin = { id: 'faca', x: 300, y: 200, kind: 'exclamacao', description: TEXTO_DA_FACA, image: null }

function salao(): MapData {
  return {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    // Diego encostado no alçapão: pino só atravessa de perto.
    tokens: [token('ficha-diego', 350, 200), token('ficha-carla', 250, 200)],
    pins: [FACA, { id: 'alcapao', x: 400, y: 200, kind: 'viagem', description: 'Alçapão', image: null, destino: { sceneId: CRIPTA, pinId: 'fundo' }, passagem: 'livre' }],
  }
}

function mundo(): HostWorld {
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao() },
    background: [
      {
        sceneId: CRIPTA,
        name: 'Cripta',
        map: {
          ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, 50),
          pins: [{ id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo', image: null, destino: { sceneId: SALAO, pinId: 'alcapao' } }],
        },
      },
    ],
  }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinosDo(result: HostResult, clientId: string): Pin[] {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg.map.pins
}

function mesa() {
  let n = 0
  const w = mundo()
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, w))
  const carla = welcomeOf(s.handleMessage('c-carla', { type: 'join', code: CODE, name: 'Carla' }, w))
  s.assignToken(diego, 'ficha-diego')
  s.assignToken(carla, 'ficha-carla')
  return { s, w, diego, carla }
}

describe('hostSession: pino só para os escolhidos', () => {
  it('pino "Faca" só para Diego: aparece para ele; Carla, no mesmo quarto, não recebe nada dele', () => {
    const { s, w, diego } = mesa()
    s.setPinAudience('faca', [diego])
    const r = s.broadcast(w)
    expect(pinosDo(r, 'c-diego').map((p) => p.id)).toContain('faca')
    expect(pinosDo(r, 'c-carla').map((p) => p.id)).not.toContain('faca')
    const pacoteDaCarla = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-carla'))
    expect(pacoteDaCarla).not.toContain('"faca"')
    expect(pacoteDaCarla).not.toContain(TEXTO_DA_FACA)
  })

  it('marcar Carla: o próximo broadcast já leva o pino para ela, sem recarregar', () => {
    const { s, w, diego, carla } = mesa()
    s.setPinAudience('faca', [diego])
    expect(pinosDo(s.broadcast(w), 'c-carla').map((p) => p.id)).not.toContain('faca')
    s.setPinAudience('faca', [diego, carla])
    expect(pinosDo(s.broadcast(w), 'c-carla').map((p) => p.id)).toContain('faca')
  })

  it('a lista é lida de volta para o editor; "Todos" (null) apaga a lista', () => {
    const { s, w, diego } = mesa()
    expect(s.pinAudience('faca')).toBeNull()
    s.setPinAudience('faca', [diego])
    expect(s.pinAudience('faca')).toEqual([diego])
    s.setPinAudience('faca', null)
    expect(s.pinAudience('faca')).toBeNull()
    expect(pinosDo(s.broadcast(w), 'c-carla').map((p) => p.id)).toContain('faca')
  })

  it('id de jogador que não está na sala não entra na lista', () => {
    const { s, diego } = mesa()
    s.setPinAudience('faca', [diego, 'inventado'])
    expect(s.pinAudience('faca')).toEqual([diego])
  })

  it('expulsar um escolhido tira ele da lista', () => {
    const { s, diego, carla } = mesa()
    s.setPinAudience('faca', [diego, carla])
    s.kick('c-diego')
    expect(s.pinAudience('faca')).toEqual([carla])
  })

  it('pino de viagem só para Diego: Carla não passa por ele (motivo genérico), Diego passa', () => {
    const { s, w, diego } = mesa()
    s.setPinAudience('alcapao', [diego])
    s.broadcast(w)
    const daCarla = s.handleMessage('c-carla', { type: 'pin.travel.request', pinId: 'alcapao' }, w)
    const msg = daCarla.outbound[0]?.msg
    expect(msg?.type === 'pin.travel.rejected' ? msg.reason : null).toBe('unavailable')
    expect(daCarla.applyTransfer).toBeUndefined()
    const doDiego = s.handleMessage('c-diego', { type: 'pin.travel.request', pinId: 'alcapao' }, w)
    expect(doDiego.applyTransfer).toMatchObject({ tokenId: 'ficha-diego', toSceneId: CRIPTA })
  })
})
