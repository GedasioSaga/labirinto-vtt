/**
 * GERADOR de campanha, de cima com volume (L06 dos objetos novos, 14/11/2026,
 * grupo Base militar). O gerador a diesel na caixa de chapa pintada de
 * verde-oliva, em cima de dois TRILHOS de aço (as pontas aparecem nas duas
 * cabeceiras). No tampo: a GRADE do radiador numa ponta (as aletas em fila,
 * dentro do caixilho fundo), o ESCAPAMENTO deitado (o silencioso com as duas
 * cintas e o cano que sobe na ponta, de boca escura, com a FULIGEM em volta),
 * a tampa do tanque, a argola de içar, o PAINEL fundo com os três mostradores,
 * a chave e as duas tomadas, e o letreiro pintado. Da tomada sai o CABO de
 * força pelo chão (para o holofote); do lado, um GALÃO deitado com o X
 * estampado na face e as três alças na ponta.
 *
 * A 25% de zoom sobra a caixa verde com o riscado da grade numa ponta, o
 * cilindro escuro do escapamento e o galão com o X ao lado: é o que diz
 * "gerador" e não "baú" nem "caixa de munição".
 *
 * NA 3/4 a caixa é uma coluna (a frente varrida embaixo do tampo), o cano do
 * escapamento sobe mais que ela, e o galão e as pontas dos trilhos são colunas
 * baixas; o cabo fica no chão.
 *
 * Sem material no painel: a tinta, o aço, a borracha e os mostradores são
 * fixos. O desenho é feito em 84 x 56 px (1,5 x 1 casa) e escala inteiro com
 * a pegada (o menor dos dois lados manda): esticado, não deforma.
 */
import type { Rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** O desenho em px de uma pegada de 1,5 x 1 casa. */
const LARGURA_DO_DESENHO = 84
const ALTURA_DO_DESENHO = 56

// ---------- os materiais (fixos) ----------

const OLIVA: MaterialDaPeca = { classe: 'metal', rgb: [0x5e, 0x64, 0x47] }
const OLIVA_DO_GALAO: MaterialDaPeca = { classe: 'metal', rgb: [0x56, 0x5c, 0x3f] }
/** O fundo do painel e do caixilho do radiador: a chapa na sombra. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x3e, 0x33] }
/** O aço dos trilhos e das ferragens; o do escapamento, queimado pelo calor. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x5a, 0x5c, 0x5e] }
const ACO_QUEIMADO: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x59, 0x55] }
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x22, 0x21, 0x20] }
/** A fuligem em volta da boca do escapamento (a cor sai da textura) e a borracha do cabo. */
const FULIGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x25, 0x24] }
const BORRACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x32, 0x30] }
/** O mostrador (o vidro claro), o ponteiro e a tinta clara do letreiro. */
const MOSTRADOR: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd0, 0xbb] }
const PONTEIRO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x2a, 0x28] }
const LETREIRO: MaterialDaPeca = { classe: 'liso', rgb: [0xd4, 0xcc, 0xa8] }
/** O escuro em que o pixel escuro demais é levantado: verde-escuro da tinta (a nogueira amarronzava a chapa). */
const ESCURO_DA_TINTA: Rgb = [0x3c, 0x40, 0x31]

// ---------- as medidas (px do desenho de 84 x 56) ----------

const CAIXA = { x0: -33, y0: -18, x1: 13, y1: 16 }
/** Os trilhos: o y de cada um, a meia largura e até onde passam da caixa nas duas pontas. */
const TRILHOS: readonly number[] = [-14, 12]
const MEIO_TRILHO = 1.8
const SOBRA_DO_TRILHO = 4
/** A grade do radiador: o caixilho e quantas aletas. */
const GRADE = { x0: -31, y0: -15.5, x1: -18, y1: 13.5 }
const ALETAS = 7
/** O escapamento: o silencioso deitado (de, até, eixo, raio), as cintas e o cano que sobe. */
const SILENCIOSO = { de: -12, ate: 4, y: -10.5, raio: 3.6 }
const CINTAS_DO_SILENCIOSO: readonly number[] = [-8, 0]
const CANO_DO_ESCAPAMENTO: Ponto = [-14.4, -10.5]
const RAIO_DO_CANO = 2.3
/** A fuligem: o meio, os raios e o quanto escurece no meio. */
const FULIGEM_EM = { x: -13.5, y: -8.5, rx: 6.5, ry: 5.5, alfa: 0.5 }
/** A tampa do tanque, a argola de içar e o painel. */
const TAMPA_DO_TANQUE: Ponto = [8, -11]
const ARGOLA: Ponto = [-2, -2.5]
const PAINEL = { x0: -12, y0: 3, x1: 10, y1: 13.5 }
const MOSTRADORES: readonly Ponto[] = [[-8.6, 6.8], [-4, 6.8], [0.6, 6.8]]
const TOMADAS: readonly Ponto[] = [[6.5, 6.2], [6.5, 10.6]]
/** O cabo: da tomada de baixo, por cima da beira da caixa, e pelo chão até a beira da pegada. */
const CAMINHO_DO_CABO: readonly Ponto[] = [
  [6.5, 10.6],
  [10, 9.6],
  [13.5, 6.5],
  [16.5, 2.5],
  [20, -0.8],
  [24.5, -2.6],
  [29, -3.6],
  [33, -6.5],
  [37, -11],
  [42, -14.5],
]
/** O galão deitado: o meio, o giro, as meias medidas da face. */
const GALAO = { x: 27.5, y: 13, ang: 0.1, mx: 8.6, my: 6.3 }

/** Alturas em casas: o tampo da caixa, a boca do escapamento, o galão e os trilhos. */
const ALTURA_DA_CAIXA = 0.55
const ALTURA_DO_ESCAPAMENTO = 0.8
const ALTURA_DO_GALAO = 0.17
const ALTURA_DO_TRILHO = 0.07

// ---------- texturas ----------

const LUZ_Y = -0.48
const LUZ_Z = 0.62

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** O silencioso: cilindro deitado em x (luz de través) com a mancha do calor. */
function texDoSilencioso(y0: number, r: number): Textura {
  const doMetal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    const q = limitar((y - y0) / r, -0.98, 0.98)
    s[3] += 0.7 * (LUZ_Y * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + ruido(x * 0.4 + 9, y * 0.4) * 0.08
    if (doMetal !== null) doMetal(u, v, x, y, p, s, escala)
  }
}

/** A fuligem: escura no meio, rala e manchada para fora. */
function texDaFuligem(cx: number, cy: number, rx: number, ry: number, alfa: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = Math.min(1, Math.sqrt(dx * dx + dy * dy) + ruido(x * 0.5 + 3, y * 0.5) * 0.35)
    s[5] = alfa * (1 - q) * (1 - q)
  }
}

/** Um retângulo (x0..x1, y0..y1 no referencial do galão) posto no mapa. */
function noGalao(pontos: readonly Ponto[], k: number): Forma {
  const co = Math.cos(GALAO.ang)
  const si = Math.sin(GALAO.ang)
  return poligono(pontos.map(([x, y]): Ponto => [(GALAO.x + x * co - y * si) * k, (GALAO.y + x * si + y * co) * k]))
}

function montarGalao(P: CriarPeca, cena: Cena, k: number): void {
  const L = cena.partes
  const { mx, my } = GALAO
  const face = noGalao([[-mx, -my], [mx, -my], [mx, my], [-mx, my]], k)
  // As três alças na ponta de cima do galão, e o bico de lado.
  const alcas = [-0.55, 0, 0.55].map((f) => noGalao([[mx - 0.5, f * my - 1.2], [mx + 2.6, f * my - 1.2], [mx + 2.6, f * my + 1.2], [mx - 0.5, f * my + 1.2]], k))
  const bico = noGalao([[mx - 1, my - 3.6], [mx + 2.4, my - 3.6], [mx + 2.4, my - 0.2], [mx - 1, my - 0.2]], k)
  const tudo = [face, bico, ...alcas].reduce(uniao)
  cena.sombras.push({ forma: tudo, z: ALTURA_DO_GALAO * G * k, forca: 0.3 }, contato(tudo, 0.3))
  alcas.forEach((alca, i) => L.push(P(alca, OLIVA_DO_GALAO, { tabua: 0, bisel: 0.7, tom: 0.92, contorno: 0.28, metal: 0.2, semente: 32001 + i })))
  L.push(P(bico, ACO, { tabua: 0, bisel: 0.8, contorno: 0.28, metal: 0.35, semente: 32004 }))
  L.push(P(face, OLIVA_DO_GALAO, { tabua: 0, bisel: 1.4, contorno: 0.3, metal: 0.15, semente: 32005, projeta: { dist: 1, forca: 0.3 } }))
  // O painel da face, um tico fundo dentro do friso da costura.
  const painel = 0.84
  L.push(P(noGalao([[-mx * painel, -my * painel], [mx * painel, -my * painel], [mx * painel, my * painel], [-mx * painel, my * painel]], k), OLIVA_DO_GALAO, { tabua: 0, bisel: 0.6, tom: 0.93, contorno: 0.16, metal: 0.12, semente: 32008 }))
  // O X estampado: as duas nervuras de canto a canto do painel.
  const dentro = 0.72
  for (const [i, lado] of [-1, 1].entries()) {
    const nervura = noGalao([[-mx * dentro, -lado * my * dentro - 0.8], [mx * dentro, lado * my * dentro - 0.8], [mx * dentro, lado * my * dentro + 0.8], [-mx * dentro, -lado * my * dentro + 0.8]], k)
    L.push(P(nervura, OLIVA_DO_GALAO, { tabua: 0, bisel: 0.9, tom: 1.08, contorno: 0.12, metal: 0.2, semente: 32006 + i, projeta: { dist: 0.6, forca: 0.24 } }))
  }
}

function montarTampo(P: CriarPeca, cena: Cena, k: number): void {
  const L = cena.partes
  const K = (v: number): number => v * k
  // A grade do radiador: o caixilho fundo e as aletas em fila, cada uma com a sombra na de trás.
  L.push(P(caixa(K(GRADE.x0), K(GRADE.y0), K(GRADE.x1), K(GRADE.y1), 0.6), FUNDO, { tabua: 0, bisel: 0.6, contorno: 0.26, recesso: { k: 1.5, forca: 0.4 }, semente: 32010 }))
  const passo = (GRADE.x1 - GRADE.x0) / ALETAS
  for (let i = 0; i < ALETAS; i += 1) {
    const x = GRADE.x0 + passo * (i + 0.5)
    L.push(P(caixa(K(x - passo * 0.32), K(GRADE.y0 + 1), K(x + passo * 0.32), K(GRADE.y1 - 1), 0.4), OLIVA, { tabua: 0, bisel: 0.7, tom: 1.06, contorno: 0.2, metal: 0.15, semente: 32011 + i, projeta: { dist: 0.9, forca: 0.36 } }))
  }
  // A fuligem no tampo, em volta do cano do escapamento.
  L.push(P(elipse(K(FULIGEM_EM.x), K(FULIGEM_EM.y), K(FULIGEM_EM.rx), K(FULIGEM_EM.ry)), FULIGEM, { bisel: 0, contorno: 0, textura: texDaFuligem(K(FULIGEM_EM.x), K(FULIGEM_EM.y), K(FULIGEM_EM.rx), K(FULIGEM_EM.ry), FULIGEM_EM.alfa), semente: 32020 }))
  // O silencioso deitado, as cintas que o prendem e o cano que sobe na ponta, de boca escura.
  const s = SILENCIOSO
  L.push(P(caixa(K(s.de), K(s.y - s.raio), K(s.ate), K(s.y + s.raio), K(s.raio) * 0.9), ACO_QUEIMADO, { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.2, textura: texDoSilencioso(K(s.y), K(s.raio)), semente: 32021, projeta: { dist: 1.6, forca: 0.34 } }))
  CINTAS_DO_SILENCIOSO.forEach((x, i) => {
    L.push(P(caixa(K(x - 0.8), K(s.y - s.raio - 0.6), K(x + 0.8), K(s.y + s.raio + 0.6), 0.4), ACO, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.26, metal: 0.3, textura: texDoSilencioso(K(s.y), K(s.raio + 0.6)), semente: 32022 + i }))
  })
  const [cx, cy] = [K(CANO_DO_ESCAPAMENTO[0]), K(CANO_DO_ESCAPAMENTO[1])]
  L.push(P(elipse(cx, cy, K(RAIO_DO_CANO), K(RAIO_DO_CANO)), ACO_QUEIMADO, { tabua: 0, bisel: K(RAIO_DO_CANO) * 0.6, tom: 0.95, contorno: 0.3, metal: 0.3, semente: 32025, projeta: { dist: 1.4, forca: 0.34 } }))
  L.push(P(elipse(cx, cy, K(RAIO_DO_CANO) * 0.6, K(RAIO_DO_CANO) * 0.6), FURO, { bisel: 0.4, contorno: 0, recesso: { k: 0.8, forca: 0.3 }, semente: 32026 }))
  // A tampa do tanque com a correntinha, e a argola de içar no meio.
  const [tx, ty] = [K(TAMPA_DO_TANQUE[0]), K(TAMPA_DO_TANQUE[1])]
  L.push(P(cadeia([[tx + K(2), ty], [tx + K(3.4), ty + K(1.6)], [tx + K(3), ty + K(3.6)]], K(0.35)), ACO, { bisel: 0.3, contorno: 0.2, metal: 0.3, semente: 32027 }))
  L.push(P(elipse(tx, ty, K(2.6), K(2.6)), ACO, { tabua: 0, bisel: K(1.6), tom: 1.02, contorno: 0.3, metal: 0.4, semente: 32028, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(barra(tx - K(1.8), ty, tx + K(1.8), ty, K(0.9)), ACO, { tabua: 0, bisel: 0.4, tom: 1.15, contorno: 0.2, metal: 0.4, semente: 32029 }))
  const [ax, ay] = [K(ARGOLA[0]), K(ARGOLA[1])]
  L.push(P(anel(ax, ay, K(2.4), K(2.4), K(1.3), K(1.3)), ACO, { tabua: 0, bisel: 0.6, contorno: 0.28, metal: 0.45, semente: 32030, projeta: { dist: 1, forca: 0.32 } }))
  // O letreiro pintado na chapa: três riscos claros.
  ;[[2, -4.5, 11], [2, -2.4, 8], [2, -0.3, 10]].forEach(([x0, y0, x1], i) => {
    L.push(P(caixa(K(x0), K(y0), K(x1), K(y0 + 1)), LETREIRO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 32031 + i }))
  })
  // O painel fundo: os três mostradores com o ponteiro, a chave e as duas tomadas.
  L.push(P(caixa(K(PAINEL.x0), K(PAINEL.y0), K(PAINEL.x1), K(PAINEL.y1), 0.6), FUNDO, { tabua: 0, bisel: 0.6, contorno: 0.26, recesso: { k: 1.4, forca: 0.4 }, semente: 32035 }))
  MOSTRADORES.forEach(([x, y], i) => {
    L.push(P(elipse(K(x), K(y), K(1.9), K(1.9)), ACO, { bisel: 0.6, contorno: 0.26, metal: 0.4, semente: 32036 + i * 3 }))
    L.push(P(elipse(K(x), K(y), K(1.4), K(1.4)), MOSTRADOR, { bisel: 0.4, contorno: 0.1, semente: 32037 + i * 3 }))
    const a = -2.2 + i * 0.9
    L.push(P(barra(K(x), K(y), K(x) + Math.cos(a) * K(1.2), K(y) + Math.sin(a) * K(1.2), K(0.35)), PONTEIRO, { bisel: 0, contorno: 0, semente: 32038 + i * 3 }))
  })
  L.push(P(caixa(K(-8.8), K(10), K(-1.8), K(12), 0.5), ACO, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.24, metal: 0.3, semente: 32046 }))
  L.push(P(capsula(K(-5.3), K(11), K(-3.2), K(10.2), K(0.7)), ACO, { tabua: 0, bisel: K(0.7), tom: 1.15, contorno: 0.26, metal: 0.5, semente: 32047, projeta: { dist: 0.8, forca: 0.3 } }))
  TOMADAS.forEach(([x, y], i) => {
    L.push(P(elipse(K(x), K(y), K(1.8), K(1.8)), ACO, { bisel: 0.6, contorno: 0.26, metal: 0.4, semente: 32048 + i * 2 }))
    L.push(P(elipse(K(x), K(y), K(1.1), K(1.1)), FURO, { bisel: 0.3, contorno: 0, semente: 32049 + i * 2 }))
  })
}

export const montarGerador: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const k = Math.min(c.w / LARGURA_DO_DESENHO, c.h / ALTURA_DO_DESENHO)
  const K = (v: number): number => v * k
  cena.corDoPiso = ESCURO_DA_TINTA
  const corpo = caixa(K(CAIXA.x0), K(CAIXA.y0), K(CAIXA.x1), K(CAIXA.y1), K(1.6))

  // ---------- no chão: as pontas dos trilhos, o cabo e o galão ----------
  TRILHOS.forEach((y, i) => {
    for (const [j, [x0, x1]] of ([[CAIXA.x0 - SOBRA_DO_TRILHO, CAIXA.x0 + 1], [CAIXA.x1 - 1, CAIXA.x1 + SOBRA_DO_TRILHO]] as const).entries()) {
      const ponta = caixa(K(x0), K(y - MEIO_TRILHO), K(x1), K(y + MEIO_TRILHO), 0.5)
      cena.sombras.push({ forma: ponta, z: ALTURA_DO_TRILHO * G * k, forca: 0.3 }, contato(ponta, 0.3))
      L.push(P(ponta, ACO, { tabua: 0, bisel: 0.7, tom: 0.85, contorno: 0.28, metal: 0.3, semente: 32060 + i * 2 + j }))
      // O furo de içar na ponta do trilho.
      L.push(P(elipse(K(j === 0 ? x0 + 1.4 : x1 - 1.4), K(y), K(0.8), K(0.8)), FURO, { bisel: 0.3, contorno: 0, semente: 32064 + i * 2 + j }))
    }
  })
  const cabo = cadeia(CAMINHO_DO_CABO.map(([x, y]): Ponto => [K(x), K(y)]), K(1.1))
  cena.sombras.push(contato(cabo, 0.26))
  montarGalao(P, cena, k)

  // ---------- a caixa: coluna na 3/4, com a sombra arrastada até o tampo ----------
  cena.sombras.push({ forma: corpo, z: ALTURA_DA_CAIXA * G * k, forca: 0.32 }, contato(corpo, 0.34))
  cena.sombras.push({ forma: elipse(K(CANO_DO_ESCAPAMENTO[0]), K(CANO_DO_ESCAPAMENTO[1]), K(RAIO_DO_CANO), K(RAIO_DO_CANO)), z: ALTURA_DO_ESCAPAMENTO * G * k, forca: 0.28 })
  L.push(P(corpo, OLIVA, { tabua: 0, bisel: 1.6, contorno: 0.3, metal: 0.12, semente: 32070 }))
  // As emendas da chapa do tampo: a dobra em volta da grade e a do outro lado.
  L.push(P(caixa(K(GRADE.x1 + 1.4), K(CAIXA.y0 + 1.5), K(GRADE.x1 + 2.1), K(CAIXA.y1 - 1.5)), FUNDO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 32071 }))
  montarTampo(P, cena, k)

  // O cabo sai da tomada, passa por cima da beira da caixa e desce ao chão.
  L.push(P(cabo, BORRACHA, { tabua: 0, bisel: K(1.1), contorno: 0.26, semente: 32072, projeta: { dist: 0.7, forca: 0.26 } }))
  L.push(P(elipse(K(CAMINHO_DO_CABO[0][0]), K(CAMINHO_DO_CABO[0][1]), K(1.6), K(1.6)), BORRACHA, { tabua: 0, bisel: K(1), tom: 1.2, contorno: 0.28, semente: 32073 }))
}
