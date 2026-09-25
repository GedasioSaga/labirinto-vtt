import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, PinPassage, Token } from '../types/map'
import { createHostSession, type AppliedTransfer, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

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
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), tokens: fichasEm(VILA), pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a', passagem)] },
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
  return { s, onde, patch, world, pede, aprova }
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
