/**
 * MAPA DE PAPEL — o mestre escolhe Salas de qualquer cena e grava só na
 * memória de UM jogador, como um mapa achado. O que chega pela rede passa pelo
 * mesmo recorte de sempre: quem recebe passa a conhecer aquelas Salas; quem
 * não recebeu continua sem conhecer; Sala secreta, oculta, com teto ou dentro
 * de zona oculta ativa nunca entra; e o mapa de OUTRA cena não entrega o nome,
 * o id nem a planta dela enquanto o jogador não estiver lá.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import type { ConcealZone, MapData, Region, Token } from '../types/map'
import type { HostMessage } from './protocol'
import { createHostSession, MAX_SCENE_MEMORIES_PER_PLAYER, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'PAPEL1'
/** Visão curta: cada um conhece só a vizinhança da própria ficha. */
const RAIO = 150

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, nome: string, x1: number, x2: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x1, y: 100 },
      { x: x2, y: 100 },
      { x: x2, y: 400 },
      { x: x1, y: 400 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

const centro = (x1: number, x2: number) => ({ x: (x1 + x2) / 2, y: 250 })
const BIBLIOTECA = centro(1000, 1300)
const COZINHA = centro(1500, 1800)
const SECRETA = centro(1300, 1450)
const ESCONDIDA = centro(1850, 1950)

function zonaSobreACozinha(): ConcealZone {
  return {
    id: 'z-cozinha',
    name: 'Fumaça',
    revealed: false,
    points: [
      { x: 1480, y: 80 },
      { x: 1820, y: 80 },
      { x: 1820, y: 420 },
      { x: 1480, y: 420 },
    ],
  }
}

/** Salão Nobre (aberto): Ana no canto esquerdo, Bruno perto dela; as Salas ficam longe dos dois. */
function salao(opts: { zona?: boolean; anaNoSalao?: boolean } = {}): HostScene {
  const { zona = false, anaNoSalao = true } = opts
  const base = createEmptyMap('m-salao', 'Salao Nobre', 40, 10, 50)
  const map: MapData = {
    ...base,
    tokens: [...(anaNoSalao ? [ficha('ana', 100, 250)] : []), ficha('bruno', 300, 250)],
    regions: [
      sala('r-bib', 'Biblioteca', 1000, 1300),
      sala('r-cozinha', 'Cozinha', 1500, 1800),
      sala('r-secreta', 'Passagem Secreta', 1300, 1450, { secret: true }),
      sala('r-escondida', 'Despensa do Mestre', 1850, 1950, { hidden: true }),
    ],
    concealZones: zona ? [zonaSobreACozinha()] : [],
  }
  return { sceneId: 's-salao', name: 'Salao Nobre', map }
}

/** Cripta Funda (fundo): o Pombal e a Torre do Sino ficam lá. */
function cripta(anaNaCripta = false): HostScene {
  const base = createEmptyMap('m-cripta', 'Cripta Funda', 40, 10, 50)
  const map: MapData = {
    ...base,
    tokens: anaNaCripta ? [ficha('ana', 100, 250)] : [],
    regions: [sala('r-pombal', 'Pombal', 1000, 1300), sala('r-sino', 'Torre do Sino', 1500, 1800, { room: { shape: 'rect', name: 'Torre do Sino', roof: true } })],
  }
  return { sceneId: 's-cripta', name: 'Cripta Funda', map }
}

function mundo(opts: { zona?: boolean } = {}): HostWorld {
  return { open: salao(opts), background: [cripta()] }
}

type Sessao = ReturnType<typeof createHostSession>

function entra(s: Sessao, clientId: string, name: string, world: HostWorld): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(opts: { zona?: boolean } = {}) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const world = mundo(opts)
  const ana = entra(s, 'c-ana', 'Ana', world)
  const bruno = entra(s, 'c-bruno', 'Bruno', world)
  s.assignToken(ana, 'ana')
  s.assignToken(bruno, 'bruno')
  s.broadcast(world)
  return { s, world, ana, bruno }
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

describe('Mapa de papel — o mestre dá Salas a um jogador', () => {
  it('Ana passa a conhecer a Biblioteca, longe da visão dela; Bruno, na mesma cena, não; a Cozinha, que não estava no mapa, também não', () => {
    const { s, world, ana } = mesa()
    const antes = s.broadcast(world)
    expect(isPointExplored(exploradoDe(antes, 'c-ana'), BIBLIOTECA)).toBe(false)

    const r = s.giveRoomsMap(ana, 's-salao', ['r-bib'], world)
    expect(r.mapGiven).toEqual({ playerId: ana, roomIds: ['r-bib'] })
    // Só a Ana é avisada, e o aviso não diz cena, sala nem posição.
    expect(msgsPara(r, 'c-ana')).toEqual([{ type: 'map.given' }])
    expect(msgsPara(r, 'c-bruno')).toEqual([])

    const depois = s.broadcast(world)
    expect(isPointExplored(exploradoDe(depois, 'c-ana'), BIBLIOTECA)).toBe(true)
    expect(isPointExplored(exploradoDe(depois, 'c-ana'), COZINHA)).toBe(false)
    expect(isPointExplored(exploradoDe(depois, 'c-bruno'), BIBLIOTECA)).toBe(false)
    // A Sala chega no recorte dela, com o nome — é a planta do mapa achado.
    const bib = snapshotDe(depois, 'c-ana').map.regions.find((reg) => reg.id === 'r-bib')
    expect(bib?.room?.name).toBe('Biblioteca')
    expect(snapshotDe(depois, 'c-ana').map.regions.find((reg) => reg.id === 'r-cozinha')).toBeUndefined()
    expect(snapshotDe(depois, 'c-bruno').map.regions.find((reg) => reg.id === 'r-bib')).toBeUndefined()
  })

  it('Sala secreta e Sala oculta pedidas junto NÃO entram nem chegam; só a permitida vale', () => {
    const { s, world, ana } = mesa()
    const r = s.giveRoomsMap(ana, 's-salao', ['r-secreta', 'r-escondida', 'r-bib'], world)
    expect(r.mapGiven).toEqual({ playerId: ana, roomIds: ['r-bib'] })
    const depois = s.broadcast(world)
    const exp = exploradoDe(depois, 'c-ana')
    expect(isPointExplored(exp, BIBLIOTECA)).toBe(true)
    expect(isPointExplored(exp, SECRETA)).toBe(false)
    expect(isPointExplored(exp, ESCONDIDA)).toBe(false)
    const json = JSON.stringify(msgsPara(depois, 'c-ana'))
    for (const vazamento of ['Passagem Secreta', 'r-secreta', 'Despensa do Mestre', 'r-escondida']) expect(json).not.toContain(vazamento)
  })

  it('só Salas proibidas: nada muda, nada é avisado', () => {
    const { s, world, ana } = mesa()
    const r = s.giveRoomsMap(ana, 's-salao', ['r-secreta', 'r-escondida'], world)
    expect(r).toEqual({ outbound: [] })
    expect(r.mapGiven).toBeUndefined()
  })

  it('zona oculta ativa sobre a Cozinha: o mapa não entrega o que a zona esconde', () => {
    const { s, ana } = mesa({ zona: true })
    const escondido = mundo({ zona: true })
    const r = s.giveRoomsMap(ana, 's-salao', ['r-cozinha', 'r-bib'], escondido)
    // A contagem é do que ENTROU: a Cozinha, toda sob a fumaça, não conta.
    expect(r.mapGiven).toEqual({ playerId: ana, roomIds: ['r-bib'] })
    const depois = s.broadcast(escondido)
    expect(isPointExplored(exploradoDe(depois, 'c-ana'), COZINHA)).toBe(false)
    expect(isPointExplored(exploradoDe(depois, 'c-ana'), BIBLIOTECA)).toBe(true)
    expect(snapshotDe(depois, 'c-ana').map.regions.find((reg) => reg.id === 'r-cozinha')).toBeUndefined()
  })

  it('só a Cozinha, toda sob zona oculta ativa: nada entra, a Ana não é avisada de um mapa vazio', () => {
    const { s, ana } = mesa({ zona: true })
    const escondido = mundo({ zona: true })
    const r = s.giveRoomsMap(ana, 's-salao', ['r-cozinha'], escondido)
    expect(r).toEqual({ outbound: [] })
    expect(r.mapGiven).toBeUndefined()
    expect(isPointExplored(exploradoDe(s.broadcast(escondido), 'c-ana'), COZINHA)).toBe(false)
  })

  it('mapa de OUTRA cena: nada da Cripta chega enquanto a Ana está no Salão; ao chegar lá, o Pombal já é dela', () => {
    const { s, world, ana } = mesa()
    const r = s.giveRoomsMap(ana, 's-cripta', ['r-pombal'], world)
    expect(r.mapGiven).toEqual({ playerId: ana, roomIds: ['r-pombal'] })
    expect(msgsPara(r, 'c-ana')).toEqual([{ type: 'map.given' }])
    const noSalao = s.broadcast(world)
    const json = JSON.stringify([...r.outbound, ...noSalao.outbound])
    for (const vazamento of ['Cripta', 's-cripta', 'm-cripta', 'Pombal', 'r-pombal']) expect(json).not.toContain(vazamento)
    expect(snapshotDe(noSalao, 'c-ana').map.id).toBe('m-salao')

    // A Ana viaja para a Cripta: o Pombal, longe da ficha dela, já está no mapa.
    const naCripta: HostWorld = { open: salao({ anaNoSalao: false }), background: [cripta(true)] }
    const chegada = s.broadcast(naCripta)
    expect(snapshotDe(chegada, 'c-ana').map.id).toBe('m-cripta')
    expect(isPointExplored(exploradoDe(chegada, 'c-ana'), centro(1000, 1300))).toBe(true)
    expect(snapshotDe(chegada, 'c-ana').map.regions.find((reg) => reg.id === 'r-pombal')?.room?.name).toBe('Pombal')
  })

  it('Sala com teto de construção não entra pelo mapa (o interior é segredo do teto)', () => {
    const { s, world, ana } = mesa()
    const r = s.giveRoomsMap(ana, 's-cripta', ['r-sino'], world)
    expect(r).toEqual({ outbound: [] })
    const naCripta: HostWorld = { open: salao({ anaNoSalao: false }), background: [cripta(true)] }
    const chegada = s.broadcast(naCripta)
    expect(isPointExplored(exploradoDe(chegada, 'c-ana'), centro(1500, 1800))).toBe(false)
  })

  it('pedido sem sentido não faz nada: jogador, cena ou Sala que não existem, lista vazia', () => {
    const { s, world, ana } = mesa()
    expect(s.giveRoomsMap('fantasma', 's-salao', ['r-bib'], world)).toEqual({ outbound: [] })
    expect(s.giveRoomsMap(ana, 's-nenhuma', ['r-bib'], world)).toEqual({ outbound: [] })
    expect(s.giveRoomsMap(ana, 's-salao', ['r-inventada'], world)).toEqual({ outbound: [] })
    expect(s.giveRoomsMap(ana, 's-salao', [], world)).toEqual({ outbound: [] })
    const depois = s.broadcast(world)
    expect(isPointExplored(exploradoDe(depois, 'c-ana'), BIBLIOTECA)).toBe(false)
  })

  it('mapa solto (sem aventura): a cena é a aberta, pedida como null', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const map = salao().map
    const r0 = s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, map).outbound[0]?.msg
    if (r0?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(r0.playerId, 'ana')
    const r = s.giveRoomsMap(r0.playerId, null, ['r-bib'], map)
    expect(r.mapGiven).toEqual({ playerId: r0.playerId, roomIds: ['r-bib'] })
    expect(isPointExplored(exploradoDe(s.broadcast(map), 'c-ana'), BIBLIOTECA)).toBe(true)
  })
})

/** Cena `c-<i>` com a Biblioteca longe da ficha; a Ana só está nela quando `comAna`. */
function cenaNumerada(i: number, comAna: boolean): HostScene {
  const base = createEmptyMap(`m-${i}`, `Cena ${i}`, 40, 10, 50)
  const map: MapData = { ...base, tokens: comAna ? [ficha('ana', 100, 250)] : [], regions: [sala('r-bib', 'Biblioteca', 1000, 1300)] }
  return { sceneId: `c-${i}`, name: `Cena ${i}`, map }
}

/** Mundo de `total` cenas numeradas, com a Ana na cena `onde`. */
function mundoNumerado(total: number, onde: number): HostWorld {
  const cenas = Array.from({ length: total }, (_, i) => cenaNumerada(i, i === onde))
  const [open, ...background] = cenas
  if (open === undefined) throw new Error('mundo sem cena')
  return { open, background }
}

describe('Mapa de papel — o teto de memórias por jogador', () => {
  const TOTAL = MAX_SCENE_MEMORIES_PER_PLAYER + 2

  /** Ana entra na cena 0, ganha a Biblioteca dela e depois passa, em ordem, pelas cenas 1..`ate`. */
  function anaViajada(ate: number) {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const inicio = mundoNumerado(TOTAL, 0)
    const ana = entra(s, 'c-ana', 'Ana', inicio)
    s.assignToken(ana, 'ana')
    s.broadcast(inicio)
    expect(s.giveRoomsMap(ana, 'c-0', ['r-bib'], inicio).mapGiven).toEqual({ playerId: ana, roomIds: ['r-bib'] })
    for (let i = 1; i <= ate; i += 1) s.broadcast(mundoNumerado(TOTAL, i))
    return { s, ana }
  }

  /** A Biblioteca da cena 0 ainda está na memória da Ana quando ela volta lá. */
  function lembraDaCena0(s: ReturnType<typeof anaViajada>['s']): boolean {
    return isPointExplored(exploradoDe(s.broadcast(mundoNumerado(TOTAL, 0)), 'c-ana'), BIBLIOTECA)
  }

  it('memória cheia: o mapa de uma cena nova não apaga a mais antiga que ela explorou; o mestre fica sabendo', () => {
    // Cenas 0..7 exploradas: a memória está no teto.
    const { s, ana } = anaViajada(MAX_SCENE_MEMORIES_PER_PLAYER - 1)
    const naUltima = mundoNumerado(TOTAL, MAX_SCENE_MEMORIES_PER_PLAYER - 1)
    const r = s.giveRoomsMap(ana, `c-${TOTAL - 1}`, ['r-bib'], naUltima)
    expect(r.mapGiven).toBeUndefined()
    expect(r.mapRefused).toEqual({ playerId: ana, reason: 'memoria-cheia' })
    expect(msgsPara(r, 'c-ana')).toEqual([])
    expect(lembraDaCena0(s)).toBe(true)
  })

  it('o mapa de uma cena nova não vira a cena mais recente: é ele, e não a cena 0, que sai primeiro do teto', () => {
    // Cenas 0..6 exploradas (7 memórias); o mapa da última cena ocupa a 8ª vaga.
    const { s, ana } = anaViajada(MAX_SCENE_MEMORIES_PER_PLAYER - 2)
    const aqui = mundoNumerado(TOTAL, MAX_SCENE_MEMORIES_PER_PLAYER - 2)
    expect(s.giveRoomsMap(ana, `c-${TOTAL - 1}`, ['r-bib'], aqui).mapGiven).toEqual({ playerId: ana, roomIds: ['r-bib'] })
    // Andar mais uma cena passa do teto: sai a memória menos usada, que é o mapa nunca visitado.
    s.broadcast(mundoNumerado(TOTAL, MAX_SCENE_MEMORIES_PER_PLAYER - 1))
    expect(lembraDaCena0(s)).toBe(true)
  })

  it('dar mais Salas de uma cena que ela já tem na memória vale mesmo com o teto cheio', () => {
    const { s, ana } = anaViajada(MAX_SCENE_MEMORIES_PER_PLAYER - 1)
    const r = s.giveRoomsMap(ana, 'c-3', ['r-bib'], mundoNumerado(TOTAL, MAX_SCENE_MEMORIES_PER_PLAYER - 1))
    expect(r.mapGiven).toEqual({ playerId: ana, roomIds: ['r-bib'] })
    expect(r.mapRefused).toBeUndefined()
    expect(lembraDaCena0(s)).toBe(true)
  })
})
