/**
 * PROTOCOLO DA PESCA: o que cada lado aceita. Campo torto recusa a mensagem
 * inteira; limites (lances, medidor, cm, estrelas, cesto) barram lixo; o
 * `pegou` sempre traz o peixe e o resto nunca traz.
 */
import { describe, expect, it } from 'vitest'
import { parsePlayerMessage } from './protocol'
import { parsePescaHostMessage, parsePescaPlayerMessage, type PeixeNoCesto, type PescaConviteMessage } from './protocoloDaPesca'

const PEIXE: PeixeNoCesto = { peixe: 'truta', cm: 31, estrelas: 3, perfeito: true, bau: false }
const CONVITE: PescaConviteMessage = {
  type: 'pesca.convite',
  sessao: 's1',
  pinId: 'pino-pesca',
  npc: 'Bento, o barqueiro',
  fala: 'Joga a linha.',
  lago: 'Poço Afogado',
  lances: 3,
  permitida: 'escolha',
  premio: { texto: 'A chave da comporta.' },
  consequencia: { texto: 'O barqueiro conta para a mesa.' },
  participantes: [{ playerId: 'p1', nome: 'Ana' }],
}

describe('protocolo da pesca: do jogador', () => {
  it('as cinco mensagens válidas passam iguais', () => {
    const validas = [
      { type: 'pesca.pedir', pinId: 'pino-pesca' },
      { type: 'pesca.pronto', sessao: 's1', dificuldade: 'extremo' },
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 2, de: 3, medidor: 0.4 },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: PEIXE },
      { type: 'pesca.lance', sessao: 's1', lance: 2, resultado: 'fugiu' },
      { type: 'pesca.fim', sessao: 's1', cesto: [PEIXE] },
      { type: 'pesca.fim', sessao: 's1', cesto: [] },
    ]
    for (const msg of validas) {
      expect(parsePescaPlayerMessage(msg), JSON.stringify(msg)).toEqual(msg)
      // `protocol.ts` encaminha para cá.
      expect(parsePlayerMessage(msg), JSON.stringify(msg)).toEqual(msg)
    }
  })

  it('campo torto ou fora do limite recusa a mensagem inteira', () => {
    const tortas: unknown[] = [
      { type: 'pesca.pedir', pinId: '' },
      { type: 'pesca.pronto', sessao: 's1', dificuldade: 'expert' },
      { type: 'pesca.pronto', sessao: '', dificuldade: 'normal' },
      { type: 'pesca.vivo', sessao: 's1', fase: 'convite', lance: 1, de: 3, medidor: 0 },
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 4, de: 3, medidor: 0 },
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 1, de: 6, medidor: 0 },
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 1, de: 3, medidor: 1.5 },
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 1.5, de: 3, medidor: 0 },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou' },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'escapou', peixe: PEIXE },
      { type: 'pesca.lance', sessao: 's1', lance: 0, resultado: 'escapou' },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: { ...PEIXE, peixe: 'baleia' } },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: { ...PEIXE, cm: -1 } },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: { ...PEIXE, estrelas: 5 } },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: { ...PEIXE, bau: 'sim' } },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'sumiu' },
      { type: 'pesca.fim', sessao: 's1', cesto: Array.from({ length: 6 }, () => PEIXE) },
      { type: 'pesca.fim', sessao: 's1', cesto: [PEIXE, null] },
      { type: 'pesca.fim', sessao: 's1' },
      { type: 'pesca.estado', sessao: 's1' },
    ]
    for (const msg of tortas) expect(parsePescaPlayerMessage(msg), JSON.stringify(msg)).toBeNull()
  })

  it('o que não se manda (campo desconhecido) não atravessa', () => {
    expect(parsePescaPlayerMessage({ type: 'pesca.pedir', pinId: 'p', extra: 'x' })).toEqual({ type: 'pesca.pedir', pinId: 'p' })
    expect(parsePescaPlayerMessage({ type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: { ...PEIXE, nome: 'Truta' } })).toEqual({
      type: 'pesca.lance',
      sessao: 's1',
      lance: 1,
      resultado: 'pegou',
      peixe: PEIXE,
    })
  })
})

describe('protocolo da pesca: do mestre', () => {
  it('convite, estado, pausa, retoma e encerra válidos passam iguais', () => {
    const validas = [
      CONVITE,
      { type: 'pesca.estado', sessao: 's1', fase: 'pausa', participantes: [{ playerId: 'p1', nome: 'Ana', status: 'pescando' }] },
      { type: 'pesca.pausa', sessao: 's1' },
      { type: 'pesca.retoma', sessao: 's1' },
      { type: 'pesca.encerra', sessao: 's1', motivo: 'mestre' },
    ]
    for (const msg of validas) expect(parsePescaHostMessage(msg), JSON.stringify(msg)).toEqual(msg)
  })

  it('convite torto cai inteiro', () => {
    const tortos: unknown[] = [
      { ...CONVITE, lances: 0 },
      { ...CONVITE, lances: 6 },
      { ...CONVITE, permitida: 'expert' },
      { ...CONVITE, premio: 'chave' },
      { ...CONVITE, consequencia: { texto: 'c'.repeat(141) } },
      { ...CONVITE, lago: 'l'.repeat(41) },
      { ...CONVITE, participantes: [] },
      { ...CONVITE, pinId: '' },
      { type: 'pesca.encerra', sessao: 's1', motivo: 'fora' },
      { type: 'pesca.estado', sessao: 's1', fase: 'encerrada', participantes: [] },
    ]
    for (const msg of tortos) expect(parsePescaHostMessage(msg), JSON.stringify(msg)).toBeNull()
  })
})
