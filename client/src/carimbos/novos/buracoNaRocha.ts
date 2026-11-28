import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { facesDaRocha, pintarRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Buraco na rocha (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e
 * mina): a boca de um poço no chão da caverna, um abismo. Visto de cima e um pouco de frente, como o chão das pedras:
 * a borda irregular, a PAREDE de dentro do lado de lá (a única que se vê) descendo até sumir no escuro do fundo, com
 * as camadas da pedra riscadas nela, e o tom de cada trecho dela pela direção para onde ele olha (a luz vem de cima à
 * esquerda: o lado de dentro da DIREITA, que olha para a luz, acende; o fundo e a esquerda ficam no escuro). Em volta,
 * a beira de pedra lascada, as pedras soltas na boca (cada uma com a sombra de contato dela), as rachaduras que saem
 * do buraco e o pedrisco. O fundo é escuro mas não preto. É do chão (`sombra: 'nenhuma'`). O giro gira a boca no chão
 * (a forma e as pedras); a luz não gira.
 */

/** O fundo do poço: o escuro da rocha, nunca o preto. */
const FUNDO: Rgb = [28, 25, 27]
/** A parede de dentro: do lado que não pega luz ao que pega. */
const PAREDE: TonsDaRocha = { escura: [60, 54, 54], meia: [92, 86, 82], clara: [132, 124, 114] }
/** As camadas riscadas na parede e as rachaduras no chão. */
const FRESTA: Rgb = [46, 42, 44]
/** A beira de pedra lascada em volta da boca e a quina de cima da parede do lado de lá, que pega a luz do alto. */
const BEIRA: Rgb = [104, 98, 92]
const QUINA: Rgb = [156, 148, 136]
/** As pedras soltas na boca e o pedrisco: a rocha das lascas do Pilar de rocha. */
const PEDRA: TonsDaRocha = { escura: [72, 68, 68], meia: [108, 102, 98], clara: [150, 144, 134] }
const SOMBRA: Rgb = [24, 20, 22]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** O meio da boca no quadro. */
const MEIO_Y = -0.12
/** A boca no chão: o raio, o quanto ela é mais curta de través e quantos pontos tem a borda. */
const BOCA = { raio: 0.46, curta: 0.8, pontos: 24 } as const
/** O lábio de pedra rente à boca, cheio (a beira do que se vê em volta do escuro), em fração do raio. */
const LABIO = 1.06
/** O quanto a parede desce na tela antes de sumir no escuro. */
const PROFUNDIDADE = 0.19
/** A beira de pedra: o quanto ela passa da boca, a força e a do contorno de fora dela. */
const BEIRA_DA_BOCA = { escala: 1.15, alfa: 0.62, contorno: 0.4 } as const
/** Os degraus de camada da parede, da boca ao escuro do fundo. */
const CAMADAS_DA_PAREDE = 5
/** O pé do quadro da biblioteca, um nada para dentro: nenhum número passa dele. */
const PE_DO_QUADRO = 0.29
/** As pedras soltas na boca: quantas e o raio delas. */
const PEDRAS = { quantas: 5, raio: 0.044 } as const
/** O pedrisco espalhado na beira: quantos. */
const PEDRISCO = 7
/** As rachaduras que saem do buraco: quantas e o comprimento (no chão). */
const RACHADURAS = { quantas: 4, comprimento: 0.16 } as const

type Ponto = readonly [number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** Do chão para a tela, a `escala` do meio da boca. */
function naTela([x, y]: Ponto, escala = 1): Ponto {
  return [x * escala, MEIO_Y + y * escala * ACHATA]
}

/** O raio relativo da boca no ângulo `a` (antes do giro): três ondas e um nada de lasca em cada ponto. */
function raioDaBoca(a: number, k: number, semente: number): number {
  const f = (i: number): number => sorteio(semente, i) * Math.PI * 2
  return 1 + 0.08 * Math.sin(2 * a + f(1)) + 0.06 * Math.sin(3 * a + f(2)) + 0.04 * Math.sin(5 * a + f(3)) + 0.05 * (sorteio(semente, 10 + k) - 0.5)
}

/** A borda da boca no chão (já girada), de ponto em ponto. */
function bordaDaBoca(giro: number, semente: number): Ponto[] {
  const [c, s] = [Math.cos(giro), Math.sin(giro)]
  return Array.from({ length: BOCA.pontos }, (_, k): Ponto => {
    const a = (k / BOCA.pontos) * Math.PI * 2
    const r = BOCA.raio * raioDaBoca(a, k, semente)
    const [x, y] = [Math.cos(a) * r, Math.sin(a) * r * BOCA.curta]
    return [x * c - y * s, x * s + y * c]
  })
}

/** A borda do lado de lá da boca, da ponta da esquerda à da direita, por cima (o trecho de onde se vê a parede). */
function bordaDeLa(boca: readonly Ponto[]): Ponto[] {
  const n = boca.length
  const xs = boca.map((p) => p[0])
  const esquerda = xs.indexOf(Math.min(...xs))
  const direita = xs.indexOf(Math.max(...xs))
  const andar = (passo: number): Ponto[] => {
    const trecho: Ponto[] = []
    for (let k = esquerda; ; k = (k + passo + n) % n) {
      trecho.push(boca[k])
      if (k === direita) return trecho
    }
  }
  const [um, outro] = [andar(1), andar(-1)]
  const meioY = (t: readonly Ponto[]): number => t.reduce((s, p) => s + p[1], 0) / t.length
  return meioY(um) < meioY(outro) ? um : outro
}

/**
 * A parede de dentro, em CAMADAS da pedra: faixas que descem da borda do lado de lá, cada uma mais funda e mais
 * escura, até o escuro do fundo (o recorte da boca corta o que passa dela). De través, cada camada vai do lado de
 * dentro da esquerda, que fica de costas para a luz, ao da direita, que olha para ela. Um trecho por segmento da
 * borda, cada um com o seu degradê, emendava em listras de pé; a boca inteira descida a cada camada pesava demais.
 */
function pintarParede(g: CanvasRenderingContext2D, boca: readonly Ponto[]): void {
  g.fillStyle = css(FUNDO)
  caminho(g, boca)
  g.fill()
  const la = bordaDeLa(boca)
  const [esquerda, direita] = [la[0][0], la[la.length - 1][0]]
  const descida = (d: number): Ponto[] => la.map(([x, y]): Ponto => [x, Math.min(PE_DO_QUADRO, y + d)])
  for (let j = 0; j < CAMADAS_DA_PAREDE; j++) {
    const escuro = Math.pow(j / CAMADAS_DA_PAREDE, 0.75)
    const degrade = g.createLinearGradient(esquerda, 0, direita, 0)
    degrade.addColorStop(0, css(misturar(PAREDE.escura, FUNDO, escuro)))
    degrade.addColorStop(0.5, css(misturar(PAREDE.meia, FUNDO, escuro)))
    degrade.addColorStop(1, css(misturar(PAREDE.clara, FUNDO, escuro)))
    g.fillStyle = degrade
    // A faixa passa um nada da de baixo: a emenda não deixa um fio do fundo.
    const de = (PROFUNDIDADE * j) / CAMADAS_DA_PAREDE
    const ate = (PROFUNDIDADE * (j + 1.15)) / CAMADAS_DA_PAREDE
    caminho(g, [...descida(de), ...descida(ate).reverse()])
    g.fill()
  }
}

/** As rachaduras que saem da boca para o chão: cada uma em três trechos tortos, afinando. */
function pintarRachaduras(g: CanvasRenderingContext2D, borda: readonly Ponto[], semente: number): void {
  g.strokeStyle = css(FRESTA, 0.6)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let i = 0; i < RACHADURAS.quantas; i++) {
    const k = Math.floor(((i + sorteio(semente, 40 + i) * 0.6) / RACHADURAS.quantas) * borda.length) % borda.length
    const [x0, y0] = borda[k]
    let rumo = Math.atan2(y0, x0)
    let [x, y] = [x0, y0]
    const comprimento = RACHADURAS.comprimento * (0.7 + 0.6 * sorteio(semente, 50 + i))
    for (let t = 0; t < 3; t++) {
      rumo += (sorteio(semente, 60 + i * 3 + t) - 0.5) * 0.9
      const passo = comprimento / 3
      const [nx, ny] = [x + Math.cos(rumo) * passo, y + Math.sin(rumo) * passo]
      g.lineWidth = 0.011 * (1 - t * 0.3)
      g.beginPath()
      g.moveTo(...naTela([x, y]))
      g.lineTo(...naTela([nx, ny]))
      g.stroke()
      ;[x, y] = [nx, ny]
    }
  }
}

/** Uma pedra solta na boca, com a sombra de contato dela (o carimbo é do chão: a sombra é de cada pedra). */
function pintarPedra(g: CanvasRenderingContext2D, [x, y]: Ponto, raio: number, giro: number, semente: number): void {
  g.fillStyle = css(SOMBRA, 0.3)
  g.beginPath()
  g.ellipse(x + raio * 0.35, y + raio * 0.2, raio * 1.1, raio * 0.62, 0, 0, Math.PI * 2)
  g.fill()
  pintarRocha(
    g,
    facesDaRocha({
      cx: x,
      cy: y,
      raio,
      altura: raio * 0.66,
      lados: 5,
      aneis: [
        [0, 1],
        [1, 0.6],
      ],
      recuo: 0.08,
      aspereza: 0.45,
      picos: 0.5,
      giro,
      semente,
    }),
    PEDRA,
    0.1,
  )
}

function desenharBuracoNaRocha(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const borda = bordaDaBoca(giro, semente)
  const boca = borda.map((p) => naTela(p))
  // A beira de pedra lascada em volta, macia para fora, e as rachaduras que saem dela.
  g.fillStyle = css(BEIRA, BEIRA_DA_BOCA.alfa)
  caminho(g, borda.map((p) => naTela(p, BEIRA_DA_BOCA.escala)))
  g.fill()
  g.strokeStyle = css(FRESTA, BEIRA_DA_BOCA.contorno)
  g.lineWidth = 0.008
  g.lineJoin = 'round'
  g.stroke()
  pintarRachaduras(g, borda, semente)
  // O lábio cheio rente à boca: a beira do escuro fica na pedra, não no fundo (nem preta).
  g.fillStyle = css(BEIRA)
  caminho(g, borda.map((p) => naTela(p, LABIO)))
  g.fill()
  // O poço: a parede do lado de lá, camada por camada até o escuro do fundo (a do lado de cá sai da boca e o recorte
  // a corta). A primeira camada cobre a boca inteira: não precisa de um fundo por baixo.
  g.save()
  caminho(g, boca)
  g.clip()
  pintarParede(g, boca)
  g.restore()
  // A boca: o contorno escuro e, do lado de lá, a quina de cima da parede que pega a luz do alto.
  g.lineJoin = 'round'
  g.strokeStyle = css(FRESTA, 0.8)
  g.lineWidth = 0.012
  caminho(g, boca)
  g.stroke()
  g.strokeStyle = css(QUINA, 0.75)
  g.lineWidth = 0.009
  g.beginPath()
  const atras = boca.map((p, k) => ({ p, k })).filter(({ p }) => p[1] < MEIO_Y - 0.02)
  atras.forEach(({ p }, i) => (i === 0 || atras[i - 1].k !== (atras[i].k + boca.length - 1) % boca.length ? g.moveTo(p[0], p[1] - 0.004) : g.lineTo(p[0], p[1] - 0.004)))
  g.stroke()
  // As pedras soltas na boca, de trás para a frente.
  const pedras = Array.from({ length: PEDRAS.quantas }, (_, i) => {
    const k = Math.floor(((i + sorteio(semente, 70 + i) * 0.7) / PEDRAS.quantas) * borda.length) % borda.length
    const fora = 1.06 + 0.16 * sorteio(semente, 80 + i)
    return { p: naTela(borda[k], fora), r: PEDRAS.raio * (0.6 + 0.7 * sorteio(semente, 90 + i)), i }
  }).sort((a, b) => a.p[1] - b.p[1])
  for (const { p, r, i } of pedras) pintarPedra(g, p, r, giro + i * 1.7, semente + 100 + i)
  // O pedrisco espalhado na beira.
  for (let i = 0; i < PEDRISCO; i++) {
    const k = Math.floor(sorteio(semente, 120 + i) * borda.length)
    const [x, y] = naTela(borda[k], 1.12 + 0.22 * sorteio(semente, 130 + i))
    const r = 0.008 + 0.009 * sorteio(semente, 140 + i)
    g.fillStyle = css(sorteio(semente, 150 + i) > 0.5 ? PEDRA.clara : PEDRA.meia)
    g.beginPath()
    g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2)
    g.fill()
  }
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'buraco-na-rocha',
  nome: 'Buraco na rocha',
  tamanho: 12,
  sombra: 'nenhuma',
  desenhar: desenharBuracoNaRocha,
}

/** Todas as cores chapadas do desenho (a parede sai da rampa dela, misturada pela luz e pelo escuro do fundo). */
export const paleta: readonly Rgb[] = [FUNDO, PAREDE.escura, PAREDE.meia, PAREDE.clara, FRESTA, BEIRA, QUINA, PEDRA.escura, PEDRA.meia, PEDRA.clara, SOMBRA]
