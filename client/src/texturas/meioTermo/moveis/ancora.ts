/**
 * ÂNCORA de cima com volume (lote 12 dos objetos novos, 11/11/2026; a campanha
 * é de piratas): a âncora grande de navio, de almirantado, deitada no cais. A
 * HASTE de ferro corre ao comprido; na ponta da esquerda fica o OLHO, por onde
 * passa a ARGOLA, e logo depois dele o CEPO de madeira atravessado, em duas
 * metades presas por quatro cintas de ferro; na ponta da direita fica a CRUZ,
 * de onde saem os dois BRAÇOS em arco, cada um terminando na UNHA em ponta de
 * pá. Da argola sai um pedaço de CORRENTE GROSSA de malhete (os elos deitados,
 * com o travessão no meio, alternados com os de cutelo), que faz a curva no
 * chão e passa por baixo da ponta do cepo. O ferro é escuro e velho: a
 * FERRUGEM em manchas, mais comida perto da cruz (a parte que fica no fundo), e
 * as CRACAS em colônias na cruz, nos braços e nas unhas.
 *
 * Numa âncora de verdade o cepo fica de través ao plano dos braços; aqui ele
 * está deitado no mesmo plano, como no desenho da âncora que todo mundo
 * conhece. É essa silhueta que diz "âncora" a 25% de zoom: a barra com a cruz
 * de madeira numa ponta e o arco dos braços com as duas unhas na outra.
 *
 * Material: `madeira` (o cepo). O ferro, a ferrugem, as cracas e a corrente são
 * fixos: de latão, uma âncora de navio comida de ferrugem não faria sentido. O
 * comprimento sai da largura da pegada e a abertura dos braços e o cepo, da
 * altura (1,5 x 1 casa de partida); o que é redondo (a argola, os elos, as
 * cracas, as grossuras) sai do menor lado.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as cores ----------

/** O ferro da âncora, batido e escuro (um pouco abaixo do cano do canhão), e o das cintas do cepo, menos comido. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
const FERRO_DA_CINTA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.04)) }
/** A ferrugem da sucata: o barranco do Meio-Termo um pouco baixo (marrom-alaranjado, não laranja). */
const FERRUGEM: Rgb = rgb('#935f47')
/** No miolo da mancha ainda sobra um pouco do ferro de baixo. */
const FERRUGEM_CHEIA = 0.84
/** O brilho do ferro velho: bem abaixo do metal novo (0,42), a ferrugem não espelha. */
const BRILHO_DO_FERRO_VELHO = 0.2
/**
 * A craca: a casca de calcário, cinza-creme sujo, e a boca escura no alto do cone. Mais clara que isto, a
 * colônia virava um punhado de contas brancas em cima do ferro.
 */
const CASCA_DA_CRACA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xbe, 0xac] }
const BOCA_DA_CRACA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x44, 0x3c] }
/**
 * O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão. Com o piso padrão (a
 * nogueira) a barriga do ferro, que fica na sombra, saía marrom como madeira.
 */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * A FERRUGEM em manchas (a da sucata), nunca em listras: onde o ruído passa do limiar o tom vai para a ferrugem
 * e perde a luz. `quanto(x)` vai de 0 (quase limpo) a 0,6 (quase tudo comido) e pode mudar ao comprido.
 */
function texFerrugem(quanto: (x: number) => number): Textura {
  return (_u, _v, x, y, p, s) => {
    // Três escalas: a mancha grande, o recorte dela e o grão miúdo, que desfaz a beira (ferrugem não tem contorno).
    const mancha = ruido(x * 0.085 + p.su, y * 0.085 + p.sv) * 1.5 + ruido(x * 0.3 + p.sv, y * 0.3 + p.su) * 0.9 + ruido(x * 1.1 + p.su, y * 1.1) * 0.55
    const q = (mancha + quanto(x) - 0.2) / 0.5
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.1 + ruido(x * 0.75, y * 0.75 + p.sv) * 0.04 - t * 0.06
  }
}

/** A mesma ferrugem em toda a peça. */
function ferrugemPorIgual(quanto: number): Textura {
  return texFerrugem(() => quanto)
}

// ---------- a régua ----------

/** As medidas são frações da pegada: `X` ao comprido (da largura), `Y` de través (da altura); `k` = o menor lado. */
interface Regua {
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
  readonly k: number
}

/** Alturas em casas: o ferro deitado, as unhas (chapas), o cepo por cima da haste, a argola e os elos. */
const ALTURA_DO_FERRO = 0.1
const ALTURA_DA_UNHA = 0.06
const ALTURA_DO_CEPO = 0.2
const ALTURA_DA_ARGOLA = 0.05

// ---------- a haste, a cruz e os braços ----------

/** O olho (a ponta da haste por onde passa a argola) e a cruz, em frações da largura. */
const OLHO = -0.3
const CRUZ = 0.4
/** A meia grossura da haste no olho e na cruz, e os raios do olho e da cruz (frações do menor lado). */
const MEIA_HASTE_NO_OLHO = 0.042
const MEIA_HASTE_NA_CRUZ = 0.06
const RAIO_DO_OLHO = 0.074
const RAIO_DA_CRUZ = 0.07
/** O arco dos braços: o raio (fração da altura) e até onde cada braço abre, em radianos a partir da cruz. */
const RAIO_DOS_BRACOS = 0.37
const ABERTURA_DOS_BRACOS = 1.4
/** A meia grossura do braço na cruz e na ponta (frações do menor lado) e os pedaços do arco. */
const MEIO_BRACO_NA_CRUZ = 0.056
const MEIO_BRACO_NA_PONTA = 0.034
const PASSOS_DO_ARCO = 28
/** A ferrugem cresce da haste para a cruz: a do olho e a da cruz. */
const FERRUGEM_NO_OLHO = 0.16
const FERRUGEM_NA_CRUZ = 0.4
/**
 * A unha em ponta de pá, com o meio na ponta do braço: [ao longo do braço (para a frente, o bico), de través],
 * em frações do menor lado. Os ombros largos ficam para trás e o bico passa da ponta do braço.
 */
const UNHA: readonly Ponto[] = [
  [-0.105, -0.026],
  [-0.115, -0.07],
  [-0.085, -0.098],
  [-0.02, -0.088],
  [0.05, -0.052],
  [0.118, 0],
  [0.05, 0.052],
  [-0.02, 0.088],
  [-0.085, 0.098],
  [-0.115, 0.07],
  [-0.105, 0.026],
]
/** A nervura da unha (o braço que continua por baixo da chapa): de onde a onde vai, ao longo, e o raio. */
const NERVURA_DE = -0.095
const NERVURA_ATE = 0.075
const RAIO_DA_NERVURA = 0.013

/** A ponta de um braço: onde ela fica, o rumo para a frente (do braço para o bico) e o de través, para fora. */
interface PontaDoBraco {
  readonly x: number
  readonly y: number
  readonly frente: Ponto
  readonly fora: Ponto
}

/** O ferro forjado inteiro (haste, olho, cruz e os dois braços), numa forma só: sem emenda de contorno na cruz. */
function ferroForjado({ X, Y, k }: Regua): { corpo: Forma; pontas: readonly PontaDoBraco[]; xDoArco: number; raio: number } {
  const xOlho = X(OLHO)
  const xCruz = X(CRUZ)
  const haste = poligono([
    [xOlho, -k * MEIA_HASTE_NO_OLHO],
    [xCruz, -k * MEIA_HASTE_NA_CRUZ],
    [xCruz, k * MEIA_HASTE_NA_CRUZ],
    [xOlho, k * MEIA_HASTE_NO_OLHO],
  ])
  // Os braços: o arco que passa pela cruz, do braço de cima (ângulo negativo) ao de baixo, afinando para as pontas.
  const raio = Y(RAIO_DOS_BRACOS)
  const xDoArco = xCruz - raio
  const fora: Ponto[] = []
  const dentro: Ponto[] = []
  for (let i = 0; i <= PASSOS_DO_ARCO; i += 1) {
    const a = -ABERTURA_DOS_BRACOS + (2 * ABERTURA_DOS_BRACOS * i) / PASSOS_DO_ARCO
    const meio = k * (MEIO_BRACO_NA_CRUZ + ((MEIO_BRACO_NA_PONTA - MEIO_BRACO_NA_CRUZ) * Math.abs(a)) / ABERTURA_DOS_BRACOS)
    fora.push([xDoArco + (raio + meio) * Math.cos(a), (raio + meio) * Math.sin(a)])
    dentro.push([xDoArco + (raio - meio) * Math.cos(a), (raio - meio) * Math.sin(a)])
  }
  const bracos = poligono([...fora, ...dentro.reverse()])
  const nos = uniao(elipse(xCruz, 0, k * RAIO_DA_CRUZ, k * RAIO_DA_CRUZ), elipse(xOlho, 0, k * RAIO_DO_OLHO, k * RAIO_DO_OLHO * 0.94))
  const corpo = uniao(uniao(haste, bracos), nos)
  const pontas = [-1, 1].map((lado): PontaDoBraco => {
    const a = ABERTURA_DOS_BRACOS
    return {
      x: xDoArco + raio * Math.cos(a),
      y: lado * raio * Math.sin(a),
      frente: [-Math.sin(a), lado * Math.cos(a)],
      fora: [Math.cos(a), lado * Math.sin(a)],
    }
  })
  return { corpo, pontas, xDoArco, raio }
}

/** O ponto [ao longo, de través] (frações do menor lado) em volta da ponta do braço. */
function naPonta(p: PontaDoBraco, k: number): (q: Ponto) => Ponto {
  return ([s, t]) => [p.x + (s * p.frente[0] + t * p.fora[0]) * k, p.y + (s * p.frente[1] + t * p.fora[1]) * k]
}

// ---------- as cracas ----------

/** As cracas de cada colônia, o espalho da colônia e o raio de uma craca, do menor ao maior (frações do menor lado). */
const CRACAS_POR_COLONIA = 9
const ESPALHO_DA_COLONIA = 0.06
const RAIO_MENOR_DA_CRACA = 0.013
const RAIO_MAIOR_DA_CRACA = 0.027
/** A craca só pega no ferro: o meio dela fica pelo menos esta fração do raio para dentro da beira. */
const CRACA_DENTRO = 0.5
const SOMBRA_DA_CRACA: Projecao = { dist: 0.5, forca: 0.32, suave: 0.4 }

/** As colônias de cracas, cada uma num ponto do ferro; as cracas que caem fora do ferro não nascem. */
function montarCracas(c: ContextoDoMovel, L: Peca[], k: number, ferro: Forma, colonias: readonly Ponto[]): void {
  const P = c.peca
  colonias.forEach(([cx, cy], g) => {
    for (let i = 0; i < CRACAS_POR_COLONIA; i += 1) {
      const sem = 7100 + g * 16 + i
      const ang = hash(sem, 1, 7101) * Math.PI * 2
      const dist = Math.sqrt(hash(sem, 2, 7101)) * k * ESPALHO_DA_COLONIA
      const x = cx + Math.cos(ang) * dist
      const y = cy + Math.sin(ang) * dist
      const r = k * (RAIO_MENOR_DA_CRACA + (RAIO_MAIOR_DA_CRACA - RAIO_MENOR_DA_CRACA) * hash(sem, 3, 7101))
      if (ferro.d(x, y) > -r * CRACA_DENTRO) continue
      // O cone de calcário (o chanfro quase do tamanho do raio faz a cúpula) e a boca escura, um pouco para a luz.
      L.push(P(elipse(x, y, r, r * 0.92), CASCA_DA_CRACA, { bisel: r * 0.85, tom: 0.78 + 0.14 * hash(sem, 4, 7101), contorno: 0.3, semente: sem, projeta: SOMBRA_DA_CRACA }))
      L.push(P(elipseGirada(x - r * 0.08, y - r * 0.08, r * 0.48, r * 0.3, hash(sem, 5, 7101) * Math.PI), BOCA_DA_CRACA, { bisel: 0, contorno: 0, alfa: 0.9 }))
    }
  })
}

// ---------- a argola e a corrente ----------

/** A argola: o raio de fora e o do arame (frações do menor lado). */
const RAIO_DA_ARGOLA = 0.125
const ARAME_DA_ARGOLA = 0.036
/** Onde a corrente sai da argola: o ângulo no arame (radianos; para baixo à esquerda). */
const SAIDA_DA_CORRENTE = 2.1
/** O caminho da corrente no chão depois da argola: [x, y] em frações da largura e da altura. */
const CAMINHO_DA_CORRENTE: readonly Ponto[] = [
  [-0.41, 0.19],
  [-0.375, 0.31],
  [-0.3, 0.4],
  [-0.2, 0.44],
  [-0.107, 0.42],
  [-0.024, 0.375],
]
/** O elo de malhete: o comprimento, a largura e o raio do arame (frações do menor lado), e o passo (fração do comprimento). */
const COMPRIMENTO_DO_ELO = 0.2
const LARGURA_DO_ELO = 0.12
const ARAME_DO_ELO = 0.017
const PASSO_DO_ELO = 0.66
const ELOS = 6
/** Pedaços por vão da curva: a corrente não faz quina. */
const PASSOS_DA_CURVA = 6

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

/** O ponto e o rumo a `s` px do começo do caminho (pedaços retos). */
function noCaminho(caminho: readonly Ponto[], s: number): readonly [number, number, number] {
  let andado = 0
  for (let i = 1; i < caminho.length; i += 1) {
    const [ax, ay] = caminho[i - 1]
    const [bx, by] = caminho[i]
    const l = Math.hypot(bx - ax, by - ay)
    if (andado + l >= s || i === caminho.length - 1) {
      const t = limitar((s - andado) / (l || 1e-9), 0, 1.2)
      return [ax + (bx - ax) * t, ay + (by - ay) * t, Math.atan2(by - ay, bx - ax)]
    }
    andado += l
  }
  const [x, y] = caminho[0]
  return [x, y, 0]
}

/** Um elo da corrente: a forma, o meio e se está deitado (com o malhete) ou de cutelo. */
interface Elo {
  readonly forma: Forma
  readonly deitado: boolean
}

/**
 * Os elos ao longo do caminho, a partir do arame da argola. O primeiro passa por dentro da argola, de cutelo; dali
 * em diante um deitado (o oval com o travessão do malhete no meio) e um de cutelo (de cima, só o lombo do arame).
 */
function elosDaCorrente(inicio: Ponto, { X, Y, k }: Regua): Elo[] {
  const caminho = curva([inicio, ...CAMINHO_DA_CORRENTE.map(([fx, fy]): Ponto => [X(fx), Y(fy)])])
  const comprido = k * COMPRIMENTO_DO_ELO
  const largo = k * LARGURA_DO_ELO
  const r = k * ARAME_DO_ELO
  const elos: Elo[] = []
  for (let i = 0; i < ELOS; i += 1) {
    const [x, y, ang] = noCaminho(caminho, comprido / 2 - r * 1.6 + i * comprido * PASSO_DO_ELO)
    const co = Math.cos(ang)
    const si = Math.sin(ang)
    const deitado = i % 2 === 1
    if (deitado) {
      const oval = menos(elipseGirada(x, y, comprido / 2, largo / 2, ang), elipseGirada(x, y, comprido / 2 - 2 * r, largo / 2 - 2 * r, ang))
      const malhete = barra(x + si * (largo / 2 - r), y - co * (largo / 2 - r), x - si * (largo / 2 - r), y + co * (largo / 2 - r), r * 1.6)
      elos.push({ forma: uniao(oval, malhete), deitado })
    } else {
      const meio = comprido / 2 - r
      elos.push({ forma: capsula(x - co * meio, y - si * meio, x + co * meio, y + si * meio, r * 1.15), deitado })
    }
  }
  return elos
}

// ---------- o cepo ----------

/** O cepo: onde atravessa a haste (fração da largura), a meia altura (fração da altura) e a meia largura no meio e nas pontas (menor lado). */
const CEPO = -0.16
const MEIO_COMPRIMENTO_DO_CEPO = 0.47
const MEIA_LARGURA_NO_MEIO = 0.078
const MEIA_LARGURA_NA_PONTA = 0.054
/** As quatro cintas de ferro: onde (frações do meio comprimento) e a largura de cada uma (menor lado). */
const CINTAS: readonly number[] = [-0.78, -0.26, 0.26, 0.78]
const LARGURA_DA_CINTA = 0.034
/** A sombra que o cepo faz na haste e na corrente, embaixo dele. */
const SOMBRA_DO_CEPO: Projecao = { dist: 2.4, forca: 0.36, suave: 1.1 }

function montarCepo(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const x = X(CEPO)
  const ponta = Y(MEIO_COMPRIMENTO_DO_CEPO)
  const meio = k * MEIA_LARGURA_NO_MEIO
  const fim = k * MEIA_LARGURA_NA_PONTA
  // As duas metades do cepo, afinando para as pontas: a da luz mais clara, a outra na sombra, e a emenda no meio.
  const esquerda = poligono([[x - fim, -ponta], [x, -ponta], [x, ponta], [x - fim, ponta], [x - meio, 0]])
  const direita = poligono([[x, -ponta], [x + fim, -ponta], [x + meio, 0], [x + fim, ponta], [x, ponta]])
  // O cepo está no ar, por cima da haste: a sombra cai solta, para baixo à direita.
  cena.sombras.push({ forma: uniao(esquerda, direita), z: c.g * ALTURA_DO_CEPO, solta: true, forca: 0.3 })
  cena.partes.push(P(esquerda, mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 1.04, contorno: 0.26, semente: 7200, projeta: SOMBRA_DO_CEPO }))
  cena.partes.push(P(direita, mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.88, contorno: 0.26, semente: 7201, projeta: SOMBRA_DO_CEPO }))
  CINTAS.forEach((f, i) => {
    const y = f * ponta
    const meiaLargura = fim + (meio - fim) * (1 - Math.abs(f)) + 0.5
    const meiaCinta = (k * LARGURA_DA_CINTA) / 2
    cena.partes.push(P(caixa(x - meiaLargura, y - meiaCinta, x + meiaLargura, y + meiaCinta, 0.5), FERRO_DA_CINTA, {
      tabua: 0,
      bisel: 0.6,
      contorno: 0.28,
      metal: 0.3,
      textura: ferrugemPorIgual(0.14),
      semente: 7210 + i,
      projeta: { dist: 0.6, forca: 0.26 },
    }))
  })
}

// ---------- a âncora ----------

export const montarAncora: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const regua: Regua = { X: (f) => f * c.w, Y: (f) => f * c.h, k: Math.min(c.h, c.w / 1.5) }
  const { X, k } = regua
  cena.corDoPiso = ESCURO_DO_FERRO

  // A argola: o arame passa pelo olho da haste, então o meio dela fica para fora do olho.
  const rArgola = k * RAIO_DA_ARGOLA
  const arame = k * ARAME_DA_ARGOLA
  const xArgola = X(OLHO) - (rArgola - arame)
  const argola = anel(xArgola, 0, rArgola, rArgola, rArgola - 2 * arame, rArgola - 2 * arame)
  const elos = elosDaCorrente([xArgola + Math.cos(SAIDA_DA_CORRENTE) * (rArgola - arame), Math.sin(SAIDA_DA_CORRENTE) * (rArgola - arame)], regua)
  const r = k * ARAME_DO_ELO

  // Os elos deitados, no chão; a argola por cima deles; os de cutelo, em pé, por cima dos dois.
  elos.forEach((elo, i) => {
    if (!elo.deitado) return
    cena.sombras.push({ forma: elo.forma, z: r * 2.4 }, contato(elo.forma, 0.3))
    L.push(P(elo.forma, FERRO, { tabua: 0, bisel: r, contorno: 0.3, metal: BRILHO_DO_FERRO_VELHO, textura: ferrugemPorIgual(0.36), semente: 7300 + i }))
  })
  cena.sombras.push({ forma: argola, z: c.g * ALTURA_DA_ARGOLA }, contato(argola, 0.3))
  L.push(P(argola, FERRO, { tabua: 0, bisel: arame, tom: 1.04, contorno: 0.3, metal: 0.26, textura: ferrugemPorIgual(0.22), semente: 7310, projeta: { dist: 0.8, forca: 0.3 } }))
  elos.forEach((elo, i) => {
    if (elo.deitado) return
    cena.sombras.push({ forma: elo.forma, z: k * LARGURA_DO_ELO }, contato(elo.forma, 0.32))
    L.push(P(elo.forma, FERRO, { tabua: 0, bisel: r * 1.15, tom: 1.1, contorno: 0.3, metal: 0.26, textura: ferrugemPorIgual(0.3), semente: 7320 + i, projeta: { dist: 1, forca: 0.36, suave: 0.6 } }))
  })

  // O ferro forjado: a haste, o olho (por cima do arame da argola), a cruz e os braços.
  const { corpo, pontas, xDoArco, raio } = ferroForjado(regua)
  const xOlho = X(OLHO)
  const xCruz = X(CRUZ)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DO_FERRO }, contato(corpo, 0.32))
  const comida = (x: number): number => FERRUGEM_NO_OLHO + (FERRUGEM_NA_CRUZ - FERRUGEM_NO_OLHO) * limitar((x - xOlho) / (xCruz - xOlho), 0, 1)
  L.push(P(corpo, FERRO, { tabua: 0, bisel: k * 0.046, contorno: 0.3, metal: BRILHO_DO_FERRO_VELHO, textura: texFerrugem(comida), semente: 7330, projeta: { dist: 1.2, forca: 0.32 } }))

  // As unhas: a chapa em ponta de pá na ponta de cada braço, com a nervura do braço por baixo dela.
  const unhas = pontas.map((ponta, i) => {
    const em = naPonta(ponta, k)
    const unha = poligono(UNHA.map(em))
    cena.sombras.push({ forma: unha, z: c.g * ALTURA_DA_UNHA }, contato(unha, 0.3))
    L.push(P(unha, FERRO, { tabua: 0, bisel: 1, tom: 1.06, contorno: 0.3, metal: BRILHO_DO_FERRO_VELHO, textura: ferrugemPorIgual(0.34), semente: 7340 + i, projeta: { dist: 0.9, forca: 0.3 } }))
    const [ax, ay] = em([NERVURA_DE, 0])
    const [bx, by] = em([NERVURA_ATE, 0])
    L.push(P(capsula(ax, ay, bx, by, k * RAIO_DA_NERVURA), FERRO, { tabua: 0, bisel: k * RAIO_DA_NERVURA, tom: 1.12, contorno: 0.16, metal: 0.24, textura: ferrugemPorIgual(0.3), semente: 7342 + i }))
    return unha
  })

  // As cracas: na cruz, no meio de cada braço, perto da unha de baixo, na haste junto da cruz e na unha de cima.
  const noArco = (a: number): Ponto => [xDoArco + raio * Math.cos(a), raio * Math.sin(a)]
  const ferroComUnhas = uniao(corpo, uniao(unhas[0], unhas[1]))
  montarCracas(c, L, k, ferroComUnhas, [
    noArco(0.12),
    noArco(-0.62),
    noArco(0.95),
    [X(0.3), k * 0.01],
    naPonta(pontas[0], k)([-0.06, 0.02]),
  ])

  montarCepo(c, cena, regua)
}
