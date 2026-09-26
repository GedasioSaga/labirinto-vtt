/**
 * NPC EMPRESTADO, lado da SESSÃO: o mestre dá ao Gui a ficha de um NPC dele
 * (`npc: true`) pelo "Atribuir" de sempre, sem acordo de ajudante. A ficha
 * anda e dá visão como qualquer ficha do Gui, mas o nome e a foto continuam
 * do mestre: o host recusa `token.edit` nela. O fio do Gui marca a ficha como
 * emprestada (`emprestada`) para a tela nem oferecer o formulário; o fio de
 * quem só vê o NPC não traz marca nenhuma — nem a do NPC.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession } from './hostSession'

const CODE = 'NPCEMP'
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

/** Gui (espada) longe do menino; Bruno (machado) ao lado do menino; o vigia só os olhos do menino alcançam. */
const VILA: MapData = {
  ...createEmptyMap('m-vila', 'Vila', 30, 10, 50),
  tokens: [
    ficha('espada', 'Espada', 100),
    ficha('menino', 'Menino', 1300, { npc: true }),
    ficha('machado', 'Machado', 1250),
    ficha('vigia', 'Vigia', 1420),
  ],
}

function entra(s: HostSession, clientId: string, name: string): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, VILA).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mapaDe(r: HostResult, clientId: string) {
  const msg = r.outbound.find((o) => o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta'))?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error(`esperava o mapa de ${clientId}`)
  return msg
}

describe('NPC emprestado pelo "Atribuir": anda e vê, mas não é editado', () => {
  let s: HostSession
  let gui: string
  let bruno: string

  beforeEach(() => {
    let n = 0
    s = createHostSession({ code: CODE, visionRadius: 300, now: () => 0, randomId: () => `id-${(n += 1)}` })
    gui = entra(s, 'c1', 'Gui')
    bruno = entra(s, 'c2', 'Bruno')
    s.assignToken(gui, 'espada')
    s.assignToken(gui, 'menino')
    s.assignToken(bruno, 'machado')
  })

  it('o host recusa renomear e trocar a foto do NPC; a ficha própria continua editável', () => {
    const nome = s.handleMessage('c1', { type: 'token.edit', tokenId: 'menino', name: 'Pedrinho' }, VILA)
    expect(nome.applyTokenEdit).toBeUndefined()
    expect(nome.outbound).toEqual([])
    const foto = s.handleMessage('c1', { type: 'token.edit', tokenId: 'menino', image: FOTO }, VILA)
    expect(foto.applyTokenEdit).toBeUndefined()
    expect(foto.outbound).toEqual([])
    const propria = s.handleMessage('c1', { type: 'token.edit', tokenId: 'espada', name: 'Lâmina' }, VILA)
    expect(propria.applyTokenEdit).toEqual({ tokenId: 'espada', name: 'Lâmina', image: undefined })
  })

  it('o NPC emprestado anda com o Gui', () => {
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'menino', x: 1350, y: 100 }, VILA)
    expect(r.applyMove?.tokenId).toBe('menino')
  })

  it('o NPC dá visão ao Gui, e o fio dele marca a ficha como emprestada', () => {
    const fio = mapaDe(s.broadcast(VILA), 'c1')
    expect(fio.ownTokens).toEqual(['espada', 'menino'])
    expect(fio.vision).toHaveLength(2)
    expect(fio.map.tokens.some((t) => t.id === 'vigia')).toBe(true)
    const menino = fio.map.tokens.find((t) => t.id === 'menino')
    expect(menino?.emprestada).toBe(true)
    expect(menino !== undefined && 'npc' in menino).toBe(false)
    const espada = fio.map.tokens.find((t) => t.id === 'espada')
    expect(espada !== undefined && 'emprestada' in espada).toBe(false)
  })

  it('o Bruno vê o menino, mas nem a marca de emprestada nem a de NPC chegam a ele', () => {
    const fio = mapaDe(s.broadcast(VILA), 'c2')
    const menino = fio.map.tokens.find((t) => t.id === 'menino')
    expect(menino?.name).toBe('Menino')
    expect(menino !== undefined && 'emprestada' in menino).toBe(false)
    expect(menino !== undefined && 'npc' in menino).toBe(false)
    expect(JSON.stringify(fio)).not.toContain('emprestada')
  })

  it('devolvido ao mestre, o NPC sai do fio do Gui e a recusa continua', () => {
    s.unassignToken(gui, 'menino')
    const fio = mapaDe(s.broadcast(VILA), 'c1')
    expect(fio.ownTokens).toEqual(['espada'])
    expect(JSON.stringify(fio)).not.toContain('emprestada')
    expect(s.handleMessage('c1', { type: 'token.edit', tokenId: 'menino', name: 'Pedrinho' }, VILA).applyTokenEdit).toBeUndefined()
  })
})
