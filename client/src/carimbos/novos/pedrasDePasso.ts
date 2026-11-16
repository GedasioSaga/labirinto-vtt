import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Pedras de passo (referências de 15/11/2026, lote L3: "o que falta das 4
 * referências", o caminho de pedras soltas, versão original no estilo
 * Meio-Termo): quatro lajes chatas e arredondadas, deitadas em fila no chão,
 * a um passo uma da outra, cada uma um pouco para um lado (o pé esquerdo e o
 * direito). O que as separa das Pedras da serra (blocos altos e lascados) e
 * dos Seixos (um punhado de pedrinhas) é a FILA e a laje chata: a face de
 * cima lisa, a borda de cima à esquerda acesa (a quina que pega a luz), a
 * grossura escura que se vê de frente, e um liquen apagado aqui e ali. O giro
 * gira o rumo do caminho (oito rumos para montar uma trilha) e cada laje um
 * tanto; a luz não gira.
 */

interface Tons {
  /** A grossura da laje, que se vê de frente. */
  readonly escura: Rgb
  /** A face de cima. */
  readonly meia: Rgb
  /** A quina de cima à esquerda, que pega a luz. */
  readonly clara: Rgb
}

/** A laje cinza da serra e a parda, um nada mais quente (as duas contidas, para a trilha não virar mosaico). */
const CINZA: Tons = { escura: [96, 92, 86], meia: [146, 142, 132], clara: [184, 180, 168] }
const PARDA: Tons = { escura: [104, 94, 82], meia: [154, 144, 126], clara: [190, 182, 164] }
/** O liquen: um verde-cinza seco. */
const LIQUEN: Rgb = [128, 136, 110]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** O meio da trilha no quadro: um tanto acima do pé, para a trilha de pé na tela (giro de 90°) caber no y 0,3. */
const MEIO_Y = -0.08
const QUANTAS = 4
/** De uma laje à outra, ao longo do rumo (unidades do chão): um passo. */
const PASSO = 0.3
/** O quanto cada laje sai para o lado (o pé esquerdo e o direito). */
const DE_LADO = 0.04
/**
 * O raio da laje e a grossura que se vê de frente (unidades). Na primeira folha (15/11/2026) o raio era 0,125 e a
 * laje mais redonda: na mesa a fila lia como pontinhos.
 */
const RAIO = 0.142
const GROSSURA = 0.024
/** Quinas da laje antes de arredondar, e o quanto cada uma sai do redondo. */
const QUINAS = 8
const TORTO = 0.4
/**
 * A face de cima encolhe em volta do meio e desce para a direita e para baixo: a faixa clara que sobra em cima à
 * esquerda é a quina acesa, e a de baixo à direita volta à beira da laje (não vaza para fora dela).
 */
const ENCOLHE_A_FACE = 0.86
const QUINA_ACESA = { dx: 0.02, dy: 0.012 } as const

type P = readonly [number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O contorno arredondado: curvas pelas quinas, passando pelo meio de cada lado (a laje gasta, sem canto vivo). */
function laje(g: CanvasRenderingContext2D, pontos: readonly P[], dx: number, dy: number, cor: string): void {
  const n = pontos.length
  const meio = (i: number): P => {
    const a = pontos[i % n]
    const b = pontos[(i + 1) % n]
    return [(a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy]
  }
  g.fillStyle = cor
  g.beginPath()
  const [x0, y0] = meio(0)
  g.moveTo(x0, y0)
  for (let i = 1; i <= n; i++) {
    const [qx, qy] = pontos[i % n]
    const [mx, my] = meio(i)
    g.quadraticCurveTo(qx + dx, qy + dy, mx, my)
  }
  g.closePath()
  g.fill()
}

interface Pedra {
  readonly pontos: P[]
  /** O meio da laje na tela. */
  readonly x: number
  readonly y: number
  readonly tons: Tons
  readonly liquen: P | null
}

function pedraDe(i: number, giro: number, semente: number): Pedra {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  // A posição no chão: ao longo do rumo, cada uma um tanto para um lado, alternando.
  const t = (i - (QUANTAS - 1) / 2) * PASSO * (0.94 + 0.12 * sorteio(semente, i))
  const lado = (i % 2 === 0 ? 1 : -1) * DE_LADO * (0.6 + 0.8 * sorteio(semente, 10 + i))
  const gx = t * c - lado * s
  const gy = t * s + lado * c
  const cx = gx
  const cy = MEIO_Y + gy * ACHATA
  // A laje é mais larga de través que ao longo do caminho (onde o pé pisa de lado a lado).
  const raio = RAIO * (0.86 + 0.28 * sorteio(semente, 20 + i))
  const torce = giro + (sorteio(semente, 30 + i) - 0.5) * 0.6
  const pontos = Array.from({ length: QUINAS }, (_, k): P => {
    const a = (k * Math.PI * 2) / QUINAS + (sorteio(semente, 40 + i * QUINAS + k) - 0.5) * 0.4
    const d = raio * (1 - TORTO / 2 + TORTO * sorteio(semente, 140 + i * QUINAS + k))
    const ao = Math.cos(a) * d * 0.88
    const traves = Math.sin(a) * d * 1.1
    const x = ao * Math.cos(torce) - traves * Math.sin(torce)
    const y = ao * Math.sin(torce) + traves * Math.cos(torce)
    return [cx + x, cy + y * ACHATA]
  })
  const liquen: P | null = sorteio(semente, 60 + i) < 0.5 ? [cx + (sorteio(semente, 61 + i) - 0.5) * raio * 0.8, cy + (sorteio(semente, 62 + i) - 0.5) * raio * 0.4] : null
  return { pontos, x: cx, y: cy, tons: sorteio(semente, 70 + i) < 0.6 ? CINZA : PARDA, liquen }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const pedras = Array.from({ length: QUANTAS }, (_, i) => pedraDe(i, giro, semente)).sort((p, q) => p.y - q.y)
  for (const p of pedras) {
    // A grossura (a laje descida), a quina acesa (a face inteira, clara) e a face de cima por cima dela.
    laje(g, p.pontos, 0, GROSSURA, css(p.tons.escura))
    laje(g, p.pontos, 0, 0, css(p.tons.clara))
    // A face encolhida em volta do meio e descida para a direita: a borda de baixo à direita volta à beira da laje.
    const face = p.pontos.map(([x, y]): P => [p.x + (x - p.x) * ENCOLHE_A_FACE, p.y + (y - p.y) * ENCOLHE_A_FACE])
    laje(g, face, QUINA_ACESA.dx, QUINA_ACESA.dy, css(p.tons.meia))
    if (p.liquen !== null) {
      const [lx, ly] = p.liquen
      g.fillStyle = css(LIQUEN, 0.7)
      g.beginPath()
      g.ellipse(lx, ly, RAIO * 0.22, RAIO * 0.11, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'pedras-de-passo',
  nome: 'Pedras de passo',
  tamanho: 10,
  sombra: 'baixa',
  desenhar,
  // No TRAÇO (16/11/2026) cada módulo vira para o rumo do caminho e o seguinte começa um passo depois da
  // última laje: a trilha sai num ritmo só, medida no chão achatado (a que desce na tela também).
  traco: { espaco: QUANTAS * PASSO, rumo: true, achata: ACHATA },
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [...[CINZA, PARDA].flatMap((t) => [t.escura, t.meia, t.clara]), LIQUEN]
