import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Region, RegionPoint, RoomMeta, Token, Wall } from '../types/map'
import { resolveTokenMove } from './collision'
import { filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { createEmptyMap } from './mapFactory'

/**
 * VER ATRAVÉS DAS PAREDES DA SALA (`RoomMeta.dentroVeFora` / `foraVeDentro`).
 * Só o OLHAR atravessa as paredes ligadas à borda da Sala (portas fechadas
 * inclusive); o teto, a sala secreta, a zona oculta, o escuro e o cômodo
 * continuam valendo, e a colisão não muda.
 *
 * Geometria (px de mundo, 2000 x 1000, grade 50, raio 700):
 *   sala     400..800 x 300..700, paredes ligadas; porta FECHADA no norte (580..620);
 *   dentro   herói em (600, 500);  fora   herói em (150, 500);
 *   guarda   NPC fora, a leste, em (1100, 500);  tesouro   NPC dentro, em (600, 500).
 */
const RAIO = 700
const POSSE = { p1: ['heroi'] }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function retangulo(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function sala(id: string, points: RegionPoint[], room: Partial<RoomMeta> = {}, extra: Partial<Region> = {}): Region {
  return { id, points, tag: '', fillColor: '#3a3a3a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: id, ...room }, ...extra }
}

function parede(id: string, a: RegionPoint, b: RegionPoint, extra: Partial<Wall> = {}): Wall {
  return { id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** As quatro paredes ligadas à borda; a do norte com uma porta FECHADA no meio quando `porta`. */
function paredesDe(region: Region, porta = false): Wall[] {
  const p = region.points
  const lados = p.map((a, i) => ({ a, b: p[(i + 1) % p.length], i }))
  return lados.flatMap(({ a, b, i }) => {
    const vinculo = { regionId: region.id, regionEdgeIndex: i }
    if (!porta || i !== 0) return [parede(`${region.id}-${i}`, a, b, vinculo)]
    const meio = (a.x + b.x) / 2
    return [
      parede(`${region.id}-${i}a`, a, { x: meio - 20, y: a.y }, vinculo),
      parede(`${region.id}-porta`, { x: meio - 20, y: a.y }, { x: meio + 20, y: a.y }, { ...vinculo, door: { open: false, locked: false, kind: 'normal' } }),
      parede(`${region.id}-${i}b`, { x: meio + 20, y: a.y }, b, vinculo),
    ]
  })
}

const SALA_PONTOS = retangulo(400, 300, 800, 700)

function cena(room: Partial<RoomMeta>, heroi: Token, extra: Partial<MapData> = {}, regionExtra: Partial<Region> = {}): MapData {
  const vitrine = sala('sala', SALA_PONTOS, room, regionExtra)
  return {
    ...createEmptyMap('m-vitrine', 'Vitrine', 40, 20, 50),
    regions: [vitrine],
    walls: paredesDe(vitrine, true),
    tokens: [heroi, ficha('guarda', 1100, 500), ficha('tesouro', 600, 500)],
    ...extra,
  }
}

const DENTRO = ficha('heroi', 600, 450)
const FORA = ficha('heroi', 150, 500)

function recebe(map: MapData, tokenId: string, raio = RAIO): boolean {
  return filterMapForPlayer(map, 'p1', POSSE, raio).map.tokens.some((t) => t.id === tokenId)
}

function veNaVisao(map: MapData, x: number, y: number, raio = RAIO): boolean {
  return filterMapForPlayer(map, 'p1', POSSE, raio).vision.some((ring) => pointInRing({ x, y }, [...ring]))
}

describe('fogFilter — ver através das paredes da Sala', () => {
  it('de dentro: só com "De dentro, vê lá fora" a ficha vê o guarda do lado de fora', () => {
    expect(recebe(cena({}, DENTRO), 'guarda')).toBe(false)
    expect(veNaVisao(cena({}, DENTRO), 1100, 500)).toBe(false)
    expect(recebe(cena({ dentroVeFora: true }, DENTRO), 'guarda')).toBe(true)
    expect(veNaVisao(cena({ dentroVeFora: true }, DENTRO), 1100, 500)).toBe(true)
    // O outro interruptor não ajuda quem está dentro.
    expect(recebe(cena({ foraVeDentro: true }, DENTRO), 'guarda')).toBe(false)
  })

  it('de dentro: a Sala vizinha (sem parede) também sai só com o interruptor', () => {
    const vizinha = sala('vizinha', retangulo(950, 350, 1250, 650))
    const comVizinha = (room: Partial<RoomMeta>): MapData => {
      const base = cena(room, DENTRO)
      return { ...base, regions: [...base.regions, vizinha] }
    }
    expect(filterMapForPlayer(comVizinha({}), 'p1', POSSE, RAIO).map.regions.some((r) => r.id === 'vizinha')).toBe(false)
    expect(filterMapForPlayer(comVizinha({ dentroVeFora: true }), 'p1', POSSE, RAIO).map.regions.some((r) => r.id === 'vizinha')).toBe(true)
  })

  it('de fora: só com "De fora, vê aqui dentro" a ficha vê o tesouro lá dentro', () => {
    expect(recebe(cena({}, FORA), 'tesouro')).toBe(false)
    expect(recebe(cena({ dentroVeFora: true }, FORA), 'tesouro')).toBe(false)
    expect(recebe(cena({ foraVeDentro: true }, FORA), 'tesouro')).toBe(true)
    expect(veNaVisao(cena({ foraVeDentro: true }, FORA), 600, 500)).toBe(true)
  })

  it('em cima do muro é fora: "De dentro" não vale, "De fora" vale', () => {
    const noMuro = ficha('heroi', 400, 500)
    expect(recebe(cena({ dentroVeFora: true }, noMuro), 'guarda')).toBe(false)
    expect(recebe(cena({ foraVeDentro: true }, noMuro), 'tesouro')).toBe(true)
  })

  it('mão dupla: com os dois ligados, quem está dentro vê fora e quem está fora vê dentro', () => {
    const dupla = { dentroVeFora: true, foraVeDentro: true }
    expect(recebe(cena(dupla, DENTRO), 'guarda')).toBe(true)
    expect(recebe(cena(dupla, FORA), 'tesouro')).toBe(true)
  })

  it('o teto vence: com o teto fechado, quem está fora não vê nada lá dentro, mesmo com "De fora"', () => {
    expect(recebe(cena({ roof: true, foraVeDentro: true }, FORA), 'tesouro')).toBe(false)
    expect(veNaVisao(cena({ roof: true, foraVeDentro: true }, FORA), 600, 500)).toBe(false)
    // Quem está dentro abre o teto, e "De dentro" continua valendo.
    expect(recebe(cena({ roof: true, dentroVeFora: true }, DENTRO), 'guarda')).toBe(true)
  })

  it('sala secreta continua escondida de quem está fora', () => {
    const map = cena({ foraVeDentro: true }, FORA, {}, { secret: true })
    const view = filterMapForPlayer(map, 'p1', POSSE, RAIO)
    expect(view.map.tokens.some((t) => t.id === 'tesouro')).toBe(false)
    expect(view.map.regions.some((r) => r.id === 'sala')).toBe(false)
  })

  it('zona oculta sobre o interior continua escondendo o que está nela', () => {
    const zona: ConcealZone = { id: 'z', points: retangulo(450, 350, 750, 650), name: 'Zona', revealed: false }
    expect(recebe(cena({ foraVeDentro: true }, FORA, { concealZones: [zona] }), 'tesouro')).toBe(false)
  })

  it('sala escura: o escuro continua valendo lá dentro para quem olha de fora', () => {
    expect(recebe(cena({ foraVeDentro: true }, FORA), 'tesouro')).toBe(true)
    expect(recebe(cena({ foraVeDentro: true, dark: true }, FORA), 'tesouro')).toBe(false)
  })

  it('cômodo lembrado: olhar para dentro através da parede conta como ver o cômodo', () => {
    const tem = (room: Partial<RoomMeta>): boolean => filterMapForPlayer(cena(room, FORA), 'p1', POSSE, RAIO).map.regions.some((r) => r.id === 'sala')
    expect(tem({ comodo: true })).toBe(false)
    expect(tem({ comodo: true, foraVeDentro: true })).toBe(true)
  })

  it('parede sem vínculo com a Sala continua segurando o olhar', () => {
    // Muro solto a leste, entre a Sala e o guarda; a oeste nada.
    const muro = parede('muro-solto', { x: 950, y: 0 }, { x: 950, y: 1000 })
    const base = cena({ dentroVeFora: true }, DENTRO)
    const map: MapData = { ...base, walls: [...base.walls, muro], tokens: [...base.tokens, ficha('vigia', 150, 500)] }
    expect(recebe(map, 'guarda')).toBe(false)
    expect(recebe(map, 'vigia')).toBe(true)
  })

  it('sala dentro de sala: as paredes da de dentro são dela, e cada interruptor vale para a sala dele', () => {
    const externa = sala('externa', retangulo(100, 100, 1300, 900), { dentroVeFora: true })
    const interna = (room: Partial<RoomMeta>): Region => sala('interna', retangulo(450, 350, 750, 650), room)
    const mapa = (heroi: Token, roomInterna: Partial<RoomMeta>): MapData => {
      const i = interna(roomInterna)
      return {
        ...createEmptyMap('m-ninho', 'Ninho', 40, 20, 50),
        regions: [externa, i],
        walls: [...paredesDe(externa), ...paredesDe(i)],
        tokens: [heroi, ficha('guarda', 1400, 500), ficha('tesouro', 600, 500)],
      }
    }
    // Na de dentro (sem interruptor): as paredes dela seguram, o guarda fora da externa não aparece.
    expect(recebe(mapa(ficha('heroi', 600, 500), {}), 'guarda', 1000)).toBe(false)
    // Na externa, fora da interna: a externa deixa ver lá fora.
    expect(recebe(mapa(ficha('heroi', 1000, 500), {}), 'guarda', 1000)).toBe(true)
    // E da externa para dentro da interna, só com o "De fora" da interna.
    expect(recebe(mapa(ficha('heroi', 1000, 500), {}), 'tesouro', 1000)).toBe(false)
    expect(recebe(mapa(ficha('heroi', 1000, 500), { foraVeDentro: true }), 'tesouro', 1000)).toBe(true)
  })

  it('o jogador recebe a Sala e as paredes com a cara de sempre, sem os dois campos', () => {
    const view = filterMapForPlayer(cena({ dentroVeFora: true, foraVeDentro: true }, DENTRO), 'p1', POSSE, RAIO)
    const room = view.map.regions.find((r) => r.id === 'sala')?.room
    expect(room).toBeDefined()
    expect(room !== undefined && 'dentroVeFora' in room).toBe(false)
    expect(room !== undefined && 'foraVeDentro' in room).toBe(false)
    const leste = view.map.walls.find((w) => w.id === 'sala-1')
    expect(leste?.blocksLight).toBe(true)
    expect(leste?.blocksMove).toBe(true)
    expect(view.map.walls.find((w) => w.id === 'sala-porta')?.door?.open).toBe(false)
  })

  it('colisão não muda: a ficha que vê através da parede continua sem atravessá-la', () => {
    const map = cena({ dentroVeFora: true, foraVeDentro: true }, DENTRO)
    const chegou = resolveTokenMove({ x: 600, y: 500 }, { x: 1100, y: 500 }, map.walls)
    expect(chegou.x).toBeLessThan(800)
    const entrou = resolveTokenMove({ x: 150, y: 500 }, { x: 600, y: 500 }, map.walls)
    expect(entrou.x).toBeLessThan(400)
  })
})
