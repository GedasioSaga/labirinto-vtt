import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cipós pendurados (lote L08 de 24/11/2026, item 79: a trepadeira que desce pelas bordas do templo do mapa 6, desenho
 * próprio). Vista de cima: a MOITA estreita agarrada na borda (de onde a planta nasce) e, caindo dela, sete RAMOS de
 * comprimentos diferentes, ondulados, cada um com as folhinhas em par dos dois lados e, em dois ou três, as
 * florzinhas creme na ponta. É para pôr na beira de um muro, de um barranco, de um degrau ou de um telhado.
 *
 * O GIRO ESCOLHE PARA ONDE ELES CAEM: sem giro, para baixo na tela (a borda fica em cima); a cada 45° a borda e a
 * queda giram juntas, e o mestre veste qualquer lado do muro. O desenho gira em volta do meio do quadro, então o ponto
 * do clique fica perto do meio dos ramos. Fica rente à parede: a sombra é a silhueta deslizada um tanto curto
 * (`deitada`), que descola os ramos do fundo sem parecer que estão no ar. A luz não gira.
 */

const RAMO: Rgb = [46, 84, 54]
const MASSA: Rgb = [28, 76, 54]
const FOLHA_ESCURA: Rgb = [44, 108, 68]
const FOLHA_MEDIA: Rgb = [70, 136, 78]
const FOLHA_CLARA: Rgb = [112, 166, 92]
const FLOR: Rgb = [226, 210, 160]
const FLOR_SOMBRA: Rgb = [186, 166, 120]

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
type Roda = readonly [x: number, y: number, rx: number, ry: number, giro: number]

/** O meio do quadro (o desenho gira em volta dele) e as medidas, em unidades do tamanho. */
const MEIO = { x: 0, y: -0.45 } as const
const DA_BORDA_AO_MEIO = 0.44
const MEIA_BORDA = 0.4
const RAMOS = 7
const COMPRIMENTO_MINIMO = 0.46
const COMPRIMENTO_A_MAIS = 0.46
/** O espaço entre dois pares de folhas ao longo do ramo. */
const PASSO_DAS_FOLHAS = 0.068

/** Várias elipses giradas num caminho só: o preenchimento é a união delas. */
function rodas(g: CanvasRenderingContext2D, lista: readonly Roda[], cor: Rgb): void {
  if (lista.length === 0) return
  g.fillStyle = css(cor)
  g.beginPath()
  for (const [x, y, rx, ry, giro] of lista) {
    g.moveTo(x + Math.cos(giro) * rx, y + Math.sin(giro) * rx)
    g.ellipse(x, y, rx, ry, giro, 0, Math.PI * 2)
  }
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Para onde os ramos caem e o rumo da borda (de través).
  const cai: Ponto = [-Math.sin(giro), Math.cos(giro)]
  const borda: Ponto = [Math.cos(giro), Math.sin(giro)]
  const origem: Ponto = [MEIO.x - cai[0] * DA_BORDA_AO_MEIO, MEIO.y - cai[1] * DA_BORDA_AO_MEIO]
  const em = (aoLongoDaBorda: number, caindo: number): Ponto => [origem[0] + borda[0] * aoLongoDaBorda + cai[0] * caindo, origem[1] + borda[1] * aoLongoDaBorda + cai[1] * caindo]
  const rumoDaQueda = Math.atan2(cai[1], cai[0])

  const claras: Roda[] = []
  const medias: Roda[] = []
  const escuras: Roda[] = []
  const flores: Ponto[] = []

  // Os ramos: o risco ondulado e as folhas em par, alternando o lado.
  g.strokeStyle = css(RAMO)
  g.lineWidth = 0.017
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  for (let i = 0; i < RAMOS; i++) {
    const s = ((i + 0.5) / RAMOS - 0.5) * 2 * MEIA_BORDA + (sorteio(semente, i) - 0.5) * 0.05
    // Os do meio mais compridos; os das pontas, curtos.
    const noMeio = 1 - Math.abs((i + 0.5) / RAMOS - 0.5) * 1.1
    const comprido = COMPRIMENTO_MINIMO + COMPRIMENTO_A_MAIS * noMeio * (0.62 + 0.38 * sorteio(semente, 10 + i))
    const fase = sorteio(semente, 20 + i) * 6
    const balanco = 0.022 + 0.02 * sorteio(semente, 30 + i)
    const no = (t: number): Ponto => em(s + Math.sin(t * 5.4 + fase) * balanco * (0.3 + t), 0.03 + comprido * t)
    const passos = 9
    const p0 = no(0)
    g.moveTo(p0[0], p0[1])
    for (let k = 1; k <= passos; k++) {
      const p = no(k / passos)
      g.lineTo(p[0], p[1])
    }
    const pares = Math.max(3, Math.round(comprido / PASSO_DAS_FOLHAS))
    for (let k = 1; k <= pares; k++) {
      const t = k / pares
      const p = no(t)
      const lado = (k + i) % 2 === 0 ? 1 : -1
      // A folha abre para o lado e para baixo; as da ponta são menores.
      const a = rumoDaQueda - lado * (1 + 0.3 * sorteio(semente, 100 + i * 16 + k))
      const r = 0.047 * (1 - 0.38 * t) * (0.86 + 0.3 * sorteio(semente, 300 + i * 16 + k))
      const folha: Roda = [p[0] + Math.cos(a) * r * 0.86, p[1] + Math.sin(a) * r * 0.86, r, r * 0.56, a]
      const luz = voltadoParaALuz(Math.cos(a), Math.sin(a))
      if (luz > 0.62) claras.push(folha)
      else if (luz > 0.34) medias.push(folha)
      else escuras.push(folha)
    }
    if (sorteio(semente, 40 + i) < 0.34) flores.push(no(1))
  }
  g.stroke()
  rodas(g, escuras, FOLHA_ESCURA)
  rodas(g, medias, FOLHA_MEDIA)
  rodas(g, claras, FOLHA_CLARA)

  // As florzinhas creme na ponta de alguns ramos: três pétalas e a sombra delas.
  for (const [x, y] of flores) {
    rodas(g, [[x + 0.008, y + 0.01, 0.026, 0.022, 0]], FLOR_SOMBRA)
    rodas(g, [[x - 0.012, y - 0.004, 0.015, 0.013, 0], [x + 0.01, y - 0.008, 0.015, 0.013, 0], [x, y + 0.01, 0.015, 0.013, 0]], FLOR)
  }

  // A moita na borda: a massa escura, os gomos do meio e o realce do lado da luz.
  const gomos = 9
  const massa: Roda[] = []
  const meio: Roda[] = []
  const realce: Roda[] = []
  for (let i = 0; i < gomos; i++) {
    const s = ((i + 0.5) / gomos - 0.5) * 2 * (MEIA_BORDA + 0.05) + (sorteio(semente, 60 + i) - 0.5) * 0.04
    const r = 0.05 + 0.05 * sorteio(semente, 70 + i)
    const [x, y] = em(s, (sorteio(semente, 80 + i) - 0.5) * 0.07)
    massa.push([x + 0.006, y + 0.01, r, r * 0.9, 0])
    meio.push([x - r * 0.12, y - r * 0.16, r * 0.76, r * 0.68, 0])
    if (sorteio(semente, 90 + i) < 0.7) realce.push([x - r * 0.3, y - r * 0.36, r * 0.36, r * 0.3, 0])
  }
  rodas(g, massa, MASSA)
  rodas(g, meio, FOLHA_MEDIA)
  rodas(g, realce, FOLHA_CLARA)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'cipos-pendurados', nome: 'Cipós pendurados', tamanho: 9, sombra: 'deitada', desenhar }

export const paleta: readonly Rgb[] = [RAMO, MASSA, FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA, FLOR, FLOR_SOMBRA]
