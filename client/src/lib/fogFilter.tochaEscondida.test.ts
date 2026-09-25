import { describe, expect, it } from 'vitest'
import type { ConcealZone, Light, MapData, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap, setTokenPosition } from './mapFactory'

/**
 * TOCHA PRESA NUMA FICHA QUE O MESTRE ESCONDE PELO LUGAR, lado da REDE.
 *
 * A tocha pode ficar AFASTADA da ficha que a carrega: mapa salvo quando
 * prender guardava o afastamento, ou a luz selecionada ("Ajustar a luz")
 * empurrada pelas setas — e continua presa (`carryAttachedLights`). Com a
 * ficha dentro de uma zona oculta, sala oculta ou prédio de teto fechado e a
 * luz do lado de fora, à vista, o recorte mandava a luz sem o vínculo: a cada
 * passo do NPC o halo andava igual na tela do jogador — o trajeto de quem o
 * mestre escondeu, desenhado em vermelho.
 *
 * Geometria (mapa 1000x1000 de grade 40; parede só na sala oculta e no
 * controle da sala comum, onde é ela que segura a visão):
 *   lugar escondido  100..400 x 100..400, com o guarda em (250, 250);
 *   tocha do guarda  (250, 480): 230 px abaixo dele, FORA do lugar;
 *   herói            (250, 600), olhando tudo com raio 700.
 */
const LUGAR: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
const GUARDA = { x: 250, y: 250 }
const TOCHA = { x: 250, y: 480 }
const HEROI = { x: 250, y: 600 }
const RADIUS = 700
const OWNERSHIP = { p1: ['heroi'] }

function ficha(id: string, p: { x: number; y: number }): Token {
  return { id, characterId: null, name: `nome-${id}`, x: p.x, y: p.y, size: 1, image: null }
}

function sala(id: string, extra: Partial<Region> = {}): Region {
  return { id, points: LUGAR, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}` }, ...extra }
}

const tochaDoGuarda: Light = { id: 'tocha-do-guarda', x: TOCHA.x, y: TOCHA.y, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'guarda' }

function cena(extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [ficha('heroi', HEROI), ficha('guarda', GUARDA)],
    lights: [tochaDoGuarda],
    ...extra,
  }
}

/** As quatro paredes do lugar: a visão do herói não entra (a sala oculta de verdade tem parede). */
const PAREDES: Wall[] = LUGAR.map((a, i) => {
  const b = LUGAR[(i + 1) % LUGAR.length]
  return { id: `parede-${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null }
})

const zonaOculta: ConcealZone = { id: 'zona', name: 'nome-zona', revealed: false, points: LUGAR }

const lugares: { nome: string; mapa: () => MapData }[] = [
  { nome: 'zona oculta', mapa: () => cena({ concealZones: [zonaOculta] }) },
  { nome: 'sala oculta para jogadores', mapa: () => cena({ walls: PAREDES, regions: [sala('cripta', { secret: true })] }) },
  { nome: 'prédio de teto fechado', mapa: () => cena({ regions: [sala('casa', { room: { shape: 'rect', name: 'nome-casa', roof: true } })] }) },
]

describe('filterMapForPlayer — tocha afastada de ficha que o LUGAR esconde', () => {
  it('controle: sem nada escondendo, o guarda e a tocha dele chegam, com o vínculo', () => {
    const { map: out } = filterMapForPlayer(cena(), 'p1', OWNERSHIP, RADIUS)
    expect(out.tokens.map((t) => t.id).sort()).toEqual(['guarda', 'heroi'])
    expect(out.lights).toEqual([tochaDoGuarda])
  })

  it('controle: guarda só na NÉVOA (longe do raio) — a tocha à vista chega, sem o vínculo', () => {
    // Raio 300: o guarda (350 px) fica na névoa, a tocha (120 px) à vista.
    const { map: out } = filterMapForPlayer(cena(), 'p1', OWNERSHIP, 300)
    expect(out.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(out.lights).toEqual([{ id: 'tocha-do-guarda', x: TOCHA.x, y: TOCHA.y, radius: 80, color: '#f00', intensity: 1 }])
  })

  it('controle: guarda atrás de PAREDE numa sala comum (não oculta) — é névoa: a tocha à vista chega, sem o vínculo', () => {
    const { map: out } = filterMapForPlayer(cena({ walls: PAREDES, regions: [sala('sala-comum')] }), 'p1', OWNERSHIP, RADIUS)
    expect(out.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(out.lights).toEqual([{ id: 'tocha-do-guarda', x: TOCHA.x, y: TOCHA.y, radius: 80, color: '#f00', intensity: 1 }])
  })

  for (const lugar of lugares) {
    it(`SEGURANÇA: guarda em ${lugar.nome} — a tocha dele não sai, nem depois de ele andar`, () => {
      const antes = lugar.mapa()
      const depois = setTokenPosition(antes, 'guarda', GUARDA.x + 60, GUARDA.y)
      // A tocha andou junto no mapa do mestre: é esse passo que vazaria.
      expect(depois.lights[0]).toMatchObject({ x: TOCHA.x + 60, y: TOCHA.y, attachedTokenId: 'guarda' })
      for (const mapa of [antes, depois]) {
        const { map: out } = filterMapForPlayer(mapa, 'p1', OWNERSHIP, RADIUS)
        expect(out.tokens.map((t) => t.id)).toEqual(['heroi'])
        expect(out.lights).toEqual([])
        const json = JSON.stringify(out)
        for (const vazado of ['tocha-do-guarda', 'guarda']) expect(json).not.toContain(vazado)
      }
    })
  }
})
