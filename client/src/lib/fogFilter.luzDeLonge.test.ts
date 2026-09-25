import { describe, expect, it } from 'vitest'
import type { ConcealZone, Light, MapData, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * JANELAS E LUZES ACESAS VISTAS DE LONGE, lado da REDE.
 *
 * 1. Luz marcada "Vista de longe" (`Light.vistaDeLonge`) chega ao jogador que
 *    tem LINHA DE VISÃO até ela mesmo FORA do raio — como um PONTO: raio 0
 *    (nenhum halo, nada do que ela ilumina), sem a ficha que a carrega.
 * 2. Sala com "Raio de visão aqui" (`RoomMeta.raioDeVisao`) troca o raio do
 *    jogador enquanto a ficha dele está dentro dela.
 *
 * Geometria: mapa 3000x1000, sem chão desenhado; o herói em (200, 500) com
 * raio 700. A luz distante em (2500, 500) está a 2300 px, fora do raio.
 */
const RADIUS = 700
const OWNERSHIP = { p1: ['heroi'] }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function luz(id: string, x: number, y: number, extra: Partial<Light> = {}): Light {
  return { id, x, y, radius: 300, color: '#ffcc00', intensity: 0.8, ...extra }
}

function sala(id: string, points: Region['points'], room: Partial<NonNullable<Region['room']>> = {}, extra: Partial<Region> = {}): Region {
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}`, ...room }, ...extra }
}

function retangulo(x1: number, y1: number, x2: number, y2: number): Region['points'] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function mapa(patch: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-pico', 'Pico', 3000, 1000, 50),
    tokens: [ficha('heroi', 200, 500)],
    ...patch,
  }
}

function luzesDoJogador(map: MapData): Light[] {
  return filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS).map.lights
}

describe('luz vista de longe', () => {
  it('sem a marca, a luz fora do raio não chega (como sempre foi)', () => {
    const luzes = luzesDoJogador(mapa({ lights: [luz('farol', 2500, 500)] }))
    expect(luzes).toEqual([])
  })

  it('com a marca e linha de visão livre, chega só o ponto: mesma posição e cor, raio 0', () => {
    const luzes = luzesDoJogador(mapa({ lights: [luz('farol', 2500, 500, { vistaDeLonge: true })] }))
    expect(luzes.map((l) => l.id)).toEqual(['farol'])
    expect(luzes[0].x).toBe(2500)
    expect(luzes[0].y).toBe(500)
    expect(luzes[0].color).toBe('#ffcc00')
    // Raio 0: o jogador não recebe o círculo do que a luz ilumina.
    expect(luzes[0].radius).toBe(0)
  })

  it('parede entre o jogador e a luz: nada chega', () => {
    const luzes = luzesDoJogador(mapa({ walls: [parede('muro', 1200, 0, 1200, 1000)], lights: [luz('farol', 2500, 500, { vistaDeLonge: true })] }))
    expect(luzes).toEqual([])
  })

  it('porta fechada no caminho segura a luz; aberta deixa passar', () => {
    const comPorta = (open: boolean): MapData =>
      mapa({
        walls: [
          parede('muro-norte', 1200, 0, 1200, 450),
          { ...parede('porta', 1200, 450, 1200, 550), door: { open, locked: false, kind: 'normal' } },
          parede('muro-sul', 1200, 550, 1200, 1000),
        ],
        lights: [luz('farol', 2500, 500, { vistaDeLonge: true })],
      })
    expect(luzesDoJogador(comPorta(false))).toEqual([])
    expect(luzesDoJogador(comPorta(true)).map((l) => l.id)).toEqual(['farol'])
  })

  it('luz presa numa ficha: chega o ponto, nunca a ficha nem o vínculo', () => {
    const map = mapa({
      tokens: [ficha('heroi', 200, 500), ficha('vigia-da-torre', 2500, 500)],
      lights: [luz('lampiao', 2500, 500, { vistaDeLonge: true, attachedTokenId: 'vigia-da-torre' })],
    })
    const view = filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS)
    expect(view.map.lights.map((l) => l.id)).toEqual(['lampiao'])
    expect(view.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(view.map)).not.toContain('vigia-da-torre')
  })

  it('luz presa em ficha oculta pelo mestre: nada chega', () => {
    const map = mapa({
      tokens: [ficha('heroi', 200, 500), ficha('espreita', 2500, 500, { secret: true })],
      lights: [luz('lampiao', 2500, 500, { vistaDeLonge: true, attachedTokenId: 'espreita' })],
    })
    expect(luzesDoJogador(map)).toEqual([])
  })

  it('luz oculta, dentro de teto fechado, de sala secreta ou de zona oculta: nada chega', () => {
    const acesa = luz('farol', 2500, 500, { vistaDeLonge: true })
    const casa = retangulo(2400, 400, 2600, 600)
    const zona: ConcealZone = { id: 'zona', name: 'nome-da-zona', revealed: false, points: casa }
    expect(luzesDoJogador(mapa({ lights: [{ ...acesa, hidden: true }] }))).toEqual([])
    expect(luzesDoJogador(mapa({ lights: [acesa], regions: [sala('casebre', casa, { roof: true })] }))).toEqual([])
    expect(luzesDoJogador(mapa({ lights: [acesa], regions: [sala('cofre', casa, {}, { secret: true })] }))).toEqual([])
    expect(luzesDoJogador(mapa({ lights: [acesa], concealZones: [zona] }))).toEqual([])
    expect(JSON.stringify(filterMapForPlayer(mapa({ lights: [acesa], concealZones: [zona] }), 'p1', OWNERSHIP, RADIUS).map)).not.toContain('farol')
  })

  it('camada Luzes escondida pelo mestre: nada chega', () => {
    expect(luzesDoJogador(mapa({ lights: [luz('farol', 2500, 500, { vistaDeLonge: true })], hiddenLayers: ['iluminacao'] }))).toEqual([])
  })

  it('jogador sem ficha na cena não recebe a luz de longe', () => {
    const view = filterMapForPlayer(mapa({ lights: [luz('farol', 2500, 500, { vistaDeLonge: true })] }), 'p2', { p2: [] }, RADIUS)
    expect(view.map.lights).toEqual([])
  })

  it('dentro do raio, a luz marcada chega inteira, com o raio e o halo de sempre', () => {
    const luzes = luzesDoJogador(mapa({ lights: [luz('lampiao', 500, 500, { vistaDeLonge: true })] }))
    expect(luzes.map((l) => l.id)).toEqual(['lampiao'])
    expect(luzes[0].radius).toBe(300)
  })
})

describe('raio de visão da sala', () => {
  const ALEM = ficha('estatua', 1400, 500)

  it('mirante: a ficha dentro da sala enxerga com o raio da sala, maior que o dela', () => {
    const semRaio = mapa({ tokens: [ficha('heroi', 200, 500), ALEM], regions: [sala('mirante', retangulo(100, 400, 300, 600))] })
    expect(filterMapForPlayer(semRaio, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id)).toEqual(['heroi'])
    const comRaio = mapa({ tokens: [ficha('heroi', 200, 500), ALEM], regions: [sala('mirante', retangulo(100, 400, 300, 600), { raioDeVisao: 1500 })] })
    expect(filterMapForPlayer(comRaio, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id).sort()).toEqual(['estatua', 'heroi'])
  })

  it('caracol: o raio da sala encolhe a visão da ficha que está dentro', () => {
    const perto = ficha('rato', 500, 500)
    const map = mapa({ tokens: [ficha('heroi', 200, 500), perto], regions: [sala('caracol', retangulo(100, 400, 300, 600), { raioDeVisao: 150 })] })
    expect(filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('ficha fora da sala: vale o raio do jogador', () => {
    const map = mapa({ tokens: [ficha('heroi', 200, 500), ALEM], regions: [sala('mirante', retangulo(2000, 400, 2200, 600), { raioDeVisao: 2000 })] })
    expect(filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('sala dentro de sala: vale o raio da mais de dentro', () => {
    const map = mapa({
      tokens: [ficha('heroi', 200, 500), ALEM],
      regions: [sala('torre', retangulo(50, 300, 400, 700), { raioDeVisao: 100 }), sala('mirante', retangulo(100, 400, 300, 600), { raioDeVisao: 1500 }, { parentId: 'torre' })],
    })
    expect(filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id).sort()).toEqual(['estatua', 'heroi'])
  })

  it('sala secreta não muda o raio (o jogador não pode deduzir a sala pela visão)', () => {
    const map = mapa({ tokens: [ficha('heroi', 200, 500), ALEM], regions: [sala('mirante', retangulo(100, 400, 300, 600), { raioDeVisao: 1500 }, { secret: true })] })
    expect(filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('valor inválido no raio da sala (0, negativo, NaN) é ignorado', () => {
    for (const raioDeVisao of [0, -10, Number.NaN]) {
      const map = mapa({ tokens: [ficha('heroi', 200, 500), ficha('rato', 500, 500)], regions: [sala('sala', retangulo(100, 400, 300, 600), { raioDeVisao })] })
      expect(filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS).map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'rato'])
    }
  })

  it('o número do raio da sala não vai para o jogador', () => {
    const map = mapa({ regions: [sala('mirante', retangulo(100, 400, 300, 600), { raioDeVisao: 1500 })] })
    const view = filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS)
    expect(view.map.regions.map((r) => r.id)).toEqual(['mirante'])
    expect(view.map.regions[0].room?.name).toBe('nome-mirante')
    expect(JSON.stringify(view.map)).not.toContain('raioDeVisao')
  })
})
