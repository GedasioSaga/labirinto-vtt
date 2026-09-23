/**
 * LASER DO JOGADOR no host: o lote de Ana vai ao mestre (inteiro) e a quem
 * joga NA MESMA CENA, na cor da ficha dela. Quem está em outra cena não recebe
 * nem o frame; e de cada lote, cada um só recebe os pontos que já conhece e
 * que estão fora de zona oculta ativa e de sala secreta.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { signalColor } from '../lib/signals'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, PLAYER_LASER_MAX_PER_WINDOW, PLAYER_LASER_WINDOW_MS, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const COR_ANA = '#3cff00'

function ficha(id: string, x: number, y: number, color?: string): Token {
  const base: Token = { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
  return color === undefined ? base : { ...base, color }
}

function mapa(id: string, nome: string, tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens, ...extra }
}

/** Salão (aberto no editor): Ana (verde-limão) e Caio; Cripta (de fundo): Bruno. */
function mundoCom(salaoExtra: Partial<MapData> = {}): HostWorld {
  const salao: HostScene = {
    sceneId: 's-salao',
    name: 'Salao Norte',
    map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100, COR_ANA), ficha('adaga', 300, 100)], salaoExtra),
  }
  const cripta: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }
  return { open: salao, background: [cripta] }
}

function mesa(mundo: HostWorld = mundoCom()) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: 5000, now: () => clock, randomId: (() => {
    let n = 0
    return () => `id-${(n += 1)}`
  })() })
  const entra = (clientId: string, name: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  const caio = entra('c3', 'Caio')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.assignToken(caio, 'adaga')
  // Snapshot de todo mundo: é ele que diz o que cada um já conhece.
  s.broadcast(mundo)
  return { s, mundo, ana, bruno, caio, advance: (ms: number) => (clock += ms) }
}

const para = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId)

describe('hostSession: laser do jogador', () => {
  it('vai a quem está na mesma cena, com o nome e a cor da ficha de quem aponta; não volta a quem aponta', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 120, y: 300 }, { x: 180, y: 300 }] }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'laser', points: [{ x: 120, y: 300 }, { x: 180, y: 300 }], from: 'Ana', color: COR_ANA } }])
    expect(para(r, 'c1')).toEqual([])
  })

  it('segurança: quem está em OUTRA cena não recebe nem o frame, nem o nome de quem aponta', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 120, y: 300 }] }, t.mundo)
    expect(para(r, 'c2')).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('"c2"')
    const fim = t.s.handleMessage('c1', { type: 'laser', off: true }, t.mundo)
    expect(para(fim, 'c2')).toEqual([])
  })

  it('o mestre recebe o lote inteiro, marcado como da cena aberta; o de quem está na cena de fundo não é', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 120, y: 300 }] }, t.mundo)
    expect(r.playerLaser).toEqual({ playerId: t.ana, name: 'Ana', color: COR_ANA, update: { points: [{ x: 120, y: 300 }] }, onOpenScene: true })
    const daCripta = t.s.handleMessage('c2', { type: 'laser', points: [{ x: 50, y: 50 }] }, t.mundo)
    expect(daCripta.playerLaser).toMatchObject({ name: 'Bruno', onOpenScene: false })
    // Ficha sem cor: a da paleta de sinais, a mesma do sinal dele.
    expect(daCripta.playerLaser?.color).toBe(signalColor(t.bruno))
  })

  it('segurança: ponto dentro de zona oculta ativa sai do lote de quem vê o lugar; o resto chega', () => {
    const zona = [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }]
    const t = mesa(mundoCom({ concealZones: [{ id: 'z', name: 'cofre', revealed: false, points: zona }] }))
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 200, y: 300 }, { x: 500, y: 300 }, { x: 700, y: 300 }] }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: expect.objectContaining({ points: [{ x: 200, y: 300 }, { x: 700, y: 300 }] }) }])
    expect(JSON.stringify(para(r, 'c3'))).not.toContain('500')
    // O mestre vê tudo.
    expect(r.playerLaser?.update).toEqual({ points: [{ x: 200, y: 300 }, { x: 500, y: 300 }, { x: 700, y: 300 }] })
  })

  it('segurança: ponto dentro de sala secreta também não é repassado', () => {
    const quadrado = [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }]
    const sala: Region = { id: 'cofre', points: quadrado, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Cofre' }, secret: true }
    const t = mesa(mundoCom({ regions: [sala] }))
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 500, y: 300 }] }, t.mundo)
    expect(para(r, 'c3')).toEqual([])
  })

  it('segurança: ponto que o outro nunca viu (atrás da parede) não chega a ele', () => {
    // Parede em x=500 de ponta a ponta: Caio (x=700) nunca viu o lado de Ana.
    const parede: Wall = { id: 'div', x1: 500, y1: 0, x2: 500, y2: 500, blocksLight: true, blocksMove: true, door: null }
    const mundo = mundoCom({ walls: [parede] })
    const salao = { ...mundo.open, map: { ...mundo.open.map, tokens: [ficha('lanterna', 100, 100, COR_ANA), ficha('adaga', 700, 100)] } }
    const t = mesa({ ...mundo, open: salao })
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 200, y: 300 }] }, t.mundo)
    expect(para(r, 'c3')).toEqual([])
    // Controle positivo: do lado de Caio, ele recebe.
    const visto = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 800, y: 300 }] }, t.mundo)
    expect(para(visto, 'c3')).toHaveLength(1)
  })

  it('o off vai só a quem recebeu algum ponto do gesto; depois do off, o próximo gesto recomeça do zero', () => {
    const t = mesa()
    t.s.handleMessage('c1', { type: 'laser', points: [{ x: 120, y: 300 }] }, t.mundo)
    const fim = t.s.handleMessage('c1', { type: 'laser', off: true }, t.mundo)
    expect(fim.outbound).toEqual([{ clientId: 'c3', msg: { type: 'laser', off: true, from: 'Ana', color: COR_ANA } }])
    expect(fim.playerLaser).toMatchObject({ update: { off: true } })
    expect(t.s.handleMessage('c1', { type: 'laser', off: true }, t.mundo).outbound).toEqual([])
  })

  it('de quem não entrou devolve not_joined; de quem aguarda ou fora do mapa morre em silêncio', () => {
    const t = mesa()
    expect(t.s.handleMessage('cx', { type: 'laser', points: [{ x: 1, y: 1 }] }, t.mundo).outbound).toEqual([{ clientId: 'cx', msg: { type: 'error', reason: 'not_joined' } }])
    t.s.handleMessage('c4', { type: 'join', code: CODE, name: 'Dora' }, t.mundo)
    expect(t.s.handleMessage('c4', { type: 'laser', points: [{ x: 1, y: 1 }] }, t.mundo)).toEqual({ outbound: [] })
    expect(t.s.handleMessage('c1', { type: 'laser', points: [{ x: -5, y: 1 }] }, t.mundo)).toEqual({ outbound: [] })
    expect(t.s.handleMessage('c1', { type: 'laser', points: [{ x: 1, y: 99999 }] }, t.mundo)).toEqual({ outbound: [] })
  })

  it('segurança: nome e cor mandados pelo jogador são ignorados — quem aponta é quem a conexão diz', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'laser', points: [{ x: 120, y: 300 }], from: 'Mestre', color: '#ff2d2d' }, t.mundo)
    expect(para(r, 'c3')[0]?.msg).toMatchObject({ from: 'Ana', color: COR_ANA })
  })

  it('teto de lotes por jogador a cada janela; a janela seguinte volta a aceitar', () => {
    const t = mesa()
    const lote = () => t.s.handleMessage('c1', { type: 'laser', points: [{ x: 120, y: 300 }] }, t.mundo)
    for (let i = 0; i < PLAYER_LASER_MAX_PER_WINDOW; i += 1) expect(lote().playerLaser).toBeDefined()
    expect(lote()).toEqual({ outbound: [] })
    t.advance(PLAYER_LASER_WINDOW_MS)
    expect(lote().playerLaser).toBeDefined()
  })
})
