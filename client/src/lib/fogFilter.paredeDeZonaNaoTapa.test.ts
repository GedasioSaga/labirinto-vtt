/**
 * LUZ E OLHAR ATRÁS DE PAREDE DE ZONA OCULTA (caça de 12/11/2026, FX-SEG-A; a
 * regra da decisão 30 do mestre): a parede inteira dentro de zona oculta ativa
 * não existe para o jogador — não tapa e não aparece. A visão ENVIADA já
 * passava por ela; a da autoridade parava nela, e o claro de uma luz de fora
 * que atravessa a zona (ou o olhar da ficha) chegava do outro lado na tela sem
 * o que está lá no pacote: o vazio desenhava a sombra da parede escondida. O de
 * dentro da zona continua escondido. Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { Drawing, Light, MapData, Prop, RegionPoint, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const SO_ANA: Record<string, string[]> = { ana: ['ryoko'] }
const DIA = 12 * GRID
const NOITE = raioDaNoite(() => 3 * GRID)
type Raio = Parameters<typeof filterMapForPlayer>[3]

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const objeto = (id: string, x: number, y: number): Prop => ({ id, src: '', x: x * GRID, y: y * GRID, width: 0.6 * GRID, height: 0.6 * GRID, linkedMapPath: null, mobilia: 'barril' })

/**
 * A montagem da prova na tela (`tmp/caca-2026-11-12/testes/FX-SEG-A/fseg3.mjs`): zona oculta (12..16; 3..15) com uma
 * parede (14; 4..14) inteira dentro; uma luz a oeste (10,5; 6) que atravessa a zona e clareia o leste, uma luz a leste
 * (18,5; 11); barris e pisos nos dois claros, do lado de lá da zona; um barril DENTRO da zona.
 */
function cena(comParede: boolean, ryoko: RegionPoint, revelada = false): MapData {
  const pisos: Drawing[] = [
    { id: 'piso-oeste', kind: 'polygon', points: rect(16.3, 4.8, 17.9, 7.6), color: '#22cc44', width: 0, filled: true, fillAlpha: 1 },
    { id: 'piso-leste', kind: 'polygon', points: rect(17.5, 10, 19.8, 12.3), color: '#2266ff', width: 0, filled: true, fillAlpha: 1 },
  ]
  const lights: Light[] = [
    { id: 'luz-oeste', x: 10.5 * GRID, y: 6 * GRID, radius: 6.5 * GRID, color: '#ffcc66', intensity: 1 },
    { id: 'luz-leste', x: 18.5 * GRID, y: 11 * GRID, radius: 2.5 * GRID, color: '#ffcc66', intensity: 1 },
  ]
  const walls: Wall[] = comParede ? [{ id: 'parede-z', x1: 14 * GRID, y1: 4 * GRID, x2: 14 * GRID, y2: 14 * GRID, blocksLight: true, blocksMove: true, door: null }] : []
  const ficha: Token = { id: 'ryoko', characterId: null, name: 'Ryoko', x: ryoko.x, y: ryoko.y, size: 1, image: null }
  return {
    ...createEmptyMap('rua', 'Rua', 30, 20, GRID),
    externa: true,
    walls,
    props: [objeto('barril-oeste', 16.9, 6.2), objeto('barril-leste', 18.9, 11.5), objeto('barril-na-zona', 13, 9)],
    drawings: pisos,
    lights,
    concealZones: [{ id: 'zona', name: 'Zona', revealed: revelada, points: rect(12, 3, 16, 15) }],
    tokens: [ficha],
  }
}

function pacote(map: MapData, raio: Raio) {
  const view = filterMapForPlayer(map, 'ana', SO_ANA, raio)
  const ids = <T extends { id: string }>(itens: readonly T[]): string[] => itens.map((i) => i.id).sort()
  return { vision: view.vision, drawings: ids(view.map.drawings), walls: ids(view.map.walls), props: ids(view.map.props), lights: ids(view.map.lights) }
}

function jornada(comParede: boolean) {
  const base = cena(comParede, P(8, 9))
  const exp = createExploration({ width: base.width * base.grid, height: base.height * base.grid, grid: base.grid })
  let plano = emptyPlanMemory()
  const ver = (onde: RegionPoint, raio: Raio) => {
    const view = filterMapForPlayer(cena(comParede, onde), 'ana', SO_ANA, raio, exp, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, plano)
    markRings(exp, view.vision, view.blocked)
    plano = view.plan
    return view
  }
  ver(P(8, 9), NOITE)
  ver(P(9.5, 11.5), NOITE)
  ver(P(8, 9), DIA)
  const view = ver(P(3, 18), NOITE)
  return { drawings: view.map.drawings.map((d) => d.id).sort(), props: view.map.props.map((p) => p.id).sort(), vision: view.vision, explorado: Array.from(exp.bits) }
}

describe('parede inteira dentro de zona oculta ativa: não tapa a luz nem o olhar', () => {
  it('de noite (o claro que atravessa a zona) e de dia, ao vivo e na memória, o pacote e a visão são os da cena sem a parede', () => {
    // A prova morde: de noite, o claro da luz de fora atravessa a zona e mostra o barril e o piso do lado de lá.
    const semNoite = pacote(cena(false, P(8, 9)), NOITE)
    expect(semNoite.props).toContain('barril-oeste')
    expect(semNoite.drawings).toContain('piso-oeste')
    for (const raio of [NOITE, DIA]) {
      for (const onde of [P(8, 9), P(9.5, 11.5)]) {
        const com = pacote(cena(true, onde), raio)
        expect(com.props).not.toContain('barril-na-zona')
        expect(com).toEqual(pacote(cena(false, onde), raio))
      }
    }
    expect(jornada(true)).toEqual(jornada(false))
  })

  it('controle: com a zona revelada, a mesma parede existe e tapa o claro do lado de lá', () => {
    const com = pacote(cena(true, P(8, 9), true), NOITE)
    expect(com.walls).toEqual(['parede-z'])
    expect(com.props).not.toContain('barril-oeste')
    expect(pacote(cena(false, P(8, 9), true), NOITE).props).toContain('barril-oeste')
  })
})
