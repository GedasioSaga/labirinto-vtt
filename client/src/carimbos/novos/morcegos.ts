import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Morcegos (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e mina): um
 * bando de cinco no alto da caverna, perto do teto, visto de cima, como tudo no mapa. Cada um de asas abertas num
 * ponto da batida (um aberto de todo, outros meio fechados), virado para um lado: o corpo de pelo pardo com as
 * orelhas, as asas de pele esticada entre os dedos (os ossos riscados nela, a borda de trás em arcos de dedo a dedo)
 * e a pele do rabo entre as pernas. A asa que olha para a luz (de cima à esquerda) acende um pouco; a outra fica no
 * escuro. O bando fica no ALTO do quadro (está no teto) e a sombra dele cai longe e fraca no chão, embaixo e para a
 * direita: é do chão para a ferramenta (`sombra: 'nenhuma'`, a sombra tirada da silhueta grudaria nele), e cada um
 * pinta a sua, como os Ratos. O giro gira o bando no teto e cada um no próprio rumo; a luz não gira.
 */

const MEMBRANA: Rgb = [80, 66, 66]
const MEMBRANA_CLARA: Rgb = [116, 100, 94]
const OSSO: Rgb = [52, 42, 42]
const PELO: Rgb = [96, 78, 68]
const PELO_CLARO: Rgb = [136, 114, 98]
/** O contorno no escuro da própria pele, nunca o preto (a régua dos carimbos quer a beira acima de 0,15 de brilho). */
const CONTORNO: Rgb = [56, 46, 48]
const SOMBRA: Rgb = [24, 20, 22]

/** O teto visto de cima e um pouco de frente: menos achatado que o chão das pedras, para a asa ler. */
const ACHATA = 0.72
/** O meio do bando no quadro (no alto: está no teto). */
const MEIO = { x: 0, y: -0.62 } as const
/**
 * A sombra no chão: o quanto ela cai do bando (para baixo e para a direita, longe da luz) e a força. Mais longe que
 * isto ela encostava no pé do quadro e era cortada no mapa.
 */
const SOMBRA_NO_CHAO = { dx: 0.1, dy: 0.36, alfa: 0.085, abre: 1.06 } as const
/** O contorno de cada um: a grossura (no referencial dele) e a força. */
const TRACO = { grossura: 0.008, alfa: 1 } as const
/** O quanto a asa que olha para a luz acende (e a outra apaga). */
const LUZ_NA_ASA = 0.5

type Ponto = readonly [number, number]

interface Morcego {
  /** O lugar no teto, antes do giro (o y do teto sem achatar). */
  readonly x: number
  readonly y: number
  readonly escala: number
  /** Para onde a cabeça aponta (radianos; 0 = para cima na tela). */
  readonly rumo: number
  /** O quanto as asas estão abertas na batida (1 = de todo). */
  readonly abre: number
}

const BANDO: readonly Morcego[] = [
  { x: -0.22, y: -0.1, escala: 0.92, rumo: -0.5, abre: 1 },
  { x: 0.18, y: -0.28, escala: 0.74, rumo: 0.4, abre: 0.72 },
  { x: 0.26, y: 0.14, escala: 0.82, rumo: 0.95, abre: 0.92 },
  { x: -0.03, y: 0.28, escala: 0.62, rumo: -1.25, abre: 0.6 },
  { x: -0.32, y: 0.26, escala: 0.56, rumo: 2.5, abre: 0.84 },
]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Os pontos de uma asa (a da direita; a da esquerda é o espelho), no referencial do morcego (cabeça para -y). */
function pontosDaAsa(abre: number): { ombro: Ponto; pulso: Ponto; dedos: readonly Ponto[]; tornozelo: Ponto } {
  const e = 0.45 + 0.55 * abre
  return {
    ombro: [0.028, -0.028],
    pulso: [0.11 * e, -0.078 + (1 - abre) * 0.02],
    dedos: [
      [0.255 * e, 0.004 + (1 - abre) * 0.05],
      [0.19 * e, 0.086],
      [0.1 * e, 0.106],
    ],
    tornozelo: [0.034, 0.066],
  }
}

/** O caminho de uma asa: a beira da frente (braço e dedo da ponta) e a de trás, em arcos de dedo a dedo. */
function caminhoDaAsa(g: CanvasRenderingContext2D, lado: number, abre: number): void {
  const a = pontosDaAsa(abre)
  const x = (p: Ponto): number => p[0] * lado
  g.beginPath()
  g.moveTo(x(a.ombro), a.ombro[1])
  g.quadraticCurveTo(x([(a.ombro[0] + a.pulso[0]) / 2, a.pulso[1] - 0.012]), (a.ombro[1] + a.pulso[1]) / 2 - 0.012, x(a.pulso), a.pulso[1])
  g.quadraticCurveTo(x([(a.pulso[0] + a.dedos[0][0]) / 2, 0]), (a.pulso[1] + a.dedos[0][1]) / 2 - 0.018, x(a.dedos[0]), a.dedos[0][1])
  const fim: readonly Ponto[] = [...a.dedos, a.tornozelo]
  for (let i = 1; i < fim.length; i++) {
    const [p, q] = [fim[i - 1], fim[i]]
    // O arco puxa para o pulso: a pele entre dois dedos cede.
    const meio: Ponto = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    const controle: Ponto = [meio[0] + (a.pulso[0] - meio[0]) * 0.26, meio[1] + (a.pulso[1] - meio[1]) * 0.26]
    g.quadraticCurveTo(x(controle), controle[1], x(q), q[1])
  }
  g.closePath()
}

/** Os ossos riscados na asa: o braço até o pulso e os três dedos. */
function ossosDaAsa(g: CanvasRenderingContext2D, lado: number, abre: number): void {
  const a = pontosDaAsa(abre)
  g.beginPath()
  g.moveTo(a.ombro[0] * lado, a.ombro[1])
  g.lineTo(a.pulso[0] * lado, a.pulso[1])
  for (const d of a.dedos) {
    g.moveTo(a.pulso[0] * lado, a.pulso[1])
    g.lineTo(d[0] * lado, d[1])
  }
  g.stroke()
}

/** O corpo, a cabeça e as orelhas (o pelo, com o lado da luz mais claro). */
function pintarCorpo(g: CanvasRenderingContext2D, luz: Ponto): void {
  g.fillStyle = css(PELO)
  g.beginPath()
  g.ellipse(0, 0.01, 0.034, 0.058, 0, 0, Math.PI * 2)
  g.moveTo(0.026, -0.062)
  g.ellipse(0, -0.062, 0.026, 0.024, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  // As orelhas: dois bicos para a frente.
  g.fillStyle = css(MEMBRANA)
  for (const lado of [-1, 1]) {
    g.beginPath()
    g.moveTo(0.008 * lado, -0.078)
    g.lineTo(0.024 * lado, -0.106)
    g.lineTo(0.026 * lado, -0.07)
    g.closePath()
    g.fill()
    g.stroke()
  }
  // O claro do pelo, do lado da luz.
  g.fillStyle = css(PELO_CLARO, 0.75)
  g.beginPath()
  g.ellipse(luz[0] * 0.012, -0.004 + luz[1] * 0.018, 0.016, 0.03, 0, 0, Math.PI * 2)
  g.moveTo(luz[0] * 0.008 + 0.011, -0.068 + luz[1] * 0.006)
  g.ellipse(luz[0] * 0.008, -0.068 + luz[1] * 0.006, 0.011, 0.01, 0, 0, Math.PI * 2)
  g.fill()
}

/** Um morcego no referencial dele: as asas, a pele do rabo, os ossos e o corpo. */
function pintarMorcego(g: CanvasRenderingContext2D, rumo: number, abre: number): void {
  // A luz no referencial do morcego (de cima à esquerda na tela, girada de volta pelo rumo).
  const [c, s] = [Math.cos(-rumo), Math.sin(-rumo)]
  const luz: Ponto = [-0.6 * c + 0.8 * s, -0.6 * s - 0.8 * c]
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = css(CONTORNO, TRACO.alfa)
  g.lineWidth = TRACO.grossura
  for (const lado of [-1, 1]) {
    const voltada = Math.max(-1, Math.min(1, lado * luz[0]))
    const tom = voltada >= 0 ? misturar(MEMBRANA, MEMBRANA_CLARA, voltada * LUZ_NA_ASA) : misturar(MEMBRANA, CONTORNO, -voltada * LUZ_NA_ASA * 0.6)
    g.fillStyle = css(tom)
    caminhoDaAsa(g, lado, abre)
    g.fill()
    g.stroke()
  }
  // A pele do rabo, entre os tornozelos.
  g.fillStyle = css(MEMBRANA)
  g.beginPath()
  g.moveTo(-0.034, 0.06)
  g.quadraticCurveTo(-0.03, 0.11, 0, 0.122)
  g.quadraticCurveTo(0.03, 0.11, 0.034, 0.06)
  g.closePath()
  g.fill()
  g.stroke()
  g.strokeStyle = css(OSSO, 0.85)
  g.lineWidth = 0.005
  for (const lado of [-1, 1]) ossosDaAsa(g, lado, abre)
  g.strokeStyle = css(CONTORNO, TRACO.alfa)
  g.lineWidth = TRACO.grossura
  pintarCorpo(g, luz)
}

/** A silhueta inteira de um morcego, chapada (para a sombra no chão). */
function silhueta(g: CanvasRenderingContext2D, abre: number): void {
  for (const lado of [-1, 1]) {
    caminhoDaAsa(g, lado, abre)
    g.fill()
  }
  g.beginPath()
  g.ellipse(0, 0, 0.036, 0.07, 0, 0, Math.PI * 2)
  g.fill()
}

function desenharMorcegos(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const [c, s] = [Math.cos(giro), Math.sin(giro)]
  const morcegos = BANDO.map((m, i) => {
    const x = m.x * c - m.y * s
    const y = m.x * s + m.y * c
    return {
      x: MEIO.x + x,
      y: MEIO.y + y * ACHATA,
      escala: m.escala * (0.92 + 0.16 * sorteio(semente, i)),
      rumo: m.rumo + giro + (sorteio(semente, 10 + i) - 0.5) * 0.5,
      abre: Math.min(1, Math.max(0.5, m.abre + (sorteio(semente, 20 + i) - 0.5) * 0.24)),
    }
  })
  // A sombra no chão, longe e fraca: uma mancha de cada um, um nada mais aberta (luz de longe espalha).
  g.fillStyle = css(SOMBRA, SOMBRA_NO_CHAO.alfa)
  for (const m of morcegos) {
    g.save()
    g.translate(m.x + SOMBRA_NO_CHAO.dx, m.y + SOMBRA_NO_CHAO.dy)
    g.scale(m.escala * SOMBRA_NO_CHAO.abre, m.escala * SOMBRA_NO_CHAO.abre * ACHATA * 0.8)
    g.rotate(m.rumo)
    silhueta(g, m.abre)
    g.restore()
  }
  // De trás para a frente.
  for (const m of [...morcegos].sort((a, b) => a.y - b.y)) {
    g.save()
    g.translate(m.x, m.y)
    g.scale(m.escala, m.escala * ACHATA)
    g.rotate(m.rumo)
    pintarMorcego(g, m.rumo, m.abre)
    g.restore()
  }
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'morcegos',
  nome: 'Morcegos',
  tamanho: 9,
  sombra: 'nenhuma',
  desenhar: desenharMorcegos,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [MEMBRANA, MEMBRANA_CLARA, OSSO, PELO, PELO_CLARO, CONTORNO, SOMBRA]
