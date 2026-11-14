import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cacto redondo (item 138 dos carimbos de 14/11/2026): o cacto-barril, uma
 * bola baixa de costelas fundas que sobem do chão e se juntam no alto, numa
 * coroa de lã clara; às vezes com flores em volta da coroa, às vezes com um
 * ou dois filhotes do lado. Visto de cima e um pouco de frente, como as
 * pedras. Cada costela tem duas abas (da quina funda até a crista): cada aba
 * toma a luz pela direção para onde olha, então a bola sai listrada de luz e
 * sombra em gomos largos, que é o que diz "cacto" e a separa do arbusto. O
 * giro gira as costelas e a arrumação dos filhotes; a luz não gira.
 */

const ESCURO: Rgb = [50, 100, 84]
const MEIO_ESCURO: Rgb = [70, 126, 96]
const MEIO: Rgb = [100, 152, 108]
const CLARO: Rgb = [150, 186, 132]
const LA: Rgb = [214, 204, 166]
const LA_SOMBRA: Rgb = [176, 164, 128]
const FLOR_AMARELA: Rgb = [224, 186, 96]
const FLOR_ROSA: Rgb = [212, 132, 148]

const TONS = [ESCURO, MEIO_ESCURO, MEIO, CLARO] as const

/** Luz em 3D (x direita, y para baixo na tela, z para cima): a das pedras. */
const LUZ_3D = (() => {
  const v = { x: -0.5, y: -0.55, z: 0.67 }
  const n = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / n, y: v.y / n, z: v.z / n }
})()

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** Passos de cada aba, do pé à coroa. */
const PASSOS = 6
/** O quanto a bola afunda no chão (o ângulo da esfera que fica embaixo da terra). */
const AFUNDA = 0.42

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach((p, i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])))
  g.closePath()
}

function elipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/** O tom da aba pelo quanto ela olha para a luz (0 de costas, 1 de frente). */
function tom(brilho: number): Rgb {
  if (brilho < 0.05) return TONS[0]
  if (brilho < 0.3) return TONS[1]
  if (brilho < 0.56) return TONS[2]
  return TONS[3]
}

interface Barril {
  x: number
  y: number
  raio: number
  altura: number
  costelas: number
  giro: number
  flores: number
}

/**
 * Um barril: as abas de trás para a frente, a coroa por cima. Um ponto da
 * casca na direção `a` e na altura `f` (0 no pé, 1 na coroa): o perfil é de
 * barril (largo quase até o alto), e a quina entre duas costelas é mais funda.
 */
function desenharBarril(g: CanvasRenderingContext2D, b: Barril, semente: number): void {
  const coroa: Ponto = [b.x - b.raio * 0.06, b.y - b.altura]
  // A bola afunda um pouco no chão: o pé é mais estreito que a barriga.
  const ponto = (a: number, f: number, funda: boolean): Ponto => {
    const fi = -AFUNDA + f * (Math.PI / 2 + AFUNDA)
    const r = b.raio * Math.pow(Math.max(0, Math.cos(fi)), 0.75) * (funda ? 0.86 : 1)
    const z = (b.altura * (Math.sin(fi) + Math.sin(AFUNDA))) / (1 + Math.sin(AFUNDA))
    return [b.x + Math.cos(a) * r - b.raio * 0.06 * f, b.y + Math.sin(a) * r * ACHATA - z]
  }
  const passo = (Math.PI * 2) / b.costelas
  const abas: Array<{ pontos: Ponto[]; fundo: number; brilho: number }> = []
  for (let i = 0; i < b.costelas; i++) {
    const quina = b.giro + i * passo
    const crista = quina + passo / 2
    for (const [de, ate] of [
      [quina, crista],
      [crista, quina + passo],
    ] as const) {
      const pontos: Ponto[] = []
      for (let k = 0; k <= PASSOS; k++) pontos.push(ponto(de, k / PASSOS, de === quina || de === quina + passo))
      for (let k = PASSOS; k >= 0; k--) pontos.push(ponto(ate, k / PASSOS, ate === quina || ate === quina + passo))
      // A normal da aba no corte de baixo: da quina (funda) para a crista, para fora.
      const p0 = ponto(de, 0.3, de === quina)
      const p1 = ponto(ate, 0.3, ate === quina + passo)
      const tx = p1[0] - p0[0]
      const ty = (p1[1] - p0[1]) / ACHATA
      const meio = (de + ate) / 2
      let nx = ty
      let ny = -tx
      if (nx * Math.cos(meio) + ny * Math.sin(meio) < 0) {
        nx = -nx
        ny = -ny
      }
      const n = Math.hypot(nx, ny) || 1
      const sobe = 0.62
      const brilho = ((nx / n) * LUZ_3D.x + (ny / n) * LUZ_3D.y) * Math.cos(sobe) + Math.sin(sobe) * LUZ_3D.z
      abas.push({ pontos, fundo: Math.sin(meio), brilho })
    }
  }
  abas.sort((p, q) => p.fundo - q.fundo)
  for (const aba of abas) {
    g.fillStyle = css(tom(aba.brilho + (sorteio(semente, 300) - 0.5) * 0.04))
    caminho(g, aba.pontos)
    g.fill()
  }
  // A coroa: lã clara, a sombra dela embaixo à direita.
  const r = b.raio * 0.3
  elipse(g, coroa[0] + r * 0.12, coroa[1] + r * 0.1, r, r * 0.66, LA_SOMBRA)
  elipse(g, coroa[0] - r * 0.1, coroa[1] - r * 0.05, r * 0.72, r * 0.48, LA)
  if (b.flores === 0) return
  // As flores em volta da coroa: pétalas em roda e o miolo de lã.
  const cor = sorteio(semente, 310) < 0.6 ? FLOR_AMARELA : FLOR_ROSA
  g.fillStyle = css(cor)
  g.beginPath()
  for (let i = 0; i < b.flores; i++) {
    const a = b.giro * 0.7 + (i * Math.PI * 2) / b.flores + sorteio(semente, 320 + i) * 0.6
    const x = coroa[0] + Math.cos(a) * r * 1.05
    const y = coroa[1] + Math.sin(a) * r * 0.7
    const rf = b.raio * 0.13
    g.moveTo(x + rf, y)
    g.arc(x, y, rf, 0, Math.PI * 2)
  }
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const principal: Barril = {
    x: 0,
    y: -0.08,
    raio: 0.3 * (0.94 + 0.12 * sorteio(semente, 1)),
    altura: 0.38 * (0.92 + 0.16 * sorteio(semente, 2)),
    costelas: 11,
    giro,
    flores: sorteio(semente, 3) < 0.55 ? 5 : 0,
  }
  const lista: Barril[] = [principal]
  // Os filhotes: zero a dois, encostados no pé do grande.
  const filhotes = Math.floor(sorteio(semente, 4) * 2.6)
  for (let i = 0; i < filhotes; i++) {
    const a = giro + 0.9 + i * 2.3 + (sorteio(semente, 5 + i) - 0.5) * 0.6
    const raio = 0.11 + 0.04 * sorteio(semente, 8 + i)
    const d = principal.raio + raio * 0.55
    lista.push({
      x: Math.cos(a) * d,
      y: principal.y + Math.sin(a) * d * ACHATA,
      raio,
      altura: raio * 1.25,
      costelas: 8,
      giro: giro * 1.3 + i,
      flores: 0,
    })
  }
  lista.sort((p, q) => p.y - q.y)
  lista.forEach((b, i) => desenharBarril(g, b, semente + i * 5))
}

export const carimbo: DefinicaoDeCarimbo = { id: 'cacto-redondo', nome: 'Cacto redondo', tamanho: 6, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [ESCURO, MEIO_ESCURO, MEIO, CLARO, LA, LA_SOMBRA, FLOR_AMARELA, FLOR_ROSA]
