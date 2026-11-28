import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Pedras com neve (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; família
 * Pedras): o grupo de três pedras da serra (`desenharPedras` em `embutidos.ts`: a maior atrás à esquerda, a média à
 * direita, a pequena na frente) depois de uma nevada. As pedras são as mesmas, facetadas, cada face com a luz pela
 * direção para onde olha, mas num cinza frio de granito; em cima de cada uma, um chapéu de neve que pega o topo e
 * desce pelos lados de cima (recortado na pedra: neve não flutua), com a sombra azulada só no crescente de baixo à
 * direita, como o Monte de neve; em volta do pé, a neve que o vento juntou, rente ao chão. Os brancos e os azuis são
 * os do Monte de neve (`monteDeNeve.ts`). O giro troca a arrumação do grupo e o corte de cada pedra; a luz não gira.
 */

const PEDRA_CLARA: Rgb = [180, 180, 176]
const PEDRA_MEIA: Rgb = [146, 146, 144]
const PEDRA_ESCURA: Rgb = [104, 106, 110]
const NEVE_FUNDA: Rgb = [158, 176, 196]
const NEVE_SOMBRA: Rgb = [188, 202, 214]
const NEVE: Rgb = [222, 230, 238]
const NEVE_CLARA: Rgb = [240, 243, 245]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
/** Luz em 3D (x direita, y para baixo na tela, z para cima): de cima à esquerda e do alto, a das Pedras. */
const LUZ = (() => {
  const v = { x: -0.5, y: -0.55, z: 0.67 }
  const n = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / n, y: v.y / n, z: v.z / n }
})()
/** O grupo das Pedras: o meio (no chão), o raio do pé e a altura de cada pedra. */
const GRUPO = [
  { dx: -0.1, dy: -0.02, raio: 0.3, altura: 0.3 },
  { dx: 0.24, dy: 0.04, raio: 0.19, altura: 0.18 },
  { dx: 0.02, dy: 0.13, raio: 0.13, altura: 0.11 },
] as const
/** O chapéu de neve: o quanto ele desce do topo para o pé (fração do lado), no lado de costas e a mais no virado para a luz; e os pontos da volta do monte do pé. */
const CHAPEU = { minimo: 0.12, aLuz: 0.4 } as const
const VOLTA = 14
/** O deslocamento da neve puxada para a luz, em fração do raio (o crescente de sombra que sobra embaixo à direita). */
const PUXA = { x: -0.1, y: -0.09 } as const

type P = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
}

function tomDaPedra(brilho: number): Rgb {
  const t = Math.min(1, Math.max(0, (brilho - 0.1) / 0.85))
  return t > 0.5 ? misturar(PEDRA_MEIA, PEDRA_CLARA, (t - 0.5) * 2) : misturar(PEDRA_ESCURA, PEDRA_MEIA, t * 2)
}

function caminho(g: CanvasRenderingContext2D, lista: readonly (readonly P[])[], dx = 0, dy = 0): void {
  g.beginPath()
  for (const pontos of lista) {
    pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)))
    g.closePath()
  }
}

function pintar(g: CanvasRenderingContext2D, lista: readonly (readonly P[])[], cor: Rgb, dx = 0, dy = 0, alfa = 1): void {
  g.fillStyle = css(cor, alfa)
  caminho(g, lista, dx, dy)
  g.fill()
}

/** Uma volta de beira mole em torno de (cx, cy), de raios rx e ry (já na tela), cada ponto um tanto para fora ou para dentro. */
function volta(cx: number, cy: number, rx: number, ry: number, semente: number, torto: number): P[] {
  const f = sorteio(semente, 1) * Math.PI * 2
  return Array.from({ length: VOLTA }, (_, i): P => {
    const t = (i / VOLTA) * Math.PI * 2
    const k = 1 + torto * (Math.sin(3 * t + f) * 0.6 + (sorteio(semente, 10 + i) - 0.5) * 0.8)
    return [cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]
  })
}

/** O polígono encolhido para (cx, cy) e puxado para cima à esquerda: fica dentro do original (sem recorte). */
function puxado(pontos: readonly P[], cx: number, cy: number, encolhe: number, raio: number): P[] {
  const dx = PUXA.x * raio
  const dy = PUXA.y * raio
  return pontos.map(([x, y]): P => [cx + (x - cx) * encolhe + dx, cy + (y - cy) * encolhe + dy])
}

/**
 * A neve com a luz, sem recorte (o recorte custava o dobro do tempo): a sombra azulada inteira, a neve clara por
 * cima encolhida e puxada para cima à esquerda (sobra o crescente de sombra embaixo à direita) e a crista.
 */
function neveComLuz(g: CanvasRenderingContext2D, neve: readonly P[], cx: number, cy: number, raio: number): void {
  pintar(g, [neve], NEVE_SOMBRA)
  pintar(g, [puxado(neve, cx, cy, 0.84, raio)], NEVE)
  pintar(g, [puxado(neve, cx - raio * 0.12, cy - raio * 0.06, 0.42, raio)], NEVE_CLARA)
}

function desenharPedraComNeve(g: CanvasRenderingContext2D, cx: number, cy: number, raio: number, altura: number, giro: number, semente: number): void {
  const angulos = Array.from({ length: 6 }, (_, k) => giro + (k * Math.PI) / 3 + (sorteio(semente, k + 40) - 0.5) * 0.5)
  const pe = angulos.map((a, k): P => {
    const r = raio * (0.82 + 0.3 * sorteio(semente, k + 50))
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * ACHATA]
  })
  const encolhe = 0.42 + 0.12 * sorteio(semente, 60)
  const topoX = cx - raio * 0.1
  const topoY = cy - altura
  const topo = pe.map(([x, y]): P => [topoX + (x - cx) * encolhe, topoY + (y - cy) * encolhe])
  const lados = pe.map((p, k) => {
    const q = pe[(k + 1) % pe.length]
    const mx = (p[0] + q[0]) / 2 - cx
    const my = ((p[1] + q[1]) / 2 - cy) / ACHATA
    const m = Math.hypot(mx, my) || 1
    const nz = (raio * (1 - encolhe)) / Math.max(altura, 0.01)
    const n = Math.hypot(1, nz)
    const brilho = ((mx / m) * LUZ.x + (my / m) * LUZ.y + nz * LUZ.z) / n
    return { pontos: [p, q, topo[(k + 1) % pe.length], topo[k]] as P[], fundo: (p[1] + q[1]) / 2, brilho }
  })
  lados.sort((a, b) => a.fundo - b.fundo)
  for (const lado of lados) pintar(g, [lado.pontos], tomDaPedra(lado.brilho))
  pintar(g, [topo], tomDaPedra(LUZ.z + 0.12))

  // O chapéu de neve: pega o topo e desce pelos lados, cada ponto entre a quina do topo e a do pé (fica na pedra,
  // sem recorte); desce mais pelos lados virados para cima à esquerda, onde a neve assenta.
  const chapeu: P[] = []
  for (let k = 0; k < pe.length; k += 1) {
    for (const meio of [0, 0.5]) {
      const a = k
      const b = (k + 1) % pe.length
      const t = [topo[a][0] + (topo[b][0] - topo[a][0]) * meio, topo[a][1] + (topo[b][1] - topo[a][1]) * meio] as const
      const q = [pe[a][0] + (pe[b][0] - pe[a][0]) * meio, pe[a][1] + (pe[b][1] - pe[a][1]) * meio] as const
      const paraALuz = Math.max(0, -((q[0] - cx) * 0.7 + ((q[1] - cy) / ACHATA) * 0.7) / raio)
      const desce = (CHAPEU.minimo + CHAPEU.aLuz * paraALuz) * (0.8 + 0.4 * sorteio(semente, 80 + k * 2 + meio * 2))
      chapeu.push([t[0] + (q[0] - t[0]) * desce, t[1] + (q[1] - t[1]) * desce])
    }
  }
  neveComLuz(g, chapeu, topoX, topoY, raio * encolhe)
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const grupo = GRUPO.map((p, i) => {
    const y = p.dy / ACHATA
    return { ...p, x: p.dx * c - y * s, y: (p.dx * s + y * c) * ACHATA, i }
  }).sort((a, b) => a.y - b.y)

  // A neve que o vento encostou no pé de cada pedra, do lado de trás à esquerda: a pedra é pintada por cima e só a
  // ponta do monte aparece (um prato de neve em volta de tudo vira pires).
  for (const p of grupo) {
    const mx = p.x - p.raio * 0.42
    const my = p.y - p.raio * 0.08
    const encostada = volta(mx, my, p.raio * 0.95, p.raio * 0.95 * ACHATA, semente + 20 + p.i, 0.12)
    pintar(g, [encostada], NEVE_FUNDA, 0.006, 0.006)
    neveComLuz(g, encostada, mx, my, p.raio * 0.95)
  }

  for (const p of grupo) desenharPedraComNeve(g, p.x, p.y, p.raio, p.altura, giro + p.i, semente + p.i * 3)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'pedras-com-neve', nome: 'Pedras com neve', tamanho: 10, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [PEDRA_CLARA, PEDRA_MEIA, PEDRA_ESCURA, NEVE_FUNDA, NEVE_SOMBRA, NEVE, NEVE_CLARA]
