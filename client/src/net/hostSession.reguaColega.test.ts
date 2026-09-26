/**
 * MOSTRAR UM CAMINHO COM A RÉGUA no host: Ana mede e manda o traço a um colega
 * da MESMA cena, pelo nome. O traço chega só a ele, com o nome e a cor da ficha
 * de Ana. Quem está em outra cena não recebe nada (nem o nome de Ana). O traço
 * pode atravessar o que o colega ainda não viu (a névoa dele continua cobrindo
 * a planta), mas perde os pontos em zona oculta ativa e em sala secreta. A
 * resposta a quem mediu não conta o que o colega conhece.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token, Wall } from '../types/map'
import { parsePlayerMessage, ROUTE_MAX_POINTS } from './protocol'
import { createHostSession, ROUTE_SHOW_MIN_INTERVAL_MS, type HostResult, type HostScene, type HostWorld } from './hostSession'

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
function mundoCom(salaoExtra: Partial<MapData> = {}, tokensDoSalao?: Token[]): HostWorld {
  const salao: HostScene = {
    sceneId: 's-salao',
    name: 'Salao Norte',
    map: mapa('m-salao', 'Salao Norte', tokensDoSalao ?? [ficha('lanterna', 100, 100, COR_ANA), ficha('adaga', 300, 100)], salaoExtra),
  }
  const cripta: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }
  return { open: salao, background: [cripta] }
}

function mesa(mundo: HostWorld = mundoCom()) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: 5000, now: () => clock })
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
  return { s, mundo, advance: (ms: number) => (clock += ms) }
}

const para = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId)
const TRACO = [{ x: 150, y: 300 }, { x: 650, y: 300 }]

describe('hostSession: caminho da régua para um colega', () => {
  it('chega só ao colega escolhido, com o nome e a cor da ficha de quem mediu; quem mediu lê que chegou', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: TRACO }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'route.shown', from: 'Ana', color: COR_ANA, points: TRACO } }])
    expect(para(r, 'c1')).toEqual([{ clientId: 'c1', msg: { type: 'route.show.result', to: 'Caio', ok: true } }])
    expect(r.outbound).toHaveLength(2)
  })

  it('segurança: colega em OUTRA cena não recebe nada, nem o nome de quem mediu; quem mediu lê só que não chegou', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Bruno', points: TRACO }, t.mundo)
    expect(para(r, 'c2')).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('"c2"')
    // Sem motivo: "está em outra cena" diria onde Bruno está.
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'route.show.result', to: 'Bruno', ok: false } }])
  })

  it('segurança: ponto dentro de zona oculta ativa não chega ao colega; o resto do traço chega', () => {
    const zona = [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }]
    const t = mesa(mundoCom({ concealZones: [{ id: 'z', name: 'cofre', revealed: false, points: zona }] }))
    const traco = [{ x: 200, y: 300 }, { x: 500, y: 300 }, { x: 700, y: 300 }]
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: traco }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: expect.objectContaining({ points: [{ x: 200, y: 300 }, { x: 700, y: 300 }] }) }])
    expect(JSON.stringify(para(r, 'c3'))).not.toContain('500')
  })

  it('segurança: ponto dentro de sala secreta não chega ao colega', () => {
    const quadrado = [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }]
    const sala: Region = { id: 'cofre', points: quadrado, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Cofre' }, secret: true }
    const t = mesa(mundoCom({ regions: [sala] }))
    const traco = [{ x: 200, y: 300 }, { x: 500, y: 300 }, { x: 700, y: 300 }]
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: traco }, t.mundo)
    const chegou = para(r, 'c3')
    expect(chegou).toHaveLength(1)
    expect(JSON.stringify(chegou)).not.toContain('500')
    expect(JSON.stringify(chegou)).not.toContain('Cofre')
  })

  // Parede em x=500 de ponta a ponta: Caio (x=700) nunca viu o lado de Ana, e Ana nunca viu o de Caio.
  const PAREDE: Wall = { id: 'div', x1: 500, y1: 0, x2: 500, y2: 500, blocksLight: true, blocksMove: true, door: null }
  const separados = () => mesa(mundoCom({ walls: [PAREDE] }, [ficha('lanterna', 100, 100, COR_ANA), ficha('adaga', 700, 100)]))

  it('o caminho atravessa o que o colega ainda não viu: chega inteiro (a névoa dele continua cobrindo a planta)', () => {
    const t = separados()
    // Ana aponta de onde Caio está até o lado dela, que Caio nunca viu.
    const ateAna = [{ x: 700, y: 300 }, { x: 150, y: 300 }]
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: ateAna }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: { type: 'route.shown', from: 'Ana', color: COR_ANA, points: ateAna } }])
    expect(para(r, 'c1')).toEqual([{ clientId: 'c1', msg: { type: 'route.show.result', to: 'Caio', ok: true } }])
  })

  it('segurança: a resposta a quem mede não depende do que o colega conhece (não é sonda da névoa dele)', () => {
    const t = separados()
    const respostaA = (points: { x: number; y: number }[]) => {
      t.advance(ROUTE_SHOW_MIN_INTERVAL_MS)
      return para(t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points }, t.mundo), 'c1')
    }
    const esperado = [{ clientId: 'c1', msg: { type: 'route.show.result', to: 'Caio', ok: true } }]
    // Só o lado de Ana (Caio não conhece) e só o lado de Caio (Ana não enxerga): a mesma resposta.
    expect(respostaA([{ x: 150, y: 300 }, { x: 250, y: 300 }])).toEqual(esperado)
    expect(respostaA([{ x: 800, y: 300 }, { x: 900, y: 300 }])).toEqual(esperado)
  })

  it('segurança: traço todo dentro de zona oculta não chega ao colega, e quem mediu lê a mesma resposta de sempre', () => {
    const zona = [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }]
    const t = mesa(mundoCom({ concealZones: [{ id: 'z', name: 'cofre', revealed: false, points: zona }] }))
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: [{ x: 450, y: 300 }, { x: 550, y: 300 }] }, t.mundo)
    expect(para(r, 'c3')).toEqual([])
    // "Não chegou" aqui diria a quem mede que há algo escondido ali.
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'route.show.result', to: 'Caio', ok: true } }])
  })

  it('ponto fora do mapa sai do traço', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: [{ x: -50, y: 300 }, ...TRACO, { x: 99999, y: 300 }] }, t.mundo)
    expect(para(r, 'c3')).toEqual([{ clientId: 'c3', msg: expect.objectContaining({ points: TRACO }) }])
  })

  it('dois traços em menos de um segundo: o segundo espera, com o motivo; passado o intervalo, sai', () => {
    const t = mesa()
    t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: TRACO }, t.mundo)
    const cedo = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: TRACO }, t.mundo)
    expect(cedo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'route.show.result', to: 'Caio', ok: false, reason: 'too_soon' } }])
    t.advance(ROUTE_SHOW_MIN_INTERVAL_MS)
    const depois = t.s.handleMessage('c1', { type: 'route.show', to: 'Caio', points: TRACO }, t.mundo)
    expect(para(depois, 'c3')).toHaveLength(1)
  })

  it('nome que não é de ninguém e o próprio nome não chegam a lugar nenhum', () => {
    const t = mesa()
    expect(t.s.handleMessage('c1', { type: 'route.show', to: 'Zé', points: TRACO }, t.mundo).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'route.show.result', to: 'Zé', ok: false } },
    ])
    expect(t.s.handleMessage('c1', { type: 'route.show', to: 'Ana', points: TRACO }, t.mundo).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'route.show.result', to: 'Ana', ok: false } },
    ])
  })
})

describe('parsePlayerMessage: route.show', () => {
  it('aceita 2 a ROUTE_MAX_POINTS pontos finitos e devolve cópia só com x/y', () => {
    const sujo = { type: 'route.show', to: 'Caio', points: [{ x: 1, y: 2, cor: 'x' }, { x: 3, y: 4 }], from: 'Mestre', color: '#000000' }
    expect(parsePlayerMessage(sujo)).toEqual({ type: 'route.show', to: 'Caio', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] })
  })

  it('um ponto só, pontos demais, ponto não finito ou nome vazio recusam a mensagem', () => {
    const muitos = Array.from({ length: ROUTE_MAX_POINTS + 1 }, (_, i) => ({ x: i, y: i }))
    expect(parsePlayerMessage({ type: 'route.show', to: 'Caio', points: [{ x: 1, y: 2 }] })).toBeNull()
    expect(parsePlayerMessage({ type: 'route.show', to: 'Caio', points: muitos })).toBeNull()
    expect(parsePlayerMessage({ type: 'route.show', to: 'Caio', points: [{ x: 1, y: 2 }, { x: Number.NaN, y: 2 }] })).toBeNull()
    expect(parsePlayerMessage({ type: 'route.show', to: '', points: TRACO })).toBeNull()
    expect(parsePlayerMessage({ type: 'route.show', points: TRACO })).toBeNull()
  })
})
