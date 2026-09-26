import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type AppliedTransfer, type HostResult, type HostWorld } from './hostSession'

/**
 * CHEGADA EM CASA LIVRE no host: quem passa pelo mesmo pino — pedido aprovado
 * um a um ("Deixar todos"), pino livre, ou "Mandar para…" — chega na casa
 * livre mais perto do par, não empilhado em cima dele nem de quem chegou antes.
 * E o que o jogador não vê (ficha secreta) não muda para onde ele vai, nem
 * aparece no pacote dele.
 */

const CODE = 'CASA01'
const GRADE = 50
const SALAO = 'cena-salao'
const PORAO = 'cena-porao'
const NOME_PORAO = 'Porão Fundo'

type Ponto = { x: number; y: number }

/** Par no MEIO de uma casa, como na régua e2e. */
const PAR: Ponto = { x: 1025, y: 325 }
const MONSTRO = 'Horror do porão'

// Os três encostados na escada-a (900, 440): o pino de viagem só atravessa de perto.
const JOGADORES = [
  { clientId: 'c1', nome: 'Ana', ficha: 'lanterna', em: { x: 850, y: 440 } },
  { clientId: 'c2', nome: 'Bruno', ficha: 'machado', em: { x: 900, y: 390 } },
  { clientId: 'c3', nome: 'Carla', ficha: 'cajado', em: { x: 950, y: 440 } },
] as const

function ficha(id: string, p: Ponto, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function viagem(id: string, p: Ponto, destino: Pin['destino'], passagem?: Pin['passagem']): Pin {
  const base: Pin = { id, x: p.x, y: p.y, kind: 'viagem', description: id, image: null, destino }
  return passagem === undefined ? base : { ...base, passagem }
}

function mundo(passagem: Pin['passagem'], noPorao: Token[] = []): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 12, GRADE),
    tokens: JOGADORES.map((j) => ficha(j.ficha, j.em)),
    pins: [viagem('escada-a', { x: 900, y: 440 }, { sceneId: PORAO, pinId: 'escada-b' }, passagem)],
  }
  const porao: MapData = {
    ...createEmptyMap('mapa-porao', NOME_PORAO, 40, 12, GRADE),
    tokens: noPorao,
    pins: [viagem('escada-b', PAR, { sceneId: SALAO, pinId: 'escada-a' })],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: PORAO, name: NOME_PORAO, map: porao }] }
}

/** O que o integrador faz com `applyTransfer`: a ficha sai de uma cena e entra na outra, onde a sessão mandou. */
function aplica(w: HostWorld, t: AppliedTransfer): HostWorld {
  const cenas = [w.open, ...w.background]
  const viajante = cenas.flatMap((c) => c.map.tokens).find((tk) => tk.id === t.tokenId)
  if (viajante === undefined) throw new Error(`ficha ${t.tokenId} sumiu`)
  const [open, ...background] = cenas.map((c) => {
    const semEla = c.map.tokens.filter((tk) => tk.id !== t.tokenId)
    const tokens = c.sceneId === t.toSceneId ? [...semEla, { ...viajante, x: t.x, y: t.y }] : semEla
    return { ...c, map: { ...c.map, tokens } }
  })
  return { open, background }
}

function mesa(w: HostWorld, quantos: number) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ids: string[] = []
  for (const j of JOGADORES.slice(0, quantos)) {
    const welcome = s.handleMessage(j.clientId, { type: 'join', code: CODE, name: j.nome }, w).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, j.ficha)
    ids.push(welcome.playerId)
  }
  s.broadcast(w)
  return { s, ids }
}

function transferencia(r: HostResult): AppliedTransfer {
  if (r.applyTransfer === undefined) throw new Error(`esperava a passagem, veio ${JSON.stringify(r.outbound)}`)
  return r.applyTransfer
}

const distancia = (a: Ponto, b: Ponto): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Lado a lado (a pelo menos uma casa uma da outra) e fora do pino (meia casa da ponta). */
function problemas(casas: readonly Ponto[]): string[] {
  const achados: string[] = []
  casas.forEach((c, i) => {
    if (distancia(c, PAR) < GRADE / 2) achados.push(`chegada ${i} em cima do pino`)
    for (let k = i + 1; k < casas.length; k += 1) if (distancia(c, casas[k]) < GRADE) achados.push(`chegadas ${i} e ${k} na mesma casa`)
  })
  return achados
}

describe('hostSession: chegada em casa livre', () => {
  it('"Deixar todos": dois pedidos aprovados um depois do outro chegam em casas vizinhas, fora do pino', () => {
    let w = mundo(undefined)
    const { s } = mesa(w, 2)
    const pedidos = ['c1', 'c2'].map((c) => s.handleMessage(c, { type: 'pin.travel.request', pinId: 'escada-a' }, w).travelRequest)
    const casas: Ponto[] = []
    for (const pedido of pedidos) {
      if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
      const t = transferencia(s.approveTravel(pedido.requestId, w))
      casas.push(t)
      w = aplica(w, t)
    }
    expect(problemas(casas)).toEqual([])
    expect(distancia(casas[0], casas[1])).toBeLessThanOrEqual(GRADE * 2)
  })

  it('pino livre: três passam direto pela mesma escada e ocupam três casas diferentes', () => {
    let w = mundo('livre')
    const { s } = mesa(w, 3)
    const casas: Ponto[] = []
    for (const j of JOGADORES) {
      const t = transferencia(s.handleMessage(j.clientId, { type: 'pin.travel.request', pinId: 'escada-a' }, w))
      casas.push(t)
      w = aplica(w, t)
    }
    expect(problemas(casas)).toEqual([])
  })

  it('"Mandar para…" pelo pino: o segundo mandado não cai em cima do primeiro', () => {
    let w = mundo(undefined)
    const { s, ids } = mesa(w, 2)
    const casas: Ponto[] = []
    for (const id of ids) {
      const t = transferencia(s.sendPlayer(id, PORAO, 'escada-b', w))
      casas.push(t)
      w = aplica(w, t)
    }
    expect(problemas(casas)).toEqual([])
  })

  it('"Mandar para…" sem pino: o segundo mandado não cai em cima do primeiro no centro da cena', () => {
    let w = mundo(undefined)
    const { s, ids } = mesa(w, 2)
    const casas: Ponto[] = []
    for (const id of ids) {
      const t = transferencia(s.sendPlayer(id, PORAO, null, w))
      casas.push(t)
      w = aplica(w, t)
    }
    expect(distancia(casas[0], casas[1])).toBeGreaterThanOrEqual(GRADE * 0.9)
  })

  it('recorte: ficha secreta na casa ao lado do pino não desvia a chegada e não chega ao jogador', () => {
    // Onde a Ana chegaria com o Porão vazio.
    const vazio = mundo('livre')
    const livre = transferencia(mesa(vazio, 1).s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-a' }, vazio))

    // O mestre escondeu um monstro exatamente nessa casa.
    const comMonstro = mundo('livre', [ficha('monstro', livre, { secret: true, name: MONSTRO })])
    const { s } = mesa(comMonstro, 1)
    const t = transferencia(s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-a' }, comMonstro))
    // A chegada é a mesma: desviar do monstro diria à Ana que tem algo ali.
    expect({ x: t.x, y: t.y }).toEqual({ x: livre.x, y: livre.y })

    // E o pacote dela no Porão não traz o monstro.
    const depois = aplica(comMonstro, t)
    const pacote = JSON.stringify(s.broadcast(depois).outbound.filter((o) => o.clientId === 'c1'))
    expect(pacote).toContain('mapa-porao')
    expect(pacote).not.toContain('monstro')
    expect(pacote).not.toContain(MONSTRO)
  })
})
