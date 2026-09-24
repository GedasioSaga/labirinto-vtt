import type { Hazard, MapData, Region, Token, Wall } from '../../types/map'
import { createEmptyMap } from '../mapFactory'

/**
 * Andar da TORRE para os testes da zona de perigo: três salas em fila, de
 * 500 × 400 px cada (grade de 50), ligadas por portas no meio das divisórias.
 *
 *   sala-a | porta-ab | sala-b | porta-bc | sala-c
 *
 * `porta-ab` nasce ABERTA e `porta-bc` FECHADA: o fogo que avança um passo
 * saindo da sala A toma a B e para na porta fechada.
 */
export const GRADE = 50

export function sala(id: string, x1: number, x2: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x1, y: 0 },
      { x: x2, y: 0 },
      { x: x2, y: 400 },
      { x: x1, y: 400 },
    ],
    tag: '',
    fillColor: '#3a3a3a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `nome-${id}` },
    ...extra,
  }
}

export function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

export function porta(id: string, x: number, open: boolean): Wall {
  return { ...parede(id, x, 150, x, 250), door: { open, locked: false, kind: 'normal' } }
}

/** Divisória em `x` com a porta no meio. */
function divisoria(prefixo: string, x: number, open: boolean): Wall[] {
  return [parede(`${prefixo}-1`, x, 0, x, 150), porta(`porta-${prefixo}`, x, open), parede(`${prefixo}-2`, x, 250, x, 400)]
}

export function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

export function zona(id: string, kind: Hazard['kind'], roomIds: string[]): Hazard {
  return { id, kind, roomIds }
}

export interface TorreOpcoes {
  abertaBC?: boolean
  tokens?: Token[]
  hazards?: Hazard[]
  regions?: Region[]
}

export function torre(opcoes: TorreOpcoes = {}, id = 'm-torre'): MapData {
  const base = createEmptyMap(id, 'Torre do Barão', 30, 8, GRADE)
  const map: MapData = {
    ...base,
    regions: opcoes.regions ?? [sala('sala-a', 0, 500), sala('sala-b', 500, 1000), sala('sala-c', 1000, 1500)],
    walls: [...divisoria('ab', 500, true), ...divisoria('bc', 1000, opcoes.abertaBC ?? false)],
    tokens: opcoes.tokens ?? [],
  }
  return opcoes.hazards === undefined ? map : { ...map, hazards: opcoes.hazards }
}
