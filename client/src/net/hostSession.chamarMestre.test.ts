/**
 * CHAMAR O MESTRE: a mão levantada com motivo e texto curto, em fila.
 *
 * O que interessa aqui é o recorte: o chamado, o "Visto" e a resposta vão SÓ
 * a quem chamou. Outro jogador não recebe nem o frame, e nada disto leva
 * nome nem id de cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { CALL_TEXT_MAX_LENGTH, parsePlayerMessage } from './protocol'
import { CALL_MIN_INTERVAL_MS, createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const SALAO: HostScene = { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 120), ficha('corda', 300, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 150)]) }

/** Salão (aberto no editor) com Duda e Carla; Cripta (de fundo) com Bruno. */
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa() {
  let n = 0
  const relogio = { agora: 10_000 }
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.agora, randomId: () => `id-${(n += 1)}` })
  const duda = entra(s, 'c-duda', 'Duda')
  const carla = entra(s, 'c-carla', 'Carla')
  const bruno = entra(s, 'c-bruno', 'Bruno')
  s.assignToken(duda, 'lanterna')
  s.assignToken(carla, 'corda')
  s.assignToken(bruno, 'machado')
  return { s, relogio, duda, carla, bruno }
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

/**
 * O que vai a `clientId` sem a MARCA DE COMPANHEIRO das fichas do snapshot:
 * a marca põe, de propósito, o nome do jogador na ficha dele que o colega já
 * vê — não é o chamado. O resto (chamado, visto, resposta) não pode ter o nome.
 */
function paraSemMarcaDeCompanheiro(r: HostResult, clientId: string): string {
  return JSON.stringify(
    r.outbound
      .filter((o) => o.clientId === clientId)
      .map((o) => (o.msg.type === 'snapshot' ? { ...o.msg, map: { ...o.msg.map, tokens: o.msg.map.tokens.map(({ companion: _marca, ...t }) => t) } } : o.msg)),
  )
}

function levanta(s: ReturnType<typeof createHostSession>, clientId: string, reason: string, text?: string): HostResult {
  return s.handleMessage(clientId, text === undefined ? { type: 'call.raise', reason } : { type: 'call.raise', reason, text }, mundo)
}

describe('call.raise no protocolo', () => {
  it('aceita os cinco motivos, com ou sem texto; texto em branco vira sem texto', () => {
    for (const reason of ['ajuda', 'agir', 'pergunta', 'sair', 'urgente']) {
      expect(parsePlayerMessage({ type: 'call.raise', reason })).toEqual({ type: 'call.raise', reason })
    }
    expect(parsePlayerMessage({ type: 'call.raise', reason: 'pergunta', text: '  posso usar a corda?  ' })).toEqual({
      type: 'call.raise',
      reason: 'pergunta',
      text: 'posso usar a corda?',
    })
    expect(parsePlayerMessage({ type: 'call.raise', reason: 'ajuda', text: '   ' })).toEqual({ type: 'call.raise', reason: 'ajuda' })
    expect(parsePlayerMessage({ type: 'call.lower' })).toEqual({ type: 'call.lower' })
  })

  it('recusa motivo inventado, texto acima de 140 e texto que não é texto', () => {
    expect(parsePlayerMessage({ type: 'call.raise', reason: 'festa' })).toBeNull()
    expect(parsePlayerMessage({ type: 'call.raise' })).toBeNull()
    expect(parsePlayerMessage({ type: 'call.raise', reason: 'ajuda', text: 'x'.repeat(CALL_TEXT_MAX_LENGTH + 1) })).toBeNull()
    expect(parsePlayerMessage({ type: 'call.raise', reason: 'ajuda', text: 'x'.repeat(CALL_TEXT_MAX_LENGTH) })).not.toBeNull()
    expect(parsePlayerMessage({ type: 'call.raise', reason: 'ajuda', text: 42 })).toBeNull()
  })
})

describe('chamar o mestre na sessão', () => {
  it('Duda "Quero agir": ela recebe "esperando", o mestre recebe o chamado, e mais ninguém recebe nada', () => {
    const { s, duda } = mesa()
    const r = levanta(s, 'c-duda', 'agir')
    expect(r.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'call.state', state: 'waiting', reason: 'agir' } }])
    expect(r.call).toEqual({ callId: expect.any(String), playerId: duda, playerName: 'Duda', reason: 'agir' })
    expect(s.listCalls().map((c) => c.playerName)).toEqual(['Duda'])
  })

  it('fila por ordem de chegada, e Urgente vai para o topo', () => {
    const { s, relogio } = mesa()
    levanta(s, 'c-duda', 'agir')
    relogio.agora += 10
    levanta(s, 'c-carla', 'pergunta', 'posso usar a corda?')
    expect(s.listCalls().map((c) => [c.playerName, c.reason, c.text])).toEqual([
      ['Duda', 'agir', undefined],
      ['Carla', 'pergunta', 'posso usar a corda?'],
    ])
    relogio.agora += 10
    levanta(s, 'c-bruno', 'urgente', 'estou morrendo')
    expect(s.listCalls().map((c) => c.playerName)).toEqual(['Bruno', 'Duda', 'Carla'])
  })

  it('5 toques não empilham: um chamado só, um aviso só ao mestre, e o jogador continua "esperando"', () => {
    const { s, relogio } = mesa()
    const primeiro = levanta(s, 'c-duda', 'agir')
    expect(primeiro.call).toBeDefined()
    for (let i = 0; i < 4; i += 1) {
      relogio.agora += 1
      const r = levanta(s, 'c-duda', 'urgente')
      expect(r.call).toBeUndefined()
      // Continua esperando pelo MESMO chamado, com o motivo de antes.
      expect(r.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'call.state', state: 'waiting', reason: 'agir' } }])
    }
    expect(s.listCalls()).toHaveLength(1)
  })

  it('baixar e levantar de novo antes do intervalo não vira chamado novo', () => {
    const { s, relogio } = mesa()
    levanta(s, 'c-duda', 'agir')
    s.handleMessage('c-duda', { type: 'call.lower' }, mundo)
    expect(s.listCalls()).toEqual([])
    relogio.agora += CALL_MIN_INTERVAL_MS - 1
    const cedo = levanta(s, 'c-duda', 'agir')
    expect(cedo.call).toBeUndefined()
    expect(cedo.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'call.state', state: 'too_soon' } }])
    expect(s.listCalls()).toEqual([])
    relogio.agora += 1
    expect(levanta(s, 'c-duda', 'agir').call).toBeDefined()
  })

  it('"Visto" apaga a mão SÓ de quem chamou', () => {
    const { s, relogio } = mesa()
    const chamado = levanta(s, 'c-duda', 'agir').call
    relogio.agora += 10
    levanta(s, 'c-carla', 'pergunta')
    if (chamado === undefined) throw new Error('esperava chamado')
    const r = s.seeCall(chamado.callId)
    expect(r.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'call.state', state: 'seen' } }])
    expect(s.isCallOpen(chamado.callId)).toBe(false)
    expect(s.listCalls().map((c) => c.playerName)).toEqual(['Carla'])
    // Visto de novo (duplo clique): nada.
    expect(s.seeCall(chamado.callId)).toEqual({ outbound: [] })
  })

  it('"Responder" chega só a Carla, com o texto, e fecha o chamado dela', () => {
    const { s, relogio } = mesa()
    levanta(s, 'c-duda', 'agir')
    relogio.agora += 10
    const chamado = levanta(s, 'c-carla', 'pergunta', 'posso usar a corda?').call
    if (chamado === undefined) throw new Error('esperava chamado')
    const r = s.replyCall(chamado.callId, '  Pode, mas faça um teste de Força.  ')
    expect(r.outbound).toEqual([{ clientId: 'c-carla', msg: { type: 'call.reply', id: expect.any(String), text: 'Pode, mas faça um teste de Força.' } }])
    expect(para(r, 'c-duda')).toBe('[]')
    expect(para(r, 'c-bruno')).toBe('[]')
    expect(s.isCallOpen(chamado.callId)).toBe(false)
    expect(s.listCalls().map((c) => c.playerName)).toEqual(['Duda'])
  })

  it('resposta em branco não sai e o chamado continua aberto', () => {
    const { s } = mesa()
    const chamado = levanta(s, 'c-carla', 'pergunta').call
    if (chamado === undefined) throw new Error('esperava chamado')
    expect(s.replyCall(chamado.callId, '   ')).toEqual({ outbound: [] })
    expect(s.isCallOpen(chamado.callId)).toBe(true)
  })

  it('o texto do chamado nunca vai a outro jogador, nem no snapshot, nem no chamado dos outros', () => {
    const { s, relogio } = mesa()
    const segredo = 'vou trair o grupo'
    const todas: HostResult[] = [levanta(s, 'c-duda', 'agir', segredo)]
    relogio.agora += 10
    todas.push(levanta(s, 'c-carla', 'pergunta'))
    todas.push(s.broadcast(mundo))
    const chamados = s.listCalls()
    for (const c of chamados) if (c.playerName === 'Carla') todas.push(s.seeCall(c.callId))
    for (const r of todas) {
      expect(para(r, 'c-carla')).not.toContain(segredo)
      expect(para(r, 'c-bruno')).not.toContain(segredo)
      // Nem o nome de quem chamou vai aos outros (fora a marca de companheiro na ficha dela que a Carla vê).
      expect(paraSemMarcaDeCompanheiro(r, 'c-carla')).not.toContain('Duda')
      expect(paraSemMarcaDeCompanheiro(r, 'c-bruno')).not.toContain('Duda')
      for (const o of r.outbound) {
        if (o.clientId === 'c-duda' || o.msg.type !== 'snapshot') continue
        for (const t of o.msg.map.tokens) if (t.companion?.name === 'Duda') expect(t.id).toBe('lanterna')
      }
    }
  })

  it('nada do chamado leva nome nem id de cena ao jogador', () => {
    const { s } = mesa()
    const r1 = levanta(s, 'c-bruno', 'ajuda')
    const chamado = r1.call
    if (chamado === undefined) throw new Error('esperava chamado')
    const r2 = s.replyCall(chamado.callId, 'já vou')
    for (const r of [r1, r2]) {
      const texto = para(r, 'c-bruno')
      expect(texto).not.toContain('Cripta')
      expect(texto).not.toContain('s-cripta')
      expect(texto).not.toContain('sceneId')
    }
  })

  it('"Ir lá": a cena e a ficha de quem chamou, para o mestre (de fundo também)', () => {
    const { s } = mesa()
    const chamado = levanta(s, 'c-bruno', 'ajuda').call
    if (chamado === undefined) throw new Error('esperava chamado')
    expect(s.callTarget(chamado.callId, mundo)).toEqual({ sceneId: 's-cripta', x: 200, y: 150 })
    expect(s.callTarget('nao-existe', mundo)).toBeNull()
  })

  it('quem cai ou é expulso leva o chamado junto', () => {
    const { s, relogio } = mesa()
    const daDuda = levanta(s, 'c-duda', 'agir').call
    relogio.agora += 10
    const daCarla = levanta(s, 'c-carla', 'pergunta').call
    if (daDuda === undefined || daCarla === undefined) throw new Error('esperava chamados')
    s.disconnect('c-duda')
    expect(s.isCallOpen(daDuda.callId)).toBe(false)
    s.kick('c-carla')
    expect(s.isCallOpen(daCarla.callId)).toBe(false)
    expect(s.listCalls()).toEqual([])
  })

  it('quem não entrou na sala não chama', () => {
    const { s } = mesa()
    const r = s.handleMessage('c-estranho', { type: 'call.raise', reason: 'urgente' }, mundo)
    expect(r.outbound).toEqual([{ clientId: 'c-estranho', msg: { type: 'error', reason: 'not_joined' } }])
    expect(s.listCalls()).toEqual([])
  })
})
