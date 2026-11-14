import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Bananeira (item 122 dos carimbos de 14/11/2026): o caule verde e grosso
 * (não o tronco marrom e fino da Palmeira), com uma folha velha seca pendurada
 * nele, e no alto as FOLHAS LARGAS em remo, arqueadas, rasgadas aqui e ali
 * até a nervura. Cada folha tem as duas metades de tom: a que olha para a luz
 * clara, a outra no escuro, e a nervura sai da costura entre elas. Pendurado
 * de um lado, o cacho de banana verde com o coração roxo na ponta. O giro gira
 * o leque das folhas; a planta só inclina de leve. A luz não gira.
 */

const CAULE: Rgb = [128, 142, 86]
const CAULE_SOMBRA: Rgb = [88, 104, 64]
const SECA: Rgb = [148, 124, 80]
const SECA_SOMBRA: Rgb = [110, 92, 62]
const FOLHA_CLARA: Rgb = [110, 160, 86]
const FOLHA_MEDIA: Rgb = [70, 126, 68]
const FOLHA_ESCURA: Rgb = [46, 94, 60]
const BANANA: Rgb = [168, 168, 78]
const BANANA_SOMBRA: Rgb = [118, 124, 60]
const CORACAO: Rgb = [126, 58, 76]
const CORACAO_LUZ: Rgb = [166, 94, 110]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

type Ponto = readonly [number, number]

/** O alto do caule, de onde saem as folhas. */
const ALTO = { x: 0.02, y: -0.6 } as const
/** Amostras ao longo de cada folha (a borda é um polígono). */
const AMOSTRAS = 11

interface Folha {
  a: number
  comprimento: number
  largura: number
  /** Em que amostras cada metade tem um rasgo (a borda entra até perto da nervura). */
  rasgos: readonly [ReadonlySet<number>, ReadonlySet<number>]
}

function noArco(a: Ponto, c: Ponto, b: Ponto, t: number): Ponto {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}

function desenharFolha(g: CanvasRenderingContext2D, f: Folha): void {
  const dx = Math.cos(f.a)
  const dy = Math.sin(f.a) * 0.6
  // O eixo (a nervura): sai do alto, sobe arqueando e cai na ponta.
  const base: Ponto = [ALTO.x + dx * 0.05, ALTO.y + dy * 0.05 - 0.01]
  const curva: Ponto = [ALTO.x + dx * f.comprimento * 0.5, ALTO.y + dy * f.comprimento * 0.5 - 0.17]
  const ponta: Ponto = [ALTO.x + dx * f.comprimento, ALTO.y + dy * f.comprimento + 0.12]
  const normalEm = (t: number): Ponto => {
    const q = noArco(base, curva, ponta, Math.min(1, t + 0.02))
    const r = noArco(base, curva, ponta, Math.max(0, t - 0.02))
    const tx = q[0] - r[0]
    const ty = q[1] - r[1]
    const n = Math.hypot(tx, ty) || 1
    return [-ty / n, tx / n]
  }
  // Remo: estreita no pé, larga e quase reta no meio, a ponta arredondada.
  const largura = (t: number) => f.largura * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 4))) * (t < 0.15 ? 0.5 + t * 3.3 : 1)
  const borda = (t: number, fator: number, lado: 1 | -1): Ponto => {
    const p = noArco(base, curva, ponta, t)
    const n = normalEm(t)
    const w = largura(t) * fator * lado
    return [p[0] + n[0] * w, p[1] + n[1] * w]
  }
  const meio = normalEm(0.5)
  const tons = Math.sin(f.a) < -0.2 ? [FOLHA_MEDIA, FOLHA_ESCURA] : [FOLHA_CLARA, FOLHA_MEDIA]
  for (const lado of [1, -1] as const) {
    g.fillStyle = css(voltadoParaALuz(meio[0] * lado, meio[1] * lado) > 0.5 ? tons[0] : tons[1])
    const rasgos = f.rasgos[lado === 1 ? 0 : 1]
    g.beginPath()
    g.moveTo(base[0], base[1])
    for (let k = 1; k <= AMOSTRAS; k++) {
      const t = k / AMOSTRAS
      // O rasgo é uma fenda estreita que entra até perto da nervura, não um dente largo.
      const pontos = rasgos.has(k) ? [borda(t - 0.018, 1, lado), borda(t, 0.1, lado), borda(t + 0.018, 1, lado)] : [borda(t, 1, lado)]
      for (const p of pontos) g.lineTo(p[0], p[1])
    }
    for (let k = AMOSTRAS; k >= 0; k--) {
      const p = noArco(base, curva, ponta, k / AMOSTRAS)
      g.lineTo(p[0], p[1])
    }
    g.closePath()
    g.fill()
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  g.rotate(Math.sin(giro) * 0.045)
  // O caule: grosso, verde, a metade da direita na sombra.
  g.fillStyle = css(CAULE)
  g.beginPath()
  g.moveTo(0.01, 0.02)
  g.lineTo(-0.07, 0.025)
  g.quadraticCurveTo(-0.075, -0.3, ALTO.x - 0.045, ALTO.y + 0.04)
  g.lineTo(ALTO.x, ALTO.y + 0.03)
  g.closePath()
  g.fill()
  g.fillStyle = css(CAULE_SOMBRA)
  g.beginPath()
  g.moveTo(0.01, 0.02)
  g.lineTo(ALTO.x, ALTO.y + 0.03)
  g.lineTo(ALTO.x + 0.045, ALTO.y + 0.04)
  g.quadraticCurveTo(0.08, -0.3, 0.075, 0.03)
  g.closePath()
  g.fill()
  // A folha velha, seca, pendurada no caule do lado da luz.
  const seca = sorteio(semente, 1) < 0.5 ? -1 : 1
  g.fillStyle = css(seca < 0 ? SECA : SECA_SOMBRA)
  g.beginPath()
  g.moveTo(ALTO.x + seca * 0.03, ALTO.y + 0.08)
  g.quadraticCurveTo(seca * 0.14, -0.42, seca * 0.11, -0.16)
  g.lineTo(seca * 0.085, -0.1)
  g.quadraticCurveTo(seca * 0.08, -0.36, ALTO.x + seca * 0.01, ALTO.y + 0.12)
  g.closePath()
  g.fill()

  // As folhas, as de trás primeiro.
  const quantas = 7
  const folhas: Folha[] = Array.from({ length: quantas }, (_, i) => {
    const rasgo = (k: number) => {
      const s = new Set<number>()
      if (sorteio(semente, 30 + i * 4 + k) < 0.7) s.add(3 + Math.floor(sorteio(semente, 50 + i * 4 + k) * 3))
      if (sorteio(semente, 70 + i * 4 + k) < 0.5) s.add(6 + Math.floor(sorteio(semente, 90 + i * 4 + k) * 3))
      return s
    }
    return {
      a: giro + (i * Math.PI * 2) / quantas + (sorteio(semente, i) - 0.5) * 0.5,
      comprimento: 0.54 * (0.88 + 0.22 * sorteio(semente, 10 + i)),
      largura: 0.105 + 0.025 * sorteio(semente, 20 + i),
      rasgos: [rasgo(0), rasgo(1)] as const,
    }
  }).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  for (const f of folhas) desenharFolha(g, f)

  // O cacho, pendurado de um lado: o talo, as pencas e o coração roxo na ponta.
  const lado = sorteio(semente, 2) < 0.5 ? -1 : 1
  const cacho = { x: ALTO.x + lado * 0.15, y: ALTO.y + 0.26 }
  g.strokeStyle = css(CAULE_SOMBRA)
  g.lineWidth = 0.02
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(ALTO.x + lado * 0.03, ALTO.y + 0.04)
  g.quadraticCurveTo(ALTO.x + lado * 0.16, ALTO.y + 0.02, cacho.x, cacho.y - 0.08)
  g.stroke()
  const pencas: Array<[number, number, number]> = []
  for (let fila = 0; fila < 3; fila++) {
    const largura = 0.075 - fila * 0.014
    for (let k = 0; k < 4 - (fila === 2 ? 1 : 0); k++) {
      const n = fila === 2 ? 2 : 3
      pencas.push([cacho.x - largura + (2 * largura * k) / n, cacho.y - 0.07 + fila * 0.042, 0.026])
    }
  }
  g.fillStyle = css(BANANA_SOMBRA)
  circulos(g, pencas.map(([x, y, r]) => [x + 0.006, y + 0.008, r] as [number, number, number]))
  g.fillStyle = css(BANANA)
  circulos(g, pencas.map(([x, y, r]) => [x - 0.004, y - 0.005, r * 0.78] as [number, number, number]))
  // O coração: uma gota roxa pendendo da ponta do cacho.
  g.fillStyle = css(CORACAO)
  g.beginPath()
  g.ellipse(cacho.x + lado * 0.005, cacho.y + 0.1, 0.033, 0.055, lado * -0.15, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(CORACAO_LUZ)
  g.beginPath()
  g.ellipse(cacho.x - 0.01, cacho.y + 0.085, 0.012, 0.03, lado * -0.15, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'bananeira', nome: 'Bananeira', tamanho: 11, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [
  CAULE,
  CAULE_SOMBRA,
  SECA,
  SECA_SOMBRA,
  FOLHA_CLARA,
  FOLHA_MEDIA,
  FOLHA_ESCURA,
  BANANA,
  BANANA_SOMBRA,
  CORACAO,
  CORACAO_LUZ,
]
