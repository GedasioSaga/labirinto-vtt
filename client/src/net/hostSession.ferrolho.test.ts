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

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

/**
 * A última tela inteira que cada conexão recebeu. O host só manda de novo a
 * tela que MUDOU (HOST RECALCULA SÓ A CENA QUE MUDOU): quem não mudou continua
 * com a de antes, e é essa que vale para o teste.
 */
const telas = new WeakMap<HostSession, Map<string, Snapshot>>()

/** Um broadcast, anotando a tela nova de cada conexão que recebeu uma. */
function transmitir(s: HostSession, map: MapData | HostWorld): void {
  const daSessao = telas.get(s) ?? new Map<string, Snapshot>()
  telas.set(s, daSessao)
  for (const o of s.broadcast(map).outbound) if (o.msg.type === 'snapshot') daSessao.set(o.clientId, o.msg)
}

function snapshotPara(s: HostSession, clientId: string, map: MapData | HostWorld): Snapshot {
  transmitir(s, map)
  const snap = telas.get(s)?.get(clientId)
  if (snap === undefined) throw new Error(`esperava snapshot para ${clientId}`)
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
    const { s, ana } = mesa(aberta)
    const r = s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, aberta)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: false, playerId: ana, playerName: 'Ana' })
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
    const { s, bruno } = anaTrancou(map)
    const disputa = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).barDispute
    if (disputa === undefined) throw new Error('esperava a disputa')
    const r = s.answerBarDispute(disputa.requestId, true, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
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
    const { s, ana, bruno } = anaTrancou(map)
    const r = s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: ana, playerName: 'Ana' })
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
    // Sem ferrolho, Bruno abre sem disputa.
    const doBruno = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(doBruno.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
    expect(doBruno.barDispute).toBeUndefined()
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
    const { s, bruno } = anaTrancou(map)
    snapshotPara(s, 'c1', corredor({ open: true }))
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
  })

  it('com o corredor vazio, o mestre abre e fecha a porta pelo editor: o ferrolho não volta quando os dois retornam', () => {
    const poco = createEmptyMap('mapa-poco', 'Poço', 20, 10, 50)
    // Corredor aberto no editor; o Poço de fundo. `noCorredor` diz onde estão as duas fichas.
    const mundoCom = (porta: Partial<DoorState>, noCorredor: boolean): HostWorld => {
      const c = corredor(porta)
      return {
        open: { sceneId: 'cena-corredor', name: 'Corredor', map: noCorredor ? c : { ...c, tokens: [] } },
        background: [{ sceneId: 'cena-poco', name: 'Poço', map: { ...poco, tokens: noCorredor ? [] : c.tokens } }],
      }
    }
    const aqui = mundoCom({}, true)
    const { s, bruno } = mesa(aqui)
    transmitir(s, aqui)
    expect(s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, aqui).trancaAviso?.acao).toBe('trancou')
    // Os dois descem ao Poço; ninguém no corredor, e o mestre abre e fecha a porta.
    transmitir(s, mundoCom({}, false))
    transmitir(s, mundoCom({ open: true }, false))
    transmitir(s, mundoCom({}, false))
    const volta = mundoCom({}, true)
    expect(portaNoRecorte(snapshotPara(s, 'c1', volta))).toEqual({ open: false, locked: false, kind: 'normal' })
    const r = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, volta)
    expect(r.barDispute).toBeUndefined()
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
  })

  it('o mestre abre e fecha a porta entre dois broadcasts: "podarFerrolhos" vê a porta aberta e o ferrolho não volta', () => {
    const map = corredor()
    const { s, bruno } = anaTrancou(map)
    // O mapa passou pela porta aberta sem broadcast nenhum no meio (o intervalo do host).
    s.podarFerrolhos(() => corredor({ open: true }))
    const r = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.barDispute).toBeUndefined()
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
  })

  it('"podarFerrolhos" com a porta ainda fechada não mexe no ferrolho', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    s.podarFerrolhos(() => map)
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))?.ferrolhoDoMeuLado).toBe(true)
    expect(s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).barDispute?.barrerName).toBe('Ana')
  })
})

// ---------------------------------------------------------------------------
// O FERROLHO NAS OUTRAS PORTAS DA PORTA: o "Trancada" que Bruno lê oferece
// Bater/Forçar/Usar chave (PORTA TRANCADA VIRA PEDIDO, CHAVE ABRE PORTA). Nenhum
// desses caminhos pode abrir o ferrolho sem o mestre, nem contar a Bruno que
// não foi o mestre quem trancou.

describe('hostSession: ferrolho diante do pedido, da chave e da tela guardada', () => {
  it('Bruno "Bate" na porta do ferrolho: vira a disputa na Caixa; SEGURANÇA: nunca o "abre com um toque", que contaria que não foi o mestre', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const bater = s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how: 'knock' }, map)
    expect(bater.outbound).toEqual([])
    expect(bater.doorRequest).toBeUndefined()
    expect(bater.barDispute?.playerName).toBe('Bruno')
    expect(bater.barDispute?.barrerName).toBe('Ana')
    expect(JSON.stringify(bater.outbound)).not.toContain('not_locked')
    // Insistir com a disputa esperando: "ainda espera o mestre", sem outra linha na Caixa.
    const de_novo = s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how: 'force' }, map)
    expect(de_novo.barDispute).toBeUndefined()
    expect(de_novo.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.request.rejected', wallId: 'porta', reason: 'pending' } }])
  })

  it('Bruno se afasta da porta do ferrolho e toca "Bater": lê "Chegue mais perto", como na porta que o mestre trancou; SEGURANÇA: nunca o "abre com um toque"', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const bruno_longe: MapData = { ...map, tokens: [ficha('ficha-ana', 'Heroina', 450, 250), ficha('ficha-bruno', 'Guarda', 700, 250)] }
    const bater = s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how: 'knock' }, bruno_longe)
    expect(bater.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.request.rejected', wallId: 'porta', reason: 'far' } }])
    expect(bater.barDispute).toBeUndefined()
    expect(bater.doorRequest).toBeUndefined()
    // A porta que o MESTRE trancou, com as fichas nos mesmos lugares: a mesma resposta, palavra por palavra.
    const doMestre: MapData = { ...corredor({ locked: true }), tokens: bruno_longe.tokens }
    const m = mesa(doMestre)
    expect(m.s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how: 'knock' }, doMestre).outbound).toEqual(bater.outbound)
  })

  it('Bruno tenta "Usar chave" na porta do ferrolho: a porta não abre, ele lê "Trancada" e a tentativa vira disputa', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const r = s.handleMessage('c2', { type: 'door.useKey', wallId: 'porta' }, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
    expect(r.barDispute?.barrerName).toBe('Ana')
  })

  it('Ana, do lado dela, usa a chave numa porta com o ferrolho dela: abre e o ferrolho sai', () => {
    const map = corredor()
    const { s, ana } = anaTrancou(map)
    const r = s.handleMessage('c1', { type: 'door.useKey', wallId: 'porta' }, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: ana, playerName: 'Ana' })
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('tela já enviada e mapa parado: correr e tirar o ferrolho manda a tela nova a quem está do lado', () => {
    const map = corredor()
    const { s } = mesa(map)
    // Os dois já têm a tela deste mapa: sem nada mudar, o broadcast seguinte não manda nada.
    transmitir(s, map)
    expect(s.broadcast(map).outbound.filter((o) => o.msg.type === 'snapshot')).toEqual([])
    expect(s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, map).trancaAviso?.acao).toBe('trancou')
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))?.ferrolhoDoMeuLado).toBe(true)
    expect(s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: false }, map).trancaAviso?.acao).toBe('destrancou')
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('SEGURANÇA: a porta do ferrolho que o mestre torna secreta não chega a ninguém, nem com a marca', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    expect(portaNoRecorte(snapshotPara(s, 'c1', map))?.ferrolhoDoMeuLado).toBe(true)
    const secreta = corredor({ secret: true })
    const daAna = snapshotPara(s, 'c1', secreta)
    const doBruno = snapshotPara(s, 'c2', secreta)
    expect(portaNoRecorte(daAna)).toBeFalsy()
    expect(portaNoRecorte(doBruno)).toBeFalsy()
    expect(JSON.stringify(daAna)).not.toContain('ferrolho')
    expect(JSON.stringify(doBruno)).not.toContain('ferrolho')
  })
})

// ---------------------------------------------------------------------------
// O CAMINHO DA TELA: o toque mostra "Trancada", e só então Bruno aperta Bater,
// Forçar ou Usar chave. Cada passo precisa responder o MESMO que responderia
// na porta que o mestre trancou — texto diferente conta a Bruno que não foi o
// mestre quem trancou.

/** Toca a porta e depois pede (Bater/Forçar/Usar chave), como a tela faz: as duas respostas. */
function tocarEPedir(s: HostSession, map: MapData, how: 'knock' | 'force' | 'key') {
  const toque = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)
  const pedido = s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how }, map)
  return { toque, pedido }
}

describe('hostSession: ferrolho pelo caminho da tela (toque, depois Bater)', () => {
  it('Bruno toca, lê "Trancada" e aperta "Bater": o pedido sai ("Pedido enviado"), nunca "ainda espera o mestre", e a Caixa guarda uma linha só', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const { toque, pedido } = tocarEPedir(s, map, 'knock')
    const disputa = toque.barDispute
    if (disputa === undefined) throw new Error('esperava a disputa no toque')
    expect(pedido.outbound).toEqual([])
    expect(pedido.barDispute).toBeUndefined()
    expect(s.isBarDisputePending(disputa.requestId)).toBe(true)
    // O segundo pedido, esse sim, espera o mestre — como na porta do mestre.
    const de_novo = s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how: 'force' }, map)
    expect(de_novo.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.request.rejected', wallId: 'porta', reason: 'pending' } }])
    expect(de_novo.barDispute).toBeUndefined()
  })

  it('SEGURANÇA: toque e depois Bater/Forçar/Usar chave respondem palavra por palavra o que a porta trancada pelo mestre responde', () => {
    for (const how of ['knock', 'force', 'key'] as const) {
      const map = corredor()
      const ferrolho = tocarEPedir(anaTrancou(map).s, map, how)
      const doMestre = corredor({ locked: true })
      const mestre = tocarEPedir(mesa(doMestre).s, doMestre, how)
      expect(ferrolho.toque.outbound).toEqual(mestre.toque.outbound)
      expect(ferrolho.pedido.outbound).toEqual(mestre.pedido.outbound)
      expect(JSON.stringify(ferrolho.pedido.outbound)).not.toContain('pending')
    }
  })

  it('disputa aberta só pelo toque em OUTRA porta não vira "seu pedido anterior": o Bater nesta porta abre a disputa dela', () => {
    // Duas portas na mesma parede: a de cima (200–300) e a de baixo (400–500).
    const duas = (bruno: [number, number], ana: [number, number]): MapData => ({
      ...corredor(),
      walls: [
        parede('norte', 500, 0, 500, 200),
        parede('porta', 500, 200, 500, 300, { open: false, locked: false, kind: 'normal' }),
        parede('meio', 500, 300, 500, 400),
        parede('porta2', 500, 400, 500, 500, { open: false, locked: false, kind: 'normal' }),
      ],
      tokens: [ficha('ficha-ana', 'Heroina', ana[0], ana[1]), ficha('ficha-bruno', 'Guarda', bruno[0], bruno[1])],
    })
    const cima = duas([550, 250], [450, 250])
    const { s } = mesa(cima)
    expect(s.handleMessage('c1', { type: 'door.bar', wallId: 'porta', on: true }, cima).trancaAviso?.acao).toBe('trancou')
    const baixo = duas([550, 450], [450, 450])
    expect(s.handleMessage('c1', { type: 'door.bar', wallId: 'porta2', on: true }, baixo).trancaAviso?.acao).toBe('trancou')
    const toque = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, duas([550, 250], [450, 450]))
    const primeira = toque.barDispute
    if (primeira === undefined) throw new Error('esperava a disputa do toque')
    const bater = s.handleMessage('c2', { type: 'door.request', wallId: 'porta2', how: 'knock' }, baixo)
    expect(bater.outbound).toEqual([])
    expect(bater.barDispute?.barrerName).toBe('Ana')
    expect(s.isBarDisputePending(bater.barDispute?.requestId ?? '')).toBe(true)
    // Uma disputa por jogador: a do toque sai da Caixa.
    expect(s.isBarDisputePending(primeira.requestId)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// A RESPOSTA DO MESTRE volta a quem bateu, como na porta que o mestre trancou:
// "O mestre abriu" no "Arrombar", "O mestre disse não" no "Aguenta".

describe('hostSession: a resposta da disputa chega a quem bateu', () => {
  it('"Aguenta": Bruno lê "O mestre disse não", igual à porta do mestre; SEGURANÇA: sem nome de quem trancou', () => {
    const map = corredor()
    const { s } = anaTrancou(map)
    const disputa = tocarEPedir(s, map, 'knock').toque.barDispute
    if (disputa === undefined) throw new Error('esperava a disputa')
    const r = s.answerBarDispute(disputa.requestId, false, map)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.request.answer', answer: 'denied' } }])
    expect(r.applyDoor).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain('Ana')
    // A porta do mestre, mesmo gesto e mesma recusa: a mesma mensagem.
    const doMestre = corredor({ locked: true })
    const m = mesa(doMestre)
    const pedido = tocarEPedir(m.s, doMestre, 'knock').pedido.doorRequest
    if (pedido === undefined) throw new Error('esperava o pedido')
    expect(m.s.denyDoorRequest(pedido.requestId).outbound).toEqual(r.outbound)
  })

  it('"Arrombar": a porta abre e Bruno lê "O mestre abriu", igual à porta do mestre', () => {
    const map = corredor()
    const { s, bruno } = anaTrancou(map)
    const bater = s.handleMessage('c2', { type: 'door.request', wallId: 'porta', how: 'force' }, map).barDispute
    if (bater === undefined) throw new Error('esperava a disputa')
    const r = s.answerBarDispute(bater.requestId, true, map)
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'door.request.answer', answer: 'opened' } }])
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
  })

  it('só o toque, sem Bater: a resposta não traz aviso (na porta do mestre o toque nunca vira pedido), só a porta muda', () => {
    const map = corredor()
    const { s, bruno } = anaTrancou(map)
    const disputa = s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map).barDispute
    if (disputa === undefined) throw new Error('esperava a disputa')
    const r = s.answerBarDispute(disputa.requestId, true, map)
    expect(r.outbound).toEqual([])
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: bruno, playerName: 'Bruno' })
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
  transmitir(m.s, w)
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
    transmitir(s, w)
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

  it('barra posta DEPOIS do pedido: o "Deixar ir" comum não quebra a barra, o pedido volta à Caixa como disputa dizendo quem barrou', () => {
    // O alçapão pede passagem: o pedido de Bruno sai sem barra, com "Deixar ir" comum.
    const base = mundo()
    const w: HostWorld = { ...base, open: { ...base.open, map: { ...base.open.map, pins: base.open.map.pins.map((p) => ({ ...p, passagem: undefined })) } } }
    const { s } = mesa(w)
    transmitir(s, w)
    const pedido = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).travelRequest
    if (pedido === undefined) throw new Error('esperava o pedido')
    expect(pedido.barradaPor).toBeUndefined()
    // Com o pedido na Caixa, Ana barra o fundo do poço.
    expect(s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: true }, w).trancaAviso?.acao).toBe('trancou')
    const r = s.approveTravel(pedido.requestId, w)
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest?.barradaPor).toBe('Ana')
    expect(r.travelRequest?.playerName).toBe('Bruno')
    // SEGURANÇA: Bruno segue esperando, sem ler barra nem nome.
    expect(r.outbound).toEqual([])
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBe(true)
    // O consentimento velho morreu; o aviso novo é o que vale.
    const novo = r.travelRequest?.requestId ?? ''
    expect(novo).not.toBe(pedido.requestId)
    expect(s.isTravelPending(pedido.requestId)).toBe(false)
    expect(s.isTravelPending(novo)).toBe(true)
    // "Passa (quebra a barra)" sobre o aviso que disse quem barrou: agora sim.
    expect(s.approveTravel(novo, w).applyTransfer?.toSceneId).toBe(CRIPTA)
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBeUndefined()
  })

  it('o aviso disse "barrada por Ana", mas Ana tirou e Carla barrou: o "Passa" não quebra a barra de Carla sem o mestre ler', () => {
    const base = mundo()
    const w: HostWorld = {
      ...base,
      background: base.background.map((c) => ({ ...c, map: { ...c.map, tokens: [...c.map.tokens, ficha('ficha-carla', 'Batedora', 1050, 250)] } })),
    }
    const { s } = anaBarrou(w)
    const carla = welcome(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Carla' }, w))
    s.assignToken(carla, 'ficha-carla')
    transmitir(s, w)
    const pedido = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).travelRequest
    expect(pedido?.barradaPor).toBe('Ana')
    expect(s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: false }, w).trancaAviso?.acao).toBe('destrancou')
    expect(s.handleMessage('c3', { type: 'pin.bar', pinId: 'fundo', on: true }, w).trancaAviso?.playerName).toBe('Carla')
    const r = s.approveTravel(pedido?.requestId ?? '', w)
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest?.barradaPor).toBe('Carla')
    expect(pinoNoRecorte(snapshotPara(s, 'c3', w), 'fundo')?.barradaDaqui).toBe(true)
  })

  it('o aviso disse "barrada por Ana" e a barra de Ana ainda está lá: o "Passa" leva direto, sem reabrir', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const pedido = s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).travelRequest
    if (pedido === undefined) throw new Error('esperava o pedido')
    const r = s.approveTravel(pedido.requestId, w)
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('Ana tira a barra: a marca some e a passagem livre volta a passar direto', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    const r = s.handleMessage('c1', { type: 'pin.bar', pinId: 'fundo', on: false }, w)
    expect(r.trancaAviso?.acao).toBe('destrancou')
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBeUndefined()
    expect(s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w).applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('SEGURANÇA: o mestre esconde o pino barrado; ele some do recorte de Ana e a barra não chega a ninguém', () => {
    const w = mundo()
    const { s } = anaBarrou(w)
    expect(pinoNoRecorte(snapshotPara(s, 'c1', w), 'fundo')?.barradaDaqui).toBe(true)
    const escondido: HostWorld = {
      ...w,
      background: w.background.map((c) => ({ ...c, map: { ...c.map, pins: c.map.pins.map((p) => ({ ...p, hidden: true })) } })),
    }
    const daAna = snapshotPara(s, 'c1', escondido)
    expect(daAna.map.pins).toEqual([])
    expect(JSON.stringify(daAna)).not.toContain('barrada')
    expect(JSON.stringify(snapshotPara(s, 'c2', escondido))).not.toContain('barrada')
  })

  it('longe do pino, ou pino que não é de viagem: nada acontece', () => {
    const w = mundo()
    const longe: HostWorld = {
      ...w,
      background: w.background.map((c) => ({ ...c, map: { ...c.map, tokens: [ficha('ficha-ana', 'Heroina', 300, 250)] } })),
    }
    const m = mesa(longe)
    transmitir(m.s, longe)
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
    transmitir(s, w)
    const r = s.handleMessage('c3', { type: 'pin.bar', pinId: 'fundo', on: true }, w)
    expect(r.trancaAviso?.playerName).toBe('Carla')
    const daCarla = pinoNoRecorte(snapshotPara(s, 'c3', w), 'fundo')
    const daAna = snapshotPara(s, 'c1', w)
    // A mesma marca a quem barrou e a quem não barrou: o recorte não diz quem foi,
    // por isso o cartão fala "Passagem barrada deste lado", nunca "Você barrou".
    expect(daCarla?.barradaDaqui).toBe(true)
    expect(pinoNoRecorte(daAna, 'fundo')).toEqual(daCarla)
    // O nome de Carla chega a Ana só pela MARCA DE COMPANHEIRO da ficha dela
    // (outra feature, que já mostra o colega à vista); na barra, nada o liga a ela.
    expect(JSON.stringify(pinoNoRecorte(daAna, 'fundo'))).not.toContain('Carla')
    expect(JSON.stringify({ ...daAna, map: { ...daAna.map, tokens: [] } })).not.toContain('Carla')
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
