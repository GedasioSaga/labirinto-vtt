import { css, misturar, type Rgb } from '../../carimbos/embutidos'

/**
 * O GIRASSOL dos carimbos "Girassol" (um só) e "Girassóis" (o tufo de três):
 * a haste com a luz do lado esquerdo e duas folhas, a cabeça virada para a luz
 * (de cima à esquerda, a do relevo), duas voltas de pétalas e o miolo marrom
 * com um brilho, e o pé de folhas no chão. Embutido em cada um pelo import.
 */

const HASTE_CLARA: Rgb = [104, 146, 78]
const HASTE_ESCURA: Rgb = [54, 96, 58]
const FOLHA_CLARA: Rgb = [116, 156, 84]
const FOLHA_ESCURA: Rgb = [48, 92, 56]
const PETALA_CLARA: Rgb = [226, 194, 102]
const PETALA_MEIA: Rgb = [206, 160, 62]
const PETALA_ESCURA: Rgb = [164, 112, 42]
const MIOLO: Rgb = [84, 56, 36]
const MIOLO_CLARO: Rgb = [128, 90, 52]

/** Pétalas por volta. */
const PETALAS = 13
/** A cabeça olha para a luz: inclinada para a esquerda e vista meio de lado. */
const VIRADA_PARA_A_LUZ = -0.22
const ACHATAR_DE_LADO = 0.84

export interface Flor {
  /** Onde a cabeça fica. */
  x: number
  y: number
  raio: number
  /** Onde a haste sai do chão e quanto ela curva. */
  base: number
  curva: number
}

/** Sorteio fixo de 0 a 1 por semente e índice (o mesmo dos carimbos da biblioteca). */
export function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O quanto a direção (dx, dy) aponta para a luz de cima à esquerda: 0 de costas, 1 de frente. */
function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * -0.6 + dy * -0.8) / n)
}

/** Folha em gota, da base `(x, y)` na direção `angulo`, tingida pela luz conforme aponta. */
export function folha(g: CanvasRenderingContext2D, x: number, y: number, angulo: number, comprimento: number, largura: number): void {
  const dx = Math.cos(angulo)
  const dy = Math.sin(angulo)
  const meioX = x + dx * comprimento * 0.5
  const meioY = y + dy * comprimento * 0.5
  g.fillStyle = css(misturar(FOLHA_ESCURA, FOLHA_CLARA, voltadoParaALuz(dx, dy)))
  g.beginPath()
  g.moveTo(x, y)
  g.quadraticCurveTo(meioX - dy * largura, meioY + dx * largura, x + dx * comprimento, y + dy * comprimento)
  g.quadraticCurveTo(meioX + dy * largura, meioY - dx * largura, x, y)
  g.fill()
}

function caminhoDaHaste(g: CanvasRenderingContext2D, flor: Flor, desvio: number): void {
  g.beginPath()
  g.moveTo(flor.base + desvio, 0)
  g.quadraticCurveTo(flor.base + flor.curva + desvio, flor.y * 0.5, flor.x + desvio, flor.y)
  g.stroke()
}

/** A haste com a luz do lado esquerdo e duas folhas no meio, uma para cada lado. */
function haste(g: CanvasRenderingContext2D, flor: Flor): void {
  g.lineCap = 'round'
  g.lineWidth = 0.05
  g.strokeStyle = css(HASTE_ESCURA)
  caminhoDaHaste(g, flor, 0)
  g.lineWidth = 0.022
  g.strokeStyle = css(HASTE_CLARA)
  caminhoDaHaste(g, flor, -0.012)
  const meioX = (flor.base + flor.x) / 2 + flor.curva * 0.5
  const meioY = flor.y * 0.46
  folha(g, meioX, meioY, Math.PI - 0.32, 0.2, 0.07)
  folha(g, meioX, meioY + 0.08, 0.36, 0.18, 0.065)
}

/** A cabeça: duas voltas de pétalas (a de trás no meio-tom), o miolo e o brilho dele. */
function cabeca(g: CanvasRenderingContext2D, flor: Flor, giroDasPetalas: number): void {
  const r = flor.raio
  g.save()
  g.translate(flor.x, flor.y)
  g.rotate(VIRADA_PARA_A_LUZ)
  g.scale(ACHATAR_DE_LADO, 1)
  for (const [volta, tons, comprimento] of [
    [0, [PETALA_ESCURA, PETALA_MEIA], 1],
    [0.5, [PETALA_MEIA, PETALA_CLARA], 0.86],
  ] as const) {
    for (let i = 0; i < PETALAS; i++) {
      const a = giroDasPetalas + ((i + volta) * Math.PI * 2) / PETALAS
      // O tom vem da direção na tela: a cabeça está virada, a luz não.
      const tela = a + VIRADA_PARA_A_LUZ
      g.fillStyle = css(misturar(tons[0], tons[1], voltadoParaALuz(Math.cos(tela), Math.sin(tela))))
      g.beginPath()
      g.ellipse(Math.cos(a) * r * 0.55 * comprimento, Math.sin(a) * r * 0.55 * comprimento, r * 0.45 * comprimento, r * 0.15, a, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.fillStyle = css(MIOLO)
  g.beginPath()
  g.arc(0, 0, r * 0.42, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(MIOLO_CLARO)
  g.beginPath()
  g.arc(-r * 0.12, -r * 0.12, r * 0.2, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** Um girassol inteiro: haste, folhas e cabeça com as pétalas giradas por `giroDasPetalas`. */
export function girassol(g: CanvasRenderingContext2D, flor: Flor, giroDasPetalas: number): void {
  haste(g, flor)
  cabeca(g, flor, giroDasPetalas)
}

/** As cores, para a régua de "não estourar". */
export const PALETA_DO_GIRASSOL: readonly Rgb[] = [
  HASTE_CLARA,
  HASTE_ESCURA,
  FOLHA_CLARA,
  FOLHA_ESCURA,
  PETALA_CLARA,
  PETALA_MEIA,
  PETALA_ESCURA,
  MIOLO,
  MIOLO_CLARO,
]
