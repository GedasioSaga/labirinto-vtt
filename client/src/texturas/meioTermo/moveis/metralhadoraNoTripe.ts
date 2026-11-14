/**
 * METRALHADORA NO TRIPÉ de cima com volume (L06 dos objetos novos, 14/11/2026,
 * grupo Base militar). A metralhadora pesada de aço escuro, apontada para a
 * direita (a frente do objeto, como a boca do canhão): a CAIXA da culatra com a
 * tampa de alimentação, a alça de mira e os rebites; atrás, as duas MANOPLAS
 * com o gatilho de borboleta no meio; na frente, a CAMISA furada do cano, o
 * CANO fino com a massa de mira e o quebra-chamas na boca; do lado direito, a
 * alavanca de armar. Embaixo, o TRIPÉ: a perna da frente e as duas de trás
 * abertas, com a barra de direção entre elas e o fuso que sobe até a culatra.
 * Do lado esquerdo, a CAIXA DE MUNIÇÃO verde aberta (a tampa deitada para
 * trás, a fita dobrada lá dentro) com a FITA de cartuchos de latão subindo até
 * a culatra; do lado direito, no chão, os ESTOJOS vazios e os elos soltos.
 *
 * A 25% de zoom sobra a barra escura comprida com o cano fino, o Y das pernas
 * e a caixinha verde ao lado com o risco dourado da fita: é o que diz
 * "metralhadora" e não "canhão" (o cano grosso na carreta de madeira).
 *
 * NA 3/4 fica como de cima (perfil em pé, como o canhão): a arma é fina e
 * baixa, e a 3/4 derivada varria a caixa até o chão.
 *
 * Sem material no painel: o aço, o latão, a borracha e a tinta da caixa são
 * fixos. O desenho é feito em 84 x 56 px (1,5 x 1 casa) e escala inteiro com
 * a pegada (o menor dos dois lados manda): esticado, não deforma.
 */
import { hash, type Rgb } from '../../ruido'
import { barra, caixa, capsula, elipse, elipseGirada, uniao, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** O desenho em px de uma pegada de 1,5 x 1 casa. */
const LARGURA_DO_DESENHO = 84
const ALTURA_DO_DESENHO = 56

// ---------- os materiais (fixos) ----------

/** O aço fosfatizado da arma e do tripé; o mais escuro dos furos e da boca. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x52, 0x55, 0x59] }
const ACO_CLARO: MaterialDaPeca = { classe: 'metal', rgb: [0x66, 0x69, 0x6c] }
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x24, 0x26] }
/** As manoplas de baquelite. */
const BAQUELITE: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x37, 0x31] }
/** O latão dos estojos e o cobre das pontas das balas. */
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xb4, 0x93, 0x5a] }
const COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0x96, 0x68, 0x4c] }
/** A caixa de munição pintada de verde-oliva, o fundo escuro dela e a letra amarela pintada na tampa. */
const VERDE_DA_CAIXA: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x63, 0x45] }
const FUNDO_DA_CAIXA: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x37, 0x2d] }
const LETREIRO: MaterialDaPeca = { classe: 'liso', rgb: [0xbf, 0xb0, 0x6c] }
/** O escuro em que o pixel escuro demais é levantado: o do canhão (o padrão, a nogueira, amarronzava o aço). */
const ESCURO_DO_ACO: Rgb = [0x4a, 0x45, 0x41]

// ---------- as medidas (px do desenho de 84 x 56) ----------

/** O eixo da arma (y) e a cabeça do tripé, onde a arma gira. */
const EIXO = -2
const CABECA: Ponto = [-6, EIXO]
/** As pontas das três pernas e o quanto da perna de trás a barra de direção fica. */
const PE_DA_FRENTE: Ponto = [29, 9]
const PES_DE_TRAS: readonly Ponto[] = [[-34, -22], [-34, 20]]
const ONDE_FICA_A_BARRA = 0.62
/** A caixa da culatra e o bloco do munhão na frente dela. */
const CULATRA = { de: -27, ate: -1, meia: 5.6 }
const BLOCO = { de: -1, ate: 5, meia: 4 }
/** A camisa furada e o cano, com o raio de cada um, e o quebra-chamas da boca. */
const CAMISA = { de: 5, ate: 17, raio: 3.4 }
const CANO = { de: 17, ate: 36, raio: 2 }
const BOCA = { de: 35, ate: 39.5, raio: 2.6 }
const MASSA_DE_MIRA = 32.5
/** Os furos da camisa: duas fileiras desencontradas no lombo. */
const FUROS_DA_CAMISA: readonly Ponto[] = [[7, -1.1], [9.6, -1.1], [12.2, -1.1], [14.8, -1.1], [8.3, 1.1], [10.9, 1.1], [13.5, 1.1]]
/** A caixa de munição (o meio, as meias medidas) e a tampa deitada para trás. */
const CAIXA_DE_MUNICAO = { x: -12, y: -17, mx: 7.5, my: 3.6 }
/** Os cartuchos da fita que sobe da caixa até a culatra (o y de cada um) e o comprimento de um cartucho. */
const FITA: readonly number[] = [-12.6, -10.6, -8.6]
const CARTUCHO = { de: -15.6, ate: -8.4, raio: 0.85, ponta: 1.9 }
/** Os estojos vazios no chão (x, y, ângulo) e os elos soltos (x, y, ângulo). */
const ESTOJOS: readonly (readonly [number, number, number])[] = [
  [-4, 9, 0.4],
  [1, 12.5, -0.9],
  [-8.5, 13, 1.8],
  [5, 8.5, 2.6],
  [-2, 16.5, 0.1],
  [8.5, 14, -0.3],
  [3.5, 19.5, 1.2],
  [-6.5, 18.5, -1.4],
]
const ELOS: readonly (readonly [number, number, number])[] = [
  [-1, 14.5, 0.7],
  [6, 17, -1.1],
  [-9.5, 9.5, 0.2],
]

/** Alturas em casas: a cabeça do tripé, o lombo da arma e a tampa da caixa de munição. */
const ALTURA_DA_CABECA = 0.42
const ALTURA_DA_ARMA = 0.52
const ALTURA_DA_CAIXA = 0.22

// ---------- a luz do cilindro (a do motor: de cima à esquerda) ----------

const LUZ_Y = -0.48
const LUZ_Z = 0.62
const REFLEXO = 46

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** Um cilindro deitado ao longo de x, de eixo `y0` e raio `r`: a luz de través e a faixa polida do lado da luz. */
function texDeCilindro(y0: number, r: number): Textura {
  const doMetal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    const q = limitar((y - y0) / r, -0.98, 0.98)
    s[3] += 0.7 * (LUZ_Y * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    const polido = (q + 0.4) / 0.16
    const brilho = REFLEXO * Math.exp(-polido * polido)
    s[0] += brilho
    s[1] += brilho
    s[2] += brilho
    if (doMetal !== null) doMetal(u, v, x, y, p, s, escala)
  }
}

/** Um cartucho ao longo do ângulo `a`, do culote ao fim do estojo, com a ponta de cobre (só nos da fita). */
function cartucho(P: CriarPeca, L: Peca[], ax: number, ay: number, comp: number, raio: number, a: number, comPonta: boolean, semente: number): void {
  const [co, si] = [Math.cos(a), Math.sin(a)]
  const fim = comPonta ? comp - CARTUCHO.ponta * (raio / CARTUCHO.raio) : comp
  L.push(P(capsula(ax, ay, ax + co * fim, ay + si * fim, raio), LATAO, { tabua: 0, bisel: raio, tom: 1.02, contorno: 0.26, metal: 0.55, semente }))
  if (comPonta) L.push(P(capsula(ax + co * fim, ay + si * fim, ax + co * comp, ay + si * comp, raio * 0.78), COBRE, { tabua: 0, bisel: raio * 0.7, contorno: 0.24, metal: 0.45, semente: semente + 1 }))
  else L.push(P(elipse(ax + co * comp, ay + si * comp, raio * 0.55, raio * 0.55), FURO, { bisel: 0.2, contorno: 0, semente: semente + 1 }))
}

function montarTripe(P: CriarPeca, cena: Cena, k: number, z: (casas: number) => number): void {
  const L = cena.partes
  const [hx, hy] = [CABECA[0] * k, CABECA[1] * k]
  const zCabeca = z(ALTURA_DA_CABECA)
  const [ox, oy] = [SOMBRA_X * zCabeca, SOMBRA_Y * zCabeca]
  const pes = [PE_DA_FRENTE, ...PES_DE_TRAS].map(([x, y]): Ponto => [x * k, y * k])
  pes.forEach(([px, py], i) => {
    // A perna desce inclinada da cabeça ao pé: a sombra vai do pé até a sombra da cabeça.
    cena.sombras.push({ forma: capsula(px, py, hx + ox, hy + oy, 1.4 * k), z: 0, suave: 1.3, forca: 0.3 })
    cena.sombras.push(contato(elipse(px, py, 2.4 * k, 2.4 * k), 0.3))
    L.push(P(capsula(hx, hy, px, py, 1.5 * k), ACO, { tabua: 0, bisel: 1.5 * k, tom: 0.92, contorno: 0.28, metal: 0.35, semente: 30001 + i }))
    L.push(P(elipseGirada(px, py, 2.5 * k, 1.7 * k, Math.atan2(py - hy, px - hx)), ACO, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.3, metal: 0.3, semente: 30005 + i }))
  })
  // A barra de direção entre as pernas de trás e o fuso que sobe dela até a culatra.
  const [a, b] = pes.slice(1).map(([px, py]): Ponto => [hx + (px - hx) * ONDE_FICA_A_BARRA, hy + (py - hy) * ONDE_FICA_A_BARRA])
  // O fuso e a cabeça ficam debaixo da culatra: do alto só a barra aparece, dos dois lados dela.
  L.push(P(barra(a[0], a[1], b[0], b[1], 2.2 * k), ACO_CLARO, { tabua: 0, bisel: 0.8, contorno: 0.28, metal: 0.4, semente: 30010, projeta: { dist: 1, forca: 0.3 } }))
}

function montarCaixaDeMunicao(P: CriarPeca, cena: Cena, k: number, z: (casas: number) => number): void {
  const L = cena.partes
  const { x, y, mx, my } = CAIXA_DE_MUNICAO
  const [x0, y0, x1, y1] = [(x - mx) * k, (y - my) * k, (x + mx) * k, (y + my) * k]
  const corpo = caixa(x0, y0, x1, y1, 0.8)
  // A tampa aberta, deitada para trás: do mesmo tamanho da boca, encostada na beira de cima.
  const alturaDaTampa = (y1 - y0) * 0.9
  const tampa = caixa(x0 + 0.3, y0 - alturaDaTampa, x1 - 0.3, y0 + 0.4, 0.8)
  cena.sombras.push({ forma: corpo, z: z(ALTURA_DA_CAIXA), forca: 0.3 }, contato(uniao(corpo, tampa), 0.3))
  L.push(P(tampa, VERDE_DA_CAIXA, { tabua: 0, bisel: 0.8, tom: 0.9, contorno: 0.28, metal: 0.12, semente: 30020 }))
  // O letreiro amarelo pintado na tampa (as duas linhas da munição).
  L.push(P(caixa(x0 + 2.4 * k, y0 - alturaDaTampa * 0.72, x1 - 4 * k, y0 - alturaDaTampa * 0.56), LETREIRO, { bisel: 0, contorno: 0, alfa: 0.75, semente: 30021 }))
  L.push(P(caixa(x0 + 2.4 * k, y0 - alturaDaTampa * 0.42, x1 - 7 * k, y0 - alturaDaTampa * 0.28), LETREIRO, { bisel: 0, contorno: 0, alfa: 0.75, semente: 30022 }))
  L.push(P(corpo, VERDE_DA_CAIXA, { tabua: 0, bisel: 1, contorno: 0.3, metal: 0.15, semente: 30023 }))
  const boca: Forma = caixa(x0 + 1.1 * k, y0 + 1.1 * k, x1 - 1.1 * k, y1 - 1.1 * k, 0.4)
  L.push(P(boca, FUNDO_DA_CAIXA, { tabua: 0, bisel: 0.4, contorno: 0.2, recesso: { k: 1.4, forca: 0.4 }, semente: 30024 }))
  // A fita dobrada lá dentro: as fileiras de cartuchos lado a lado.
  const fileiras = 3
  for (let i = 0; i < fileiras; i += 1) {
    const yy = y0 + 1.1 * k + ((i + 0.5) * (y1 - y0 - 2.2 * k)) / fileiras
    cartucho(P, L, x0 + 1.5 * k, yy, x1 - x0 - 3.2 * k, CARTUCHO.raio * k * 0.9, 0, true, 30030 + i * 2)
  }
  // As alças das pontas da caixa.
  ;[x0, x1].forEach((px, i) => {
    L.push(P(caixa(px - 0.9 * k, (y - 1.6) * k, px + 0.9 * k, (y + 1.6) * k, 0.5), ACO, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.26, metal: 0.3, semente: 30038 + i }))
  })
}

function montarArma(P: CriarPeca, cena: Cena, k: number, z: (casas: number) => number): void {
  const L = cena.partes
  const e = EIXO * k
  const culatra = caixa(CULATRA.de * k, e - CULATRA.meia * k, CULATRA.ate * k, e + CULATRA.meia * k, 0.9)
  const bloco = caixa(BLOCO.de * k, e - BLOCO.meia * k, BLOCO.ate * k, e + BLOCO.meia * k, 0.8)
  const camisa = caixa(CAMISA.de * k, e - CAMISA.raio * k, CAMISA.ate * k, e + CAMISA.raio * k, CAMISA.raio * k * 0.5)
  const cano = caixa(CANO.de * k, e - CANO.raio * k, CANO.ate * k, e + CANO.raio * k, 0.4)
  const boca = caixa(BOCA.de * k, e - BOCA.raio * k, BOCA.ate * k, e + BOCA.raio * k, 0.6)
  const corpo = uniao(uniao(culatra, bloco), uniao(uniao(camisa, cano), boca))
  cena.sombras.push({ forma: corpo, z: z(ALTURA_DA_ARMA), solta: true, forca: 0.32 })

  // As manoplas e o gatilho de borboleta, atrás da placa do fundo.
  for (const [i, dy] of [-3.2, 3.2].entries()) {
    L.push(P(capsula((CULATRA.de - 1.5) * k, e + dy * k, (CULATRA.de - 6) * k, e + dy * 1.2 * k, 1.3 * k), BAQUELITE, { tabua: 0, bisel: 1.3 * k, contorno: 0.28, semente: 30040 + i, projeta: { dist: 1, forca: 0.3 } }))
  }
  L.push(P(elipse((CULATRA.de - 3) * k, e, 1.3 * k, 2 * k), ACO_CLARO, { tabua: 0, bisel: 0.8, contorno: 0.26, metal: 0.4, semente: 30042 }))
  L.push(P(caixa((CULATRA.de - 2.2) * k, e - 4.6 * k, (CULATRA.de + 0.6) * k, e + 4.6 * k, 0.6), ACO, { tabua: 0, bisel: 0.8, tom: 0.88, contorno: 0.28, metal: 0.3, semente: 30043 }))

  // A culatra: a caixa, a tampa de alimentação, a alça de mira, os rebites e a alavanca de armar.
  L.push(P(culatra, ACO, { tabua: 0, bisel: 1.2, contorno: 0.3, metal: 0.3, semente: 30044, projeta: { dist: 1.6, forca: 0.32 } }))
  L.push(P(caixa((CULATRA.de + 2.2) * k, e - 3.6 * k, (CULATRA.ate - 7) * k, e + 3 * k, 0.6), ACO, { tabua: 0, bisel: 0.9, tom: 1.08, contorno: 0.26, metal: 0.35, semente: 30045, projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(elipse((CULATRA.ate - 8.2) * k, e, 1.2 * k, 1.2 * k), ACO_CLARO, { tabua: 0, bisel: 0.8, contorno: 0.24, metal: 0.5, semente: 30046 }))
  L.push(P(caixa((CULATRA.de + 4) * k, e - 1.6 * k, (CULATRA.de + 5.6) * k, e + 1.6 * k, 0.3), ACO_CLARO, { tabua: 0, bisel: 0.5, contorno: 0.26, metal: 0.4, semente: 30047, projeta: { dist: 0.8, forca: 0.32 } }))
  for (let i = 0; i < 5; i += 1) {
    const rx = (CULATRA.de + 3 + i * 4.6) * k
    for (const lado of [-1, 1]) L.push(P(elipse(rx, e + lado * (CULATRA.meia - 0.9) * k, 0.45 * k, 0.45 * k), ACO_CLARO, { bisel: 0.3, contorno: 0.1, metal: 0.4, semente: 30050 + i * 2 + (lado + 1) / 2 }))
  }
  L.push(P(capsula(-13 * k, e + 5 * k, -11.4 * k, e + 8.2 * k, 0.8 * k), ACO, { tabua: 0, bisel: 0.8 * k, contorno: 0.28, metal: 0.4, semente: 30062, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(elipse(-11.3 * k, e + 8.5 * k, 1.4 * k, 1.4 * k), ACO_CLARO, { tabua: 0, bisel: 1.2 * k, contorno: 0.28, metal: 0.5, semente: 30063 }))

  // A frente: o bloco do munhão, a camisa furada, o cano, a massa de mira e o quebra-chamas.
  L.push(P(bloco, ACO, { tabua: 0, bisel: 1, tom: 0.94, contorno: 0.3, metal: 0.3, semente: 30064, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(camisa, ACO, { tabua: 0, bisel: 0.8, contorno: 0.3, textura: texDeCilindro(e, CAMISA.raio * k), semente: 30065, projeta: { dist: 1.2, forca: 0.3 } }))
  FUROS_DA_CAMISA.forEach(([fx, fy], i) => {
    L.push(P(elipse(fx * k, e + fy * k, 0.85 * k, 0.55 * k), FURO, { bisel: 0.3, contorno: 0, recesso: { k: 0.5, forca: 0.3 }, semente: 30066 + i }))
  })
  L.push(P(cano, ACO, { tabua: 0, bisel: 0.5, contorno: 0.3, textura: texDeCilindro(e, CANO.raio * k), semente: 30074 }))
  L.push(P(caixa((MASSA_DE_MIRA - 0.7) * k, e - 0.8 * k, (MASSA_DE_MIRA + 0.7) * k, e + 0.8 * k, 0.3), ACO_CLARO, { tabua: 0, bisel: 0.4, contorno: 0.26, metal: 0.4, semente: 30075, projeta: { dist: 0.6, forca: 0.3 } }))
  L.push(P(boca, ACO, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.3, textura: texDeCilindro(e, BOCA.raio * k), semente: 30076 }))
  for (let i = 0; i < 3; i += 1) L.push(P(caixa((BOCA.de + 1 + i * 1.2) * k, e - BOCA.raio * 0.9 * k, (BOCA.de + 1.5 + i * 1.2) * k, e + BOCA.raio * 0.9 * k), FURO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 30077 + i }))

  // A fita que sobe da caixa de munição até a janela de alimentação, do lado esquerdo da culatra.
  FITA.forEach((fy, i) => {
    L.push(P(caixa((CARTUCHO.de + 1.2) * k, (fy + 0.75) * k, (CARTUCHO.de + 3) * k, (fy + 1.25) * k), ACO, { bisel: 0.2, contorno: 0.2, tom: 0.8, metal: 0.3, semente: 30080 + i }))
    cartucho(P, L, CARTUCHO.de * k, fy * k, (CARTUCHO.ate - CARTUCHO.de) * k, CARTUCHO.raio * k, 0, true, 30084 + i * 2)
  })
}

export const montarMetralhadoraNoTripe: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w / LARGURA_DO_DESENHO, c.h / ALTURA_DO_DESENHO)
  const z = (casas: number): number => casas * G * k
  cena.corDoPiso = ESCURO_DO_ACO

  // No chão, por baixo de tudo: os estojos vazios e os elos soltos.
  ESTOJOS.forEach(([x, y, a], i) => {
    const comp = 3.4 * k
    const [ax, ay] = [x * k - (Math.cos(a) * comp) / 2, y * k - (Math.sin(a) * comp) / 2]
    cena.sombras.push(contato(capsula(ax, ay, ax + Math.cos(a) * comp, ay + Math.sin(a) * comp, 0.8 * k), 0.26))
    cartucho(P, cena.partes, ax, ay, comp, 0.78 * k * (0.92 + 0.16 * hash(i, 1, 3009)), a, false, 30100 + i * 2)
  })
  ELOS.forEach(([x, y, a], i) => {
    const elo = elipseGirada(x * k, y * k, 1.2 * k, 0.55 * k, a)
    cena.sombras.push(contato(elo, 0.22))
    cena.partes.push(P(elo, ACO_CLARO, { bisel: 0.4, contorno: 0.24, metal: 0.4, semente: 30120 + i }))
  })
  montarTripe(P, cena, k, z)
  montarCaixaDeMunicao(P, cena, k, z)
  montarArma(P, cena, k, z)
}
