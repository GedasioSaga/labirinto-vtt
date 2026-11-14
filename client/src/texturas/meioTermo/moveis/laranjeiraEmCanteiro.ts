/**
 * LARANJEIRA EM CANTEIRO de cima com volume (lote L07 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do
 * mestre: "laranjeira em canteiro"). O pé de laranja plantado num CANTEIRO quadrado de tábuas, como os do
 * convés de navio: as quatro tábuas da borda com o veio ao comprido, os quatro MOURÕES dos cantos com a cabeça
 * cortada, a TERRA escura por dentro e, por cima de quase tudo, a COPA redonda e cheia, em três tons de verde
 * (a massa escura por baixo, as copinhas puxadas para a luz e o realce, a receita da sebe), salpicada de
 * LARANJAS (umas por cima, outras meio escondidas entre as folhas) e de umas flores brancas. Nos cantos de
 * terra que a copa não cobre caíram duas laranjas e umas folhas secas.
 *
 * Não é o canteiro de flores (`canteiroDeFlores.ts`, no chão, sem madeira, com moitas de cores) nem a sebe: é
 * uma árvore só, alta, num caixote. A 1x sobram o quadrado de madeira nos cantos, a bola verde e os pontos
 * laranja.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil `{ modo: 'derivado', espessura: ESPESSURA_DA_COPA_DA_LARANJEIRA }`): o
 * canteiro é uma coluna baixa (a terra e a borda sobem até a boca dele) e a COPA é um tampo solto alto, com a
 * beirada da espessura da folhagem. O TRONCO é uma peça do canteiro, desenhada de pé (de cima, escondida
 * debaixo da copa): sobe com a boca do canteiro e vai da terra até debaixo da beirada da copa. Varrido como
 * coluna, ele nascia no chão e a terra do canteiro, pintada depois, o cobria. Para cada peça subir com a
 * estrutura certa (a 3/4 lê o meio da caixa da peça):
 * - a sombra da copa tem dois FUROS sem área (no meio do canteiro e no meio do tronco): a terra, a borda, o
 *   tronco e as laranjas caídas (estas com a caixa recentrada no meio) caem num furo e ficam no canteiro;
 * - a moldura inteira, escondida debaixo das tábuas, é a maior peça do canteiro: a frente varrida sai de
 *   madeira, e não da cor da terra;
 * - a caixa da sombra da copa desce até a beira de baixo do canteiro, para a copa ser pintada DEPOIS dele (a
 *   3/4 pinta do norte para o sul pela beira de baixo): a copa alta fica na frente da boca do canteiro.
 *
 * As medidas saem do menor lado da pegada (1 x 1 casa de partida): a laranjeira esticada continua redonda e o
 * canteiro fica quadrado no meio. Material: `madeira` (o canteiro); as folhas, a terra, as laranjas e o tronco
 * são fixos. O piso de luz é o verde-escuro da folha (`cena.corDoPiso`, como na sebe): com o da nogueira, a
 * beira escura da copa virava marrom.
 */
import { hash, rgb } from '../../ruido'
import { caixa, dentroDe, elipse, elipseGirada, menos, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, PISO_DA_FOLHA, ruido, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A beirada da copa na 3/4 (a espessura da folhagem), px do protótipo: o perfil da 3/4 lê daqui. */
export const ESPESSURA_DA_COPA_DA_LARANJEIRA = 0.3 * G

/** A pegada de partida (lado, px do protótipo) e as alturas, em casas: a boca do canteiro e o alto da copa. */
const LADO_DE_PARTIDA = 1 * G
const ALTURA_DO_CANTEIRO = 0.32
const ALTURA_DA_COPA = 1.15

// O desenho, em px de partida (0 no meio).
/** O canteiro: a meia medida de fora, a largura da tábua e o lado do mourão do canto. */
const CANTEIRO = 27
const TABUA = 3.8
const MOURAO = 5.6
/** A copa: o meio (puxado um pouco para a luz), o raio da copa do meio, e os lóbulos em volta. */
const COPA_X = -0.8
const COPA_Y = -1.4
const RAIO_DO_MEIO = 13
const LOBULOS = 9
const DISTANCIA_DO_LOBULO = 12.6
const RAIO_DO_LOBULO = 7.2
const RAIO_VARIA = 1.3
/**
 * O tronco, escondido debaixo da copa (só a 3/4 mostra): o pé na terra, o raio e o comprimento à mostra na
 * 3/4 (da boca do canteiro até a beirada da copa, com folga para entrar debaixo dela). E o raio dos furos da
 * sombra da copa.
 */
const TRONCO: Ponto = [2.4, 3]
const RAIO_DO_TRONCO = 2.5
const TRONCO_A_MOSTRA = 17
const FURO = 0.6
/** A receita da folhagem (a da sebe): os tons e quanto a copa e o realce puxam para a luz. */
const TOM_DA_MASSA = 0.8
const COPA = { raio: 0.88, puxa: 0.16 }
const REALCE = { raio: 0.3, x: 0.36, y: 0.4, tom: 1.16, quantos: 0.6 }

/** As laranjas: o meio (px de partida, a partir do meio da copa), o raio e se fica meio escondida nas folhas. */
const LARANJAS: readonly (readonly [number, number, number, boolean])[] = [
  [-10.5, -9, 2.3, false],
  [-3.5, -13.4, 2.2, false],
  [5.5, -11.5, 2.1, false],
  [-14.6, 0.5, 2.2, false],
  [-7, -2.6, 2.4, false],
  [2, -4.4, 2.2, false],
  [11.8, -4.2, 2.3, false],
  [-11.2, 8.8, 2.1, false],
  [-2.5, 6.4, 2.3, false],
  [7.4, 4, 2.1, false],
  [14.2, 6.4, 2, true],
  [3.2, 13.6, 2.1, true],
  [-6.4, 14.2, 2, true],
  [16, -9.6, 1.9, true],
]
/** As flores brancas da laranjeira, poucas. */
const FLORES: readonly Ponto[] = [[-13, -5], [8.6, -14.6], [-0.4, 1.4], [10.6, 10.6], [-15.4, 10.4]]
/** Nos cantos de terra: as laranjas caídas e as folhas secas (meio, raio ou medidas e rumo). */
const CAIDAS: readonly Ponto[] = [[18.6, 18.8], [-19.4, 17.4]]
const FOLHAS_SECAS: readonly (readonly [number, number, number])[] = [[15.4, 20.6, 0.5], [-17.6, -19.6, -0.8], [20, -16.6, 1.6], [-20.6, 20.4, 2.4]]

const FOLHA: MaterialDaPeca = materialDaPeca('buxo')
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x46, 0x34] }
const LARANJA: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0x90, 0x48] }
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x84, 0x52] }
const BRANCO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#ece6d6') }
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c9a24f') }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xee, 0xde] }
const CABINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x5c, 0x36] }
const CASCA_DO_TRONCO: MaterialDaPeca = materialDaPeca('lenhaPinho')

/** A terra: torrões, o grão e umas pedrinhas claras. */
const texDaTerra: Textura = (_u, _v, x, y, p, s) => {
  const torrao = ruido(x * 0.35 + p.su, y * 0.35 + p.sv)
  s[3] += torrao * 0.12 + ruido(x * 1.4, y * 1.4) * 0.06 + (ruido(x * 0.9 + 31, y * 0.9) > 0.5 ? 0.1 : 0)
}

/** A casca da laranja: os poros miúdos. */
const texDaLaranja: Textura = (_u, _v, x, y, _p, s) => {
  s[3] += ruido(x * 2.2, y * 2.2) * 0.05
}

/** A forma com a caixa trocada: o pintor anda em `b`; a 3/4 lê o meio dela. */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/** A forma com a caixa crescida até ficar centrada em (cx, cy): a 3/4 a põe na estrutura desse ponto. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return naCaixa(f, [cx - mx, cy - my, cx + mx, cy + my])
}

/** Muitos círculos numa forma só (a massa da copa): a distância é a do círculo mais perto. */
function circulos(lista: readonly (readonly [number, number, number])[]): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y, r] of lista) {
    x0 = Math.min(x0, x - r)
    y0 = Math.min(y0, y - r)
    x1 = Math.max(x1, x + r)
    y1 = Math.max(y1, y + r)
  }
  return {
    b: [x0, y0, x1, y1],
    d(px, py) {
      let menor = Infinity
      for (const [x, y, r] of lista) {
        const d = Math.hypot(px - x, py - y) - r
        if (d < menor) menor = d
      }
      return menor
    },
  }
}

interface Desenho {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  readonly k: number
  readonly em: (x: number, y: number) => Ponto
}

/** O canteiro: a terra, as quatro tábuas da borda e os mourões dos cantos, todos com o meio no furo do meio. */
function montarCanteiro(d: Desenho): void {
  const { c, L, k, em } = d
  const P = c.peca
  const mad = c.m.madeira
  const A = CANTEIRO
  const T = TABUA
  const cx = (x0: number, y0: number, x1: number, y1: number, r = 0): Forma => caixa(...em(x0, y0), ...em(x1, y1), r * k)
  // A moldura inteira por baixo das tábuas (fica escondida): é a maior peça do canteiro, e a 3/4 varre a
  // frente dele no material da maior peça; sem ela a frente saía da cor da terra.
  L.push(P(menos(cx(-A, -A, A, A, 1), cx(-A + T, -A + T, A - T, A - T)), mad, { tabua: 0, bisel: 0.6 * k, contorno: 0.2, semente: 7600 }))
  L.push(P(cx(-A + T - 0.5, -A + T - 0.5, A - T + 0.5, A - T + 0.5), TERRA, { tabua: 0, bisel: 0.4 * k, contorno: 0.2, recesso: { k: 2.2, forca: 0.4 }, textura: texDaTerra, semente: 7601 }))
  const borda = { tabua: 0, bisel: 0.9 * k, contorno: 0.24 }
  L.push(P(cx(-A, -A, A, -A + T, 0.4), mad, { ...borda, tom: 1.04, semente: 7602 }))
  L.push(P(cx(-A, A - T, A, A, 0.4), mad, { ...borda, tom: 0.96, semente: 7603 }))
  L.push(P(cx(-A, -A, -A + T, A, 0.4), mad, { ...borda, eixo: QUARTO, tom: 1.0, semente: 7604 }))
  L.push(P(cx(A - T, -A, A, A, 0.4), mad, { ...borda, eixo: QUARTO, tom: 0.92, semente: 7605 }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x0 = sx < 0 ? -A - 0.4 : A + 0.4 - MOURAO
    const y0 = sy < 0 ? -A - 0.4 : A + 0.4 - MOURAO
    L.push(P(cx(x0, y0, x0 + MOURAO, y0 + MOURAO, 0.8), mad, { tabua: 0, bisel: 1.1 * k, contorno: 0.26, tom: 0.84, recesso: { k: 1.2, forca: 0.16 }, semente: 7606 }))
  }
  // As folhas secas e as laranjas caídas nos cantos de terra, todas com o meio da caixa no meio do canteiro.
  FOLHAS_SECAS.forEach(([x, y, rumo], i) => {
    L.push(P(comMeioEm(elipseGirada(...em(x, y), 2 * k, 0.9 * k, rumo), 0, 0), FOLHA_SECA, { bisel: 0.3 * k, contorno: 0.2, tom: 0.9 + hash(i, 1, 7610) * 0.2, semente: 7610 + i }))
  })
  CAIDAS.forEach(([x, y], i) => montarLaranja(d, x, y, 2.1, 7620 + i * 4, true))
}

/**
 * Uma laranja: a bola com a luz, os poros, o cabinho e o brilho. A caixa de cada peça é recentrada no meio do
 * canteiro (`noChao`, a laranja caída) ou no meio da copa: a da beira da copa, entre dois lóbulos, podia ter o
 * meio fora da massa e ficar no chão na 3/4.
 */
function montarLaranja(d: Desenho, x: number, y: number, r: number, semente: number, noChao: boolean): void {
  const { c, L, k, em } = d
  const P = c.peca
  const [px, py] = em(x, y)
  const raio = r * k
  const [mx, my]: Ponto = noChao ? [0, 0] : em(COPA_X, COPA_Y)
  const naEstrutura = (f: Forma): Forma => comMeioEm(f, mx, my)
  L.push(P(naEstrutura(elipse(px, py, raio, raio)), LARANJA, { bisel: raio * 0.55, contorno: 0.3, textura: texDaLaranja, projeta: { dist: 0.9 * k, forca: 0.32, suave: 0.6 * k }, semente }))
  L.push(P(naEstrutura(elipse(px - raio * 0.36, py - raio * 0.38, raio * 0.3, raio * 0.24)), BRILHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.3 * k }))
  L.push(P(naEstrutura(elipse(px + raio * 0.18, py + raio * 0.1, raio * 0.2, raio * 0.2)), CABINHO, { bisel: 0, contorno: 0, alfa: 0.8 }))
}

/** A copa: a massa, as copinhas e os realces, as laranjas (as escondidas antes das copinhas) e as flores. */
function montarCopa(d: Desenho, massa: Forma, lobulos: readonly (readonly [number, number, number])[]): void {
  const { c, L, k, em } = d
  const P = c.peca
  L.push(P(massa, FOLHA, { bisel: 0, contorno: 0.22, tom: TOM_DA_MASSA, projeta: { dist: 1.6 * k, forca: 0.3, suave: 1.6 * k }, semente: 7630 }))
  const naCopa = (x: number, y: number): [number, number] => [COPA_X + x, COPA_Y + y]
  LARANJAS.forEach(([x, y, r, escondida], i) => {
    if (escondida) montarLaranja(d, ...naCopa(x, y), r, 7640 + i * 4, false)
  })
  lobulos.forEach(([x, y, r], i) => {
    const copa = dentroDe(elipse(x - COPA.puxa * r, y - COPA.puxa * r * 1.1, r * COPA.raio, r * COPA.raio), massa)
    L.push(P(copa, FOLHA, { bisel: 0, contorno: 0, semente: 7700 + i }))
  })
  lobulos.forEach(([x, y, r], i) => {
    if (hash(i, 3, 7720) >= REALCE.quantos) return
    const realce = dentroDe(elipse(x - REALCE.x * r, y - REALCE.y * r, r * REALCE.raio, r * REALCE.raio), massa)
    L.push(P(realce, FOLHA, { bisel: 0, contorno: 0, tom: REALCE.tom, semente: 7720 + i }))
  })
  LARANJAS.forEach(([x, y, r, escondida], i) => {
    if (!escondida) montarLaranja(d, ...naCopa(x, y), r, 7640 + i * 4, false)
  })
  const [mx, my] = em(COPA_X, COPA_Y)
  FLORES.forEach(([x, y], i) => {
    const [fx, fy] = em(...naCopa(x, y))
    L.push(P(comMeioEm(elipse(fx, fy, 1 * k, 1 * k), mx, my), BRANCO, { bisel: 0.3 * k, contorno: 0.2, semente: 7740 + i }))
    L.push(P(comMeioEm(elipse(fx, fy, 0.38 * k, 0.38 * k), mx, my), MIOLO_DA_FLOR, { bisel: 0, contorno: 0 }))
  })
}

export const montarLaranjeiraEmCanteiro: MontarMovel = (c, cena) => {
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const em = (x: number, y: number): Ponto => [x * k, y * k]
  const d: Desenho = { c, L: cena.partes, k, em }
  cena.corDoPiso = PISO_DA_FOLHA

  // Os lóbulos da copa: o do meio e os de volta, cada um de um raio.
  const lobulos: (readonly [number, number, number])[] = [[COPA_X * k, COPA_Y * k, RAIO_DO_MEIO * k]]
  for (let i = 0; i < LOBULOS; i += 1) {
    const a = (i / LOBULOS) * Math.PI * 2 + hash(i, 1, 7650) * 0.4
    const r = RAIO_DO_LOBULO + hash(i, 2, 7650) * RAIO_VARIA
    const dist = DISTANCIA_DO_LOBULO + (hash(i, 4, 7650) - 0.5) * 1.2
    lobulos.push([(COPA_X + Math.cos(a) * dist) * k, (COPA_Y + Math.sin(a) * dist) * k, r * k])
  }
  const massa = circulos(lobulos)

  const fora = caixa(...em(-CANTEIRO, -CANTEIRO), ...em(CANTEIRO, CANTEIRO), 1 * k)
  // O tronco: sobe da terra pelo comprimento que a 3/4 mostra entre a boca do canteiro e a beirada da copa;
  // de cima ele fica todo debaixo da copa.
  const [tx, ty] = em(TRONCO[0], TRONCO[1])
  const tronco = caixa(tx - RAIO_DO_TRONCO * k, ty - TRONCO_A_MOSTRA * k, tx + RAIO_DO_TRONCO * k, ty, RAIO_DO_TRONCO * k)
  const meioDoTronco = elipse(tx, ty - (TRONCO_A_MOSTRA * k) / 2, FURO * k, FURO * k)
  const furos = uniao(elipse(0, 0, FURO * k, FURO * k), meioDoTronco)
  const sombraDaCopa = naCaixa(menos(massa, furos), [massa.b[0], massa.b[1], massa.b[2], fora.b[3] + 1 * k])
  cena.sombras.push(
    contato(fora, 0.32),
    { forma: fora, z: c.g * ALTURA_DO_CANTEIRO * k, forca: 0.28 },
    { forma: sombraDaCopa, z: c.g * ALTURA_DA_COPA * k, solta: true, forca: 0.3, suave: 2.6 },
  )

  montarCanteiro(d)
  cena.partes.push(c.peca(tronco, CASCA_DO_TRONCO, { tabua: 0, eixo: QUARTO, bisel: 1.2 * k, contorno: 0.26, semente: 7660 }))
  montarCopa(d, massa, lobulos)
}
