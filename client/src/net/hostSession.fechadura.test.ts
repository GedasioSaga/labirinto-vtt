import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { openPinLock } from '../lib/pinLock'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * FECHADURA COM SEGREDO pela rede. O jogador manda a tentativa (`pin.answer`);
 * o host confere contra a resposta que SÓ ELE guarda e devolve só "abriu" ou
 * "não abre". A resposta nunca sai em mensagem nenhuma. Acertou: o integrador
 * abre a fechadura (e destranca a porta ligada). O pino de viagem com
 * fechadura fechada não deixa passar.
 */

const CODE = 'FECH01'
const RESPOSTA = '9-3-8-2'
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function cofre(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'cofre',
    x: 260,
    y: 200,
    kind: 'exclamacao',
    description: 'Cofre de volantes',
    image: null,
    segredo: { resposta: RESPOSTA, forma: 'volantes', abrePorta: 'porta' },
    ...extra,
  }
}

const PORTA: Wall = { id: 'porta', x1: 400, y1: 150, x2: 400, y2: 250, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }

function salao(pins: Pin[], comHeroi = true): MapData {
  return { ...createEmptyMap('mapa-salao', 'Salão', 1000, 1000, 50), tokens: comHeroi ? [ficha('heroi', 200, 200)] : [], walls: [PORTA], pins }
}

function welcome(r: HostResult): string {
  const first = r.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function mesa(source: MapData | HostWorld, relogio: { t: number } = { t: 1_000_000 }) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.t, randomId: () => `id-${(n += 1)}` })
  const ana = welcome(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source))
  s.assignToken(ana, 'heroi')
  s.broadcast(source)
  return {
    s,
    tentar: (tentativa: string, pinId = 'cofre', src: MapData | HostWorld = source) => s.handleMessage('c1', { type: 'pin.answer', pinId, tentativa }, src),
  }
}

function resultado(r: HostResult): HostMessage | undefined {
  return r.outbound.find((o) => o.clientId === 'c1')?.msg
}

describe('protocolo: pin.answer', () => {
  it('aceita pino e tentativa curtos e devolve só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'pin.answer', pinId: 'cofre', tentativa: '9382', extra: 1 })).toEqual({ type: 'pin.answer', pinId: 'cofre', tentativa: '9382' })
  })

  it('recusa tentativa vazia, longa demais ou que não é texto', () => {
    expect(parsePlayerMessage({ type: 'pin.answer', pinId: 'cofre', tentativa: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.answer', pinId: 'cofre', tentativa: '1'.repeat(65) })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.answer', pinId: 'cofre', tentativa: 9382 })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.answer', pinId: '', tentativa: '1' })).toBeNull()
  })
})

describe('hostSession: fechadura com segredo', () => {
  it('o snapshot leva a forma da fechadura e nunca a resposta', () => {
    const map = salao([cofre()])
    const t = mesa(map)
    const snap = t.s.broadcast(map).outbound.find((o) => o.clientId === 'c1')?.msg
    if (snap?.type !== 'snapshot' && snap?.type !== 'delta') throw new Error('esperava snapshot')
    expect(snap.map.pins.find((p) => p.id === 'cofre')?.fechadura).toEqual({ forma: 'volantes', casas: 4 })
    expect(JSON.stringify(snap)).not.toContain('9382')
    expect(JSON.stringify(snap)).not.toContain(RESPOSTA)
  })

  it('tentativa errada: "não abre", nada muda no mapa, e a resposta não volta', () => {
    const t = mesa(salao([cofre()]))
    const r = t.tentar('1111')
    expect(resultado(r)).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: false })
    expect(r.applyLock).toBeUndefined()
    expect(r.lockAttempt).toEqual({ playerName: 'Ana', pinLabel: 'Cofre de volantes', tentativa: '1111', ok: false })
    expect(JSON.stringify(r.outbound)).not.toContain('9382')
  })

  it('tentativa certa (com espaços): abre, e o integrador recebe o pino a abrir', () => {
    const t = mesa(salao([cofre()]))
    const r = t.tentar('9 3 8 2')
    expect(resultado(r)).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: true })
    expect(r.applyLock).toEqual({ pinId: 'cofre' })
    expect(r.lockAttempt).toMatchObject({ playerName: 'Ana', ok: true })
  })

  it('duas tentativas no mesmo instante: a segunda é "espere", sem nem conferir', () => {
    const t = mesa(salao([cofre()]))
    t.tentar('1111')
    const r = t.tentar('9382')
    expect(resultado(r)).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: false, reason: 'too_soon' })
    expect(r.applyLock).toBeUndefined()
    expect(r.lockAttempt).toBeUndefined()
  })

  it('depois do intervalo, tenta de novo', () => {
    const relogio = { t: 1_000_000 }
    const t = mesa(salao([cofre()]), relogio)
    t.tentar('1111')
    relogio.t += 5_000
    expect(t.tentar('9382').applyLock).toEqual({ pinId: 'cofre' })
  })

  it('pino fora do recorte (secreto) não abre nem com a resposta certa, e a recusa é a genérica', () => {
    const t = mesa(salao([cofre({ secret: true })]))
    const r = t.tentar('9382')
    expect(resultado(r)).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: false })
    expect(r.applyLock).toBeUndefined()
    expect(r.lockAttempt).toBeUndefined()
  })

  it('pino sem fechadura, ou já aberta, não "abre" de novo', () => {
    const semFechadura = mesa(salao([cofre({ segredo: undefined })]))
    expect(semFechadura.tentar('9382').applyLock).toBeUndefined()
    const aberta = mesa(salao([cofre({ segredo: { resposta: RESPOSTA, forma: 'volantes', aberta: true } })]))
    const r = aberta.tentar('9382')
    expect(r.applyLock).toBeUndefined()
    expect(resultado(r)).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: false })
  })

  it('pino de viagem com fechadura fechada não deixa passar; aberta, o pedido chega ao mestre', () => {
    const grade: Pin = {
      id: 'grade',
      x: 260,
      y: 200,
      kind: 'viagem',
      description: 'Grade de segredo',
      image: null,
      destino: { sceneId: CRIPTA, pinId: 'volta' },
      segredo: { resposta: '12', forma: 'teclado' },
    }
    const cripta: MapData = {
      ...createEmptyMap('mapa-cripta', 'Cripta', 1000, 1000, 50),
      pins: [{ id: 'volta', x: 500, y: 500, kind: 'viagem', description: '', image: null, destino: { sceneId: SALAO, pinId: 'grade' } }],
    }
    const fechada: HostWorld = { open: { sceneId: SALAO, name: 'Salão', map: salao([grade]) }, background: [{ sceneId: CRIPTA, name: 'Cripta', map: cripta }] }
    const relogio = { t: 1_000_000 }
    const t = mesa(fechada, relogio)
    const recusa = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade' }, fechada)
    expect(recusa.outbound[0]?.msg).toEqual({ type: 'pin.travel.rejected', reason: 'unavailable' })
    expect(recusa.travelRequest).toBeUndefined()

    const abriu = t.tentar('12', 'grade', fechada)
    expect(abriu.applyLock).toEqual({ pinId: 'grade' })
    // O integrador aplica a abertura no mapa do mestre; passado o intervalo entre pedidos, a grade deixa passar.
    const aberta: HostWorld = { ...fechada, open: { ...fechada.open, map: openPinLock(fechada.open.map, 'grade') } }
    relogio.t += 10_000
    expect(t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade' }, aberta).travelRequest).toMatchObject({ toSceneId: CRIPTA })
  })

  it('passagem "trancada" com segredo: acertar a combinação abre a passagem, como o cartão prometeu', () => {
    const grade: Pin = {
      id: 'grade',
      x: 260,
      y: 200,
      kind: 'viagem',
      description: 'Grade trancada com segredo',
      image: null,
      passagem: 'trancada',
      destino: { sceneId: CRIPTA, pinId: 'volta' },
      segredo: { resposta: '12', forma: 'teclado' },
    }
    const cripta: MapData = {
      ...createEmptyMap('mapa-cripta', 'Cripta', 1000, 1000, 50),
      pins: [{ id: 'volta', x: 500, y: 500, kind: 'viagem', description: '', image: null, destino: { sceneId: SALAO, pinId: 'grade' } }],
    }
    const fechada: HostWorld = { open: { sceneId: SALAO, name: 'Salão', map: salao([grade]) }, background: [{ sceneId: CRIPTA, name: 'Cripta', map: cripta }] }
    const relogio = { t: 1_000_000 }
    const t = mesa(fechada, relogio)
    expect(t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade' }, fechada).outbound[0]?.msg).toEqual({ type: 'pin.travel.rejected', reason: 'unavailable' })

    const abriu = t.tentar('12', 'grade', fechada)
    expect(abriu.applyLock).toEqual({ pinId: 'grade' })
    const aberta: HostWorld = { ...fechada, open: { ...fechada.open, map: openPinLock(fechada.open.map, 'grade') } }
    // O recorte do jogador já não diz "trancada": o cartão oferece o pedido.
    const snap = t.s.broadcast(aberta).outbound.find((o) => o.clientId === 'c1')?.msg
    if (snap?.type !== 'snapshot' && snap?.type !== 'delta') throw new Error('esperava snapshot')
    const noRecorte = snap.map.pins.find((p) => p.id === 'grade')
    expect(noRecorte?.passagem).toBe('pede')
    expect(noRecorte?.fechadura).toBeUndefined()
    relogio.t += 10_000
    expect(t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade' }, aberta).travelRequest).toMatchObject({ toSceneId: CRIPTA })
  })

  it('o snapshot de uma fechadura de teclado não leva o tamanho da senha', () => {
    const map = salao([cofre({ segredo: { resposta: 'labirinto', forma: 'teclado' } })])
    const t = mesa(map)
    const snap = t.s.broadcast(map).outbound.find((o) => o.clientId === 'c1')?.msg
    if (snap?.type !== 'snapshot' && snap?.type !== 'delta') throw new Error('esperava snapshot')
    expect(snap.map.pins.find((p) => p.id === 'cofre')?.fechadura).toStrictEqual({ forma: 'teclado' })
    expect(JSON.stringify(snap)).not.toContain('casas')
  })

  it('na cena de fundo, o pino a abrir leva a cena junto', () => {
    const fundo = salao([cofre()])
    const mundo: HostWorld = { open: { sceneId: CRIPTA, name: 'Cripta', map: createEmptyMap('mapa-cripta', 'Cripta', 500, 500, 50) }, background: [{ sceneId: SALAO, name: 'Salão', map: fundo }] }
    const t = mesa(mundo)
    expect(t.tentar('9382').applyLock).toEqual({ pinId: 'cofre', sceneId: SALAO })
  })
})
