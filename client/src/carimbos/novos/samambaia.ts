import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Samambaia (item 123 dos carimbos de 14/11/2026): uma touceira de frondes
 * que saem do mesmo miolo e se abrem em roda, arqueando para cima e caindo
 * na ponta. Cada fronde é uma PENA: a haste no meio e os folíolos dos dois
 * lados, compridos perto do pé e miúdos na ponta (o serrilhado é o que diz
 * "samambaia" e a separa do arbusto redondo e dos juncos retos). As duas
 * metades de cada fronde têm tom: a que olha para a luz clara, a outra no
 * escuro. O giro gira a roda das frondes. A luz não gira.
 */

const MIOLO: Rgb = [42, 82, 56]
const FRONDE_ESCURA: Rgb = [56, 110, 68]
const FRONDE_MEDIA: Rgb = [90, 146, 84]
const FRONDE_CLARA: Rgb = [136, 178, 102]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

type Ponto = readonly [number, number]

/** O miolo da touceira, de onde saem as frondes. */
const MEIO = { x: 0, y: -0.1 } as const
/** Pares de folíolos por fronde. */
const FOLIOLOS = 10

function noArco(a: Ponto, c: Ponto, b: Ponto, t: number): Ponto {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}

function desenharFronde(g: CanvasRenderingContext2D, a: number, comprimento: number, largura: number): void {
  const dx = Math.cos(a)
  const dy = Math.sin(a) * 0.5
  const base: Ponto = [MEIO.x, MEIO.y]
  const curva: Ponto = [MEIO.x + dx * comprimento * 0.5, MEIO.y + dy * comprimento * 0.5 - 0.25]
  const ponta: Ponto = [MEIO.x + dx * comprimento, MEIO.y + dy * comprimento + 0.05]
  const quadro = (t: number) => {
    const p = noArco(base, curva, ponta, t)
    const q = noArco(base, curva, ponta, Math.min(1, t + 0.02))
    const r = noArco(base, curva, ponta, Math.max(0, t - 0.02))
    const tx = q[0] - r[0]
    const ty = q[1] - r[1]
    const n = Math.hypot(tx, ty) || 1
    return { p, t: [tx / n, ty / n] as Ponto, n: [-ty / n, tx / n] as Ponto }
  }
  const de = 0.14
  const passo = (0.97 - de) / FOLIOLOS
  const tons = Math.sin(a) < -0.25 ? [FRONDE_MEDIA, FRONDE_ESCURA] : [FRONDE_CLARA, FRONDE_MEDIA]
  const meio = quadro(0.5)
  for (const lado of [1, -1] as const) {
    g.fillStyle = css(voltadoParaALuz(meio.n[0] * lado, meio.n[1] * lado) > 0.5 ? tons[0] : tons[1])
    g.beginPath()
    g.moveTo(base[0], base[1])
    for (let k = 0; k < FOLIOLOS; k++) {
      const t = de + passo * (k + 0.5)
      // O folíolo: comprido perto do pé, miúdo na ponta, apontando para a frente.
      const l = largura * Math.sqrt(1 - t) * Math.min(1, (t - 0.05) * 5)
      const antes = quadro(t - passo * 0.45)
      const aqui = quadro(t)
      const depois = quadro(t + passo * 0.45)
      // O vão entre um folíolo e o outro não chega à haste: a fronde tem corpo, a borda é serrilhada.
      const vao = Math.max(0.01, l * 0.4)
      g.lineTo(antes.p[0] + antes.n[0] * vao * lado, antes.p[1] + antes.n[1] * vao * lado)
      g.lineTo(aqui.p[0] + (aqui.n[0] * lado + aqui.t[0] * 0.5) * l, aqui.p[1] + (aqui.n[1] * lado + aqui.t[1] * 0.5) * l)
      g.lineTo(depois.p[0] + depois.n[0] * vao * lado, depois.p[1] + depois.n[1] * vao * lado)
    }
    g.lineTo(ponta[0], ponta[1])
    for (let k = 4; k >= 0; k--) {
      const p = noArco(base, curva, ponta, k / 5)
      g.lineTo(p[0], p[1])
    }
    g.closePath()
    g.fill()
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantas = 11
  const frondes = Array.from({ length: quantas }, (_, i) => ({
    a: giro + (i * Math.PI * 2) / quantas + (sorteio(semente, i) - 0.5) * 0.45,
    comprimento: 0.44 * (0.84 + 0.24 * sorteio(semente, 10 + i)),
    largura: 0.11 * (0.9 + 0.2 * sorteio(semente, 20 + i)),
  })).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  const atras = frondes.filter((f) => Math.sin(f.a) < 0)
  const frente = frondes.filter((f) => Math.sin(f.a) >= 0)
  for (const f of atras) desenharFronde(g, f.a, f.comprimento, f.largura)
  // O miolo escuro, onde as frondes nascem.
  g.fillStyle = css(MIOLO)
  g.beginPath()
  g.ellipse(MEIO.x + 0.01, MEIO.y + 0.01, 0.07, 0.045, 0, 0, Math.PI * 2)
  g.fill()
  for (const f of frente) desenharFronde(g, f.a, f.comprimento, f.largura)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'samambaia', nome: 'Samambaia', tamanho: 7, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [MIOLO, FRONDE_ESCURA, FRONDE_MEDIA, FRONDE_CLARA]
