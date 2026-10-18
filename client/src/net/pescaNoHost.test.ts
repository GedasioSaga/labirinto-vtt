/**
 * MINIGAME DE PESCA no mestre, a fábrica pura: uma sessão por pino. "Mestre
 * chama": quem o mestre convida entra. "Jogador toca no pino": quem pede entra
 * e o convite volta só para ele; o pedido num pino de "Mestre chama" é
 * recusado. Cada um começa no Pronto; pausar e encerrar valem para todos do
 * pino; quem cai no meio sai. Sem desfecho com efeito.
 */
import { describe, expect, it } from 'vitest'
import { MINIGAME_PESCA_PADRAO, type MinigamePesca } from '../minigames/pesca/tipos'
import { criarPescaNoHost, type PescaCongelada, type SaidaDaPesca } from './pescaNoHost'
import type { PeixeNoCesto } from './protocoloDaPesca'

const ANA = { playerId: 'p-ana', nome: 'Ana' }
const BRUNO = { playerId: 'p-bruno', nome: 'Bruno' }
const CAIO = { playerId: 'p-caio', nome: 'Caio' }
const TRUTA: PeixeNoCesto = { peixe: 'truta', cm: 31, estrelas: 2, perfeito: false, bau: false }
const BAGRE: PeixeNoCesto = { peixe: 'bagre', cm: 70, estrelas: 3, perfeito: true, bau: true }

function conf(extra: Partial<MinigamePesca> = {}, pinId = 'pino-1'): PescaCongelada {
  return { pinId, minigame: { ...MINIGAME_PESCA_PADRAO, ...extra } }
}

function mesa() {
  const conectados = new Map<string, string>([
    [ANA.playerId, 'c-ana'],
    [BRUNO.playerId, 'c-bruno'],
    [CAIO.playerId, 'c-caio'],
  ])
  let n = 0
  const pesca = criarPescaNoHost({ conexaoDe: (playerId) => conectados.get(playerId) ?? null, randomId: () => `s${(n += 1)}` })
  return { pesca, conectados }
}

const para = (saidas: SaidaDaPesca[], clientId: string) => saidas.filter((s) => s.clientId === clientId).map((s) => s.msg)
const tipos = (saidas: SaidaDaPesca[], clientId: string) => para(saidas, clientId).map((m) => m.type)

function sessaoDe(r: { resultado: { ok: true; sessao: string } | { ok: false } }): string {
  if (!r.resultado.ok) throw new Error('devia ter entrado')
  return r.resultado.sessao
}

describe('pescaNoHost: mestre chama', () => {
  it('só os convidados recebem o convite, com o desafio inteiro (prêmio e consequência são texto)', () => {
    const { pesca } = mesa()
    const r = pesca.convidar(conf(), [ANA, BRUNO])
    expect(r.resultado).toEqual({ ok: true, sessao: 's1', convidados: 2 })
    expect(tipos(r.outbound, 'c-ana')).toEqual(['pesca.convite', 'pesca.estado'])
    expect(tipos(r.outbound, 'c-caio')).toEqual([])
    const convite = para(r.outbound, 'c-bruno')[0]
    expect(convite).toMatchObject({ type: 'pesca.convite', pinId: 'pino-1', npc: 'Bento, o barqueiro', lago: 'Poço Afogado', lances: 3, premio: MINIGAME_PESCA_PADRAO.premio, consequencia: MINIGAME_PESCA_PADRAO.consequencia })
  })

  it('ninguém livre: recusado sem mensagem; quem já pesca em outro pino não entra', () => {
    const { pesca } = mesa()
    expect(pesca.convidar(conf(), [])).toEqual({ outbound: [], resultado: { ok: false, motivo: 'ninguem' } })
    sessaoDe(pesca.convidar(conf({}, 'pino-1'), [ANA]))
    expect(pesca.convidar(conf({}, 'pino-2'), [ANA])).toEqual({ outbound: [], resultado: { ok: false, motivo: 'ninguem' } })
  })

  it('cada um começa no Pronto, com a dificuldade que o mestre permite', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf({ permitida: 'normal' }), [ANA, BRUNO]))
    expect(pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'extremo' })).toEqual([])
    const pronto = pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    expect(tipos(pronto, 'c-bruno')).toEqual(['pesca.estado'])
    const [linha] = pesca.aoVivo()[0].participantes
    expect(linha).toMatchObject({ playerId: ANA.playerId, status: 'pescando', dificuldade: 'normal' })
    // Pronto repetido, de sessão errada ou de quem não entrou: nada.
    expect(pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })).toEqual([])
    expect(pesca.pronto(BRUNO.playerId, { type: 'pesca.pronto', sessao: 'outra', dificuldade: 'normal' })).toEqual([])
    expect(pesca.pronto(CAIO.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })).toEqual([])
  })

  it('vivo, lances e cesto chegam ao placar; o maior peixe é o de mais cm', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA]))
    // Antes do Pronto nada conta.
    pesca.lance(ANA.playerId, { type: 'pesca.lance', sessao, lance: 1, resultado: 'pegou', peixe: TRUTA })
    expect(pesca.aoVivo()[0].participantes[0].lances).toEqual([])
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    expect(pesca.vivo(ANA.playerId, { type: 'pesca.vivo', sessao, fase: 'puxada', lance: 1, de: 3, medidor: 0.5 })).toEqual([])
    // `de` diferente dos lances da chamada é tela velha: não conta.
    pesca.vivo(ANA.playerId, { type: 'pesca.vivo', sessao, fase: 'espera', lance: 1, de: 5, medidor: 0 })
    pesca.lance(ANA.playerId, { type: 'pesca.lance', sessao, lance: 1, resultado: 'pegou', peixe: TRUTA })
    pesca.lance(ANA.playerId, { type: 'pesca.lance', sessao, lance: 1, resultado: 'escapou' })
    pesca.lance(ANA.playerId, { type: 'pesca.lance', sessao, lance: 2, resultado: 'pegou', peixe: BAGRE })
    pesca.lance(ANA.playerId, { type: 'pesca.lance', sessao, lance: 4, resultado: 'fugiu' })
    const linha = pesca.aoVivo()[0].participantes[0]
    expect(linha.vivo).toEqual({ fase: 'puxada', lance: 1, de: 3, medidor: 0.5 })
    expect(linha.lances.map((l) => [l.lance, l.resultado])).toEqual([
      [1, 'pegou'],
      [2, 'pegou'],
    ])
    expect(linha.cesto).toEqual([TRUTA, BAGRE])
    expect(linha.maior).toEqual(BAGRE)
    // O fim fecha: o cesto do fim vale, e nada depois dele conta.
    expect(tipos(pesca.fim(ANA.playerId, { type: 'pesca.fim', sessao, cesto: [BAGRE] }), 'c-ana')).toEqual(['pesca.estado'])
    pesca.lance(ANA.playerId, { type: 'pesca.lance', sessao, lance: 3, resultado: 'pegou', peixe: TRUTA })
    expect(pesca.aoVivo()[0].participantes[0]).toMatchObject({ status: 'terminou', cesto: [BAGRE], maior: BAGRE })
  })

  it('cesto vazio: sem maior peixe', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    pesca.fim(ANA.playerId, { type: 'pesca.fim', sessao, cesto: [] })
    const linha = pesca.aoVivo()[0].participantes[0]
    expect(linha.cesto).toEqual([])
    expect('maior' in linha).toBe(false)
  })

  it('chamar de novo com alguém pescando entra na mesma sessão; sem ninguém, abre outra zerada', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    const r = pesca.convidar(conf({ lances: 5 }), [ANA, BRUNO])
    expect(r.resultado).toEqual({ ok: true, sessao, convidados: 1 })
    expect(tipos(r.outbound, 'c-bruno')).toEqual(['pesca.convite', 'pesca.estado'])
    pesca.fim(ANA.playerId, { type: 'pesca.fim', sessao, cesto: [] })
    pesca.pronto(BRUNO.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    pesca.fim(BRUNO.playerId, { type: 'pesca.fim', sessao, cesto: [] })
    const nova = sessaoDe(pesca.convidar(conf({ lances: 5 }), [ANA]))
    expect(nova).not.toBe(sessao)
    expect(pesca.aoVivo()).toHaveLength(1)
    expect(pesca.aoVivo()[0]).toMatchObject({ sessao: nova, lances: 5 })
  })
})

describe('pescaNoHost: jogador toca no pino', () => {
  it('quem pede entra, e o convite volta só para ele', () => {
    const { pesca } = mesa()
    const r = pesca.pedir(conf({ entrada: 'pino' }), ANA)
    expect(r.resultado).toEqual({ ok: true, sessao: 's1' })
    expect(tipos(r.outbound, 'c-ana')).toEqual(['pesca.convite', 'pesca.estado'])
    const segundo = pesca.pedir(conf({ entrada: 'pino' }), BRUNO)
    expect(segundo.resultado).toEqual({ ok: true, sessao: 's1' })
    expect(tipos(segundo.outbound, 'c-bruno')).toEqual(['pesca.convite', 'pesca.estado'])
    // A Ana só lê o estado novo, com o Bruno na lista: o convite não vai a ela de novo.
    expect(tipos(segundo.outbound, 'c-ana')).toEqual(['pesca.estado'])
  })

  it('pedido num pino de "Mestre chama" é recusado, sem mensagem', () => {
    const { pesca } = mesa()
    expect(pesca.pedir(conf({ entrada: 'mestre' }), ANA)).toEqual({ outbound: [], resultado: { ok: false, motivo: 'modo' } })
    expect(pesca.aoVivo()).toEqual([])
  })

  it('quem já está numa pesca não pede outra', () => {
    const { pesca } = mesa()
    sessaoDe(pesca.pedir(conf({ entrada: 'pino' }, 'pino-1'), ANA))
    expect(pesca.pedir(conf({ entrada: 'pino' }, 'pino-2'), ANA)).toEqual({ outbound: [], resultado: { ok: false, motivo: 'ocupado' } })
    expect(pesca.pedir(conf({ entrada: 'pino' }, 'pino-1'), ANA).resultado).toEqual({ ok: false, motivo: 'ocupado' })
  })

  it('quem terminou pode pedir de novo: volta com a pesca zerada', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.pedir(conf({ entrada: 'pino' }), ANA))
    sessaoDe(pesca.pedir(conf({ entrada: 'pino' }), BRUNO))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    pesca.fim(ANA.playerId, { type: 'pesca.fim', sessao, cesto: [TRUTA] })
    expect(pesca.pedir(conf({ entrada: 'pino' }), ANA).resultado).toEqual({ ok: true, sessao })
    expect(pesca.aoVivo()[0].participantes.find((p) => p.playerId === ANA.playerId)).toMatchObject({ status: 'convidado', cesto: [] })
  })
})

describe('pescaNoHost: pausa, encerramento e quedas', () => {
  it('pausar e retomar valem para todos do pino que ainda estão no jogo; fora de fase, nada', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA, BRUNO]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    expect(pesca.retomar('pino-1')).toBeNull()
    const pausa = pesca.pausar('pino-1')
    expect(pausa?.map((s) => [s.clientId, s.msg.type])).toEqual([
      ['c-ana', 'pesca.pausa'],
      ['c-bruno', 'pesca.pausa'],
    ])
    expect(pesca.pausar('pino-1')).toBeNull()
    expect(pesca.pausar('outro-pino')).toBeNull()
    // Quem entra durante a pausa já recebe a pausa.
    expect(tipos(pesca.convidar(conf(), [CAIO]).outbound, 'c-caio')).toEqual(['pesca.convite', 'pesca.pausa', 'pesca.estado'])
    expect(pesca.retomar('pino-1')?.map((s) => s.msg.type)).toEqual(['pesca.retoma', 'pesca.retoma', 'pesca.retoma'])
  })

  it('encerrar avisa quem ainda estava no jogo, sem efeito; depois nada da sessão vale', () => {
    const { pesca } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA, BRUNO]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    pesca.fim(ANA.playerId, { type: 'pesca.fim', sessao, cesto: [] })
    const fim = pesca.encerrar('pino-1')
    expect(fim).toEqual([{ clientId: 'c-bruno', msg: { type: 'pesca.encerra', sessao, motivo: 'mestre' } }])
    expect(pesca.encerrar('pino-1')).toBeNull()
    expect(pesca.pronto(BRUNO.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })).toEqual([])
    // O placar fica no painel até a próxima chamada.
    expect(pesca.aoVivo()[0].fase).toBe('encerrada')
  })

  it('quem cai pescando sai; quem cai convidado recebe o convite de novo ao voltar', () => {
    const { pesca, conectados } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA, BRUNO]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    conectados.delete(ANA.playerId)
    conectados.delete(BRUNO.playerId)
    expect(pesca.caiu(ANA.playerId)).toEqual([])
    expect(pesca.caiu(BRUNO.playerId)).toEqual([])
    expect(pesca.aoVivo()[0].participantes.map((p) => [p.nome, p.status, p.conectado])).toEqual([
      ['Ana', 'saiu', false],
      ['Bruno', 'convidado', false],
    ])
    conectados.set(BRUNO.playerId, 'c-bruno-2')
    expect(tipos(pesca.entrou(BRUNO.playerId), 'c-bruno-2')).toEqual(['pesca.convite', 'pesca.estado'])
    conectados.set(ANA.playerId, 'c-ana-2')
    expect(pesca.entrou(ANA.playerId)).toEqual([])
  })

  it('aba nova no meio da pesca: quem pescava sai, e fica sabendo', () => {
    const { pesca, conectados } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA, BRUNO]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    conectados.set(ANA.playerId, 'c-ana-2')
    const saidas = pesca.entrou(ANA.playerId)
    expect(tipos(saidas, 'c-ana-2')).toEqual(['pesca.encerra'])
    expect(tipos(saidas, 'c-bruno')).toEqual(['pesca.estado'])
  })

  it('expulso: o convidado sai da lista; quem pescava fica como "saiu"', () => {
    const { pesca, conectados } = mesa()
    const sessao = sessaoDe(pesca.convidar(conf(), [ANA, BRUNO]))
    pesca.pronto(ANA.playerId, { type: 'pesca.pronto', sessao, dificuldade: 'normal' })
    conectados.delete(ANA.playerId)
    conectados.delete(BRUNO.playerId)
    pesca.esquecer(BRUNO.playerId)
    pesca.esquecer(ANA.playerId)
    expect(pesca.aoVivo()[0].participantes.map((p) => [p.nome, p.status])).toEqual([['Ana', 'saiu']])
  })
})
