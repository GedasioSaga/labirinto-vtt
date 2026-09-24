/**
 * MARCA DE COMPANHEIRO, lado do RECORTE: a ficha de OUTRO jogador chega com o
 * nome e a cor dele (`companion`), e é isso que a separa de NPC na tela. A
 * marca só vai em ficha que o jogador já recebe: ficha na névoa, secreta ou em
 * zona oculta não sai, e o nome do dono dela também não.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, Token, TokenCompanion } from '../types/map'
import { filterMapForPlayer, type CompanionMarks } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { signalColor } from './signals'

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

/** Mesa de 3: a Duda (p1) olha; o Caio (p2) e a Bia (p3) são os outros jogadores. */
const MARCAS: CompanionMarks = new Map<string, TokenCompanion>([
  ['p1', { name: 'Duda', color: signalColor('p1') }],
  ['p2', { name: 'Caio', color: signalColor('p2') }],
  ['p3', { name: 'Bia', color: signalColor('p3') }],
])

const POSSE: Record<string, string[]> = { p1: ['duda'], p2: ['caio'], p3: ['bia'] }

/** Salão aberto de 20 x 20 casas (50 px), sem parede: a Duda enxerga até 700 px. */
function salao(tokens: Token[], concealZones: ConcealZone[] = []) {
  return { ...createEmptyMap('m-salao', 'Salão', 20, 20, 50), tokens, concealZones }
}

function recorte(tokens: Token[], concealZones: ConcealZone[] = []) {
  return filterMapForPlayer(salao(tokens, concealZones), 'p1', POSSE, 700, undefined, undefined, undefined, undefined, undefined, MARCAS)
}

function fichaNoRecorte(tokens: Token[], id: string, concealZones: ConcealZone[] = []): Token | undefined {
  return recorte(tokens, concealZones).map.tokens.find((t) => t.id === id)
}

describe('filterMapForPlayer: marca de companheiro', () => {
  it('a ficha do Caio, à vista, chega com o nome e a cor de sinal do Caio', () => {
    const caio = fichaNoRecorte([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100)], 'caio')
    expect(caio?.name).toBe('Ladino')
    expect(caio?.companion).toEqual({ name: 'Caio', color: signalColor('p2') })
  })

  it('NPC à vista (ficha sem dono) não ganha marca: é isso que o separa do companheiro', () => {
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('guarda', 'Guarda', 300, 100, { npc: true })])
    const guarda = view.map.tokens.find((t) => t.id === 'guarda')
    expect(guarda?.name).toBe('Guarda')
    expect(guarda !== undefined && 'companion' in guarda).toBe(false)
  })

  it('a própria ficha não ganha marca: ela já tem o aro de dono', () => {
    const duda = fichaNoRecorte([ficha('duda', 'Duda', 100, 100)], 'duda')
    expect(duda?.id).toBe('duda')
    expect(duda !== undefined && 'companion' in duda).toBe(false)
  })

  it('marca forjada no mapa do mestre não atravessa: NPC com `companion` gravado sai sem ele', () => {
    const forjada = ficha('guarda', 'Guarda', 300, 100, { companion: { name: 'Caio', color: '#e57373' } })
    const guarda = fichaNoRecorte([ficha('duda', 'Duda', 100, 100), forjada], 'guarda')
    expect(guarda?.id).toBe('guarda')
    expect(guarda !== undefined && 'companion' in guarda).toBe(false)
  })

  it('nome disfarçado ("Nome para os jogadores" = outro): a ficha sai com o disfarce e SEM a marca — o dono por trás não vaza', () => {
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100, { publicName: 'Mensageiro' })])
    const caio = view.map.tokens.find((t) => t.id === 'caio')
    expect(caio?.name).toBe('Mensageiro')
    expect(caio !== undefined && 'companion' in caio).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Caio')
    expect(JSON.stringify(view)).not.toContain(signalColor('p2'))
  })

  it('nome apagado ("Nome para os jogadores" = nenhum): a ficha sai sem nome e SEM a marca no lugar dele', () => {
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100, { publicName: null })])
    const caio = view.map.tokens.find((t) => t.id === 'caio')
    expect(caio?.name).toBe('')
    expect(caio !== undefined && 'companion' in caio).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Caio')
  })

  it('"Nome para os jogadores" = o mesmo (campo ausente): a marca continua saindo', () => {
    const caio = fichaNoRecorte([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100)], 'caio')
    expect(caio?.name).toBe('Ladino')
    expect(caio?.companion).toEqual({ name: 'Caio', color: signalColor('p2') })
  })

  it('disfarce numa ficha só: a outra ficha do Caio, sem disfarce, continua com a marca', () => {
    const posse = { ...POSSE, p2: ['caio', 'caio-2'] }
    const mapa = salao([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100), ficha('caio-2', 'Corvo', 400, 100, { publicName: 'Pássaro' })])
    const view = filterMapForPlayer(mapa, 'p1', posse, 700, undefined, undefined, undefined, undefined, undefined, MARCAS)
    const tokens = new Map(view.map.tokens.map((t) => [t.id, t]))
    expect(tokens.get('caio')?.companion).toEqual({ name: 'Caio', color: signalColor('p2') })
    expect(tokens.get('caio-2')?.name).toBe('Pássaro')
    expect(tokens.get('caio-2')?.companion).toBeUndefined()
  })

  it('sem a lista de companheiros (quem chama não é o fio), nenhuma ficha ganha marca', () => {
    const view = filterMapForPlayer(salao([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100)]), 'p1', POSSE, 700)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['caio', 'duda'])
    expect(view.map.tokens.some((t) => 'companion' in t)).toBe(false)
  })
})

describe('filterMapForPlayer: o nome do companheiro NÃO chega pelo que o jogador não vê', () => {
  it('ficha do Caio longe, na névoa: nem a ficha nem o nome "Caio" saem', () => {
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 950, 950)])
    expect(view.map.tokens.map((t) => t.id)).toEqual(['duda'])
    expect(JSON.stringify(view)).not.toContain('Caio')
  })

  it('ficha secreta da Bia, à vista: nem a ficha nem o nome "Bia" saem', () => {
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('bia', 'Clériga', 300, 100, { secret: true })])
    expect(view.map.tokens.map((t) => t.id)).toEqual(['duda'])
    expect(JSON.stringify(view)).not.toContain('Bia')
  })

  it('ficha escondida pelo mestre (oculta no editor): nem a ficha nem o nome saem', () => {
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('bia', 'Clériga', 300, 100, { hidden: true })])
    expect(view.map.tokens.map((t) => t.id)).toEqual(['duda'])
    expect(JSON.stringify(view)).not.toContain('Bia')
  })

  it('ficha do Caio dentro de zona oculta ativa: nem a ficha nem o nome saem', () => {
    const zona: ConcealZone = {
      id: 'z1',
      points: [
        { x: 250, y: 50 },
        { x: 400, y: 50 },
        { x: 400, y: 200 },
        { x: 250, y: 200 },
      ],
      name: 'Esconderijo',
      revealed: false,
    }
    const view = recorte([ficha('duda', 'Duda', 100, 100), ficha('caio', 'Ladino', 300, 100)], [zona])
    expect(view.map.tokens.map((t) => t.id)).toEqual(['duda'])
    expect(JSON.stringify(view)).not.toContain('Caio')
  })
})
