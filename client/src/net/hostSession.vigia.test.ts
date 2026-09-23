/**
 * OLHOS DO GUARDA pela REDE: o snapshot de quem joga leva, na ficha do guarda
 * que ele enxerga, só a marca (?, !). O cone (`vigia`) nunca sai, e o guarda de
 * OUTRA cena não manda nada — nem a ficha, nem a marca, nem o nome da cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, TokenWatch } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'VIGIA1'
const OESTE: TokenWatch = { direcao: 180, abertura: 90, alcance: 4 }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapa(id: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, `cena-${id}`, 30, 12, 50), tokens }
}

/** Ana entra e recebe a Lanterna. */
function mesaCom(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'lanterna')
  return s
}

function mapaDoJogador(r: HostResult): MapData {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava o snapshot da Ana')
  return msg.map
}

function textoPara(r: HostResult): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
}

describe('olhos do guarda — o que chega a quem joga', () => {
  it('o guarda à vista de Ana, olhando para ela: a ficha dele chega com "!" e sem o cone', () => {
    const inicio = mapa('m-portao', [ficha('lanterna', 425, 325), ficha('guarda', 500, 325, { vigia: OESTE })])
    const r = mesaCom(inicio).broadcast(inicio)
    const guarda = mapaDoJogador(r).tokens.find((t) => t.id === 'guarda')
    expect(guarda?.alerta).toBe('!')
    expect(textoPara(r)).not.toContain('vigia')
    expect(textoPara(r)).not.toContain('abertura')
  })

  it('o guarda vira de costas: o snapshot seguinte tira a marca', () => {
    const olhando = mapa('m-portao', [ficha('lanterna', 425, 325), ficha('guarda', 500, 325, { vigia: OESTE })])
    const s = mesaCom(olhando)
    expect(mapaDoJogador(s.broadcast(olhando)).tokens.find((t) => t.id === 'guarda')?.alerta).toBe('!')
    const deCostas = mapa('m-portao', [ficha('lanterna', 425, 325), ficha('guarda', 500, 325, { vigia: { ...OESTE, direcao: 0 } })])
    const guarda = mapaDoJogador(s.broadcast(deCostas)).tokens.find((t) => t.id === 'guarda')
    expect(guarda).toBeDefined()
    expect(guarda !== undefined && 'alerta' in guarda).toBe(false)
  })

  it('guarda de OUTRA cena da aventura: nada dele chega a quem está nesta', () => {
    const portao = mapa('m-portao', [ficha('lanterna', 425, 325)])
    const torre = mapa('m-torre', [ficha('sentinela', 300, 300, { vigia: OESTE }), ficha('lanterna-falsa', 250, 300)])
    const mundo: HostWorld = {
      open: { sceneId: 's-portao', name: 'Portão', map: portao },
      background: [{ sceneId: 's-torre', name: 'Torre', map: torre }],
    }
    const r = mesaCom(mundo).broadcast(mundo)
    expect(mapaDoJogador(r).tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(textoPara(r)).not.toContain('sentinela')
    expect(textoPara(r)).not.toContain('alerta')
    expect(textoPara(r)).not.toContain('Torre')
  })
})
