import { folha, girassol, sorteio } from './_girassol'

/**
 * Girassol: um só, a mesma flor do tufo "Girassóis" (`_girassol.ts`). O giro
 * inclina a haste e gira as pétalas; a semente mexe um tanto na altura. A luz
 * não gira.
 */

export default function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.06
  // O pé de folhas no chão.
  folha(g, -0.02, 0, Math.PI + 0.25, 0.18, 0.055)
  folha(g, 0.02, 0, -0.25, 0.17, 0.055)
  girassol(
    g,
    {
      x: inclina,
      y: -0.88 - (sorteio(semente, 3) - 0.5) * 0.08,
      raio: 0.19 + 0.02 * sorteio(semente, 7),
      base: 0,
      curva: -inclina * 0.5,
    },
    giro * 1.7,
  )
}
