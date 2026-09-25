import { describe, expect, it } from 'vitest'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { createEmptyMap } from '../lib/mapFactory'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * Eco do sinal: o eco de quem sinaliza sai tracejado (`unheard: true`) quando
 * nenhum colega À VISTA dele está vendo o ponto. O mestre sempre recebe pelo
 * campo `signal` e não conta.
 *
 * O eco NÃO é "alguém recebeu?": essa resposta desenharia a sala secreta,
 * a planta que o colega explorou dentro da névoa de quem sinaliza e a
 * presença de colega fora de vista (blocos de segurança no fim).
 *
 * DIVERGÊNCIA DO PEDIDO, PENDENTE DE DECISÃO DO DONO: o pedido diz "tracejado
 * quando ninguém recebe". Os testes marcados "DIVERGE DO PEDIDO" registram os
 * cenários em que o tracejado NÃO bate com a entrega (Bia recebe e o eco sai
 * tracejado; ninguém recebe e o eco sai cheio). Não são o comportamento
 * desejado: são o preço de não vazar, e só mudam com decisão explícita.
 */

const CODE = 'AB12CD'
const RADIUS = 700

type Ponto = { x: number; y: number }

function token(id: string, p: Ponto): Token {
  return { id, characterId: null, name: `nome-${id}`, x: p.x, y: p.y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

interface Posicoes {
  ana?: Ponto
  bia?: Ponto
  caio?: Ponto
  paredes?: Wall[]
}

/** Parede em x=500 separa duas salas. Padrão: Ana à esquerda; Bia e Caio à direita. */
function mapa({ ana = { x: 200, y: 200 }, bia = { x: 800, y: 200 }, caio = { x: 800, y: 600 }, paredes }: Posicoes = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    walls: paredes ?? [wall('divisoria', 500, 0, 500, 1000)],
    tokens: [token('heroi', ana), token('ladino', bia), token('mago', caio)],
  }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** Ana, Bia e Caio jogando; Davi entrou mas aguarda (sem ficha). */
function montar(map: MapData = mapa(), radius: number = RADIUS) {
  let clock = 0
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: radius, now: () => clock, randomId: () => `id-${(n += 1)}` })
  const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
  const bia = welcomeOf(s.handleMessage('c-bia', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
  const caio = welcomeOf(s.handleMessage('c-caio', { type: 'join', code: CODE, name: 'Caio' }, map).outbound)
  s.handleMessage('c-davi', { type: 'join', code: CODE, name: 'Davi' }, map)
  s.assignToken(ana.playerId, 'heroi')
  s.assignToken(bia.playerId, 'ladino')
  s.assignToken(caio.playerId, 'mago')
  s.broadcast(map)
  return {
    s,
    color: signalColor(ana.playerId),
    /** Sinal de Ana, já passado o intervalo mínimo do anterior. */
    sinal: (p: Ponto, m: MapData = map): HostResult => {
      clock += SIGNAL_MIN_INTERVAL_MS
      return s.handleMessage('c-ana', { type: 'signal', x: p.x, y: p.y }, m)
    },
  }
}

const para = (result: HostResult, clientId: string): HostMessage[] => result.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)

/** Os ids de ficha que o último snapshot de um cliente levou. */
function fichasVistas(result: HostResult, clientId: string): string[] {
  const snap = para(result, clientId).find((m) => m.type === 'snapshot')
  if (snap?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return snap.map.tokens.map((t) => t.id)
}

/** O eco de Ana sem as coordenadas: é isso que ela compara entre dois sinais. */
const ecoSemPonto = (r: HostResult): HostMessage[] => para(r, 'c-ana').map((m) => ({ ...m, x: 0, y: 0 }))

describe('hostSession: eco do sinal — os 3 casos', () => {
  it('todos recebem: os três na mesma sala, o eco de Ana sai cheio e Bia e Caio recebem a mensagem de sempre', () => {
    const map = mapa({ bia: { x: 300, y: 600 }, caio: { x: 200, y: 600 } })
    const t = montar(map)
    const r = t.sinal({ x: 300, y: 300 })
    const comum = { type: 'signal', x: 300, y: 300, from: 'Ana', color: t.color }
    expect(para(r, 'c-ana')).toEqual([comum])
    expect(para(r, 'c-bia')).toEqual([comum])
    expect(para(r, 'c-caio')).toEqual([comum])
    expect(para(r, 'c-davi')).toEqual([])
    expect(r.signal).toEqual({ playerId: expect.any(String), name: 'Ana', color: t.color, x: 300, y: 300 })
  })

  it('parte recebe: Caio (ao lado de Ana) recebe, Bia (atrás da parede) não; o eco sai cheio e não conta quem', () => {
    const t = montar(mapa({ caio: { x: 200, y: 600 } }))
    const r = t.sinal({ x: 300, y: 300 })
    const comum = { type: 'signal', x: 300, y: 300, from: 'Ana', color: t.color }
    expect(para(r, 'c-caio')).toEqual([comum])
    expect(para(r, 'c-bia')).toEqual([])
    expect(para(r, 'c-ana')).toEqual([comum])
    const eco = JSON.stringify(para(r, 'c-ana'))
    expect(eco).not.toContain('Bia')
    expect(eco).not.toContain('Caio')
    expect(eco).not.toContain('unheard')
  })

  it('ninguém recebe: Bia e Caio, do outro lado da parede, nunca viram o ponto; o eco de Ana sai com unheard', () => {
    const t = montar()
    const r = t.sinal({ x: 300, y: 300 })
    expect(para(r, 'c-ana')).toEqual([{ type: 'signal', x: 300, y: 300, from: 'Ana', color: t.color, unheard: true }])
    expect(para(r, 'c-bia')).toEqual([])
    expect(para(r, 'c-caio')).toEqual([])
    expect(para(r, 'c-davi')).toEqual([])
    // O mestre continua recebendo.
    expect(r.signal).toEqual({ playerId: expect.any(String), name: 'Ana', color: t.color, x: 300, y: 300 })
  })

  it('jogando sozinho (os outros só aguardam): o sinal fica sem destinatário', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const map = mapa()
    const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.handleMessage('c-bia', { type: 'join', code: CODE, name: 'Bia' }, map)
    s.assignToken(ana.playerId, 'heroi')
    s.broadcast(map)
    const r = s.handleMessage('c-ana', { type: 'signal', x: 300, y: 300 }, map)
    expect(para(r, 'c-ana')).toEqual([expect.objectContaining({ type: 'signal', unheard: true })])
    expect(para(r, 'c-bia')).toEqual([])
  })
})

describe('hostSession: eco do sinal — o eco não revela o que Ana não sabe', () => {
  it('o que o colega recebe nunca leva unheard (JSON do payload)', () => {
    const t = montar()
    const r = t.sinal({ x: 800, y: 400 })
    const aosColegas = r.outbound.filter((o) => o.clientId !== 'c-ana')
    expect(aosColegas).toHaveLength(2)
    expect(JSON.stringify(aosColegas)).not.toContain('unheard')
  })

  it('zona oculta ativa (que Ana já recebe desenhada): unheard; revelada, o eco volta ao normal', () => {
    const base = mapa({ bia: { x: 300, y: 600 }, caio: { x: 200, y: 600 } })
    const zona = (revealed: boolean): MapData => ({
      ...base,
      concealZones: [{ id: 'z', name: 'cofre', revealed, points: [{ x: 250, y: 250 }, { x: 400, y: 250 }, { x: 400, y: 400 }, { x: 250, y: 400 }] }],
    })
    const t = montar(zona(false))
    const oculto = t.sinal({ x: 300, y: 300 })
    expect(para(oculto, 'c-ana')).toEqual([{ type: 'signal', x: 300, y: 300, from: 'Ana', color: t.color, unheard: true }])
    const oculta = JSON.stringify(oculto.outbound)
    expect(oculta).not.toContain('cofre')
    expect(oculta).not.toContain('"c-bia"')
    expect(oculta).not.toContain('"c-caio"')

    // Controle positivo: revelada (e já mandada a todos), os colegas recebem e o eco volta ao normal.
    t.s.broadcast(zona(true))
    const revelado = t.sinal({ x: 300, y: 300 }, zona(true))
    expect(para(revelado, 'c-bia')).toHaveLength(1)
    expect(para(revelado, 'c-ana')).toEqual([{ type: 'signal', x: 300, y: 300, from: 'Ana', color: t.color }])
  })

  it('DIVERGE DO PEDIDO — sala secreta não descoberta: dentro ninguém recebe e o eco sai cheio; sinal dentro e logo ao lado dão o MESMO eco, embora só o de fora seja repassado', () => {
    // Mesmo cenário da evidência do revisor: sala secreta em 600..900 x 500..800,
    // Ana em (700,200) e Bia em (800,200) veem as duas pontas; raio 900.
    const sala = buildRoomFromDraft('sec', ['sw1', 'sw2', 'sw3', 'sw4'], { x: 600, y: 500 }, { x: 900, y: 800 }, undefined, undefined, 'Cofre')
    const map: MapData = {
      ...mapa({ ana: { x: 700, y: 200 }, bia: { x: 800, y: 200 }, caio: { x: 100, y: 900 }, paredes: sala.walls }),
      regions: [{ ...sala.region, secret: true }],
    }
    const t = montar(map, 900)
    const fora = t.sinal({ x: 750, y: 450 })
    const dentro = t.sinal({ x: 750, y: 650 })
    // A entrega não mudou: dentro da sala ninguém recebe.
    expect(para(fora, 'c-bia')).toHaveLength(1)
    expect(para(dentro, 'c-bia')).toEqual([])
    // O eco de Ana é o mesmo nos dois: sem isso, um sinal por segundo desenharia a sala.
    expect(ecoSemPonto(dentro)).toEqual(ecoSemPonto(fora))
    expect(para(dentro, 'c-ana')).toEqual([{ type: 'signal', x: 750, y: 650, from: 'Ana', color: t.color }])
    expect(JSON.stringify(dentro.outbound)).not.toContain('Cofre')
  })

  it('DIVERGE DO PEDIDO — névoa de Ana: Bia recebe e o eco sai tracejado; ponto que Bia conhece e ponto que ninguém conhece dão o MESMO eco (a planta de Bia não vaza)', () => {
    // Direita dividida em y=500: Bia vê a metade de cima; a de baixo ninguém viu. Caio fica com Ana.
    const paredes = [wall('divisoria', 500, 0, 500, 1000), wall('meio', 500, 500, 1000, 500)]
    const t = montar(mapa({ caio: { x: 200, y: 600 }, paredes }))
    const conhecido = t.sinal({ x: 800, y: 400 })
    const ninguem = t.sinal({ x: 800, y: 800 })
    // Bia recebe o primeiro: é exatamente o que um eco honesto contaria a Ana.
    expect(para(conhecido, 'c-bia')).toHaveLength(1)
    expect(para(ninguem, 'c-bia')).toEqual([])
    expect(ecoSemPonto(conhecido)).toEqual(ecoSemPonto(ninguem))
    expect(para(conhecido, 'c-ana')).toEqual([{ type: 'signal', x: 800, y: 400, from: 'Ana', color: t.color, unheard: true }])
  })

  it('fumaça que o mestre esconde de Ana (sala encostada em zona oculta): o eco é o MESMO com e sem a fumaça', () => {
    // Mesmo cenário da evidência do revisor: sem paredes; o salão (x 300..1000)
    // encosta numa zona oculta ativa, o que esconde o perigo dele de Ana.
    // Bia está no salão, à vista de Ana; Caio longe, fora de vista.
    const sala = buildRoomFromDraft('salao', ['s1', 's2', 's3', 's4'], { x: 300, y: 0 }, { x: 1000, y: 1000 }, undefined, undefined, 'Salao')
    const base: MapData = {
      ...mapa({ ana: { x: 100, y: 200 }, bia: { x: 400, y: 200 }, caio: { x: 100, y: 999 }, paredes: [] }),
      regions: [sala.region],
      concealZones: [{ id: 'z', name: 'z', revealed: false, points: [{ x: 900, y: 900 }, { x: 1000, y: 900 }, { x: 1000, y: 1000 }, { x: 900, y: 1000 }] }],
    }
    const comFumaca: MapData = { ...base, hazards: [{ id: 'h', kind: 'fumaca', roomIds: ['salao'] }] }
    const ponto = { x: 150, y: 600 }

    const semPerigo = montar(base)
    const vistasSem = semPerigo.s.broadcast(base)
    const ecoSem = para(semPerigo.sinal(ponto), 'c-ana')

    const perigo = montar(comFumaca)
    const vistasCom = perigo.s.broadcast(comFumaca)
    const ecoCom = para(perigo.sinal(ponto), 'c-ana')

    // Premissas: Bia está na tela de Ana e a fumaça não chega a Ana por nada.
    expect(fichasVistas(vistasCom, 'c-ana')).toContain('ladino')
    expect(JSON.stringify(para(vistasCom, 'c-ana'))).not.toContain('fumaca')
    expect(fichasVistas(vistasSem, 'c-ana')).toEqual(fichasVistas(vistasCom, 'c-ana'))
    // O eco não pode ser o canal: igual nos dois mapas, e cheio (Bia, sem contar a fumaça, vê o ponto).
    expect(ecoCom).toEqual(ecoSem)
    expect(ecoCom).toEqual([{ type: 'signal', x: 150, y: 600, from: 'Ana', color: perigo.color }])
  })

  /**
   * Os outros jeitos de o mestre esconder o perigo de Ana (`hazardHiddenByMaster`
   * em lib/fogFilter.ts): a sala tomada escondida por ele e a camada Salas
   * escondida. Em todos, a visão que Bia RECEBE vem encolhida pela fumaça; o
   * eco de Ana não pode mudar por isso.
   */
  it.each([
    ['sala do perigo escondida pelo mestre', (sala: MapData['regions'][number]): Partial<MapData> => ({ regions: [{ ...sala, hidden: true }] })],
    ['camada Salas escondida', (sala: MapData['regions'][number]): Partial<MapData> => ({ regions: [sala], hiddenLayers: ['salas'] })],
  ])('fumaça escondida de Ana (%s): o eco é o MESMO com e sem a fumaça', (_caso, esconder) => {
    const sala = buildRoomFromDraft('salao', ['s1', 's2', 's3', 's4'], { x: 300, y: 0 }, { x: 1000, y: 1000 }, undefined, undefined, 'Salao')
    const base: MapData = {
      ...mapa({ ana: { x: 100, y: 200 }, bia: { x: 400, y: 200 }, caio: { x: 100, y: 999 }, paredes: [] }),
      ...esconder(sala.region),
    }
    const comFumaca: MapData = { ...base, hazards: [{ id: 'h', kind: 'fumaca', roomIds: ['salao'] }] }
    const ponto = { x: 150, y: 600 }

    const semPerigo = montar(base)
    const vistasSem = semPerigo.s.broadcast(base)
    const ecoSem = para(semPerigo.sinal(ponto), 'c-ana')

    const perigo = montar(comFumaca)
    const vistasCom = perigo.s.broadcast(comFumaca)
    const ecoCom = para(perigo.sinal(ponto), 'c-ana')

    // Premissas: Bia está na tela de Ana, a fumaça não chega a Ana por nada e
    // de fato encolhe a visão que Bia recebe (senão o teste não prova nada).
    expect(fichasVistas(vistasCom, 'c-ana')).toContain('ladino')
    expect(JSON.stringify(para(vistasCom, 'c-ana'))).not.toContain('fumaca')
    expect(fichasVistas(vistasSem, 'c-ana')).toEqual(fichasVistas(vistasCom, 'c-ana'))
    expect(JSON.stringify(para(vistasCom, 'c-bia'))).not.toEqual(JSON.stringify(para(vistasSem, 'c-bia')))
    // O eco não pode ser o canal: igual nos dois mapas, e cheio (Bia, sem contar a fumaça, vê o ponto).
    expect(ecoCom).toEqual(ecoSem)
    expect(ecoCom).toEqual([{ type: 'signal', x: 150, y: 600, from: 'Ana', color: perigo.color }])
  })

  it('DIVERGE DO PEDIDO — colega fora de vista: Bia recebe e o eco sai tracejado; Bia vê o ponto que Ana vê, mas a ficha dela não está na tela de Ana; o eco não conta que ela está ali', () => {
    // Parede em x=500 só até y=600: Ana e Bia enxergam o vão de baixo, mas não uma à outra.
    const paredes = [wall('meia', 500, 0, 500, 600)]
    const map = mapa({ caio: { x: 100, y: 950 }, paredes })
    const t = montar(map)
    const vistas = t.s.broadcast(map)
    // Premissa do cenário: a ficha de Bia não vai para Ana.
    expect(fichasVistas(vistas, 'c-ana')).not.toContain('ladino')
    expect(fichasVistas(vistas, 'c-ana')).toContain('heroi')
    const r = t.sinal({ x: 500, y: 800 })
    expect(para(r, 'c-bia')).toHaveLength(1)
    expect(para(r, 'c-ana')).toEqual([{ type: 'signal', x: 500, y: 800, from: 'Ana', color: t.color, unheard: true }])
  })
})
