/**
 * MAPA POR ANDARES com PISOS NA MESMA CENA — a aba de outro andar mostra a
 * memória do TÉRREO daquela cena (plano pisos-na-mesma-cena-3, "Fica para
 * depois"). Nunca a planta do térreo recortada pelo que o jogador explorou no
 * 1º piso: seriam paredes e salas que ele nunca viu, no lugar das que viu.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, SceneFloor, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const MANSAO = 'Mansao Spencer'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, name: string, extra: Partial<Region> = {}): Region {
  const points = [
    { x: 20, y: 20 },
    { x: 480, y: 20 },
    { x: 480, y: 480 },
    { x: 20, y: 480 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
}

function cena(sceneId: string, nome: string, andar: SceneFloor, extra: Partial<MapData> = {}): HostScene {
  const map: MapData = { ...createEmptyMap(`m-${sceneId}`, nome, 30, 10, 50), ...extra, andar }
  return { sceneId, name: nome, map }
}

// B1: o térreo tem a Adega e uma parede; o 1º piso, no MESMO lugar do plano, a Biblioteca e outra parede.
const porao = cena('s-porao', 'Porao Umido', { predio: MANSAO, rotulo: 'B1' }, {
  walls: [parede('parede-do-terreo', 300, 20, 300, 480), parede('parede-do-primeiro', 200, 20, 200, 480, { piso: 1 })],
  regions: [sala('adega', 'Adega do terreo'), sala('biblioteca', 'Biblioteca do primeiro', { piso: 1 })],
})
const salao = cena('s-salao', 'Salao Nobre', { predio: MANSAO, rotulo: '1F' })
const CENAS = [porao, salao]

function mundo(abertaId: string, fichas: Record<string, Token[]>): HostWorld {
  const comFichas = CENAS.map((c) => ({ ...c, map: { ...c.map, tokens: [...c.map.tokens, ...(fichas[c.sceneId ?? ''] ?? [])] } }))
  const aberta = comFichas.find((c) => c.sceneId === abertaId)
  if (aberta === undefined) throw new Error('cena aberta ausente')
  return { open: aberta, background: comFichas.filter((c) => c !== aberta) }
}

function mesa() {
  let n = 0
  return createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
}

function entra(s: ReturnType<typeof mesa>, clientId: string, nome: string, tokenIds: string[], source: HostWorld): void {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, source)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  for (const id of tokenIds) s.assignToken(welcome.playerId, id)
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot, veio ${msg?.type ?? 'nada'}`)
  return msg
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

/**
 * Ana passa a jogar no salão com a outra ficha, e a do porão fica no 1º piso.
 * A cena do jogador gruda na última (`sceneFor`): para ela ir ao salão, a
 * ficha do porão sai um instante e o mestre a devolve ao 1º piso.
 */
function vaiAoSalao(s: ReturnType<typeof mesa>): HostResult {
  s.broadcast(mundo('s-salao', { 's-salao': [ficha('heroi-salao', 100, 100)] }))
  return s.broadcast(mundo('s-salao', { 's-salao': [ficha('heroi-salao', 100, 100)], 's-porao': [ficha('heroi-porao', 100, 100, { piso: 1 })] }))
}

describe('mapa por andares com pisos: a aba do outro andar é a memória do térreo dele', () => {
  it('ficha que só explorou o 1º piso do B1 não leva a planta do térreo do B1 pela aba', () => {
    const s = mesa()
    // A ficha do porão está no 1º piso e explora lá.
    const noPorao = mundo('s-porao', { 's-porao': [ficha('heroi-porao', 100, 100, { piso: 1 })] })
    entra(s, 'c1', 'Ana', ['heroi-porao', 'heroi-salao'], noPorao)
    const noPrimeiro = snapshotPara(s.broadcast(noPorao), 'c1')
    expect(noPrimeiro.map.regions.map((r) => r.id)).toEqual(['biblioteca'])

    // Ela passa a jogar com a outra ficha, no salão; a do porão fica no 1º piso.
    const r = vaiAoSalao(s)
    const snap = snapshotPara(r, 'c1')
    expect(snap.map.id).toBe('m-s-salao')
    // Do térreo do B1 ela não tem memória nenhuma: não há aba.
    expect(snap.andares).toBeUndefined()
    const texto = textoPara(r, 'c1')
    for (const segredo of ['parede-do-terreo', 'adega', 'Adega do terreo']) {
      expect(texto, segredo).not.toContain(segredo)
    }
  })

  it('com o térreo do B1 explorado, a aba mostra o térreo e nada do 1º piso', () => {
    const s = mesa()
    const noTerreo = mundo('s-porao', { 's-porao': [ficha('heroi-porao', 100, 100)] })
    entra(s, 'c1', 'Ana', ['heroi-porao', 'heroi-salao'], noTerreo)
    s.broadcast(noTerreo)
    // Sobe ao 1º piso (explora lá também) e depois joga com a ficha do salão.
    s.broadcast(mundo('s-porao', { 's-porao': [ficha('heroi-porao', 100, 100, { piso: 1 })] }))
    const r = vaiAoSalao(s)
    const b1 = snapshotPara(r, 'c1').andares?.outros

    expect(b1?.map((o) => o.rotulo)).toEqual(['B1'])
    expect(b1?.[0]?.map.regions.map((reg) => reg.id)).toEqual(['adega'])
    expect(b1?.[0]?.map.walls.map((w) => w.id)).toEqual(['parede-do-terreo'])
    const texto = textoPara(r, 'c1')
    for (const segredo of ['parede-do-primeiro', 'biblioteca', 'Biblioteca do primeiro']) {
      expect(texto, segredo).not.toContain(segredo)
    }
  })
})
