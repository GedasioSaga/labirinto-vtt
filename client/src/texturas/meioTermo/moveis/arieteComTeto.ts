/**
 * ARÍETE COM TETO de cima com volume (lote L03 dos objetos novos, 14/11/2026:
 * o cerco e a defesa). A "tartaruga" que leva o aríete até o portão, a cabeça
 * para a direita: o TELHADO de duas águas com a cumeeira de madeira ao
 * comprido, coberto de COUROS crus (contra o fogo de cima da muralha) postos
 * em mantas tortas que se sobrepõem e caem um pouco além do beiral,
 * amarrados por CORDAS que passam por cima da cumeeira e terminam nas
 * estacas do beiral, e as tesouras de madeira na frente e atrás. Por baixo do
 * beiral espiam as quatro RODAS (o aro e o cubo); pela frente sai a tora do
 * ARÍETE, cintada de ferro, com a CABEÇA de carneiro de ferro e os dois
 * chifres enrolados; por trás, o toco da tora com a argola e a corda de puxar.
 *
 * A 25% de zoom sobra o telhado de couro com a cumeeira clara, as cordas
 * atravessadas e a cabeça de ferro saindo pela frente: é o que diz "aríete"
 * e não "casa" (que não tem rodas nem tora). Material: `madeira` (a cumeeira,
 * as tesouras, as rodas e a tora); os couros, as cordas e o ferro são fixos.
 * O comprimento sai da largura da pegada e o través, da altura (3 x 2 casas de
 * partida); o que é redondo sai de `k`, o menor entre a altura e dois terços
 * da largura.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, cadeia, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type ClasseDaPeca, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As ferragens (as cintas da tora, a argola, o aro das rodas): ferro batido, um pouco mais escuro que o da tabela. */
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** A cabeça do aríete: o ferro fundido mais claro, gasto de bater. */
const CABECA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.04)) }
/**
 * O couro cru molhado: castanho mais escuro que a terra e que a madeira, para o telhado não sumir no chão de
 * terra e a cumeeira clara se destacar em cima dele. A classe é a da lã: no telhado vale a textura própria do
 * couro; na 3/4, a parede varrida (o couro caído até o chão) pega o mosqueado da lã, e não uma cor chapada.
 */
const COURO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x7c, 0x5c, 0x42] }
/** As cordas das amarras: cânhamo cru (o do canhão), claro em cima do couro escuro. */
const TOM_DO_CANHAMO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CANHAMO: Rgb = [0x8e, 0x76, 0x50]
const CANHAMO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CANHAMO }

// ---------- a luz e as texturas ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const FORCA_NA_MADEIRA = 0.9
const FORCA_NO_FERRO = 0.6
const FORCA_NA_CORDA = 0.8
/** As duas águas do telhado: a do norte olha para a luz, a do sul fica na sombra. */
const TOM_DA_AGUA_CLARA = 1.2
const TOM_DA_AGUA_ESCURA = 0.74
/** Comprimento de uma volta de fio na corda (px do protótipo): ~3 pixels no tamanho de mesa. */
const PASSO_DO_FIO = 3.2

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A luz de través de um CILINDRO deitado (a tora, a roda vista do alto): `onde` vai de -1 a 1 entre as beiras. */
function texDeCilindro(onde: (x: number, y: number) => number, paraALuz: number, forca: number, classe: ClasseDaPeca): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(onde(x, y), -1, 1)
    s[3] += forca * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/**
 * O COURO CRU: manchado em duas escalas (a pele não é lisa), com as manchas escuras da água por cima e os fios
 * do pelo raspado descendo a água do telhado, de través (`y`).
 */
function texDoCouro(semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    let luz = ruido(x * 0.16 + semente * 7.1, y * 0.16 + semente) * 0.1 + ruido(x * 0.6 + semente, y * 0.6) * 0.045
    luz += ruido(x * 1.4, y * 0.22 + semente * 3) * 0.035
    const molhado = ruido(x * 0.07 + semente * 3.3, y * 0.07 + 11)
    if (molhado > 0.22) luz -= 0.09 * Math.min(1, (molhado - 0.22) / 0.12)
    s[3] += luz
  }
}

/** A corda torcida, com a luz de cilindro: `aoLongo` diz onde o pixel está ao longo dela (px) e `onde`, de través. */
function texDaCorda(aoLongo: (x: number, y: number) => number, onde: (x: number, y: number) => number, paraALuz: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = limitar(onde(x, y), -1, 1)
    const volta = Math.sin(((aoLongo(x, y) + q * 1.6) / PASSO_DO_FIO) * Math.PI * 2)
    const t = limitar((volta - 0.1) / 0.9, 0, 1)
    s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
    s[3] += FORCA_NA_CORDA * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + 0.06
  }
}

// ---------- a régua ----------

interface Regua {
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
  readonly k: number
}

/** Dois terços: na pegada de partida (3 x 2) `k` é a altura inteira. */
const PROPORCAO_DE_PARTIDA = 2 / 3

// ---------- as rodas ----------

/** As rodas: onde fica cada eixo, o raio (fração de `k`) e de que través a que través a roda vai. */
const EIXOS: readonly number[] = [-0.27, 0.2]
const RAIO_DA_RODA = 0.15
const RODA_POR_DENTRO = 0.395
const RODA_POR_FORA = 0.48
const PONTA_DO_CUBO = 0.5
const RAIO_DO_CUBO = 0.036

function montarRodas(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  EIXOS.forEach((onde, i) => {
    const x = X(onde)
    const R = k * RAIO_DA_RODA
    for (const lado of [-1, 1]) {
      const y0 = Math.min(lado * Y(RODA_POR_DENTRO), lado * Y(RODA_POR_FORA))
      const y1 = Math.max(lado * Y(RODA_POR_DENTRO), lado * Y(RODA_POR_FORA))
      const roda = caixa(x - R, y0, x + R, y1, 1.4)
      const sem = 6100 + i * 4 + (lado + 1)
      // Só o contato: a roda fica debaixo do beiral, na sombra do telhado. Sem estrutura própria, na 3/4 ela fica
      // no chão e espia por baixo da parede de couro (com a coluna dela, virava um caixote na frente da parede).
      cena.sombras.push(contato(roda, 0.32))
      L.push(P(roda, mad, { eixo: 0, tabua: 0, bisel: 0.9, tom: 0.98, contorno: 0.3, textura: texDeCilindro((px) => (px - x) / R, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: sem }))
      const meio = (y0 + y1) / 2
      const meioAro = (y1 - y0) * 0.17
      L.push(P(caixa(x - R * 0.97, meio - meioAro, x + R * 0.97, meio + meioAro, 0.6), FERRAGEM, { tabua: 0, bisel: 0.5, contorno: 0.2, metal: 0.3, textura: texDeCilindro((px) => (px - x) / R, LUZ_X, FORCA_NO_FERRO, 'metal'), semente: sem + 1 }))
      const rc = k * RAIO_DO_CUBO
      const yc0 = Math.min(lado * Y(RODA_POR_FORA) - lado, lado * Y(PONTA_DO_CUBO))
      const yc1 = Math.max(lado * Y(RODA_POR_FORA) - lado, lado * Y(PONTA_DO_CUBO))
      L.push(P(caixa(x - rc, yc0, x + rc, yc1, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 0.7, tom: 0.92, contorno: 0.26, textura: texDeCilindro((px) => (px - x) / rc, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: sem + 2 }))
      L.push(P(elipse(x, (yc0 + yc1) / 2 + lado * 0.4, rc * 0.42, rc * 0.42), FERRAGEM, { bisel: 0.6, tom: 1.15, contorno: 0.1, metal: 0.4 }))
    }
  })
}

// ---------- a tora e a cabeça ----------

/** A tora: o raio (fração da altura), o toco de trás e o pedaço da frente que sai do telhado até a cabeça. */
const RAIO_DA_TORA = 0.08
const TOCO_DE = -0.485
const FRENTE_ATE = 0.41
const CINTAS_DA_FRENTE: readonly number[] = [0.33, 0.37]
/** A corda de puxar: em quantos pedaços, quanto ela barriga para trás (fração de `k`) e até onde cai de través. */
const PEDACOS_DA_CORDA = 10
const BARRIGA_DA_CORDA = 0.045
const QUEDA_DA_CORDA = 0.3
const ALTURA_DA_TORA = 0.62
/** A cabeça: do pescoço ao focinho; a meia largura na nuca e no focinho, em raios da tora. */
const NUCA = 0.4
const FOCINHO = 0.497
const NUCA_EM_RAIOS = 1.25
const FOCINHO_EM_RAIOS = 0.72
/** Os chifres: o meio da volta (atrás, para fora da nuca), o raio da volta e a grossura, em raios da tora. */
const MEIO_DO_CHIFRE: Ponto = [0.4, 1.45]
const VOLTA_DO_CHIFRE = 0.62
const GROSSURA_DO_CHIFRE = 0.2
const PEDACOS_DO_CHIFRE = 14
/** Quanto o chifre gira: uma volta menos um oitavo, para a ponta parar dentro da volta. */
const VOLTA_INTEIRA_DO_CHIFRE = Math.PI * 1.75

function montarTora(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua, xTelhadoDe: number, xTelhadoAte: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const r = Y(RAIO_DA_TORA)
  const madeiraDaTora = (forma: Forma, semente: number) =>
    P(forma, mad, { eixo: 0, tabua: 0, bisel: 0.8, tom: 1.04, contorno: 0.3, textura: texDeCilindro((_px, py) => py / r, LUZ_Y, FORCA_NA_MADEIRA, 'madeira'), semente, projeta: { dist: 0.8, forca: 0.26 } })

  // O toco de trás, com a argola e a corda de puxar caída no chão.
  const toco = caixa(X(TOCO_DE), -r, xTelhadoDe + 2, r, r * 0.5)
  cena.sombras.push({ forma: toco, z: c.g * ALTURA_DA_TORA, solta: true, forca: 0.3 })
  // A corda sai da argola, faz uma barriga para trás e cai junto do beiral: uma curva lisa, sem quina.
  const xArgola = X(TOCO_DE) + r * 0.6
  const corda: Ponto[] = Array.from({ length: PEDACOS_DA_CORDA + 1 }, (_, i): Ponto => {
    const t = i / PEDACOS_DA_CORDA
    return [xArgola - k * BARRIGA_DA_CORDA * Math.sin(Math.PI * t), Y(QUEDA_DA_CORDA) * t]
  })
  const formaDaCorda = cadeia(corda, k * 0.012)
  cena.sombras.push(contato(formaDaCorda, 0.22))
  L.push(P(formaDaCorda, CANHAMO, { bisel: k * 0.01, contorno: 0.28, textura: texDaCorda((px, py) => px + py, () => 0, LUZ_Y), semente: 6120 }))
  L.push(madeiraDaTora(toco, 6121))
  L.push(P(elipse(X(TOCO_DE) + r * 0.6, 0, r * 0.5, r * 0.5), FERRAGEM, { tabua: 0, bisel: 0.6, tom: 1.05, contorno: 0.26, metal: 0.4, semente: 6122 }))
  L.push(P(elipse(X(TOCO_DE) + r * 0.6, 0, r * 0.24, r * 0.24), FERRAGEM, { tabua: 0, bisel: 0.3, tom: 0.6, contorno: 0.1, metal: 0.1, semente: 6123 }))

  // O pedaço da frente, que sai do telhado, com as cintas de ferro.
  const frente = caixa(xTelhadoAte - 3, -r, X(FRENTE_ATE), r, r * 0.3)
  cena.sombras.push({ forma: frente, z: c.g * ALTURA_DA_TORA, solta: true, forca: 0.3 })
  L.push(madeiraDaTora(frente, 6124))
  CINTAS_DA_FRENTE.forEach((onde, i) => {
    L.push(P(caixa(X(onde) - k * 0.012, -r - 0.5, X(onde) + k * 0.012, r + 0.5, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.0, contorno: 0.24, metal: 0.35, textura: texDeCilindro((_px, py) => py / (r + 0.5), LUZ_Y, FORCA_NO_FERRO, 'metal'), semente: 6126 + i }))
  })

  // Os chifres por baixo da cabeça: cada um sai da nuca, vai para trás e enrola para a frente.
  for (const lado of [-1, 1]) {
    const cx = X(MEIO_DO_CHIFRE[0])
    const cy = lado * r * MEIO_DO_CHIFRE[1]
    const raio = r * VOLTA_DO_CHIFRE
    const pontos: Ponto[] = [[X(NUCA) + r * 0.3, lado * r * 0.75]]
    for (let i = 0; i <= PEDACOS_DO_CHIFRE; i += 1) {
      const t = i / PEDACOS_DO_CHIFRE
      // Do lado da nuca, para trás, para fora, para a frente e fechando para dentro: a espiral do chifre de carneiro.
      const a = t * VOLTA_INTEIRA_DO_CHIFRE
      const rr = raio * (1 - t * 0.55)
      pontos.push([cx - Math.sin(a) * rr, cy - lado * Math.cos(a) * rr])
    }
    const chifre = cadeia(pontos, r * GROSSURA_DO_CHIFRE)
    // A estrutura do chifre é a volta inteira: o meio da espiral fica no vão dela, e a 3/4 o deixaria no chão.
    cena.sombras.push({ forma: uniao(chifre, elipse(cx, cy, raio, raio)), z: c.g * (ALTURA_DA_TORA + 0.04), solta: true, forca: 0.3 })
    L.push(P(chifre, CABECA, { bisel: r * 0.16, tom: 0.88, contorno: 0.32, metal: 0.35, semente: 6130 + lado, projeta: { dist: 0.6, forca: 0.26 } }))
  }

  // A cabeça de ferro: larga na nuca, afinando até o focinho arredondado, com a testa mais clara no meio.
  const xN = X(NUCA)
  const xF = X(FOCINHO)
  const cabeca = uniao(
    poligono([[xN, -r * NUCA_EM_RAIOS], [xF - r * FOCINHO_EM_RAIOS, -r * FOCINHO_EM_RAIOS], [xF - r * FOCINHO_EM_RAIOS, r * FOCINHO_EM_RAIOS], [xN, r * NUCA_EM_RAIOS]]),
    elipse(xF - r * FOCINHO_EM_RAIOS, 0, r * FOCINHO_EM_RAIOS, r * FOCINHO_EM_RAIOS),
  )
  cena.sombras.push({ forma: cabeca, z: c.g * (ALTURA_DA_TORA + 0.04), solta: true, forca: 0.32 })
  L.push(P(cabeca, CABECA, { tabua: 0, bisel: r * 0.45, tom: 0.96, contorno: 0.32, metal: 0.45, semente: 6133, projeta: { dist: 0.9, forca: 0.3 } }))
  L.push(P(capsula(xN + r * 0.4, 0, xF - r * 0.5, 0, r * 0.28), CABECA, { bisel: r * 0.25, tom: 1.18, contorno: 0.12, metal: 0.55, semente: 6134 }))
  for (const lado of [-1, 1]) {
    // Os olhos: dois furos de rebite na testa.
    L.push(P(elipse(xN + r * 0.75, lado * r * 0.62, r * 0.13, r * 0.13), FERRAGEM, { bisel: 0.4, tom: 0.62, contorno: 0.1, metal: 0.1 }))
  }
}

// ---------- o telhado ----------

/** O telhado: de onde a onde vai ao comprido, o beiral (de través) e quanto o couro cai além dele. */
const TELHADO_DE = -0.425
const TELHADO_ATE = 0.3
const BEIRAL = 0.43
const CAIDA_DO_COURO = 0.025
const ALTURA_DO_TELHADO = 1.45
/** A cumeeira: a meia largura (fração da altura) e quanto sai do telhado na frente e atrás. */
const MEIA_CUMEEIRA = 0.03
const PONTA_DA_CUMEEIRA = 0.018
/** As emendas das mantas de couro ao comprido (as pontas do telhado entram junto) e a sobra de uma sobre a outra. */
const EMENDAS: readonly number[] = [-0.17, 0.085]
const SOBRA_DA_MANTA = 0.025
/** As amarras: no meio de cada manta, de um beiral ao outro, por cima da cumeeira. */
const PEDACOS_DA_BORDA = 5
const TORTO_DA_BORDA = 0.012
/** As tesouras: a madeira de través na frente e atrás, a meia largura delas. */
const MEIA_TESOURA = 0.016

/** A borda torta de uma manta, de `a` até antes de `b`: os pontos do meio balançam de través. */
function bordaTorta(a: Ponto, b: Ponto, amplitude: number, semente: number): Ponto[] {
  const pontos: Ponto[] = []
  const comp = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const nx = -(b[1] - a[1]) / comp
  const ny = (b[0] - a[0]) / comp
  for (let i = 0; i < PEDACOS_DA_BORDA; i += 1) {
    const t = i / PEDACOS_DA_BORDA
    const desvio = i === 0 ? 0 : (hash(i, semente, 6201) - 0.5) * 2 * amplitude
    pontos.push([a[0] + (b[0] - a[0]) * t + nx * desvio, a[1] + (b[1] - a[1]) * t + ny * desvio])
  }
  return pontos
}

function montarTelhado(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const x0 = X(TELHADO_DE)
  const x1 = X(TELHADO_ATE)
  const yB = Y(BEIRAL)
  const torto = k * TORTO_DA_BORDA
  // O telhado é uma coluna: na 3/4 a frente dele (o couro caído) desce até o chão, como na tartaruga de verdade.
  const corpo = caixa(x0, -yB, x1, yB, 1)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DO_TELHADO, forca: 0.34 }, contato(corpo, 0.34))

  // As mantas de couro, de trás para a frente: cada uma entra um pouco por baixo da seguinte.
  const cortes = [x0, ...EMENDAS.map(X), x1]
  const meiosDasMantas: number[] = []
  for (const lado of [-1, 1]) {
    const tom = lado < 0 ? TOM_DA_AGUA_CLARA : TOM_DA_AGUA_ESCURA
    for (let i = 0; i < cortes.length - 1; i += 1) {
      const de = cortes[i] - (i > 0 ? X(SOBRA_DA_MANTA) : 0)
      const ate = cortes[i + 1]
      const sem = 6210 + i * 7 + (lado + 1) * 20
      const yC = lado * Y(MEIA_CUMEEIRA) * 0.5
      const yF = lado * (yB + Y(CAIDA_DO_COURO) * (0.6 + hash(i, lado + 3, 6202) * 0.6))
      const manta = poligono([
        ...bordaTorta([de, yC], [ate, yC], 0, sem),
        ...bordaTorta([ate, yC], [ate, yF], i < cortes.length - 2 ? torto : 0, sem + 1),
        ...bordaTorta([ate, yF], [de, yF], torto * 1.4, sem + 2),
        ...bordaTorta([de, yF], [de, yC], i > 0 ? torto : 0, sem + 3),
      ])
      L.push(P(manta, COURO, { tabua: 0, bisel: 1.1, tom: tom * (0.88 + hash(i, lado + 5, 6203) * 0.24), contorno: 0.32, textura: texDoCouro(sem), semente: sem, projeta: { dist: 1.1, forca: 0.32 } }))
      if (lado < 0) meiosDasMantas.push((de + ate) / 2)
    }
  }

  // As tesouras na frente e atrás: a madeira de través que segura as duas águas, por cima da beira do couro.
  for (const [i, x] of [x0 + k * MEIA_TESOURA, x1 - k * MEIA_TESOURA].entries()) {
    const tesoura = caixa(x - k * MEIA_TESOURA, -yB + 0.5, x + k * MEIA_TESOURA, yB - 0.5, 0.6)
    L.push(P(tesoura, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.92, contorno: 0.3, semente: 6240 + i, projeta: { dist: 0.8, forca: 0.3 } }))
  }

  // As amarras: a corda de beiral a beiral no meio de cada manta, com a estaca de madeira em cada ponta.
  meiosDasMantas.forEach((x, i) => {
    const rC = k * 0.012
    const amarra = capsula(x, -yB - Y(CAIDA_DO_COURO) * 0.4, x, yB + Y(CAIDA_DO_COURO) * 0.4, rC)
    L.push(P(amarra, CANHAMO, { eixo: QUARTO, bisel: rC * 0.8, contorno: 0.28, textura: texDaCorda((_px, py) => py, (px) => (px - x) / rC, LUZ_X), semente: 6250 + i, projeta: { dist: 0.6, forca: 0.3 } }))
    for (const lado of [-1, 1]) {
      L.push(P(elipse(x, lado * (yB + Y(CAIDA_DO_COURO) * 0.4), k * 0.016, k * 0.016), mad, { tabua: 0, bisel: 0.7, tom: 1.08, contorno: 0.28, semente: 6254 + i * 2 + lado }))
    }
  })

  // A cumeeira por cima de tudo, saindo um pouco do telhado na frente e atrás, com as cavilhas.
  const cumeeira = caixa(x0 - X(PONTA_DA_CUMEEIRA), -Y(MEIA_CUMEEIRA), x1 + X(PONTA_DA_CUMEEIRA), Y(MEIA_CUMEEIRA), 0.8)
  L.push(P(cumeeira, mad, { eixo: 0, tabua: 0, bisel: 1, tom: 1.12, contorno: 0.32, semente: 6260, projeta: { dist: 1, forca: 0.32 } }))
  for (const x of [x0 + k * MEIA_TESOURA, ...meiosDasMantas, x1 - k * MEIA_TESOURA]) {
    L.push(P(elipse(x, 0, k * 0.012, k * 0.012), FERRAGEM, { bisel: 0.6, tom: 1.2, contorno: 0.1, metal: 0.4 }))
  }
}

export const montarArieteComTeto: MontarMovel = (c, cena) => {
  const regua: Regua = { X: (f) => f * c.w, Y: (f) => f * c.h, k: Math.min(c.h, c.w * PROPORCAO_DE_PARTIDA) }
  montarRodas(c, cena, regua)
  montarTora(c, cena, regua, regua.X(TELHADO_DE), regua.X(TELHADO_ATE))
  montarTelhado(c, cena, regua)
}
