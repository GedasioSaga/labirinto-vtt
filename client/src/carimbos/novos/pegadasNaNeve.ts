import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Pegadas na neve (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a trilha de
 * quem passou a pé pela neve, quatro pegadas de bota alternadas (o pé esquerdo e o direito), cada uma um buraco raso
 * de sola e salto. A neve é a do Monte de neve (`monteDeNeve.ts`): o buraco é o azul da sombra, a parede de cima à
 * esquerda fica funda (de costas para a luz) e a de baixo à direita clareia (de frente para ela); em volta, a beirinha
 * levantada pega a luz do lado de cima. Duas marcas apagadas do solado atravessam a sola. Sem sombra (o buraco é no
 * chão). No TRAÇO, como as Pedras de passo, cada módulo vira para o rumo do arrasto e o seguinte começa um passo depois:
 * a trilha sai andando para onde o pincel foi.
 */

const NEVE_FUNDA: Rgb = [158, 176, 196]
const NEVE: Rgb = [222, 230, 238]
const NEVE_CLARA: Rgb = [240, 243, 245]
/** O chão da pegada: a neve socada, entre a sombra e o fundo. */
const PISO: Rgb = [172, 188, 205]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
/** O meio da trilha no quadro (um tanto acima do pé, como as Pedras de passo). */
const MEIO_Y = -0.06
const QUANTAS = 4
/** De uma pegada à outra ao longo do rumo (unidades do chão), e o quanto cada uma sai para o seu lado. */
const PASSO = 0.3
const DE_LADO = 0.07
/** A sola (meio comprimento e meia largura) e o salto, atrás dela, em unidades do chão. */
const SOLA = { ao: 0.082, traves: 0.04, frente: 0.03 } as const
const SALTO = { ao: 0.038, traves: 0.034, atras: -0.094 } as const
/** O tanto que a luz desloca as paredes do buraco (unidades da tela). */
const PAREDE = 0.013
const PONTOS = 16

type P = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function caminho(g: CanvasRenderingContext2D, lista: readonly (readonly P[])[], dx = 0, dy = 0): void {
  g.beginPath()
  for (const pontos of lista) {
    pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)))
    g.closePath()
  }
}

function pintar(g: CanvasRenderingContext2D, lista: readonly (readonly P[])[], cor: Rgb, alfa = 1, dx = 0, dy = 0): void {
  g.fillStyle = css(cor, alfa)
  caminho(g, lista, dx, dy)
  g.fill()
}

interface Pegada {
  readonly partes: P[][]
  readonly solado: [P, P][]
  readonly y: number
}

function pegadaDe(i: number, giro: number, semente: number): Pegada {
  // A posição no chão: ao longo do rumo, cada uma para o seu lado, alternando (o pé esquerdo e o direito).
  const t = (i - (QUANTAS - 1) / 2) * PASSO * (0.94 + 0.12 * sorteio(semente, i))
  const lado = (i % 2 === 0 ? 1 : -1) * DE_LADO * (0.8 + 0.4 * sorteio(semente, 10 + i))
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const gx = t * c - lado * s
  const gy = t * s + lado * c
  // O pé abre um nada para fora do caminho.
  const torce = giro + (i % 2 === 0 ? 1 : -1) * (0.1 + 0.12 * sorteio(semente, 20 + i))
  const tc = Math.cos(torce)
  const ts = Math.sin(torce)
  const naTela = (ao: number, traves: number): P => [gx + ao * tc - traves * ts, MEIO_Y + (gy + ao * ts + traves * tc) * ACHATA]
  const oval = (meio: number, ra: number, rt: number, bico: number): P[] =>
    Array.from({ length: PONTOS }, (_, k): P => {
      const a = (k / PONTOS) * Math.PI * 2
      // A ponta da bota é mais cheia que o meio da sola (o oval puxado para a frente).
      const cheio = 1 + bico * Math.cos(a)
      return naTela(meio + Math.cos(a) * ra, Math.sin(a) * rt * (0.86 + 0.14 * cheio))
    })
  const sola = oval(SOLA.frente, SOLA.ao, SOLA.traves, 0.25)
  const salto = oval(SALTO.atras, SALTO.ao, SALTO.traves, 0)
  const solado: [P, P][] = [-0.012, 0.03].map((ao): [P, P] => [naTela(SOLA.frente + ao, -SOLA.traves * 0.62), naTela(SOLA.frente + ao, SOLA.traves * 0.62)])
  return { partes: [sola, salto], solado, y: MEIO_Y + gy * ACHATA }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const pegadas = Array.from({ length: QUANTAS }, (_, i) => pegadaDe(i, giro, semente)).sort((a, b) => a.y - b.y)
  for (const p of pegadas) {
    // A beirinha levantada em volta, que pega a luz do lado de cima (fraca: na neve ela some, na grama não grita).
    pintar(g, p.partes, NEVE_CLARA, 0.3, -PAREDE * 0.8, -PAREDE * 0.8)
    // O buraco: a parede de cima à esquerda funda; a de baixo à direita pega a luz; no meio, o chão socado.
    pintar(g, p.partes, NEVE_FUNDA)
    g.save()
    caminho(g, p.partes)
    g.clip()
    pintar(g, p.partes, NEVE, 1, PAREDE, PAREDE)
    pintar(g, p.partes, PISO, 1, PAREDE * 0.45, PAREDE * 0.4)
    g.strokeStyle = css(NEVE_FUNDA, 0.45)
    g.lineWidth = 0.006
    g.lineCap = 'round'
    g.beginPath()
    for (const [a, b] of p.solado) {
      g.moveTo(a[0], a[1])
      g.lineTo(b[0], b[1])
    }
    g.stroke()
    g.restore()
  }
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'pegadas-na-neve',
  nome: 'Pegadas na neve',
  tamanho: 10,
  sombra: 'nenhuma',
  desenhar,
  traco: { espaco: QUANTAS * PASSO, rumo: true, achata: ACHATA },
}

export const paleta: readonly Rgb[] = [NEVE_FUNDA, NEVE, NEVE_CLARA, PISO]
