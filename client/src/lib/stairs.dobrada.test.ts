import { describe, expect, it } from 'vitest'
import { createEmptyMap, setStairLength, setStairShape, setStairStepWidth } from './mapFactory'
import { ehEscadaDobrada, planoDaEscadaDobrada, segmentosDaForma } from './stairs'
import type { MapData, Stair, StairSegment } from '../types/map'

/**
 * ESCADARIA DE DOIS LANCES (lote de referências de 15/11/2026): "Em L" e "Em U"
 * na ficha da escada. A boca não sai do lugar, o caminho guarda o comprimento
 * e a U segue com os dois lances encostados quando a largura muda.
 */

const GRID = 50
const RETA: Stair = { id: 'e', shape: 'straight', direction: 'up', segments: [{ x1: 100, y1: 400, x2: 100, y2: 200 }], stepWidth: GRID }

function mapa(escada: Stair = RETA): MapData {
  return { ...createEmptyMap('m', 'Casa', 20, 20, GRID), stairs: [escada] }
}

function escadaDe(map: MapData): Stair {
  const [escada] = map.stairs
  if (escada === undefined) throw new Error('sem escada')
  return escada
}

function perto(a: readonly StairSegment[], b: readonly StairSegment[]): void {
  expect(a).toHaveLength(b.length)
  a.forEach((s, i) => {
    for (const chave of ['x1', 'y1', 'x2', 'y2'] as const) expect(s[chave]).toBeCloseTo(b[i][chave], 6)
  })
}

describe('escada em L e em U', () => {
  it('a reta dobra em L e em U com a boca parada, e volta a ser a mesma reta', () => {
    const emL = escadaDe(setStairShape(mapa(), 'e', 'l'))
    // Sobe 100 até o meio do patamar e vira para a direita de quem sobe (leste), mais 100.
    perto(emL.segments, [
      { x1: 100, y1: 400, x2: 100, y2: 300 },
      { x1: 100, y1: 300, x2: 200, y2: 300 },
    ])
    const emU = escadaDe(setStairShape(mapa(), 'e', 'double'))
    // Na U o patamar atravessa uma largura (50) e o segundo lance desce de volta, encostado no primeiro.
    perto(emU.segments, [
      { x1: 100, y1: 400, x2: 100, y2: 300 },
      { x1: 100, y1: 300, x2: 150, y2: 300 },
      { x1: 150, y1: 300, x2: 150, y2: 400 },
    ])
    perto(escadaDe(setStairShape(mapa(emL), 'e', 'straight')).segments, RETA.segments)
    perto(escadaDe(setStairShape(mapa(emU), 'e', 'straight')).segments, RETA.segments)
    // Da L para a U direto: os mesmos braços.
    perto(escadaDe(setStairShape(mapa(emL), 'e', 'double')).segments, emU.segments)
    // Entre a reta e a espiral nada muda de lugar, como antes.
    expect(segmentosDaForma(RETA, 'spiral')).toBe(RETA.segments)
  })

  it('subindo, o patamar de chegada fica na ponta; descendo, na boca; a volta é patamar nas duas', () => {
    const emL = escadaDe(setStairShape(mapa(), 'e', 'l'))
    const sobe = planoDaEscadaDobrada(emL)
    expect(sobe?.lances.map((l) => l.patamarNoTopo)).toEqual([false, true])
    // Os lances param meia largura antes do meio do patamar: o quadrado da volta fica sem degrau.
    perto(sobe?.lances.map((l) => l.segmento) ?? [], [
      { x1: 100, y1: 400, x2: 100, y2: 325 },
      { x1: 125, y1: 300, x2: 200, y2: 300 },
    ])
    expect(planoDaEscadaDobrada({ ...emL, direction: 'down' })?.lances.map((l) => l.patamarNoTopo)).toEqual([true, false])
    // O contorno é a L inteira, com a quina de dentro em (75, 325).
    expect(sobe?.contorno(0)).toEqual([
      { x: 75, y: 400 },
      { x: 75, y: 275 },
      { x: 200, y: 275 },
      { x: 200, y: 325 },
      { x: 125, y: 325 },
      { x: 125, y: 400 },
    ])
    expect(sobe?.divisa).toBeNull()
    expect(planoDaEscadaDobrada(escadaDe(setStairShape(mapa(), 'e', 'double')))?.divisa).toEqual([
      { x: 125, y: 400 },
      { x: 125, y: 325 },
    ])
    // A forma 'l' de um lance só (arquivo de antes) continua desenhada como lance reto.
    expect(planoDaEscadaDobrada({ ...RETA, shape: 'l' })).toBeNull()
  })

  it('na U, a largura e o comprimento mexem nos braços sem descolar os dois lances', () => {
    const emU = setStairShape(mapa(), 'e', 'double')
    const larga = escadaDe(setStairStepWidth(emU, 'e', 100))
    perto(larga.segments, [
      { x1: 100, y1: 400, x2: 100, y2: 300 },
      { x1: 100, y1: 300, x2: 200, y2: 300 },
      { x1: 200, y1: 300, x2: 200, y2: 400 },
    ])
    expect(ehEscadaDobrada(larga)).toBe(true)
    // Comprimento de ponta a ponta 350 (travessa de 50 incluída): cada braço vai a 150.
    const comprida = escadaDe(setStairLength(emU, 'e', 350))
    perto(comprida.segments, [
      { x1: 100, y1: 400, x2: 100, y2: 250 },
      { x1: 100, y1: 250, x2: 150, y2: 250 },
      { x1: 150, y1: 250, x2: 150, y2: 400 },
    ])
  })
})
