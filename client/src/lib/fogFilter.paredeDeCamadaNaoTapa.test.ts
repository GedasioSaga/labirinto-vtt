/**
 * PAREDE DE CAMADA ESCONDIDA DOS JOGADORES NÃO TAPA NADA (caça de 12/11/2026,
 * FX-SEG-A; a regra da decisão 30 do mestre): o que mora em camada escondida
 * dos jogadores não existe para eles — não tapa e não aparece. Antes a visão
 * ENVIADA atravessava a parede e a da autoridade parava nela: a tela dizia
 * "vejo" e o pacote vinha sem o que está atrás (o mecanismo do F09: a forma da
 * parede no vazio). A tocha presa SÓ nela mora na camada dela e some junto,
 * dos dois lados. Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { Drawing, Light, MapData, Prop, RegionPoint, Token, Wall } from '../types/map'
import { CAMADAS_PADRAO } from './camadas/padrao'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const LIVRE = 'livre_0a1b2c3d'
const SO_ANA: Record<string, string[]> = { ana: ['ryoko'] }
const DIA = 12 * GRID
const NOITE = raioDaNoite(() => 3 * GRID)
type Raio = Parameters<typeof filterMapForPlayer>[3]

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const parede = (id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({
  id,
  x1: x1 * GRID,
  y1: y1 * GRID,
  x2: x2 * GRID,
  y2: y2 * GRID,
  blocksLight: true,
  blocksMove: true,
  door: null,
  ...extra,
})
const objeto = (id: string, mobilia: Prop['mobilia'], x: number, y: number): Prop => ({ id, src: '', x, y, width: 0.4 * GRID, height: 0.5 * GRID, linkedMapPath: null, mobilia })
/** Tocha de parede com o centro 1,35 px a oeste da parede vertical x = 14 (o lado da ficha), na camada de Objetos. */
const TOCHA = objeto('tocha', 'tochaDeParede', 14 * GRID - 1.35, 7 * GRID)

interface Montagem {
  /** A parede (14; 4..14): na camada escondida dos jogadores, numa camada vista, ou nenhuma. */
  parede: 'escondida' | 'vista' | 'nenhuma'
  props?: Prop[]
  /** Paredes a mais, na camada de Paredes (vistas). */
  outras?: Wall[]
}

/**
 * A montagem da prova na tela (`tmp/caca-2026-11-12/testes/FX-SEG-A/fseg2.mjs`): parede vertical (14; 4..14) e,
 * atrás dela (leste), um piso verde e um barril colados, um barril e um piso no claro de uma luz em (18; 9) e uma luz
 * em (16,5; 12,5) cujo alcance encosta na parede (o caso do F03(d)). A ficha a oeste, em (11; 9).
 */
function cena(m: Montagem, ryoko: RegionPoint = P(11, 9)): MapData {
  const verde: Drawing = { id: 'verde', kind: 'polygon', points: rect(14.3, 6, 16.5, 12), color: '#22cc44', width: 0, filled: true, fillAlpha: 1 }
  const azul: Drawing = { id: 'azul', kind: 'polygon', points: rect(17, 8, 19.5, 10.5), color: '#2266ff', width: 0, filled: true, fillAlpha: 1 }
  const lights: Light[] = [
    { id: 'luz-longe', x: 18 * GRID, y: 9 * GRID, radius: 2.5 * GRID, color: '#ffcc66', intensity: 1 },
    { id: 'luz-encosta', x: 16.5 * GRID, y: 12.5 * GRID, radius: 3 * GRID, color: '#ffcc66', intensity: 1 },
  ]
  const walls = [...(m.parede === 'nenhuma' ? [] : [parede('parede', 14, 4, 14, 14, m.parede === 'escondida' ? { camada: LIVRE } : {})]), ...(m.outras ?? [])]
  const ficha: Token = { id: 'ryoko', characterId: null, name: 'Ryoko', x: ryoko.x, y: ryoko.y, size: 1, image: null }
  return {
    ...createEmptyMap('rua', 'Rua', 30, 20, GRID),
    externa: true,
    walls,
    props: [objeto('barril-colado', 'barril', 15.2 * GRID, 9 * GRID), objeto('barril-luz', 'barril', 18.6 * GRID, 9.6 * GRID), ...(m.props ?? [])],
    drawings: [verde, azul],
    lights,
    versaoDasCamadas: 2,
    modeloCamadas: { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE, nome: 'Segredo' }] },
    ocultasDoJogador: [LIVRE],
    tokens: [ficha],
  }
}

/** O que a tela do jogador recebe, pelos ids, e a visão enviada. */
function pacote(map: MapData, raio: Raio) {
  const view = filterMapForPlayer(map, 'ana', SO_ANA, raio)
  const ids = <T extends { id: string }>(itens: readonly T[]): string[] => itens.map((i) => i.id).sort()
  return { vision: view.vision, drawings: ids(view.map.drawings), walls: ids(view.map.walls), props: ids(view.map.props), lights: ids(view.map.lights) }
}

/** Dia a oeste da parede, noite no claro, noite longe: o que volta lembrado (como o host guarda a memória). */
function jornada(m: Montagem) {
  const map = cena(m)
  const exp = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
  let plano = emptyPlanMemory()
  const ver = (onde: RegionPoint, raio: Raio) => {
    const view = filterMapForPlayer(cena(m, onde), 'ana', SO_ANA, raio, exp, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, plano)
    markRings(exp, view.vision, view.blocked)
    plano = view.plan
    return view
  }
  ver(P(11, 9), DIA)
  ver(P(11, 9), NOITE)
  const view = ver(P(3, 17), NOITE)
  return { drawings: view.map.drawings.map((d) => d.id).sort(), walls: view.map.walls.map((w) => w.id).sort(), props: view.map.props.map((p) => p.id).sort(), vision: view.vision, explorado: Array.from(exp.bits) }
}

describe('parede de camada escondida dos jogadores: não tapa e não aparece', () => {
  it('de dia e de noite, dos dois lados e na memória, o pacote e a visão são os da cena sem a parede', () => {
    const sem = pacote(cena({ parede: 'nenhuma' }), DIA)
    // A prova morde: sem a parede, o que está atrás dela chega.
    expect(sem.drawings).toEqual(['azul', 'verde'])
    expect(sem.props).toEqual(['barril-colado', 'barril-luz'])
    for (const raio of [DIA, NOITE]) {
      for (const onde of [P(11, 9), P(12.6, 7), P(15.6, 9.4)]) {
        expect(pacote(cena({ parede: 'escondida' }, onde), raio)).toEqual(pacote(cena({ parede: 'nenhuma' }, onde), raio))
      }
    }
    expect(jornada({ parede: 'escondida' })).toEqual(jornada({ parede: 'nenhuma' }))
    // Controle: a mesma parede numa camada vista tapa o que está atrás.
    expect(pacote(cena({ parede: 'vista' }), DIA).props).toEqual([])
  })

  it('a tocha presa só nela some junto, dos dois lados, de dia e de noite; presa também numa parede vista, ela fica', () => {
    for (const raio of [DIA, NOITE]) {
      for (const onde of [P(12.6, 7), P(15.6, 7)]) {
        const com = pacote(cena({ parede: 'escondida', props: [TOCHA] }, onde), raio)
        expect(com.props).not.toContain('tocha')
        expect(com).toEqual(pacote(cena({ parede: 'nenhuma' }, onde), raio))
      }
    }
    expect(jornada({ parede: 'escondida', props: [TOCHA] })).toEqual(jornada({ parede: 'nenhuma' }))
    // Controle: a parede curta (13,5..14; 7), vista, também segura a tocha: ela fica e chega a quem está do lado dela.
    const curta = [parede('curta', 13.5, 7, 14, 7)]
    expect(pacote(cena({ parede: 'escondida', props: [TOCHA], outras: curta }, P(12.6, 7.5)), NOITE).props).toContain('tocha')
  })
})
