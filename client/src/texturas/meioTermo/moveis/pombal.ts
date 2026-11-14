/**
 * POMBAL de cima com volume (lote L18 dos objetos e construções de 14/11/2026, construção do grupo Torres e
 * prédios): a torre quadrada dos pombos, de quinta. Paredes CAIADAS sobre o SOCO de pedra, TELHADO de quatro águas
 * de telha de canal, e no alto o LANTERNIM (a casinha de entrada dos pombos, aberta dos lados, com o telhadinho
 * dela). Na parede da frente, três fiadas de BURACOS de pombo, cada fiada com o POUSO de pedra embaixo, e a
 * PORTINHA no pé. POMBOS no telhado e no chão, ciscando o grão.
 *
 * De cima: o telhado de telha (as águas viradas para a luz claras, cada fiada de telha com a sombra da de cima),
 * as quatro arestas, o lanternim no meio, os pombos e a SOMBRA comprida para baixo à direita. São os pombos e o
 * lanternim que dizem "pombal" e não torre de vigia (palha, plataforma) nem galinheiro (casinha baixa, cercado).
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_POMBAL`, a espessura do perfil):
 * - a parede é uma coluna, com o pingo de cal no pé da frente;
 * - o TELHADO são quatro tampos em degrau, cada um com as quatro águas dele (as de cima mais claras do lado da
 *   luz), a caixa esticada para a frente NA TELA (saem depois da parede, de baixo para cima). O de baixo tem uma
 *   fresta rente à frente NA TELA, mais estreita que a beirada (a varredura a fecha e a água da frente a cobre):
 *   é nela que ficam os pingos da parede, dos buracos, dos pousos e da porta, que assim não sobem com o telhado;
 * - cada BURACO é um tampo raso escuro que sai um tico da parede da frente NA TELA; cada POUSO, uma régua de pedra
 *   um tico mais para fora; a PORTA, uma coluna rente à parede. Os três ficam sempre na face da frente na tela (o
 *   pombal tem buracos nas quatro faces; só a da frente aparece);
 * - o LANTERNIM são três tampos empilhados (cal, o vão escuro, cal), o de baixo um tico mais largo que o de cima
 *   (o pingo de cada um fica nesse tico), e o telhadinho em dois degraus.
 * Por isso o desenho lê `c.giro`. A torre enche a pegada; as alturas são em casas.
 * Materiais: `pedra` (o soco, os pousos e o degrau) e `telhado` (as telhas). A cal, a porta, o grão e os pombos são
 * fixos.
 */
import { hash, limitar01 } from '../../ruido'
import { caixa, capsula, elipse, elipseGirada, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from './motor'
import { BURACO, G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** A beirada de cada tampo do pombal (px do protótipo): a testeira do telhado, os buracos e os pousos. */
export const ESPESSURA_DO_POMBAL = 0.05 * G

/** A parede e o beiral em fração do meio lado. */
const PAREDE = 0.72
const BEIRAL = 0.9
/** Os degraus do telhado, em fração do beiral (o primeiro é o próprio beiral). */
const CAMADAS_DO_TELHADO: readonly number[] = [1, 0.78, 0.64, 0.5, 0.36, 0.22]
/** Alturas em casas: a parede, a cumeeira (o pé do lanternim), o lanternim e o telhadinho dele. */
const ALTURA_DA_PAREDE = 1.9
const ALTURA_DO_BICO = 2.52
const LANTERNIM: readonly [number, number, number] = [2.57, 2.7, 2.81]
const ALTURA_DO_TELHADINHO = 2.98
const ALTURA_DA_PORTA = 0.62
/** O lanternim: meio lado em fração do meio lado da torre. */
const MEIO_LANTERNIM = 0.22
/** Os buracos: as alturas das fiadas (casas), onde ficam na face (fração da meia largura) e a meia largura. */
const FIADAS_DE_BURACOS: readonly number[] = [0.92, 1.22, 1.52]
const BURACOS_EM: readonly number[] = [-0.58, -0.22, 0.22, 0.58]
const MEIO_BURACO = 0.07
/** A porta: a meia largura (fração da meia largura da face). */
const MEIA_PORTA = 0.13
/** A telha de canal (px): a largura de cada canal e o passo de cada fiada, descendo a água. */
const PASSO_DO_CANAL = 3.6
const PASSO_DA_FIADA = 5.2
/** Abaixo destes passos na imagem (px), o canal vira chuvisco: some aos poucos. */
const PASSO_NITIDO = 3
const PASSO_SUMIDO = 1.5
/** A luz vem de cima à esquerda NA TELA: o quanto clareia a água virada para ela. */
const LUZ_DAS_AGUAS = 0.16

const CAL: MaterialDaPeca = { classe: 'pedra', rgb: [0xd8, 0xd1, 0xc1] }
const PORTA = materialDaPeca('nogueira')
const FERRO = materialDaPeca('ferro')
const GRAO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xa6, 0x6a] }
/** O pombo comum: o cinza-azulado do corpo, a asa um tico mais escura, as barras pretas, o pescoço furta-cor. */
const POMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x92, 0x9b] }
const ASA: MaterialDaPeca = { classe: 'liso', rgb: [0x7b, 0x80, 0x8a] }
const BARRA_DA_ASA: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x36, 0x3b] }
const PESCOCO: MaterialDaPeca = { classe: 'liso', rgb: [0x67, 0x7f, 0x76] }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: [0xb9, 0x9a, 0x8c] }
const DA_PEDRA = texturaDaClasse('pedra')

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** A mesma forma com a caixa esticada até `ate` px do centro, do lado que fica embaixo NA TELA (sai depois). */
function esticadaParaAFrente(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/**
 * Uma quina da beira de uma água de normal (nx, ny) do retângulo de meio lado (ex, ey): `s` = -1 ou 1, as duas
 * pontas da beira (as águas do norte e do sul correm em x; as do leste e do oeste, em y).
 */
function quinaDaAgua(nx: number, ny: number, s: number, ex: number, ey: number): Ponto {
  return nx === 0 ? [-s * ny * ex, ny * ey] : [nx * ex, s * nx * ey]
}

/** A telha de canal de uma água de normal (nx, ny): os canais descendo a água e a sombra de cada fiada. */
function telhasDaAgua(nx: number, ny: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    const nitidez = limitar01((PASSO_DO_CANAL * escala - PASSO_SUMIDO) / (PASSO_NITIDO - PASSO_SUMIDO))
    if (nitidez <= 0) return
    const aoLongo = x * -ny + y * nx
    const descendo = x * nx + y * ny
    s[3] += 0.13 * nitidez * Math.cos((aoLongo / PASSO_DO_CANAL) * 2 * Math.PI)
    const naFiada = descendo / PASSO_DA_FIADA - Math.floor(descendo / PASSO_DA_FIADA)
    // A ponta de cada telha faz sombra na fiada de baixo (para fora da água, a de baixo).
    if (naFiada < 0.22) s[3] -= 0.2 * nitidez * (1 - naFiada / 0.22)
  }
}

export const montarPombal: MontarMovel = (c, cena) => {
  const P = c.peca
  const quartos = quartosDoGiro(c.giro)
  const k = Math.min(c.hw, c.hh) / G
  const [ax, ay] = [c.hw * PAREDE, c.hh * PAREDE]
  const [bx, by] = [c.hw * BEIRAL, c.hh * BEIRAL]
  // As medidas NA TELA (com um quarto de volta a largura e a fundura trocam).
  const impar = quartos % 2 === 1
  const [axT, ayT] = impar ? [ay, ax] : [ax, ay]
  const maior = Math.max(bx, by)
  const e = ESPESSURA_DO_POMBAL
  const pedra = c.m.pedra
  const telhado = c.m.telhado
  const L = cena.partes
  const S = cena.sombras
  const solta = (forma: Forma, z: number): Sombra => ({ forma, z, solta: true, forca: 0 })
  /** Uma caixa dada NA TELA, no desenho. */
  const caixaNaTela = (x0: number, y0: number, x1: number, y1: number): Forma => {
    const [p, q] = [doDesenho(x0, y0, quartos), doDesenho(x1, y1, quartos)]
    return caixa(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]))
  }
  const pingo = (xT: number, yT: number, mat: MaterialDaPeca, semente: number): void => {
    const [x, y] = doDesenho(xT, yT, quartos)
    L.push(P(elipse(x, y, 0.2, 0.2), mat, { tabua: 0, bisel: 0, contorno: 0, semente }))
  }

  // ---------- as sombras: o contato e a coluna da parede (a sombra comprida) ----------
  const parede = caixa(-ax, -ay, ax, ay)
  S.push(contato(caixa(-ax - 1, -ay - 1, ax + 1, ay + 1, 1), 0.36), { forma: parede, z: ALTURA_DA_PAREDE * c.g, forca: 0.34 })

  // ---------- no chão: o degrau da porta (na frente NA TELA), o grão e os pombos ciscando ----------
  const [dgx, dgy] = doDesenho(0, ayT + 3.2 * k, quartos)
  L.push(P(caixa(dgx - (impar ? 3 : 9) * k, dgy - (impar ? 9 : 3) * k, dgx + (impar ? 3 : 9) * k, dgy + (impar ? 9 : 3) * k, 1.2 * k), pedra, { bisel: 1.2 * k, contorno: 0.28, tom: 0.9, semente: 18600 }))
  for (let i = 0; i < 34; i += 1) {
    const [gx, gy] = [(hash(i, 1, 18601) - 0.5) * 1.8 * c.hw, c.hh * (0.82 + 0.16 * hash(i, 2, 18601))]
    L.push(P(elipse(gx, gy, 0.95 * k, 0.7 * k), GRAO, { tabua: 0, bisel: 0.4, contorno: 0.3, tom: 0.85 + 0.3 * hash(i, 3, 18601), semente: 18602 + i }))
  }
  const pombo = (x: number, y: number, ang: number, semente: number, noTelhado: boolean): void => {
    const [cs, sn] = [Math.cos(ang), Math.sin(ang)]
    const em = (f: number, l: number): Ponto => [x + cs * f * k - sn * l * k, y + sn * f * k + cs * l * k]
    const corpo = elipseGirada(x, y, 3.4 * k, 2.1 * k, ang)
    if (!noTelhado) S.push(contato(corpo, 0.3))
    const sombra = noTelhado ? { dist: 1.4, forca: 0.34 } : undefined
    // Toda peça do pombo tem o meio da caixa no meio do corpo: no telhado, o pombo inteiro sobe com o mesmo degrau.
    const parte = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
      L.push(P(comMeioEm(forma, x, y), mat, { tabua: 0, ...o }))
    }
    parte(poligono([em(-3, 0), em(-6.2, -1.9), em(-6.2, 1.9)]), BARRA_DA_ASA, { bisel: 0.5, contorno: 0.3, tom: 1.1, projeta: sombra, semente })
    parte(corpo, POMBO, { bisel: 1.4 * k, contorno: 0.32, tom: 1.04, projeta: sombra, semente: semente + 1 })
    const [wx, wy] = em(-0.8, 0)
    parte(elipseGirada(wx, wy, 2.6 * k, 1.6 * k, ang), ASA, { bisel: 0.8 * k, contorno: 0.28, semente: semente + 2 })
    for (const f of [-1.2, -2.4]) parte(capsula(...em(f, -1.3), ...em(f, 1.3), 0.32 * k), BARRA_DA_ASA, { bisel: 0, contorno: 0.1, semente: semente + 3 })
    const [hx, hy] = em(3.3, 0)
    parte(elipse(hx - cs * 0.7 * k, hy - sn * 0.7 * k, 1.5 * k, 1.5 * k), PESCOCO, { bisel: 0.6 * k, contorno: 0.3, semente: semente + 4 })
    parte(elipse(hx, hy, 1.15 * k, 1.15 * k), ASA, { bisel: 0.6 * k, contorno: 0.32, tom: 0.92, semente: semente + 5 })
    const [px, py] = em(4.8, 0)
    parte(capsula(hx + cs * 0.8 * k, hy + sn * 0.8 * k, px, py, 0.35 * k), BICO, { bisel: 0, contorno: 0.3, semente: semente + 6 })
  }
  pombo(-c.hw * 0.62, c.hh * 0.95, 0.35, 18640, false)
  pombo(c.hw * 0.46, c.hh * 0.93, Math.PI - 0.5, 18650, false)
  pombo(c.hw * 0.12, c.hh * 0.95, -0.3, 18660, false)

  // ---------- o telhado: quatro tampos em degrau; o de baixo com a fresta rente à frente NA TELA ----------
  const zParede = ALTURA_DA_PAREDE * c.g
  const zBico = ALTURA_DO_BICO * c.g
  const fresta = caixaNaTela(-maior - 2, ayT - 0.8, maior + 2, ayT + 2.4)
  const normais: readonly Ponto[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  CAMADAS_DO_TELHADO.forEach((f, i) => {
    const prox = i + 1 < CAMADAS_DO_TELHADO.length ? CAMADAS_DO_TELHADO[i + 1] : 0
    const [mx, my] = [bx * f, by * f]
    const degrau = caixa(-mx, -my, mx, my, i === 0 ? 1 : 0.6)
    const z = zParede + e + ((zBico - zParede - e) * (1 - f)) / (1 - CAMADAS_DO_TELHADO[CAMADAS_DO_TELHADO.length - 1])
    S.push(solta(esticadaParaAFrente(i === 0 ? menos(degrau, fresta) : degrau, maior + 0.5 + 0.01 * i, quartos), z))
    normais.forEach(([nx, ny], j) => {
      const fora: Ponto[] = [quinaDaAgua(nx, ny, -1, mx, my), quinaDaAgua(nx, ny, 1, mx, my)]
      const [qx, qy] = [bx * prox, by * prox]
      const dentro: Ponto[] = prox > 0 ? [quinaDaAgua(nx, ny, 1, qx, qy), quinaDaAgua(nx, ny, -1, qx, qy)] : [[0, 0]]
      const [sx, sy] = naTela(nx, ny, quartos)
      const tom = 0.94 - LUZ_DAS_AGUAS * (sx + sy) + 0.03 * (hash(i, j, 18670) - 0.5)
      const agua = poligono([...fora, ...dentro])
      const meio: Ponto = [nx * (mx + (prox > 0 ? qx : 0)) / 2, ny * (my + (prox > 0 ? qy : 0)) / 2]
      L.push(P(comMeioEm(agua, meio[0], meio[1]), telhado, { tabua: 0, eixo: nx === 0 ? QUARTO : 0, bisel: 0.9 * k, tom, contorno: 0.24, textura: telhasDaAgua(nx, ny), projeta: { dist: 1.4, forca: 0.3 }, semente: 18670 + i * 4 + j }))
    })
  })
  // As arestas (as telhas de cumeeira das quinas), da quina do beiral até o pé do lanternim, uma por degrau (as que
  // passassem por baixo dele riscariam o telhadinho visto de cima).
  const pe = (MEIO_LANTERNIM * Math.max(c.hw, c.hh)) / Math.max(bx, by)
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    CAMADAS_DO_TELHADO.forEach((f, i) => {
      if (f <= pe) return
      const prox = Math.max(pe, i + 1 < CAMADAS_DO_TELHADO.length ? CAMADAS_DO_TELHADO[i + 1] : 0)
      const [x0, y0, x1, y1] = [sx * bx * f, sy * by * f, sx * bx * prox, sy * by * prox]
      L.push(P(comMeioEm(capsula(x0, y0, x1, y1, 1.5 * k), (x0 + x1) / 2, (y0 + y1) / 2), telhado, { tabua: 0, eixo: Math.atan2(sy, sx), bisel: 1 * k, tom: 1.14, contorno: 0.36, projeta: { dist: 1.2, forca: 0.3 }, semente: 18690 + i * 4 + (sx + 1) + (sy + 1) / 2 }))
    })
  }
  pombo(-c.hw * 0.38, -c.hh * 0.55, 0.9, 18700, true)
  pombo(c.hw * 0.62, -c.hh * 0.16, 2.6, 18710, true)

  // ---------- o lanternim: três tampos (cal, o vão escuro, cal), o de baixo um tico mais largo ----------
  const [lx, ly] = [c.hw * MEIO_LANTERNIM, c.hh * MEIO_LANTERNIM]
  const [, lyT] = impar ? [ly, lx] : [lx, ly]
  const materiais: readonly MaterialDaPeca[] = [CAL, BURACO, CAL]
  LANTERNIM.forEach((altura, i) => {
    const folga = 0.5 * (LANTERNIM.length - 1 - i)
    S.push(solta(esticadaParaAFrente(caixa(-lx - folga, -ly - folga, lx + folga, ly + folga), maior + 0.6 + 0.01 * i, quartos), altura * c.g))
    pingo(0, lyT + folga - 0.25, materiais[i], 18720 + i)
  })
  const zTelhadinho = ALTURA_DO_TELHADINHO * c.g
  // O telhadinho é mais estreito que o lanternim: de cima aparece a cal em volta, e os pingos ficam fora dele.
  ;[0.94, 0.5].forEach((f, i) => {
    const [mx, my] = [lx * f, ly * f]
    S.push(solta(esticadaParaAFrente(caixa(-mx, -my, mx, my, 0.5), maior + 0.7 + 0.01 * i, quartos), LANTERNIM[2] * c.g + e + (zTelhadinho - LANTERNIM[2] * c.g - e) * i))
    normais.forEach(([nx, ny], j) => {
      const [sx, sy] = naTela(nx, ny, quartos)
      const fora: Ponto[] = nx === 0 ? [[-mx, ny * my], [mx, ny * my]] : [[nx * mx, -my], [nx * mx, my]]
      const dentro: Ponto[] = i === 0 ? (nx === 0 ? [[mx * 0.52, ny * my * 0.52], [-mx * 0.52, ny * my * 0.52]] : [[nx * mx * 0.52, my * 0.52], [nx * mx * 0.52, -my * 0.52]]) : [[0, 0]]
      const meio: Ponto = [nx * mx * (i === 0 ? 0.76 : 0.5), ny * my * (i === 0 ? 0.76 : 0.5)]
      L.push(P(comMeioEm(poligono([...fora, ...dentro]), meio[0], meio[1]), telhado, { tabua: 0, eixo: nx === 0 ? QUARTO : 0, bisel: 0.7 * k, tom: 1.08 - LUZ_DAS_AGUAS * (sx + sy), contorno: 0.4, textura: telhasDaAgua(nx, ny), projeta: { dist: 1.6, forca: 0.32 }, semente: 18730 + i * 4 + j }))
    })
  })
  L.push(P(elipse(0, 0, 1.6 * k, 1.6 * k), FERRO, { tabua: 0, bisel: 0.8 * k, contorno: 0.32, metal: 0.4, projeta: { dist: 1.2, forca: 0.3 }, semente: 18740 }))

  // ---------- a face da frente NA TELA: o pingo da parede, os buracos, os pousos e a porta ----------
  pingo(axT * 0.92, ayT - 0.4, CAL, 18750)
  // As fiadas têm a mesma pegada: a de baixo é um tico mais larga, e o pingo dela fica nesse tico (a de cima, mais
  // alta, não o alcança).
  FIADAS_DE_BURACOS.forEach((altura, i) => {
    const tico = FIADAS_DE_BURACOS.length - 1 - i
    BURACOS_EM.forEach((em, j) => {
      const x = em * axT
      const meio = (MEIO_BURACO + 0.012 * tico) * axT
      S.push(solta(caixaNaTela(x - meio, ayT - 1.5, x + meio, ayT + 1.2), altura * c.g))
      pingo(x + meio - 0.3, ayT + 0.9, BURACO, 18760 + i * 4 + j)
    })
    const meioPouso = (0.74 + 0.02 * tico) * axT
    S.push(solta(caixaNaTela(-meioPouso, ayT + 1.3, meioPouso, ayT + 2.3), altura * c.g - 0.085 * c.g))
    pingo(meioPouso - 0.3, ayT + 2, pedra, 18780 + i)
  })
  // O pingo da porta fica fora da parede (que é mais alta e o levaria), na fresta do telhado.
  S.push({ forma: caixaNaTela(-MEIA_PORTA * axT, ayT - 1, MEIA_PORTA * axT, ayT + 1.2), z: ALTURA_DA_PORTA * c.g, forca: 0 })
  pingo(0, ayT + 0.5, PORTA, 18790)
}
