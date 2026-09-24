/**
 * TESTE SECRETO: o mestre pede um teste (ex.: Percepção) a jogadores
 * escolhidos. Só eles recebem o pedido; a resposta de cada um fica no mestre
 * (`secretChecks`) e NÃO sai para ninguém — nem para quem respondeu, nem para
 * os colegas, nem no broadcast seguinte. Quem não foi escolhido não recebe
 * nada, e a resposta dele a um pedido que não era dele morre em silêncio.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { SECRET_CHECK_LABEL_MAX_LENGTH, SECRET_CHECK_RESULT_MAX } from './protocol'
import { MAX_SECRET_CHECKS, createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const SALAO: HostScene = { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100), ficha('arco', 300, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string): { playerId: string; resume: string } {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { playerId: welcome.playerId, resume: welcome.resumeToken }
}

/** Ana (Salão), Bruno (Cripta) e Caio (Salão) jogando. */
function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const ana = entra(s, 'c1', 'Ana')
  const bruno = entra(s, 'c2', 'Bruno')
  const caio = entra(s, 'c3', 'Caio')
  s.assignToken(ana.playerId, 'lanterna')
  s.assignToken(bruno.playerId, 'machado')
  s.assignToken(caio.playerId, 'arco')
  return { s, ana, bruno, caio }
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

function idDo(r: HostResult): string {
  const id = r.secretCheckId
  if (id === undefined) throw new Error('esperava o id do teste')
  return id
}

describe('secretCheck (teste secreto)', () => {
  it('só os escolhidos recebem o pedido, de qualquer cena; quem não foi escolhido não recebe nada', () => {
    const { s, ana, bruno } = mesa()
    const r = s.secretCheck('Percepção', [ana.playerId, bruno.playerId])
    const id = idDo(r)
    expect(r.outbound).toEqual([
      { clientId: 'c1', msg: { type: 'secret.check', id, label: 'Percepção' } },
      { clientId: 'c2', msg: { type: 'secret.check', id, label: 'Percepção' } },
    ])
    expect(para(r, 'c3')).toBe('[]')
    expect(s.secretChecks()).toEqual([{ id, label: 'Percepção', asked: [ana.playerId, bruno.playerId], answers: {}, open: true }])
  })

  it('o pedido não leva quem mais foi escolhido, nem id de jogador, nem cena', () => {
    const { s, ana, bruno } = mesa()
    const texto = para(s.secretCheck('Percepção', [ana.playerId, bruno.playerId]), 'c1')
    expect(texto).toContain('secret.check')
    for (const proibido of ['Bruno', bruno.playerId, ana.playerId, 's-salao', 'Salao Norte', 'Cripta']) expect(texto).not.toContain(proibido)
  })

  it('a resposta fica só com o mestre: não sai para ninguém, nem no broadcast seguinte', () => {
    const { s, ana, bruno } = mesa()
    const id = idDo(s.secretCheck('Percepção', [ana.playerId, bruno.playerId]))
    const r = s.handleMessage('c1', { type: 'secret.check.answer', id, result: 173 }, mundo)
    expect(r.outbound).toEqual([])
    expect(r.secretCheckAnswer).toEqual({ checkId: id, playerId: ana.playerId, playerName: 'Ana', label: 'Percepção', result: 173 })
    expect(s.secretChecks()[0]?.answers).toEqual({ [ana.playerId]: 173 })
    // O número em si aparece por acaso nas coordenadas da visão: o que não
    // pode aparecer é mensagem de teste secreto nem campo de resultado.
    const depois = s.broadcast(mundo).outbound
    expect(depois.map((o) => o.msg.type)).toEqual(['snapshot', 'snapshot', 'snapshot'])
    expect(JSON.stringify(depois)).not.toMatch(/secret|"result"|Percep/)
    // Quem chega depois também não fica sabendo.
    const dora = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Dora' }, mundo).outbound
    expect(dora.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    expect(JSON.stringify(dora)).not.toMatch(/secret|"result"|Percep/)
  })

  it('resposta de quem não foi escolhido, de id inventado ou repetida morre em silêncio', () => {
    const { s, ana } = mesa()
    const id = idDo(s.secretCheck('Percepção', [ana.playerId]))
    const intruso = s.handleMessage('c3', { type: 'secret.check.answer', id, result: 20 }, mundo)
    expect(intruso).toEqual({ outbound: [] })
    expect(s.handleMessage('c1', { type: 'secret.check.answer', id: 'id-inventado', result: 20 }, mundo)).toEqual({ outbound: [] })
    expect(s.secretChecks()[0]?.answers).toEqual({})

    s.handleMessage('c1', { type: 'secret.check.answer', id, result: 12 }, mundo)
    const deNovo = s.handleMessage('c1', { type: 'secret.check.answer', id, result: 20 }, mundo)
    expect(deNovo).toEqual({ outbound: [] })
    expect(s.secretChecks()[0]?.answers).toEqual({ [ana.playerId]: 12 })
  })

  it('resposta fora da faixa ou quebrada é mensagem inválida, e não conta', () => {
    const { s, ana } = mesa()
    const id = idDo(s.secretCheck('Percepção', [ana.playerId]))
    for (const result of [SECRET_CHECK_RESULT_MAX + 1, 1.5, Number.NaN, '17']) {
      const r = s.handleMessage('c1', { type: 'secret.check.answer', id, result }, mundo)
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } }])
    }
    expect(s.secretChecks()[0]?.answers).toEqual({})
  })

  it('encerrar avisa só quem ainda não respondeu, e resposta depois de encerrar não conta', () => {
    const { s, ana, bruno } = mesa()
    const id = idDo(s.secretCheck('Percepção', [ana.playerId, bruno.playerId]))
    s.handleMessage('c1', { type: 'secret.check.answer', id, result: 9 }, mundo)
    const fecha = s.closeSecretCheck(id)
    expect(fecha.outbound).toEqual([{ clientId: 'c2', msg: { type: 'secret.check.closed', id } }])
    expect(s.secretChecks()[0]?.open).toBe(false)
    expect(s.handleMessage('c2', { type: 'secret.check.answer', id, result: 4 }, mundo)).toEqual({ outbound: [] })
    expect(s.secretChecks()[0]?.answers).toEqual({ [ana.playerId]: 9 })
    // Encerrar de novo, ou um id que não existe: nada sai.
    expect(s.closeSecretCheck(id)).toEqual({ outbound: [] })
    expect(s.closeSecretCheck('nao-existe')).toEqual({ outbound: [] })
  })

  it('quem cai antes de responder recebe o pedido de novo ao voltar; quem já respondeu, e os outros, não', () => {
    const { s, ana, bruno } = mesa()
    const id = idDo(s.secretCheck('Percepção', [ana.playerId, bruno.playerId]))
    s.handleMessage('c2', { type: 'secret.check.answer', id, result: 5 }, mundo)
    s.disconnect('c1')
    s.disconnect('c2')
    const volta = s.handleMessage('c1b', { type: 'join', code: CODE, name: 'Ana', resume: ana.resume }, mundo)
    expect(volta.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'snapshot', 'secret.check'])
    expect(volta.outbound[2]).toEqual({ clientId: 'c1b', msg: { type: 'secret.check', id, label: 'Percepção' } })
    const brunoVolta = s.handleMessage('c2b', { type: 'join', code: CODE, name: 'Bruno', resume: bruno.resume }, mundo)
    expect(JSON.stringify(brunoVolta.outbound)).not.toContain('secret.check')
    // Encerrado enquanto ela estava fora: a volta não traz o pedido.
    s.disconnect('c1b')
    s.closeSecretCheck(id)
    const deNovo = s.handleMessage('c1c', { type: 'join', code: CODE, name: 'Ana', resume: ana.resume }, mundo)
    expect(JSON.stringify(deNovo.outbound)).not.toContain('secret.check')
  })

  it('escolhido que não é da sala, ou que aguarda sem ficha, fica de fora; ninguém válido ou nome vazio: não sai nada', () => {
    const { s, ana } = mesa()
    const dora = entra(s, 'c4', 'Dora') // aguardando, sem ficha
    const r = s.secretCheck('Furtividade', [ana.playerId, dora.playerId, 'fantasma'])
    expect(r.outbound.map((o) => o.clientId)).toEqual(['c1'])
    expect(s.secretChecks().at(-1)?.asked).toEqual([ana.playerId])
    const antes = s.secretChecks().length
    expect(s.secretCheck('Furtividade', [dora.playerId, 'fantasma'])).toEqual({ outbound: [] })
    expect(s.secretCheck('   ', [ana.playerId])).toEqual({ outbound: [] })
    expect(s.secretChecks().length).toBe(antes)
  })

  it('o nome do teste sai aparado e cortado no teto', () => {
    const { s, ana } = mesa()
    const r = s.secretCheck(`  ${'x'.repeat(SECRET_CHECK_LABEL_MAX_LENGTH + 10)}  `, [ana.playerId])
    const msg = r.outbound[0]?.msg
    expect(msg?.type === 'secret.check' ? msg.label : null).toBe('x'.repeat(SECRET_CHECK_LABEL_MAX_LENGTH))
  })

  it('o kick tira o jogador dos pedidos e das respostas; a lista do mestre tem teto', () => {
    const { s, ana, bruno } = mesa()
    const id = idDo(s.secretCheck('Percepção', [ana.playerId, bruno.playerId]))
    s.handleMessage('c1', { type: 'secret.check.answer', id, result: 11 }, mundo)
    s.kick('c1')
    expect(s.secretChecks()[0]).toEqual({ id, label: 'Percepção', asked: [bruno.playerId], answers: {}, open: true })

    for (let i = 0; i < MAX_SECRET_CHECKS + 5; i += 1) s.secretCheck(`Teste ${i}`, [bruno.playerId])
    const lista = s.secretChecks()
    expect(lista.length).toBe(MAX_SECRET_CHECKS)
    // Sai o mais antigo: o último pedido continua lá.
    expect(lista.at(-1)?.label).toBe(`Teste ${MAX_SECRET_CHECKS + 4}`)
    expect(lista.some((check) => check.id === id)).toBe(false)
  })
})
