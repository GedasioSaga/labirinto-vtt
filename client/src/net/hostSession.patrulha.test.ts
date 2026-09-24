/**
 * ROTA DE PATRULHA pela REDE: "Avançar patrulha" muda o mapa do mestre, e o
 * snapshot seguinte de quem joga mostra o NPC no ponto novo SÓ se ele está na
 * visão dela. A rota (os pontos, o ponto atual) nunca sai — nem para o NPC que
 * ela vê, nem para o de OUTRA cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { applyPatrolOp } from '../lib/npcPatrol'
import type { MapData, Token, TokenPatrol } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'RONDA1'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapa(id: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, `cena-${id}`, 40, 12, 50), tokens }
}

/** Ana (x=125, raio 400) vê o primeiro ponto (x=325.125) e não o segundo (x=1525.375). */
const RONDA: TokenPatrol = {
  pontos: [
    { x: 325.125, y: 325 },
    { x: 1525.375, y: 325 },
  ],
  atual: 0,
}

function mesaCom(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 400, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'lanterna')
  return s
}

function mapaDaAna(r: HostResult): MapData {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava o snapshot da Ana, veio ${JSON.stringify(msg)}`)
  return msg.map
}

function textoParaAna(r: HostResult): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
}

describe('rota de patrulha — o que chega a quem joga', () => {
  it('NPC à vista: chega na posição dele, sem a rota', () => {
    const inicio = mapa('m-cais', [ficha('lanterna', 125, 325), ficha('guarda', 325.125, 325, { patrulha: RONDA })])
    const r = mesaCom(inicio).broadcast(inicio)
    expect(mapaDaAna(r).tokens.find((t) => t.id === 'guarda')?.x).toBe(325.125)
    const texto = textoParaAna(r)
    expect(texto).not.toContain('patrulha')
    expect(texto).not.toContain('1525.375')
  })

  it('Avançar patrulha para a névoa: o snapshot seguinte tira o NPC, e o ponto novo não viaja', () => {
    const inicio = mapa('m-cais', [ficha('lanterna', 125, 325), ficha('guarda', 325.125, 325, { patrulha: RONDA })])
    const s = mesaCom(inicio)
    expect(mapaDaAna(s.broadcast(inicio)).tokens.map((t) => t.id).sort()).toEqual(['guarda', 'lanterna'])

    const depois = applyPatrolOp(inicio, 'guarda', 'avancar')
    const r = s.broadcast(depois)
    expect(mapaDaAna(r).tokens.map((t) => t.id)).toEqual(['lanterna'])
    const texto = textoParaAna(r)
    expect(texto).not.toContain('guarda')
    expect(texto).not.toContain('1525.375')
  })

  it('Avançar patrulha da névoa para a visão: Ana vê o NPC mexer, já no ponto novo', () => {
    const longe = mapa('m-cais', [ficha('lanterna', 125, 325), ficha('guarda', 1525.375, 325, { patrulha: { ...RONDA, atual: 1 } })])
    const s = mesaCom(longe)
    expect(mapaDaAna(s.broadcast(longe)).tokens.map((t) => t.id)).toEqual(['lanterna'])

    const r = s.broadcast(applyPatrolOp(longe, 'guarda', 'avancar'))
    expect(mapaDaAna(r).tokens.find((t) => t.id === 'guarda')?.x).toBe(325.125)
    expect(textoParaAna(r)).not.toContain('patrulha')
  })

  it('NPC em patrulha de OUTRA cena da aventura: nada dele chega a quem está nesta', () => {
    const cais = mapa('m-cais', [ficha('lanterna', 125, 325)])
    const farol = mapa('m-farol', [ficha('vigia-do-farol', 325.125, 325, { patrulha: RONDA })])
    const mundo: HostWorld = {
      open: { sceneId: 's-cais', name: 'Cais', map: cais },
      background: [{ sceneId: 's-farol', name: 'Farol', map: farol }],
    }
    const r = mesaCom(mundo).broadcast(mundo)
    expect(mapaDaAna(r).tokens.map((t) => t.id)).toEqual(['lanterna'])
    const texto = textoParaAna(r)
    expect(texto).not.toContain('vigia-do-farol')
    expect(texto).not.toContain('Farol')
    expect(texto).not.toContain('1525.375')
  })
})
