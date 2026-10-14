import { folha, girassol, sorteio, type Flor } from './_girassol'

/**
 * Girassóis: um tufo de três em hastes de alturas diferentes (a flor em
 * `_girassol.ts`). A semente troca quem é o mais alto; o giro inclina as
 * hastes e gira as pétalas. A luz não gira.
 */

/** Alturas das três cabeças, em unidades; a semente reparte quem fica com cada uma. */
const ALTURAS = [0.74, 0.94, 0.82]

export default function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const flores: Flor[] = [-1, 0, 1].map((lado, i) => ({
    x: lado * 0.27 + Math.sin(giro + i * 2.1) * 0.05 + (sorteio(semente, i) - 0.5) * 0.06,
    y: -ALTURAS[(i + semente) % ALTURAS.length] - (sorteio(semente, i + 5) - 0.5) * 0.06,
    raio: 0.17 + 0.03 * sorteio(semente, i + 9),
    base: lado * 0.07,
    curva: lado * 0.04,
  }))
  // O pé de folhas no chão, que assenta o tufo.
  folha(g, -0.04, 0, Math.PI + 0.25, 0.2, 0.06)
  folha(g, 0.04, 0, -0.25, 0.19, 0.06)
  // A mais alta fica atrás: desenha primeiro.
  const ordem = flores.map((flor, indice) => ({ flor, indice })).sort((a, b) => a.flor.y - b.flor.y)
  for (const { flor, indice } of ordem) girassol(g, flor, giro * 1.7 + indice * 0.9)
  folha(g, -0.1, -0.02, Math.PI - 0.15, 0.17, 0.055)
}
