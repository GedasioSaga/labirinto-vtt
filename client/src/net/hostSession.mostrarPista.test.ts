import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { pinCardForPlayer } from '../lib/fogFilter'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

/**
 * "MOSTRAR AGORA A…" no host: o mestre entrega a pista na hora, mesmo com o
 * jogador longe do pino. Só o escolhido recebe o cartão (`pin.show`); quem
 * está na mesma sala não recebe nada. O cartão passa pelo recorte
 * (`pinCardForPlayer`): sem posição, sem destino, sem campo do mestre, e
 * imagem só em data URL. Pino de outra cena, oculto ou de viagem não sai.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const TEXTO_DA_CARTA = 'Carta rasgada: encontre-me na capela'
const TEXTO_DA_CRIPTA = 'Inscrição na lápide da cripta'
const FOTO = 'data:image/png;base64,AAAA'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

/** Carta "só de perto" (1 casa) e longe de todo mundo: sem o "Mostrar agora", ninguém leria. */
const CARTA: Pin = { id: 'carta', x: 1900, y: 450, kind: 'exclamacao', description: TEXTO_DA_CARTA, image: FOTO, lerDePerto: 1, marco: true, icon: 'chave' }
const SEGREDO: Pin = { id: 'segredo', x: 300, y: 200, kind: 'interrogacao', description: 'Só o mestre sabe', image: null, secret: true }
const ALCAPAO: Pin = { id: 'alcapao', x: 400, y: 200, kind: 'viagem', description: 'Alçapão', image: null, destino: { sceneId: CRIPTA, pinId: 'fundo' }, passagem: 'livre' }

function salao(): MapData {
  return {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    tokens: [token('ficha-gabi', 200, 200), token('ficha-diego', 250, 200)],
    pins: [CARTA, SEGREDO, ALCAPAO],
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
          tokens: [token('ficha-rui', 300, 300)],
          pins: [
            { id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo', image: null, destino: { sceneId: SALAO, pinId: 'alcapao' } },
            { id: 'lapide', x: 500, y: 250, kind: 'exclamacao', description: TEXTO_DA_CRIPTA, image: null },
          ],
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
  const gabi = welcomeOf(s.handleMessage('c-gabi', { type: 'join', code: CODE, name: 'Gabi' }, w))
  const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, w))
  const rui = welcomeOf(s.handleMessage('c-rui', { type: 'join', code: CODE, name: 'Rui' }, w))
  s.assignToken(gabi, 'ficha-gabi')
  s.assignToken(diego, 'ficha-diego')
  s.assignToken(rui, 'ficha-rui')
  s.broadcast(w)
  return { s, w, gabi, diego, rui }
}

describe('hostSession: "Mostrar agora a…"', () => {
  it('"Mostrar agora a Gabi": só Gabi recebe o cartão, com o texto e a imagem, mesmo longe do pino "só de perto"', () => {
    const { s, w, gabi } = mesa()
    const r = s.showPin(gabi, 'carta', w)
    expect(r.outbound).toHaveLength(1)
    expect(r.outbound[0]?.clientId).toBe('c-gabi')
    const msg = r.outbound[0]?.msg
    if (msg?.type !== 'pin.show') throw new Error('esperava pin.show')
    expect(msg.pin).toEqual({ id: 'carta', kind: 'exclamacao', icon: 'chave', description: TEXTO_DA_CARTA, image: FOTO })
  })

  it('Diego, na mesma sala, não recebe nada: nem o cartão, nem o texto', () => {
    const { s, w, gabi } = mesa()
    const r = s.showPin(gabi, 'carta', w)
    const paraDiego = r.outbound.filter((o) => o.clientId === 'c-diego')
    expect(paraDiego).toEqual([])
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId !== 'c-gabi'))).not.toContain(TEXTO_DA_CARTA)
  })

  it('o cartão não leva posição, destino nem regra do mestre (lerDePerto, marco)', () => {
    const { s, w, gabi } = mesa()
    const pacote = JSON.stringify(s.showPin(gabi, 'carta', w).outbound)
    expect(pacote).toContain(TEXTO_DA_CARTA)
    for (const campo of ['"x"', '"y"', 'lerDePerto', 'marco', 'destino', 'longe']) expect(pacote).not.toContain(campo)
  })

  it('pino com "Só estes": mostrar a Gabi marca Gabi em "Quem vê"; o próximo snapshot do Diego continua sem o pino', () => {
    const { s, w, gabi, diego } = mesa()
    s.setPinAudience('carta', [])
    s.showPin(gabi, 'carta', w)
    expect(s.pinAudience('carta')).toEqual([gabi])
    const r = s.broadcast(w)
    const doDiego = r.outbound.find((o) => o.clientId === 'c-diego')?.msg
    if (doDiego?.type !== 'snapshot') throw new Error('esperava snapshot do Diego')
    expect(doDiego.map.pins.map((p) => p.id)).not.toContain('carta')
    expect(s.pinAudience('carta')).not.toContain(diego)
  })

  it('pino de "Todos" continua de todos: mostrar não cria lista', () => {
    const { s, w, gabi } = mesa()
    s.showPin(gabi, 'carta', w)
    expect(s.pinAudience('carta')).toBeNull()
  })

  it('pino de OUTRA cena não sai: Rui está na Cripta e o mestre pede o pino do Salão; Gabi não recebe a lápide da Cripta', () => {
    const { s, w, gabi, rui } = mesa()
    const paraRui = s.showPin(rui, 'carta', w)
    expect(paraRui.outbound).toEqual([])
    const paraGabi = s.showPin(gabi, 'lapide', w)
    expect(paraGabi.outbound).toEqual([])
    expect(JSON.stringify(paraGabi)).not.toContain(TEXTO_DA_CRIPTA)
    // Nada disso mexe em lista nenhuma.
    expect(s.pinAudience('carta')).toBeNull()
  })

  it('pino oculto para jogadores e pino de viagem não viram cartão', () => {
    const { s, w, gabi } = mesa()
    expect(s.showPin(gabi, 'segredo', w).outbound).toEqual([])
    expect(s.showPin(gabi, 'alcapao', w).outbound).toEqual([])
    expect(s.showPin(gabi, 'inventado', w).outbound).toEqual([])
    expect(s.showPin('jogador-inventado', 'carta', w).outbound).toEqual([])
  })

  it('jogador desconectado não recebe (e não ganha lugar na lista)', () => {
    const { s, w, gabi } = mesa()
    s.setPinAudience('carta', [])
    s.disconnect('c-gabi')
    expect(s.showPin(gabi, 'carta', w).outbound).toEqual([])
    expect(s.pinAudience('carta')).toEqual([])
  })
})

describe('pinCardForPlayer', () => {
  it('lista do que vai: só id, tipo, símbolo, texto e imagem segura', () => {
    expect(pinCardForPlayer({ ...CARTA, image: 'C:/mestre/segredos/carta.png', hidden: true, locked: true })).toEqual({
      id: 'carta',
      kind: 'exclamacao',
      icon: 'chave',
      description: TEXTO_DA_CARTA,
      image: null,
    })
    expect(pinCardForPlayer({ id: 'p', x: 1, y: 2, kind: 'interrogacao', description: '', image: null })).toEqual({
      id: 'p',
      kind: 'interrogacao',
      description: '',
      image: null,
    })
  })

  it('oculto, viagem e chegada oculta: nada', () => {
    expect(pinCardForPlayer(SEGREDO)).toBeNull()
    expect(pinCardForPlayer(ALCAPAO)).toBeNull()
    expect(pinCardForPlayer({ ...ALCAPAO, soChegada: true })).toBeNull()
  })
})
