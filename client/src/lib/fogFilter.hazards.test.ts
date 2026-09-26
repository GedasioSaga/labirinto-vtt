/**
 * ZONA DE PERIGO no RECORTE DO JOGADOR. O jogador só vê o perigo onde ele
 * ENXERGA agora: a sala tomada fora da visão, atrás de porta fechada, secreta,
 * sob teto fechado ou mexida por zona oculta não sai. E o que sai é só o tipo
 * e o polígono — nunca o id da zona, nunca o objeto `hazards` do mestre.
 * Fumaça encurta a visão de quem está dentro.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, RegionPoint } from '../types/map'
import { GRADE, ficha, sala, torre, zona } from './__fixtures__/hazardTower'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { SMOKE_VISION_CELLS } from './hazards'

const DONOS = { p1: ['ana'] }
const RAIO = 700

function maiorDistancia(rings: RegionPoint[][], origem: RegionPoint): number {
  return Math.max(...rings.flat().map((p) => Math.hypot(p.x - origem.x, p.y - origem.y)))
}

describe('filterMapForPlayer — zona de perigo', () => {
  it('o fogo da sala onde Ana está chega; o da sala atrás da porta fechada, não', () => {
    const map = torre({
      tokens: [ficha('ana', 250, 200)],
      hazards: [zona('z-fogo-segredo', 'fogo', ['sala-a']), zona('z-agua-longe', 'agua', ['sala-c'])],
    })
    const view = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect(view.hazards).toEqual([{ kind: 'fogo', points: map.regions[0]?.points }])
    // Nada do objeto do mestre: nem o campo, nem o id da zona, nem o tipo da zona que ele não vê.
    expect('hazards' in view.map).toBe(false)
    const pacote = JSON.stringify(view)
    expect(pacote).not.toContain('z-fogo-segredo')
    expect(pacote).not.toContain('agua')
  })

  it('pela porta aberta Ana enxerga a sala B, e o fogo dela chega junto', () => {
    const map = torre({ tokens: [ficha('ana', 250, 200)], hazards: [zona('z1', 'fogo', ['sala-b'])] })
    expect(filterMapForPlayer(map, 'p1', DONOS, RAIO).hazards.map((h) => h.kind)).toEqual(['fogo'])
  })

  it('sala "Oculta para jogadores" em chamas: nada sai', () => {
    const map = torre({
      tokens: [ficha('ana', 250, 200)],
      regions: [sala('sala-a', 0, 500), sala('sala-b', 500, 1000, { secret: true }), sala('sala-c', 1000, 1500)],
      hazards: [zona('z1', 'fogo', ['sala-b'])],
    })
    const view = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect(view.hazards).toEqual([])
    expect(JSON.stringify(view)).not.toContain('fogo')
  })

  it('prédio de teto fechado em chamas, Ana do lado de fora: o fogo de dentro não sai', () => {
    const map = torre({
      tokens: [ficha('ana', 250, 200)],
      regions: [sala('sala-a', 0, 500), sala('sala-b', 500, 1000, { room: { shape: 'rect', name: 'Casa', roof: true } }), sala('sala-c', 1000, 1500)],
      hazards: [zona('z1', 'fogo', ['sala-b'])],
    })
    expect(filterMapForPlayer(map, 'p1', DONOS, RAIO).hazards).toEqual([])
  })

  it('sala tocada por zona oculta ativa: o perigo não sai; revelada, sai', () => {
    const oculta = (revealed: boolean): ConcealZone => ({
      id: 'zona',
      name: 'zona',
      revealed,
      points: [{ x: 600, y: 20 }, { x: 700, y: 20 }, { x: 700, y: 120 }, { x: 600, y: 120 }],
    })
    const base = torre({ tokens: [ficha('ana', 250, 200)], hazards: [zona('z1', 'vapor', ['sala-b'])] })
    const escondida = filterMapForPlayer({ ...base, concealZones: [oculta(false)] }, 'p1', DONOS, RAIO)
    expect(escondida.hazards).toEqual([])
    expect(JSON.stringify(escondida)).not.toContain('vapor')
    expect(filterMapForPlayer({ ...base, concealZones: [oculta(true)] }, 'p1', DONOS, RAIO).hazards.map((h) => h.kind)).toEqual(['vapor'])
  })

  it('fumaça na sala de Ana encurta a visão dela para o teto da fumaça', () => {
    const origem = { x: 250, y: 200 }
    const limpo = filterMapForPlayer(torre({ tokens: [ficha('ana', origem.x, origem.y)] }), 'p1', DONOS, RAIO)
    const fumo = filterMapForPlayer(torre({ tokens: [ficha('ana', origem.x, origem.y)], hazards: [zona('z1', 'fumaca', ['sala-a'])] }), 'p1', DONOS, RAIO)
    const teto = SMOKE_VISION_CELLS * GRADE
    expect(maiorDistancia(fumo.vision, origem)).toBeLessThanOrEqual(teto + 0.01)
    expect(maiorDistancia(fumo.vision, origem)).toBeGreaterThan(teto - 1)
    // Sem fumaça, a mesma Ana enxerga além do teto.
    expect(maiorDistancia(limpo.vision, origem)).toBeGreaterThan(teto + 1)
    expect(fumo.hazards.map((h) => h.kind)).toEqual(['fumaca'])
  })

  it('encostada na parede de um salão enfumaçado: o salão ainda não se desenha, mas o host sabe que Ana está na fumaça', () => {
    const salao = sala('salao', 0, 1500)
    const map = torre({ regions: [salao], tokens: [ficha('ana', 400, 20)], hazards: [zona('z1', 'fumaca', ['salao'])] })
    const view = filterMapForPlayer({ ...map, walls: [] }, 'p1', DONOS, RAIO)
    // A visão de 2 quadrados não alcança amostra do salão: nem ele nem o polígono do perigo saem (seria a planta dele).
    expect(view.map.regions).toEqual([])
    expect(view.hazards).toEqual([])
    expect(view.hazardsHere).toEqual([{ tokenId: 'ana', kind: 'fumaca' }])
  })

  it('sala secreta em chamas: Ana dentro recebe o fogo do cômodo dela; Bia de fora, nem desenho, nem o "você está no fogo"', () => {
    // DENTRO DA SALA SECRETA: a sala abre só para o jogador com a ficha dentro
    // (recebe a sala, as paredes e a porta como qualquer outra), então o fogo
    // dela é o fogo do cômodo de Ana. O segredo continua para quem está de
    // fora: Bia, olhando pela porta aberta da sala A, não recebe nada.
    const map = torre({
      tokens: [ficha('ana', 750, 200), ficha('bia', 250, 200)],
      regions: [sala('sala-a', 0, 500), sala('sala-b', 500, 1000, { secret: true }), sala('sala-c', 1000, 1500)],
      hazards: [zona('z1', 'fogo', ['sala-b'])],
    })
    const donos = { p1: ['ana'], p2: ['bia'] }
    const bia = filterMapForPlayer(map, 'p2', donos, RAIO)
    expect(bia.hazards).toEqual([])
    expect(bia.hazardsHere).toEqual([])
    expect(JSON.stringify(bia)).not.toContain('fogo')
    const ana = filterMapForPlayer(map, 'p1', donos, RAIO)
    expect(ana.hazards.map((h) => h.kind)).toEqual(['fogo'])
    expect(ana.hazardsHere).toEqual([{ tokenId: 'ana', kind: 'fogo' }])
  })

  it('tela da mesa: o grupo vê o perigo onde algum deles enxerga', () => {
    const map = torre({
      tokens: [ficha('ana', 250, 200), ficha('bia', 1250, 200)],
      hazards: [zona('z1', 'fogo', ['sala-c'])],
    })
    expect(filterMapForGroup(map, [{ tokenIds: ['ana'], visionRadius: RAIO }]).hazards).toEqual([])
    expect(
      filterMapForGroup(map, [
        { tokenIds: ['ana'], visionRadius: RAIO },
        { tokenIds: ['bia'], visionRadius: RAIO },
      ]).hazards.map((h) => h.kind),
    ).toEqual(['fogo'])
  })
})
