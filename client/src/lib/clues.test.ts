import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { HostWorld } from '../net/hostSession'
import type { PartyMember } from './party'
import type { Pin } from '../types/map'
import { pinMasterLabel } from './pins'
import { clueDotLabel, clueRows, cluesHeading, toggledAudience } from './clues'

/**
 * PAINEL PISTAS, lógica pura: uma linha por pino "!"/"?" de todas as cenas
 * abertas, com uma bolinha por jogador — vazia, recebeu ou leu — e a marca de
 * escondida quando o "Quem vê" do pino o deixa de fora.
 */

const pino = (id: string, kind: Pin['kind'], description: string, x = 100, y = 100): Pin => ({ id, x, y, kind, description, image: null })

const membro = (playerId: string, name: string, color: string | null): PartyMember => ({
  playerId,
  name,
  connected: true,
  sceneId: 'cena-sala',
  sceneName: 'Sala',
  token: color === null ? null : { id: `ficha-${playerId}`, color, x: 0, y: 0 },
  travelPending: false,
})

const MEMBROS = [membro('p-gabi', 'Gabi', '#aa3333'), membro('p-fabio', 'Fábio', '#3333aa'), membro('p-ana', 'Ana', null)]

function crime(): HostWorld {
  return {
    open: {
      sceneId: 'cena-sala',
      name: 'Sala',
      map: { ...createEmptyMap('m-sala', 'Sala', 20, 20, 50), pins: [pino('faca', 'exclamacao', 'Faca'), pino('porta', 'viagem', 'Escada')] },
    },
    background: [
      {
        sceneId: 'cena-andar',
        name: 'Andar de cima',
        map: { ...createEmptyMap('m-andar', 'Andar de cima', 20, 20, 50), pins: [pino('bilhete', 'interrogacao', '  Bilhete  ', 450, 320), pino('sem-texto', 'exclamacao', '')] },
      },
    ],
  }
}

describe('clueRows: as linhas do painel Pistas', () => {
  it('só "!" e "?" de todas as cenas, na ordem das cenas, com cena e posição para o "centrar"', () => {
    const rows = clueRows(crime(), MEMBROS, {}, {})
    expect(rows.map((r) => r.pinId)).toEqual(['faca', 'bilhete', 'sem-texto'])
    const bilhete = rows[1]
    expect(bilhete).toMatchObject({ pinId: 'bilhete', label: 'Bilhete', glyph: '?', sceneId: 'cena-andar', sceneName: 'Andar de cima', x: 450, y: 320 })
    // Sem descrição, o pino é nomeado como no resto do editor.
    expect(rows[2]?.label).toBe('Ponto de interesse !')
  })

  it('pino com nome só do mestre: a linha usa o mesmo nome da lista Pinos (pinMasterLabel), não a descrição', () => {
    const nomeado: Pin = { ...pino('faca', 'exclamacao', 'Lâmina suja de sangue seco'), nome: '  Faca  ' }
    const world: HostWorld = { open: { sceneId: 'cena-sala', name: 'Sala', map: { ...createEmptyMap('m', 'Sala', 10, 10, 50), pins: [nomeado, pino('bilhete', 'interrogacao', 'Bilhete')] } }, background: [] }
    const rows = clueRows(world, MEMBROS, {}, {})
    expect(rows.map((r) => r.label)).toEqual(['Faca', 'Bilhete'])
    expect(rows[0]?.label).toBe(pinMasterLabel(nomeado))
  })

  it('bolinha por jogador: Gabi leu, Fábio recebeu, Ana nada; na ordem da sala, com a cor da ficha', () => {
    const rows = clueRows(crime(), MEMBROS, { bilhete: { received: ['p-gabi', 'p-fabio'], read: ['p-gabi'] } }, {})
    const bilhete = rows.find((r) => r.pinId === 'bilhete')
    expect(bilhete?.dots).toEqual([
      { playerId: 'p-gabi', name: 'Gabi', color: '#aa3333', state: 'leu', hidden: false },
      { playerId: 'p-fabio', name: 'Fábio', color: '#3333aa', state: 'recebeu', hidden: false },
      { playerId: 'p-ana', name: 'Ana', color: null, state: 'nada', hidden: false },
    ])
  })

  it('"Quem vê" só com a Gabi: Fábio e Ana aparecem escondidos', () => {
    const rows = clueRows(crime(), MEMBROS, {}, { faca: ['p-gabi'] })
    expect(rows[0]?.dots.map((d) => d.hidden)).toEqual([false, true, true])
  })

  it('mapa solto: sem nome de cena', () => {
    const solto: HostWorld = { open: { sceneId: null, name: 'Mapa', map: { ...createEmptyMap('m', 'Mapa', 10, 10, 50), pins: [pino('faca', 'exclamacao', 'Faca')] } }, background: [] }
    expect(clueRows(solto, MEMBROS, {}, {})[0]).toMatchObject({ sceneId: null, sceneName: null })
  })
})

describe('toggledAudience: clicar na bolinha revela ou esconde', () => {
  const TODOS = ['p-gabi', 'p-fabio', 'p-ana']

  it('pino de todos: esconder da Ana deixa só os outros', () => {
    expect(toggledAudience(null, TODOS, 'p-ana')).toEqual(['p-gabi', 'p-fabio'])
  })

  it('escondido: revelar põe de volta; com todos de volta, a lista some (Todos)', () => {
    expect(toggledAudience(['p-gabi'], TODOS, 'p-ana')).toEqual(['p-gabi', 'p-ana'])
    expect(toggledAudience(['p-gabi', 'p-fabio'], TODOS, 'p-ana')).toBeNull()
  })

  it('esconder o último escolhido deixa a lista vazia (ninguém), não volta a Todos', () => {
    expect(toggledAudience(['p-gabi'], TODOS, 'p-gabi')).toEqual([])
  })
})

describe('textos do painel', () => {
  it('título com a contagem e o nome de cada bolinha', () => {
    expect(cluesHeading(7)).toBe('Pistas (7)')
    expect(clueDotLabel({ playerId: 'p', name: 'Gabi', color: null, state: 'leu', hidden: false })).toBe('Gabi: leu')
    expect(clueDotLabel({ playerId: 'p', name: 'Gabi', color: null, state: 'recebeu', hidden: false })).toBe('Gabi: recebeu')
    expect(clueDotLabel({ playerId: 'p', name: 'Ana', color: null, state: 'nada', hidden: true })).toBe('Ana: não recebeu, escondida')
  })
})
