/**
 * LUZ L2 — vazamento à noite no recorte do jogador (pacote forjado: o mapa do
 * mestre montado à mão e passado direto a `filterMapForPlayer`). À noite a
 * visão cai para o raio do período e, além dele, só o claro das luzes na
 * linha de visão chega (`raioDaNoite`, o mesmo escuro de `darkVision`):
 *  - NPC no escuro a 8 casas NÃO chega;
 *  - NPC sob o lampião, com a linha de visão livre, chega;
 *  - luz atrás de parede não revela, nem a parede entre a luz e o NPC;
 *  - o VULTO (`shadowOfOtherPlayer`) não devolve o rótulo de quem a luz não
 *    alcança: a parede entre a luz e a ficha conta.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData, Token, Wall } from '../types/map'
import { filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const HEROI = { x: 1000, y: 1000 }
/** 3 casas: o raio da noite da cena. */
const NOITE = 150
const OITO_CASAS = 8 * GRID

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function luz(id: string, x: number, y: number, radius: number): Light {
  return { id, x, y, radius, color: '#ffb347', intensity: 0.8 }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function cena(tokens: Token[], lights: Light[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('vila', 'Vila', 40, 40, GRID), externa: true, tokens: [ficha('heroi', HEROI.x, HEROI.y), ...tokens], lights, walls }
}

const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }
const noite = raioDaNoite(() => NOITE)

function idsQueChegam(map: MapData, raio: number | ((id: string) => number) = noite, ownership = SO_ANA): string[] {
  return filterMapForPlayer(map, 'ana', ownership, raio)
    .map.tokens.map((t) => t.id)
    .sort()
}

describe('à noite: o escuro, o lampião e a parede (pacote forjado)', () => {
  it('NPC no escuro a 8 casas NÃO chega; nada dele no pacote', () => {
    const map = cena([ficha('lobo', HEROI.x + OITO_CASAS, HEROI.y)], [luz('longe', 200, 200, 100)])
    expect(idsQueChegam(map)).toEqual(['heroi'])
    expect(JSON.stringify(filterMapForPlayer(map, 'ana', SO_ANA, noite))).not.toContain('"lobo"')
  })

  it('NPC sob o lampião a 8 casas, com a linha de visão livre, chega', () => {
    const map = cena([ficha('guarda', HEROI.x, HEROI.y + OITO_CASAS)], [luz('lampiao', HEROI.x, HEROI.y + OITO_CASAS + 20, 100)])
    expect(idsQueChegam(map)).toEqual(['guarda', 'heroi'])
  })

  it('sem a noite (o mesmo raio, só que de dia curto), o lampião não muda nada: é a regra de antes', () => {
    const map = cena([ficha('guarda', HEROI.x, HEROI.y + OITO_CASAS)], [luz('lampiao', HEROI.x, HEROI.y + OITO_CASAS + 20, 100)])
    expect(idsQueChegam(map, NOITE)).toEqual(['heroi'])
  })

  it('luz atrás de parede não revela: nem o NPC, nem o desenho do claro do outro lado', () => {
    const muro = parede('muro', 800, 700, 800, 1300)
    const map = cena([ficha('ladrao', HEROI.x - OITO_CASAS, HEROI.y)], [luz('vela', HEROI.x - OITO_CASAS, HEROI.y, 120)], [muro])
    const view = filterMapForPlayer(map, 'ana', SO_ANA, noite)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(view.vision.flat().every((p) => p.x >= 799)).toBe(true)
  })

  it('parede entre a luz e o NPC: ele está no raio da luz, mas na sombra dela, e não chega', () => {
    // Lampião a leste do NPC, com um muro curto entre os dois; o herói vê o NPC (linha livre), a luz não.
    const map = cena([ficha('espia', HEROI.x, HEROI.y - OITO_CASAS)], [luz('lampiao', HEROI.x + 100, HEROI.y - OITO_CASAS, 150)], [parede('biombo', HEROI.x + 50, HEROI.y - OITO_CASAS - 60, HEROI.x + 50, HEROI.y - OITO_CASAS + 60)])
    expect(idsQueChegam(map)).toEqual(['heroi'])
  })

  it('raio 0 (a noite que apaga a visão): só a própria ficha, nem o claro do lampião', () => {
    const map = cena([ficha('guarda', HEROI.x, HEROI.y + OITO_CASAS)], [luz('lampiao', HEROI.x, HEROI.y + OITO_CASAS + 20, 100)])
    expect(idsQueChegam(map, raioDaNoite(() => 0))).toEqual(['heroi'])
  })
})

describe('à noite: o vulto de outro jogador não vira canal', () => {
  /** Raio da noite de 6 casas; a ficha do Bruno a 3/4 dele (vista, mas longe para o rótulo). */
  const RAIO = 300
  const BRUNO = { x: HEROI.x + 225, y: HEROI.y }
  const DOIS: Record<string, string[]> = { ana: ['heroi'], bruno: ['bruno'] }

  function nomeDoBruno(map: MapData, raio: number | ((id: string) => number)): string | undefined {
    return filterMapForPlayer(map, 'ana', DOIS, raio).map.tokens.find((t) => t.id === 'bruno')?.name
  }

  it('luz no raio dela, mas com parede entre a luz e o Bruno: chega como vulto (sem nome)', () => {
    const map = cena([ficha('bruno', BRUNO.x, BRUNO.y)], [luz('tocha', BRUNO.x, BRUNO.y + 100, 150)], [parede('cerca', BRUNO.x - 75, BRUNO.y + 50, BRUNO.x + 75, BRUNO.y + 50)])
    expect(nomeDoBruno(map, raioDaNoite(() => RAIO))).toBe('')
    // A mesma regra vale de dia (o vulto existe em cena escura desde antes da Luz).
    expect(nomeDoBruno(map, RAIO)).toBe('')
  })

  it('luz que alcança o Bruno sem parede no meio: o rótulo volta', () => {
    const map = cena([ficha('bruno', BRUNO.x, BRUNO.y)], [luz('tocha', BRUNO.x, BRUNO.y + 100, 150)])
    expect(nomeDoBruno(map, raioDaNoite(() => RAIO))).toBe('ficha-bruno')
  })
})
