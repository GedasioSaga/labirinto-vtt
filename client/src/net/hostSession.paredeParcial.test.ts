import { beforeEach, describe, expect, it } from 'vitest'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft, buildWallFromDraft } from '../lib/drawingFactory'
import { useMapStore } from '../stores/mapStore'
import type { ConcealZone, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PAREDE PARCIAL, pela rede. O mestre apaga o lado oeste de uma Sala e
 * desenha (pela loja, como a ferramenta Parede faz) só um trecho dele: do
 * canto de cima até y=192. Gabi está do lado de fora, a oeste.
 *
 * O trecho é dado que já existia (uma parede a mais); o que se cobra aqui é
 * que ele chegue ao jogador como as outras paredes da Sala chegam, nem mais
 * nem menos:
 *  - Sala comum: o trecho chega sem campo nenhum além dos que o mestre tem,
 *    e o host barra a ficha só no trecho, também depois que a Sala é arrastada;
 *  - Sala secreta: o traço fica solto e chega como parede comum, onde o host
 *    barra (sem parede invisível), e nada de dentro vem junto;
 *  - Sala sob zona oculta: o trecho e o que está dentro ficam no escuro.
 */
const CODE = 'TRE001'
const GRADE = 64
const QUARTO = { de: { x: 320, y: 64 }, ate: { x: 832, y: 384 } }
const TRECHO = { de: { x: 320, y: 64 }, ate: { x: 320, y: 192 } }
const GABI_DIANTE_DO_TRECHO = { x: 128, y: 128 }
const GABI_DIANTE_DO_VAO = { x: 128, y: 320 }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

/** Uma Sala de x 320..832, sem o lado oeste, com Gabi e `dentro` no mapa. */
function salaSemLadoOeste(nome: string, extra: Partial<Region>, gabi: { x: number; y: number }, dentro: Token[]): MapData {
  const sala = buildRoomFromDraft('r-sala', ['s0', 's1', 's2', 's3'], QUARTO.de, QUARTO.ate, undefined, undefined, nome)
  const map = addRoom(createEmptyMap('map_trecho', 'Casarão', 40, 20, GRADE), { ...sala.region, ...extra }, sala.walls)
  return { ...map, walls: map.walls.filter((w) => w.id !== 's3'), tokens: [ficha('gabi', 'Gabi', gabi.x, gabi.y), ...dentro] }
}

/** O mestre desenha o trecho com a ferramenta Parede; devolve o mapa dele. */
function mestreDesenhaOTrecho(map: MapData): MapData {
  useMapStore.setState({ map, selection: [], past: [], future: [], pisoAtivo: 0 })
  useMapStore.getState().addWall(buildWallFromDraft('trecho', TRECHO.de, TRECHO.ate))
  return useMapStore.getState().map
}

function gabiNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Gabi' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'gabi')
  return s
}

function snapshotDe(s: ReturnType<typeof gabiNaMesa>, map: MapData): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = s.broadcast(map).outbound.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Gabi')
  return snap
}

function andar(s: ReturnType<typeof gabiNaMesa>, map: MapData, reqId: string, para: { x: number; y: number }) {
  return s.handleMessage('c1', { type: 'token.move', reqId, tokenId: 'gabi', x: para.x, y: para.y }, map)
}

function barrada(r: ReturnType<typeof andar>, reqId: string) {
  expect(r.applyMove).toBeUndefined()
  expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId, reason: 'wall' } }])
}

function aceita(r: ReturnType<typeof andar>, reqId: string) {
  expect(r.outbound.some((m) => m.msg.type === 'token.move.accepted' && m.msg.reqId === reqId)).toBe(true)
}

/** Alguma parede recebida corre sobre a reta x=`x`? */
function paredeNaReta(walls: readonly Wall[], x: number): boolean {
  return walls.some((w) => Math.abs(w.x1 - x) < 0.5 && Math.abs(w.x2 - x) < 0.5)
}

describe('hostSession: o mestre desenha só um trecho de parede num lado da Sala', () => {
  beforeEach(() => {
    useMapStore.setState({ pisoAtivo: 0 })
  })

  it('Sala comum: o trecho chega ao jogador com os mesmos campos que o mestre tem, nada a mais', () => {
    const map = mestreDesenhaOTrecho(salaSemLadoOeste('Quarto', {}, GABI_DIANTE_DO_TRECHO, []))
    const doMestre = map.walls.find((w) => w.id === 'trecho')
    const recebido = snapshotDe(gabiNaMesa(map), map).map.walls.find((w) => w.id === 'trecho')
    expect(doMestre?.regionId).toBe('r-sala')
    expect(recebido).toEqual(doMestre)
  })

  it('Sala comum: o host barra a ficha no trecho e deixa passar pela parte aberta do lado', () => {
    const noTrecho = mestreDesenhaOTrecho(salaSemLadoOeste('Quarto', {}, GABI_DIANTE_DO_TRECHO, []))
    barrada(andar(gabiNaMesa(noTrecho), noTrecho, 'm1', { x: 576, y: 128 }), 'm1')
    const noVao = mestreDesenhaOTrecho(salaSemLadoOeste('Quarto', {}, GABI_DIANTE_DO_VAO, []))
    aceita(andar(gabiNaMesa(noVao), noVao, 'm2', { x: 576, y: 320 }), 'm2')
  })

  it('Sala comum arrastada: o host barra no trecho onde ele foi parar, não onde estava', () => {
    mestreDesenhaOTrecho(salaSemLadoOeste('Quarto', {}, GABI_DIANTE_DO_TRECHO, []))
    useMapStore.getState().moveRegion('r-sala', 128, 0)
    const map = useMapStore.getState().map
    aceita(andar(gabiNaMesa(map), map, 'm3', { x: 384, y: 128 }), 'm3')
    barrada(andar(gabiNaMesa(map), map, 'm4', { x: 640, y: 128 }), 'm4')
  })

  it('Sala secreta: o traço no lado dela chega como parede comum, onde barra, e nada do que ela guarda vem junto', () => {
    // Vinculado à secreta, o traço sumiria da tela da Gabi e o host seguiria
    // barrando ali: parede invisível no fim do corredor, a pista do cofre.
    const tesouro = ficha('tesouro', 'Baú de moedas', 576, 224)
    const map = mestreDesenhaOTrecho(salaSemLadoOeste('Cofre', { secret: true }, GABI_DIANTE_DO_TRECHO, [tesouro]))
    const doMestre = map.walls.find((w) => w.id === 'trecho')
    expect(doMestre?.regionId).toBeUndefined()
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s, map)
    expect(snap.map.walls.find((w) => w.id === 'trecho')).toEqual(doMestre)
    barrada(andar(s, map, 'm5', { x: 576, y: 128 }), 'm5')
    expect(snap.map.walls.some((w) => w.regionId === 'r-sala')).toBe(false)
    expect(snap.map.regions.map((r) => r.id)).not.toContain('r-sala')
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['gabi'])
    const json = JSON.stringify(snap)
    for (const oculto of ['Cofre', 'Baú de moedas', 'tesouro', 'r-sala']) expect(json).not.toContain(oculto)
  })

  it('Prédio de teto fechado: o traço na fachada chega a quem está na rua, onde o host barra, e a ficha de dentro não', () => {
    // Fachada oeste do Prédio em x=320 com um vértice no meio (y=224): nenhuma
    // aresta dele cobre o traço inteiro, só a da Loja de dentro. Vinculado à
    // Loja, o traço viraria mobília do teto: sumiria da tela da Gabi e o host
    // seguiria barrando ali.
    const fachada = [{ x: 320, y: 0 }, { x: 1024, y: 0 }, { x: 1024, y: 640 }, { x: 320, y: 640 }, { x: 320, y: 224 }]
    const base = salaSemLadoOeste('Loja', { parentId: 'r-predio' }, { x: 128, y: 224 }, [ficha('balconista', 'Balconista', 704, 320)])
    const predio: Region = { ...base.regions[0], id: 'r-predio', parentId: undefined, points: fachada, room: { shape: 'rect', name: 'Prédio', roof: true } }
    useMapStore.setState({ map: { ...base, regions: [predio, ...base.regions] }, selection: [], past: [], future: [], pisoAtivo: 0 })
    useMapStore.getState().addWall(buildWallFromDraft('trecho', { x: 320, y: 128 }, { x: 320, y: 320 }))
    const map = useMapStore.getState().map
    const doMestre = map.walls.find((w) => w.id === 'trecho')
    expect(doMestre?.regionId).toBeUndefined()
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s, map)
    expect(snap.map.walls.find((w) => w.id === 'trecho')).toEqual(doMestre)
    barrada(andar(s, map, 'm6', { x: 576, y: 224 }), 'm6')
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['gabi'])
    expect(JSON.stringify(snap)).not.toContain('Balconista')
  })

  it('Sala comum sob zona oculta: o trecho e o que está dentro ficam no escuro', () => {
    const mimico = ficha('mimico', 'Mímico', 576, 224)
    const zona: ConcealZone = {
      id: 'zona-despensa',
      name: 'Despensa escondida',
      revealed: false,
      points: [{ x: 256, y: 0 }, { x: 896, y: 0 }, { x: 896, y: 448 }, { x: 256, y: 448 }],
    }
    const base = salaSemLadoOeste('Despensa', {}, GABI_DIANTE_DO_TRECHO, [mimico])
    const map = mestreDesenhaOTrecho({ ...base, concealZones: [zona] })
    const snap = snapshotDe(gabiNaMesa(map), map)
    expect(snap.map.walls.map((w) => w.id)).not.toContain('trecho')
    expect(paredeNaReta(snap.map.walls, 320)).toBe(false)
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['gabi'])
    const json = JSON.stringify(snap)
    for (const oculto of ['Despensa', 'Mímico', 'mimico', 'zona-despensa']) expect(json).not.toContain(oculto)
  })
})
