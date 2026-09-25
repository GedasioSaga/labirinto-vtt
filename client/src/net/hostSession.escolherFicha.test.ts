/**
 * QUEM CHEGA NO MEIO DA SESSÃO ESCOLHE A PRÓPRIA FICHA.
 *
 * O jogador sem personagem recebe `seat.options`: as fichas que o mestre marcou
 * "Ficha de jogador" e que ninguém tem — nem quem caiu, nem o assento da mesa
 * guardada que ainda não voltou. Pede uma (`seat.claim`); o mestre confirma ou
 * recusa. A lista leva só id e nome: nada de cena, posição, ficha de NPC,
 * ficha secreta ou escondida no editor.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, name: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 125, y: 125, size: 1, image: null, ...extra }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 20, 10, 50), tokens }
}

const PC = { playerCharacter: true }

/** Vila (aberta) e Mina Funda (de fundo). */
function mundo(extraVila: Token[] = []): HostWorld {
  const vila: HostScene = {
    sceneId: 's-vila',
    name: 'Vila de Pedravel',
    map: mapa('m-vila', 'Vila de Pedravel', [
      ficha('t-kael', 'Kael', PC),
      ficha('t-lira', 'Lira', PC),
      ficha('t-dragao', 'Dragão Vermelho'),
      ficha('t-espiao', 'Espião do Rei', { ...PC, secret: true }),
      ficha('t-sombra', 'Sombra', { ...PC, hidden: true }),
      ficha('t-carla', 'Carla Arqueira', PC),
      ...extraVila,
    ]),
  }
  const mina: HostScene = {
    sceneId: 's-mina',
    name: 'Mina Funda',
    map: mapa('m-mina', 'Mina Funda', [ficha('t-bruna', 'Bruna', PC), ficha('t-velho', 'Velho Minerador', PC)]),
  }
  return { open: vila, background: [mina] }
}

function welcomeId(r: HostResult): string {
  const msg = r.outbound[0]?.msg
  if (msg?.type !== 'welcome') throw new Error('esperava welcome')
  return msg.playerId
}

/** Ana joga com Lira; Bruno jogava com o Velho e caiu; o assento guardado da Carla espera por ela. */
function mesa() {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: 300,
    now: () => 10_000,
    randomId: () => `id-${(n += 1)}`,
    restoreSeats: [{ name: 'Carla', tokenIds: ['t-carla'], visionRadius: null, sceneKey: null }],
  })
  const w = mundo()
  const ana = welcomeId(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, w))
  s.assignToken(ana, 't-lira')
  const bruno = welcomeId(s.handleMessage('c-bruno', { type: 'join', code: CODE, name: 'Bruno' }, w))
  s.assignToken(bruno, 't-velho')
  s.disconnect('c-bruno')
  return { s, w, ana, bruno }
}

function paraCliente(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function opcoes(r: HostResult, clientId: string): unknown {
  return paraCliente(r, clientId).find((m) => m.type === 'seat.options')
}

function entraHugo(m: ReturnType<typeof mesa>) {
  const r = m.s.handleMessage('c-hugo', { type: 'join', code: CODE, name: 'Hugo' }, m.w)
  return { r, hugo: welcomeId(r) }
}

describe('seat.options: a lista de fichas livres de quem chega sem personagem', () => {
  it('quem entra sem ficha recebe só as fichas de jogador sem dono, em ordem de nome', () => {
    const m = mesa()
    const { r } = entraHugo(m)
    expect(opcoes(r, 'c-hugo')).toEqual({
      type: 'seat.options',
      tokens: [
        { tokenId: 't-bruna', name: 'Bruna' },
        { tokenId: 't-kael', name: 'Kael' },
      ],
    })
  })

  it('NÃO chega ficha de outro jogador (conectado, caído ou do assento guardado), NPC, secreta, escondida, nome de cena nem posição', () => {
    const m = mesa()
    const { r } = entraHugo(m)
    const tudo = JSON.stringify(paraCliente(r, 'c-hugo'))
    for (const escondido of ['Lira', 'Velho Minerador', 'Carla Arqueira', 'Dragão Vermelho', 'Espião do Rei', 'Sombra', 'Vila de Pedravel', 'Mina Funda', 's-mina', 'm-vila', '"x"', '"y"', 'playerCharacter']) {
      expect(tudo).not.toContain(escondido)
    }
    expect(tudo).toContain('Kael')
  })

  it('quem já joga não recebe a lista', () => {
    const m = mesa()
    const r = m.s.seatOptionsUpdates(m.w)
    expect(paraCliente(r, 'c-ana')).toEqual([])
    expect(r.outbound).toEqual([])
  })

  it('a lista muda quando uma ficha ganha dono, e só sai de novo quando muda', () => {
    const m = mesa()
    const { hugo } = entraHugo(m)
    const iris = m.s.handleMessage('c-iris', { type: 'join', code: CODE, name: 'Iris' }, m.w)
    expect(opcoes(iris, 'c-iris')).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }, { tokenId: 't-kael', name: 'Kael' }] })
    // Quem entrou já leu a lista no join: sem mudança, nada sai de novo.
    expect(m.s.seatOptionsUpdates(m.w).outbound).toEqual([])
    m.s.assignToken(hugo, 't-kael')
    const r = m.s.seatOptionsUpdates(m.w)
    expect(opcoes(r, 'c-iris')).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }] })
    expect(paraCliente(r, 'c-hugo')).toEqual([])
    expect(m.s.seatOptionsUpdates(m.w).outbound).toEqual([])
  })

  it('mesa sem ficha de jogador marcada não manda lista nenhuma; a última livre que some manda a lista vazia', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 300, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const semMarca: HostWorld = { open: { sceneId: null, name: 'Solto', map: mapa('m1', 'Solto', [ficha('t-orc', 'Orc')]) }, background: [] }
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Hugo' }, semMarca)
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    const comMarca: HostWorld = { open: { sceneId: null, name: 'Solto', map: mapa('m1', 'Solto', [ficha('t-orc', 'Orc', PC)]) }, background: [] }
    expect(opcoes(s.seatOptionsUpdates(comMarca), 'c1')).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-orc', name: 'Orc' }] })
    expect(opcoes(s.seatOptionsUpdates(semMarca), 'c1')).toEqual({ type: 'seat.options', tokens: [] })
  })
})

describe('seat.claim: o pedido de quem chega, e a resposta do mestre', () => {
  it('pedir uma ficha livre vira pedido para o mestre e "pending" só para quem pediu', () => {
    const m = mesa()
    const { hugo } = entraHugo(m)
    const r = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w)
    expect(r.outbound).toEqual([{ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'pending' } }])
    expect(r.seatClaim).toEqual({ requestId: expect.any(String), playerId: hugo, playerName: 'Hugo', tokenId: 't-kael', tokenName: 'Kael' })
  })

  it('ficha de outro jogador, NPC, secreta ou inexistente: "unavailable", e nada chega ao mestre', () => {
    const m = mesa()
    entraHugo(m)
    for (const tokenId of ['t-lira', 't-velho', 't-carla', 't-dragao', 't-espiao', 't-sombra', 't-nao-existe']) {
      const r = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId }, m.w)
      expect(r.outbound).toEqual([{ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'unavailable' } }])
      expect(r.seatClaim).toBeUndefined()
    }
  })

  it('"Aceitar": a ficha passa a ser dele e o mapa dele chega no broadcast', () => {
    const m = mesa()
    const { hugo } = entraHugo(m)
    const pedido = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    m.s.approveSeatClaim(pedido.requestId, m.w)
    const info = m.s.listPlayers().find((p) => p.playerId === hugo)
    expect(info?.tokenIds).toEqual(['t-kael'])
    expect(info?.status).toBe('playing')
    expect(m.s.isSeatClaimPending(pedido.requestId)).toBe(false)
    const snap = paraCliente(m.s.broadcast(m.w), 'c-hugo').find((msg) => msg.type === 'snapshot')
    expect(snap?.type === 'snapshot' ? snap.ownTokens : null).toEqual(['t-kael'])
  })

  it('"Não": "denied" a quem pediu, e ele continua sem personagem', () => {
    const m = mesa()
    const { hugo } = entraHugo(m)
    const pedido = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    expect(m.s.denySeatClaim(pedido.requestId).outbound).toEqual([{ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'denied' } }])
    expect(m.s.listPlayers().find((p) => p.playerId === hugo)?.tokenIds).toEqual([])
    expect(m.s.isSeatClaimPending(pedido.requestId)).toBe(false)
  })

  it('dois pedem a mesma ficha: aceita o primeiro, o segundo lê "unavailable" e o pedido dele morre', () => {
    const m = mesa()
    entraHugo(m)
    welcomeId(m.s.handleMessage('c-iris', { type: 'join', code: CODE, name: 'Iris' }, m.w))
    const doHugo = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    const daIris = m.s.handleMessage('c-iris', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    if (doHugo === undefined || daIris === undefined) throw new Error('os dois pedidos deveriam chegar ao mestre')
    const r = m.s.approveSeatClaim(doHugo.requestId, m.w)
    expect(paraCliente(r, 'c-iris')).toEqual([{ type: 'seat.claim.state', state: 'unavailable' }])
    expect(m.s.isSeatClaimPending(daIris.requestId)).toBe(false)
    // "Aceitar" atrasado no pedido morto não tira a ficha de ninguém.
    expect(m.s.approveSeatClaim(daIris.requestId, m.w).outbound).toEqual([])
    expect(m.s.listPlayers().find((p) => p.name === 'Iris')?.tokenIds).toEqual([])
  })

  it('o mestre deu a ficha a outro pelo painel antes de responder: "Aceitar" não vale mais', () => {
    const m = mesa()
    entraHugo(m)
    const pedido = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const r = m.s.assignToken(m.ana, 't-kael')
    expect(paraCliente(r, 'c-hugo')).toEqual([{ type: 'seat.claim.state', state: 'unavailable' }])
    expect(m.s.isSeatClaimPending(pedido.requestId)).toBe(false)
  })

  it('o mestre desmarcou "Ficha de jogador" antes de responder: "Aceitar" responde "unavailable"', () => {
    const m = mesa()
    const { hugo } = entraHugo(m)
    const pedido = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const semMarca = mundo()
    semMarca.open.map = { ...semMarca.open.map, tokens: semMarca.open.map.tokens.map((t) => (t.id === 't-kael' ? { ...t, playerCharacter: false } : t)) }
    const r = m.s.approveSeatClaim(pedido.requestId, semMarca)
    expect(r.outbound).toEqual([{ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'unavailable' } }])
    expect(m.s.listPlayers().find((p) => p.playerId === hugo)?.tokenIds).toEqual([])
  })

  it('um pedido por vez: pedir de novo com um esperando repete "pending" sem pedido novo ao mestre', () => {
    const m = mesa()
    entraHugo(m)
    m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w)
    const r = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-bruna' }, m.w)
    expect(r.outbound).toEqual([{ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'pending' } }])
    expect(r.seatClaim).toBeUndefined()
  })

  it('recusado, pedir de novo logo em seguida é "too_soon"', () => {
    let agora = 10_000
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 300, now: () => agora, randomId: () => `id-${(n += 1)}` })
    const w = mundo()
    s.handleMessage('c-hugo', { type: 'join', code: CODE, name: 'Hugo' }, w)
    const pedido = s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, w).seatClaim
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    s.denySeatClaim(pedido.requestId)
    agora += 500
    const cedo = s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, w)
    expect(cedo.outbound).toEqual([{ clientId: 'c-hugo', msg: { type: 'seat.claim.state', state: 'too_soon' } }])
    expect(cedo.seatClaim).toBeUndefined()
    agora += 5_000
    expect(s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, w).seatClaim?.tokenId).toBe('t-kael')
  })

  it('quem já joga não pede ficha: "unavailable" e nada muda', () => {
    const m = mesa()
    const r = m.s.handleMessage('c-ana', { type: 'seat.claim', tokenId: 't-kael' }, m.w)
    expect(r.outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'seat.claim.state', state: 'unavailable' } }])
    expect(r.seatClaim).toBeUndefined()
    expect(m.s.listPlayers().find((p) => p.playerId === m.ana)?.tokenIds).toEqual(['t-lira'])
  })

  it('a conexão caiu com o pedido esperando: o pedido morre', () => {
    const m = mesa()
    entraHugo(m)
    const pedido = m.s.handleMessage('c-hugo', { type: 'seat.claim', tokenId: 't-kael' }, m.w).seatClaim
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    m.s.disconnect('c-hugo')
    expect(m.s.isSeatClaimPending(pedido.requestId)).toBe(false)
    expect(m.s.approveSeatClaim(pedido.requestId, m.w).outbound).toEqual([])
  })

  it('sem entrar na sala: "not_joined"', () => {
    const m = mesa()
    expect(m.s.handleMessage('c-estranho', { type: 'seat.claim', tokenId: 't-kael' }, m.w).outbound).toEqual([
      { clientId: 'c-estranho', msg: { type: 'error', reason: 'not_joined' } },
    ])
  })
})

describe('seat.options na volta à espera: a lista velha não fica na tela', () => {
  function semMarcaNoKael(): HostWorld {
    const w = mundo()
    w.open.map = { ...w.open.map, tokens: w.open.map.tokens.map((t) => (t.id === 't-kael' ? { ...t, playerCharacter: false } : t)) }
    return w
  }

  it('Hugo joga com Kael, Zé ganha Bruna, o mestre desmarca Kael: Hugo volta à espera e recebe a lista VAZIA', () => {
    const m = mesa()
    const { r, hugo } = entraHugo(m)
    expect(opcoes(r, 'c-hugo')).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }, { tokenId: 't-kael', name: 'Kael' }] })
    m.s.assignToken(hugo, 't-kael')
    m.s.seatOptionsUpdates(m.w)
    const ze = welcomeId(m.s.handleMessage('c-ze', { type: 'join', code: CODE, name: 'Zé' }, m.w))
    m.s.assignToken(ze, 't-bruna')
    m.s.seatOptionsUpdates(m.w)
    const semKael = semMarcaNoKael()
    expect(paraCliente(m.s.unassignToken(hugo, 't-kael'), 'c-hugo')).toEqual([{ type: 'lobby.waiting' }])
    const volta = m.s.seatOptionsUpdates(semKael)
    expect(opcoes(volta, 'c-hugo')).toEqual({ type: 'seat.options', tokens: [] })
    // Enviada uma vez, a lista vazia não sai de novo sem mudar.
    expect(paraCliente(m.s.seatOptionsUpdates(semKael), 'c-hugo')).toEqual([])
  })

  it('volta à espera com a MESMA lista que ele guardou: nada sai de novo; com lista diferente, sai a atual', () => {
    const m = mesa()
    const { hugo } = entraHugo(m)
    m.s.assignToken(hugo, 't-kael')
    m.s.seatOptionsUpdates(m.w)
    m.s.unassignToken(hugo, 't-kael')
    // Ele guardou [Bruna, Kael] do join, e a lista de agora é a mesma.
    expect(paraCliente(m.s.seatOptionsUpdates(m.w), 'c-hugo')).toEqual([])
    m.s.assignToken(hugo, 't-bruna')
    m.s.seatOptionsUpdates(m.w)
    m.s.unassignToken(hugo, 't-bruna')
    expect(paraCliente(m.s.seatOptionsUpdates(semMarcaNoKael()), 'c-hugo')).toEqual([{ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }] }])
  })

  it('"É ela" na espera: o welcome de novo apaga a lista no jogador, e a lista atual vai logo atrás', () => {
    const m = mesa()
    const iris = welcomeId(m.s.handleMessage('c-iris', { type: 'join', code: CODE, name: 'Iris' }, m.w))
    m.s.disconnect('c-iris')
    const entrou = m.s.handleMessage('c-iris2', { type: 'join', code: CODE, name: 'Iris' }, m.w)
    const nova = welcomeId(entrou)
    expect(entrou.returnCandidate).toEqual({ playerId: nova, previousId: iris, name: 'Iris' })
    expect(opcoes(entrou, 'c-iris2')).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }, { tokenId: 't-kael', name: 'Kael' }] })
    const r = m.s.confirmReturn(nova, iris, m.w)
    expect(paraCliente(r, 'c-iris2').map((msg) => msg.type)).toEqual(['welcome', 'lobby.waiting', 'seat.options'])
    expect(opcoes(r, 'c-iris2')).toEqual({ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }, { tokenId: 't-kael', name: 'Kael' }] })
  })
})
