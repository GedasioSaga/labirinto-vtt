/**
 * MINIGAME DE PESCA na sessão do mestre. "Mestre chama": o mestre chama Ana
 * e Bruno, e só eles recebem o convite. "Jogador toca no pino": o pedido só
 * vale de quem vê o pino e tem uma ficha encostada (a regra do item no chão),
 * e o convite volta só para ele. Pino de dança ou de "Mestre chama" não aceita
 * pedido. Pausar e encerrar valem para todos do pino; quem cai pescando sai.
 */
import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { minigamePadraoDo } from '../lib/pins'
import { MINIGAME_PESCA_PADRAO, type MinigamePesca } from '../minigames/pesca/tipos'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const PINO = 'pino-pesca'

/** Ana encostada no pino (50 px, uma casa); Bruno longe (uns 220 px); Caio também longe. */
const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null })

function pinoDePesca(extra: Partial<MinigamePesca> = {}, pin: Partial<Pin> = {}): Pin {
  return { ...buildPin(PINO, { x: 300, y: 300 }, 'minigame'), minigame: { ...MINIGAME_PESCA_PADRAO, ...extra }, ...pin }
}

function mundo(pins: Pin[]): HostWorld {
  const map: MapData = {
    ...createEmptyMap('m-lago', 'Lago', 1000, 1000, 50),
    pins: [...pins, buildPin('pino-nota', { x: 100, y: 100 }, 'exclamacao')],
    tokens: [ficha('t-ana', 300, 250), ficha('t-bruno', 100, 200), ficha('t-caio', 120, 220)],
  }
  return { open: { sceneId: 's-lago', name: 'Lago', map }, background: [] }
}

function mesa(pins: Pin[] = [pinoDePesca()]) {
  let n = 0
  const world = mundo(pins)
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, tokenId: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const ana = entra('c-ana', 'Ana', 't-ana')
  const bruno = entra('c-bruno', 'Bruno', 't-bruno')
  const caio = entra('c-caio', 'Caio', 't-caio')
  const inicio = s.broadcast(world)
  const de = (clientId: string, msg: Record<string, unknown>): HostResult => s.handleMessage(clientId, msg, world)
  return { s, world, ana, bruno, caio, de, inicio }
}

const para = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
const tipos = (r: HostResult, clientId: string) => para(r, clientId).map((m) => m.type)

function sessaoDe(r: { convite: { ok: true; sessao: string } | { ok: false } }): string {
  if (!r.convite.ok) throw new Error('o convite devia ter saído')
  return r.convite.sessao
}

describe('pesca na sessão: mestre chama', () => {
  it('só os escolhidos recebem o convite, e o Pronto pela rede põe na água', () => {
    const { s, world, ana, bruno, de } = mesa()
    const r = s.convidarParaPesca(PINO, [ana, bruno], world)
    const sessao = sessaoDe(r)
    expect(tipos(r, 'c-ana')).toEqual(['pesca.convite', 'pesca.estado'])
    expect(tipos(r, 'c-bruno')).toEqual(['pesca.convite', 'pesca.estado'])
    expect(tipos(r, 'c-caio')).toEqual([])
    expect(para(r, 'c-ana')[0]).toMatchObject({ pinId: PINO, npc: 'Bento, o barqueiro', lances: 3 })
    const pronto = de('c-ana', { type: 'pesca.pronto', sessao, dificuldade: 'extremo' })
    expect(tipos(pronto, 'c-bruno')).toEqual(['pesca.estado'])
    de('c-ana', { type: 'pesca.lance', sessao, lance: 1, resultado: 'pegou', peixe: { peixe: 'lume', cm: 12, estrelas: 1, perfeito: false, bau: false } })
    expect(s.pesca()[0].participantes[0]).toMatchObject({ nome: 'Ana', status: 'pescando', dificuldade: 'extremo', cesto: [{ peixe: 'lume', cm: 12 }] })
  })

  it('pino que não é de pesca (dança, "!", inexistente): recusado, sem mensagem', () => {
    const danca: Pin = { ...buildPin('pino-danca', { x: 600, y: 600 }, 'minigame'), minigame: minigamePadraoDo('danca') }
    const { s, world, ana } = mesa([pinoDePesca(), danca])
    expect(s.convidarParaPesca('pino-danca', [ana], world)).toEqual({ outbound: [], convite: { ok: false, motivo: 'pino' } })
    expect(s.convidarParaPesca('pino-nota', [ana], world).convite).toEqual({ ok: false, motivo: 'pino' })
    expect(s.convidarParaPesca('nao-existe', [ana], world).convite).toEqual({ ok: false, motivo: 'pino' })
    expect(s.convidarParaPesca(PINO, ['inventado'], world).convite).toEqual({ ok: false, motivo: 'ninguem' })
    // E o pino de pesca não chama para dançar.
    expect(s.convidarParaDanca(PINO, [ana], world).convite).toEqual({ ok: false, motivo: 'pino' })
  })

  it('pausar, retomar e encerrar valem para todos do pino', () => {
    const { s, world, ana, bruno } = mesa()
    const sessao = sessaoDe(s.convidarParaPesca(PINO, [ana, bruno], world))
    expect(s.retomarPesca(PINO)).toEqual({ outbound: [], ok: false })
    const pausa = s.pausarPesca(PINO)
    expect(pausa.ok).toBe(true)
    expect(tipos(pausa, 'c-ana')).toEqual(['pesca.pausa'])
    expect(tipos(pausa, 'c-bruno')).toEqual(['pesca.pausa'])
    expect(s.retomarPesca(PINO).ok).toBe(true)
    const fim = s.encerrarPesca(PINO)
    expect(para(fim, 'c-bruno')).toEqual([{ type: 'pesca.encerra', sessao, motivo: 'mestre' }])
    expect(s.encerrarPesca(PINO).ok).toBe(false)
  })

  it('quem cai pescando sai; os colegas leem o estado novo', () => {
    const { s, world, ana, bruno, de } = mesa()
    const sessao = sessaoDe(s.convidarParaPesca(PINO, [ana, bruno], world))
    de('c-ana', { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    const r = s.disconnect('c-ana')
    expect(tipos(r, 'c-bruno')).toEqual(['pesca.estado'])
    expect(s.pesca()[0].participantes.map((p) => [p.nome, p.status])).toEqual([
      ['Ana', 'saiu'],
      ['Bruno', 'convidado'],
    ])
  })
})

describe('pesca na sessão: jogador toca no pino', () => {
  it('de perto: o convite volta só para quem pediu', () => {
    const { s, de } = mesa([pinoDePesca({ entrada: 'pino' })])
    const r = de('c-ana', { type: 'pesca.pedir', pinId: PINO })
    expect(tipos(r, 'c-ana')).toEqual(['pesca.convite', 'pesca.estado'])
    expect(tipos(r, 'c-bruno')).toEqual([])
    expect(s.pesca()[0]).toMatchObject({ pinId: PINO, entrada: 'pino', participantes: [{ nome: 'Ana', status: 'convidado' }] })
  })

  it('longe do pino: recusado com o motivo, só para quem pediu (a mesma distância do item no chão)', () => {
    const { s, de } = mesa([pinoDePesca({ entrada: 'pino' })])
    const r = de('c-bruno', { type: 'pesca.pedir', pinId: PINO })
    expect(r.outbound).toEqual([{ clientId: 'c-bruno', msg: { type: 'pesca.recusado', pinId: PINO, motivo: 'longe' } }])
    expect(s.pesca()).toEqual([])
  })

  it('pino de "Mestre chama", pino de dança e pino oculto: recusados como indisponível, sem sessão', () => {
    const indisponivel = [{ clientId: 'c-ana', msg: { type: 'pesca.recusado', pinId: PINO, motivo: 'indisponivel' } }]
    const mestre = mesa([pinoDePesca({ entrada: 'mestre' })])
    expect(mestre.de('c-ana', { type: 'pesca.pedir', pinId: PINO }).outbound).toEqual(indisponivel)
    expect(mestre.s.pesca()).toEqual([])

    const danca = mesa([{ ...buildPin(PINO, { x: 300, y: 300 }, 'minigame'), minigame: minigamePadraoDo('danca') }])
    expect(danca.de('c-ana', { type: 'pesca.pedir', pinId: PINO }).outbound).toEqual(indisponivel)

    const oculto = mesa([pinoDePesca({ entrada: 'pino' }, { secret: true })])
    expect(oculto.de('c-ana', { type: 'pesca.pedir', pinId: PINO }).outbound).toEqual(indisponivel)
    expect(oculto.s.pesca()).toEqual([])
  })

  it('pedir de novo já pescando: recusado como ocupado', () => {
    const { de } = mesa([pinoDePesca({ entrada: 'pino' })])
    de('c-ana', { type: 'pesca.pedir', pinId: PINO })
    expect(de('c-ana', { type: 'pesca.pedir', pinId: PINO }).outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'pesca.recusado', pinId: PINO, motivo: 'ocupado' } }])
  })

  it('o recorte do jogador diz o modo do pino, e nada do desafio', () => {
    const { inicio } = mesa([pinoDePesca({ entrada: 'pino' })])
    const snapshot = inicio.outbound.find((o) => o.clientId === 'c-ana' && o.msg.type === 'snapshot')?.msg
    if (snapshot?.type !== 'snapshot') throw new Error('esperava o snapshot da Ana')
    const pino = snapshot.map.pins.find((p) => p.id === PINO)
    expect(pino?.minigameVisivel).toEqual({ jogo: 'pesca', entrada: 'pino' })
    expect(JSON.stringify(snapshot)).not.toContain('Bento')
  })
})
