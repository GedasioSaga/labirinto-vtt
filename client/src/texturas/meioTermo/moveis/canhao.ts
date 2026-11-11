/**
 * CANHÃO DE NAVIO de cima com volume (lote 1 dos objetos novos, 11/11/2026; a
 * campanha é de piratas). O CANO de ferro escuro deitado ao longo do lado
 * maior, a boca para a direita: o cascavel (o botão de trás), a faixa da
 * culatra, o ouvido, os dois reforços com os anéis, a bolada afinando até o
 * pescoço e a tulipa da boca, com a alma escura. Embaixo dele a CARRETA de
 * madeira: as duas falcas (as pranchas de pé, com os degraus descendo para
 * trás), as chapas de ferro que prendem os munhões, os dois eixos e as quatro
 * rodinhas maciças, vistas do alto. O VERGUEIRO (a corda que segura o recuo)
 * dá a volta no cascavel, passa nas argolas das falcas e corre solto no convés
 * dos dois lados; o lado de cima é mais curto para dar lugar à pilha de BALAS
 * (a pirâmide de dez).
 *
 * A 25% de zoom sobra a barra escura do cano com os anéis, a caixa de madeira
 * com as quatro rodas e o triângulo das balas: é o que diz "canhão" e não
 * "tronco". Materiais: `metal` (o cano: ferro, ou latão, que lê como bronze) e
 * `madeira` (a carreta); as ferragens, a corda e as balas são fixas. O
 * comprimento sai da largura da pegada e a grossura, da altura dela (2 x 1
 * casas de partida); o que é redondo (balas, corda, argolas) sai do menor lado.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, poligono, uniao, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As ferragens da carreta (chapas, cavilhas, argolas) e as balas: ferro batido, um pouco mais escuro que o do cano. */
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
const BALA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.8)) }
/** O fundo dos furos do cano (a alma e o ouvido): quase preto, sem cor; o piso de luz o levanta para o escuro do ferro. */
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x25, 0x27] }
/** O vergueiro: cânhamo cru, mais escuro e mais quente que a corda clara da cerca (que some na lajota clara). */
const TOM_DO_CABO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CABO: Rgb = [0x8e, 0x76, 0x50]
const CABO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CABO }
/** A falcaça (o fio enrolado que arremata a ponta da corda). */
const FALCACA: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x54, 0x3a] }
/**
 * O escuro em que o pixel escuro demais é levantado: cinza-escuro quente. Com o piso padrão (a nogueira) a
 * barriga do cano, que fica na sombra, saía marrom como madeira.
 */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

// ---------- a luz do cilindro ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/**
 * Quanto a luz muda do lombo às beiras do cilindro: menos no ferro escuro, que está perto do piso de luz (com
 * mais, meio cano virava uma faixa chapada no escuro), mais na madeira clara das rodas.
 */
const FORCA_NO_FERRO = 0.62
const FORCA_NA_MADEIRA = 0.9
/** A faixa polida do metal: a que distância do lombo ela fica (para o lado da luz) e a meia largura dela. */
const LUGAR_DO_REFLEXO = 0.38
const LARGURA_DO_REFLEXO = 0.15
/** A luz que o chão devolve na barriga do cilindro de metal, um pouco antes da beira de baixo. */
const LUGAR_DA_LUZ_REBATIDA = 0.76
const LARGURA_DA_LUZ_REBATIDA = 0.14
const LUZ_REBATIDA = 0.1
/** O brilho da faixa polida, em tons de 0 a 255: o cano fundido, os anéis torneados e as ferragens batidas. */
const REFLEXO_DO_CANO = 58
const REFLEXO_DO_ANEL = 76
const REFLEXO_DA_FERRAGEM = 34

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * A textura de um CILINDRO deitado. O chanfro do motor tem uma largura só e não arredonda uma peça que afina (o
 * cano), então a luz de través vai aqui: `onde` diz em que ponto entre as duas beiras o pixel está (-1 e 1; 0 no
 * lombo) e `paraALuz` é a parte da luz que atravessa o cilindro (`LUZ_Y` no que corre em x, `LUZ_X` no que corre
 * em y). `reflexo` = o brilho da faixa polida do metal (0 na madeira, que também não devolve a luz do chão). Por
 * baixo, a textura do material.
 */
function texDeCilindro(onde: (x: number, y: number) => number, paraALuz: number, forca: number, reflexo: number, classe: 'metal' | 'madeira'): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(onde(x, y), -1, 1)
    s[3] += forca * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (reflexo > 0) {
      const polido = (q + LUGAR_DO_REFLEXO) / LARGURA_DO_REFLEXO
      const brilho = reflexo * Math.exp(-polido * polido)
      s[0] += brilho
      s[1] += brilho
      s[2] += brilho
      const rebatida = (q - LUGAR_DA_LUZ_REBATIDA) / LARGURA_DA_LUZ_REBATIDA
      s[3] += LUZ_REBATIDA * Math.exp(-rebatida * rebatida)
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

// ---------- a régua ----------

/** As medidas do desenho são frações da pegada: `X` ao comprido (da largura), `Y` de través (da altura). */
interface Regua {
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
  /** O que é redondo sai do menor lado (a casa de partida): continua redondo no objeto esticado. */
  readonly k: number
}

// ---------- a carreta ----------

/** De onde a onde vai a carreta, e as duas falcas (por dentro e por fora, a partir do eixo do cano). */
const CARRETA_DE = -0.455
const CARRETA_ATE = 0.143
const FALCA_POR_DENTRO = 0.125
const FALCA_POR_FORA = 0.235
/** Os degraus da falca, de trás (o mais baixo) para a frente: onde cada um acaba e o tom (o de baixo pega menos luz). */
const DEGRAUS_DA_FALCA: readonly (readonly [number, number])[] = [
  [-0.321, 0.78],
  [-0.232, 0.86],
  [-0.143, 0.93],
  [CARRETA_ATE, 1],
]
/** Quanto cada degrau entra por baixo do seguinte (px do protótipo): sem fresta entre eles. */
const SOBRA_DO_DEGRAU = 0.5
/** Os dois eixos: onde ficam, o raio da roda (as da frente são maiores) e a altura do topo dela em casas. */
const EIXOS: readonly (readonly [number, number, number])[] = [
  [-0.34, 0.068, 0.24],
  [0.054, 0.08, 0.28],
]
const MEIA_LARGURA_DO_EIXO = 0.02
const RODA_POR_DENTRO = 0.25
const RODA_POR_FORA = 0.343
const PONTA_DO_EIXO = 0.378
/** Onde o cano se apoia: os munhões (os dois pinos do lado dele), presos por uma chapa em cima de cada falca. */
const MUNHAO = -0.065
/** As cavilhas (os ferros que atravessam a falca): onde ficam as cabeças. */
const CAVILHAS: readonly number[] = [-0.275, -0.19, 0.105]
/** Alturas em casas: o topo da falca e o lombo do cano. */
const ALTURA_DA_FALCA = 0.34
const ALTURA_DO_CANO = 0.52

function montarCarreta(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const porDentro = Y(FALCA_POR_DENTRO)
  const porFora = Y(FALCA_POR_FORA)
  const corpo = caixa(X(CARRETA_DE), -porFora, X(CARRETA_ATE), porFora, 1.2)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DA_FALCA }, contato(corpo, 0.3))

  // Os eixos por baixo de tudo e, nas pontas deles, as rodas: do alto a roda é uma tira, redonda ao comprido.
  EIXOS.forEach(([onde, raioDaRoda, altura], i) => {
    const x = X(onde)
    const R = X(raioDaRoda)
    L.push(P(caixa(x - X(MEIA_LARGURA_DO_EIXO), -Y(PONTA_DO_EIXO), x + X(MEIA_LARGURA_DO_EIXO), Y(PONTA_DO_EIXO), 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.64, semente: 3100 + i }))
    for (const lado of [-1, 1]) {
      const roda = caixa(x - R, Math.min(lado * Y(RODA_POR_DENTRO), lado * Y(RODA_POR_FORA)), x + R, Math.max(lado * Y(RODA_POR_DENTRO), lado * Y(RODA_POR_FORA)), 1.4)
      cena.sombras.push({ forma: roda, z: c.g * altura }, contato(roda, 0.32))
      L.push(P(roda, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: 0.86, contorno: 0.28, textura: texDeCilindro((px) => (px - x) / R, LUZ_X, FORCA_NA_MADEIRA, 0, 'madeira'), semente: 3104 + i * 2 + (lado + 1) / 2 }))
      // A chaveta: o pino de ferro que segura a roda na ponta do eixo.
      L.push(P(elipse(x, (lado * Y(RODA_POR_FORA + PONTA_DO_EIXO)) / 2, k * 0.014, k * 0.014), FERRAGEM, { bisel: 0.7, contorno: 0.1, metal: 0.3 }))
    }
  })

  // O leito entre as falcas: só aparece atrás da culatra, em volta do cascavel.
  L.push(P(caixa(X(CARRETA_DE) + 0.8, -porDentro - 0.5, X(CARRETA_ATE) - 1.5, porDentro + 0.5, 0.5), mad, { eixo: QUARTO, tabua: X(0.05), bisel: 0.6, tom: 0.62, recesso: { k: 2, forca: 0.3 }, semente: 3110 }))

  for (const lado of [-1, 1]) {
    const y0 = Math.min(lado * porDentro, lado * porFora)
    const y1 = Math.max(lado * porDentro, lado * porFora)
    const meio = (y0 + y1) / 2
    // A falca em degraus: o de trás primeiro, cada um mais alto e mais claro; a quina de cada degrau olha para a luz.
    let de = X(CARRETA_DE)
    DEGRAUS_DA_FALCA.forEach(([ate, tom], i) => {
      L.push(P(caixa(de - (i > 0 ? SOBRA_DO_DEGRAU : 0), y0, X(ate), y1, 0.7), mad, { tabua: 0, bisel: 0.9, tom, contorno: 0.26, semente: 3120 + i + (lado + 1) * 5, projeta: { dist: 1.2, forca: 0.26 } }))
      de = X(ate)
    })
    for (const onde of CAVILHAS) L.push(P(elipse(X(onde), meio, k * 0.013, k * 0.013), FERRAGEM, { bisel: 0.7, contorno: 0.1, metal: 0.3 }))
    // A chapa do munhão: a tira de ferro aparafusada na falca, com o lombo que passa por cima do pino.
    const xM = X(MUNHAO)
    const meiaChapa = k * 0.11
    const lombo = k * 0.05
    L.push(P(caixa(xM - meiaChapa, y0 + 0.6, xM + meiaChapa, y1 - 0.6, 0.7), FERRAGEM, { tabua: 0, bisel: 0.6, tom: 0.92, contorno: 0.2, metal: 0.2, semente: 3140 + lado, projeta: { dist: 0.6, forca: 0.24 } }))
    L.push(P(caixa(xM - lombo, y0 + 0.3, xM + lombo, y1 - 0.3, 0.9), FERRAGEM, { tabua: 0, bisel: 0.6, tom: 1.08, contorno: 0.2, metal: 0.2, textura: texDeCilindro((px) => (px - xM) / lombo, LUZ_X, FORCA_NO_FERRO, REFLEXO_DA_FERRAGEM, 'metal'), semente: 3143 + lado }))
    for (const ponta of [-1, 1]) L.push(P(elipse(xM + ponta * meiaChapa * 0.78, meio, k * 0.012, k * 0.012), FERRAGEM, { bisel: 0.7, tom: 1.2, contorno: 0.1, metal: 0.36 }))
  }
}

// ---------- o cano ----------

/**
 * O perfil do cano, da culatra à boca: [onde, raio]. A culatra arredonda, os dois reforços afinam devagar com um
 * degrau em cada anel, a bolada afina até o pescoço e a tulipa abre na boca.
 */
const PERFIL_DO_CANO: readonly Ponto[] = [
  [-0.411, 0.09],
  [-0.404, 0.131],
  [-0.393, 0.145],
  [-0.196, 0.14],
  [-0.195, 0.136],
  [0.036, 0.128],
  [0.037, 0.121],
  [0.34, 0.101],
  [0.366, 0.104],
  [0.393, 0.12],
  [0.415, 0.13],
  [0.433, 0.128],
  [0.442, 0.118],
]
/** Os anéis: onde ficam, a largura e quanto saem do cano. Os três largos (culatra e reforços) e os filetes ao lado. */
const ANEIS_DO_CANO: readonly (readonly [number, number, number])[] = [
  [-0.389, 0.03, 0.02],
  [-0.34, 0.011, 0.009],
  [-0.196, 0.024, 0.014],
  [-0.172, 0.009, 0.007],
  [0.036, 0.024, 0.014],
  [0.06, 0.009, 0.007],
  [0.336, 0.013, 0.01],
]
/** O ouvido (o furo por onde se dá fogo), no alto da culatra. */
const OUVIDO = -0.362
/** O cascavel: o pescoço atrás da culatra e o botão na ponta (os raios: o do pescoço, da altura; o do botão, do menor lado). */
const PESCOCO_DE = -0.455
const RAIO_DO_PESCOCO = 0.03
const BOTAO = -0.462
const RAIO_DO_BOTAO = 0.047
const TOM_DO_CANO = 0.88
const TOM_DO_ANEL = 1.04

/** O raio do cano (fração da altura da pegada) em `f` (fração do comprimento), entre os pontos do perfil. */
function raioNoPerfil(f: number): number {
  const ultimo = PERFIL_DO_CANO.length - 1
  if (f <= PERFIL_DO_CANO[0][0]) return PERFIL_DO_CANO[0][1]
  for (let i = 1; i <= ultimo; i += 1) {
    const [f1, r1] = PERFIL_DO_CANO[i]
    if (f > f1) continue
    const [f0, r0] = PERFIL_DO_CANO[i - 1]
    return r0 + ((r1 - r0) * (f - f0)) / (f1 - f0)
  }
  return PERFIL_DO_CANO[ultimo][1]
}

function montarCano(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const ferro = c.m.metal
  const L = cena.partes
  const raio = (x: number): number => Y(raioNoPerfil(x / c.w))
  const corpo = poligono([
    ...PERFIL_DO_CANO.map(([f, r]): Ponto => [X(f), -Y(r)]),
    ...[...PERFIL_DO_CANO].reverse().map(([f, r]): Ponto => [X(f), Y(r)]),
  ])
  // O cano está no ar, em cima da carreta: a sombra dele cai solta, para baixo à direita.
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DO_CANO, solta: true, forca: 0.3 })

  // O pescoço do cascavel sai de trás da culatra (o vergueiro passa por cima dele; o botão vem depois da corda).
  L.push(P(capsula(X(PESCOCO_DE), 0, X(PERFIL_DO_CANO[1][0]), 0, Y(RAIO_DO_PESCOCO)), ferro, { tabua: 0, bisel: Y(RAIO_DO_PESCOCO), tom: 0.86, contorno: 0.3, metal: 0.3, semente: 3150 }))
  L.push(P(corpo, ferro, { tabua: 0, bisel: 0.9, tom: TOM_DO_CANO, contorno: 0.3, metal: 0.2, textura: texDeCilindro((px, py) => py / raio(px), LUZ_Y, FORCA_NO_FERRO, REFLEXO_DO_CANO, 'metal'), semente: 3151, projeta: { dist: 3, forca: 0.36, suave: 1.3 } }))
  ANEIS_DO_CANO.forEach(([onde, largura, saliencia], i) => {
    const x = X(onde)
    const r = raio(x) + Y(saliencia)
    const meia = X(largura) / 2
    L.push(P(caixa(x - meia, -r, x + meia, r, 0.5), ferro, { tabua: 0, bisel: 0.6, tom: TOM_DO_ANEL, contorno: 0.24, metal: 0.2, textura: texDeCilindro((_px, py) => py / r, LUZ_Y, FORCA_NO_FERRO, REFLEXO_DO_ANEL, 'metal'), semente: 3152 + i, projeta: { dist: 0.7, forca: 0.22 } }))
  })
  // O ouvido: o furinho no alto da culatra, com a beira batida em volta.
  L.push(P(elipse(X(OUVIDO), 0, k * 0.024, k * 0.024), ferro, { tabua: 0, bisel: 0.6, tom: 1.1, contorno: 0.2, metal: 0.3, semente: 3160 }))
  L.push(P(elipse(X(OUVIDO), 0, k * 0.011, k * 0.011), FURO, { bisel: 0.3, contorno: 0, semente: 3161 }))
  // A boca: a cara do cano vista de viés (como o corte da tora) e a alma escura.
  const [fBoca, rBoca] = PERFIL_DO_CANO[PERFIL_DO_CANO.length - 1]
  L.push(P(elipse(X(fBoca), 0, Y(rBoca) * 0.3, Y(rBoca) * 0.98), ferro, { tabua: 0, bisel: 0.7, tom: 1.06, contorno: 0.3, metal: 0.25, semente: 3162 }))
  L.push(P(elipse(X(fBoca) + Y(rBoca) * 0.04, 0, Y(rBoca) * 0.16, Y(rBoca) * 0.52), FURO, { bisel: 0.3, contorno: 0, recesso: { k: 0.8, forca: 0.3 }, semente: 3163 }))
}

// ---------- o vergueiro ----------

/** O raio da corda e da argola, em frações do menor lado. */
const RAIO_DO_CABO = 0.024
const RAIO_DA_ARGOLA = 0.044
/** A volta do cascavel, do meio do pescoço até a argola da falca: [onde, para fora]. */
const VOLTA_DO_CASCAVEL: readonly Ponto[] = [
  [-0.425, 0],
  [-0.424, 0.09],
  [-0.42, 0.18],
]
/** Da argola para fora e para a frente, por fora das rodas: a corda solta no convés, com um pouco de folga. */
const LADO_DO_VERGUEIRO: readonly Ponto[] = [
  [-0.42, 0.18],
  [-0.425, 0.26],
  [-0.428, 0.345],
  [-0.41, 0.41],
  [-0.36, 0.445],
  [-0.25, 0.452],
  [-0.12, 0.438],
  [0, 0.45],
  [0.09, 0.456],
  [0.16, 0.44],
]
/** A ponta comprida (o lado de baixo, que vai até a frente e vira para o cano) e a curta (o de cima, que para antes das balas). */
const PONTA_COMPRIDA: readonly Ponto[] = [
  [0.24, 0.425],
  [0.31, 0.44],
  [0.37, 0.42],
  [0.41, 0.37],
  [0.445, 0.345],
]
const PONTA_CURTA: readonly Ponto[] = [[0.2, 0.4]]
/** Pedaços por vão da curva: a corda não faz quina. */
const PASSOS_DA_CURVA = 4
/** Comprimento de uma volta da torção ao longo da corda (px do protótipo): ~3 pixels no tamanho de mesa. */
const PASSO_DA_TORCAO = 3.4

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

/**
 * A torção da corda AO LONGO do caminho dela: as faixas em diagonal acompanham as curvas (com o veio reto do
 * motor elas viravam riscos ao comprido onde a corda vira).
 */
function texDoCabo(caminho: readonly Ponto[], raio: number): Textura {
  const ate: number[] = [0]
  for (let i = 1; i < caminho.length; i += 1) ate.push(ate[i - 1] + Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]))
  return (_u, _v, x, y, _p, s) => {
    let menor = Infinity
    let aoLongo = 0
    let atraves = 0
    for (let i = 1; i < caminho.length; i += 1) {
      const [ax, ay] = caminho[i - 1]
      const dx = caminho[i][0] - ax
      const dy = caminho[i][1] - ay
      const comprimento = ate[i] - ate[i - 1] || 1e-9
      const h = limitar(((x - ax) * dx + (y - ay) * dy) / (comprimento * comprimento), 0, 1)
      const qx = x - ax - dx * h
      const qy = y - ay - dy * h
      const d2 = qx * qx + qy * qy
      if (d2 >= menor) continue
      menor = d2
      aoLongo = ate[i - 1] + h * comprimento
      atraves = (qy * dx - qx * dy) / comprimento
    }
    const faixa = Math.sin((aoLongo / PASSO_DA_TORCAO) * Math.PI * 2 + (atraves / raio) * 1.2)
    const t = limitar((faixa - 0.2) / 0.8, 0, 1)
    s[0] += (TORCAO_DO_CABO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CABO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CABO[2] - s[2]) * t
    s[3] += 0.06
  }
}

function montarVergueiro(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const raio = k * RAIO_DO_CABO
  const noLado = (lado: number) => ([fx, fy]: Ponto): Ponto => [X(fx), lado * Y(fy)]
  const pedaco = (pontos: readonly Ponto[], semente: number): Ponto[] => {
    const caminho = curva(pontos)
    const forma = cadeia(caminho, raio)
    cena.sombras.push(contato(forma, 0.22))
    L.push(P(forma, CABO, { bisel: raio, contorno: 0.3, textura: texDoCabo(caminho, raio), semente, projeta: { dist: 0.7, forca: 0.28 } }))
    return caminho
  }
  // A volta do cascavel: de uma argola à outra, por cima do pescoço.
  pedaco([...VOLTA_DO_CASCAVEL.map(noLado(1)).reverse(), ...VOLTA_DO_CASCAVEL.slice(1).map(noLado(-1))], 3170)
  for (const [lado, ponta] of [[1, PONTA_COMPRIDA], [-1, PONTA_CURTA]] as const) {
    const caminho = pedaco([...LADO_DO_VERGUEIRO, ...ponta].map(noLado(lado)), 3172 + lado)
    // A falcaça na ponta solta: duas voltas de fio escuro, um pouco antes do fim.
    const [fx, fy] = caminho[caminho.length - 1]
    const [ax, ay] = caminho[caminho.length - 2]
    const comprimento = Math.hypot(fx - ax, fy - ay) || 1
    const ux = (fx - ax) / comprimento
    const uy = (fy - ay) / comprimento
    L.push(P(capsula(fx - ux * raio * 2.6, fy - uy * raio * 2.6, fx - ux * raio * 1.2, fy - uy * raio * 1.2, raio * 1.1), FALCACA, { bisel: raio, contorno: 0.2, semente: 3175 + lado }))
    // A argola da falca, por cima da emenda dos dois pedaços de corda: a corda passa por dentro dela.
    const [gx, gy] = caminho[0]
    const rA = k * RAIO_DA_ARGOLA
    L.push(P(anel(gx, gy, rA, rA, rA * 0.5, rA * 0.5), FERRAGEM, { tabua: 0, bisel: 0.7, tom: 1.1, contorno: 0.26, metal: 0.4, semente: 3178 + lado, projeta: { dist: 0.6, forca: 0.24 } }))
  }
}

// ---------- as balas ----------

/** Onde fica a pilha (o meio da fileira de baixo) e o raio de uma bala, em frações do menor lado. */
const PILHA_DE_BALAS: Ponto = [0.35, -0.235]
const RAIO_DA_BALA = 0.056
const RAIZ_DE_3 = Math.sqrt(3)
/** Quanto sobe cada camada, em raios: a bala de cima assenta no vão de três de baixo. */
const SUBIDA_DA_CAMADA = Math.sqrt(8 / 3)
/**
 * A pirâmide de dez, camada por camada, em raios a partir do meio da fileira de baixo: seis embaixo (3, 2 e 1),
 * três no meio (cada uma no vão de três de baixo) e uma em cima. O tom sobe com a camada.
 */
const CAMADAS_DE_BALAS: readonly { readonly tom: number; readonly balas: readonly Ponto[] }[] = [
  { tom: 0.82, balas: [[-2, 0], [0, 0], [2, 0], [-1, -RAIZ_DE_3], [1, -RAIZ_DE_3], [0, -2 * RAIZ_DE_3]] },
  { tom: 0.94, balas: [[-1, -RAIZ_DE_3 / 3], [1, -RAIZ_DE_3 / 3], [0, (-4 * RAIZ_DE_3) / 3]] },
  { tom: 1.06, balas: [[0, (-2 * RAIZ_DE_3) / 3]] },
]

function montarBalas(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const r = k * RAIO_DA_BALA
  const cx = X(PILHA_DE_BALAS[0])
  const cy = Y(PILHA_DE_BALAS[1])
  CAMADAS_DE_BALAS.forEach((camada, i) => {
    const formas = camada.balas.map(([bx, by]) => elipse(cx + bx * r, cy + by * r, r, r))
    const todas = formas.reduce(uniao)
    cena.sombras.push({ forma: todas, z: r * (2 + i * SUBIDA_DA_CAMADA), forca: 0.3 })
    if (i === 0) cena.sombras.push(contato(todas, 0.34))
    formas.forEach((forma, j) => {
      cena.partes.push(P(forma, BALA, { tabua: 0, bisel: r, tom: camada.tom, contorno: 0.3, metal: 0.5, semente: 3180 + i * 6 + j, projeta: i > 0 ? { dist: 1.1, forca: 0.4, suave: 0.8 } : undefined }))
    })
  })
}

export const montarCanhao: MontarMovel = (c, cena) => {
  const regua: Regua = { X: (f) => f * c.w, Y: (f) => f * c.h, k: Math.min(c.h, c.w / 2) }
  cena.corDoPiso = ESCURO_DO_FERRO
  montarCarreta(c, cena, regua)
  montarCano(c, cena, regua)
  montarVergueiro(c, cena, regua)
  // O botão do cascavel por cima da corda, que dá a volta no pescoço atrás dele.
  const rBotao = regua.k * RAIO_DO_BOTAO
  cena.partes.push(c.peca(elipse(regua.X(BOTAO), 0, rBotao, rBotao), c.m.metal, { tabua: 0, bisel: rBotao, tom: 1.02, contorno: 0.3, metal: 0.5, semente: 3179, projeta: { dist: 0.8, forca: 0.3 } }))
  montarBalas(c, cena, regua)
}
