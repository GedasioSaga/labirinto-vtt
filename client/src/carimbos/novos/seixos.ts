import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Seixos de rio (item 130 dos carimbos de 14/11/2026): um punhado de
 * pedrinhas roladas pela água, lisas e ovais, de cores misturadas (cinza,
 * cinza-azulado, ocre, ferrugem e uma ou outra de quartzo claro). O que as
 * separa das Pedras da serra (três blocos lascados, facetados) é a forma:
 * aqui são muitas, pequenas e redondas. Cada seixo é um domo baixo em
 * camadas chapadas: o corpo no tom escuro (a borda de baixo, que se vê de
 * frente, e a da direita ficam na sombra), a face de cima no meio-tom, o
 * claro no alto à esquerda e o brilho molhado. O giro gira o punhado e o
 * comprido de cada seixo; a luz não gira.
 */

interface Tons {
  readonly escura: Rgb
  readonly meia: Rgb
  readonly clara: Rgb
}

const CINZA: Tons = { escura: [104, 104, 98], meia: [150, 148, 138], clara: [192, 190, 178] }
const AZULADO: Tons = { escura: [90, 100, 104], meia: [130, 142, 144], clara: [176, 186, 186] }
const OCRE: Tons = { escura: [118, 96, 72], meia: [166, 140, 108], clara: [204, 184, 152] }
const FERRUGEM: Tons = { escura: [112, 80, 66], meia: [156, 114, 92], clara: [194, 158, 136] }
const QUARTZO: Tons = { escura: [146, 138, 124], meia: [196, 190, 174], clara: [226, 222, 210] }
const BRILHO_MOLHADO: Rgb = [234, 234, 226]

/** O sorteio das cores: o cinza vem mais, o quartzo é raro. */
const TIPOS: readonly Tons[] = [CINZA, CINZA, AZULADO, AZULADO, OCRE, FERRUGEM, CINZA, QUARTZO]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
const QUANTOS = 10
const RAIO_DO_PUNHADO = 0.34
const ANGULO_DE_OURO = 2.39996

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, inclina: number, cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  g.ellipse(x, y, rx, ry, inclina, 0, Math.PI * 2)
  g.fill()
}

interface Seixo {
  readonly x: number
  readonly y: number
  readonly r: number
  /** O achatado do oval na tela (altura / largura). */
  readonly k: number
  readonly inclina: number
  readonly tons: Tons
  readonly molhado: boolean
}

function desenharSeixo(g: CanvasRenderingContext2D, s: Seixo): void {
  const { x, y, r, k, inclina, tons } = s
  const ry = r * k
  // A espessura do domo, que aparece embaixo (o lado de frente).
  const alto = r * 0.2
  oval(g, x + r * 0.05, y + alto * 0.5, r, ry + alto * 0.5, inclina, tons.escura)
  oval(g, x - r * 0.06, y - ry * 0.08, r * 0.9, ry * 0.84, inclina, tons.meia)
  oval(g, x - r * 0.24, y - ry * 0.28, r * 0.54, ry * 0.44, inclina, tons.clara)
  if (s.molhado) oval(g, x - r * 0.36, y - ry * 0.4, r * 0.2, ry * 0.15, inclina, BRILHO_MOLHADO)
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const seixos: Seixo[] = Array.from({ length: QUANTOS }, (_, i) => {
    // Em espiral (o ângulo de ouro): os maiores no meio, os miúdos na beira, sem fila.
    const t = (i + 0.5) / QUANTOS
    const rho = RAIO_DO_PUNHADO * Math.sqrt(t) * (0.82 + 0.3 * sorteio(semente, i))
    const a = giro + i * ANGULO_DE_OURO + (sorteio(semente, 10 + i) - 0.5) * 0.6
    return {
      x: Math.cos(a) * rho,
      y: -0.05 + Math.sin(a) * rho * ACHATA,
      r: 0.12 * (1 - 0.45 * Math.sqrt(t)) * (0.8 + 0.4 * sorteio(semente, 20 + i)),
      k: 0.56 + 0.2 * sorteio(semente, 30 + i),
      inclina: (sorteio(semente, 40 + i) - 0.5) * 0.8 + Math.sin(giro * 2 + i) * 0.25,
      tons: TIPOS[Math.floor(sorteio(semente, 50 + i) * TIPOS.length) % TIPOS.length],
      molhado: sorteio(semente, 60 + i) < 0.7,
    }
  }).sort((p, q) => p.y - q.y)
  for (const s of seixos) desenharSeixo(g, s)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'seixos', nome: 'Seixos de rio', tamanho: 10, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [
  ...[CINZA, AZULADO, OCRE, FERRUGEM, QUARTZO].flatMap((t) => [t.escura, t.meia, t.clara]),
  BRILHO_MOLHADO,
]
