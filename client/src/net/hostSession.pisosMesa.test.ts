/**
 * PISOS NA MESMA CENA — o que sai pela rede para a TELA DA MESA e o que a mesa
 * GRAVA da memória, com pisos. Um corredor de um piso só no plano, com o 1º
 * piso EMPILHADO na ponta leste: Lia (Ana) no térreo a oeste, Caio (Bia) no
 * 1º piso a leste. A TV é de todos na mesa: ela mostra um piso só, e nada do
 * outro piso — sala, pino, parede, ficha, nem o que a Bia explorou lá em cima.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token } from '../types/map'
import { createHostSession, tableSceneKey, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'PISO02'
const CHAVE = 'chave-da-tv-dos-pisos-0123456789abcdef'
const RAIO = 700
const OESTE = { x: 150, y: 250 }
const LESTE = { x: 2850, y: 250 }

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function biblioteca(): Region {
  const points = [
    { x: 2600, y: 0 },
    { x: 3000, y: 0 },
    { x: 3000, y: 500 },
    { x: 2600, y: 500 },
  ]
  return { id: 'biblioteca', points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Biblioteca proibida' }, piso: 1 }
}

function torre(pisoDaLia = 0): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 60, 10, 50),
    walls: [{ id: 'parede-de-cima', x1: 2600, y1: 0, x2: 2600, y2: 500, blocksLight: true, blocksMove: true, door: null, piso: 1 }],
    regions: [biblioteca()],
    pins: [{ id: 'bau', x: 2800, y: 200, kind: 'exclamacao', description: 'Baú do 1º piso', image: null, piso: 1 }],
    tokens: [ficha('lia', OESTE.x, OESTE.y, pisoDaLia === 0 ? {} : { piso: pisoDaLia }), ficha('caio', LESTE.x, LESTE.y, { piso: 1 })],
  }
}

function mundo(map: MapData): HostWorld {
  return { open: { sceneId: 's-torre', name: 'Torre', map }, background: [] }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function snapshotPara(r: HostResult, clientId: string): Snapshot {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function exploradoDe(snap: Snapshot): Exploration {
  const exp = decodeExploration(snap.explored)
  if (exp === null) throw new Error('explored inválido')
  return exp
}

/** Ana (Lia) e Bia (Caio) na Torre, a TV olhando a Torre. Dois broadcasts: a memória de cada um já existe no segundo. */
function mesa(world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}`, tableKey: CHAVE })
  s.assignToken(playerIdOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, world)), 'lia')
  s.assignToken(playerIdOf(s.handleMessage('c-bia', { type: 'join', code: CODE, name: 'Bia' }, world)), 'caio')
  s.handleMessage('c-tv', { type: 'join', code: CODE, name: 'Mesa', role: 'table', tableKey: CHAVE }, world)
  s.setTableScene(tableSceneKey(world.open))
  // O primeiro envio leva a tela de cada jogador; no segundo, a tela deles não
  // muda e só a TV recebe de novo.
  const inicial = s.broadcast(world)
  return { s, inicial, r: s.broadcast(world) }
}

describe('tela da mesa com pisos', () => {
  it('a TV mostra o piso do grupo (o térreo da Ana) e nada do 1º piso — nem o que a Bia explorou lá', () => {
    const world = mundo(torre())
    const { r, inicial } = mesa(world)
    // Controle: a Bia explorou a ponta leste, no 1º piso (a tela dela é a do primeiro envio).
    expect(isPointExplored(exploradoDe(snapshotPara(inicial, 'c-bia')), LESTE)).toBe(true)

    const tv = snapshotPara(r, 'c-tv')
    const texto = JSON.stringify(tv)
    expect(texto).not.toContain('Biblioteca proibida')
    expect(texto).not.toContain('Baú do 1º piso')
    expect(texto).not.toContain('parede-de-cima')
    expect(texto).not.toContain('nome-caio')
    expect(tv.map.tokens.map((t) => t.id)).toEqual(['lia'])
    // A memória do 1º piso não abre no térreo o mesmo lugar do plano.
    const explorado = exploradoDe(tv)
    expect(isPointExplored(explorado, LESTE)).toBe(false)
    expect(isPointExplored(explorado, OESTE)).toBe(true)
  })

  it('com o grupo no 1º piso, a TV mostra o 1º piso — o piso é um só por tela', () => {
    const world = mundo(torre(1))
    const { r } = mesa(world)
    const tv = snapshotPara(r, 'c-tv')
    expect(JSON.stringify(tv)).toContain('Biblioteca proibida')
    expect(tv.map.walls.map((w) => w.id)).toEqual(['parede-de-cima'])
    expect(isPointExplored(exploradoDe(tv), LESTE)).toBe(true)
  })
})

describe('mesa guardada com pisos', () => {
  it('só o térreo de cada cena é gravado: a memória do 1º piso não volta como a do térreo', () => {
    const world = mundo(torre())
    const { s } = mesa(world)
    const gravado = s.savedExploration()
    // Ana, no térreo, grava a Torre como sempre.
    expect(gravado.find((seat) => seat.name === 'Ana')?.scenes.map((scene) => scene.mapId)).toEqual(['torre'])
    // Bia só tem memória do 1º piso: nada dela vai para o arquivo com o id da Torre.
    expect(gravado.find((seat) => seat.name === 'Bia')).toBeUndefined()
  })
})
