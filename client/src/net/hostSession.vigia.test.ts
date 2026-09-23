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

/**
 * TELA DA MESA: a TV recebe o recorte do GRUPO que está na cena escolhida.
 * Nela também o cone nunca sai, e a marca é medida contra as fichas de TODOS
 * os jogadores — inclusive de quem joga noutra cena e deixou ficha nesta.
 */
describe('olhos do guarda — o que chega à tela da mesa', () => {
  const CHAVE = 'chave-da-tv-vigia-0123456789abcdef'
  const LESTE: TokenWatch = { direcao: 0, abertura: 90, alcance: 4 }

  function snapshotDaTela(r: HostResult): MapData {
    const msg = r.outbound.find((o) => o.clientId === 'c-tv')?.msg
    if (msg?.type !== 'snapshot') throw new Error(`esperava o snapshot da tela, veio ${JSON.stringify(msg)}`)
    return msg.map
  }

  function sessaoComTela(world: HostWorld) {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}`, tableKey: CHAVE })
    const entrar = (clientId: string, name: string): string => {
      const msg = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
      if (msg?.type !== 'welcome') throw new Error('esperava welcome')
      return msg.playerId
    }
    const ana = entrar('c1', 'Ana')
    s.assignToken(ana, 'lanterna')
    return { s, entrar }
  }

  it('o guarda que o grupo vê, olhando para Ana: a TV recebe "!" e nunca o cone', () => {
    const portao = mapa('m-portao', [ficha('lanterna', 425, 325), ficha('guarda', 500, 325, { vigia: OESTE })])
    const mundo: HostWorld = { open: { sceneId: 's-portao', name: 'Portão', map: portao }, background: [] }
    const { s } = sessaoComTela(mundo)
    s.handleMessage('c-tv', { type: 'join', code: CODE, name: 'Mesa', role: 'table', tableKey: CHAVE }, mundo)
    s.setTableScene('s-portao')
    const r = s.broadcast(mundo)
    expect(snapshotDaTela(r).tokens.find((t) => t.id === 'guarda')?.alerta).toBe('!')
    const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-tv'))
    expect(texto).not.toContain('vigia')
    expect(texto).not.toContain('abertura')
  })

  it('o guarda viu a ficha de Bia, que joga na Torre: a TV do Portão recebe a marca, mas não a ficha de Bia', () => {
    // Ana (x=100, raio 700) vê o guarda (x=700) e não a ficha de Bia (x=880); o guarda olha a leste, 200 px.
    const portao = mapa('m-portao', [ficha('lanterna', 100, 325), ficha('guarda', 700, 325, { vigia: LESTE }), ficha('ladra', 880, 325)])
    const torre = mapa('m-torre', [ficha('batedora', 300, 300)])
    const mundo: HostWorld = {
      open: { sceneId: 's-portao', name: 'Portão', map: portao },
      background: [{ sceneId: 's-torre', name: 'Torre', map: torre }],
    }
    const { s, entrar } = sessaoComTela(mundo)
    const bia = entrar('c2', 'Bia')
    // Bia começa na Torre e fica lá: a ficha que ganha depois no Portão não a leva para o grupo da TV.
    s.assignToken(bia, 'batedora')
    s.broadcast(mundo)
    s.assignToken(bia, 'ladra')
    s.handleMessage('c-tv', { type: 'join', code: CODE, name: 'Mesa', role: 'table', tableKey: CHAVE }, mundo)
    s.setTableScene('s-portao')
    const r = s.broadcast(mundo)
    const tela = snapshotDaTela(r)
    expect(tela.tokens.map((t) => t.id).sort()).toEqual(['guarda', 'lanterna'])
    expect(tela.tokens.find((t) => t.id === 'guarda')?.alerta).toBe('?')
    const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-tv'))
    expect(texto).not.toContain('ladra')
    expect(texto).not.toContain('vigia')
  })
})
