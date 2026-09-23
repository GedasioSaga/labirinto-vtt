/**
 * TELA DA MESA — a página de espectador para a TV ou o projetor.
 *
 * Ela entra com o código da sala, sem ficha, e mostra a cena que o MESTRE
 * escolheu na aba Jogo com só o que o grupo já viu: a união da visão de quem
 * está lá agora e da memória de quem já passou por lá. Nada do mestre: nem o
 * nome da cena, nem ficha que ninguém vê, nem ficha secreta, nem quem está em
 * outra cena. Estes testes olham o que SAI pela rede para a tela.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, MAX_TABLE_SCREENS, tableSceneKey, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RAIO = 700

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x: number): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 500, blocksLight: true, blocksMove: true, door: null }
}

function pino(id: string, x: number, y: number, description: string): Pin {
  return { id, x, y, kind: 'exclamacao', description, image: null }
}

/**
 * Salão com três salas separadas por parede (x = 750 e x = 1500). Ana na sala
 * 1, Bia na sala 2, ninguém na sala 3 — onde está o monstro e o tesouro.
 */
function salao(tokens: Token[]): MapData {
  return {
    ...createEmptyMap('m-salao', 'Salao Norte', 45, 10, 50),
    walls: [parede('w1', 750), parede('w2', 1500)],
    pins: [pino('altar', 300, 250, 'Altar de pedra'), pino('tesouro', 1900, 250, 'Tesouro escondido')],
    tokens,
  }
}

const FICHAS_SALAO = [
  ficha('heroi', 100, 250),
  ficha('ladino', 1000, 250),
  ficha('monstro', 1900, 250),
  ficha('espiao', 200, 300, { secret: true }),
  ficha('fantasma', 150, 200, { hidden: true }),
]

function cripta(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-cripta', 'Cripta Rubra', 20, 10, 50), tokens }
}

function mundo(salaoTokens: Token[] = FICHAS_SALAO, criptaTokens: Token[] = [ficha('mago', 200, 200)]): HostWorld {
  return {
    open: { sceneId: 's-salao', name: 'Salao Norte', map: salao(salaoTokens) },
    background: [{ sceneId: 's-cripta', name: 'Cripta Rubra', map: cripta(criptaTokens) }],
  }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (heroi) e Bia (ladino) no Salão, Caio (mago) na Cripta. */
function mesaMontada(world: HostWorld = mundo()) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const ana = playerIdOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, world))
  const bia = playerIdOf(s.handleMessage('c-bia', { type: 'join', code: CODE, name: 'Bia' }, world))
  const caio = playerIdOf(s.handleMessage('c-caio', { type: 'join', code: CODE, name: 'Caio' }, world))
  s.assignToken(ana, 'heroi')
  s.assignToken(bia, 'ladino')
  s.assignToken(caio, 'mago')
  return { s, ana, bia, caio }
}

const ENTRAR_COMO_MESA = { type: 'join', code: CODE, name: 'Mesa', role: 'table' }

function paraTela(r: HostResult, clientId = 'c-tv'): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function snapshotDaTela(r: HostResult, clientId = 'c-tv'): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = paraTela(r, clientId)[0]
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para a tela, veio ${JSON.stringify(msg)}`)
  return msg
}

describe('tela da mesa: entrar', () => {
  it('entra com o código, sem virar jogador, e espera o mestre escolher a cena', () => {
    const { s } = mesaMontada()
    const r = s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    expect(r.outbound).toEqual([{ clientId: 'c-tv', msg: { type: 'lobby.waiting' } }])
    expect(s.listPlayers().map((p) => p.name)).toEqual(['Ana', 'Bia', 'Caio'])
    expect(s.tableScreens()).toBe(1)
  })

  it('código errado: bad_code, e não conta como tela', () => {
    const { s } = mesaMontada()
    const r = s.handleMessage('c-tv', { ...ENTRAR_COMO_MESA, code: 'ZZZZZZ' }, mundo())
    expect(r.outbound).toEqual([{ clientId: 'c-tv', msg: { type: 'error', reason: 'bad_code' } }])
    expect(s.tableScreens()).toBe(0)
  })

  it('sem cena escolhida, o broadcast manda espera à tela e nunca o mapa do editor', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    expect(paraTela(s.broadcast(mundo()))).toEqual([{ type: 'lobby.waiting' }])
  })

  it(`passou de ${MAX_TABLE_SCREENS} telas: table_full`, () => {
    const { s } = mesaMontada()
    for (let i = 0; i < MAX_TABLE_SCREENS; i += 1) s.handleMessage(`c-tv${i}`, ENTRAR_COMO_MESA, mundo())
    const r = s.handleMessage('c-tv-extra', ENTRAR_COMO_MESA, mundo())
    expect(r.outbound).toEqual([{ clientId: 'c-tv-extra', msg: { type: 'error', reason: 'table_full' } }])
    expect(s.tableScreens()).toBe(MAX_TABLE_SCREENS)
  })
})

describe('tela da mesa: o que ela recebe da cena escolhida', () => {
  it('a união do que o grupo vê agora, sem o que ninguém vê e sem nada do mestre', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    s.setTableScene('s-salao')
    const r = s.broadcast(mundo())
    const snap = snapshotDaTela(r)

    // Ana vê a sala 1, Bia a sala 2: as duas fichas aparecem.
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'ladino'])
    // A tela não tem ficha: nada é "dela" para arrastar.
    expect(snap.ownTokens).toEqual([])
    // Uma visão por ficha do grupo na cena.
    expect(snap.vision.length).toBe(2)
    expect(snap.map.name).toBe('')
    expect(snap.map.pins.map((p) => p.id)).toEqual(['altar'])

    const texto = JSON.stringify(paraTela(r))
    // Sala 3 ninguém viu; ficha secreta e escondida são do mestre; Caio está em outra cena.
    for (const segredo of ['monstro', 'Tesouro escondido', 'espiao', 'fantasma', 'mago', 'Cripta Rubra', 'Salao Norte', 'm-cripta']) {
      expect(texto).not.toContain(segredo)
    }
  })

  it('cada jogador continua recebendo só a própria visão (a tela não vaza para eles)', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    s.setTableScene('s-salao')
    const r = s.broadcast(mundo())
    const daAna = r.outbound.find((o) => o.clientId === 'c-ana')?.msg
    if (daAna?.type !== 'snapshot') throw new Error('esperava snapshot para Ana')
    expect(daAna.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(daAna)).not.toContain('ladino')
  })

  it('a memória do grupo fica: quem saiu da cena deixa o que viu; o que ninguém viu continua preto', () => {
    const { s, ana } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    s.setTableScene('s-salao')
    // Ana olha a sala 1 e depois é levada para a Cripta.
    s.broadcast(mundo())
    expect(s.sendPlayer(ana, 's-cripta', null, mundo()).applyTransfer?.toSceneId).toBe('s-cripta')
    const depois = mundo(
      FICHAS_SALAO.filter((t) => t.id !== 'heroi'),
      [ficha('mago', 200, 200), ficha('heroi', 500, 250)],
    )
    const snap = snapshotDaTela(s.broadcast(depois))

    // A ficha de Ana saiu da cena escolhida: não aparece na tela.
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['ladino'])
    // Mas o que ela viu da sala 1 continua na planta da tela.
    expect(snap.map.pins.map((p) => p.id)).toEqual(['altar'])
    const explored = decodeExploration(snap.explored)
    if (explored === null) throw new Error('explored inválido')
    expect(isPointExplored(explored, { x: 300, y: 250 })).toBe(true)
    expect(isPointExplored(explored, { x: 1900, y: 250 })).toBe(false)
    expect(JSON.stringify(snap)).not.toContain('Tesouro escondido')
  })

  it('trocar a cena da tela troca o mapa dela; cena que não está aberta volta a esperar', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    s.setTableScene('s-cripta')
    const snap = snapshotDaTela(s.broadcast(mundo()))
    expect(snap.map.id).toBe('m-cripta')
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['mago'])
    expect(JSON.stringify(snap)).not.toContain('heroi')
    expect(s.tableScene()).toBe('s-cripta')

    s.setTableScene('s-inexistente')
    expect(paraTela(s.broadcast(mundo()))).toEqual([{ type: 'lobby.waiting' }])
  })

  it('mapa solto: a chave da cena é o id do mapa', () => {
    const solto = salao(FICHAS_SALAO)
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const ana = playerIdOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, solto))
    s.assignToken(ana, 'heroi')
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, solto)
    s.setTableScene(tableSceneKey({ sceneId: null, name: solto.name, map: solto }))
    const snap = snapshotDaTela(s.broadcast(solto))
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(snap.map.name).toBe('')
  })
})

describe('tela da mesa: só olha', () => {
  it('não move ficha, não abre porta, não sinaliza e não vira jogador', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    s.setTableScene('s-salao')
    const w = mundo()
    expect(s.handleMessage('c-tv', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 120, y: 250 }, w).outbound[0]?.msg).toEqual({
      type: 'error',
      reason: 'not_joined',
    })
    expect(s.handleMessage('c-tv', { type: 'signal', x: 100, y: 100 }, w).signal).toBeUndefined()
    expect(s.handleMessage('c-tv', { type: 'door.toggle', wallId: 'w1' }, w).applyDoor).toBeUndefined()
    expect(s.handleMessage('c-tv', { type: 'join', code: CODE, name: 'Intruso' }, w).outbound).toEqual([
      { clientId: 'c-tv', msg: { type: 'error', reason: 'already_joined' } },
    ])
    expect(s.listPlayers().map((p) => p.name)).toEqual(['Ana', 'Bia', 'Caio'])
    // Jogador que já entrou também não vira tela.
    expect(s.handleMessage('c-ana', ENTRAR_COMO_MESA, w).outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'error', reason: 'already_joined' } }])
  })

  it('o laser e o recado do mestre não vão à tela', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    s.setTableScene('s-salao')
    expect(paraTela(s.laser({ type: 'laser', points: [{ x: 1, y: 1 }] }, mundo()))).toEqual([])
    expect(paraTela(s.sceneNote('s-salao', 'Cuidado com o altar', mundo()))).toEqual([])
  })

  it('fechar a sala avisa a tela; a tela que caiu sai da conta', () => {
    const { s } = mesaMontada()
    s.handleMessage('c-tv', ENTRAR_COMO_MESA, mundo())
    expect(paraTela(s.closeRoom())).toEqual([{ type: 'room.closed' }])
    s.disconnect('c-tv')
    expect(s.tableScreens()).toBe(0)
    s.setTableScene('s-salao')
    expect(paraTela(s.broadcast(mundo()))).toEqual([])
  })
})
