/**
 * CORREIO DE BILHETES: o jogador escreve a um colega, o bilhete espera o
 * mestre (carteiro) e só chega a quem ele entregar. O que o host guarda do
 * bilhete — de onde saiu, para onde vai, se foi interceptado — nunca sai dele:
 * o destinatário lê nome, meio, texto e hora; o remetente, só que o bilhete saiu.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { LETTER_PENDING_MAX_PER_PLAYER, LETTER_SEND_MIN_INTERVAL_MS, LETTER_TEXT_MAX_LENGTH } from '../lib/correio'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { NotebookMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const SALAO: HostScene = { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }

/** Salão (aberto no editor) com a ficha de Ana; Cripta (de fundo) com a de Bruno. */
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

/** Ana (c1, Salão), Bruno (c2, Cripta) e Caio (c3, aguardando sem ficha). O relógio anda pelo `relogio.agora`. */
function mesa() {
  let n = 0
  const relogio = { agora: 0 }
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.agora, randomId: () => `id-${(n += 1)}` })
  const tokens = new Map<string, string>()
  const entra = (clientId: string, name: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    tokens.set(name, welcome.resumeToken)
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  entra('c3', 'Caio')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  // O primeiro snapshot põe cada um na cena dele.
  s.broadcast(mundo)
  const resume = (name: string): string => {
    const token = tokens.get(name)
    if (token === undefined) throw new Error(`sem resume de ${name}`)
    return token
  }
  return { s, relogio, resume }
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

const BILHETE = 'Te espero no poço à meia-noite.'

function manda(s: ReturnType<typeof createHostSession>, clientId: string, to: string, text = BILHETE): HostResult {
  return s.handleMessage(clientId, { type: 'letter.send', to, via: 'pombo', text }, mundo)
}

function idDoBilhete(r: HostResult): string {
  const letter = r.letter
  if (letter === undefined) throw new Error('o bilhete deveria esperar o mestre')
  return letter.letterId
}

/** O caderno que saiu para `clientId` neste resultado. */
function cadernoDe(r: HostResult, clientId: string): NotebookMessage {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'notes.book')?.msg
  if (msg?.type !== 'notes.book') throw new Error('esperava o caderno')
  return msg
}

describe('correio: lista de colegas', () => {
  it('traz os nomes de todos na sala, menos quem pede, e nada da cena de ninguém', () => {
    const { s } = mesa()
    const r = s.handleMessage('c1', { type: 'letter.peers' }, mundo)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'letter.peers', names: ['Bruno', 'Caio'] } }])
    const texto = JSON.stringify(r)
    expect(texto).not.toContain('s-cripta')
    expect(texto).not.toContain('Cripta Rubra')
    expect(texto).not.toContain('sceneId')
  })

  it('quem aguarda sem ficha não escreve: a lista vem vazia', () => {
    const { s } = mesa()
    expect(s.handleMessage('c3', { type: 'letter.peers' }, mundo).outbound).toEqual([{ clientId: 'c3', msg: { type: 'letter.peers', names: [] } }])
  })
})

describe('correio: o bilhete espera o mestre', () => {
  it('sai do remetente com "ok", vira pedido do mestre e não chega a ninguém antes da entrega', () => {
    const { s } = mesa()
    const r = manda(s, 'c1', 'Bruno')
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'letter.send.result', to: 'Bruno', ok: true } }])
    expect(r.letter).toEqual({ letterId: expect.any(String), fromName: 'Ana', toName: 'Bruno', via: 'pombo', text: BILHETE })
    expect(s.isLetterPending(idDoBilhete(r))).toBe(true)
    // Nem o destinatário, nem o snapshot de ninguém, carregam o bilhete em trânsito.
    expect(para(r, 'c2')).toBe('[]')
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain(BILHETE)
  })

  it('Entregar: só o destinatário recebe, com nome, meio e texto, e nada da cena de quem escreveu', () => {
    const { s } = mesa()
    const id = idDoBilhete(manda(s, 'c1', 'Bruno'))
    const entrega = s.deliverLetter(id)
    expect(entrega.outbound).toEqual([
      { clientId: 'c2', msg: { type: 'scene.note', id: expect.any(String), text: BILHETE, at: 0, from: 'Ana', via: 'pombo' } },
    ])
    const texto = JSON.stringify(entrega)
    expect(texto).not.toContain('s-salao')
    expect(texto).not.toContain('Salao Norte')
    expect(texto).not.toContain('lanterna')
    expect(s.isLetterPending(id)).toBe(false)
    // Entregar de novo não duplica.
    expect(s.deliverLetter(id)).toEqual({ outbound: [] })
  })

  it('o bilhete entregue fica no caderno de quem recebe e volta com ele depois de cair', () => {
    const { s, resume } = mesa()
    s.deliverLetter(idDoBilhete(manda(s, 'c1', 'Bruno')))
    s.disconnect('c2')
    const volta = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Bruno', resume: resume('Bruno') }, mundo)
    const caderno = volta.outbound.find((o) => o.msg.type === 'notes.book')?.msg
    expect(caderno).toEqual({ type: 'notes.book', notes: [{ id: expect.any(String), text: BILHETE, at: 0, from: 'Ana', via: 'pombo' }] })
  })

  it('quem aguarda sem ficha recebe o bilhete pelo caderno, marcado como não lido, não pelo cartão', () => {
    const { s } = mesa()
    const entrega = s.deliverLetter(idDoBilhete(manda(s, 'c1', 'Caio')))
    const caderno = cadernoDe(entrega, 'c3')
    expect(entrega.outbound).toEqual([
      { clientId: 'c3', msg: { type: 'notes.book', notes: [expect.objectContaining({ text: BILHETE, from: 'Ana' })], unread: [caderno.notes[0]?.id] } },
    ])
  })

  it('destinatário fora do ar: nada sai agora, e na volta o bilhete vem no caderno marcado como não lido, uma vez', () => {
    const { s, resume } = mesa()
    const id = idDoBilhete(manda(s, 'c1', 'Bruno'))
    s.disconnect('c2')
    expect(s.deliverLetter(id)).toEqual({ outbound: [] })
    const volta = cadernoDe(s.handleMessage('c9', { type: 'join', code: CODE, name: 'Bruno', resume: resume('Bruno') }, mundo), 'c9')
    const noteId = volta.notes[0]?.id
    expect(volta).toEqual({ type: 'notes.book', notes: [{ id: expect.any(String), text: BILHETE, at: 0, from: 'Ana', via: 'pombo' }], unread: [noteId] })
    // Já avisado: a próxima volta traz o caderno como história.
    s.disconnect('c9')
    const outraVolta = cadernoDe(s.handleMessage('c10', { type: 'join', code: CODE, name: 'Bruno', resume: resume('Bruno') }, mundo), 'c10')
    expect(outraVolta).toEqual({ type: 'notes.book', notes: [{ id: noteId, text: BILHETE, at: 0, from: 'Ana', via: 'pombo' }] })
  })

  it('aguardando e fora do ar: na volta o bilhete também vem marcado como não lido', () => {
    const { s, resume } = mesa()
    const id = idDoBilhete(manda(s, 'c1', 'Caio'))
    s.disconnect('c3')
    expect(s.deliverLetter(id)).toEqual({ outbound: [] })
    const volta = cadernoDe(s.handleMessage('c9', { type: 'join', code: CODE, name: 'Caio', resume: resume('Caio') }, mundo), 'c9')
    expect(volta.notes.map((entry) => entry.text)).toEqual([BILHETE])
    expect(volta.unread).toEqual([volta.notes[0]?.id])
  })

  it('Interceptar: o bilhete nunca chega, nem na volta de quem ia receber', () => {
    const { s, resume } = mesa()
    const id = idDoBilhete(manda(s, 'c1', 'Bruno'))
    expect(s.interceptLetter(id)).toEqual({ outbound: [] })
    expect(s.isLetterPending(id)).toBe(false)
    expect(s.deliverLetter(id)).toEqual({ outbound: [] })
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain(BILHETE)
    s.disconnect('c2')
    const volta = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Bruno', resume: resume('Bruno') }, mundo)
    expect(JSON.stringify(volta.outbound)).not.toContain(BILHETE)
  })

  it('destinatário expulso: o bilhete para ele morre', () => {
    const { s } = mesa()
    const id = idDoBilhete(manda(s, 'c1', 'Bruno'))
    s.kick('c2')
    expect(s.isLetterPending(id)).toBe(false)
    expect(s.deliverLetter(id)).toEqual({ outbound: [] })
  })
})

describe('correio: recusas', () => {
  it('para si mesmo, para nome que não está na sala, e de quem aguarda sem ficha: "não saiu", sem pedido ao mestre', () => {
    const { s } = mesa()
    for (const [clientId, to] of [
      ['c1', 'Ana'],
      ['c1', 'Zé'],
      ['c3', 'Ana'],
    ] as const) {
      const r = manda(s, clientId, to)
      expect(r.letter).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId, msg: { type: 'letter.send.result', to, ok: false } }])
    }
  })

  it('texto vazio ou acima do teto nem chega a ser bilhete', () => {
    const { s } = mesa()
    expect(manda(s, 'c1', 'Bruno', '   ').outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } }])
    expect(manda(s, 'c1', 'Bruno', 'x'.repeat(LETTER_TEXT_MAX_LENGTH + 1)).letter).toBeUndefined()
    expect(manda(s, 'c1', 'Bruno', 'x'.repeat(LETTER_TEXT_MAX_LENGTH)).letter?.text.length).toBe(LETTER_TEXT_MAX_LENGTH)
  })

  it('dois bilhetes seguidos: o segundo espera o intervalo; acima do teto de pendentes, "cheio"', () => {
    const { s, relogio } = mesa()
    expect(manda(s, 'c1', 'Bruno').letter).toBeDefined()
    const cedo = manda(s, 'c1', 'Bruno')
    expect(cedo.letter).toBeUndefined()
    expect(cedo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'letter.send.result', to: 'Bruno', ok: false, reason: 'too_soon' } }])
    for (let i = 1; i < LETTER_PENDING_MAX_PER_PLAYER; i += 1) {
      relogio.agora += LETTER_SEND_MIN_INTERVAL_MS
      expect(manda(s, 'c1', 'Bruno').letter).toBeDefined()
    }
    relogio.agora += LETTER_SEND_MIN_INTERVAL_MS
    const cheio = manda(s, 'c1', 'Bruno')
    expect(cheio.letter).toBeUndefined()
    expect(cheio.outbound).toEqual([{ clientId: 'c1', msg: { type: 'letter.send.result', to: 'Bruno', ok: false, reason: 'full' } }])
  })
})
