import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Algas na areia (item 135 dos carimbos de 14/11/2026): o bolo de algas que
 * a maré larga na praia, deitado no chão. O que diz "alga" (e não galho nem
 * corda) são as LÂMINAS: fitas chatas, compridas e onduladas, de ponta
 * rombuda e beira franzida, que se cruzam num cordão (mais oliva e verde que
 * marrom: a lâmina marrom sozinha lia como folha seca) e o
 * BRILHO MOLHADO: um risco claro e transparente no meio de cada lâmina, do
 * lado da luz. Cada lâmina tem por baixo a beira escura (a espessura e a
 * sombra rente na lâmina de baixo), deslocada para baixo à direita. Por
 * cima, uma folha crespa de alface-do-mar, de verde mais vivo, e um ou dois
 * raminhos da alga-bexiga (o talo fino em forquilha com as bexigas
 * redondas). Por baixo, a areia molhada num véu transparente de beira
 * torta. Sem sombra (rente, como a poça). O giro gira o cordão e troca as
 * ondas e a pilha; a luz não gira.
 */

const AREIA_MOLHADA: Rgb = [118, 100, 70]
const MARROM_SOMBRA: Rgb = [70, 60, 34]
const MARROM: Rgb = [112, 98, 52]
const OLIVA_SOMBRA: Rgb = [62, 70, 38]
const OLIVA: Rgb = [104, 112, 56]
const VERDE_SOMBRA: Rgb = [44, 70, 46]
const VERDE: Rgb = [72, 108, 66]
const BRILHO_MOLHADO: Rgb = [206, 204, 166]
const TALO: Rgb = [92, 84, 42]
const BEXIGA_BRILHO: Rgb = [170, 160, 104]
const ALFACE: Rgb = [100, 140, 76]
const ALFACE_CLARA: Rgb = [146, 176, 106]

/** Mais oliva e verde que marrom: a lâmina marrom sozinha lia como folha seca. */
const TIPOS: readonly { readonly sombra: Rgb; readonly corpo: Rgb }[] = [
  { sombra: OLIVA_SOMBRA, corpo: OLIVA },
  { sombra: MARROM_SOMBRA, corpo: MARROM },
  { sombra: VERDE_SOMBRA, corpo: VERDE },
  { sombra: OLIVA_SOMBRA, corpo: OLIVA },
  { sombra: MARROM_SOMBRA, corpo: MARROM },
  { sombra: VERDE_SOMBRA, corpo: VERDE },
  { sombra: OLIVA_SOMBRA, corpo: OLIVA },
]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
const MEIO_Y = -0.02
/** Pontos de cada beira de uma lâmina. */
const PASSOS = 14

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function tela(x: number, y: number): Ponto {
  return [x, MEIO_Y + y * ACHATA]
}

function poligono(g: CanvasRenderingContext2D, pontos: readonly Ponto[], dx: number, dy: number): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)))
  g.closePath()
}

interface Lamina {
  /** O meio da lâmina no chão (antes de achatar). */
  readonly x: number
  readonly y: number
  /** Para onde ela corre, no chão. */
  readonly a: number
  readonly comprimento: number
  readonly largura: number
  readonly onda: number
  readonly fase: number
  readonly sombra: Rgb
  readonly corpo: Rgb
}

/** Uma lâmina chata: o meio ondula, a largura afina nas pontas e a beira franze. */
function desenharLamina(g: CanvasRenderingContext2D, l: Lamina): void {
  const c = Math.cos(l.a)
  const s = Math.sin(l.a)
  const meio: Ponto[] = []
  const contorno: Ponto[] = []
  const volta: Ponto[] = []
  for (let k = 0; k <= PASSOS; k++) {
    const t = k / PASSOS
    const u = (t - 0.5) * l.comprimento
    const v = Math.sin(l.fase + t * Math.PI * 3) * l.onda
    // Fita comprida de ponta rombuda: a largura cai pouco nas pontas (a ponta fina lia como folha).
    const largura = (l.largura / 2) * (0.45 + 0.55 * Math.pow(Math.sin(Math.PI * (0.04 + t * 0.92)), 0.5))
    const franzeA = 1 + 0.22 * Math.sin(l.fase * 3 + t * 23)
    const franzeB = 1 + 0.22 * Math.sin(l.fase * 5 + t * 21 + 1.7)
    const x = l.x + c * u - s * v
    const y = l.y + s * u + c * v
    meio.push(tela(x, y))
    contorno.push(tela(x - s * largura * franzeA, y + c * largura * franzeA))
    volta.push(tela(x + s * largura * franzeB, y - c * largura * franzeB))
  }
  const forma = [...contorno, ...volta.reverse()]
  g.fillStyle = css(l.sombra)
  poligono(g, forma, 0.007, 0.01)
  g.fill()
  g.fillStyle = css(l.corpo)
  poligono(g, forma, 0, 0)
  g.fill()
  // O brilho molhado: um risco claro e transparente pelo meio, puxado para a luz.
  g.strokeStyle = css(BRILHO_MOLHADO, 0.5)
  g.lineWidth = 0.016
  g.lineCap = 'round'
  g.beginPath()
  const de = Math.round(PASSOS * 0.15)
  const ate = Math.round(PASSOS * 0.6)
  for (let k = de; k <= ate; k++) {
    const [x, y] = meio[k]
    if (k === de) g.moveTo(x - 0.006, y - 0.008)
    else g.lineTo(x - 0.006, y - 0.008)
  }
  g.stroke()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const ax = Math.cos(giro)
  const ay = Math.sin(giro)
  // Do bolo (ao longo `u`, de través `v`) para o chão.
  const noChao = (u: number, v: number): Ponto => [ax * u - ay * v, ay * u + ax * v]

  const n = TIPOS.length
  const laminas: Lamina[] = TIPOS.map((tipo, i) => {
    const [x, y] = noChao((sorteio(semente, i) - 0.5) * 0.22, (i / (n - 1) - 0.5) * 0.2 + (sorteio(semente, 10 + i) - 0.5) * 0.06)
    return {
      x,
      y,
      // O cordão: as fitas correm quase no rumo do giro, umas para cada lado, e se cruzam.
      a: giro + (sorteio(semente, 20 + i) - 0.5) * 0.9 + (i % 2 === 0 ? 0 : Math.PI),
      comprimento: 0.6 + 0.12 * sorteio(semente, 30 + i),
      largura: 0.075 + 0.025 * sorteio(semente, 40 + i),
      onda: 0.035 + 0.025 * sorteio(semente, 50 + i),
      fase: sorteio(semente, 60 + i) * Math.PI * 2,
      sombra: tipo.sombra,
      corpo: tipo.corpo,
    }
  })

  // A areia molhada por baixo: a união de manchas no meio de cada lâmina, transparente.
  g.fillStyle = css(AREIA_MOLHADA, 0.22)
  g.beginPath()
  for (const l of laminas) {
    const [x, y] = tela(l.x, l.y)
    g.moveTo(x + 0.2, y)
    g.ellipse(x, y, 0.2, 0.2 * ACHATA * 0.8, 0, 0, Math.PI * 2)
  }
  g.fill()

  // A pilha: a ordem sorteada, para o leque não sair sempre igual.
  const ordem = laminas.map((l, i) => ({ l, chave: sorteio(semente, 70 + i) })).sort((p, q) => p.chave - q.chave)
  for (const { l } of ordem) desenharLamina(g, l)

  // A alface-do-mar: uma folha crespa (a beira em ondas), clara no alto à esquerda.
  const [lx, ly] = noChao((sorteio(semente, 80) - 0.5) * 0.24, (sorteio(semente, 81) - 0.5) * 0.1)
  const fase = sorteio(semente, 82) * Math.PI * 2
  for (const [cor, encolhe, dx, dy] of [
    [ALFACE, 1, 0, 0],
    [ALFACE_CLARA, 0.55, -0.02, -0.014],
  ] as const) {
    const pontos: Ponto[] = []
    for (let k = 0; k < 18; k++) {
      const b = (k / 18) * Math.PI * 2
      const r = 0.085 * encolhe * (1 + 0.2 * Math.sin(b * 5 + fase))
      pontos.push(tela(lx + Math.cos(b) * r, ly + Math.sin(b) * r))
    }
    g.fillStyle = css(cor)
    poligono(g, pontos, dx, dy)
    g.fill()
  }

  // A alga-bexiga: um ou dois raminhos, o talo fino em forquilha e as bexigas.
  const raminhos = sorteio(semente, 90) < 0.5 ? 1 : 2
  const bexigas: Ponto[] = []
  g.strokeStyle = css(TALO)
  g.lineWidth = 0.02
  g.lineCap = 'round'
  g.beginPath()
  for (let r = 0; r < raminhos; r++) {
    const [bx, by] = noChao(r === 0 ? 0.2 : -0.22, (sorteio(semente, 91 + r) - 0.5) * 0.14)
    const a = giro + (r === 0 ? 0.5 : Math.PI - 0.5) + (sorteio(semente, 93 + r) - 0.5) * 0.6
    const jx = bx + Math.cos(a) * 0.09
    const jy = by + Math.sin(a) * 0.09
    const pe = tela(bx, by)
    const junta = tela(jx, jy)
    g.moveTo(pe[0], pe[1])
    g.lineTo(junta[0], junta[1])
    for (const abre of [-0.5, 0.45]) {
      const ponta = tela(jx + Math.cos(a + abre) * 0.08, jy + Math.sin(a + abre) * 0.08)
      g.moveTo(junta[0], junta[1])
      g.lineTo(ponta[0], ponta[1])
      bexigas.push([(junta[0] + ponta[0]) / 2, (junta[1] + ponta[1]) / 2], ponta)
    }
    bexigas.push([(pe[0] + junta[0]) / 2, (pe[1] + junta[1]) / 2])
  }
  g.stroke()
  g.fillStyle = css(TALO)
  g.beginPath()
  for (const [x, y] of bexigas) {
    g.moveTo(x + 0.022, y)
    g.ellipse(x, y, 0.022, 0.018, 0, 0, Math.PI * 2)
  }
  g.fill()
  g.fillStyle = css(BEXIGA_BRILHO)
  g.beginPath()
  for (const [x, y] of bexigas) {
    g.moveTo(x - 0.0005, y - 0.006)
    g.ellipse(x - 0.0075, y - 0.006, 0.007, 0.005, 0, 0, Math.PI * 2)
  }
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'algas', nome: 'Algas na areia', tamanho: 8, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [
  AREIA_MOLHADA,
  MARROM_SOMBRA,
  MARROM,
  OLIVA_SOMBRA,
  OLIVA,
  VERDE_SOMBRA,
  VERDE,
  BRILHO_MOLHADO,
  TALO,
  BEXIGA_BRILHO,
  ALFACE,
  ALFACE_CLARA,
]
