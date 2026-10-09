/**
 * MAPA DE CONTINENTE — o recorte do jogador. O tipo da cena atravessa (é ele
 * que diz à tela para desenhar pino), e a cor do pino vai SÓ na ficha de
 * jogador que já atravessa: nada da lista de donos, nada de ficha na névoa.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { SIGNAL_NEUTRAL_COLOR, signalColor } from './signals'
import { coresDosPinos } from './marcadorDeContinente'

const RAIO = 400

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

const ANA = ficha('ana', 100, 100)
const BIA = ficha('bia', 200, 100, { color: '#9a5fd0' })
const CAIO = ficha('caio', 1400, 450) // longe, na névoa de quem está com a Ana
const NPC = ficha('npc', 150, 150)
const POSSE = { p1: ['ana'], p2: ['bia'], p3: ['caio'] }

function cena(extra: Partial<MapData> = {}, tokens: Token[] = [ANA, BIA, CAIO, NPC]): MapData {
  return { ...createEmptyMap('m-cont', 'Mundo', 30, 10, 50), tokens, ...extra }
}

const pinoDe = (map: MapData, id: string): string | undefined => map.tokens.find((t) => t.id === id)?.pino

describe('Continente no recorte do jogador', () => {
  it('o tipo da cena atravessa; a própria ficha sai com a cor automática do dono', () => {
    const view = filterMapForPlayer(cena({ continente: true }), 'p1', POSSE, RAIO)
    expect(view.map.continente).toBe(true)
    expect(pinoDe(view.map, 'ana')).toBe(signalColor('p1'))
  })

  it('a ficha do colega à vista sai com a cor dela (a "Cor" escolhida manda)', () => {
    const view = filterMapForPlayer(cena({ continente: true }), 'p1', POSSE, RAIO)
    expect(pinoDe(view.map, 'bia')).toBe('#9a5fd0')
  })

  it('NPC continua ficha: nenhum pino nele', () => {
    const view = filterMapForPlayer(cena({ continente: true }), 'p1', POSSE, RAIO)
    expect(view.map.tokens.some((t) => t.id === 'npc')).toBe(true)
    expect(pinoDe(view.map, 'npc')).toBeUndefined()
  })

  it('ficha na névoa não sai — nem a cor do pino dela, nem o id do dono em lugar nenhum', () => {
    const view = filterMapForPlayer(cena({ continente: true }), 'p1', POSSE, RAIO)
    expect(view.map.tokens.some((t) => t.id === 'caio')).toBe(false)
    const texto = JSON.stringify(view.map)
    expect(texto).not.toContain('"caio"')
    for (const dono of ['p1', 'p2', 'p3']) expect(texto).not.toContain(`"${dono}"`)
  })

  it('ficha de colega disfarçada (outro nome para os jogadores) sai como ficha comum: o pino entregaria o dono', () => {
    const disfarcada = { ...BIA, publicName: 'Encapuzado' }
    const view = filterMapForPlayer(cena({ continente: true }, [ANA, disfarcada, NPC]), 'p1', POSSE, RAIO)
    expect(pinoDe(view.map, 'bia')).toBeUndefined()
    // A própria ficha disfarçada continua pino para o dono: ele sabe que é ele.
    const dele = filterMapForPlayer(cena({ continente: true }, [ANA, disfarcada, NPC]), 'p2', POSSE, RAIO)
    expect(pinoDe(dele.map, 'bia')).toBe('#9a5fd0')
  })

  it('ficha de colega em VULTO (longe de toda ficha minha e fora de toda luz) sai sem pino: a cor do dono é o que o vulto esconde', () => {
    // 350 px da Ana: além de metade do raio (200), ainda dentro da visão (400). Sem luz no mapa.
    const longe = { ...BIA, x: 450, y: 100 }
    const view = filterMapForPlayer(cena({ continente: true }, [ANA, longe, NPC]), 'p1', POSSE, RAIO)
    const vulto = view.map.tokens.find((t) => t.id === 'bia')
    expect(vulto).toBeDefined()
    expect(vulto?.name).toBe('')
    expect(vulto?.pino).toBeUndefined()
    expect(JSON.stringify(view.map)).not.toContain(signalColor('p2'))
  })

  it('ficha de colega sem nome para a mesa (publicName null) sai como ficha comum, sem pino', () => {
    const semNome = { ...BIA, color: undefined, publicName: null }
    const view = filterMapForPlayer(cena({ continente: true }, [ANA, semNome, NPC]), 'p1', POSSE, RAIO)
    expect(view.map.tokens.some((t) => t.id === 'bia')).toBe(true)
    expect(pinoDe(view.map, 'bia')).toBeUndefined()
    expect(JSON.stringify(view.map)).not.toContain(signalColor('p2'))
  })

  it('cena Normal: nem o campo, nem pino em ficha nenhuma', () => {
    const view = filterMapForPlayer(cena(), 'p1', POSSE, RAIO)
    expect('continente' in view.map).toBe(false)
    expect(view.map.tokens.every((t) => t.pino === undefined)).toBe(true)
  })

  it('a cor gravada por engano no mapa do mestre nunca atravessa: só a do recorte', () => {
    const view = filterMapForPlayer(cena({}, [{ ...ANA, pino: '#000000' }, NPC]), 'p1', POSSE, RAIO)
    expect(pinoDe(view.map, 'ana')).toBeUndefined()
  })

  it('tela da mesa: o pino sai sem a cor de cada jogador (a neutra), e a "Cor" escolhida vale', () => {
    const map = cena({ continente: true })
    const view = filterMapForGroup(
      map,
      [{ tokenIds: ['ana', 'bia'], visionRadius: RAIO }],
      undefined,
      undefined,
      undefined,
      { pinoOf: coresDosPinos(map, POSSE, { corDoDono: false }) },
    )
    expect(pinoDe(view.map, 'ana')).toBe(SIGNAL_NEUTRAL_COLOR)
    expect(pinoDe(view.map, 'bia')).toBe('#9a5fd0')
  })

  it('mapa-mundi antigo (caravana sem o campo novo) sai Continente, com a caravana como pino neutro', () => {
    const view = filterMapForPlayer(cena({ worldMap: true }), 'p1', POSSE, RAIO)
    expect(view.map.continente).toBe(true)
    expect(pinoDe(view.map, 'caravana')).toBe(SIGNAL_NEUTRAL_COLOR)
  })
})
