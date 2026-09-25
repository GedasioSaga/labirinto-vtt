/**
 * RUÍDO NO MAPA: o mestre dispara um ruído num ponto da cena ABERTA no editor.
 * Quem joga nessa cena e tem ficha dentro do alcance recebe só a direção
 * (`noise`, com `id` e `dir`). Nunca a posição do ruído, nunca o que o fez,
 * nunca nada da cena; quem está em outra cena, longe, aguardando ou caído não
 * recebe nem o frame.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 60, 60, GRID), tokens }
}

/** O que fez o ruído: ficha do mestre, escondida, bem no ponto do ruído. */
const CARNICAL = ficha('carnical-77', 1333, 777, { name: 'Carnical Faminto', hidden: true })
const RUIDO = { x: 1333, y: 777 }

// Ana a 8 casas a oeste do ruído (ouve a leste); Bruno longe, no canto; Caio na Cripta, no MESMO ponto.
const SALAO: HostScene = {
  sceneId: 's-salao',
  name: 'Salao Norte',
  map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 933, 777), ficha('machado', 60, 2900), CARNICAL]),
}
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('adaga', 1300, 777)]) }
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 300, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const ana = entra(s, 'c1', 'Ana')
  const bruno = entra(s, 'c2', 'Bruno')
  const caio = entra(s, 'c3', 'Caio')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.assignToken(caio, 'adaga')
  return { s, ana, bruno, caio }
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('noise (ruído no mapa)', () => {
  it('só quem está na cena aberta e perto ouve, e ouve só a direção', () => {
    const { s } = mesa()
    const r = s.noise(RUIDO.x, RUIDO.y, 12, mundo)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'noise', id: expect.any(String), dir: 'e' } }])
  })

  it('a mensagem não leva a posição do ruído, o que o fez, nem nada da cena', () => {
    const { s } = mesa()
    const texto = para(s.noise(RUIDO.x, RUIDO.y, 12, mundo), 'c1')
    expect(texto).toContain('"noise"')
    for (const proibido of ['1333', '777', 'carnical', 'Carnical', 'Faminto', 's-salao', 'Salao', 'm-salao', 'sceneId', '"x"', '"y"', 'distance']) {
      expect(texto).not.toContain(proibido)
    }
    // Só os três campos: nada de carona.
    const msg = s.noise(RUIDO.x, RUIDO.y, 12, mundo).outbound[0]?.msg
    expect(msg === undefined ? [] : Object.keys(msg).sort()).toEqual(['dir', 'id', 'type'])
  })

  it('quem está em OUTRA cena não recebe nada, mesmo com a ficha no mesmo ponto', () => {
    const { s } = mesa()
    const r = s.noise(RUIDO.x, RUIDO.y, 60, mundo)
    expect(para(r, 'c3')).toBe('[]')
    expect(r.outbound.map((o) => o.clientId)).not.toContain('c3')
  })

  it('o alcance decide: com 60 casas Bruno, no canto, também ouve (a nordeste)', () => {
    const { s } = mesa()
    const perto = s.noise(RUIDO.x, RUIDO.y, 12, mundo)
    expect(perto.outbound.map((o) => o.clientId)).toEqual(['c1'])
    const longe = s.noise(RUIDO.x, RUIDO.y, 60, mundo)
    expect(longe.outbound.map((o) => o.clientId).sort()).toEqual(['c1', 'c2'])
    const bruno = longe.outbound.find((o) => o.clientId === 'c2')?.msg
    expect(bruno?.type === 'noise' ? bruno.dir : null).toBe('ne')
  })

  it('quem aguarda (sem ficha) e quem caiu não recebem; nada fica guardado para depois', () => {
    const { s } = mesa()
    entra(s, 'c4', 'Dora')
    s.disconnect('c1')
    const r = s.noise(RUIDO.x, RUIDO.y, 12, mundo)
    expect(r).toEqual({ outbound: [] })
    // Ana volta: nem a entrada nem o broadcast trazem o ruído antigo.
    const volta = s.handleMessage('c5', { type: 'join', code: CODE, name: 'Ana' }, mundo)
    expect(JSON.stringify(volta.outbound)).not.toContain('"noise"')
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain('"noise"')
  })

  it('ponto que não é número finito não sai para ninguém', () => {
    const { s } = mesa()
    expect(s.noise(Number.NaN, RUIDO.y, 12, mundo)).toEqual({ outbound: [] })
    expect(s.noise(RUIDO.x, Number.POSITIVE_INFINITY, 12, mundo)).toEqual({ outbound: [] })
  })

  it('mapa solto: vale a cena aberta, com a mesma regra de alcance', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 300, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const solto = mapa('m-solto', 'Solto', [ficha('lanterna', 1333, 400)])
    const r1 = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, solto)
    const ana = r1.outbound[0]?.msg
    if (ana?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(ana.playerId, 'lanterna')
    // Ruído ao sul da ficha, a 7,5 casas.
    expect(s.noise(1333, 775, 12, solto).outbound).toEqual([{ clientId: 'c1', msg: { type: 'noise', id: expect.any(String), dir: 's' } }])
  })
})
