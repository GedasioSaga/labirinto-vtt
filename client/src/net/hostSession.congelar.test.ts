// @vitest-environment node
/**
 * CONGELAR FICHA no servidor da sala. O mestre congelou a ficha (`congelado`):
 * a sessão RECUSA todo pedido de jogador que a moveria — o passo, cada trecho
 * da caminhada, a escada, a passagem pelo pino (e o "Deixar ir" de um pedido
 * feito antes de congelar) —, inclusive de carona: a bordo de um veículo ou
 * levada por quem anda. Quem só ACOMPANHA a passagem (séquito, ajudante) e
 * está congelado fica. O mestre continua movendo ("Mandar para…"). O campo
 * chega só ao DONO da ficha: na de outro, diria quem o mestre congelou.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Stair, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'GELO01'
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino, ...extra }
}

/**
 * Salão (aberto): a Ana colada na escada LIVRE e na porta que PEDE ao mestre,
 * o pônei dela a uma casa, a Bia mais adiante e um NPC. `fichas` troca ou
 * acrescenta fichas do Salão pelo id.
 */
function mundo(fichas: Record<string, Partial<Token>> = {}, extras: Token[] = []): HostWorld {
  const base = [ficha('ana', 225, 225), ficha('ponei', 275, 225), ficha('bia', 525, 225), ficha('npc', 725, 325)]
  const tokens = [...base, ...extras].map((t) => ({ ...t, ...(fichas[t.id] ?? {}) }))
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 12, GRID),
    tokens,
    pins: [
      viagem('escada', 175, 225, { sceneId: CRIPTA, pinId: 'escada-b' }, { passagem: 'livre' }),
      viagem('porta', 225, 275, { sceneId: CRIPTA, pinId: 'porta-b' }),
    ],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta', 40, 12, GRID),
    pins: [viagem('escada-b', 1025, 275, { sceneId: SALAO, pinId: 'escada' }), viagem('porta-b', 1025, 475, { sceneId: SALAO, pinId: 'porta' })],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta', map: cripta }] }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (c1) com a ficha dela e o pônei; Bia (c2) com a dela. */
function mesa(w: HostWorld, fichasDaAna: string[] = ['ana', 'ponei']): { s: HostSession; ana: string; bia: string } {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ana = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  for (const id of fichasDaAna) s.assignToken(ana, id)
  const bia = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w))
  s.assignToken(bia, 'bia')
  s.broadcast(w)
  return { s, ana, bia }
}

const recusaDoPasso = (reqId: string, reason: 'congelado' | 'not_owner'): HostMessage => ({ type: 'token.move.rejected', reqId, reason })

function snapshotDe(r: HostResult, clientId: string): MapData {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava o snapshot de ${clientId}`)
  return msg.map
}

describe('passo e caminhada', () => {
  it('Ana arrasta a própria ficha congelada: volta com o motivo `congelado` e nada anda', () => {
    const w = mundo({ ana: { congelado: true } })
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 225, y: 125 }, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDoPasso('r1', 'congelado') }])
    expect(r.applyMove).toBeUndefined()
  })

  it('a caminhada ("Andar até aqui") manda um trecho por vez: cada trecho volta recusado', () => {
    const w = mundo({ ana: { congelado: true } })
    const { s } = mesa(w)
    const trechos = [
      { reqId: 'r1', y: 175 },
      { reqId: 'r2', y: 125 },
    ]
    for (const { reqId, y } of trechos) {
      const r = s.handleMessage('c1', { type: 'token.move', reqId, tokenId: 'ana', x: 225, y }, w)
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDoPasso(reqId, 'congelado') }])
      expect(r.applyMove).toBeUndefined()
    }
  })

  it('controle: descongelada, o mesmo passo vale', () => {
    const w = mundo()
    const { s } = mesa(w)
    expect(s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 225, y: 125 }, w).applyMove).toEqual({ tokenId: 'ana', x: 225, y: 125 })
  })

  it('a Bia pedindo a ficha congelada da Ana lê `not_owner`, nunca `congelado`', () => {
    const w = mundo({ ana: { congelado: true } })
    const { s } = mesa(w)
    const r = s.handleMessage('c2', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 225, y: 125 }, w)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: recusaDoPasso('r1', 'not_owner') }])
  })
})

describe('de carona: veículo e levar junto', () => {
  const carroca = (passageiros: string[]): Token => ficha('carroca', 425, 425, { veiculo: { lugares: 2, passageiros } })

  it('a carroça da Ana com a Bia congelada a bordo não anda', () => {
    const w = mundo({ bia: { x: 425, y: 425, congelado: true } }, [carroca(['bia'])])
    const { s } = mesa(w, ['ana', 'ponei', 'carroca'])
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'carroca', x: 425, y: 325 }, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDoPasso('r1', 'congelado') }])
    expect(r.applyMove).toBeUndefined()
  })

  it('a carroça congelada não anda, nem vazia', () => {
    const w = mundo({ carroca: { congelado: true } }, [carroca([])])
    const { s } = mesa(w, ['ana', 'ponei', 'carroca'])
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'carroca', x: 425, y: 325 }, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDoPasso('r1', 'congelado') }])
  })

  it('controle: a Bia solta a bordo, a carroça anda', () => {
    const w = mundo({ bia: { x: 425, y: 425 } }, [carroca(['bia'])])
    const { s } = mesa(w, ['ana', 'ponei', 'carroca'])
    expect(s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'carroca', x: 425, y: 325 }, w).applyMove).toEqual({ tokenId: 'carroca', x: 425, y: 325 })
  })

  it('a Ana levando o ferido congelado não anda (ele iria junto)', () => {
    const w = mundo({}, [ficha('ferido', 225, 175, { levadoPor: 'ana', congelado: true })])
    const { s } = mesa(w)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ana', x: 325, y: 225 }, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDoPasso('r1', 'congelado') }])
    expect(r.applyMove).toBeUndefined()
  })
})

describe('escada entre pisos', () => {
  const ESCADA: Stair = { id: 'degraus', shape: 'straight', direction: 'up', segments: [{ x1: 500, y1: 460, x2: 500, y2: 540 }], stepWidth: 40, levaAoPiso: 1 }

  function predio(fichas: Token[]): MapData {
    return { ...createEmptyMap('predio', 'Prédio', 25, 25, 40), tokens: fichas, stairs: [ESCADA] }
  }

  function sobe(map: MapData): HostResult {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    s.assignToken(playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map)), 'lia')
    s.broadcast(map)
    return s.handleMessage('c1', { type: 'token.piso', tokenId: 'lia', stairId: 'degraus' }, map)
  }

  it('controle: solta na escada, a Lia sobe', () => {
    expect(sobe(predio([ficha('lia', 500, 500)])).applyPiso).toEqual({ tokenId: 'lia', piso: 1 })
  })

  it('congelada, a escada recusa em silêncio (como o cadeado)', () => {
    const r = sobe(predio([ficha('lia', 500, 500, { congelado: true })]))
    expect(r.applyPiso).toBeUndefined()
    expect(r.outbound).toEqual([])
  })

  it('levando alguém congelado, também não sobe', () => {
    const r = sobe(predio([ficha('lia', 500, 500), ficha('gato', 500, 460, { levadoPor: 'lia', congelado: true })]))
    expect(r.applyPiso).toBeUndefined()
  })
})

describe('passagem pelo pino', () => {
  const pede = (s: HostSession, w: HostWorld, extra: { tokenIds?: string[]; pinId?: string } = {}): HostResult =>
    s.handleMessage('c1', { type: 'pin.travel.request', pinId: extra.pinId ?? 'escada', ...(extra.tokenIds === undefined ? {} : { tokenIds: extra.tokenIds }) }, w)
  const recusaDaPassagem: HostMessage = { type: 'pin.travel.rejected', reason: 'congelado' }

  it('a ficha congelada colada na escada livre não passa: `congelado`, nada vai ao mestre', () => {
    const w = mundo({ ana: { congelado: true }, ponei: { x: 725, y: 525 } })
    const { s } = mesa(w)
    const r = pede(s, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDaPassagem }])
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest).toBeUndefined()
  })

  it('pedir pela porta que pede ao mestre também volta `congelado`, sem pedido na Caixa', () => {
    const w = mundo({ ana: { congelado: true }, ponei: { x: 725, y: 525 } })
    const { s } = mesa(w)
    const r = pede(s, w, { pinId: 'porta' })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDaPassagem }])
    expect(r.travelRequest).toBeUndefined()
  })

  it('escolher a ficha congelada no "Quem passa?" recusa o pedido inteiro', () => {
    const w = mundo({ ponei: { congelado: true } })
    const { s } = mesa(w)
    const r = pede(s, w, { tokenIds: ['ana', 'ponei'] })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDaPassagem }])
    expect(r.applyTransfer).toBeUndefined()
  })

  it('o pônei congelado que só acompanharia FICA: a Ana passa sem ele', () => {
    const w = mundo({ ponei: { congelado: true } })
    const { s } = mesa(w)
    const transfer = pede(s, w).applyTransfer
    if (transfer === undefined) throw new Error('a Ana deveria passar')
    expect(transfer.tokenId).toBe('ana')
    expect((transfer.entourage ?? []).map((e) => e.tokenId)).toEqual([])
    // Controle: solto, o pônei vai junto.
    const solto = mundo()
    const livre = mesa(solto).s
    expect((pede(livre, solto).applyTransfer?.entourage ?? []).map((e) => e.tokenId)).toEqual(['ponei'])
  })

  it('o ajudante emprestado congelado não segue a Ana', () => {
    const w = mundo({ ponei: { x: 725, y: 525 } }, [ficha('tiziu', 275, 175, { npc: true, congelado: true })])
    const { s, ana } = mesa(w)
    s.lendToken(ana, 'tiziu', { tarefa: 'segurar a tocha', minutos: 30, visao: false })
    s.broadcast(w)
    const transfer = pede(s, w).applyTransfer
    if (transfer === undefined) throw new Error('a Ana deveria passar')
    expect((transfer.companions ?? []).map((c) => c.tokenId)).toEqual([])
    // Nem de séquito: fora dos ajudantes, ele seria "ficha dela a uma casa".
    expect((transfer.entourage ?? []).map((e) => e.tokenId)).toEqual([])
  })

  it('levando o ferido congelado, a Ana não passa', () => {
    const w = mundo({ ponei: { x: 725, y: 525 } }, [ficha('ferido', 225, 175, { levadoPor: 'ana', congelado: true })])
    const { s } = mesa(w)
    const r = pede(s, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDaPassagem }])
    expect(r.applyTransfer).toBeUndefined()
  })

  it('a carroça da Ana com a Bia congelada a bordo não passa', () => {
    const w = mundo({ bia: { x: 225, y: 225, congelado: true } }, [ficha('carroca', 225, 225, { veiculo: { lugares: 2, passageiros: ['bia'] } })])
    const { s } = mesa(w, ['carroca'])
    const r = pede(s, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDaPassagem }])
    expect(r.applyTransfer).toBeUndefined()
  })

  it('o "Deixar ir" de um pedido feito ANTES de congelar recusa com `congelado`', () => {
    const w = mundo({ ponei: { x: 725, y: 525 } })
    const { s } = mesa(w)
    const requestId = pede(s, w, { pinId: 'porta' }).travelRequest?.requestId
    if (requestId === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const congelada = mundo({ ana: { congelado: true }, ponei: { x: 725, y: 525 } })
    const r = s.approveTravel(requestId, congelada)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: recusaDaPassagem }])
    expect(r.applyTransfer).toBeUndefined()
  })

  it('o mestre ainda move: "Mandar para…" leva a Ana congelada', () => {
    const w = mundo({ ana: { congelado: true }, ponei: { x: 725, y: 525 } })
    const { s, ana } = mesa(w)
    const r = s.sendPlayer(ana, CRIPTA, 'escada-b', w)
    expect(r.applyTransfer?.tokenId).toBe('ana')
  })
})

describe('o que chega a quem joga', () => {
  it('a Ana recebe `congelado` na ficha dela; a Bia vê a ficha da Ana SEM o campo', () => {
    const w = mundo({ ana: { congelado: true }, npc: { congelado: true } })
    const { s } = mesa(w)
    const r = s.broadcast(mundo({ ana: { congelado: true, x: 230 }, npc: { congelado: true } }))
    const daAna = snapshotDe(r, 'c1')
    expect(daAna.tokens.find((t) => t.id === 'ana')?.congelado).toBe(true)
    expect('congelado' in (daAna.tokens.find((t) => t.id === 'npc') ?? {})).toBe(false)
    const daBia = snapshotDe(r, 'c2')
    const anaNaBia = daBia.tokens.find((t) => t.id === 'ana')
    expect(anaNaBia).toBeDefined()
    expect('congelado' in (anaNaBia ?? {})).toBe(false)
  })

  it('descongelar tira o campo da tela da Ana no envio seguinte', () => {
    const w = mundo({ ana: { congelado: true } })
    const { s } = mesa(w)
    const r = s.broadcast(mundo())
    const envio = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1').map((o) => o.msg))
    // A ficha dela volta inteira (perdeu um campo), e sem ele.
    expect(envio).toContain('nome-ana')
    expect(envio).not.toContain('congelado')
  })
})
