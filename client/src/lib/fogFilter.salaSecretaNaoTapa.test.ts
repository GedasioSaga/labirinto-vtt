/**
 * SALA SECRETA FECHADA NÃO TAPA NADA (caça de 12/11/2026, P-NEVOA F09;
 * decisão 30 do mestre): enquanto for secreta, a sala não existe para o
 * jogador; ele vê através dela como chão, e o que está ATRÁS aparece. O que
 * está DENTRO continua escondido, e nada entrega o formato da sala. Antes a
 * autoridade parava nas paredes dela e a visão enviada não: a tela dizia
 * "vejo" e o pacote vinha sem o que está atrás (em Goa, uma sombra preta com
 * a borda da casa). Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { DoorState, Drawing, Light, MapData, Prop, Region, RegionPoint, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const SO_ANA: Record<string, string[]> = { ana: ['ryoko'] }
const DIA = 10 * GRID
const trancada: DoorState = { open: false, locked: true, kind: 'normal' }

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x: x * GRID, y: y * GRID, size: 1, image: null }
}

type Variante = 'base' | 'goa'

/**
 * A montagem mínima do provador (`fsonda2.mjs`): sala secreta (12..16; 6..11) entre a ficha (10; 8,5) e um piso
 * verde (17,5..18,5; 6,5..10,5). `goa`: com teto, porta trancada na parede leste, giro e sala-mãe, como a casa
 * 50e75289 de Goa. Dentro: um barril, uma parede SOLTA (o caso do NE, 20aff254), um lampião e um guarda.
 */
function cena(comSala: boolean, variante: Variante = 'base'): MapData {
  const regions: Region[] = [{ id: 'cidade', points: rect(1, 1, 29, 19), tag: '', fillColor: '#555', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Cidade' } }]
  const walls: Wall[] = []
  const props: Prop[] = []
  const lights: Light[] = []
  const tokens: Token[] = [ficha('ryoko', 10, 8.5)]
  if (comSala) {
    const pts = rect(12, 6, 16, 11)
    const goa = variante === 'goa'
    regions.push({
      id: 'casa-secreta',
      points: pts,
      tag: 'region',
      fillColor: '#4d2f05',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Casa', ...(goa ? { roof: true, rotation: 91, nameHiddenFromPlayers: true } : {}) },
      secret: true,
      ...(goa ? { parentId: 'cidade' } : {}),
    })
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]
      const base = { blocksLight: true, blocksMove: true, regionId: 'casa-secreta', regionEdgeIndex: i }
      if (goa && i === 1) {
        walls.push({ id: `cw${i}a`, x1: a.x, y1: a.y, x2: a.x, y2: 8.3 * GRID, door: null, ...base })
        walls.push({ id: `cw${i}p`, x1: a.x, y1: 8.3 * GRID, x2: a.x, y2: 8.75 * GRID, door: trancada, ...base })
        walls.push({ id: `cw${i}b`, x1: a.x, y1: 8.75 * GRID, x2: b.x, y2: b.y, door: null, ...base })
      } else walls.push({ id: `cw${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, door: null, ...base })
    })
    walls.push({ id: 'solta', x1: 13 * GRID, y1: 7 * GRID, x2: 15 * GRID, y2: 7 * GRID, blocksLight: true, blocksMove: true, door: null })
    props.push({ id: 'barril', src: '', x: 14 * GRID, y: 9 * GRID, width: GRID, height: GRID, linkedMapPath: null, mobilia: 'barril' })
    lights.push({ id: 'lampiao', x: 13 * GRID, y: 10 * GRID, radius: 2 * GRID, color: '#ffcc88', intensity: 1 })
    tokens.push(ficha('guarda', 14.5, 9.5))
  }
  const verde: Drawing = { id: 'verde', kind: 'polygon', points: rect(17.5, 6.5, 18.5, 10.5), color: '#00c060', width: 0, filled: true, fillAlpha: 1 }
  return { ...createEmptyMap('rua', 'Rua', 30, 20, GRID), externa: true, regions, walls, props, lights, drawings: [verde], tokens }
}

/** O que a tela do jogador recebe, pelos ids, e a visão enviada. */
function pacote(map: MapData, raio: Parameters<typeof filterMapForPlayer>[3], explorado?: ReturnType<typeof createExploration>) {
  const view = filterMapForPlayer(map, 'ana', SO_ANA, raio, explorado)
  const ids = <T extends { id: string }>(itens: readonly T[]): string[] => itens.map((i) => i.id).sort()
  return {
    vision: view.vision,
    drawings: ids(view.map.drawings),
    regions: ids(view.map.regions),
    walls: ids(view.map.walls),
    props: ids(view.map.props),
    lights: ids(view.map.lights),
    tokens: ids(view.map.tokens),
  }
}

describe('sala secreta fechada no aberto: o jogador vê através dela', () => {
  it('de dia, o que está atrás chega; nada de dentro chega; o pacote é igual ao da cena sem a sala (base e casa de Goa)', () => {
    const sem = pacote(cena(false), DIA)
    expect(sem.drawings).toEqual(['verde'])
    for (const variante of ['base', 'goa'] as const) {
      const com = pacote(cena(true, variante), DIA)
      expect(com, variante).toEqual(sem)
    }
  })

  it('na memória: visto de dia, o piso de trás volta lembrado de noite; igual com e sem a sala', () => {
    const noite = raioDaNoite(() => 3 * GRID)
    /** Um jogador com memória, como o host guarda: explorado e planta lembrada. Dia na frente da sala, noite longe. */
    const jornada = (comSala: boolean) => {
      const map = cena(comSala, 'goa')
      const exp = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
      let plano = emptyPlanMemory()
      const ver = (m: MapData, raio: Parameters<typeof filterMapForPlayer>[3]) => {
        const view = filterMapForPlayer(m, 'ana', SO_ANA, raio, exp, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, plano)
        markRings(exp, view.vision, view.blocked)
        plano = view.plan
        return view
      }
      ver(map, DIA)
      const longe = { ...map, tokens: map.tokens.map((t) => (t.id === 'ryoko' ? { ...t, x: 3 * GRID, y: 3 * GRID } : t)) }
      const view = ver(longe, noite)
      return { drawings: view.map.drawings.map((d) => d.id).sort(), regions: view.map.regions.map((r) => r.id).sort(), walls: view.map.walls.map((w) => w.id).sort(), props: view.map.props.map((p) => p.id), vision: view.vision }
    }
    const sem = jornada(false)
    expect(sem.drawings).toEqual(['verde'])
    expect(jornada(true)).toEqual(sem)
  })
})
