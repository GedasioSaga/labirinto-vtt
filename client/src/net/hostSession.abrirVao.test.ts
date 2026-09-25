import { describe, expect, it } from 'vitest'
import { abrirVaoDosDoisLados, desabarParede } from '../lib/abrirVao'
import { addOpeningOnWall, addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ABRIR VÃO NO MEIO DA SESSÃO, pela rede. Armazém (0..512) e Oficina
 * (512..1024) encostados: a divisa em x=512 é a parede de cada prédio. Gabi
 * está no Armazém; na Oficina há uma bancada que ela nunca viu.
 *
 * O vão não é dado novo na rede — é parede a menos. O que se cobra aqui:
 *  - o vão aberto dos dois lados deixa a ficha passar (o host aceita);
 *  - a MEMÓRIA dela (Armazém explorado, Gabi longe dali) já chega com o vão,
 *    junto com o resto das paredes lembradas;
 *  - e nada do que ela não viu vem junto: nem a bancada, nem o nome da
 *    Oficina, nem a parede que caiu num lugar que ela nunca explorou.
 */
const CODE = 'VAO001'
const GRADE = 64
const GABI_NO_ARMAZEM = { x: 256, y: 160 }
/** Longe de tudo: a visão (raio 700) não alcança a divisa daqui. */
const GABI_LONGE = { x: 2400, y: 1150 }

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function doisPredios(gabi: { x: number; y: number }): MapData {
  const armazem = buildRoomFromDraft('r-armazem', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 0 }, { x: 512, y: 320 }, undefined, undefined, 'Armazém')
  const oficina = buildRoomFromDraft('r-oficina', ['o0', 'o1', 'o2', 'o3'], { x: 512, y: 0 }, { x: 1024, y: 320 }, undefined, undefined, 'Oficina')
  const base = createEmptyMap('map_vao_sessao', 'Porto', 40, 20, GRADE)
  const map = addRoom(addRoom(base, armazem.region, armazem.walls), oficina.region, oficina.walls)
  return { ...map, tokens: [ficha('gabi', 'Gabi', gabi.x, gabi.y), ficha('bancada', 'Bancada do ferreiro', 800, 160)] }
}

/** O mesmo mapa com Gabi em outro lugar (o mestre arrastou a ficha). */
function comGabiEm(map: MapData, gabi: { x: number; y: number }): MapData {
  return { ...map, tokens: map.tokens.map((t) => (t.id === 'gabi' ? { ...t, ...gabi } : t)) }
}

function gabiNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Gabi' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'gabi')
  return s
}

function snapshotDe(mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = mensagens.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Gabi')
  return snap
}

/** A parede recebida cobre o ponto (512, y) da divisa? */
function divisaFechadaEm(walls: readonly Wall[], y: number): boolean {
  return walls.some((w) => Math.abs(w.x1 - 512) < 0.5 && Math.abs(w.x2 - 512) < 0.5 && Math.min(w.y1, w.y2) <= y && Math.max(w.y1, w.y2) >= y)
}

function andar(s: ReturnType<typeof gabiNaMesa>, map: MapData, reqId: string, para: { x: number; y: number }) {
  return s.handleMessage('c1', { type: 'token.move', reqId, tokenId: 'gabi', x: para.x, y: para.y }, map)
}

describe('hostSession: o mestre abre um vão entre dois prédios no meio da sessão', () => {
  it('antes do vão a divisa chega fechada e a ficha é barrada', () => {
    const map = doisPredios(GABI_NO_ARMAZEM)
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    expect(divisaFechadaEm(snap.map.walls, 160)).toBe(true)
    const r = andar(s, map, 'm0', { x: 800, y: 160 })
    expect(r.applyMove).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'm0', reason: 'wall' } }])
  })

  it('o vão só da parede clicada (o do editor) continua barrando: a do outro lado segura', () => {
    const map = addOpeningOnWall(doisPredios(GABI_NO_ARMAZEM), 'a1', { x: 512, y: 160 }, GRADE)
    const s = gabiNaMesa(map)
    s.broadcast(map)
    expect(andar(s, map, 'm1', { x: 800, y: 160 }).applyMove).toBeUndefined()
  })

  it('um clique abre o vão dos dois lados: a divisa chega aberta e a ficha passa', () => {
    const map = abrirVaoDosDoisLados(doisPredios(GABI_NO_ARMAZEM), 'a1', { x: 512, y: 160 }, GRADE).map
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    expect(divisaFechadaEm(snap.map.walls, 160)).toBe(false)
    // O resto da divisa segue de pé na tela dela.
    expect(divisaFechadaEm(snap.map.walls, 64)).toBe(true)
    expect(divisaFechadaEm(snap.map.walls, 256)).toBe(true)
    const r = andar(s, map, 'm2', { x: 800, y: 160 })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.accepted', reqId: 'm2', x: 800, y: 160 } }])
  })

  it('a memória dela mostra o vão novo junto com as paredes lembradas, e nada que ela não viu', () => {
    const inicio = doisPredios(GABI_NO_ARMAZEM)
    const s = gabiNaMesa(inicio)
    s.broadcast(inicio) // Gabi vê o Armazém: vira memória.
    const longe = comGabiEm(inicio, GABI_LONGE)
    const lembrado = snapshotDe(s.broadcast(longe).outbound)
    // Prova de que é MEMÓRIA: dali ela não vê a divisa, mas lembra dela fechada.
    expect(lembrado.vision.flat().every((p) => p.x > 1000)).toBe(true)
    expect(divisaFechadaEm(lembrado.map.walls, 160)).toBe(true)

    const aberto = abrirVaoDosDoisLados(longe, 'a1', { x: 512, y: 160 }, GRADE).map
    const snap = snapshotDe(s.broadcast(aberto).outbound)

    expect(divisaFechadaEm(snap.map.walls, 160)).toBe(false)
    expect(divisaFechadaEm(snap.map.walls, 64)).toBe(true)
    expect(divisaFechadaEm(snap.map.walls, 256)).toBe(true)
    // As outras paredes lembradas do Armazém continuam lá.
    const lembradasForaDaDivisa = (walls: readonly Wall[]) => walls.filter((w) => w.regionId === 'r-armazem' && w.regionEdgeIndex !== 1).map((w) => w.id).sort()
    expect(lembradasForaDaDivisa(snap.map.walls)).toEqual(['a0', 'a2', 'a3'])
    expect(lembradasForaDaDivisa(lembrado.map.walls)).toEqual(['a0', 'a2', 'a3'])
    // O vão não revela o outro lado a quem não está olhando.
    const json = JSON.stringify(snap)
    expect(json).not.toContain('Bancada do ferreiro')
    expect(json).not.toContain('"bancada"')
    expect(json).not.toContain('Oficina')
    expect(snap.map.regions.map((r) => r.id)).toEqual(['r-armazem'])
    // A memória não cresce com o vão: ela não estava lá para ver.
    expect(snap.explored).toEqual(lembrado.explored)
  })

  it('SEGURANÇA: parede que desaba onde ela nunca esteve não revela nada do que há ali', () => {
    const map = doisPredios(GABI_NO_ARMAZEM)
    const s = gabiNaMesa(map)
    const antes = snapshotDe(s.broadcast(map).outbound)
    // A parede leste da Oficina (x=1024): fora da visão dela, nunca explorada.
    const desabou = desabarParede(map, 'o1').map
    expect(desabou.walls.some((w) => w.id === 'o1')).toBe(false)
    const depois = snapshotDe(s.broadcast(desabou).outbound)
    expect(depois.map.tokens.map((t) => t.id)).toEqual(['gabi'])
    expect(depois.map.regions.map((r) => r.id)).toEqual(antes.map.regions.map((r) => r.id))
    expect(depois.vision).toEqual(antes.vision)
    expect(depois.explored).toEqual(antes.explored)
    expect(JSON.stringify(depois)).not.toContain('Bancada do ferreiro')
    expect(JSON.stringify(depois)).not.toContain('Oficina')
  })

  it('SEGURANÇA: vão aberto para uma sala SECRETA não entrega a sala, o que há nela, nem as paredes dela', () => {
    const base = doisPredios(GABI_NO_ARMAZEM)
    const comSecreta: MapData = { ...base, regions: base.regions.map((r) => (r.id === 'r-oficina' ? { ...r, secret: true } : r)) }
    const corte = abrirVaoDosDoisLados(comSecreta, 'a1', { x: 512, y: 160 }, GRADE)
    const map = corte.map
    // O lado do Armazém abriu; a parede da sala secreta ficou (e o mestre é avisado).
    expect(corte.salaSecretaPoupada).toBe(true)
    expect(map.walls.some((w) => w.id === 'a1')).toBe(false)
    expect(map.walls.some((w) => w.id === 'o3')).toBe(true)
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    const json = JSON.stringify(snap)
    expect(json).not.toContain('Bancada do ferreiro')
    expect(json).not.toContain('"bancada"')
    expect(json).not.toContain('Oficina')
    expect(snap.map.regions.map((r) => r.id)).toEqual(['r-armazem'])
    expect(snap.map.walls.some((w) => w.regionId === 'r-oficina')).toBe(false)
    // Para ela a divisa segue fechada (a parede secreta chega como parede
    // comum) e a ficha não passa.
    expect(divisaFechadaEm(snap.map.walls, 160)).toBe(true)
    expect(andar(s, map, 'm3', { x: 800, y: 160 }).applyMove).toBeUndefined()
  })
})
