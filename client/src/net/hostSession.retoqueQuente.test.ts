import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MEIO-TERMO, RETOQUE Q (MT9), pelo PACOTE REAL do host: o jogador da Vila
 * recebe a vista dos móveis, a chaminé, a grade e o desenho do móvel da cena
 * DELE, pelo snapshot de verdade (passado por JSON, como na rede); nada da
 * Cripta (outra cena, de fundo) chega; e a troca da vista pelo mestre chega
 * no broadcast seguinte, nos dois sentidos.
 */

const CODE = 'AB12CD'
const RAIO = 700
const GRADE = 40

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function movel(id: string, x: number, y: number): Prop {
  return { id, src: '', x, y, width: 40, height: 40, linkedMapPath: null, mobilia: 'mesa', mobiliaDesenho: 'linhas' }
}

function cela(id: string, x: number, y: number): Wall {
  return { id, x1: x, y1: y, x2: x + 200, y2: y, blocksLight: true, blocksMove: true, door: null, janela: true, grade: true }
}

function casa(id: string): Region {
  return {
    id,
    points: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `Sala ${id}`, roof: true, chamine: true },
  }
}

function vila(vista: MapData['vistaDosMoveis']): MapData {
  const base: MapData = {
    ...createEmptyMap('mapa-vila', 'Vila', 25, 25, GRADE),
    tokens: [ficha('heroi', 250, 650)],
    regions: [casa('casa-da-vila')],
    walls: [cela('cela-da-vila', 100, 900)],
    props: [movel('mesa-da-vila', 250, 800)],
  }
  return vista === undefined ? base : { ...base, vistaDosMoveis: vista }
}

function cripta(): MapData {
  return {
    ...createEmptyMap('mapa-cripta', 'Cripta', 25, 25, GRADE),
    regions: [casa('casa-da-cripta')],
    walls: [cela('cela-da-cripta', 100, 900)],
    props: [movel('mesa-da-cripta', 250, 800)],
    vistaDosMoveis: 'tres-quartos',
  }
}

function mundo(vista: MapData['vistaDosMoveis']): HostWorld {
  return { open: { sceneId: 'cena-vila', name: 'Vila', map: vila(vista) }, background: [{ sceneId: 'cena-cripta', name: 'Cripta', map: cripta() }] }
}

type ComMapa = Extract<HostMessage, { type: 'snapshot' | 'delta' }>

/** O último snapshot ou delta que saiu para `clientId`, passado por JSON como na rede. */
function ultimoMapa(outbound: readonly { clientId: string; msg: HostMessage }[], clientId: string): MapData | undefined {
  const comMapa = outbound.filter((o): o is { clientId: string; msg: ComMapa } => o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta'))
  const ultimo = comMapa[comMapa.length - 1]
  if (ultimo === undefined) return undefined
  const fio: ComMapa = JSON.parse(JSON.stringify(ultimo.msg))
  return fio.map
}

function mesa(w: HostWorld) {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RAIO,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound[0]?.msg
  if (entrou?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(entrou.playerId, 'heroi')
  return s
}

describe('hostSession: o retoque Q pelo pacote real', () => {
  it('o jogador da Vila recebe a vista, a chaminé, a grade e o desenho da Vila, e nada da Cripta', () => {
    const w = mundo('tres-quartos')
    const s = mesa(w)
    const r = s.broadcast(w)
    const mapa = ultimoMapa(r.outbound, 'c1')
    expect(mapa).toBeDefined()
    expect(mapa?.vistaDosMoveis).toBe('tres-quartos')
    expect(mapa?.regions.find((x) => x.id === 'casa-da-vila')?.room?.chamine).toBe(true)
    expect(mapa?.walls.find((x) => x.id === 'cela-da-vila')?.grade).toBe(true)
    expect(mapa?.props.find((x) => x.id === 'mesa-da-vila')?.mobiliaDesenho).toBe('linhas')
    const fio = JSON.stringify(r.outbound)
    for (const daCripta of ['casa-da-cripta', 'cela-da-cripta', 'mesa-da-cripta', 'mapa-cripta']) expect(fio).not.toContain(daCripta)
  })

  it('a Vila "de cima" com a Cripta em 3/4: a vista da Cripta não vaza', () => {
    const w = mundo(undefined)
    const r = mesa(w).broadcast(w)
    const mapa = ultimoMapa(r.outbound, 'c1')
    expect(mapa?.props.some((x) => x.id === 'mesa-da-vila')).toBe(true)
    expect(mapa !== undefined && 'vistaDosMoveis' in mapa).toBe(false)
    expect(JSON.stringify(r.outbound)).not.toContain('tres-quartos')
  })

  it('o mestre troca a vista: o broadcast seguinte leva a troca, nos dois sentidos', () => {
    const deCima = mundo(undefined)
    const s = mesa(deCima)
    s.broadcast(deCima)
    const tresQuartos = mundo('tres-quartos')
    expect(ultimoMapa(s.broadcast(tresQuartos).outbound, 'c1')?.vistaDosMoveis).toBe('tres-quartos')
    const volta = ultimoMapa(s.broadcast(deCima).outbound, 'c1')
    expect(volta).toBeDefined()
    expect(volta !== undefined && 'vistaDosMoveis' in volta).toBe(false)
  })
})
