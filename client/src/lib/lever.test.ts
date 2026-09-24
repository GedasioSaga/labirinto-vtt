/**
 * ALAVANCA: um pino do tipo alavanca ligado a uma porta do mesmo mapa (pode
 * ser de outra sala). Acionar abre ou fecha a porta ligada; porta trancada não
 * se move pela alavanca. Regras puras, compartilhadas pelo host, pelo painel
 * do mestre e pelo disco.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, Wall } from '../types/map'
import { LEVER_UNNAMED_DOOR, leverDoorOptions, linkedDoorOf, pullLever, readPinLeverDoor } from './lever'
import { buildPin, createEmptyMap } from './mapFactory'
import { isPinKind, PIN_KIND_ORDER, pinSummary } from './pins'
import { itemOfPin } from './items'
import { moveCrossesWall } from './collision'

function porta(id: string, extra: Partial<Wall> = {}, locked = false, open = false): Wall {
  return { id, x1: 500, y1: 0, x2: 500, y2: 1000, blocksLight: true, blocksMove: true, door: { open, locked, kind: 'normal' }, ...extra }
}

function parede(id: string): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null }
}

function sala(id: string, nome: string): Region {
  return { id, points: [], tag: '', fillColor: '#333', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: nome } }
}

function alavanca(extra: Partial<Pin> = {}): Pin {
  return { ...buildPin('alav', { x: 200, y: 200 }, 'alavanca'), portaLigada: 'porta-cripta', ...extra }
}

function mapa(walls: Wall[], pins: Pin[] = [alavanca()], regions: Region[] = []): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), walls, pins, regions }
}

describe('tipo alavanca', () => {
  it('é um tipo de pino reconhecido, depois dos três de sempre', () => {
    expect(isPinKind('alavanca')).toBe(true)
    expect(PIN_KIND_ORDER).toEqual(['exclamacao', 'interrogacao', 'viagem', 'alavanca'])
  })

  it('o resumo do mestre chama a alavanca pelo nome, não por um glifo', () => {
    expect(pinSummary(alavanca())).toBe('Alavanca')
    expect(pinSummary(alavanca({ description: 'Alavanca do portão' }))).toBe('Alavanca do portão')
  })

  it('alavanca nunca é item pegável, mesmo com item gravado', () => {
    expect(itemOfPin(alavanca({ item: { nome: 'Chave' } }))).toBeNull()
  })
})

describe('linkedDoorOf', () => {
  it('acha a porta ligada, com o estado dela', () => {
    const achada = linkedDoorOf(mapa([porta('porta-cripta')]), alavanca())
    expect(achada?.id).toBe('porta-cripta')
    expect(achada?.door.open).toBe(false)
  })

  it('sem ligação, ligada a parede sem porta, a porta apagada ou pino que não é alavanca: null', () => {
    expect(linkedDoorOf(mapa([porta('porta-cripta')]), alavanca({ portaLigada: undefined }))).toBeNull()
    expect(linkedDoorOf(mapa([parede('porta-cripta')]), alavanca())).toBeNull()
    expect(linkedDoorOf(mapa([]), alavanca())).toBeNull()
    expect(linkedDoorOf(mapa([porta('porta-cripta')]), alavanca({ kind: 'exclamacao' }))).toBeNull()
  })
})

describe('pullLever (o mestre aciona pelo painel)', () => {
  it('fechada abre, aberta fecha — e a colisão acompanha', () => {
    const fechada = mapa([porta('porta-cripta')])
    const aberta = pullLever(fechada, 'alav')
    const paredeAberta = aberta.walls.find((w) => w.id === 'porta-cripta')
    expect(paredeAberta?.door?.open).toBe(true)
    if (paredeAberta === undefined) throw new Error('sem porta')
    expect(moveCrossesWall({ x: 400, y: 500 }, { x: 600, y: 500 }, paredeAberta)).toBe(false)
    const deNovo = pullLever(aberta, 'alav')
    const paredeFechada = deNovo.walls.find((w) => w.id === 'porta-cripta')
    expect(paredeFechada?.door?.open).toBe(false)
    if (paredeFechada === undefined) throw new Error('sem porta')
    expect(moveCrossesWall({ x: 400, y: 500 }, { x: 600, y: 500 }, paredeFechada)).toBe(true)
  })

  it('porta trancada, alavanca sem porta ou pino inexistente: o MESMO mapa (nada muda)', () => {
    const trancada = mapa([porta('porta-cripta', {}, true)])
    expect(pullLever(trancada, 'alav')).toBe(trancada)
    const solta = mapa([porta('porta-cripta')], [alavanca({ portaLigada: undefined })])
    expect(pullLever(solta, 'alav')).toBe(solta)
    expect(pullLever(solta, 'nao-existe')).toBe(solta)
  })
})

describe('readPinLeverDoor (disco)', () => {
  it('só texto não vazio vale; o resto volta ausente', () => {
    expect(readPinLeverDoor('porta-cripta')).toBe('porta-cripta')
    expect(readPinLeverDoor('')).toBeUndefined()
    expect(readPinLeverDoor(42)).toBeUndefined()
    expect(readPinLeverDoor({ id: 'x' })).toBeUndefined()
    expect(readPinLeverDoor(undefined)).toBeUndefined()
  })
})

describe('leverDoorOptions (a lista "Abre a porta" do painel)', () => {
  it('só paredes com porta, numeradas na ordem do mapa, com o nome da sala quando há', () => {
    const map = mapa(
      [porta('p1', { regionId: 'sala-cripta' }), parede('muro'), porta('p2'), porta('p3', { regionId: 'sala-sem-nome' })],
      [],
      [sala('sala-cripta', 'Cripta'), sala('sala-sem-nome', '  ')],
    )
    expect(leverDoorOptions(map)).toEqual([
      { id: 'p1', label: 'Porta 1 · Cripta' },
      { id: 'p2', label: 'Porta 2' },
      { id: 'p3', label: 'Porta 3' },
    ])
  })

  it('mapa sem porta: lista vazia', () => {
    expect(leverDoorOptions(mapa([parede('muro')]))).toEqual([])
    expect(LEVER_UNNAMED_DOOR).toBe('Porta')
  })
})
