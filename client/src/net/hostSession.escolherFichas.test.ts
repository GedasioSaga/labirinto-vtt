import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinPassage, Token } from '../types/map'
import { createHostSession, type AppliedTransfer, type HostResult, type HostWorld } from './hostSession'
import { PIN_TRAVEL_MAX_TOKENS, type HostMessage } from './protocol'
import { pinTravelChoices } from '../lib/pinTravelers'
import { snapPointForTarget } from '../pixi/tokenInteraction'

/**
 * ESCOLHER FICHAS NO PINO (relato do Enzo): com duas fichas perto do pino, o
 * host decidia sozinho quem passava — a mais perto, e junto as outras dele a
 * até 2 casas. Agora o pedido diz QUAIS fichas dele passam (`tokenIds`), e o
 * host confere cada uma: dele, no tabuleiro que ele vê e no grupo do pino.
 * Ficha escondida pelo mestre, de outro jogador ou fora do grupo recusa com o
 * mesmo motivo genérico de um id inventado: o pedido não vira oráculo do que
 * a névoa ou o mestre escondem. O mestre lê quais fichas vão.
 */

const CODE = 'AB12CD'
const ESTRADA = 'cena-estrada'
const VILA = 'cena-vila'
const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PONTE_A = casa(10, 5)
const PONTE_B = casa(20, 5)
/** Entre dois pedidos do mesmo jogador: acima dos limites de pedido do host. */
const PAUSA_MS = 60_000

function ficha(id: string, p: { x: number; y: number }, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id.toUpperCase(), x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function ponte(id: string, p: { x: number; y: number }, sceneId: string, pinId: string, passagem: PinPassage): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description: 'Ponte', image: null, destino: { sceneId, pinId }, passagem }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/**
 * Estrada com a ponte. Bruno (c1) tem a ficha dele (a mais perto do pino), o
 * pônei colado, a coruja a 2 casas na diagonal e o cão a 3 casas (fora do
 * grupo). Ana (c2) tem o gato, colado em Bruno.
 */
function mesa(passagem: PinPassage = 'pede') {
  const onde: Record<string, { cena: string; x: number; y: number }> = {
    bruno: { cena: ESTRADA, ...casa(9, 6) },
    ponei: { cena: ESTRADA, ...casa(8, 6) },
    coruja: { cena: ESTRADA, ...casa(11, 8) },
    cao: { cena: ESTRADA, ...casa(6, 6) },
    gato: { cena: ESTRADA, ...casa(10, 6) },
  }
  const patch: Record<string, Partial<Token>> = {}
  /** O que a Vila tem além do chão vazio: zona oculta, prédio com teto, camada escondida. */
  const vila: Partial<MapData> = {}
  const fichasEm = (cena: string) => Object.entries(onde).filter(([, p]) => p.cena === cena).map(([id, p]) => ficha(id, p, patch[id]))
  const world = (): HostWorld => ({
    open: {
      sceneId: ESTRADA,
      name: 'Estrada Real',
      map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens: fichasEm(ESTRADA), pins: [ponte('ponte-a', PONTE_A, VILA, 'ponte-b', passagem)] },
    },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), ...vila, tokens: fichasEm(VILA), pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a', passagem)] },
      },
    ],
  })
  let agora = 1_000_000
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  const entra = (clientId: string, name: string, tokenIds: string[]) => {
    ids[name] = welcomeOf(s.handleMessage(clientId, { type: 'join', code: CODE, name }, world()).outbound).playerId
    for (const tokenId of tokenIds) s.assignToken(ids[name], tokenId)
  }
  entra('c1', 'Bruno', ['bruno', 'ponei', 'coruja', 'cao'])
  entra('c2', 'Ana', ['gato'])
  s.broadcast(world())
  /** O pedido de Bruno; `tokenIds` ausente = o pedido de sempre. */
  const pede = (tokenIds?: string[]): HostResult => {
    agora += PAUSA_MS
    const msg = tokenIds === undefined ? { type: 'pin.travel.request' as const, pinId: 'ponte-a' } : { type: 'pin.travel.request' as const, pinId: 'ponte-a', tokenIds }
    return s.handleMessage('c1', msg, world())
  }
  const aprova = (r: HostResult): HostResult => {
    if (r.travelRequest === undefined) throw new Error('o pedido deveria valer')
    return s.approveTravel(r.travelRequest.requestId, world())
  }
  return { s, onde, patch, vila, world, pede, aprova }
}

/** Quem atravessa: a ficha principal e o séquito dela. */
const quemPassa = (transfer: AppliedTransfer | undefined): string[] =>
  transfer === undefined ? [] : [transfer.tokenId, ...(transfer.entourage ?? []).map((e) => e.tokenId)]

/** O que saiu para `clientId`. */
const para = (r: HostResult, clientId: string): HostMessage[] => r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)

describe('hostSession: escolher quais fichas passam pelo pino', () => {
  it('sem escolha, como antes: a mais perto e as dele a até 2 casas (o cão, a 3, fica)', () => {
    const t = mesa()
    expect(quemPassa(t.aprova(t.pede()).applyTransfer)).toEqual(['bruno', 'ponei', 'coruja'])
  })

  it('só a coruja escolhida: ela passa sozinha, e Bruno e o pônei (mais perto) ficam', () => {
    const t = mesa()
    const chegada = t.aprova(t.pede(['coruja'])).applyTransfer
    expect(chegada).toMatchObject({ tokenId: 'coruja', fromSceneId: ESTRADA, toSceneId: VILA })
    expect(chegada?.entourage).toBeUndefined()
  })

  it('Bruno e a coruja escolhidos: Bruno à frente, a coruja junto, o pônei colado fica', () => {
    const t = mesa()
    expect(quemPassa(t.aprova(t.pede(['coruja', 'bruno'])).applyTransfer)).toEqual(['bruno', 'coruja'])
  })

  it('pino livre: passa direto, só com as escolhidas', () => {
    const t = mesa('livre')
    const r = t.pede(['ponei'])
    expect(r.travelRequest).toBeUndefined()
    expect(quemPassa(r.applyTransfer)).toEqual(['ponei'])
  })

  it('o mestre lê QUAIS fichas vão, pelo nome delas; sem escolha a linha não muda', () => {
    const t = mesa()
    const escolhido = t.pede(['coruja', 'bruno'])
    expect(escolhido.travelRequest?.tokenNames).toEqual(['BRUNO', 'CORUJA'])
    // O pedido não responde nada ao jogador: a espera é a do "Aguardando o mestre".
    expect(para(escolhido, 'c1')).toEqual([])
    const t2 = mesa()
    const sempre = t2.pede()
    expect(sempre.travelRequest?.playerName).toBe('Bruno')
    expect(sempre.travelRequest?.tokenNames).toBeUndefined()
  })

  it('ficha fora do grupo do pino (o cão, a 3 casas) recusa o pedido inteiro, e nada vai ao mestre', () => {
    const t = mesa()
    const r = t.pede(['bruno', 'cao'])
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('não vira oráculo: ficha ESCONDIDA pelo mestre, ficha de OUTRO jogador e id inventado recebem a mesma resposta', () => {
    const inventado = mesa().pede(['bruno', 'nao-existe'])
    const t = mesa()
    t.patch.coruja = { hidden: true }
    const escondida = t.pede(['bruno', 'coruja'])
    const alheia = mesa().pede(['bruno', 'gato'])
    expect(para(inventado, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
    expect(para(escondida, 'c1')).toEqual(para(inventado, 'c1'))
    expect(para(alheia, 'c1')).toEqual(para(inventado, 'c1'))
    for (const r of [inventado, escondida, alheia]) {
      expect(r.travelRequest).toBeUndefined()
      expect(r.applyTransfer).toBeUndefined()
    }
  })

  it('ficha escondida pelo mestre nunca atravessa, nem como séquito de quem foi escolhido', () => {
    const t = mesa()
    t.patch.ponei = { hidden: true }
    expect(quemPassa(t.aprova(t.pede(['bruno', 'coruja'])).applyTransfer)).toEqual(['bruno', 'coruja'])
  })

  it('"Deixar ir" confere de novo: escolhida que o mestre escondeu depois do pedido recusa, sem mover ninguém', () => {
    const t = mesa()
    const pedido = t.pede(['bruno', 'coruja'])
    t.patch.coruja = { hidden: true }
    const r = t.aprova(pedido)
    expect(r.applyTransfer).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('depois de passar, o mapa de Bruno na Vila não traz as fichas que ficaram na Estrada', () => {
    const t = mesa()
    const chegada = t.aprova(t.pede(['coruja'])).applyTransfer
    if (chegada === undefined) throw new Error('a coruja deveria passar')
    t.onde.coruja = { cena: VILA, x: chegada.x, y: chegada.y }
    const mapas = t.s
      .broadcast(t.world())
      .outbound.flatMap((o) => (o.clientId === 'c1' && (o.msg.type === 'snapshot' || o.msg.type === 'delta') ? [o.msg.map] : []))
    const ultimo = mapas.at(-1)
    expect(ultimo?.tokens.map((tk) => tk.id)).toContain('coruja')
    expect(ultimo?.tokens.map((tk) => tk.id)).not.toContain('bruno')
    expect(ultimo?.tokens.map((tk) => tk.id)).not.toContain('gato')
  })
})

/**
 * Só ajudantes contratados na mão (nenhum personagem próprio): o carregador
 * (mais perto do pino, colado nele) e o guia, uma casa atrás. Ajudante segue
 * o jogador (`loanedFollowers`): os dois atravessam sempre, então não há o que
 * escolher — o host aceita só o mais perto, como o cartão oferece.
 */
function mesaDeAjudantes() {
  const tokens = [ficha('guia', casa(8, 6)), ficha('carregador', casa(9, 6))]
  const world = (): HostWorld => ({
    open: {
      sceneId: ESTRADA,
      name: 'Estrada Real',
      map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens, pins: [ponte('ponte-a', PONTE_A, VILA, 'ponte-b', 'pede')] },
    },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), tokens: [], pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a', 'pede')] },
      },
    ],
  })
  let agora = 1_000_000
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const bruno = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Bruno' }, world()).outbound).playerId
  for (const id of ['guia', 'carregador']) s.lendToken(bruno, id, { tarefa: 'carregar', minutos: null, visao: true })
  s.broadcast(world())
  const pede = (tokenIds?: string[]): HostResult => {
    agora += PAUSA_MS
    const msg = tokenIds === undefined ? { type: 'pin.travel.request' as const, pinId: 'ponte-a' } : { type: 'pin.travel.request' as const, pinId: 'ponte-a', tokenIds }
    return s.handleMessage('c1', msg, world())
  }
  const aprova = (r: HostResult): HostResult => {
    if (r.travelRequest === undefined) throw new Error('o pedido deveria valer')
    return s.approveTravel(r.travelRequest.requestId, world())
  }
  return { pede, aprova }
}

/** Quem atravessa com os ajudantes: a principal e os que seguem o jogador. */
const quemPassaComAjudantes = (transfer: AppliedTransfer | undefined): string[] =>
  transfer === undefined ? [] : [transfer.tokenId, ...(transfer.companions ?? []).map((c) => c.tokenId)]

describe('hostSession: só ajudantes na mão, não há o que escolher', () => {
  it('sem escolha: o carregador (mais perto) vai à frente e o guia segue junto', () => {
    const t = mesaDeAjudantes()
    expect(quemPassaComAjudantes(t.aprova(t.pede()).applyTransfer)).toEqual(['carregador', 'guia'])
  })

  it('desmarcar o carregador e pedir só o guia recusa: a caixa não pode prometer deixar para trás quem vai seguir de qualquer jeito', () => {
    const t = mesaDeAjudantes()
    const r = t.pede(['guia'])
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('pedido com o mais perto (o que o cartão oferece) vale, e os dois atravessam', () => {
    const t = mesaDeAjudantes()
    expect(quemPassaComAjudantes(t.aprova(t.pede(['carregador'])).applyTransfer)).toEqual(['carregador', 'guia'])
  })
})

/*
 * CONSERTOS DA VERSÃO ANTIGA (branch auto/f2-escolher-fichas-no-pino), portados
 * para a conta atual: onde as companheiras assentam, o "Deixar ir" e o teto.
 */

/** Quadrado de 40 px em volta do centro da casa: cobre a ficha dela e nenhuma outra casa. */
const quadrado = (p: { x: number; y: number }) => [
  { x: p.x - 20, y: p.y - 20 },
  { x: p.x + 20, y: p.y - 20 },
  { x: p.x + 20, y: p.y + 20 },
  { x: p.x - 20, y: p.y + 20 },
]

/** Bruno e a coruja passam para a Vila; `prepara` mexe na mesa antes do pedido. */
function passaBrunoECoruja(prepara: (t: ReturnType<typeof mesa>) => void = () => {}): AppliedTransfer {
  const t = mesa()
  prepara(t)
  const chegada = t.aprova(t.pede(['bruno', 'coruja'])).applyTransfer
  if (chegada === undefined) throw new Error('Bruno e a coruja deveriam passar')
  return chegada
}

/** A casa em que a coruja (a companheira) assentou. */
function casaDaCoruja(transfer: AppliedTransfer): { x: number; y: number } {
  const seat = transfer.entourage?.find((e) => e.tokenId === 'coruja')
  if (seat === undefined) throw new Error('a coruja deveria ir junto')
  return { x: seat.x, y: seat.y }
}

describe('hostSession: a casa da companheira não conta o que o jogador não vê', () => {
  it('NPC em zona oculta na casa que seria da coruja não a empurra: a casa pulada entregaria o NPC', () => {
    const livre = passaBrunoECoruja()
    const alvo = casaDaCoruja(livre)
    const r = passaBrunoECoruja((t) => {
      t.onde.npc = { cena: VILA, ...alvo }
      t.vila.concealZones = [{ id: 'z', name: 'Porão', revealed: false, points: quadrado(alvo) }]
    })
    expect(casaDaCoruja(r)).toEqual(alvo)
    expect({ x: r.x, y: r.y }).toEqual({ x: livre.x, y: livre.y })
  })

  it('NPC em zona oculta na casa que seria de Bruno, o da frente, também não o empurra', () => {
    const livre = passaBrunoECoruja()
    const alvo = { x: livre.x, y: livre.y }
    const r = passaBrunoECoruja((t) => {
      t.onde.npc = { cena: VILA, ...alvo }
      t.vila.concealZones = [{ id: 'z', name: 'Porão', revealed: false, points: quadrado(alvo) }]
    })
    expect({ x: r.x, y: r.y }).toEqual(alvo)
  })

  it('CONTROLE: com a zona revelada, o NPC à vista continua ocupando a casa que seria de Bruno', () => {
    const livre = passaBrunoECoruja()
    const alvo = { x: livre.x, y: livre.y }
    const r = passaBrunoECoruja((t) => {
      t.onde.npc = { cena: VILA, ...alvo }
      t.vila.concealZones = [{ id: 'z', name: 'Porão', revealed: true, points: quadrado(alvo) }]
    })
    expect(r.tokenId).toBe('bruno')
    expect({ x: r.x, y: r.y }).not.toEqual(alvo)
  })

  it('NPC sob teto fechado também não empurra: o interior do prédio não vaza pela casa pulada', () => {
    const livre = passaBrunoECoruja()
    const alvo = casaDaCoruja(livre)
    const r = passaBrunoECoruja((t) => {
      t.onde.npc = { cena: VILA, ...alvo }
      t.vila.regions = [
        { id: 'casa', points: quadrado(alvo), tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Casa', roof: true } },
      ]
    })
    expect(casaDaCoruja(r)).toEqual(alvo)
  })

  it('com a camada Fichas escondida na Vila, o NPC não ocupa casa', () => {
    const livre = passaBrunoECoruja()
    const alvo = casaDaCoruja(livre)
    const r = passaBrunoECoruja((t) => {
      t.onde.npc = { cena: VILA, ...alvo }
      t.vila.hiddenLayers = ['tokens']
    })
    expect(casaDaCoruja(r)).toEqual(alvo)
  })

  it('ficha escondida ou secreta pelo mestre não empurra a coruja', () => {
    const livre = passaBrunoECoruja()
    const alvo = casaDaCoruja(livre)
    for (const escondida of [{ hidden: true }, { secret: true }]) {
      const r = passaBrunoECoruja((t) => {
        t.onde.npc = { cena: VILA, ...alvo }
        t.patch.npc = escondida
      })
      expect(casaDaCoruja(r)).toEqual(alvo)
    }
  })

  it('CONTROLE: com a zona revelada o NPC está à vista e a coruja senta em outra casa', () => {
    const livre = passaBrunoECoruja()
    const alvo = casaDaCoruja(livre)
    const r = passaBrunoECoruja((t) => {
      t.onde.npc = { cena: VILA, ...alvo }
      t.vila.concealZones = [{ id: 'z', name: 'Porão', revealed: true, points: quadrado(alvo) }]
    })
    expect(r.entourage).toHaveLength(1)
    expect(casaDaCoruja(r)).not.toEqual(alvo)
  })

  it('o recorte que Bruno recebe na Vila depois de chegar continua sem o NPC da zona oculta', () => {
    const t = mesa()
    const alvo = casaDaCoruja(passaBrunoECoruja())
    t.onde.npc = { cena: VILA, ...alvo }
    t.vila.concealZones = [{ id: 'z', name: 'Porão', revealed: false, points: quadrado(alvo) }]
    const chegada = t.aprova(t.pede(['bruno', 'coruja'])).applyTransfer
    if (chegada === undefined) throw new Error('Bruno e a coruja deveriam passar')
    t.onde.bruno = { cena: VILA, x: chegada.x, y: chegada.y }
    t.onde.coruja = { cena: VILA, ...casaDaCoruja(chegada) }
    const mapas = t.s
      .broadcast(t.world())
      .outbound.flatMap((o) => (o.clientId === 'c1' && (o.msg.type === 'snapshot' || o.msg.type === 'delta') ? [o.msg.map] : []))
    const ultimo = mapas.at(-1)
    expect(ultimo?.tokens.map((tk) => tk.id)).toContain('coruja')
    expect(ultimo?.tokens.map((tk) => tk.id)).not.toContain('npc')
  })

  it('grade hexagonal: a coruja assenta no centro de um hexágono (a procura do "Reunir o grupo")', () => {
    const r = passaBrunoECoruja((t) => {
      t.vila.gridShape = 'hex'
    })
    const seat = casaDaCoruja(r)
    const centro = snapPointForTarget('token', 'hex', seat.x, seat.y, GRADE)
    expect(seat.x).toBeCloseTo(centro.x, 6)
    expect(seat.y).toBeCloseTo(centro.y, 6)
    expect(Math.hypot(seat.x - r.x, seat.y - r.y)).toBeGreaterThan(GRADE / 2)
  })

  it('coruja de 2 casas assenta na quina (linha da grade), sem cobrir Bruno', () => {
    const r = passaBrunoECoruja((t) => {
      t.patch.coruja = { size: 2 }
    })
    const seat = casaDaCoruja(r)
    expect(seat.x % GRADE).toBe(0)
    expect(seat.y % GRADE).toBe(0)
    expect(Math.hypot(seat.x - r.x, seat.y - r.y)).toBeGreaterThanOrEqual(1.5 * GRADE * 0.9)
  })
})

describe('hostSession: o "Deixar ir" confere as escolhidas pela folga do pedido', () => {
  it('o cão, fora da escolha, chegar mais perto do pino não derruba Bruno e a coruja', () => {
    const t = mesa()
    const pedido = t.pede(['bruno', 'coruja'])
    // Colado no pino: vira a ficha mais perto, e o grupo medido dele deixaria a coruja de fora.
    t.onde.cao = { cena: ESTRADA, ...casa(10, 4) }
    expect(quemPassa(t.aprova(pedido).applyTransfer)).toEqual(['bruno', 'coruja'])
  })

  it('Bruno, o da frente, dar um passo para o pino não deixa a coruja de fora', () => {
    const t = mesa()
    const pedido = t.pede(['bruno', 'coruja'])
    t.onde.bruno = { cena: ESTRADA, ...casa(10, 4) }
    expect(quemPassa(t.aprova(pedido).applyTransfer)).toEqual(['bruno', 'coruja'])
  })

  it('CONTROLE: a coruja que se afastou além da folga derruba o pedido inteiro, sem mover ninguém', () => {
    const t = mesa()
    const pedido = t.pede(['bruno', 'coruja'])
    t.onde.coruja = { cena: ESTRADA, ...casa(16, 8) }
    const r = t.aprova(pedido)
    expect(r.applyTransfer).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('só a coruja escolhida: o cão chegar colado ao pino não a derruba, e ele não passa junto', () => {
    const t = mesa()
    const pedido = t.pede(['coruja'])
    t.onde.cao = { cena: ESTRADA, ...casa(10, 4) }
    expect(quemPassa(t.aprova(pedido).applyTransfer)).toEqual(['coruja'])
  })
})

/**
 * Teto do pedido: Bruno com 10 fichas junto do pino. O cartão oferece as
 * `PIN_TRAVEL_MAX_TOKENS` mais perto, e o host aceita exatamente essas.
 */
function mesaCheia() {
  const casas = [casa(10, 6), casa(9, 6), casa(11, 6), casa(10, 7), casa(9, 7), casa(11, 7), casa(8, 6), casa(12, 6), casa(10, 8), casa(9, 8)]
  const tokens = casas.map((p, i) => ficha(`f${i}`, p))
  const world = (): HostWorld => ({
    open: {
      sceneId: ESTRADA,
      name: 'Estrada Real',
      map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens, pins: [ponte('ponte-a', PONTE_A, VILA, 'ponte-b', 'pede')] },
    },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), tokens: [], pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a', 'pede')] },
      },
    ],
  })
  let agora = 1_000_000
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const bruno = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Bruno' }, world()).outbound).playerId
  for (const t of tokens) s.assignToken(bruno, t.id)
  s.broadcast(world())
  const pede = (tokenIds: string[]): HostResult => {
    agora += PAUSA_MS
    return s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'ponte-a', tokenIds }, world())
  }
  return { world, tokens, pede }
}

describe('hostSession: as candidatas do pino param no teto do pedido', () => {
  it(`o cartão oferece as ${PIN_TRAVEL_MAX_TOKENS} mais perto, e o host aceita justamente essas`, () => {
    const t = mesaCheia()
    const pino = t.world().open.map.pins[0]
    if (pino === undefined) throw new Error('sem pino')
    const caixas = pinTravelChoices(t.tokens, t.tokens.map((tk) => tk.id), pino, GRADE).map((c) => c.id)
    expect(caixas).toHaveLength(PIN_TRAVEL_MAX_TOKENS)
    expect(caixas).not.toContain('f8')
    expect(caixas).not.toContain('f9')
    const r = t.pede(caixas)
    expect(r.travelRequest?.tokenNames).toHaveLength(PIN_TRAVEL_MAX_TOKENS)
  })

  it('a nona, além do teto, recusa o pedido: ela não está entre as candidatas', () => {
    const t = mesaCheia()
    const r = t.pede(['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f8'])
    expect(r.travelRequest).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })
})

/**
 * Atalho na MESMA cena: a ponte leva à outra ponta da própria Estrada. A
 * coruja pode estar em pé justo na casa que o assentamento daria a ela.
 */
function mesaMesmaCena(coruja: { x: number; y: number }) {
  const tokens = [ficha('bruno', casa(11, 6)), ficha('coruja', coruja)]
  const pins = [
    ponte('ponte-a', PONTE_A, ESTRADA, 'ponte-b', 'livre'),
    ponte('ponte-b', casa(14, 5), ESTRADA, 'ponte-a', 'livre'),
  ]
  const world = (): HostWorld => ({
    open: { sceneId: ESTRADA, name: 'Estrada Real', map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens, pins } },
    background: [],
  })
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => 'id-1' })
  const bruno = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Bruno' }, world()).outbound).playerId
  for (const t of tokens) s.assignToken(bruno, t.id)
  s.broadcast(world())
  const chegada = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'ponte-a', tokenIds: ['bruno', 'coruja'] }, world()).applyTransfer
  if (chegada === undefined) throw new Error('Bruno e a coruja deveriam passar direto')
  return chegada
}

describe('hostSession: pino par na mesma cena', () => {
  it('a casa de onde a coruja sai não conta como ocupada para ela mesma', () => {
    const longe = mesaMesmaCena(casa(9, 7))
    const alvo = casaDaCoruja(longe)
    const r = mesaMesmaCena(alvo)
    expect(casaDaCoruja(r)).toEqual(alvo)
    expect({ x: r.x, y: r.y }).toEqual({ x: longe.x, y: longe.y })
  })
})
