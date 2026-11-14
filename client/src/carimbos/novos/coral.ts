import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Coral (item 136 dos carimbos de 14/11/2026): uma touceira de recife. A
 * peça que diz "coral" é o coral-galhado cor de coral: galhos grossos e
 * rombudos que sobem do pé e se abrem em forquilha, as pontas mais claras
 * (onde o coral cresce). Ao lado, um coral-cérebro (um domo ocre com os
 * sulcos em zigue-zague) e, às vezes, três tubinhos lilás. Vista de cima e um
 * pouco de frente; cada galho tem o corpo escuro e a face da luz (cima à
 * esquerda) no meio-tom. Sombra baixa. O giro gira a roda dos galhos e o
 * arranjo das peças; a luz não gira.
 */

const CORAL_ESCURO: Rgb = [168, 84, 80]
const CORAL: Rgb = [212, 124, 108]
const CORAL_CLARO: Rgb = [234, 178, 158]
const CEREBRO_ESCURO: Rgb = [146, 128, 80]
const CEREBRO: Rgb = [190, 176, 112]
const CEREBRO_CLARO: Rgb = [218, 208, 150]
const SULCO: Rgb = [126, 112, 66]
const TUBO_ESCURO: Rgb = [116, 88, 122]
const TUBO: Rgb = [156, 124, 160]
const TUBO_CLARO: Rgb = [196, 174, 196]
const BURACO: Rgb = [84, 60, 86]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55

type Ponto = readonly [number, number]

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

interface Galho {
  /** Para onde o galho abre, no chão: o seno diz se está atrás (negativo) ou na frente. */
  readonly a: number
  readonly pe: Ponto
  readonly dobra: Ponto
  readonly junta: Ponto
  readonly pontas: readonly Ponto[]
  readonly largura: number
}

/** O coral-galhado com o pé em (bx, by): os galhos de trás primeiro. */
function galhos(bx: number, by: number, giro: number, semente: number): Galho[] {
  const tela = (px: number, py: number, z: number): Ponto => [bx + px, by + py * ACHATA - z]
  const n = 6
  const lista: Galho[] = []
  for (let k = 0; k < n; k++) {
    const a = giro * 0.7 + (k * Math.PI * 2) / n + (sorteio(semente, k) - 0.5) * 0.6
    const c = Math.cos(a)
    const s = Math.sin(a)
    const abre = 0.1 + 0.04 * sorteio(semente, 10 + k)
    const sobe = 0.15 + 0.06 * sorteio(semente, 20 + k)
    const junta: Ponto = tela(c * abre, s * abre, sobe)
    const pontas: Ponto[] = []
    for (const [giroDaPonta, alcance, mais] of [
      [-0.55, 0.11, 0.13],
      [0.5, 0.09, 0.1],
    ] as const) {
      if (giroDaPonta > 0 && sorteio(semente, 30 + k) < 0.3) continue
      const b = a + giroDaPonta
      const l = alcance * (0.85 + 0.3 * sorteio(semente, 40 + k))
      pontas.push(tela(c * abre + Math.cos(b) * l, s * abre + Math.sin(b) * l, sobe + mais * (0.8 + 0.4 * sorteio(semente, 50 + k))))
    }
    lista.push({ a, pe: tela(c * 0.03, s * 0.03, 0), dobra: tela(c * 0.03, s * 0.03, sobe * 0.6), junta, pontas, largura: 0.07 + 0.015 * sorteio(semente, 60 + k) })
  }
  // O galho do meio, que sobe quase reto e é o mais alto.
  const meio: Ponto = tela(0.01, 0, 0.24)
  lista.push({
    a: 0,
    pe: tela(0, 0.01, 0),
    dobra: tela(0, 0.01, 0.14),
    junta: meio,
    pontas: [tela(-0.06, -0.01, 0.38), tela(0.07, 0.01, 0.34)],
    largura: 0.08,
  })
  return lista.sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
}

function tracarGalho(g: CanvasRenderingContext2D, galho: Galho, dx: number, dy: number): void {
  g.beginPath()
  g.moveTo(galho.pe[0] + dx, galho.pe[1] + dy)
  g.quadraticCurveTo(galho.dobra[0] + dx, galho.dobra[1] + dy, galho.junta[0] + dx, galho.junta[1] + dy)
  for (const p of galho.pontas) {
    g.moveTo(galho.junta[0] + dx, galho.junta[1] + dy)
    g.lineTo(p[0] + dx, p[1] + dy)
  }
}

function desenharGalhado(g: CanvasRenderingContext2D, bx: number, by: number, giro: number, semente: number): void {
  g.lineCap = 'round'
  for (const galho of galhos(bx, by, giro, semente)) {
    const w = galho.largura
    g.strokeStyle = css(CORAL_ESCURO)
    g.lineWidth = w
    tracarGalho(g, galho, 0, 0)
    g.stroke()
    g.strokeStyle = css(CORAL)
    g.lineWidth = w * 0.55
    tracarGalho(g, galho, -w * 0.17, -w * 0.12)
    g.stroke()
    // As pontas que crescem, claras.
    g.fillStyle = css(CORAL_CLARO)
    g.beginPath()
    for (const p of galho.pontas) {
      const x = p[0] - w * 0.12
      const y = p[1] - w * 0.12
      g.moveTo(x + w * 0.3, y)
      g.arc(x, y, w * 0.3, 0, Math.PI * 2)
    }
    g.fill()
  }
}

/** O coral-cérebro: um domo com o pé em (x, y) e os sulcos em zigue-zague. */
function desenharCerebro(g: CanvasRenderingContext2D, x: number, y: number, r: number, semente: number): void {
  const cy = y - r * 0.32
  elipse(g, x + r * 0.08, cy + r * 0.06, r, r * 0.72, CEREBRO_ESCURO)
  elipse(g, x - r * 0.06, cy - r * 0.08, r * 0.88, r * 0.6, CEREBRO)
  elipse(g, x - r * 0.3, cy - r * 0.28, r * 0.46, r * 0.28, CEREBRO_CLARO)
  g.strokeStyle = css(SULCO, 0.8)
  g.lineWidth = r * 0.065
  g.lineCap = 'round'
  g.beginPath()
  for (const fila of [-0.5, -0.2, 0.1, 0.4]) {
    const meiaLargura = Math.sqrt(1 - fila * fila) * 0.74
    const passos = 10
    const fase = sorteio(semente, 200 + Math.round(fila * 10)) * Math.PI
    for (let i = 0; i <= passos; i++) {
      const t = -meiaLargura + (2 * meiaLargura * i) / passos
      const px = x - r * 0.04 + t * r
      const py = cy + fila * r * 0.6 + Math.sin(fase + i * 2.6) * r * 0.075
      if (i === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
  }
  g.stroke()
}

/** Três tubinhos em pé, com o pé em volta de (x, y). */
function desenharTubos(g: CanvasRenderingContext2D, x: number, y: number, semente: number): void {
  const tubos = [
    [-0.045, -0.01, 0.13],
    [0.035, -0.025, 0.1],
    [0.0, 0.03, 0.08],
  ].map(([dx, dy, h], i) => ({ x: x + dx, y: y + dy, h: h * (0.85 + 0.3 * sorteio(semente, 300 + i)) }))
  tubos.sort((p, q) => p.y - q.y)
  const r = 0.03
  g.lineCap = 'round'
  for (const t of tubos) {
    g.strokeStyle = css(TUBO_ESCURO)
    g.lineWidth = r * 2
    g.beginPath()
    g.moveTo(t.x, t.y)
    g.lineTo(t.x, t.y - t.h)
    g.stroke()
    g.strokeStyle = css(TUBO)
    g.lineWidth = r * 0.8
    g.beginPath()
    g.moveTo(t.x - r * 0.45, t.y)
    g.lineTo(t.x - r * 0.45, t.y - t.h)
    g.stroke()
    elipse(g, t.x, t.y - t.h, r, r * 0.62, TUBO_CLARO)
    elipse(g, t.x + r * 0.08, t.y - t.h + r * 0.06, r * 0.55, r * 0.32, BURACO)
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const pos = (a: number, d: number): Ponto => [Math.cos(a) * d, 0.04 + Math.sin(a) * d * ACHATA]
  const galhado = pos(giro + Math.PI + (sorteio(semente, 1) - 0.5) * 0.4, 0.09)
  const cerebro = pos(giro + 0.4 + (sorteio(semente, 2) - 0.5) * 0.4, 0.25)
  const tubos = pos(giro + 2.1 + (sorteio(semente, 3) - 0.5) * 0.4, 0.28)
  const pecas = [
    { y: galhado[1], faz: () => desenharGalhado(g, galhado[0], galhado[1], giro, semente) },
    { y: cerebro[1], faz: () => desenharCerebro(g, cerebro[0], cerebro[1], 0.14 * (0.9 + 0.2 * sorteio(semente, 4)), semente) },
    ...(sorteio(semente, 5) < 0.65 ? [{ y: tubos[1], faz: () => desenharTubos(g, tubos[0], tubos[1], semente) }] : []),
  ].sort((p, q) => p.y - q.y)
  for (const p of pecas) p.faz()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'coral', nome: 'Coral', tamanho: 8, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [
  CORAL_ESCURO,
  CORAL,
  CORAL_CLARO,
  CEREBRO_ESCURO,
  CEREBRO,
  CEREBRO_CLARO,
  SULCO,
  TUBO_ESCURO,
  TUBO,
  TUBO_CLARO,
  BURACO,
]
