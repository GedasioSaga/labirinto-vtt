import type { DoorState, MapData, Perigo, Region, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'

/**
 * Planta dos testes do PERIGO QUE SE ALASTRA (grade de 50 px):
 *
 *   Cozinha 0-300 | Corredor 300-600 | Adega 600-900    (y 0-300)
 *   Despensa 0-300                                        (y 300-600)
 *
 * Portas: Cozinha↔Corredor em x=300 (y 125-175), Corredor↔Adega em x=600
 * (y 125-175) e Cozinha↔Despensa em y=300 (x 125-175). Cada uma abre ou fecha
 * pelos parâmetros.
 */
export const COZINHA = 'r-cozinha'
export const CORREDOR = 'r-corredor'
export const ADEGA = 'r-adega'
export const DESPENSA = 'r-despensa'

export function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

export function porta(open: boolean): DoorState {
  return { open, locked: false, kind: 'normal' }
}

export function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

export function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

export interface OpcoesDaCasa {
  cozinhaCorredor?: boolean
  corredorAdega?: boolean
  cozinhaDespensa?: boolean
  despensaSecreta?: boolean
  perigos?: Perigo[]
  tokens?: Token[]
}

export function casa({
  cozinhaCorredor = true,
  corredorAdega = false,
  cozinhaDespensa = true,
  despensaSecreta = false,
  perigos,
  tokens = [],
}: OpcoesDaCasa = {}): MapData {
  const base: MapData = {
    ...createEmptyMap('map_casa', 'Casa', 20, 14, 50),
    walls: [
      parede('topo', 0, 0, 900, 0),
      parede('esquerda', 0, 0, 0, 600),
      parede('direita', 900, 0, 900, 300),
      parede('meio-1', 0, 300, 125, 300),
      parede('porta-cozinha-despensa', 125, 300, 175, 300, porta(cozinhaDespensa)),
      parede('meio-2', 175, 300, 900, 300),
      parede('x300-1', 300, 0, 300, 125),
      parede('porta-cozinha-corredor', 300, 125, 300, 175, porta(cozinhaCorredor)),
      parede('x300-2', 300, 175, 300, 300),
      parede('x600-1', 600, 0, 600, 125),
      parede('porta-da-adega', 600, 125, 600, 175, porta(corredorAdega)),
      parede('x600-2', 600, 175, 600, 300),
      parede('despensa-l', 300, 300, 300, 600),
      parede('despensa-s', 0, 600, 300, 600),
    ],
    regions: [
      sala(COZINHA, 'Cozinha', 0, 0, 300, 300),
      sala(CORREDOR, 'Corredor', 300, 0, 600, 300),
      sala(ADEGA, 'Adega', 600, 0, 900, 300),
      sala(DESPENSA, 'Despensa', 0, 300, 300, 600, despensaSecreta ? { secret: true } : {}),
    ],
    tokens,
  }
  return perigos === undefined ? base : { ...base, perigos }
}
