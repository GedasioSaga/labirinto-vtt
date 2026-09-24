/**
 * BARRA DE VIDA — o que sai pelo FIO. O recorte (`lib/fogFilter.ts`) já é
 * provado sozinho; aqui é a sessão do host inteira: jogadora entra, recebe a
 * ficha, o mestre dá vida às duas fichas e o `broadcast` manda a cena. A barra
 * que o mestre deixou só para si não pode viajar nem como número solto.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, TokenHealth } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'VIDA01'
const HEROI = 'tok-lu'
const MONSTRO = 'tok-og'
const OCULTA = { current: 173, max: 419 }

function ficha(id: string, x: number, health?: TokenHealth): Token {
  const token: Token = { id, characterId: null, name: id, x, y: 300, size: 1, image: null }
  if (health !== undefined) token.health = health
  return token
}

function cena(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-vida', 'Sala do Ogro', 20, 12, 50), tokens }
}

function mesaCom(source: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, HEROI)
  return s
}

/** Os frames que a jogadora recebeu, como texto — o que o fio entrega. */
function framesPara(r: HostResult, clientId: string): string[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => JSON.stringify(o.msg))
}

/** Mesma varredura da régua: objeto que fala do monstro e carrega 173 ou 419. */
function vazou(frames: string[]): boolean {
  const proibidos = new Set([OCULTA.current, OCULTA.max])
  const temNumero = (v: unknown): boolean => {
    if (typeof v === 'number') return proibidos.has(v)
    if (typeof v === 'string') return proibidos.has(Number(v))
    if (Array.isArray(v)) return v.some(temNumero)
    if (v !== null && typeof v === 'object') return Object.values(v as Record<string, unknown>).some(temNumero)
    return false
  }
  const procurar = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(procurar)
    if (v === null || typeof v !== 'object') return false
    const o = v as Record<string, unknown>
    if (Object.values(o).some((x) => x === MONSTRO) && temNumero(o)) return true
    return Object.values(o).some(procurar)
  }
  return frames.some((f) => procurar(JSON.parse(f)))
}

function tokenNoSnapshot(r: HostResult, id: string): Token | undefined {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'snapshot' ? msg.map.tokens.find((t) => t.id === id) : undefined
}

describe('broadcast da cena com barras de vida', () => {
  it('a barra do monstro só para o mestre não viaja; a do herói, que os jogadores veem, chega como proporção', () => {
    const inicio = cena([ficha(HEROI, 400), ficha(MONSTRO, 550)])
    const s = mesaCom(inicio)
    s.broadcast(inicio)

    // O mestre dá vida às duas fichas: Og oculta, Lu visível.
    const depois = cena([
      ficha(HEROI, 400, { current: 6, max: 10, shownToPlayers: true }),
      ficha(MONSTRO, 550, { ...OCULTA, shownToPlayers: false }),
    ])
    const r = s.broadcast(depois)

    expect(tokenNoSnapshot(r, MONSTRO), 'Og está na visão da Ana: a ficha dele tem de chegar').toBeDefined()
    expect(tokenNoSnapshot(r, MONSTRO)?.health).toBeUndefined()
    expect(vazou(framesPara(r, 'c1'))).toBe(false)
    expect(tokenNoSnapshot(r, HEROI)?.health).toEqual({ current: 60, max: 100, shownToPlayers: true })
  })

  it('o mestre esconde de novo a barra que mostrava: o próximo snapshot já sai sem ela', () => {
    const mostrando = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { ...OCULTA, shownToPlayers: true })])
    const s = mesaCom(mostrando)
    expect(tokenNoSnapshot(s.broadcast(mostrando), MONSTRO)?.health).toEqual({ current: 41, max: 100, shownToPlayers: true })

    const escondida = cena([ficha(HEROI, 400), ficha(MONSTRO, 550, { ...OCULTA, shownToPlayers: false })])
    const r = s.broadcast(escondida)
    expect(tokenNoSnapshot(r, MONSTRO)?.health).toBeUndefined()
    expect(vazou(framesPara(r, 'c1'))).toBe(false)
  })
})
