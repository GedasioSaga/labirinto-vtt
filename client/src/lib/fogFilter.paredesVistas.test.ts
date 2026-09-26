import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, type PlanMemory, type PlayerMapView } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PAREDES SÓ AS VISTAS. O jogador recebe a parede que está na visão dele agora
 * ou que ele lembra de ter visto — nunca a planta inteira do mapa. Antes, toda
 * parede fora do explorado ia no pacote "porque a névoa cobre": a névoa cobria
 * na tela, mas a rede entregava a planta do nível inteiro (12.724 de 15.073
 * paredes na a09) para quem abrisse o DevTools.
 *
 * Mapa de 1000 × 1000 px, raio 300: o herói começa em (200, 200).
 */

const RADIUS = 300
const OWN = { p1: ['heroi'] }
const PERTO = { x: 200, y: 200 }
const LONGE = { x: 800, y: 800 }

function token(at: { x: number; y: number }): Token {
  return { id: 'heroi', characterId: null, name: 'Heroi', x: at.x, y: at.y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function mapa(heroi: { x: number; y: number }, walls: Wall[]): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, 40), tokens: [token(heroi)], walls }
}

/** Um jogador com memória, como o host guarda: explorado, portas vistas e planta lembrada. */
function jogador(plan: PlanMemory = emptyPlanMemory()) {
  const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
  const doors = new Map<string, DoorState>()
  let memory = plan
  const ver = (map: MapData): PlayerMapView => {
    const view = filterMapForPlayer(map, 'p1', OWN, RADIUS, exp, doors, undefined, undefined, undefined, undefined, undefined, undefined, undefined, memory)
    markRings(exp, view.vision, view.blocked)
    memory = view.plan
    for (const w of map.walls) {
      if (w.door !== null && view.visibleDoorIds.includes(w.id)) doors.set(w.id, { ...w.door })
    }
    return view
  }
  return { ver, exp }
}

const idsDasParedes = (view: PlayerMapView): string[] => view.map.walls.map((w) => w.id).sort()

/** Parede curta perto do herói (na visão) e uma no canto oposto, a mais de 800 px. */
const PAREDE_PERTO = wall('perto', 150, 320, 250, 320)
const PAREDE_LONGE = wall('longe-nunca-vista', 700, 900, 900, 900)

describe('filterMapForPlayer: o jogador só recebe as paredes que viu', () => {
  it('parede longe que ele nunca viu não sai no pacote; a da visão sai', () => {
    const j = jogador()
    const view = j.ver(mapa(PERTO, [PAREDE_PERTO, PAREDE_LONGE]))
    expect(idsDasParedes(view)).toEqual(['perto'])
    expect(JSON.stringify(view.map)).not.toContain('longe-nunca-vista')
    // Nem pela memória que o host guarda para o próximo pacote.
    expect(view.plan.walls.has('longe-nunca-vista')).toBe(false)
  })

  it('parede atrás de um muro, dentro do raio, não sai: o muro tapa a visão', () => {
    const j = jogador()
    // Muro de cima a baixo em x = 300; a parede escondida fica 100 px atrás dele,
    // a 200 px do herói — dentro do raio, fora da visão.
    const muro = wall('muro', 300, 0, 300, 1000)
    const escondida = wall('atras-do-muro', 400, 150, 400, 250)
    const view = j.ver(mapa(PERTO, [muro, escondida]))
    expect(idsDasParedes(view)).toEqual(['muro'])
    expect(JSON.stringify(view.map)).not.toContain('atras-do-muro')
  })

  it('porta longe nunca vista também não sai', () => {
    const j = jogador()
    const porta = wall('porta-longe', 700, 900, 780, 900, { open: false, locked: true, kind: 'normal' })
    const view = j.ver(mapa(PERTO, [PAREDE_PERTO, porta]))
    expect(idsDasParedes(view)).toEqual(['perto'])
    expect(view.visibleDoorIds).toEqual([])
  })

  it('andando até a parede longe ela passa a sair; a que ele viu antes continua lembrada', () => {
    const j = jogador()
    j.ver(mapa(PERTO, [PAREDE_PERTO, PAREDE_LONGE]))
    const la = j.ver(mapa(LONGE, [PAREDE_PERTO, PAREDE_LONGE]))
    expect(idsDasParedes(la)).toEqual(['longe-nunca-vista', 'perto'])
    // De volta perto: a de longe continua na memória dele (ele viu).
    const volta = j.ver(mapa(PERTO, [PAREDE_PERTO, PAREDE_LONGE]))
    expect(idsDasParedes(volta)).toEqual(['longe-nunca-vista', 'perto'])
  })

  it('sem memória da planta (regra antiga), só sai a parede vista ou explorada', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    const primeira = filterMapForPlayer(mapa(PERTO, [PAREDE_PERTO, PAREDE_LONGE]), 'p1', OWN, RADIUS, exp)
    markRings(exp, primeira.vision, primeira.blocked)
    expect(idsDasParedes(primeira)).toEqual(['perto'])
    // Explorado sem memória mostra o presente: a parede perto, agora fora da visão, sai; a longe continua de fora.
    const semVer = filterMapForPlayer(mapa({ x: 850, y: 150 }, [PAREDE_PERTO, PAREDE_LONGE]), 'p1', OWN, RADIUS, exp)
    expect(idsDasParedes(semVer)).toEqual(['perto'])
  })

  it('sem explorado nenhum, só a visão atual conta', () => {
    const view = filterMapForPlayer(mapa(PERTO, [PAREDE_PERTO, PAREDE_LONGE]), 'p1', OWN, RADIUS)
    expect(idsDasParedes(view)).toEqual(['perto'])
  })
})
