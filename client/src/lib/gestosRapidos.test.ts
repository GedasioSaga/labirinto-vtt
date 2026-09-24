import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Token, Wall } from '../types/map'
import { addToken, addWall, buildConcealZoneFromDraft, addConcealZone, createEmptyMap, setItemSecret } from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'
import { findConcealZoneForSelect, findDoorAt } from './selectionHitTest'
import { selectionSecretState, setSelectionSecret } from './batchSecret'
import type { SelectionSet } from './selectionModel'

/**
 * GESTOS RÁPIDOS DO EDITOR (backlog da simulação de 7 jogadores, 22/09/2026):
 * porta pelo clique direito, zona oculta na frente da sala no Selecionar e
 * "Oculto para jogadores" em lote. Aqui mora a parte pura de cada gesto — o
 * canvas só pergunta a estas funções o que está sob o ponteiro.
 */

const TRANCADA: DoorState = { open: false, locked: true, kind: 'normal' }
const PORTA: Wall = { id: 'porta', x1: 100, y1: 0, x2: 150, y2: 0, blocksLight: true, blocksMove: true, door: TRANCADA }
const PAREDE: Wall = { id: 'parede', x1: 0, y1: 100, x2: 200, y2: 100, blocksLight: true, blocksMove: true, door: null }

function guarda(id: string, x: number, secret?: boolean, y = 25): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, color: '#cc3333', ...(secret === undefined ? {} : { secret }) }
}

function mapaBase(): MapData {
  return createEmptyMap('m', 'Vila', 20, 20, 50)
}

describe('findDoorAt — clique direito acha a porta, nunca a parede lisa', () => {
  const mapa = addWall(addWall(mapaBase(), PORTA), PAREDE)

  it('em cima da porta devolve a porta; na parede lisa e no vazio, nada', () => {
    expect(findDoorAt(mapa, { x: 125, y: 3 })?.id).toBe('porta')
    expect(findDoorAt(mapa, { x: 50, y: 100 })).toBeNull()
    expect(findDoorAt(mapa, { x: 400, y: 400 })).toBeNull()
  })

  it('porta em camada oculta não responde ao clique', () => {
    const escondida: MapData = { ...mapa, hiddenLayers: ['portas'] }
    expect(findDoorAt(escondida, { x: 125, y: 0 })).toBeNull()
    expect(findDoorAt(mapa, { x: 125, y: 0 })?.door).toEqual(TRANCADA)
  })
})

describe('findConcealZoneForSelect — o tapete sobre a sala é a zona, não a sala', () => {
  const sala = buildRoomFromDraft('sala', ['p1', 'p2', 'p3', 'p4'], { x: 0, y: 0 }, { x: 400, y: 400 }, '#555555', 'solid')
  const comSala: MapData = { ...mapaBase(), walls: sala.walls, regions: [sala.region] }
  const tapete = buildConcealZoneFromDraft('tapete', { x: 100, y: 100 }, { x: 200, y: 200 })
  const mapa = addConcealZone(comSala, tapete)

  it('dentro da zona que está sobre a sala: a zona vence', () => {
    expect(findConcealZoneForSelect(mapa, { x: 150, y: 150 })?.id).toBe('tapete')
  })

  it('fora da zona: nada (a sala segue com o clique)', () => {
    expect(findConcealZoneForSelect(mapa, { x: 300, y: 300 })).toBeNull()
  })

  it('ficha dentro da zona continua ganhando o clique: a zona só passa na frente de sala e chão', () => {
    const comFicha = addToken(mapa, guarda('guarda', 150, undefined, 150))
    expect(findConcealZoneForSelect(comFicha, { x: 150, y: 150 })).toBeNull()
    expect(findConcealZoneForSelect(comFicha, { x: 150, y: 190 })?.id).toBe('tapete')
  })
})

describe('Oculto para jogadores em lote', () => {
  const quatro: SelectionSet = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ kind: 'token', id }))
  const comGuardas = (secretos: readonly string[]): MapData =>
    ['g1', 'g2', 'g3', 'g4'].reduce(
      (mapa, id, i) => addToken(mapa, guarda(id, 100 + i * 50, secretos.includes(id) ? true : undefined)),
      mapaBase(),
    )

  it('três estados: nenhum, todos e misturado, com a contagem dos itens que aceitam', () => {
    expect(selectionSecretState(comGuardas([]), quatro)).toEqual({ state: 'none', count: 4 })
    expect(selectionSecretState(comGuardas(['g1', 'g2', 'g3', 'g4']), quatro)).toEqual({ state: 'all', count: 4 })
    expect(selectionSecretState(comGuardas(['g2']), quatro)).toEqual({ state: 'mixed', count: 4 })
  })

  it('parede não tem "oculto": não conta, e seleção só de paredes não oferece o controle', () => {
    const mapa = addWall(comGuardas([]), PAREDE)
    const misturada: SelectionSet = [...quatro, { kind: 'wall', id: 'parede' }]
    expect(selectionSecretState(mapa, misturada)).toEqual({ state: 'none', count: 4 })
    expect(selectionSecretState(mapa, [{ kind: 'wall', id: 'parede' }])).toBeNull()
  })

  it('marca os 4 de uma vez, deixa o que já estava marcado como estava e não toca no resto', () => {
    const antes = comGuardas(['g2'])
    const depois = setSelectionSecret(antes, quatro, true)
    expect(depois.tokens.map((t) => t.secret === true)).toEqual([true, true, true, true])
    expect(depois.tokens.find((t) => t.id === 'g2')).toBe(antes.tokens.find((t) => t.id === 'g2'))
    const desmarcado = setSelectionSecret(depois, quatro, false)
    expect(desmarcado.tokens.every((t) => t.secret !== true)).toBe(true)
  })

  it('nada a mudar devolve o MESMO mapa (não gasta desfazer)', () => {
    const todos = comGuardas(['g1', 'g2', 'g3', 'g4'])
    expect(setSelectionSecret(todos, quatro, true)).toBe(todos)
    expect(setItemSecret(todos, 'token', 'g1', true)).toBe(todos)
  })
})
