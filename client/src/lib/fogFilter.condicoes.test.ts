/**
 * CONDIÇÃO NA FICHA no RECORTE DO JOGADOR. A condição atravessa junto com a
 * ficha que o jogador pode ver — a dele ou a de outro na visão dele —, e SÓ
 * com ela: ficha no escuro, atrás de parede, "Oculta para jogadores", oculta
 * no editor ou dentro de zona oculta não leva a condição para a rede. E o
 * campo só leva os ids da lista: texto que o mestre (ou o arquivo) enfiar ali
 * não chega a ninguém.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Token, TokenCondition, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Duas salas separadas por uma parede em x=500. `heroi` é do p1. */
function mesa(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), walls: [parede('divisoria', 500, 0, 500, 1000)], tokens, ...extra }
}

const DONOS = { p1: ['heroi'] }
const RAIO = 700

function recorte(map: MapData) {
  return filterMapForPlayer(map, 'p1', DONOS, RAIO).map
}

function condicoesDe(map: MapData, id: string): TokenCondition[] | undefined {
  return map.tokens.find((t) => t.id === id)?.conditions
}

describe('filterMapForPlayer — condição na ficha', () => {
  it('a condição da PRÓPRIA ficha e a de outra ficha à vista chegam ao jogador', () => {
    const out = recorte(mesa([ficha('heroi', 200, 200, { conditions: ['envenenado'] }), ficha('ogro', 300, 250, { conditions: ['caido'] })]))
    expect(condicoesDe(out, 'heroi')).toEqual(['envenenado'])
    expect(condicoesDe(out, 'ogro')).toEqual(['caido'])
  })

  it('ficha atrás da parede não chega, e a condição dela não aparece em lugar nenhum do pacote', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('espiao', 800, 200, { conditions: ['dormindo'] })]), 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('dormindo')
  })

  it('ficha "Oculta para jogadores" na mesma sala: nem ela nem a condição dela', () => {
    const out = recorte(mesa([ficha('heroi', 200, 200), ficha('traidor', 250, 220, { secret: true, conditions: ['invisivel'] })]))
    expect(JSON.stringify(out)).not.toContain('traidor')
    expect(JSON.stringify(out)).not.toContain('invisivel')
  })

  it('ficha oculta no editor: nem ela nem a condição dela', () => {
    const out = recorte(mesa([ficha('heroi', 200, 200), ficha('fantasma', 220, 200, { hidden: true, conditions: ['atordoado'] })]))
    expect(JSON.stringify(out)).not.toContain('atordoado')
  })

  it('ficha dentro de zona oculta ativa: a condição só chega depois de o mestre revelar a zona', () => {
    const zona = (revealed: boolean): ConcealZone => ({
      id: 'zona',
      name: 'zona',
      revealed,
      points: [{ x: 260, y: 220 }, { x: 360, y: 220 }, { x: 360, y: 300 }, { x: 260, y: 300 }],
    })
    const fichas = [ficha('heroi', 200, 200), ficha('emboscada', 300, 250, { conditions: ['atordoado'] })]
    expect(JSON.stringify(recorte(mesa(fichas, { concealZones: [zona(false)] })))).not.toContain('atordoado')
    expect(condicoesDe(recorte(mesa(fichas, { concealZones: [zona(true)] })), 'emboscada')).toEqual(['atordoado'])
  })

  it('só os ids da lista atravessam: anotação do mestre escondida no campo fica na máquina dele', () => {
    const suja = { ...ficha('ogro', 300, 250), conditions: ['caido', 'e o assassino do barão'] as unknown as TokenCondition[] }
    const out = recorte(mesa([ficha('heroi', 200, 200), suja]))
    expect(condicoesDe(out, 'ogro')).toEqual(['caido'])
    expect(JSON.stringify(out)).not.toContain('barão')
  })

  it('campo sem nenhum id válido não viaja (nem vazio, nem cru)', () => {
    const suja = { ...ficha('ogro', 300, 250), conditions: ['segredo'] as unknown as TokenCondition[] }
    const out = recorte(mesa([ficha('heroi', 200, 200), suja]))
    const ogro = out.tokens.find((t) => t.id === 'ogro')
    expect(ogro).toBeDefined()
    expect(ogro !== undefined && 'conditions' in ogro).toBe(false)
  })
})
