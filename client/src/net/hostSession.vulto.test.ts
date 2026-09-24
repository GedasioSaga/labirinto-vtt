/**
 * VULTO, lado do FIO: com "Rostos só de perto: 3 casas" na cena, o snapshot
 * que sai pelo WebSocket da Duda leva a ficha do Caio longe como "Vulto" — e
 * nada do rosto dele (nome da ficha, nome do jogador, cor de sinal, cor da
 * ficha, foto) vai no pacote. Quando o Caio chega perto, o rosto volta.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { signalColor } from '../lib/signals'
import { VULTO_NAME } from '../lib/tokenVulto'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'VULT01'
const FOTO = 'data:image/png;base64,QUJDRA=='
const VERMELHO = '#d6452f'

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

/** Salão de 40 x 40 casas de 50 px, com rostos só de perto a 3 casas. */
function salao(caioX: number): MapData {
  const tokens = [ficha('duda', 'Guerreira', 100, 100), ficha('caio', 'Ladino', caioX, 100, { color: VERMELHO, imageData: FOTO })]
  return { ...createEmptyMap('m-salao', 'Salão', 40, 40, 50), tokens, faceRangeCells: 3 }
}

function mesaCom(source: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, tokenId: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  entra('c1', 'Duda', 'duda')
  const caio = entra('c2', 'Caio', 'caio')
  return { s, caio }
}

function fichaNoFio(r: HostResult, clientId: string, tokenId: string): Token | undefined {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error(`esperava o mapa de ${clientId}`)
  return msg.map.tokens.find((t) => t.id === tokenId)
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('fio: vulto além de N casas', () => {
  it('o Caio a 8 casas chega à Duda como Vulto, e nada do rosto dele vai no pacote', () => {
    const longe = salao(500)
    const { s, caio } = mesaCom(longe)
    const r = s.broadcast(longe)
    expect(fichaNoFio(r, 'c1', 'caio')?.name).toBe(VULTO_NAME)
    const texto = textoPara(r, 'c1')
    expect(texto).not.toContain('Ladino')
    expect(texto).not.toContain('Caio')
    expect(texto).not.toContain(signalColor(caio))
    expect(texto).not.toContain(VERMELHO)
    expect(texto).not.toContain(FOTO)
  })

  it('o próprio Caio continua recebendo a ficha dele inteira', () => {
    const longe = salao(500)
    const { s } = mesaCom(longe)
    const dele = fichaNoFio(s.broadcast(longe), 'c2', 'caio')
    expect(dele?.name).toBe('Ladino')
    expect(dele?.imageData).toBe(FOTO)
  })

  it('o Caio anda até 2 casas da Duda: o rosto volta no próximo envio', () => {
    const longe = salao(500)
    const { s, caio } = mesaCom(longe)
    s.broadcast(longe)
    const perto = salao(200)
    const daCaio = fichaNoFio(s.broadcast(perto), 'c1', 'caio')
    expect(daCaio?.name).toBe('Ladino')
    expect(daCaio?.color).toBe(VERMELHO)
    expect(daCaio?.companion).toEqual({ name: 'Caio', color: signalColor(caio) })
  })
})
