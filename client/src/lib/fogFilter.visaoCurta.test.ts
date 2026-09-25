/**
 * FUMAÇA E VAPOR QUE ENCURTAM A VISÃO, no RECORTE DO JOGADOR. Quem está dentro
 * da sala tomada pela fumaça (ou pelo vapor) enxerga só `SMOKE_VISION_CELLS`
 * casas; e quem está lá dentro fica ESCONDIDO de quem olha de fora: a ficha
 * não sai no pacote, nem pela borda, nem pela tocha que carrega. O véu (o
 * polígono do perigo) continua saindo: o jogador vê a mancha, não quem está
 * nela.
 *
 *   sala-a (0..500) | porta-ab ABERTA | sala-b (500..1000) | porta-bc fechada | sala-c
 */
import { describe, expect, it } from 'vitest'
import type { HazardKind, Light, MapData, RegionPoint, Token } from '../types/map'
import { GRADE, ficha, torre, zona } from './__fixtures__/hazardTower'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { SMOKE_VISION_CELLS } from './hazards'

const DONOS = { p1: ['ana'] }
const RAIO = 700

function maiorDistancia(rings: RegionPoint[][], origem: RegionPoint): number {
  return Math.max(...rings.flat().map((p) => Math.hypot(p.x - origem.x, p.y - origem.y)))
}

function idsDasFichas(map: MapData): string[] {
  return map.tokens.map((t) => t.id).sort()
}

/** Ana na sala A, olhando pela porta aberta; o ogro na sala B, tomada (ou não) por `kind`. */
function cena(kind: HazardKind | null, ogro: Token = ficha('ogro', 750, 200, { name: 'Ogro da Caldeira' })): MapData {
  return torre({ tokens: [ficha('ana', 250, 200), ogro], hazards: kind === null ? undefined : [zona('z-veu', kind, ['sala-b'])] })
}

describe('filterMapForPlayer — fumaça e vapor escondem quem está dentro', () => {
  it('sem perigo, Ana vê o ogro pela porta aberta (a cena de controle)', () => {
    expect(idsDasFichas(filterMapForPlayer(cena(null), 'p1', DONOS, RAIO).map)).toEqual(['ana', 'ogro'])
  })

  it.each<HazardKind>(['fumaca', 'vapor'])('%s na sala B: o ogro some para Ana, mas a mancha continua saindo', (kind) => {
    const view = filterMapForPlayer(cena(kind), 'p1', DONOS, RAIO)
    expect(idsDasFichas(view.map)).toEqual(['ana'])
    expect(view.hazards.map((h) => h.kind)).toEqual([kind])
    const pacote = JSON.stringify(view)
    expect(pacote).not.toContain('Ogro da Caldeira')
    expect(pacote).not.toContain('"ogro"')
  })

  it('fogo e água não escondem ninguém: o ogro no fogo continua à vista', () => {
    expect(idsDasFichas(filterMapForPlayer(cena('fogo'), 'p1', DONOS, RAIO).map)).toEqual(['ana', 'ogro'])
    expect(idsDasFichas(filterMapForPlayer(cena('agua'), 'p1', DONOS, RAIO).map)).toEqual(['ana', 'ogro'])
  })

  it('pela borda também não: o centro na fumaça, meio corpo para fora da porta, e o ogro não sai', () => {
    // Centro a 10 px da divisória: a borda da ficha (raio de 25 px) passa para a sala A, à vista de Ana.
    const view = filterMapForPlayer(cena('fumaca', ficha('ogro', 510, 200)), 'p1', DONOS, RAIO)
    expect(idsDasFichas(view.map)).toEqual(['ana'])
  })

  it('a tocha presa no ogro da fumaça não sai: o halo andando entregaria o trajeto dele', () => {
    const tocha: Light = { id: 'tocha-ogro', x: 750, y: 200, radius: 120, color: '#ffcc66', intensity: 1, attachedTokenId: 'ogro' }
    const comTocha = (kind: HazardKind | null): MapData => ({ ...cena(kind), lights: [tocha] })
    expect(filterMapForPlayer(comTocha(null), 'p1', DONOS, RAIO).map.lights.map((l) => l.id)).toEqual(['tocha-ogro'])
    const view = filterMapForPlayer(comTocha('fumaca'), 'p1', DONOS, RAIO)
    expect(view.map.lights).toEqual([])
    expect(JSON.stringify(view)).not.toContain('tocha-ogro')
  })

  it('Ana DENTRO do vapor enxerga só as casas do vapor: o ogro colado nela aparece, o do outro lado da sala não', () => {
    const origem = { x: 600, y: 200 }
    const perto = torre({ tokens: [ficha('ana', origem.x, origem.y), ficha('ogro', 650, 200)], hazards: [zona('z', 'vapor', ['sala-b'])] })
    const longe = torre({ tokens: [ficha('ana', origem.x, origem.y), ficha('ogro', 900, 200)], hazards: [zona('z', 'vapor', ['sala-b'])] })
    const viewPerto = filterMapForPlayer(perto, 'p1', DONOS, RAIO)
    expect(idsDasFichas(viewPerto.map)).toEqual(['ana', 'ogro'])
    expect(idsDasFichas(filterMapForPlayer(longe, 'p1', DONOS, RAIO).map)).toEqual(['ana'])
    const teto = SMOKE_VISION_CELLS * GRADE
    expect(maiorDistancia(viewPerto.vision, origem)).toBeLessThanOrEqual(teto + 0.01)
    expect(maiorDistancia(viewPerto.vision, origem)).toBeGreaterThan(teto - 1)
  })

  it('saiu da fumaça, voltou a ser visto: o esconderijo vale enquanto a ficha está lá dentro', () => {
    const fora = torre({ tokens: [ficha('ana', 250, 200), ficha('ogro', 400, 200)], hazards: [zona('z', 'fumaca', ['sala-b'])] })
    expect(idsDasFichas(filterMapForPlayer(fora, 'p1', DONOS, RAIO).map)).toEqual(['ana', 'ogro'])
  })

  it('a ficha do próprio jogador na fumaça continua saindo para ele: é ele quem a move', () => {
    const map = torre({ tokens: [ficha('ana', 750, 200)], hazards: [zona('z', 'fumaca', ['sala-b'])] })
    expect(idsDasFichas(filterMapForPlayer(map, 'p1', DONOS, RAIO).map)).toEqual(['ana'])
  })
})

describe('filterMapForGroup — tela da mesa com a fumaça', () => {
  it('Bia dentro da fumaça não empresta o raio longo de Ana: o ogro no fundo da sala enfumaçada não sai', () => {
    // Ana (sala A) alcança (900,200) pela porta aberta com o raio de 700; Bia está na fumaça, a 300 px do ogro.
    const map = torre({
      tokens: [ficha('ana', 250, 200), ficha('bia', 600, 200), ficha('ogro', 900, 200)],
      hazards: [zona('z', 'fumaca', ['sala-b'])],
    })
    const view = filterMapForGroup(map, [
      { tokenIds: ['ana'], visionRadius: RAIO },
      { tokenIds: ['bia'], visionRadius: RAIO },
    ])
    expect(idsDasFichas(view.map)).toEqual(['ana', 'bia'])
    expect(JSON.stringify(view)).not.toContain('ficha-ogro')
  })

  it('o ogro ao alcance de Bia, dentro da mesma fumaça, sai para o grupo', () => {
    const map = torre({
      tokens: [ficha('ana', 250, 200), ficha('bia', 600, 200), ficha('ogro', 660, 200)],
      hazards: [zona('z', 'fumaca', ['sala-b'])],
    })
    const view = filterMapForGroup(map, [
      { tokenIds: ['ana'], visionRadius: RAIO },
      { tokenIds: ['bia'], visionRadius: RAIO },
    ])
    expect(idsDasFichas(view.map)).toEqual(['ana', 'bia', 'ogro'])
  })
})
