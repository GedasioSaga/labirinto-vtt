import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cogumelo gigante (item 113 da lista de 14/11/2026): o chapéu vermelho de
 * pintas claras, largo, sobre um pé grosso e creme com o bulbo no chão, e
 * às vezes um ou dois filhotes do lado (que dão a escala: o grande tem o
 * tamanho de uma árvore pequena). Visto de cima com um pouco de frente: o
 * domo do chapéu por cima, a beira de baixo dele mais escura e o pé
 * aparecendo embaixo. A luz é a de todos (de cima à esquerda); o giro gira
 * as pintas e muda o lado dos filhotes, e inclina o pé de leve.
 */

const PE_CLARO: Rgb = [230, 218, 194]
const PE: Rgb = [206, 192, 166]
const PE_SOMBRA: Rgb = [170, 154, 130]
const CHAPEU_BEIRA: Rgb = [124, 54, 50]
const CHAPEU: Rgb = [174, 78, 62]
const CHAPEU_CLARO: Rgb = [204, 116, 92]
const CHAPEU_BRILHO: Rgb = [222, 152, 126]
const PINTA: Rgb = [238, 228, 208]
const PINTA_SOMBRA: Rgb = [206, 190, 172]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function elipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/** Onde ficam as pintas no domo (no disco de raio 1, antes do giro). */
const PINTAS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 1.15],
  [0.62, 0.1, 1],
  [-0.48, 0.42, 0.9],
  [0.2, -0.66, 0.85],
  [-0.66, -0.3, 0.8],
  [0.42, 0.62, 0.75],
  [-0.12, 0.78, 0.65],
]

interface Cogumelo {
  x: number
  y: number
  /** 1 = o grande. */
  escala: number
  inclina: number
  giro: number
  semente: number
  pintas: number
}

function pintarCogumelo(g: CanvasRenderingContext2D, c: Cogumelo): void {
  const { x, y, escala: k, inclina } = c
  const alto = y - 0.44 * k
  // O pé: o bulbo no chão e o corpo que afina para cima; a sombra à direita.
  g.fillStyle = css(PE_SOMBRA)
  g.beginPath()
  g.moveTo(x - 0.15 * k, y - 0.03 * k)
  g.quadraticCurveTo(x - 0.17 * k, y + 0.03 * k, x, y + 0.035 * k)
  g.quadraticCurveTo(x + 0.17 * k, y + 0.03 * k, x + 0.15 * k, y - 0.03 * k)
  g.quadraticCurveTo(x + 0.09 * k + inclina * 0.5, y - 0.2 * k, x + 0.1 * k + inclina, alto)
  g.lineTo(x - 0.1 * k + inclina, alto)
  g.quadraticCurveTo(x - 0.09 * k + inclina * 0.5, y - 0.2 * k, x - 0.15 * k, y - 0.03 * k)
  g.closePath()
  g.fill()
  g.fillStyle = css(PE)
  g.beginPath()
  g.moveTo(x - 0.15 * k, y - 0.03 * k)
  g.quadraticCurveTo(x - 0.16 * k, y + 0.026 * k, x + 0.03 * k, y + 0.028 * k)
  g.quadraticCurveTo(x + 0.02 * k + inclina * 0.5, y - 0.2 * k, x + 0.03 * k + inclina, alto)
  g.lineTo(x - 0.1 * k + inclina, alto)
  g.quadraticCurveTo(x - 0.09 * k + inclina * 0.5, y - 0.2 * k, x - 0.15 * k, y - 0.03 * k)
  g.closePath()
  g.fill()
  g.fillStyle = css(PE_CLARO)
  g.beginPath()
  g.moveTo(x - 0.13 * k, y - 0.02 * k)
  g.quadraticCurveTo(x - 0.075 * k + inclina * 0.5, y - 0.2 * k, x - 0.085 * k + inclina, alto)
  g.lineTo(x - 0.04 * k + inclina, alto)
  g.quadraticCurveTo(x - 0.04 * k + inclina * 0.5, y - 0.2 * k, x - 0.07 * k, y + 0.012 * k)
  g.closePath()
  g.fill()

  // O chapéu: a beira de baixo (a grossura dele, na sombra), o domo, a luz e o brilho.
  const cx = x + inclina * 1.25
  const cy = y - 0.62 * k
  const rx = 0.47 * k
  const ry = 0.3 * k
  elipse(g, cx + 0.012 * k, cy + 0.075 * k, rx * 0.98, ry * 0.9, CHAPEU_BEIRA)
  elipse(g, cx, cy, rx, ry, CHAPEU)
  elipse(g, cx - rx * 0.16, cy - ry * 0.2, rx * 0.74, ry * 0.68, CHAPEU_CLARO)
  elipse(g, cx - rx * 0.36, cy - ry * 0.44, rx * 0.3, ry * 0.22, CHAPEU_BRILHO)

  // As pintas: giram com o giro; perto da beira elas se achatam (o domo vira de lado).
  const claras: Array<[number, number, number, number]> = []
  const escuras: Array<[number, number, number, number]> = []
  PINTAS.slice(0, c.pintas).forEach(([u0, v0, tam], i) => {
    const a = c.giro + (sorteio(c.semente, 80 + i) - 0.5) * 0.4
    const u = u0 * Math.cos(a) - v0 * Math.sin(a)
    const v = u0 * Math.sin(a) + v0 * Math.cos(a)
    const d = Math.min(1, Math.hypot(u, v))
    const s = 0.06 * k * tam * (0.85 + 0.3 * sorteio(c.semente, 90 + i))
    const px = cx + u * rx * 0.8
    const py = cy + v * ry * 0.8
    const pinta: [number, number, number, number] = [px, py, s * (1 - 0.45 * Math.abs(u) * d), s * 0.68 * (1 - 0.45 * Math.abs(v) * d)]
    // A pinta da metade de baixo à direita fica na sombra do domo.
    if (u * 0.6 + v * 0.8 > 0.35) escuras.push(pinta)
    else claras.push(pinta)
  })
  for (const [lista, cor] of [
    [claras, PINTA],
    [escuras, PINTA_SOMBRA],
  ] as const) {
    if (lista.length === 0) continue
    g.fillStyle = css(cor)
    g.beginPath()
    for (const [px, py, prx, pry] of lista) {
      g.moveTo(px + prx, py)
      g.ellipse(px, py, prx, pry, 0, 0, Math.PI * 2)
    }
    g.fill()
  }
}

function desenharCogumeloGigante(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.05
  // Os filhotes: nenhum, um ou dois, ao pé do grande, num lado que muda com o giro.
  const quantos = sorteio(semente, 1) < 0.2 ? 0 : sorteio(semente, 2) < 0.55 ? 1 : 2
  // Sempre de lado (na frente do pé, o filhote parecia grudado nele): um de cada lado quando são dois.
  const primeiro = Math.cos(giro + 0.6) >= 0 ? 1 : -1
  const filhos: Cogumelo[] = Array.from({ length: quantos }, (_, i) => {
    const lado = i === 0 ? primeiro : -primeiro
    const a = giro * 1.3 + i * 2.2 + (sorteio(semente, 3 + i) - 0.5) * 0.6
    return {
      x: lado * (0.3 + 0.08 * sorteio(semente, 7 + i)),
      y: 0.03 + Math.sin(a) * 0.08,
      escala: 0.3 + 0.1 * sorteio(semente, 5 + i),
      inclina: lado * 0.025,
      giro: giro + i,
      semente: semente + 11 * (i + 1),
      pintas: 3,
    }
  })
  // O de trás (mais alto na tela) sai antes do grande; o da frente, depois.
  for (const f of filhos.filter((f) => f.y < 0.03)) pintarCogumelo(g, f)
  pintarCogumelo(g, { x: 0, y: 0, escala: 1, inclina, giro, semente, pintas: PINTAS.length })
  for (const f of filhos.filter((f) => f.y >= 0.03)) pintarCogumelo(g, f)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'cogumelo-gigante',
  nome: 'Cogumelo gigante',
  tamanho: 12,
  sombra: 'em-pe',
  desenhar: desenharCogumeloGigante,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [PE_CLARO, PE, PE_SOMBRA, CHAPEU_BEIRA, CHAPEU, CHAPEU_CLARO, CHAPEU_BRILHO, PINTA, PINTA_SOMBRA]
