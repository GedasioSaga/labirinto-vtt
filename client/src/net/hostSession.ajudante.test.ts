/**
 * AJUDANTE CONTRATADO, lado da SESSÃO: o mestre empresta o Tiziu à Duda com
 * tarefa e prazo. O fio da Duda traz o acordo e a ficha; o do Bruno, que vê o
 * Tiziu, não traz o acordo. A Duda não renomeia o NPC. No fim do prazo a ficha
 * volta sozinha ao mestre e só a Duda recebe o recado.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession } from './hostSession'
import { LOAN_TASK_MAX_LENGTH } from '../lib/tokenLoan'

const CODE = 'AJUD01'
const MINUTO = 60_000
const TAREFA = 'levar o recado ao Bartô'

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

/** Duda (arco) longe do Tiziu; Bruno (machado) ao lado dele; o vigia só os olhos do Tiziu alcançam. */
const PORTO: MapData = {
  ...createEmptyMap('m-porto', 'Porto', 30, 10, 50),
  tokens: [
    ficha('arco', 'Arco', 100),
    ficha('tiziu', 'Tiziu espião', 1300, { publicName: 'Menino', npc: true }),
    ficha('machado', 'Machado', 1250),
    ficha('vigia', 'Vigia', 1420),
  ],
}

function entra(s: HostSession, clientId: string, name: string): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, PORTO).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mapaDe(r: HostResult, clientId: string) {
  const msg = r.outbound.find((o) => o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta'))?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error(`esperava o mapa de ${clientId}`)
  return msg
}

function recadosDe(r: HostResult, clientId: string): string[] {
  return r.outbound.flatMap((o) => (o.clientId === clientId && o.msg.type === 'scene.note' ? [o.msg.text] : []))
}

describe('ajudante contratado na sessão do host', () => {
  let agora: number
  let s: HostSession
  let duda: string
  let bruno: string

  beforeEach(() => {
    agora = 0
    let n = 0
    s = createHostSession({ code: CODE, visionRadius: 300, now: () => agora, randomId: () => `id-${(n += 1)}` })
    duda = entra(s, 'c1', 'Duda')
    bruno = entra(s, 'c2', 'Bruno')
    s.assignToken(duda, 'arco')
    s.assignToken(bruno, 'machado')
  })

  it('a Duda recebe o Tiziu com o acordo e o nome público; ele não é olho dela', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false })
    const fio = mapaDe(s.broadcast(PORTO), 'c1')
    expect(fio.ownTokens).toEqual(['arco', 'tiziu'])
    const tiziu = fio.map.tokens.find((t) => t.id === 'tiziu')
    expect(tiziu?.contrato).toEqual({ tarefa: TAREFA, ate: 30 * MINUTO, visao: false })
    expect(tiziu?.name).toBe('Menino')
    expect(fio.vision).toHaveLength(1)
    expect(fio.map.tokens.some((t) => t.id === 'vigia')).toBe(false)
    expect(JSON.stringify(fio)).not.toContain('espião')
  })

  it('"vê com os olhos dele": o vigia ao lado do Tiziu chega à Duda', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: true })
    const fio = mapaDe(s.broadcast(PORTO), 'c1')
    expect(fio.vision).toHaveLength(2)
    expect(fio.map.tokens.some((t) => t.id === 'vigia')).toBe(true)
  })

  it('o Bruno vê o Tiziu, mas nunca o acordo', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false })
    const fio = mapaDe(s.broadcast(PORTO), 'c2')
    const tiziu = fio.map.tokens.find((t) => t.id === 'tiziu')
    expect(tiziu?.name).toBe('Menino')
    expect(tiziu !== undefined && 'contrato' in tiziu).toBe(false)
    expect(JSON.stringify(fio)).not.toContain('Bartô')
  })

  it('a Duda não renomeia nem troca a foto do NPC emprestado; a própria ficha, sim', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false })
    const noNpc = s.handleMessage('c1', { type: 'token.edit', tokenId: 'tiziu', name: 'Pedro' }, PORTO)
    expect(noNpc.applyTokenEdit).toBeUndefined()
    const naDela = s.handleMessage('c1', { type: 'token.edit', tokenId: 'arco', name: 'Arqueira' }, PORTO)
    expect(naDela.applyTokenEdit?.tokenId).toBe('arco')
  })

  it('antes do prazo o Tiziu continua com ela; no prazo volta ao mestre e só ela recebe o recado', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false })
    expect(s.nextLoanDeadline()).toBe(30 * MINUTO)
    agora = 30 * MINUTO - 1
    expect(mapaDe(s.broadcast(PORTO), 'c1').ownTokens).toEqual(['arco', 'tiziu'])

    agora = 30 * MINUTO
    const r = s.broadcast(PORTO)
    expect(recadosDe(r, 'c1')).toEqual(['Menino voltou ao mestre: o acordo acabou.'])
    expect(recadosDe(r, 'c2')).toEqual([])
    expect(mapaDe(r, 'c1').ownTokens).toEqual(['arco'])
    expect(JSON.stringify(r.outbound)).not.toContain('espião')
    expect(s.listPlayers().find((p) => p.playerId === duda)?.tokenIds).toEqual(['arco'])
    expect(s.listPlayers().find((p) => p.playerId === duda)?.loans).toBeUndefined()
    expect(s.nextLoanDeadline()).toBeNull()
  })

  it('movimento do ajudante depois do prazo é recusado, mesmo antes do broadcast', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 5, visao: false })
    agora = 5 * MINUTO
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'tiziu', x: 1350, y: 100 }, PORTO)
    expect(r.applyMove).toBeUndefined()
    expect(recadosDe(r, 'c1')).toEqual(['Menino voltou ao mestre: o acordo acabou.'])
  })

  it('"até eu tirar" não vence sozinho; "Remover" desfaz o acordo', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: null, visao: false })
    expect(s.nextLoanDeadline()).toBeNull()
    agora = 10 * 24 * 60 * MINUTO
    expect(mapaDe(s.broadcast(PORTO), 'c1').ownTokens).toEqual(['arco', 'tiziu'])
    expect(s.listPlayers().find((p) => p.playerId === duda)?.loans).toEqual({ tiziu: { tarefa: TAREFA, ate: null, visao: false } })
    s.unassignToken(duda, 'tiziu')
    expect(s.listPlayers().find((p) => p.playerId === duda)?.loans).toBeUndefined()
  })

  it('"Atribuir" por cima do empréstimo vira posse de verdade: sem acordo e com visão', () => {
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false })
    s.assignToken(duda, 'tiziu')
    const fio = mapaDe(s.broadcast(PORTO), 'c1')
    const tiziu = fio.map.tokens.find((t) => t.id === 'tiziu')
    expect(tiziu !== undefined && 'contrato' in tiziu).toBe(false)
    expect(fio.vision).toHaveLength(2)
    expect(s.nextLoanDeadline()).toBeNull()
  })

  it('emprestar a quem já joga com o Tiziu tira dele, como o Atribuir', () => {
    s.assignToken(bruno, 'tiziu')
    s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false })
    expect(s.listPlayers().find((p) => p.playerId === bruno)?.tokenIds).toEqual(['machado'])
    expect(s.listPlayers().find((p) => p.playerId === duda)?.tokenIds).toEqual(['arco', 'tiziu'])
  })

  it('jogador desconhecido não recebe nada; tarefa e prazo saem nos tetos', () => {
    expect(s.lendToken('ninguem', 'tiziu', { tarefa: TAREFA, minutos: 30, visao: false }).outbound).toEqual([])
    expect(s.listPlayers().every((p) => p.loans === undefined)).toBe(true)

    s.lendToken(duda, 'tiziu', { tarefa: `  ${'x'.repeat(LOAN_TASK_MAX_LENGTH + 40)}  `, minutos: 999_999, visao: false })
    const acordo = s.listPlayers().find((p) => p.playerId === duda)?.loans?.tiziu
    expect(acordo?.tarefa).toBe('x'.repeat(LOAN_TASK_MAX_LENGTH))
    expect(acordo?.ate).toBe(24 * 60 * MINUTO)
  })

  it('prazo que não é número positivo não empresta', () => {
    expect(s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: 0, visao: false }).outbound).toEqual([])
    expect(s.lendToken(duda, 'tiziu', { tarefa: TAREFA, minutos: Number.NaN, visao: false }).outbound).toEqual([])
    expect(s.listPlayers().find((p) => p.playerId === duda)?.tokenIds).toEqual(['arco'])
  })
})
