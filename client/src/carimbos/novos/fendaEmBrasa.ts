import { css, type DefinicaoDeCarimbo, type DesenhoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Fenda em brasa (referências de 15/11/2026, lote L3: "o que falta das 4
 * referências", a "fenda com brilho vermelho", versão original no estilo
 * Meio-Termo): uma rachadura funda no chão, torta e de pontas finas, com um
 * ou dois galhos curtos, o chão em volta chamuscado e umas lascas soltas na
 * beira. Vista de cima e um pouco de frente, a boca da fenda mostra a PAREDE
 * DE LÁ (a de cá some atrás da beira), e o fundo, onde está a brasa, aparece
 * só rente à beira de cá.
 *
 * DOIS desenhos no mesmo quadro e no mesmo giro, como a Rocha vulcânica:
 * `desenhar` é a fenda com a brasa APAGADA (o vermelho-escuro da brasa
 * morna); `brilho` é SÓ o que acende (o fundo em brasa e a parede de lá
 * tingida por baixo), somado por cima e
 * pulsando no app, na borda da chama do app (`0xa04a2c`) e num miolo
 * vermelho-alaranjado, sem o amarelo do miolo da chama: o pedido é o brilho
 * VERMELHO. A fenda também ilumina em volta (`LUZ_DOS_CARIMBOS`, tremendo
 * como a brasa). É do chão (`sombra: 'nenhuma'`), como a poça. O giro gira a
 * fenda inteira; a luz não gira.
 */

/** O chão chamuscado em volta (por cima do chão do mapa, meio transparente). */
const CHAO_QUEIMADO: Rgb = [52, 40, 34]
/** A beira partida do chão, em volta da boca: terra queimada, clara o bastante para não virar contorno. */
const BEIRA: Rgb = [96, 82, 72]
/** A parede de lá: rocha de costas para a luz. */
const PAREDE: Rgb = [70, 58, 52]
/** O fundo da fenda, rente à beira de cá. */
const FUNDO: Rgb = [30, 20, 19]
/** A brasa morna, apagada: o que o fundo mostra de dia (a da Rocha vulcânica). */
const BRASA_APAGADA: Rgb = [112, 50, 42]
/** As lascas soltas na beira. */
const LASCA: Rgb = [92, 82, 74]
const LASCA_CLARA: Rgb = [132, 120, 108]
/** O que acende: a borda da chama do app (`0xa04a2c`) e o miolo vermelho-alaranjado. Só no `brilho`, fora da paleta. */
const BORDA_DA_CHAMA: Rgb = [160, 74, 44]
const MIOLO_VERMELHO: Rgb = [236, 132, 84]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/**
 * O meio da fenda no quadro: um tanto acima do pé, para a fenda de pé na tela (giro de 90°) não passar do y 0,3 do
 * quadro (na primeira folha, com -0,03, a ponta de baixo era cortada).
 */
const MEIO_Y = -0.08
/** Meio comprimento da fenda e a meia largura dela no meio (unidades do chão). */
const MEIO_COMPRIMENTO = 0.52
const MEIA_LARGURA = 0.075
/** O expoente da largura ao longo da fenda: acima de 1, a fenda afina de vez perto das pontas. */
const AFINA_NAS_PONTAS = 1.3
/** Pontos ao longo da fenda (mais = mais torta, mais comandos). */
const PONTOS = 11
/** Quanto o fundo aparece rente à beira de cá, em unidades da tela (a parede de lá cobre o resto da boca). */
const FUNDO_VISIVEL = 0.05
/**
 * O `brilho`: a força do fundo aceso e da parede de lá tingida por ele, e a grossura do miolo. Na quarta folha
 * (15/11/2026), com a parede a 0,58, a boca inteira lia como barro vermelho chapado; mais apagada, o fundo aceso
 * se destaca e a fenda ganha fundura.
 */
const ACENDE = { fundo: 0.95, parede: 0.45, miolo: 0.022 } as const
/** A grossura do traço da beira partida em volta da boca (unidades da tela; metade fica por baixo da boca). */
const LARGURA_DA_BEIRA = 0.034
/** O chamuscado: quanto ele passa da beira e da ponta. */
const QUEIMADO = { beira: 0.045, ponta: 0.06, alfa: 0.28 } as const

type P = readonly [number, number]

/**
 * Uma fenda no chão, sem giro: o eixo (pontos do chão) e a meia largura de cada beira em cada ponto (as duas soltas
 * uma da outra: iguais, a fenda lia como uma folha, simétrica em volta do eixo).
 */
interface Fenda {
  readonly eixo: readonly P[]
  readonly beiraA: readonly number[]
  readonly beiraB: readonly number[]
}

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** A fenda principal e os galhos (um ou dois), no chão, antes do giro. */
function fendasDe(semente: number): Fenda[] {
  const curva = (sorteio(semente, 1) - 0.5) * 0.12
  const eixo: P[] = []
  const beiraA: number[] = []
  const beiraB: number[] = []
  for (let i = 0; i < PONTOS; i++) {
    const t = (i / (PONTOS - 1)) * 2 - 1
    const u = t * MEIO_COMPRIMENTO * (i === 0 || i === PONTOS - 1 ? 1 : 1 + (sorteio(semente, 10 + i) - 0.5) * 0.06)
    // Torta: uma curva larga e um zigue-zague quebrado por cima dela.
    const v = curva * (1 - t * t) + (sorteio(semente, 30 + i) - 0.5) * 0.06
    eixo.push([u, v])
    // Afina de vez perto das pontas (expoente acima de 1): a ponta da fenda é fina, não redonda.
    const meia = MEIA_LARGURA * Math.pow(1 - t * t, AFINA_NAS_PONTAS)
    beiraA.push(meia * (0.6 + 0.8 * sorteio(semente, 50 + i)))
    beiraB.push(meia * (0.6 + 0.8 * sorteio(semente, 130 + i)))
  }
  const fendas: Fenda[] = [{ eixo, beiraA, beiraB }]
  const galhos = sorteio(semente, 2) < 0.5 ? 1 : 2
  for (let k = 0; k < galhos; k++) {
    // O galho sai de um ponto da fenda, de um lado (o segundo do outro), e afina até sumir.
    const i0 = Math.round((PONTOS - 1) * (0.25 + 0.5 * sorteio(semente, 70 + k)))
    const lado = (k === 0) === sorteio(semente, 71) < 0.5 ? 1 : -1
    const rumo = lado * (0.7 + 0.4 * sorteio(semente, 72 + k)) + (sorteio(semente, 74 + k) < 0.5 ? 0 : Math.PI)
    const comprimento = 0.15 + 0.08 * sorteio(semente, 76 + k)
    const [ux, vy] = eixo[i0]
    const galho: P[] = []
    const larguraDoGalho: number[] = []
    for (let j = 0; j <= 4; j++) {
      const s = j / 4
      const torto = (sorteio(semente, 80 + k * 5 + j) - 0.5) * 0.03 * s
      galho.push([ux + Math.cos(rumo) * comprimento * s - Math.sin(rumo) * torto, vy + Math.sin(rumo) * comprimento * s + Math.cos(rumo) * torto])
      larguraDoGalho.push(Math.min(beiraA[i0], beiraB[i0]) * 0.5 * (1 - s))
    }
    fendas.push({ eixo: galho, beiraA: larguraDoGalho, beiraB: larguraDoGalho })
  }
  return fendas
}

/** Do chão (sem giro) para a tela: gira em volta do meio e achata. */
function naTela([u, v]: P, giro: number): P {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  return [u * c - v * s, MEIO_Y + (u * s + v * c) * ACHATA]
}

/** As duas beiras da fenda na tela, ponto a ponto (`mais` = afasta das beiras e estica as pontas, para o chamuscado). */
function beiras(f: Fenda, giro: number, mais = 0, estica = 0): { a: P[]; b: P[] } {
  const n = f.eixo.length
  const a: P[] = []
  const b: P[] = []
  for (let i = 0; i < n; i++) {
    const antes = f.eixo[Math.max(0, i - 1)]
    const depois = f.eixo[Math.min(n - 1, i + 1)]
    const tx = depois[0] - antes[0]
    const ty = depois[1] - antes[1]
    const k = Math.hypot(tx, ty) || 1
    const [px, py] = [-ty / k, tx / k]
    const ponta = i === 0 ? -estica : i === n - 1 ? estica : 0
    const [u, v] = [f.eixo[i][0] + (tx / k) * ponta, f.eixo[i][1] + (ty / k) * ponta]
    const wa = f.beiraA[i] + mais
    const wb = f.beiraB[i] + mais
    a.push(naTela([u + px * wa, v + py * wa], giro))
    b.push(naTela([u - px * wb, v - py * wb], giro))
  }
  return { a, b }
}

/** O polígono entre duas linhas: uma de ida e a outra de volta. */
function caminho(g: CanvasRenderingContext2D, a: readonly P[], b: readonly P[]): void {
  g.beginPath()
  a.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i][0], b[i][1])
  g.closePath()
}

/**
 * A boca da fenda em três linhas: a beira de lá, a de cá (a de baixo na tela) e a de cá SUBIDA um tanto (sem passar
 * da de lá). Entre a de lá e a subida, a parede de lá; entre a subida e a de cá, o fundo à mostra, onde a brasa
 * corre. Duas faixas que não se cobrem: a parede meio transparente do `brilho` não soma com o fundo aceso.
 */
function boca(a: readonly P[], b: readonly P[]): { longe: readonly P[]; perto: readonly P[]; subida: P[] } {
  const meio = Math.floor(a.length / 2)
  const [perto, longe] = a[meio][1] >= b[meio][1] ? [a, b] : [b, a]
  const subida = perto.map(([x, y], i): P => [x, y - Math.min(FUNDO_VISIVEL, Math.max(0, y - longe[i][1]))])
  return { longe, perto, subida }
}

/** A brasa corre no meio do fundo à mostra. */
function linhaDaBrasa(perto: readonly P[], subida: readonly P[]): P[] {
  return perto.map(([x, y], i): P => [x + (subida[i][0] - x) * 0.45, y + (subida[i][1] - y) * 0.45])
}

function tracar(g: CanvasRenderingContext2D, linha: readonly P[]): void {
  g.beginPath()
  linha.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.stroke()
}

/**
 * Pinta a boca inteira numa cor e, por cima, uma das faixas noutra (`'parede'`: a de lá; `'fundo'`: o fundo à
 * mostra). A boca inteira por baixo, e não as duas faixas lado a lado: lado a lado, a emenda saía meio transparente
 * no antisserrilhado, e a fenda ganhava um fio escuro de contorno por dentro.
 */
function pintarBoca(g: CanvasRenderingContext2D, f: Fenda, giro: number, inteira: string, faixa: 'parede' | 'fundo', cor: string): ReturnType<typeof boca> {
  const { a, b } = beiras(f, giro)
  const linhas = boca(a, b)
  g.fillStyle = inteira
  caminho(g, linhas.longe, linhas.perto)
  g.fill()
  g.fillStyle = cor
  if (faixa === 'parede') caminho(g, linhas.longe, linhas.subida)
  else caminho(g, linhas.subida, linhas.perto)
  g.fill()
  return linhas
}

/** As lascas soltas na beira: pedrinhas de cinco quinas, o claro do lado da luz. */
function lascas(g: CanvasRenderingContext2D, f: Fenda, giro: number, semente: number): void {
  const { a, b } = beiras(f, giro, 0.03)
  const pontos = [2, 4, 6, 8].map((i, k) => (k % 2 === 0 ? a[i] : b[i]))
  pontos.forEach(([x, y], k) => {
    const r = 0.018 + 0.014 * sorteio(semente, 90 + k)
    for (const [cor, dx, dy, encolhe] of [
      [LASCA, 0, 0, 1],
      [LASCA_CLARA, -0.25, -0.3, 0.55],
    ] as const) {
      g.fillStyle = css(cor)
      g.beginPath()
      for (let q = 0; q < 5; q++) {
        const ang = (q * Math.PI * 2) / 5 + sorteio(semente, 100 + k * 5 + q) * 0.6
        const d = r * encolhe * (0.8 + 0.4 * sorteio(semente, 120 + k * 5 + q))
        const px = x + dx * r + Math.cos(ang) * d
        const py = y + dy * r + Math.sin(ang) * d * 0.6
        if (q === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.closePath()
      g.fill()
    }
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const fendas = fendasDe(semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // O chão chamuscado em volta de cada uma (por baixo de tudo).
  g.fillStyle = css(CHAO_QUEIMADO, QUEIMADO.alfa)
  for (const f of fendas) {
    const { a, b } = beiras(f, giro, QUEIMADO.beira, QUEIMADO.ponta)
    caminho(g, a, b)
    g.fill()
  }
  // A beira partida do chão em volta da boca (opaca): a fenda não acaba num contorno escuro. Um traço, e não a
  // boca alargada no chão: alargada, a beira sumia (menos de um texel) onde a fenda corre deitada na tela.
  g.strokeStyle = css(BEIRA)
  g.lineWidth = LARGURA_DA_BEIRA
  for (const f of fendas) {
    const { a, b } = beiras(f, giro)
    caminho(g, a, b)
    g.stroke()
  }
  for (const f of fendas) {
    const { perto, subida } = pintarBoca(g, f, giro, css(FUNDO), 'parede', css(PAREDE))
    g.strokeStyle = css(BRASA_APAGADA)
    g.lineWidth = 0.016
    tracar(g, linhaDaBrasa(perto, subida))
  }
  lascas(g, fendas[0], giro, semente)
}

/**
 * Só o que acende: o fundo em brasa e a parede de lá tingida por baixo. Nada fora da boca: o brilho é somado por
 * cima de TODOS os corpos no palco, e um claro no chão em volta tingiria o carimbo vizinho que o cobrisse (o claro
 * em volta, de noite, é a luz da tabela).
 */
const desenharBrilho: DesenhoDeCarimbo = (g, giro, semente) => {
  const fendas = fendasDe(semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const f of fendas) {
    // O fundo em brasa e a parede de lá tingida (o fundo a ilumina por baixo).
    const { perto, subida } = pintarBoca(g, f, giro, css(BORDA_DA_CHAMA, ACENDE.parede), 'fundo', css(BORDA_DA_CHAMA, ACENDE.fundo))
    g.strokeStyle = css(MIOLO_VERMELHO)
    g.lineWidth = ACENDE.miolo
    tracar(g, linhaDaBrasa(perto, subida))
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'fenda-em-brasa', nome: 'Fenda em brasa', tamanho: 10, sombra: 'nenhuma', desenhar }

export const brilho: DesenhoDeCarimbo = desenharBrilho

/** Todas as cores chapadas do desenho (as do `brilho` ficam fora, como pede o briefing dos carimbos). */
export const paleta: readonly Rgb[] = [CHAO_QUEIMADO, BEIRA, PAREDE, FUNDO, BRASA_APAGADA, LASCA, LASCA_CLARA]
