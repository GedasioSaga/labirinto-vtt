import { describe, expect, it } from 'vitest'
import { acaoDeFerrolho } from '../lib/ferrolho'
import { createEmptyMap } from '../lib/mapFactory'
import type { DoorState, MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * JOGADOR TRANCA PORTA OU PASSAGEM. Ana passou pela porta do corredor e corre o
 * ferrolho do lado dela; Bruno, do outro lado, tenta abrir: lê "Trancada" (o
 * mesmo aviso da porta que o mestre trancou) e a tentativa vira disputa na
 * Caixa do mestre ("Arrombar" / "Aguenta"). Na viagem, Ana barra o alçapão por
 * onde chegou; quem vem do outro lado vira pedido ao mestre, mesmo com a
 * passagem livre.
 *
 * O que NÃO pode chegar a quem está do outro lado: a marca do ferrolho, o nome
 * de quem trancou, nem a barra do pino (outra cena).
 */

const CODE = 'FERR01'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function corredor(porta: Partial<DoorState> = {}): MapData {
  return {
    ...createEmptyMap('mapa-corredor', 'Corredor', 20, 10, 50),
    walls: [parede('norte', 500, 0, 500, 200), parede('porta', 500, 200, 500, 300, { open: false, locked: false, kind: 'normal', ...porta }), parede('sul', 500, 300, 500, 500)],
    tokens: [ficha('ficha-ana', 'Heroina', 450, 250), ficha('ficha-bruno', 'Guarda', 550, 250)],
  }
}

function welcome(r: HostResult): string {
  const msg = r.outbound[0]?.msg
  if (msg?.type !== 'welcome') throw new Error('esperava welcome')
  return msg.playerId
}

function mesa(map: MapData | HostWorld, fichas: { ana: string; bruno: string } = { ana: 'ficha-ana', bruno: 'ficha-bruno' }) {
  let n = 0
  // Cada leitura do relógio anda 1 s: nenhum limite de frequência (porta, viagem) segura o passo seguinte do teste.
  let t = 1_000_000
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => (t += 1000), randomId: () => `id-${(n += 1)}` })
  const ana = welcome(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map))
  const bruno = welcome(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bruno' }, map))
  s.assignToken(ana, fichas.ana)
  s.assignToken(bruno, fichas.bruno)
  return { s, ana, bruno }
}

function snapshotPara(s: HostSession, clientId: string, map: MapData | HostWorld): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = s.broadcast(map).outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return snap
}

function portaNoRecorte(snap: Extract<HostMessage, { type: 'snapshot' }>): DoorState | null | undefined {
  return snap.map.walls.find((w) => w.id === 'porta')?.door
}

/** Ana corre o ferrolho com a porta fechada; devolve a sessão pronta. */
function anaTrancou(map: MapData) {
  const m = mesa(map)
  const r = m.s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, map)
  expect(r.trancaAviso).toEqual({ playerName: 'Ana', alvo: 'porta', acao: 'trancou' })
  return m
}

describe('hostSession: ferrolho na porta', () => {
  it('Ana passa o ferrolho numa porta aberta: a porta fecha e o mestre é avisado', () => {
    const aberta = corredor({ open: true })
    const { s } = mesa(aberta)
    const r = s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, aberta)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: false })
    expect(r.trancaAviso).toEqual({ playerName: 'Ana', alvo: 'porta', acao: 'trancou' })
    expect(r.outbound).toEqual([])
  })

  it('só quem está do lado do ferrolho recebe a marca; SEGURANÇA: do outro lado a porta chega igual a sempre, sem marca nem nome', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal', ferrolhoDoMeuLado: true })
    const doBruno = snapshotPara(s, 'c2', map)
    expect(portaNoRecorte(doBruno)).toEqual({ open: false, locked: false, kind: 'normal' })
    const json = JSON.stringify(doBruno)
    expect(json).not.toContain('ferrolho')
    expect(json).not.toContain('Ana')
    expect(json).not.toContain('Heroina')
  })

  it('Bruno, do outro lado, tenta abrir: lê "Trancada", a porta não abre e a tentativa vira disputa na Caixa', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const r = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
    expect(r.applyDoor).toBeUndefined()
    expect(r.barDispute?.playerName).toBe('Bruno')
    expect(r.barDispute?.barrerName).toBe('Ana')
    expect(s.isBarDisputePending(r.barDispute?.requestId ?? '')).toBe(true)
    // Insistir com a disputa esperando o mestre não empilha outra na Caixa.
    const de_novo = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(de_novo.barDispute).toBeUndefined()
    expect(de_novo.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
  })

  it('o mestre manda "Arrombar": a porta abre e o ferrolho sai', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const disputa = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).barDispute
    if (disputa === undefined) throw new Error('esperava a disputa')
    const r = s.answerBarDispute(disputa.requestId, true, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true })
    expect(s.isBarDisputePending(disputa.requestId)).toBe(false)
    // Fechada de novo pelo mestre, a porta volta sem ferrolho: ele foi arrombado.
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('o mestre diz "Aguenta": nada abre, o ferrolho fica, e Bruno pode tentar de novo depois', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const disputa = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).barDispute
    if (disputa === undefined) throw new Error('esperava a disputa')
    const r = s.answerBarDispute(disputa.requestId, false, map)
    expect(r).toEqual({ outbound: [] })
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))?.ferrolhoDoMeuLado).toBe(true)
    expect(s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).barDispute?.playerName).toBe('Bruno')
  })

  it('do lado do ferrolho, abrir corre o ferrolho: Ana abre normalmente e a marca some', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const r = s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true })
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
    // Sem ferrolho, Bruno abre sem disputa.
    const bruno = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(bruno.applyDoor).toEqual({ wallId: 'porta', open: true })
    expect(bruno.barDispute).toBeUndefined()
  })

  it('"Tirar o ferrolho" só vale do lado dele: Bruno não tira, Ana tira', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const doBruno = s.handleMessage('c2', { type: 'door.bar', wallId: 'porta', on: false }, map)
    expect(doBruno.trancaAviso).toBeUndefined()
    // Recusa com resposta ("Trancada"), nunca silêncio: o botão de quem pediu não fica preso esperando.
    expect(doBruno.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))?.ferrolhoDoMeuLado).toBe(true)
    const daAna = s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: false }, map)
    expect(daAna.trancaAviso).toEqual({ playerName: 'Ana', alvo: 'porta', acao: 'destrancou' })
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('Bruno não passa um segundo ferrolho do lado dele numa porta já trancada por Ana: "Trancada"', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const r = s.handleMessage('c2', { type: 'door.bar', wallId: 'porta', on: true }, map)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
    expect(r.trancaAviso).toBeUndefined()
  })

  it('porta trancada pelo mestre e porta longe não aceitam ferrolho', () => {
    const trancada = corredor({ locked: true })
    const t = mesa(trancada)
    expect(t.s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, trancada).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } },
    ])
    const longe: MapData = { ...corredor(), tokens: [ficha('ficha-ana', 'Heroina', 200, 250), ficha('ficha-bruno', 'Guarda', 800, 250)] }
    const l = mesa(longe)
    const r = l.s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, longe)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'far' } }])
    expect(r.trancaAviso).toBeUndefined()
  })

  it('ficha de Ana do lado do ferrolho mas LONGE, outra encostada do lado oposto: a marca e o host concordam, e o botão nunca fica sem resposta', () => {
    // Ana corre o ferrolho com a ficha 1 encostada do lado oeste; a ficha 2 está longe, a leste.
    const antes: MapData = { ...corredor(), tokens: [ficha('ficha-ana', 'Heroina', 450, 250), ficha('ficha-ana2', 'Escudeira', 900, 250), ficha('ficha-bruno', 'Guarda', 950, 400)] }
    const m = mesa(antes)
    m.s.assignToken(m.ana, 'ficha-ana2')
    expect(m.s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, antes).trancaAviso?.acao).toBe('trancou')
    // Depois: a ficha 1 recua para longe (mesmo lado do ferrolho) e a 2 encosta na porta do lado oposto.
    const depois: MapData = { ...antes, tokens: [ficha('ficha-ana', 'Heroina', 200, 250), ficha('ficha-ana2', 'Escudeira', 550, 250), ficha('ficha-bruno', 'Guarda', 950, 400)] }
    const snap = snapshotPara(m.s, 'c1', depois)
    // Nenhuma ficha que ALCANÇA a porta está do lado do ferrolho: sem marca, como o host decide.
    expect(portaNoRecorte(snap)).toEqual({ open: false, locked: false, kind: 'normal' })
    const acao = acaoDeFerrolho(snap.map, snap.ownTokens)
    expect(acao).toEqual({ wallId: 'porta', acao: 'passar', aberta: false })
    // O que o botão manda agora tem resposta do host ("Trancada"), em vez de silêncio.
    const r = m.s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, depois)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
  })

  it('o mestre abre a porta pelo editor: o ferrolho não vale mais, nem depois que ela fecha', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    snapshotPara(s, 'c1', corredor({ open: true }))
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toEqual({ wallId: 'porta', open: true })
  })
})

// ---------------------------------------------------------------------------
// PASSAGEM (pino de viagem)

const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: id === 'fundo' ? 'Fundo do poço' : 'Alçapão', image: null, destino, ...extra }
}

/** Ana chegou à Cripta pelo fundo do poço; Bruno ficou no Salão, junto do alçapão (livre). */
function mundo(): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    tokens: [ficha('ficha-bruno', 'Guarda', 350, 200)],
    pins: [viagem('alcapao', 400, 200, { sceneId: CRIPTA, pinId: 'fundo' }, { passagem: 'livre' })],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, 50),
    tokens: [ficha('ficha-ana', 'Heroina', 950, 250)],
    pins: [viagem('fundo', 1000, 250, { sceneId: SALAO, pinId: 'alcapao' })],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }] }
}

function pinoNoRecorte(snap: Extract<HostMessage, { type: 'snapshot' }>, pinId: string): Pin | undefined {
  return snap.map.pins.find((p) => p.id === pinId)
}

function anaBarrou(w: HostWorld) {
  const m = mesa(w)
  m.s.broadcast(w)
  const r = m.s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: true }, w)
  expect(r.trancaAviso).toEqual({ playerName: 'Ana', alvo: 'passagem', acao: 'trancou', rotulo: 'Fundo do poço', sceneName: 'Cripta Rubra' })
  return m
}

describe('hostSession: barrar a passagem por onde chegou', () => {
  it('Ana barra o fundo do poço: o pino chega marcado a ela; SEGURANÇA: Bruno, na outra cena, não recebe barra nem nome', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBe(true)
    const doBruno = snapshotPara(s, 'c2', w)
    expect(pinoNoRecorte(doBruno, 'alcapao')).toEqual(expect.objectContaining({ id: 'alcapao', passagem: 'livre' }))
    const json = JSON.stringify(doBruno)
    expect(json).not.toContain('barrada')
    expect(json).not.toContain('Ana')
    expect(json).not.toContain('Cripta')
  })

  it('Bruno tenta passar pelo alçapão livre: não passa direto, vira pedido ao mestre dizendo quem barrou', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const r = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w)
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest?.playerName).toBe('Bruno')
    expect(r.travelRequest?.barradaPor).toBe('Ana')
  })

  it('Bruno fica sabendo que o pedido espera o mestre (não fica em "Passando…"); SEGURANÇA: sem nome de quem barrou nem da cena', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const r = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'pin.travel.pending' } }])
    const json = JSON.stringify(r.outbound)
    expect(json).not.toContain('Ana')
    expect(json).not.toContain('Cripta')
    expect(json).not.toContain('barra')
  })

  it('passagem livre sem barra continua indo direto, sem aviso de espera', () => {
    const w = mundo()
    const { s } = mesa(w)
    s.broadcast(w)
    const r = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w)
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
    expect(r.outbound.some((o) => o.msg.type === 'pin.travel.pending')).toBe(false)
  })

  it('o mestre diz "Não": Bruno fica, e a barra continua', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const pedido = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).travelRequest
    if (pedido === undefined) throw new Error('esperava o pedido')
    expect(s.denyTravel(pedido.requestId).outbound).toEqual([{ clientId: 'c2', msg: { type: 'pin.travel.denied' } }])
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBe(true)
  })

  it('"Deixar ir" numa passagem barrada: Bruno atravessa e a barra do outro lado some', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const pedido = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).travelRequest
    if (pedido === undefined) throw new Error('esperava o pedido')
    const r = s.approveTravel(pedido.requestId, w)
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBeUndefined()
  })

  it('Ana tira a barra: a marca some e a passagem livre volta a passar direto', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const r = s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: false }, w)
    expect(r.trancaAviso?.acao).toBe('destrancou')
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBeUndefined()
    expect(s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('longe do pino, ou pino que não é de viagem: nada acontece', () => {
    const w = mundo()
    const longe: HostWorld = {
      ...w,
      background: w.background.map((c) => ({ ...c, map: { ...c.map, tokens: [ficha('ficha-ana', 'Heroina', 300, 250)] } })),
    }
    const m = mesa(longe)
    m.s.broadcast(longe)
    const r = m.s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: true }, longe)
    expect(r).toEqual({ outbound: [] })
    expect(pinoNoRecorte(snapshotPara(m.s, 'c1', longe), 'fundo')?.barradaDaqui).toBeUndefined()
  })

  it('Carla barra, Ana está na MESMA cena: a marca é do lado e chega igual às duas; SEGURANÇA: o nome de quem barrou não chega a Ana', () => {
    const base = mundo()
    // Carla também chegou à Cripta, encostada no fundo do poço.
    const w: HostWorld = {
      ...base,
      background: base.background.map((c) => ({ ...c, map: { ...c.map, tokens: [...c.map.tokens, ficha('ficha-carla', 'Batedora', 1050, 250)] } })),
    }
    const { s } = mesa(w)
    const carla = welcome(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Carla' }, w))
    s.assignToken(carla, 'ficha-carla')
    s.broadcast(w)
    const r = s.handleMessage('c3', { type: 'pin.bar', pinId: 'fundo', on: true }, w)
    expect(r.trancaAviso?.playerName).toBe('Carla')
    const daCarla = pinoNoRecorte(snapshotPara(s, 'c3', w), 'fundo')
    const daAna = snapshotPara(s, 'c1', w)
    // A mesma marca a quem barrou e a quem não barrou: o recorte não diz quem foi,
    // por isso o cartão fala "Passagem barrada deste lado", nunca "Você barrou".
    expect(daCarla?.barradaDaqui).toBe(true)
    expect(pinoNoRecorte(daAna, 'fundo')).toEqual(daCarla)
    expect(JSON.stringify(daAna)).not.toContain('Carla')
    // Ana, deste lado e encostada no pino, tira a barra: é do lado, como o ferrolho.
    expect(s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: false }, w).trancaAviso).toEqual(
      expect.objectContaining({ playerName: 'Ana', acao: 'destrancou' }),
    )
    expect(pinoNoRecorte(snapshotPara(s, 'c3', w), 'fundo')?.barradaDaqui).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// PASSAGEM NA NÉVOA: a barra de um pino que o jogador só lembra (explorado,
// fora da visão) não pode mudar ao vivo. Senão Bruno, longe, vê a marca surgir
// quando Ana barra escondida na névoa (e sumir quando alguém chega por ali).

/** Uma cena só: Ana encostada no fundo do poço; Bruno em `brunoX`. Visão curta (300) para o pino cair na névoa. */
function criptaCom(brunoX: number): HostWorld {
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, 50),
    tokens: [ficha('ficha-ana', 'Heroina', 1050, 250), ficha('ficha-bruno', 'Guarda', brunoX, 250)],
    pins: [viagem('fundo', 1000, 250, { sceneId: SALAO, pinId: 'alcapao' })],
  }
  const salao: MapData = { ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50), pins: [viagem('alcapao', 400, 200, { sceneId: CRIPTA, pinId: 'fundo' })] }
  return { open: { sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }, background: [{ sceneId: SALAO, name: 'Salão', map: salao }] }
}

function mesaNaNevoa(w: HostWorld) {
  let n = 0
  let t = 1_000_000
  const s = createHostSession({ code: CODE, visionRadius: 300, now: () => (t += 1000), randomId: () => `id-${(n += 1)}` })
  const ana = welcome(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  const bruno = welcome(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bruno' }, w))
  s.assignToken(ana, 'ficha-ana')
  s.assignToken(bruno, 'ficha-bruno')
  return s
}

describe('hostSession: pino barrado na névoa sai com o estado lembrado', () => {
  const PERTO = 900
  const LONGE = 100

  it('SEGURANÇA: Ana barra escondida na névoa de Bruno; o pino que ele só lembra não ganha a marca', () => {
    const perto = criptaCom(PERTO)
    const longe = criptaCom(LONGE)
    const s = mesaNaNevoa(perto)
    // Bruno passa perto (explora o pino, sem barra) e se afasta.
    expect(pinoNoRecorte(snapshotPara(s, 'c2', perto), 'fundo')?.barradaDaqui).toBeUndefined()
    const antes = snapshotPara(s, 'c2', longe)
    expect(pinoNoRecorte(antes, 'fundo')).toEqual(expect.objectContaining({ id: 'fundo' }))
    expect(antes.map.tokens.map((t) => t.id)).toEqual(['ficha-bruno'])
    expect(s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: true }, longe).trancaAviso?.acao).toBe('trancou')
    expect(pinoNoRecorte(snapshotPara(s, 'c1', longe), 'fundo')?.barradaDaqui).toBe(true)
    const depois = snapshotPara(s, 'c2', longe)
    expect(pinoNoRecorte(depois, 'fundo')).toEqual(pinoNoRecorte(antes, 'fundo'))
    expect(JSON.stringify(depois)).not.toContain('barrada')
    // Voltando a ver o pino, a barra aparece: é o estado de agora.
    expect(pinoNoRecorte(snapshotPara(s, 'c2', perto), 'fundo')?.barradaDaqui).toBe(true)
  })

  it('SEGURANÇA: Bruno viu a barra e se afastou; a barra tirada na névoa dele continua lembrada até ele voltar a ver', () => {
    const perto = criptaCom(PERTO)
    const longe = criptaCom(LONGE)
    const s = mesaNaNevoa(perto)
    snapshotPara(s, 'c2', perto)
    expect(s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: true }, perto).trancaAviso?.acao).toBe('trancou')
    expect(pinoNoRecorte(snapshotPara(s, 'c2', perto), 'fundo')?.barradaDaqui).toBe(true)
    expect(pinoNoRecorte(snapshotPara(s, 'c2', longe), 'fundo')?.barradaDaqui).toBe(true)
    expect(s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: false }, longe).trancaAviso?.acao).toBe('destrancou')
    expect(pinoNoRecorte(snapshotPara(s, 'c1', longe), 'fundo')?.barradaDaqui).toBeUndefined()
    // Na névoa de Bruno nada muda: ele segue com a barra que viu por último.
    expect(pinoNoRecorte(snapshotPara(s, 'c2', longe), 'fundo')?.barradaDaqui).toBe(true)
    // De volta à vista, o estado de agora: sem barra.
    const deVolta = pinoNoRecorte(snapshotPara(s, 'c2', perto), 'fundo')
    expect(deVolta).toEqual(expect.objectContaining({ id: 'fundo' }))
    expect(deVolta?.barradaDaqui).toBeUndefined()
  })
})
