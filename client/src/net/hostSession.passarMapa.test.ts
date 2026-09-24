/**
 * PASSAR O MAPA A UM COLEGA — o que a Ana explorou numa cena passa para a
 * memória do Bruno, e SÓ dele: a Carla, na mesma cena, continua sem conhecer.
 * Dois caminhos: o mestre pelo painel ("Passar o mapa de Ana a…") e a própria
 * Ana, pelo painel dela ("Mostrar meu mapa a…"), só a quem está na cena com
 * ela. O que passa respeita o recorte: zona oculta ativa não vai, porta vai
 * com o estado que a Ana VIU (nunca o atual), e quem está em outra cena nunca
 * aparece nem pelo nome.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import type { ConcealZone, MapData, Token, Wall } from '../types/map'
import type { HostMessage } from './protocol'
import { createHostSession, MAP_SHARE_MIN_INTERVAL_MS, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const AGORA = new Date(2026, 8, 24, 20, 0).getTime()
/** Visão curta: cada um conhece só a vizinhança da própria ficha. */
const RAIO = 150
/** Onde a Ana está no Salão: é o trecho que ela tem e os outros não. */
const CANTO_DA_ANA = { x: 100, y: 250 }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function portaEm(x: number, aberta: boolean): Wall {
  return { id: 'porta-1', x1: x, y1: 200, x2: x, y2: 300, blocksLight: true, blocksMove: true, door: { open: aberta, locked: false, kind: 'normal' } }
}

function zonaSobreAna(): ConcealZone {
  return {
    id: 'z-canto',
    name: 'Canto escuro',
    revealed: false,
    points: [
      { x: 40, y: 190 },
      { x: 160, y: 190 },
      { x: 160, y: 310 },
      { x: 40, y: 310 },
    ],
  }
}

interface SalaoOpts {
  anaX?: number
  portaAberta?: boolean
  zona?: boolean
}

/** Salão Nobre (aberto): Ana no canto esquerdo, Carla no meio, Bruno no canto direito. */
function salao({ anaX = CANTO_DA_ANA.x, portaAberta = false, zona = false }: SalaoOpts = {}): HostScene {
  const base = createEmptyMap('m-salao', 'Salao Nobre', 40, 10, 50)
  const map: MapData = {
    ...base,
    tokens: [ficha('ana', anaX, CANTO_DA_ANA.y), ficha('carla', 1000, 250), ficha('bruno', 1900, 250)],
    walls: [portaEm(200, portaAberta)],
    concealZones: zona ? [zonaSobreAna()] : [],
  }
  return { sceneId: 's-salao', name: 'Salao Nobre', map }
}

/** Cripta Funda (fundo): Davi, sozinho. */
function cripta(): HostScene {
  const base = createEmptyMap('m-cripta', 'Cripta Funda', 40, 10, 50)
  return { sceneId: 's-cripta', name: 'Cripta Funda', map: { ...base, tokens: [ficha('davi', 100, 250)] } }
}

function mundo(opts: SalaoOpts = {}): HostWorld {
  return { open: salao(opts), background: [cripta()] }
}

type Sessao = ReturnType<typeof createHostSession>

function entra(s: Sessao, clientId: string, name: string, world: HostWorld): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa() {
  let agora = AGORA
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const world = mundo()
  const ana = entra(s, 'c-ana', 'Ana', world)
  const bruno = entra(s, 'c-bruno', 'Bruno', world)
  const carla = entra(s, 'c-carla', 'Carla', world)
  const davi = entra(s, 'c-davi', 'Davi', world)
  const eva = entra(s, 'c-eva', 'Eva', world) // sem ficha: aguardando
  s.assignToken(ana, 'ana')
  s.assignToken(bruno, 'bruno')
  s.assignToken(carla, 'carla')
  s.assignToken(davi, 'davi')
  // Primeiro snapshot: cada um marca o que vê da própria ficha.
  s.broadcast(world)
  const avanca = (ms: number) => {
    agora += ms
  }
  return { s, world, ana, bruno, carla, davi, eva, avanca }
}

function msgsPara(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = msgsPara(r, clientId).find((m) => m.type === 'snapshot')
  if (snap?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return snap
}

function exploradoDe(r: HostResult, clientId: string): Exploration {
  const exp = decodeExploration(snapshotDe(r, clientId).explored)
  if (exp === null) throw new Error('explorado ilegível')
  return exp
}

describe('Passar o mapa — pelo mestre', () => {
  it('Bruno passa a conhecer o canto da Ana; a Carla, na mesma cena, continua sem conhecer', () => {
    const { s, world, ana, bruno } = mesa()
    const antes = s.broadcast(world)
    expect(isPointExplored(exploradoDe(antes, 'c-bruno'), CANTO_DA_ANA)).toBe(false)

    const r = s.shareMap(ana, bruno, world)
    expect(r.mapShared).toEqual({ fromPlayerId: ana, toPlayerId: bruno })
    // Só o Bruno é avisado, e o aviso diz quem passou — nada de cena nem de posição.
    expect(msgsPara(r, 'c-bruno')).toEqual([{ type: 'map.shared', from: 'Ana' }])
    expect(msgsPara(r, 'c-carla')).toEqual([])
    expect(msgsPara(r, 'c-ana')).toEqual([])
    expect(msgsPara(r, 'c-davi')).toEqual([])

    const depois = s.broadcast(world)
    expect(isPointExplored(exploradoDe(depois, 'c-bruno'), CANTO_DA_ANA)).toBe(true)
    expect(isPointExplored(exploradoDe(depois, 'c-carla'), CANTO_DA_ANA)).toBe(false)
    // O Bruno não perdeu o canto dele.
    expect(isPointExplored(exploradoDe(depois, 'c-bruno'), { x: 1900, y: 250 })).toBe(true)
    // E a Ana não ganhou o do Bruno: passar é de mão única.
    expect(isPointExplored(exploradoDe(depois, 'c-ana'), { x: 1900, y: 250 })).toBe(false)
  })

  it('porta vem com o estado que a Ana VIU, nunca com o atual', () => {
    const { s, ana, bruno } = mesa()
    // A Ana viu a porta fechada e se afastou; depois o mestre a abriu, longe dos olhos dela.
    const longe = mundo({ anaX: 600 })
    s.broadcast(longe)
    const aberta = mundo({ anaX: 600, portaAberta: true })
    s.shareMap(ana, bruno, aberta)
    const r = s.broadcast(aberta)
    const porta = snapshotDe(r, 'c-bruno').map.walls.find((w) => w.id === 'porta-1')
    expect(porta?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    // A Carla não conhece a porta: não está na visão dela nem no explorado.
    expect(snapshotDe(r, 'c-carla').map.walls.find((w) => w.id === 'porta-1')).toBeUndefined()
  })

  it('zona oculta ativa: o que a Ana viu antes de o mestre esconder NÃO passa ao Bruno', () => {
    const { s, ana, bruno } = mesa()
    const escondido = mundo({ zona: true })
    s.shareMap(ana, bruno, escondido)
    const r = s.broadcast(escondido)
    expect(isPointExplored(exploradoDe(r, 'c-bruno'), CANTO_DA_ANA)).toBe(false)
    // Fora da zona, o que a Ana conhecia passa normalmente.
    expect(isPointExplored(exploradoDe(r, 'c-bruno'), { x: 180, y: 160 })).toBe(true)
  })

  it('Davi, em outra cena, recebe só o aviso: nem nome, nem id, nem planta do Salão chegam agora', () => {
    const { s, world, ana, davi } = mesa()
    const r = s.shareMap(ana, davi, world)
    expect(msgsPara(r, 'c-davi')).toEqual([{ type: 'map.shared', from: 'Ana' }])
    const b = s.broadcast(world)
    const json = JSON.stringify(msgsPara(b, 'c-davi')) + JSON.stringify(msgsPara(r, 'c-davi'))
    for (const vazamento of ['Salao', 's-salao', 'm-salao', 'porta-1', 'ficha-ana']) expect(json).not.toContain(vazamento)
    // Ele continua recebendo a Cripta, onde a ficha dele está.
    expect(snapshotDe(b, 'c-davi').map.id).toBe('m-cripta')
  })

  it('pedido sem sentido não faz nada: para si mesmo, jogador desconhecido, doador sem cena', () => {
    const { s, world, ana, bruno, eva } = mesa()
    expect(s.shareMap(ana, ana, world)).toEqual({ outbound: [] })
    expect(s.shareMap(ana, 'fantasma', world)).toEqual({ outbound: [] })
    expect(s.shareMap('fantasma', bruno, world)).toEqual({ outbound: [] })
    // Eva aguarda sem ficha: não tem mapa de cena nenhuma para passar.
    expect(s.shareMap(eva, bruno, world)).toEqual({ outbound: [] })
    const r = s.broadcast(world)
    expect(isPointExplored(exploradoDe(r, 'c-ana'), { x: 1900, y: 250 })).toBe(false)
  })
})

describe('Passar o mapa — pela Ana ("Mostrar meu mapa a…")', () => {
  it('Ana mostra ao Bruno, na mesma cena: ele recebe o aviso e passa a conhecer; a Carla não', () => {
    const { s, world, ana, bruno } = mesa()
    const r = s.handleMessage('c-ana', { type: 'map.share', to: 'Bruno' }, world)
    expect(msgsPara(r, 'c-ana')).toEqual([{ type: 'map.share.result', to: 'Bruno', ok: true }])
    expect(msgsPara(r, 'c-bruno')).toEqual([{ type: 'map.shared', from: 'Ana' }])
    expect(msgsPara(r, 'c-carla')).toEqual([])
    expect(r.mapShared).toEqual({ fromPlayerId: ana, toPlayerId: bruno })

    const depois = s.broadcast(world)
    expect(isPointExplored(exploradoDe(depois, 'c-bruno'), CANTO_DA_ANA)).toBe(true)
    expect(isPointExplored(exploradoDe(depois, 'c-carla'), CANTO_DA_ANA)).toBe(false)
  })

  it('Davi está em outra cena: recusa sem motivo, e nada chega a ele', () => {
    const { s, world } = mesa()
    const r = s.handleMessage('c-ana', { type: 'map.share', to: 'Davi' }, world)
    expect(r.outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'map.share.result', to: 'Davi', ok: false } }])
    expect(r.mapShared).toBeUndefined()
    const b = s.broadcast(world)
    expect(isPointExplored(exploradoDe(b, 'c-ana'), CANTO_DA_ANA)).toBe(true)
    expect(JSON.stringify(msgsPara(b, 'c-davi'))).not.toContain('Salao')
  })

  it('nome que não está na sala, ou quem aguarda sem ficha, recebe a mesma recusa', () => {
    const { s, world } = mesa()
    expect(s.handleMessage('c-ana', { type: 'map.share', to: 'Ninguem' }, world).outbound).toEqual([
      { clientId: 'c-ana', msg: { type: 'map.share.result', to: 'Ninguem', ok: false } },
    ])
    expect(s.handleMessage('c-eva', { type: 'map.share', to: 'Ana' }, world).outbound).toEqual([
      { clientId: 'c-eva', msg: { type: 'map.share.result', to: 'Ana', ok: false } },
    ])
  })

  it('um mapa mostrado por vez: insistir antes do intervalo volta too_soon, depois dele vale', () => {
    const { s, world, avanca } = mesa()
    expect(msgsPara(s.handleMessage('c-ana', { type: 'map.share', to: 'Bruno' }, world), 'c-ana')).toEqual([{ type: 'map.share.result', to: 'Bruno', ok: true }])
    const cedo = s.handleMessage('c-ana', { type: 'map.share', to: 'Carla' }, world)
    expect(cedo.outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'map.share.result', to: 'Carla', ok: false, reason: 'too_soon' } }])
    expect(cedo.mapShared).toBeUndefined()
    avanca(MAP_SHARE_MIN_INTERVAL_MS)
    expect(msgsPara(s.handleMessage('c-ana', { type: 'map.share', to: 'Carla' }, world), 'c-carla')).toEqual([{ type: 'map.shared', from: 'Ana' }])
  })

  it('quem não entrou na sala recebe not_joined', () => {
    const { s, world } = mesa()
    expect(s.handleMessage('c-estranho', { type: 'map.share', to: 'Ana' }, world).outbound).toEqual([
      { clientId: 'c-estranho', msg: { type: 'error', reason: 'not_joined' } },
    ])
  })
})
