/**
 * ANTENA PARABÓLICA de quintal, de cima com volume (lote 3 dos objetos novos,
 * 11/11/2026, pedido direto do mestre). A antena grande de TELA de alumínio,
 * inclinada para o céu: do alto, a boca redonda do PRATO vira uma elipse e o
 * fundo dele aparece recuado para o lado do aro alto, com as nervuras em raio,
 * os dois aros dos painéis e a tela miúda. A concavidade lê pela luz: a parede
 * de dentro que olha para a luz (a da direita) é clara, a que dá as costas
 * para ela (a de cima à esquerda) fica na sombra. Quatro HASTES saem do aro e
 * se encontram no foco, onde fica o RECEPTOR (a corneta e a caixa dele), com o
 * cabo descendo por uma haste; as hastes e o receptor fazem sombra no prato.
 * Atrás do aro alto, o braço e o macaco que prendem o prato na cabeça do
 * MASTRO; no chão, a BASE de concreto rachada, com a ferrugem em volta do pé
 * do mastro, as mãos-francesas, os chumbadores, e o CABO que sai pelo quintal.
 *
 * O prato fica no ar (a sombra dele cai solta, longe, e escurece a base) e o
 * mastro é uma coluna da mesma altura: na vista 3/4 o prato sobe inteiro, com
 * a beirada das costas dele embaixo, e o mastro aparece do chão até ele. Para
 * isso cada peça do alto tem o MEIO dentro da elipse do prato (o braço e o
 * macaco entram por baixo dele) e cada peça do chão, fora dela e fora do
 * mastro (a base é em duas placas, com a rachadura passando pelo pé dele).
 *
 * Sem material no painel: o alumínio, o aço do mastro, o concreto e o cabo são
 * fixos. O desenho é feito em 112 x 112 px (2 x 2 casas) e escala inteiro com
 * o menor lado da pegada (o prato continua redondo no objeto esticado).
 */
import type { Rgb } from '../../ruido'
import { barra, cadeia, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O meio lado em que a antena é desenhada (px do protótipo): 2 x 2 casas. */
const MEIO_DESENHO = 56

// ---------- as medidas (px do desenho de 112 x 112) ----------

/** A boca do prato vista de cima: o meio, os dois meios eixos e o rumo do eixo maior (radianos). */
const MEIO_DO_PRATO: Ponto = [2, -13]
const MEIO_EIXO_MAIOR = 50
const MEIO_EIXO_MENOR = 36
const RUMO_DO_EIXO_MAIOR = Math.PI / 6
/** A inclinação do prato sai do achatamento da boca: o seno do ângulo em que ele aponta acima do chão. */
const SENO_DA_ELEVACAO = MEIO_EIXO_MENOR / MEIO_EIXO_MAIOR
const COSSENO_DA_ELEVACAO = Math.sqrt(1 - SENO_DA_ELEVACAO * SENO_DA_ELEVACAO)
/** Quanto o fundo do prato aparece recuado para o lado do aro alto e quanto o foco avança para o lado do aro baixo. */
const RECUO_DO_FUNDO = 10
const AVANCO_DO_FOCO = 15.4
/** A inclinação da parede do prato junto do aro (a tangente): 0 seria um disco chato. */
const INCLINACAO_NA_BEIRA = 0.625
/** A altura do meio do prato e da cabeça do mastro, em vezes o meio lado do desenho (1,2 casa). */
const ALTURA_DO_PRATO = 1.2
/** O mastro fica atrás do aro alto: a que distância do aro, e o raio do tubo. */
const MASTRO_ALEM_DO_ARO = 9.5
const RAIO_DO_MASTRO = 3.2
/** A base de concreto: as meias medidas dela em volta do pé do mastro. */
const MEIA_BASE: Ponto = [15, 13]

// ---------- os materiais (fixos) ----------

/** A tela e a chapa de alumínio do prato, o aro e as hastes (mais claros) e o aço galvanizado do mastro e do braço. */
const CHAPA: MaterialDaPeca = { classe: 'metal', rgb: [0xb0, 0xb6, 0xba] }
const ARO: MaterialDaPeca = { classe: 'metal', rgb: [0xcc, 0xd0, 0xd2] }
const MASTRO: MaterialDaPeca = { classe: 'metal', rgb: [0x7c, 0x80, 0x85] }
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: [0x6a, 0x6e, 0x73] }
/** A caixa do receptor (plástico cinza-azulado) e o cabo (borracha escura). */
const RECEPTOR: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x5d, 0x68] }
const CABO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x3e, 0x43] }
/** O concreto da base e a ferrugem que escorre do pé do mastro (a mesma das sucatas, contida). */
const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa9, 0xa5, 0x9c] }
const FERRUGEM: Rgb = [0x93, 0x5f, 0x47]
/** O escuro em que o pixel escuro demais é levantado: cinza frio (com o da nogueira o metal na sombra saía marrom). */
const ESCURO_DO_METAL: Rgb = [0x46, 0x46, 0x49]

// ---------- a luz do prato ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto a luz muda de uma parede à outra dentro do prato. */
const FORCA_DA_CONCHA = 0.8
/**
 * Quanto da luz do prato inteiro (apontado para a luz ou de costas para ela) entra na conta. Inteira, o prato
 * girado na 3/4 saía quase preto de costas para a luz e branco estourado de frente; com esta parte ele fica
 * sempre alumínio claro, e o que muda com o giro é de que lado está a parede clara.
 */
const PARTE_DA_LUZ_DO_PRATO = 0.35
const VOLTA = Math.PI * 2
/** As nervuras em raio: quantas, a meia largura (px do desenho) e a luz que pegam. */
const NERVURAS = 16
const MEIA_NERVURA = 0.6
const LUZ_DA_NERVURA = 0.1
/** Os aros que emendam os painéis, em frações do raio do prato. */
const AROS_DOS_PAINEIS: readonly number[] = [0.36, 0.68]
const LUZ_DO_ARO_DO_PAINEL = 0.08
/** A tela: o passo dos furos (px do desenho), a meia largura do furo em frações do passo e o quanto ele escurece. */
const PASSO_DA_TELA = 1.5
const MEIO_FURO = 0.3
const FURO_DA_TELA = 0.1
/** Abaixo desta escala (pixels da imagem por px do protótipo) o furo não cabe num pixel: a tela fica só mais escura, na média. */
const ESCALA_DA_TELA_INTEIRA = 1.5
const PARTE_FURADA = 4 * MEIO_FURO * MEIO_FURO

/** A boca do prato na pegada: o meio, os meios eixos, os dois eixos e o recuo do fundo. */
interface Prato {
  readonly cx: number
  readonly cy: number
  readonly a: number
  readonly b: number
  /** O eixo maior da boca (de través). */
  readonly mx: number
  readonly my: number
  /** O eixo menor, para o lado do aro alto (as costas do prato, onde fica o mastro). */
  readonly nx: number
  readonly ny: number
  readonly recuo: number
  /** De que lado vem a luz NO DESENHO (a luz da tela, desgirada pelo quarto de volta que a 3/4 pinta). */
  readonly luzX: number
  readonly luzY: number
  /** Px da pegada por px do desenho. */
  readonly k: number
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta): o contrário do `girarPonto` de `tresQuartos.ts`. A
 * luz da concha e as sombras pintadas na base passam por aqui, para ficarem no lugar na tela com a antena girada.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O ponto da boca do prato a `raio` (fração do raio dela) no ângulo `fi` (0 = o eixo maior; 90° = o aro alto), mais `alem` px para o lado do aro alto. */
function naBoca(g: Prato, raio: number, fi: number, alem = 0): Ponto {
  const m = g.a * raio * Math.cos(fi)
  const n = g.b * raio * Math.sin(fi) + alem
  return [g.cx + m * g.mx + n * g.nx, g.cy + m * g.my + n * g.ny]
}

/**
 * A textura do PRATO. Cada pixel é levado de volta para a concha: o fundo dela aparece recuado para o lado do aro
 * alto, então os aros de dentro não são concêntricos com a boca (é o que diz que o prato está inclinado). Da concha
 * sai a normal e, dela, a luz: a parede que olha para a luz clareia, a que dá as costas escurece. Por cima, as
 * nervuras em raio, os aros dos painéis e os furos da tela.
 */
function texDoPrato(g: Prato): Textura {
  const doMetal = texturaDaClasse('metal')
  const eixoX = -g.nx * COSSENO_DA_ELEVACAO
  const eixoY = -g.ny * COSSENO_DA_ELEVACAO
  // A luz no fundo do prato (a normal é o eixo): a de cada ponto é medida a partir dela.
  const luzNoEixo = eixoX * g.luzX + eixoY * g.luzY + SENO_DA_ELEVACAO * LUZ_Z
  const luzDoPrato = PARTE_DA_LUZ_DO_PRATO * FORCA_DA_CONCHA * (luzNoEixo - LUZ_Z)
  const passo = PASSO_DA_TELA * g.k
  const meiaNervura = MEIA_NERVURA * g.k
  return (u, v, x, y, p, s, escala) => {
    const dx = x - g.cx
    const dy = y - g.cy
    const aoLado = (dx * g.mx + dy * g.my) / g.a
    const paraTras = dx * g.nx + dy * g.ny
    // Quanto do raio fica para o lado do aro alto: a raiz da conta que desfaz o recuo do fundo.
    const delta = g.b * g.b - 4 * g.recuo * (paraTras - g.recuo * (1 - aoLado * aoLado))
    const w = (g.b - Math.sqrt(delta > 0 ? delta : 0)) / (2 * g.recuo)
    const rho = Math.min(1, Math.hypot(aoLado, w))
    const fi = Math.atan2(w, aoLado)
    const co = Math.cos(fi)
    const si = Math.sin(fi)
    // A normal da concha: o eixo do prato, deitado para dentro quanto mais perto do aro.
    const q = INCLINACAO_NA_BEIRA * rho
    const nx = eixoX - q * (co * g.mx + si * g.nx * SENO_DA_ELEVACAO)
    const ny = eixoY - q * (co * g.my + si * g.ny * SENO_DA_ELEVACAO)
    const nz = SENO_DA_ELEVACAO - q * si * COSSENO_DA_ELEVACAO
    const naParede = Math.max(0, (nx * g.luzX + ny * g.luzY + nz * LUZ_Z) / Math.hypot(nx, ny, nz))
    let luz = FORCA_DA_CONCHA * (naParede - luzNoEixo) + luzDoPrato
    const raio = rho * g.a
    const gomo = (fi / VOLTA) * NERVURAS
    const ateANervura = Math.abs(gomo - Math.round(gomo)) * (VOLTA / NERVURAS) * raio
    if (ateANervura < meiaNervura) luz += LUZ_DA_NERVURA * (1 - ateANervura / meiaNervura)
    for (const aro of AROS_DOS_PAINEIS) {
      const ateOAro = Math.abs(rho - aro) * g.a
      if (ateOAro < meiaNervura) luz += LUZ_DO_ARO_DO_PAINEL * (1 - ateOAro / meiaNervura)
    }
    if (escala < ESCALA_DA_TELA_INTEIRA) {
      luz -= FURO_DA_TELA * PARTE_FURADA
    } else {
      // Os furos em fileiras redondas: cada fileira tem tantos furos quantos cabem na volta dela.
      const fileira = Math.floor(raio / passo)
      const naVolta = Math.max(8, Math.round(VOLTA * (fileira + 0.5)))
      const emVolta = (fi / VOLTA) * naVolta + (fileira & 1) * 0.5
      const fa = emVolta - Math.floor(emVolta)
      const fr = raio / passo - fileira
      if (Math.abs(fr - 0.5) < MEIO_FURO && Math.abs(fa - 0.5) < MEIO_FURO) luz -= FURO_DA_TELA
    }
    s[3] += luz
    if (doMetal !== null) doMetal(u, v, x, y, p, s, escala)
  }
}

// ---------- a base e o mastro ----------

/** A rachadura da base, de cima a baixo, passando pelo pé do mastro: [para o lado, para baixo] a partir dele. */
const RACHADURA: readonly Ponto[] = [[1.4, -MEIA_BASE[1]], [-0.6, -5.5], [0.9, -0.5], [-1.1, 6], [1.8, MEIA_BASE[1]]]
/** O canto lascado da placa da esquerda (quanto falta de cada lado do canto de baixo). */
const LASCA_DO_CANTO: Ponto = [2.8, 2.6]
/** A ferrugem em volta do pé do mastro: até onde vai (px do desenho) e o quanto cobre junto dele. */
const ALCANCE_DA_FERRUGEM = 8
const FERRUGEM_CHEIA = 0.5
/** O quanto a sombra do prato e a do mastro escurecem o concreto (a sombra do chão não cai nas peças: esta é pintada). */
const SOMBRA_NA_BASE = 0.2
/** Os chumbadores (a que distância do pé do mastro, nos dois eixos) e as mãos-francesas (de onde até onde, na diagonal). */
const CHUMBADOR = 6.6
const MAO_FRANCESA: readonly [number, number] = [2.7, 6.3]

function suave01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * O concreto da base: o grão da pedra, a ferrugem que escorreu do pé do mastro e as sombras do prato e do mastro
 * (`sombras` = as duas formas, já afastadas como o motor afasta a sombra no chão, e a borda de cada uma).
 */
function texDaBase(pe: Ponto, k: number, sombras: readonly (readonly [Forma, number])[]): Textura {
  const daPedra = texturaDaClasse('pedra')
  const alcance = ALCANCE_DA_FERRUGEM * k
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const longe = Math.hypot(x - pe[0], y - pe[1]) / alcance
    if (longe < 1) {
      const t = (1 - longe) * (0.6 + ruido(x * 0.4 + p.su, y * 0.4 + p.sv)) * FERRUGEM_CHEIA
      s[0] += (FERRUGEM[0] - s[0]) * t
      s[1] += (FERRUGEM[1] - s[1]) * t
      s[2] += (FERRUGEM[2] - s[2]) * t
    }
    let sombra = 0
    for (const [forma, borda] of sombras) sombra = Math.max(sombra, suave01(0.5 - forma.d(x, y) / (2 * borda)))
    s[3] -= SOMBRA_NA_BASE * sombra
  }
}

/** A forma afastada (dx, dy): onde cai a sombra dela. */
function afastada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

function montarBase(c: ContextoDoMovel, cena: Cena, g: Prato, pe: Ponto, boca: Forma, altura: number): void {
  const P = c.peca
  const L = cena.partes
  const { k } = g
  const [px, py] = pe
  const [mx, my] = [MEIA_BASE[0] * k, MEIA_BASE[1] * k]
  const racha = RACHADURA.map(([x, y]): Ponto => [px + x * k, py + y * k])
  const esquerda = poligono([[px - mx, py - my], ...racha, [px - mx + LASCA_DO_CANTO[0] * k, py + my], [px - mx, py + my - LASCA_DO_CANTO[1] * k]])
  const direita = poligono([...racha, [px + mx, py + my], [px + mx, py - my]])
  cena.sombras.push(contato(caixa(px - mx, py - my, px + mx, py + my, 1), 0.3))

  // As sombras que caem na base: a do prato, solta e larga, e a do mastro, arrastada desde o pé.
  const [ox, oy] = desgirado(SOMBRA_X * altura, SOMBRA_Y * altura, c.giro)
  const raio = RAIO_DO_MASTRO * k
  const textura = texDaBase(pe, k, [
    [afastada(boca, ox, oy), bordaDaSombra({ z: altura })],
    [capsula(px, py, px + ox, py + oy, raio), raio],
  ])
  L.push(P(esquerda, CONCRETO, { tabua: 0, bisel: 1.1, contorno: 0.3, textura, semente: 5101 }))
  L.push(P(direita, CONCRETO, { tabua: 0, bisel: 1.1, tom: 0.96, contorno: 0.3, textura, semente: 5102 }))

  // Em volta do pé do mastro: as quatro mãos-francesas e os chumbadores nos cantos.
  for (const [i, [sx, sy]] of ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).entries()) {
    const d = Math.SQRT1_2 * k
    const mao = barra(px + sx * MAO_FRANCESA[0] * d, py + sy * MAO_FRANCESA[0] * d, px + sx * MAO_FRANCESA[1] * d, py + sy * MAO_FRANCESA[1] * d, 1.4 * k)
    L.push(P(mao, FERRAGEM, { tabua: 0, bisel: 0.6, contorno: 0.26, metal: 0.25, semente: 5110 + i }))
    L.push(P(elipse(px + sx * CHUMBADOR * k, py + sy * CHUMBADOR * k, 0.95 * k, 0.95 * k), FERRAGEM, { bisel: 0.7, tom: 1.2, contorno: 0.3, metal: 0.4, semente: 5114 + i }))
  }
}

// ---------- o cabo no chão ----------

/** O cabo, do pé do mastro até a beira da pegada, com a folga de um cabo largado no quintal (px do desenho). */
const CABO_NO_CHAO: readonly Ponto[] = [
  [-18.5, 34.5],
  [-14.5, 42],
  [-6, 46.5],
  [6, 47.5],
  [18, 45],
  [29, 47.5],
  [40, 51.5],
  [53, 52.5],
]
const RAIO_DO_CABO = 0.6
/** Pedaços por vão da curva: o cabo não faz quina. */
const PASSOS_DA_CURVA = 4

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
}

/** A curva suave que passa pelos pontos (Catmull-Rom), em `PASSOS_DA_CURVA` pedaços por vão. */
function curva(pontos: readonly Ponto[]): Ponto[] {
  const ultimo = pontos.length - 1
  const saida: Ponto[] = []
  for (let i = 0; i < ultimo; i += 1) {
    const p0 = pontos[Math.max(0, i - 1)]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[Math.min(ultimo, i + 2)]
    for (let j = 0; j < PASSOS_DA_CURVA; j += 1) {
      const t = j / PASSOS_DA_CURVA
      saida.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  saida.push(pontos[ultimo])
  return saida
}

function montarCaboNoChao(c: ContextoDoMovel, cena: Cena, pe: Ponto, k: number): void {
  const caminho = curva([[pe[0] + 1.2 * k, pe[1] + 4.2 * k], ...CABO_NO_CHAO.map(([x, y]): Ponto => [x * k, y * k])])
  const cabo = cadeia(caminho, RAIO_DO_CABO * k)
  cena.sombras.push(contato(cabo, 0.24))
  cena.partes.push(c.peca(cabo, CABO, { bisel: RAIO_DO_CABO * k, contorno: 0.2, semente: 5120 }))
}

// ---------- o prato, as hastes e o receptor ----------

/**
 * De onde saem as quatro hastes, no aro (ângulos na boca: 90° é o aro alto), e a que fração do raio elas prendem.
 * Em X, e não em tripé: com o foco avançado para o aro baixo, duas hastes do tripé ficavam em linha e liam como
 * uma barra só atravessando o prato. A primeira é a que leva o cabo.
 */
const HASTES: readonly number[] = [(5 * Math.PI) / 18, (13 * Math.PI) / 18, (23 * Math.PI) / 18, (31 * Math.PI) / 18]
const PRESA_DA_HASTE = 0.97
const RAIO_DA_HASTE = 0.85
/** O macaco (o braço fino que regula a inclinação): onde ele prende por baixo do prato, em [fração do eixo maior, fração do menor]. */
const PRESA_DO_MACACO: Ponto = [-0.55, 0.45]
/** A corneta do receptor (os meios eixos) e a caixa dele (o comprimento e o raio). */
const CORNETA: Ponto = [4.6, 3.6]
const CAIXA_DO_RECEPTOR: Ponto = [6.2, 2.3]

/** O braço e o macaco, da cabeça do mastro para baixo do prato, e a cabeça do mastro por cima deles. */
function montarSuporte(c: ContextoDoMovel, cena: Cena, g: Prato, pe: Ponto): void {
  const P = c.peca
  const L = cena.partes
  const { k } = g
  const [px, py] = pe
  const [fx, fy] = naBoca(g, 0, 0, g.recuo)
  L.push(P(barra(px, py, fx, fy, 3.4 * k), FERRAGEM, { tabua: 0, bisel: 0.9, contorno: 0.3, metal: 0.3, semente: 5130 }))
  // O macaco: o tubo grosso do motor junto do mastro e a haste fina até o prato, numa peça só (o meio dela fica debaixo do prato).
  const [ex, ey] = [g.cx + PRESA_DO_MACACO[0] * g.a * g.mx + PRESA_DO_MACACO[1] * g.b * g.nx, g.cy + PRESA_DO_MACACO[0] * g.a * g.my + PRESA_DO_MACACO[1] * g.b * g.ny]
  const macaco = uniao(capsula(px, py, ex, ey, 1 * k), capsula(px + (ex - px) * 0.08, py + (ey - py) * 0.08, px + (ex - px) * 0.42, py + (ey - py) * 0.42, 1.8 * k))
  L.push(P(macaco, MASTRO, { tabua: 0, bisel: 0.9, tom: 1.08, contorno: 0.3, metal: 0.4, semente: 5131, projeta: { dist: 1, forca: 0.24 } }))
  // A cabeça do mastro: a boca do tubo vista do alto, com a tampa.
  const raio = RAIO_DO_MASTRO * k
  L.push(P(elipse(px, py, raio + 0.3 * k, raio + 0.3 * k), MASTRO, { tabua: 0, bisel: 1.3, contorno: 0.34, metal: 0.45, semente: 5132, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipse(px, py, raio * 0.5, raio * 0.5), FERRAGEM, { bisel: 0.6, tom: 0.9, contorno: 0.2, metal: 0.3, semente: 5133 }))
}

function montarPrato(c: ContextoDoMovel, cena: Cena, g: Prato, boca: Forma): void {
  const P = c.peca
  const L = cena.partes
  const { k } = g
  L.push(P(boca, CHAPA, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.15, textura: texDoPrato(g), semente: 5140 }))
  // O cubo no fundo do prato, onde as nervuras se encontram, com o parafuso do meio.
  const [vx, vy] = naBoca(g, 0, 0, g.recuo)
  L.push(P(elipseGirada(vx, vy, 3.6 * k, 2.8 * k, RUMO_DO_EIXO_MAIOR), ARO, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.26, metal: 0.3, semente: 5141 }))
  L.push(P(elipse(vx, vy, 0.9 * k, 0.9 * k), FERRAGEM, { bisel: 0.6, contorno: 0.2, metal: 0.4, semente: 5142 }))
  // O aro: o tubo de alumínio em volta da boca. A sombra dele cai dentro do prato do lado da luz (é o que afunda a concha).
  const miolo = elipseGirada(g.cx, g.cy, g.a - 2 * k, g.b - 1.6 * k, RUMO_DO_EIXO_MAIOR)
  L.push(P(menos(boca, miolo), ARO, { tabua: 0, bisel: 0.9, contorno: 0.3, metal: 0.45, semente: 5143, projeta: { dist: 2.2 * k, forca: 0.3, suave: 1.4 } }))
}

function montarReceptor(c: ContextoDoMovel, cena: Cena, g: Prato): void {
  const P = c.peca
  const L = cena.partes
  const { k } = g
  const [fx, fy] = naBoca(g, 0, 0, -AVANCO_DO_FOCO * k)
  // As quatro hastes, do aro ao foco: estão no ar, por cima da concha, e fazem sombra nela.
  HASTES.forEach((fi, i) => {
    const [ax, ay] = naBoca(g, PRESA_DA_HASTE, fi)
    L.push(P(capsula(ax, ay, fx, fy, RAIO_DA_HASTE * k), ARO, { tabua: 0, bisel: RAIO_DA_HASTE * k, tom: 0.94, contorno: 0.34, metal: 0.3, semente: 5150 + i, projeta: { dist: 3 * k, forca: 0.28, suave: 0.9 } }))
  })
  // O cabo desce do receptor pela primeira haste, preso nela de espaço em espaço.
  const [ax, ay] = naBoca(g, PRESA_DA_HASTE, HASTES[0])
  const comp = Math.hypot(ax - fx, ay - fy) || 1
  const [lx, ly] = [(-(ay - fy) / comp) * k, ((ax - fx) / comp) * k]
  const descida = [0.06, 0.28, 0.5, 0.72, 0.96].map((t, i): Ponto => {
    const folga = i % 2 === 0 ? 1 : 1.7
    return [fx + (ax - fx) * t + lx * folga, fy + (ay - fy) * t + ly * folga]
  })
  L.push(P(cadeia(descida, 0.5 * k), CABO, { bisel: 0.5 * k, contorno: 0.16, semente: 5154 }))
  // O receptor no foco: a corneta redonda virada para o prato, com o friso, e a caixa dele para trás.
  const corneta = elipseGirada(fx, fy, CORNETA[0] * k, CORNETA[1] * k, RUMO_DO_EIXO_MAIOR)
  L.push(P(corneta, ARO, { tabua: 0, bisel: 1, contorno: 0.34, metal: 0.4, semente: 5155, projeta: { dist: 5 * k, forca: 0.3, suave: 1.6 } }))
  const friso = menos(elipseGirada(fx, fy, CORNETA[0] * 0.7 * k, CORNETA[1] * 0.7 * k, RUMO_DO_EIXO_MAIOR), elipseGirada(fx, fy, CORNETA[0] * 0.5 * k, CORNETA[1] * 0.5 * k, RUMO_DO_EIXO_MAIOR))
  L.push(P(friso, FERRAGEM, { bisel: 0.3, contorno: 0, semente: 5156 }))
  const [tx, ty] = [fx - g.nx * CAIXA_DO_RECEPTOR[0] * k, fy - g.ny * CAIXA_DO_RECEPTOR[0] * k]
  L.push(P(capsula(fx, fy, tx, ty, CAIXA_DO_RECEPTOR[1] * k), RECEPTOR, { bisel: 1.4, contorno: 0.3, semente: 5157, projeta: { dist: 1, forca: 0.24 } }))
  L.push(P(elipse(tx, ty, 1.1 * k, 1.1 * k), ARO, { bisel: 0.8, tom: 0.9, contorno: 0.3, metal: 0.4, semente: 5158 }))
}

export const montarAntenaParabolica: MontarMovel = (c, cena) => {
  const k = Math.min(c.hw, c.hh) / MEIO_DESENHO
  const [mx, my] = [Math.cos(RUMO_DO_EIXO_MAIOR), Math.sin(RUMO_DO_EIXO_MAIOR)]
  const [luzX, luzY] = desgirado(LUZ_X, LUZ_Y, c.giro)
  const g: Prato = { cx: MEIO_DO_PRATO[0] * k, cy: MEIO_DO_PRATO[1] * k, a: MEIO_EIXO_MAIOR * k, b: MEIO_EIXO_MENOR * k, mx, my, nx: -my, ny: mx, recuo: RECUO_DO_FUNDO * k, luzX, luzY, k }
  const boca = elipseGirada(g.cx, g.cy, g.a, g.b, RUMO_DO_EIXO_MAIOR)
  const pe = naBoca(g, 1, Math.PI / 2, MASTRO_ALEM_DO_ARO * k)
  const altura = ALTURA_DO_PRATO * MEIO_DESENHO * k
  cena.corDoPiso = ESCURO_DO_METAL

  // O prato no ar (a sombra cai solta) e o mastro, uma coluna da mesma altura (a sombra é arrastada desde o pé).
  cena.sombras.push({ forma: boca, z: altura, solta: true, forca: 0.24 })
  cena.sombras.push({ forma: elipse(pe[0], pe[1], RAIO_DO_MASTRO * k, RAIO_DO_MASTRO * k), z: altura, forca: 0.24 })

  montarBase(c, cena, g, pe, boca, altura)
  montarCaboNoChao(c, cena, pe, k)
  montarSuporte(c, cena, g, pe)
  montarPrato(c, cena, g, boca)
  montarReceptor(c, cena, g)
}
