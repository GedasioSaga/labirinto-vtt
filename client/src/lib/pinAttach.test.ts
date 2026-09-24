import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { EMPTY_AREA_SELECTION, moveAreaSelection } from './areaSelection'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap, setTokenPosition, updatePin } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { carryAttachedPins, pinAttachOptions, readPinAttachment } from './pinAttach'

/**
 * PINO PRESO A UMA FICHA: o pino de viagem da prancha do navio (ou da porta da
 * carroça, do elevador) anda junto quando a ficha anda. Sem isto o mestre move
 * o navio e a passagem fica boiando no mar, onde ninguém a alcança.
 */

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `pino-${id}`, image: null, ...extra }
}

/** Campo aberto de 3000 x 500 px, sem parede. */
function campo(tokens: Token[], pins: Pin[]): MapData {
  return { ...createEmptyMap('m-porto', 'Porto de Vel', 60, 10, 50), tokens, pins }
}

function pino(map: MapData, id: string): Pin {
  const achado = map.pins.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`sem o pino ${id}`)
  return achado
}

describe('pino preso a uma ficha: anda junto', () => {
  it('mover a ficha leva o pino preso pelo mesmo tanto, e o pino solto fica', () => {
    const map = campo([ficha('navio', 300, 200)], [viagem('prancha', 320, 230, { presoA: 'navio' }), viagem('cais', 100, 100)])
    const depois = setTokenPosition(map, 'navio', 800, 150)
    expect(pino(depois, 'prancha')).toMatchObject({ x: 820, y: 180, presoA: 'navio' })
    expect(pino(depois, 'cais')).toMatchObject({ x: 100, y: 100 })
    // O mapa de antes não muda (imutável, como todo mapFactory).
    expect(pino(map, 'prancha')).toMatchObject({ x: 320, y: 230 })
  })

  it('mover OUTRA ficha não mexe no pino', () => {
    const map = campo([ficha('navio', 300, 200), ficha('bote', 50, 50)], [viagem('prancha', 320, 230, { presoA: 'navio' })])
    const depois = setTokenPosition(map, 'bote', 900, 400)
    expect(pino(depois, 'prancha')).toMatchObject({ x: 320, y: 230 })
  })

  it('arrastar a seleção com a ficha leva o pino preso junto (e o travado também)', () => {
    const map = campo([ficha('carroca', 300, 200)], [viagem('porta', 310, 200, { presoA: 'carroca', locked: true })])
    const depois = moveAreaSelection(map, { ...EMPTY_AREA_SELECTION, tokens: ['carroca'] }, 40, -20)
    expect(depois.tokens[0]).toMatchObject({ x: 340, y: 180 })
    expect(pino(depois, 'porta')).toMatchObject({ x: 350, y: 180 })
  })

  it('ficha travada não anda na seleção, e o pino preso a ela também não', () => {
    const map = campo([ficha('carroca', 300, 200, { locked: true })], [viagem('porta', 310, 200, { presoA: 'carroca' })])
    const depois = moveAreaSelection(map, { ...EMPTY_AREA_SELECTION, tokens: ['carroca'] }, 40, -20)
    expect(pino(depois, 'porta')).toMatchObject({ x: 310, y: 200 })
  })

  it('carryAttachedPins sem pino preso devolve o mesmo mapa (nenhum render acorda)', () => {
    const map = campo([ficha('navio', 300, 200)], [viagem('cais', 100, 100)])
    expect(carryAttachedPins(map, 'navio', 10, 10)).toBe(map)
    const preso = campo([ficha('navio', 300, 200)], [viagem('prancha', 100, 100, { presoA: 'navio' })])
    expect(carryAttachedPins(preso, 'navio', 0, 0)).toBe(preso)
  })

  it('prender e soltar pelo updatePin; repetir o mesmo valor não é mudança', () => {
    const map = campo([ficha('navio', 300, 200)], [viagem('prancha', 320, 230)])
    const preso = updatePin(map, 'prancha', { presoA: 'navio' })
    expect(pino(preso, 'prancha').presoA).toBe('navio')
    expect(updatePin(preso, 'prancha', { presoA: 'navio' })).toBe(preso)
    const solto = updatePin(preso, 'prancha', { presoA: undefined })
    expect(pino(solto, 'prancha').presoA).toBeUndefined()
    expect(pino(setTokenPosition(solto, 'navio', 900, 200), 'prancha')).toMatchObject({ x: 320, y: 230 })
  })
})

describe('pino preso a uma ficha: disco', () => {
  it('a ligação sobrevive a salvar e abrir', () => {
    const map = campo([ficha('navio', 300, 200)], [viagem('prancha', 320, 230, { presoA: 'navio' })])
    expect(pino(deserializeMap(serializeMap(map)), 'prancha').presoA).toBe('navio')
  })

  it('lixo editado à mão volta solto, sem derrubar o mapa', () => {
    expect(readPinAttachment('navio')).toBe('navio')
    expect(readPinAttachment(42)).toBeUndefined()
    expect(readPinAttachment('')).toBeUndefined()
    expect(readPinAttachment(undefined)).toBeUndefined()
    const cru = JSON.parse(serializeMap(campo([], [viagem('prancha', 1, 1)])))
    cru.pins[0].presoA = { navio: true }
    expect(pino(deserializeMap(JSON.stringify(cru)), 'prancha').presoA).toBeUndefined()
  })

  it('pino de mapa antigo (sem o campo) abre solto', () => {
    const map = campo([ficha('navio', 300, 200)], [viagem('prancha', 320, 230)])
    const aberto = deserializeMap(serializeMap(map))
    expect(pino(aberto, 'prancha').presoA).toBeUndefined()
    expect(pino(setTokenPosition(aberto, 'navio', 0, 0), 'prancha')).toMatchObject({ x: 320, y: 230 })
  })
})

describe('pino preso a uma ficha: o recorte do jogador', () => {
  it('o jogador vê o pino no lugar novo, e nunca a qual ficha ele está preso', () => {
    const map = campo([ficha('ana', 200, 250), ficha('navio', 400, 250)], [viagem('prancha', 420, 250, { presoA: 'navio' })])
    const depois = setTokenPosition(map, 'navio', 500, 250)
    const view = filterMapForPlayer(depois, 'p-ana', { 'p-ana': ['ana'] }, 700)
    expect(view.map.pins.map((p) => [p.id, p.x, p.y])).toEqual([['prancha', 520, 250]])
    expect(view.map.pins[0]).not.toHaveProperty('presoA')
    expect(JSON.stringify(view)).not.toContain('presoA')
  })

  it('ficha presa fora da visão: o pino não sai, mesmo no chão já explorado (contaria onde o navio está)', () => {
    // Ana enxerga 300 px e já explorou o campo inteiro. O navio parte de perto
    // dela para 2500 px, longe da visão. A boia (pino solto) ali perto sai pelo
    // explorado — é anotação parada; a prancha presa ao navio, não.
    const map = campo(
      [ficha('ana', 200, 250), ficha('navio', 400, 250)],
      [viagem('prancha', 420, 250, { presoA: 'navio' }), viagem('boia', 2400, 250)],
    )
    const longe = setTokenPosition(map, 'navio', 2500, 250)
    // Mesma régua do host: o explorado mede px de mundo, o mapa mede células.
    const explorado = createExploration({ width: longe.width * longe.grid, height: longe.height * longe.grid, grid: longe.grid })
    markAll(explorado)
    const view = filterMapForPlayer(longe, 'p-ana', { 'p-ana': ['ana'] }, 300, explorado)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['ana'])
    expect(view.map.pins.map((p) => p.id)).toEqual(['boia'])
    expect(JSON.stringify(view)).not.toContain('prancha')
  })

  it('ficha presa escondida pelo mestre: o pino dela também não sai', () => {
    const map = campo(
      [ficha('ana', 200, 250), ficha('navio', 400, 250, { secret: true })],
      [viagem('prancha', 420, 250, { presoA: 'navio' }), viagem('cais', 250, 250)],
    )
    const view = filterMapForPlayer(map, 'p-ana', { 'p-ana': ['ana'] }, 700)
    expect(view.map.pins.map((p) => p.id)).toEqual(['cais'])
  })

  it('controle: com a ficha à vista, o mesmo pino sai', () => {
    const map = campo([ficha('ana', 200, 250), ficha('navio', 400, 250)], [viagem('prancha', 420, 250, { presoA: 'navio' })])
    const view = filterMapForPlayer(map, 'p-ana', { 'p-ana': ['ana'] }, 700)
    expect(view.map.pins.map((p) => p.id)).toEqual(['prancha'])
  })

  it('pino preso a uma ficha que saiu da cena segue a regra de pino parado', () => {
    const map = campo([ficha('ana', 200, 250)], [viagem('prancha', 420, 250, { presoA: 'navio-que-partiu' })])
    const view = filterMapForPlayer(map, 'p-ana', { 'p-ana': ['ana'] }, 700)
    expect(view.map.pins.map((p) => p.id)).toEqual(['prancha'])
    expect(view.map.pins[0]).not.toHaveProperty('presoA')
  })
})

describe('pinAttachOptions', () => {
  it('lista as fichas do mapa pelo nome, na ordem do mapa; ficha sem nome ganha um rótulo', () => {
    expect(pinAttachOptions([ficha('navio', 0, 0, { name: 'Navio Negro' }), ficha('x', 0, 0, { name: '  ' })])).toEqual([
      { id: 'navio', label: 'Navio Negro' },
      { id: 'x', label: 'Ficha sem nome' },
    ])
    expect(pinAttachOptions([])).toEqual([])
  })
})
