/**
 * EMPRESTAR A FICHA DE QUEM SAIU, lado do host.
 *
 * - A Ana caiu. O mestre passa a ficha dela (Lírio) para a Carla jogar por ela:
 *   a Carla move o Lírio, mas o dono continua sendo a Ana (a mesa grava o
 *   Lírio no assento DELA, e o painel mostra "emprestada").
 * - O que o Lírio vê enquanto está emprestado também entra no explorado da
 *   Ana: ela não perde a exploração que a ficha fez sem ela.
 * - A Ana volta (resume ou "É ela"): o Lírio sai da Carla e volta para a Ana.
 * - O que é da Ana e está escondido da Carla continua sem chegar a ela: o
 *   explorado da Ana, o recado só para a Ana, e ficha de outra cena.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

/** Tudo o que saiu pela rede para `clientId`, como texto (o que o aparelho leria). */
function wireFor(result: HostResult, clientId: string): string {
  return JSON.stringify(result.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg))
}

function snapshotOf(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const found = result.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (found?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return found
}

function explorado(snapshot: Extract<HostMessage, { type: 'snapshot' }>, x: number, y: number): boolean {
  const exp = decodeExploration(snapshot.explored)
  if (exp === null) throw new Error('explorado ilegível')
  return isPointExplored(exp, { x, y })
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 5_000, randomId: () => `id-${(n += 1)}` })
  const hall = mapa('m-hall', 'Hall de Entrada', [ficha('lirio', 100, 100), ficha('escudo', 300, 100)])
  const cripta = mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 777, 333)])
  let mundo: HostWorld = {
    open: { sceneId: 's-hall', name: 'Hall de Entrada', map: hall },
    background: [{ sceneId: 's-cripta', name: 'Cripta Rubra', map: cripta }],
  }
  /** O integrador aplicou o movimento: a ficha anda no mapa do mestre. */
  const mover = (tokenId: string, x: number, y: number) => {
    const anda = (scene: HostScene): HostScene => ({ ...scene, map: { ...scene.map, tokens: scene.map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) } })
    mundo = { open: anda(mundo.open), background: mundo.background.map(anda) }
  }
  const entra = (clientId: string, name: string, resume?: string) => {
    const r = s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, result: r }
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  const carla = entra('c3', 'Carla')
  s.assignToken(ana.playerId, 'lirio')
  s.assignToken(bruno.playerId, 'machado')
  s.assignToken(carla.playerId, 'escudo')
  // Raio curto da Ana: o fundo do Hall (1300, 400) fica longe do que ela vê.
  s.setVisionRadius(ana.playerId, 300)
  // O primeiro envio: o broadcast só manda de novo quando a tela de alguém muda.
  const inicial = s.broadcast(mundo)
  return { s, ana, bruno, carla, entra, mover, mundo: () => mundo, inicial }
}

describe('hostSession: emprestar a ficha de quem saiu', () => {
  it('a Ana caiu: o mestre empresta o Lírio à Carla, que passa a movê-lo; o dono continua a Ana', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const r = m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    expect(r.lent).toEqual(['lirio'])
    const depois = m.s.broadcast(m.mundo())
    expect(snapshotOf(depois, 'c3').ownTokens).toEqual(['escudo', 'lirio'])
    // A Carla move o Lírio: o pedido vale, como se a ficha fosse dela.
    const anda = m.s.handleMessage('c3', { type: 'token.move', reqId: 'r1', tokenId: 'lirio', x: 200, y: 150 }, m.mundo())
    expect(anda.applyMove).toEqual({ tokenId: 'lirio', x: 200, y: 150 })
    // O painel do mestre: a Ana continua dona, e ele lê com quem a ficha está.
    const lista = m.s.listPlayers(m.mundo())
    const anaInfo = lista.find((p) => p.playerId === m.ana.playerId)
    const carlaInfo = lista.find((p) => p.playerId === m.carla.playerId)
    expect(anaInfo).toMatchObject({ tokenIds: ['lirio'], lentTo: ['Carla'] })
    expect(carlaInfo).toMatchObject({ borrowedFrom: ['Ana'], borrowedTokenIds: ['lirio'] })
    // A mesa gravada guarda o Lírio no assento da Ana, não no da Carla.
    const assentos = m.s.savedSeats()
    expect(assentos.find((seat) => seat.name === 'Ana')?.tokenIds).toEqual(['lirio'])
    expect(assentos.find((seat) => seat.name === 'Carla')?.tokenIds).toEqual(['escudo'])
  })

  it('a Ana volta pelo resume: o Lírio sai da Carla e volta para ela, com o que ele explorou no empréstimo', () => {
    const m = mesa()
    const antes = m.inicial
    expect(explorado(snapshotOf(antes, 'c1'), 1300, 400)).toBe(false)
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    // A Carla leva o Lírio ao fundo do Hall e o traz de volta.
    m.mover('lirio', 1300, 400)
    m.s.broadcast(m.mundo())
    m.mover('lirio', 100, 100)
    m.s.broadcast(m.mundo())
    const volta = m.entra('c9', 'Ana', m.ana.resumeToken)
    expect(volta.playerId).toBe(m.ana.playerId)
    expect(volta.result.loansReturned).toEqual([{ ownerId: m.ana.playerId, borrowerId: m.carla.playerId, tokenId: 'lirio' }])
    const snapshotAna = snapshotOf(volta.result, 'c9')
    expect(snapshotAna.ownTokens).toEqual(['lirio'])
    // Sem perder exploração: o fundo do Hall, que só o Lírio emprestado viu.
    expect(explorado(snapshotAna, 1300, 400)).toBe(true)
    // A Carla fica só com o Escudo, e o Lírio deixa de obedecer a ela.
    const depois = m.s.broadcast(m.mundo())
    expect(snapshotOf(depois, 'c3').ownTokens).toEqual(['escudo'])
    const tenta = m.s.handleMessage('c3', { type: 'token.move', reqId: 'r2', tokenId: 'lirio', x: 200, y: 150 }, m.mundo())
    expect(tenta.applyMove).toBeUndefined()
    const lista = m.s.listPlayers(m.mundo())
    expect(lista.find((p) => p.playerId === m.ana.playerId)?.lentTo).toBeUndefined()
    expect(lista.find((p) => p.playerId === m.carla.playerId)?.borrowedFrom).toBeUndefined()
    expect(lista.find((p) => p.playerId === m.carla.playerId)?.borrowedTokenIds).toBeUndefined()
  })

  it('quem jogava só com a ficha emprestada volta à espera quando o dono volta', () => {
    const m = mesa()
    const dani = m.entra('c4', 'Dani')
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, dani.playerId, m.mundo())
    expect(snapshotOf(m.s.broadcast(m.mundo()), 'c4').ownTokens).toEqual(['lirio'])
    const volta = m.entra('c9', 'Ana', m.ana.resumeToken)
    expect(volta.result.outbound).toContainEqual({ clientId: 'c4', msg: { type: 'lobby.waiting' } })
  })

  it('"É ela" também devolve: a Ana que entrou por outro aparelho recupera o Lírio', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    const nova = m.entra('c9', 'ana')
    const r = m.s.confirmReturn(nova.playerId, m.ana.playerId, m.mundo())
    expect(r.loansReturned).toEqual([{ ownerId: m.ana.playerId, borrowerId: m.carla.playerId, tokenId: 'lirio' }])
    expect(snapshotOf(r, 'c9').ownTokens).toEqual(['lirio'])
    // A Carla nunca chegou a receber o Lírio (nenhum envio no meio): a tela
    // dela continua a da entrada, só com o Escudo, e nada novo sai para ela.
    expect(m.s.broadcast(m.mundo()).outbound.filter((o) => o.clientId === 'c3')).toEqual([])
    expect(snapshotOf(m.inicial, 'c3').ownTokens).toEqual(['escudo'])
    expect(m.s.listPlayers(m.mundo()).find((p) => p.playerId === m.carla.playerId)?.tokenIds).toEqual(['escudo'])
  })

  it('"Tomar de volta": o mestre encerra o empréstimo antes de a Ana voltar', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    const r = m.s.endLoans(m.ana.playerId)
    expect(r.loansReturned).toEqual([{ ownerId: m.ana.playerId, borrowerId: m.carla.playerId, tokenId: 'lirio' }])
    // A Carla nunca chegou a receber o Lírio (nenhum envio no meio): a tela
    // dela continua a da entrada, só com o Escudo, e nada novo sai para ela.
    expect(m.s.broadcast(m.mundo()).outbound.filter((o) => o.clientId === 'c3')).toEqual([])
    expect(snapshotOf(m.inicial, 'c3').ownTokens).toEqual(['escudo'])
    expect(m.s.listPlayers(m.mundo()).find((p) => p.playerId === m.carla.playerId)?.tokenIds).toEqual(['escudo'])
    expect(m.s.listPlayers(m.mundo()).find((p) => p.playerId === m.ana.playerId)?.tokenIds).toEqual(['lirio'])
  })

  it('quem joga emprestado não troca o nome nem a foto da ficha da Ana', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    const r = m.s.handleMessage('c3', { type: 'token.edit', tokenId: 'lirio', name: 'Lírio da Carla' }, m.mundo())
    expect(r.applyTokenEdit).toBeUndefined()
    expect(r.outbound).toEqual([])
    // A própria ficha da Carla continua editável.
    expect(m.s.handleMessage('c3', { type: 'token.edit', tokenId: 'escudo', name: 'Escudo Novo' }, m.mundo()).applyTokenEdit).toMatchObject({ tokenId: 'escudo' })
  })

  it('Dispensar a Ana com o Lírio emprestado: a ficha fica com quem a joga', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    expect(m.s.dismissPlayer(m.ana.playerId)).toBe(true)
    const carlaInfo = m.s.listPlayers(m.mundo()).find((p) => p.playerId === m.carla.playerId)
    expect(carlaInfo?.tokenIds).toEqual(['escudo', 'lirio'])
    expect(carlaInfo?.borrowedFrom).toBeUndefined()
  })
})

describe('hostSession: empréstimo recusado', () => {
  it('só se empresta de quem está FORA, para quem está conectado, e nunca para si', () => {
    const m = mesa()
    // A Ana está conectada: a ficha é dela, jogando.
    expect(m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo()).lent).toEqual([])
    m.s.disconnect('c1')
    m.s.disconnect('c3')
    // A Carla caiu também: ninguém jogaria a ficha.
    expect(m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo()).lent).toEqual([])
    expect(m.s.lendTokens(m.ana.playerId, m.ana.playerId, m.mundo()).lent).toEqual([])
    expect(m.s.lendTokens('ninguem', m.bruno.playerId, m.mundo()).lent).toEqual([])
    expect(m.s.listPlayers(m.mundo()).find((p) => p.playerId === m.ana.playerId)?.lentTo).toBeUndefined()
  })

  it('a mesma ficha não é emprestada duas vezes', () => {
    const m = mesa()
    const dani = m.entra('c4', 'Dani')
    m.s.disconnect('c1')
    expect(m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo()).lent).toEqual(['lirio'])
    expect(m.s.lendTokens(m.ana.playerId, dani.playerId, m.mundo()).lent).toEqual([])
    expect(m.s.listPlayers(m.mundo()).find((p) => p.playerId === dani.playerId)?.status).toBe('waiting')
  })
})

describe('hostSession: o empréstimo não entrega o que está escondido', () => {
  it('a Carla não recebe o explorado da Ana nem o recado só para a Ana', () => {
    const m = mesa()
    // O mestre revelou a planta do Hall à Ana: o canto (1400, 450) é memória SÓ dela.
    m.s.revealPlan(m.ana.playerId, m.mundo())
    m.s.broadcast(m.mundo())
    m.s.disconnect('c1')
    const recado = m.s.playerNote(m.ana.playerId, 'a chave esta no poco', m.mundo())
    expect(recado.delivery).toBe('queued')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    const depois = m.s.broadcast(m.mundo())
    const carla = snapshotOf(depois, 'c3')
    expect(carla.ownTokens).toContain('lirio')
    expect(explorado(carla, 1400, 450)).toBe(false)
    expect(wireFor(depois, 'c3')).not.toContain('a chave esta no poco')
    expect(wireFor(depois, 'c3')).not.toContain(m.ana.resumeToken)
    // O recado continua esperando a Ana: é ela quem o lê ao voltar.
    const volta = m.entra('c9', 'Ana', m.ana.resumeToken)
    expect(wireFor(volta.result, 'c9')).toContain('a chave esta no poco')
    expect(wireFor(volta.result, 'c3')).not.toContain('a chave esta no poco')
  })

  it('o Lírio emprestado enxerga com o raio da Ana (300), não com o da Carla (700), e o explorado da Ana bate com isso', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.s.lendTokens(m.ana.playerId, m.carla.playerId, m.mundo())
    // O Lírio no fundo do Hall, longe do Escudo da Carla (300, 100).
    m.mover('lirio', 1400, 250)
    const carla = snapshotOf(m.s.broadcast(m.mundo()), 'c3')
    const carlaVe = (x: number, y: number): boolean => carla.vision.some((ring) => pointInRing({ x, y }, ring))
    // Perto do Lírio (150 px): dentro do raio da Ana, a Carla vê.
    expect(carlaVe(1250, 250)).toBe(true)
    // A 353 px do Lírio e a 776 px do Escudo: fora do raio da Ana. Com o raio
    // da Carla o Lírio veria aqui, e a célula iria pela rede para ela.
    expect(carlaVe(1050, 300)).toBe(false)
    // O que a ficha registra no explorado da Ana é o mesmo recorte.
    m.mover('lirio', 100, 100)
    m.s.broadcast(m.mundo())
    const ana = snapshotOf(m.entra('c9', 'Ana', m.ana.resumeToken).result, 'c9')
    expect(explorado(ana, 1250, 250)).toBe(true)
    expect(explorado(ana, 1050, 300)).toBe(false)
  })

  it('ficha de outra cena não é emprestada a quem já está numa cena: nada da Cripta chega à Carla', () => {
    const m = mesa()
    m.s.disconnect('c2')
    const r = m.s.lendTokens(m.bruno.playerId, m.carla.playerId, m.mundo())
    expect(r.lent).toEqual([])
    const depois = m.s.broadcast(m.mundo())
    // Nada foi emprestado: a tela da Carla não muda e nada sai para ela.
    expect(depois.outbound.filter((o) => o.clientId === 'c3')).toEqual([])
    expect(m.s.listPlayers(m.mundo()).find((p) => p.playerId === m.carla.playerId)?.tokenIds).toEqual(['escudo'])
    expect(wireFor(depois, 'c3')).not.toContain('machado')
    expect(wireFor(depois, 'c3')).not.toContain('Cripta Rubra')
    expect(wireFor(depois, 'c3')).not.toContain('m-cripta')
  })

  it('quem estava sem ficha recebe a cena da ficha emprestada, e só ela', () => {
    const m = mesa()
    const dani = m.entra('c4', 'Dani')
    m.s.disconnect('c2')
    expect(m.s.lendTokens(m.bruno.playerId, dani.playerId, m.mundo()).lent).toEqual(['machado'])
    const depois = m.s.broadcast(m.mundo())
    const snap = snapshotOf(depois, 'c4')
    expect(snap.map.id).toBe('m-cripta')
    expect(snap.ownTokens).toEqual(['machado'])
    // Nada do Hall (a cena da Carla e da Ana) vai junto.
    expect(wireFor(depois, 'c4')).not.toContain('escudo')
    expect(wireFor(depois, 'c4')).not.toContain('lirio')
    // E o painel do Grupo da Carla continua sem nome nem id de cena de ninguém.
    const party = m.s.partyUpdates(m.mundo())
    expect(wireFor(party, 'c3')).not.toContain('Cripta Rubra')
    expect(wireFor(party, 'c3')).toContain('Dani')
  })
})
