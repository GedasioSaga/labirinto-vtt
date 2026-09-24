/**
 * RETOMAR A MESA COM O MAPA EXPLORADO: a sala reaberta devolve a cada jogador,
 * junto com a ficha, o que ELE já tinha explorado em cada cena e o último
 * estado das portas que ele viu. Aceite: Carla explora o Porão, o mestre fecha;
 * no dia 2, Retomar: Carla abre no Porão todo explorado, com o raio de ontem, e
 * nenhuma sala que não viu.
 *
 * A memória devolvida passa pelo MESMO recorte de sempre: o que o mestre
 * escondeu durante a noite (zona oculta, sala secreta) e a porta que ele mudou
 * longe dela não chegam; a memória de um jogador nunca vai para outro.
 */
import { describe, expect, it } from 'vitest'
import { countExploredCells, decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { SavedSeatExploration } from '../lib/savedTable'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RAIO_DE_ONTEM = 250
const OESTE = { x: 250, y: 250 }
const LESTE = { x: 1250, y: 250 }
/** Centro do Porão leste: explorado ontem, fora da visão de hoje (Carla está no oeste). */
const CENTRO_LESTE = { x: 1250, y: 250 }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, name: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name },
    ...extra,
  }
}

const PORTA_ABERTA: Wall = { id: 'porta-leste', x1: 1050, y1: 200, x2: 1050, y2: 300, blocksLight: true, blocksMove: true, door: { open: true, locked: false, kind: 'normal' } }

interface Noite {
  /** O que o mestre mudou no Porão entre ontem e hoje. */
  extra?: Partial<MapData>
  porta?: Wall
  largura?: number
}

/** O Porão: oeste e leste explorados por Carla ontem; o Sótão, no meio, nunca visto. */
function porao(carla: { x: number; y: number }, diego: { x: number; y: number } | null, noite: Noite = {}): MapData {
  const tokens = [ficha('carla-f', carla.x, carla.y), ...(diego === null ? [] : [ficha('diego-f', diego.x, diego.y)])]
  return {
    ...createEmptyMap('m-porao', 'Porão', noite.largura ?? 30, 10, 50),
    tokens,
    regions: [sala('porao-oeste', 'Porão oeste', 50, 50, 450, 450), sala('porao-leste', 'Porão leste', 1050, 50, 1450, 450), sala('sotao', 'Sótão', 600, 100, 850, 400)],
    walls: [noite.porta ?? PORTA_ABERTA],
    ...noite.extra,
  }
}

function terreo(): MapData {
  return { ...createEmptyMap('m-terreo', 'Térreo', 30, 10, 50), tokens: [ficha('carla-t', 300, 300)], regions: [sala('cozinha-terreo', 'Cozinha', 100, 100, 500, 500)] }
}

function mundo(map: MapData, fundo: MapData[] = []): HostWorld {
  return { open: { sceneId: 's-porao', name: 'Porão', map }, background: fundo.map((m, i) => ({ sceneId: `s-${i}`, name: m.name, map: m })) }
}

/** Dia 1: Carla anda do leste ao oeste do Porão (raio 250) e Diego fica só no oeste. A mesa é gravada. */
function dia1() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000 + n, randomId: () => `d1-${(n += 1)}` })
  const entra = (clientId: string, name: string) => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo(porao(LESTE, OESTE))).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const carla = entra('c1', 'Carla')
  const diego = entra('c2', 'Diego')
  s.assignToken(carla, 'carla-f')
  s.assignToken(diego, 'diego-f')
  s.setVisionRadius(carla, RAIO_DE_ONTEM)
  s.setVisionRadius(diego, RAIO_DE_ONTEM)
  s.broadcast(mundo(porao(LESTE, OESTE)))
  const ultimo = s.broadcast(mundo(porao(OESTE, OESTE)))
  const exploradoDeCarla = snapshotDe(ultimo.outbound, 'c1').explored
  return { seats: s.savedSeats(), exploration: s.savedExploration(), exploradoDeCarla }
}

function snapshotDe(outbound: readonly { clientId: string; msg: HostMessage }[], clientId: string) {
  const msg = outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

/** Dia 2: a sala reabre com a mesa guardada (Retomar). */
function dia2(ontem: ReturnType<typeof dia1>, exploration: readonly SavedSeatExploration[] = ontem.exploration) {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: 700,
    now: () => 5_000 + n,
    randomId: () => `d2-${(n += 1)}`,
    restoreSeats: ontem.seats,
    restoreExploration: exploration,
  })
  const entra = (clientId: string, name: string, w: HostWorld) => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, w)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, result: r }
  }
  return { s, entra }
}

function explorado(wire: unknown) {
  const exp = decodeExploration(wire)
  if (exp === null) throw new Error('explorado inválido')
  return exp
}

describe('hostSession: retomar a mesa com o mapa explorado de cada jogador', () => {
  it('Carla volta no Porão todo explorado, com o raio de ontem, e nenhuma sala que não viu', () => {
    const ontem = dia1()
    const { s, entra } = dia2(ontem)
    const w = mundo(porao(OESTE, OESTE))
    const carla = entra('c1', 'carla', w)
    const snap = snapshotDe(carla.result.outbound, 'c1')
    const regioes = snap.map.regions.map((r) => r.id)
    // O leste está longe da visão de hoje: só chega porque ela o explorou ontem.
    expect(regioes).toContain('porao-leste')
    expect(regioes).toContain('porao-oeste')
    expect(regioes).not.toContain('sotao')
    const exp = explorado(snap.explored)
    expect(isPointExplored(exp, CENTRO_LESTE)).toBe(true)
    // A mesma memória de ontem, nem uma célula a mais.
    expect(countExploredCells(exp)).toBe(countExploredCells(explorado(ontem.exploradoDeCarla)))
    expect(s.listPlayers(w)[0]).toMatchObject({ status: 'playing', visionRadius: RAIO_DE_ONTEM })
  })

  it('sem a exploração guardada (mesa de ontem sem mapa), o leste NÃO chega: é a memória que o traz', () => {
    const ontem = dia1()
    const { entra } = dia2(ontem, [])
    const snap = snapshotDe(entra('c1', 'Carla', mundo(porao(OESTE, OESTE))).result.outbound, 'c1')
    expect(snap.map.regions.map((r) => r.id)).not.toContain('porao-leste')
    expect(isPointExplored(explorado(snap.explored), CENTRO_LESTE)).toBe(false)
  })

  it('a porta lembrada volta como Carla a viu (aberta), não como o mestre a deixou à noite (fechada e trancada)', () => {
    const ontem = dia1()
    const { entra } = dia2(ontem)
    const fechada: Wall = { ...PORTA_ABERTA, door: { open: false, locked: true, kind: 'normal' } }
    const snap = snapshotDe(entra('c1', 'Carla', mundo(porao(OESTE, OESTE, { porta: fechada }))).result.outbound, 'c1')
    const porta = snap.map.walls.find((wall) => wall.id === 'porta-leste')
    expect(porta?.door).toEqual({ open: true, locked: false, kind: 'normal' })
  })

  it('zona oculta posta à noite sobre o leste: a sala escondida NÃO chega e a memória dela é apagada', () => {
    const ontem = dia1()
    const { entra } = dia2(ontem)
    const zona = { id: 'z1', name: 'Segredo', revealed: false, points: sala('z', 'z', 1000, 0, 1500, 500).points }
    const snap = snapshotDe(entra('c1', 'Carla', mundo(porao(OESTE, OESTE, { extra: { concealZones: [zona] } }))).result.outbound, 'c1')
    const texto = JSON.stringify(snap.map)
    expect(texto).not.toContain('porao-leste')
    expect(texto).not.toContain('Porão leste')
    expect(texto).not.toContain('porta-leste')
    expect(isPointExplored(explorado(snap.explored), CENTRO_LESTE)).toBe(false)
    // O que não foi escondido continua lembrado.
    expect(snap.map.regions.map((r) => r.id)).toContain('porao-oeste')
  })

  it('sala marcada secreta à noite: não chega nem fica na memória devolvida', () => {
    const ontem = dia1()
    const { entra } = dia2(ontem)
    const regioesSecretas = porao(OESTE, OESTE).regions.map((r) => (r.id === 'porao-leste' ? { ...r, secret: true } : r))
    const snap = snapshotDe(entra('c1', 'Carla', mundo(porao(OESTE, OESTE, { extra: { regions: regioesSecretas } }))).result.outbound, 'c1')
    expect(JSON.stringify(snap.map)).not.toContain('porao-leste')
    expect(isPointExplored(explorado(snap.explored), CENTRO_LESTE)).toBe(false)
  })

  it('a memória é de quem explorou: Diego volta só com o oeste, e quem chega com nome novo não recebe mapa nenhum', () => {
    const ontem = dia1()
    const { entra } = dia2(ontem)
    const w = mundo(porao(OESTE, OESTE))
    const diego = snapshotDe(entra('c2', 'Diego', w).result.outbound, 'c2')
    expect(diego.map.regions.map((r) => r.id)).not.toContain('porao-leste')
    expect(isPointExplored(explorado(diego.explored), CENTRO_LESTE)).toBe(false)
    const eva = entra('c3', 'Eva', w)
    expect(eva.result.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    expect(JSON.stringify(eva.result.outbound)).not.toContain('explored')
  })

  it('só a memória da cena em que ela está vai no mapa: a do Térreo fica guardada, sem vazar para o Porão', () => {
    const ontem = dia1()
    const doTerreo: SavedSeatExploration[] = ontem.exploration.map((seat) =>
      seat.name === 'Carla' ? { ...seat, scenes: [...seat.scenes, { ...seat.scenes[0], mapId: 'm-terreo' }] } : seat,
    )
    const { s, entra } = dia2(ontem, doTerreo)
    const snap = snapshotDe(entra('c1', 'Carla', mundo(porao(OESTE, OESTE), [terreo()])).result.outbound, 'c1')
    expect(JSON.stringify(snap)).not.toContain('terreo')
    // Mas continua na mesa, para quando ela for ao Térreo.
    expect(s.savedExploration().find((seat) => seat.name === 'Carla')?.scenes.map((scene) => scene.mapId)).toEqual(['m-terreo', 'm-porao'])
  })

  it('mapa redimensionado à noite é outro mapa: a memória velha não se aplica', () => {
    const ontem = dia1()
    const { entra } = dia2(ontem)
    const snap = snapshotDe(entra('c1', 'Carla', mundo(porao(OESTE, OESTE, { largura: 40 }))).result.outbound, 'c1')
    expect(snap.map.regions.map((r) => r.id)).not.toContain('porao-leste')
    expect(isPointExplored(explorado(snap.explored), CENTRO_LESTE)).toBe(false)
  })

  it('exploração adulterada (bitset torto) é ignorada, e a ficha volta mesmo assim', () => {
    const ontem = dia1()
    const torta: SavedSeatExploration[] = ontem.exploration.map((seat) => ({ ...seat, scenes: seat.scenes.map((scene) => ({ ...scene, explored: { ...scene.explored, bits: '!!!' } })) }))
    const { entra } = dia2(ontem, torta)
    const carla = entra('c1', 'Carla', mundo(porao(OESTE, OESTE)))
    expect(carla.result.reclaimed?.tokenIds).toEqual(['carla-f'])
    expect(isPointExplored(explorado(snapshotDe(carla.result.outbound, 'c1').explored), CENTRO_LESTE)).toBe(false)
  })

  it('Desfazer: quem pegou o assento por engano perde a memória de Carla, e a Carla de verdade a reencontra', () => {
    const ontem = dia1()
    const { s, entra } = dia2(ontem)
    const w = mundo(porao(OESTE, OESTE, { extra: { tokens: [ficha('carla-f', OESTE.x, OESTE.y), ficha('outra', OESTE.x, OESTE.y)] } }))
    const falsa = entra('c1', 'carla', w)
    s.undoReclaim(falsa.playerId)
    s.assignToken(falsa.playerId, 'outra')
    const daFalsa = snapshotDe(s.broadcast(w).outbound, 'c1')
    expect(daFalsa.map.regions.map((r) => r.id)).not.toContain('porao-leste')
    expect(isPointExplored(explorado(daFalsa.explored), CENTRO_LESTE)).toBe(false)
    const verdadeira = entra('c2', 'Carla', w)
    const daVerdadeira = snapshotDe(verdadeira.result.outbound, 'c2')
    expect(daVerdadeira.map.regions.map((r) => r.id)).toContain('porao-leste')
  })

  it('savedExploration: quem ainda não voltou continua com a memória guardada; quem voltou grava a de agora', () => {
    const ontem = dia1()
    const { s, entra } = dia2(ontem)
    // Antes de qualquer um voltar: a mesa inteira de ontem.
    expect(s.savedExploration().map((seat) => seat.name).sort()).toEqual(['Carla', 'Diego'])
    const w = mundo(porao(OESTE, OESTE))
    entra('c2', 'Diego', w)
    const gravada = s.savedExploration()
    // Carla não voltou: a memória dela segue igual à de ontem.
    expect(gravada.find((seat) => seat.name === 'Carla')).toEqual(ontem.exploration.find((seat) => seat.name === 'Carla'))
    expect(gravada.find((seat) => seat.name === 'Diego')?.scenes.map((scene) => scene.mapId)).toEqual(['m-porao'])
  })

  it('sem mesa guardada, nada de exploração a gravar antes de alguém jogar', () => {
    const s = createHostSession({ code: CODE, visionRadius: 700 })
    expect(s.savedExploration()).toEqual([])
  })
})
