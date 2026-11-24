import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cipós pendurados (lote L08 de 24/11/2026, item 79: a trepadeira que desce pelas bordas do templo do mapa 6, desenho
 * próprio). Vista de cima: a MASSA DE FOLHAGEM agarrada na borda (de onde a planta nasce), de contorno irregular e
 * feita de folhas miúdas apontando para todo lado, e, caindo dela, os RAMOS: de comprimentos BEM DIFERENTES (de 30% a
 * 100%, sem ordem: nem os do meio são os compridos), cada um mais fino para a ponta, ondulado, puxando para um lado
 * (alguns se cruzam), com as folhas ALTERNADAS, uma de cada lado, menores no fim. Em um ou dois, a florzinha creme na
 * ponta. É para pôr na beira de um muro, de um barranco, de um degrau ou de um telhado.
 *
 * O GIRO ESCOLHE PARA ONDE ELES CAEM: sem giro, para baixo na tela (a borda fica em cima); a cada 45 graus a borda e a
 * queda giram juntas. Como os ramos têm tamanhos sem ordem e a massa é irregular, o contorno nunca fecha num losango.
 *
 * A SOMBRA É PINTADA AQUI (`sombra: 'nenhuma'`: fica rente à parede, por baixo das sombras e dos outros objetos): cada
 * ramo deita na parede abaixo uma sombra deslocada para baixo e para a direita, MAIS CURTA que ele (a ponta fica
 * colada na parede), e a massa da borda, uma sombra curta. A luz não gira.
 */

const RAMO: Rgb = [46, 84, 54]
const MASSA: Rgb = [28, 76, 54]
const FOLHA_ESCURA: Rgb = [44, 108, 68]
const FOLHA_MEDIA: Rgb = [70, 136, 78]
const FOLHA_CLARA: Rgb = [112, 166, 92]
const FLOR: Rgb = [226, 210, 160]
const FLOR_SOMBRA: Rgb = [186, 166, 120]
/** A sombra pintada: a cor e a força da sombra única do mapa (`lib/sombra.ts`). */
const SOMBRA: Rgb = [10, 28, 40]
const FORCA_DA_SOMBRA = 0.26

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
const DA_BORDA_AO_MEIO = 0.4
const MEIA_BORDA = 0.36
const RAMOS = 7
/** O ramo mais comprido e os comprimentos de cada um (frações dele, de 30% a 100%), sem ordem. */
const COMPRIMENTO = 0.86
const TAMANHOS: readonly number[] = [0.56, 1, 0.32, 0.8, 0.44, 0.94, 0.66, 0.3, 0.74, 0.5]
/** O espaço entre duas folhas ao longo do ramo e o quanto a sombra pintada anda (para baixo à direita). */
const PASSO_DAS_FOLHAS = 0.052
const SOMBRA_ANDA: Ponto = [0.032, 0.05]
/** A sombra do ramo acaba antes dele: esta fração do comprimento. */
const SOMBRA_DO_RAMO = 0.7

/** Várias elipses giradas num caminho só: o preenchimento é a união delas. */
function rodas(g: CanvasRenderingContext2D, lista: readonly Roda[], cor: Rgb, alfa = 1): void {
  if (lista.length === 0) return
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  for (const [x, y, rx, ry, giro] of lista) {
    g.moveTo(x + Math.cos(giro) * rx, y + Math.sin(giro) * rx)
    g.ellipse(x, y, rx, ry, giro, 0, Math.PI * 2)
  }
  g.fill()
}

/** Um ramo: a linha do meio (pontos) e a meia grossura no pé; afina até a ponta. */
function fita(g: CanvasRenderingContext2D, pontos: readonly Ponto[], grossura: number, ate: number): void {
  const n = Math.max(2, Math.round((pontos.length - 1) * ate) + 1)
  const esquerda: Ponto[] = []
  const direita: Ponto[] = []
  for (let i = 0; i < n; i++) {
    const p = pontos[i]
    const q = pontos[Math.min(pontos.length - 1, i + 1)]
    const r = pontos[Math.max(0, i - 1)]
    const tx = q[0] - r[0]
    const ty = q[1] - r[1]
    const m = Math.hypot(tx, ty) || 1
    const w = grossura * (1 - (0.82 * i) / (pontos.length - 1))
    esquerda.push([p[0] - (ty / m) * w, p[1] + (tx / m) * w])
    direita.push([p[0] + (ty / m) * w, p[1] - (tx / m) * w])
  }
  g.moveTo(esquerda[0][0], esquerda[0][1])
  for (let i = 1; i < n; i++) g.lineTo(esquerda[i][0], esquerda[i][1])
  for (let i = n - 1; i >= 0; i--) g.lineTo(direita[i][0], direita[i][1])
  g.closePath()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Para onde os ramos caem e o rumo da borda (de través).
  const cai: Ponto = [-Math.sin(giro), Math.cos(giro)]
  const borda: Ponto = [Math.cos(giro), Math.sin(giro)]
  const origem: Ponto = [MEIO.x - cai[0] * DA_BORDA_AO_MEIO, MEIO.y - cai[1] * DA_BORDA_AO_MEIO]
  const em = (aoLongoDaBorda: number, caindo: number): Ponto => [origem[0] + borda[0] * aoLongoDaBorda + cai[0] * caindo, origem[1] + borda[1] * aoLongoDaBorda + cai[1] * caindo]
  const rumoDaQueda = Math.atan2(cai[1], cai[0])

  // Os ramos: cada um com o seu tamanho (sem ordem), o seu lado de puxar e as suas folhas alternadas.
  const ramos: Ponto[][] = []
  const claras: Roda[] = []
  const medias: Roda[] = []
  const escuras: Roda[] = []
  const flores: Ponto[] = []
  const salto = Math.floor(sorteio(semente, 1) * TAMANHOS.length)
  for (let i = 0; i < RAMOS; i++) {
    const s = ((i + 0.5) / RAMOS - 0.5) * 2 * MEIA_BORDA + (sorteio(semente, i) - 0.5) * 0.07
    const comprido = COMPRIMENTO * TAMANHOS[(i * 3 + salto) % TAMANHOS.length] * (0.9 + 0.1 * sorteio(semente, 10 + i))
    const fase = sorteio(semente, 20 + i) * 6
    const balanco = 0.016 + 0.02 * sorteio(semente, 30 + i)
    // O ramo puxa para um lado: dois vizinhos que puxam um para o outro se cruzam.
    const puxa = (sorteio(semente, 50 + i) - 0.5) * 0.3
    const no = (t: number): Ponto => em(s + puxa * comprido * t + Math.sin(t * 5.4 + fase) * balanco * (0.3 + t), 0.02 + comprido * t)
    const passos = Math.max(5, Math.round(comprido / 0.06))
    const linha: Ponto[] = []
    for (let k = 0; k <= passos; k++) linha.push(no(k / passos))
    ramos.push(linha)
    const quantas = Math.max(3, Math.round(comprido / PASSO_DAS_FOLHAS))
    for (let k = 1; k <= quantas; k++) {
      const t = k / quantas
      const p = no(t)
      // Uma folha de cada lado, alternando; as do fim são menores.
      const lado = (k + i) % 2 === 0 ? 1 : -1
      const a = rumoDaQueda - lado * (0.9 + 0.4 * sorteio(semente, 100 + i * 16 + k))
      const r = 0.044 * (1 - 0.55 * t) * (0.8 + 0.4 * sorteio(semente, 300 + i * 16 + k))
      const folha: Roda = [p[0] + Math.cos(a) * r * 0.9, p[1] + Math.sin(a) * r * 0.9, r, r * 0.5, a]
      const luz = voltadoParaALuz(Math.cos(a), Math.sin(a))
      if (luz > 0.62) claras.push(folha)
      else if (luz > 0.34) medias.push(folha)
      else escuras.push(folha)
    }
    if (comprido > COMPRIMENTO * 0.6 && sorteio(semente, 40 + i) < 0.45) flores.push(no(1))
  }

  // A massa da borda: um contorno irregular (nunca bolas em fila) e as folhas miúdas por cima.
  const contorno: Ponto[] = []
  const pontosDaMassa = 13
  for (let i = 0; i <= pontosDaMassa; i++) {
    const s = (i / pontosDaMassa - 0.5) * 2 * (MEIA_BORDA + 0.06)
    contorno.push(em(s, 0.035 + 0.06 * sorteio(semente, 60 + i)))
  }
  for (let i = pontosDaMassa; i >= 0; i--) {
    const s = (i / pontosDaMassa - 0.5) * 2 * (MEIA_BORDA + 0.04)
    contorno.push(em(s, -0.035 - 0.05 * sorteio(semente, 80 + i)))
  }
  const massa = (dx: number, dy: number): void => {
    g.beginPath()
    g.moveTo(contorno[0][0] + dx, contorno[0][1] + dy)
    for (let i = 1; i < contorno.length; i++) g.lineTo(contorno[i][0] + dx, contorno[i][1] + dy)
    g.closePath()
    g.fill()
  }

  // ---------- a SOMBRA pintada: os ramos (mais curta que eles) e a massa, deslocadas para baixo à direita ----------
  g.fillStyle = css(SOMBRA, FORCA_DA_SOMBRA)
  g.beginPath()
  for (const linha of ramos) fita(g, linha.map(([x, y]): Ponto => [x + SOMBRA_ANDA[0], y + SOMBRA_ANDA[1]]), 0.02, SOMBRA_DO_RAMO)
  g.fill()
  massa(SOMBRA_ANDA[0] * 0.8, SOMBRA_ANDA[1] * 0.8)

  // ---------- os RAMOS (afinando para a ponta) e as folhas ----------
  g.fillStyle = css(RAMO)
  g.beginPath()
  for (const linha of ramos) fita(g, linha, 0.012, 1)
  g.fill()
  rodas(g, escuras, FOLHA_ESCURA)
  rodas(g, medias, FOLHA_MEDIA)
  rodas(g, claras, FOLHA_CLARA)

  // As florzinhas creme na ponta de alguns ramos: três pétalas e a sombra delas.
  for (const [x, y] of flores) {
    rodas(g, [[x + 0.008, y + 0.01, 0.026, 0.022, 0]], FLOR_SOMBRA)
    rodas(g, [[x - 0.012, y - 0.004, 0.015, 0.013, 0], [x + 0.01, y - 0.008, 0.015, 0.013, 0], [x, y + 0.01, 0.015, 0.013, 0]], FLOR)
  }

  // ---------- a MASSA de folhagem na borda: o escuro e as folhas miúdas, em três tons, apontando para todo lado ----------
  g.fillStyle = css(MASSA)
  massa(0, 0)
  const daMassa: Roda[][] = [[], [], []]
  for (let i = 0; i < 34; i++) {
    const s = (sorteio(semente, 400 + i) - 0.5) * 2 * (MEIA_BORDA + 0.03)
    const [x, y] = em(s, (sorteio(semente, 440 + i) - 0.5) * 0.1)
    const a = sorteio(semente, 480 + i) * Math.PI * 2
    const r = 0.026 + 0.022 * sorteio(semente, 520 + i)
    const luz = voltadoParaALuz(Math.cos(a), Math.sin(a))
    daMassa[luz > 0.62 ? 2 : luz > 0.34 ? 1 : 0].push([x, y, r, r * 0.52, a])
  }
  rodas(g, daMassa[0], FOLHA_ESCURA)
  rodas(g, daMassa[1], FOLHA_MEDIA)
  rodas(g, daMassa[2], FOLHA_CLARA)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'cipos-pendurados', nome: 'Cipós pendurados', tamanho: 9, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [RAMO, MASSA, FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA, FLOR, FLOR_SOMBRA, SOMBRA]
