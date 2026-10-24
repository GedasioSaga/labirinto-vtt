/**
 * LUZ L2 — cenários sorteados com semente fixa para os testes da visão por
 * período (`hostSession.visaoPorPeriodo.test.ts`). Cada cenário é uma cena
 * de 40x40 casas com paredes, luzes e NPCs em lugares sorteados, um herói do
 * jogador e o período da sessão; `vereditoDoHost` passa o cenário pelo host de
 * verdade (`createHostSession`) e devolve o que o pacote entrega.
 *
 * A ordem dos sorteios é contrato: o veredito de antes da L2
 * (`luzL2.vereditoDeHoje.json`) foi gravado com ela. Sorteio novo só entra
 * DEPOIS dos de hoje e só com `comVisaoPorPeriodo`.
 */
import { createEmptyMap } from '../lib/mapFactory'
import type { Light, MapData, Periodo, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'

export const CODIGO = 'AB12CD'
/** Raio de visão do mestre para jogador sem "Visão nesta cena", em px de mundo. */
export const RAIO_BASE = 700
export const GRID = 50
const LADO = 40
const MUNDO = LADO * GRID
const PAREDES = 6
const NPCS = 8
const LUZES_NO_MAXIMO = 5
const PERIODOS: readonly Periodo[] = ['dia', 'tarde', 'noite']

/** mulberry32: a mesma semente dá a mesma sequência em qualquer máquina. */
export function sorteador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Cenario {
  map: MapData
  periodo: Periodo
  heroi: Token
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

export function cenario(semente: number, comVisaoPorPeriodo = false): Cenario {
  const sorteio = sorteador(semente)
  const ponto = (): { x: number; y: number } => ({ x: Math.round(100 + sorteio() * (MUNDO - 200)), y: Math.round(100 + sorteio() * (MUNDO - 200)) })
  const walls: Wall[] = Array.from({ length: PAREDES }, (_, i) => {
    const a = ponto()
    const angulo = sorteio() * Math.PI * 2
    const comprimento = 100 + sorteio() * 500
    return {
      id: `parede${i}`,
      x1: a.x,
      y1: a.y,
      x2: Math.round(a.x + Math.cos(angulo) * comprimento),
      y2: Math.round(a.y + Math.sin(angulo) * comprimento),
      blocksLight: true,
      blocksMove: true,
      door: null,
    }
  })
  const lights: Light[] = Array.from({ length: Math.floor(sorteio() * (LUZES_NO_MAXIMO + 1)) }, (_, i) => ({
    id: `luz${i}`,
    ...ponto(),
    radius: Math.round(75 + sorteio() * 175),
    color: '#ffb347',
    intensity: 0.8,
  }))
  const npcs = Array.from({ length: NPCS }, (_, i) => {
    const p = ponto()
    return ficha(`npc${i}`, p.x, p.y)
  })
  const heroiEm = ponto()
  const heroi = ficha('heroi', heroiEm.x, heroiEm.y)
  const periodo = PERIODOS[Math.floor(sorteio() * PERIODOS.length)] ?? 'dia'
  const externa = sorteio() < 0.7
  const fixo = sorteio()
  const periodoFixo: Periodo | undefined = fixo < 0.1 ? 'noite' : fixo < 0.15 ? 'tarde' : undefined
  const dark = sorteio() < 0.15
  const celulas = sorteio() < 0.5 ? 4 + Math.floor(sorteio() * 13) : undefined
  const map: MapData = {
    ...createEmptyMap(`cena-${semente}`, `Cena ${semente}`, LADO, LADO, GRID),
    walls,
    lights,
    tokens: [heroi, ...npcs],
    ...(externa ? { externa: true as const } : {}),
    ...(periodoFixo === undefined ? {} : { periodoFixo }),
    ...(dark ? { dark: true } : {}),
    ...(celulas === undefined ? {} : { visionCells: celulas }),
  }
  if (!comVisaoPorPeriodo) return { map, periodo, heroi }
  // Sorteios da L2: só depois dos de hoje. Casas de 0 a 24 (às vezes acima da visão cheia), às vezes só um período.
  const casas = (): number | undefined => (sorteio() < 0.25 ? undefined : Math.floor(sorteio() * 25))
  const tarde = casas()
  const noite = casas()
  const visaoPorPeriodo = { ...(tarde === undefined ? {} : { tarde }), ...(noite === undefined ? {} : { noite }) }
  return { map: Object.keys(visaoPorPeriodo).length === 0 ? map : { ...map, visaoPorPeriodo }, periodo, heroi }
}

/** O snapshot do herói depois de um `broadcast` do host de verdade. */
export function snapshotDoHeroi(c: Cenario) {
  let n = 0
  const s = createHostSession({ code: CODIGO, visionRadius: RAIO_BASE, now: () => 0, randomId: () => `id-${(n += 1)}`, getPeriodo: () => c.periodo })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODIGO, name: 'Ana' }, c.map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, c.heroi.id)
  const msg = s.broadcast(c.map).outbound.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error('sem snapshot do herói')
  return msg
}

/** O que o pacote entrega: os ids das fichas, em ordem. */
export function vereditoDoHost(c: Cenario): string[] {
  return snapshotDoHeroi(c)
    .map.tokens.map((t) => t.id)
    .sort()
}
