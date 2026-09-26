import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinExit, PinPassage, Token } from '../types/map'
import { createHostSession, TRAVEL_REQUEST_MIN_INTERVAL_MS, TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MODO POR SAÍDA no host: quem decide se a saída deixa passar é o host, pelo
 * modo DAQUELA saída — livre vai direto, pede vai ao mestre, trancada só com o
 * mestre liberando (ou nada, se o pino é mudo). E o snapshot do jogador leva o
 * modo de cada saída sem nada da outra cena.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta-secreta'
const TORRE = 'cena-torre-secreta'
const POCO = 'cena-poco-secreto'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

interface Modos {
  pino?: PinPassage
  torre?: PinExit['passagem']
  poco?: PinExit['passagem']
  mudo?: true
}

/** O Salão com a encruzilhada: principal para a Cripta, extras para a Torre e o Poço. */
function mundo(modos: Modos): HostWorld {
  const torre: PinExit = { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: TORRE, pinId: 'chegada-torre' } }
  const poco: PinExit = { id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: POCO, pinId: 'boca-poco' } }
  if (modos.torre !== undefined) torre.passagem = modos.torre
  if (modos.poco !== undefined) poco.passagem = modos.poco
  const extra: Partial<Pin> = { rotulo: 'Porta da cripta', saidas: [torre, poco] }
  if (modos.pino !== undefined) extra.passagem = modos.pino
  if (modos.mudo !== undefined) extra.mudo = modos.mudo
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, 50),
    tokens: [token('heroi', 425, 225)],
    pins: [viagem('cruz', 400, 200, 'Encruzilhada', { sceneId: CRIPTA, pinId: 'escada-b' }, extra)],
  }
  const cena = (sceneMapId: string, nome: string, pinId: string): MapData => ({
    ...createEmptyMap(sceneMapId, nome, 40, 10, 50),
    pins: [viagem(pinId, 600, 300, 'Chegada', { sceneId: SALAO, pinId: 'cruz' })],
  })
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [
      { sceneId: CRIPTA, name: 'Cripta Rubra', map: cena('mapa-cripta', 'Cripta Rubra', 'escada-b') },
      { sceneId: TORRE, name: 'Torre Alta', map: cena('mapa-torre', 'Torre Alta', 'chegada-torre') },
      { sceneId: POCO, name: 'Fundo do Poço', map: cena('mapa-poco', 'Fundo do Poço', 'boca-poco') },
    ],
  }
}

function mesa(modos: Modos) {
  let clock = 1_000_000
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => clock,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const w = mundo(modos)
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  const snapshot = s.broadcast(w)
  return {
    s,
    w,
    snapshot,
    pedir: (exitId: string): HostResult => {
      clock += TRAVEL_REQUEST_MIN_INTERVAL_MS + TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS
      return s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'cruz', exitId }, w)
    },
  }
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

describe('hostSession: modo por saída', () => {
  it('saída LIVRE num pino que pede: passa direto, sem pedido ao mestre', () => {
    const t = mesa({ torre: 'livre' })
    const r = t.pedir('saida_torre')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'heroi', fromSceneId: SALAO, toSceneId: TORRE })
  })

  it('controle: a saída sem modo próprio segue o pino e pede ao mestre', () => {
    const t = mesa({ torre: 'livre' })
    const r = t.pedir('saida_poco')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest).toMatchObject({ pinLabel: 'Poço', toSceneId: POCO })
    expect(r.travelRequest?.trancada).toBeUndefined()
  })

  it('saída que PEDE num pino livre: vai ao mestre, e a principal (livre) passa direto', () => {
    const t = mesa({ pino: 'livre', torre: 'pede' })
    const pedido = t.pedir('saida_torre')
    expect(pedido.applyTransfer).toBeUndefined()
    expect(pedido.travelRequest).toMatchObject({ pinLabel: 'Escada da torre', toSceneId: TORRE })
    const outra = mesa({ pino: 'livre', torre: 'pede' })
    expect(outra.pedir('principal').applyTransfer).toMatchObject({ toSceneId: CRIPTA })
  })

  it('saída TRANCADA que aceita tentativas: o pedido vai ao mestre marcado como trancada', () => {
    const t = mesa({ pino: 'livre', poco: 'trancada' })
    const r = t.pedir('saida_poco')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest).toMatchObject({ pinLabel: 'Poço', toSceneId: POCO, trancada: true })
  })

  it('saída TRANCADA num pino mudo: recusa genérica, nada chega ao mestre; a livre ao lado passa', () => {
    const t = mesa({ pino: 'livre', poco: 'trancada', mudo: true })
    const r = t.pedir('saida_poco')
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
    expect(t.pedir('saida_torre').applyTransfer).toMatchObject({ toSceneId: TORRE })
  })

  it('pino trancado com uma saída livre: só a livre passa; as outras seguem trancadas', () => {
    const t = mesa({ pino: 'trancada', torre: 'livre', mudo: true })
    expect(t.pedir('saida_torre').applyTransfer).toMatchObject({ toSceneId: TORRE })
    const outra = mesa({ pino: 'trancada', torre: 'livre', mudo: true })
    expect(recusa(outra.pedir('saida_poco'))).toBe('unavailable')
    expect(recusa(outra.pedir('principal'))).toBe('unavailable')
  })

  it('"Passar para pede" do pedido pela saída trancada troca o modo DAQUELA saída, não o do pino', () => {
    const t = mesa({ pino: 'livre', poco: 'trancada' })
    const pedido = t.pedir('saida_poco').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    const r = t.s.approveLockedTravelAsAsk(pedido.requestId, t.w)
    expect(r.applyTransfer).toMatchObject({ toSceneId: POCO })
    expect(r.applyPinPassage).toEqual({ pinId: 'cruz', passagem: 'pede', exitId: 'saida_poco' })
  })

  it('SEGURANÇA — o snapshot leva o modo de cada saída e nada da outra cena', () => {
    const t = mesa({ torre: 'livre', poco: 'trancada' })
    const snap = t.snapshot.outbound.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
    if (snap?.type !== 'snapshot') throw new Error('esperava snapshot')
    expect(snap.map.pins[0].escolhas).toEqual([
      { id: 'principal', rotulo: 'Porta da cripta' },
      { id: 'saida_torre', rotulo: 'Escada da torre', passagem: 'livre' },
      { id: 'saida_poco', rotulo: 'Poço', passagem: 'trancada' },
    ])
    const rede = JSON.stringify(snap)
    for (const segredo of [CRIPTA, TORRE, POCO, 'Cripta Rubra', 'Torre Alta', 'Fundo do Poço', 'escada-b', 'chegada-torre', 'boca-poco', 'destino', 'saidas']) {
      expect(rede, `o snapshot vazou "${segredo}"`).not.toContain(segredo)
    }
  })
})
