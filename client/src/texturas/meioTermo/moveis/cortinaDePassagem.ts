/**
 * CORTINA DE PASSAGEM de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; objeto novo). O pano
 * pendurado no vão da porta, rente à parede: a VARA de madeira de ponta a ponta, com as duas pontas torneadas, e o PANO
 * franzido nela em PREGAS que vão e voltam. De cima, o pano é a tira franzida por baixo da vara: as pregas que vêm para
 * a frente pegam a luz, as de trás ficam na sombra, com o vinco reto entre elas; as ARGOLAS prendem o pano na vara, uma
 * a cada duas pregas. Não barra a passagem (é pano) e tapa a visão: serve ao trapo da porta do cortiço e ao reposteiro
 * do castelo.
 *
 * A 25% de zoom sobra a fita ondulada e clara atravessada no vão, com o risco escuro da vara: cortina (a porta é a
 * folha lisa de tábua com o batente).
 *
 * NA 3/4 (DERIVADO) cada prega é uma coluna da altura da porta: as frentes se cobrem de trás para a frente e as beiras
 * delas fazem as dobras verticais do pano; a vara é o tampo solto em cima delas, com as pontas. Material: `pano` (um dos
 * tecidos; o linho cru de partida, o pano cru do pedido). A vara e as argolas são fixas. Esticada, a cortina ganha mais
 * pregas (uma a cada `PASSO_DA_PREGA` px), do mesmo tamanho.
 */
import { anel, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

/** A altura do pano (casas): o vão da porta. A vara fica um nada acima. */
const ALTURA_DO_PANO = 0.9
const FOLGA_DA_VARA = 0.03
/** O passo de uma prega e quanto ela vai e volta (px da pegada de partida, 1 x 0,25 casa). */
const PASSO_DA_PREGA = 5.4
const IDA_DA_PREGA = 2.6
/**
 * De cima, o pano é uma tira franzida: ondula pouco (px) e é mais grossa que a onda. Com a onda maior que a grossura, a
 * faixa em volta da vara lia mola.
 */
const ONDA_DE_CIMA = 1
const MEIA_GROSSURA_DO_PANO = 1.5
/** Quantos pontos desenham cada beira de prega. */
const PASSOS_DA_PREGA = 8
/** A vara de madeira escura, as pontas torneadas e as argolas de ferro. */
const VARA: MaterialDaPeca = { classe: 'madeira', rgb: [0x5f, 0x47, 0x33] }
const ARGOLA: MaterialDaPeca = { classe: 'metal', rgb: [0x6a, 0x6b, 0x6c] }

export const montarCortinaDePassagem: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const pano = c.m.pano
  const L = cena.partes
  const k = Math.min(w / G, h / (0.25 * G))
  const zPano = g * ALTURA_DO_PANO
  const zVara = g * (ALTURA_DO_PANO + FOLGA_DA_VARA)

  // As PREGAS: o pano é a faixa que ondula de uma ponta da vara à outra, vindo para a frente (y > 0) e voltando; cada
  // meia onda é uma prega. De cima sobra a faixa ondulada; na 3/4 cada prega é uma coluna (o gomo dela), e as beiras
  // dos gomos fazem as dobras de cima a baixo. A de trás vai primeiro: a da frente cobre a beira dela.
  const [xa, xb] = [-hw + 2.8 * k, hw - 2.8 * k]
  const n = Math.max(3, Math.round((xb - xa) / (PASSO_DA_PREGA * k)))
  const passo = (xb - xa) / n
  const ida = IDA_DA_PREGA * k
  const ry = Math.min(hh - ida - 0.3, 2.9 * k)
  const onda = (x: number): number => ONDA_DE_CIMA * k * Math.cos((Math.PI * (x - xa - passo / 2)) / passo)
  const meia = MEIA_GROSSURA_DO_PANO * k
  const gomos = Array.from({ length: n }, (_, i) => {
    const frente = i % 2 === 0 ? 1 : -1
    const x = xa + passo * (i + 0.5)
    // A face da prega: a fatia da tira entre um vinco e o outro, de beira ondulada e vinco reto (vinco torto lia corda
    // torcida). A 3/4 tira a frente de cada coluna do gomo dela; a face só decide o desenho de cima.
    const xs = Array.from({ length: PASSOS_DA_PREGA + 1 }, (_, j) => x - passo / 2 + (passo * j) / PASSOS_DA_PREGA)
    const face = poligono([...xs.map((px): Ponto => [px, onda(px) - meia]), ...[...xs].reverse().map((px): Ponto => [px, onda(px) + meia])])
    return { i, frente, coluna: elipse(x, frente * ida, passo * 0.74, ry), face }
  })
  // A tira inteira, na sombra, e por cima as faces das pregas da frente, na luz. A tira é a maior peça do móvel: na 3/4
  // as colunas que ficam sem peça (a tira e as faces moram na vara) tiram dela o pano da frente; sem ela, saíam da cor
  // da vara.
  const xsDaTira = Array.from({ length: n * PASSOS_DA_PREGA + 1 }, (_, j) => xa + (passo * j) / PASSOS_DA_PREGA)
  const tira = poligono([...xsDaTira.map((px): Ponto => [px, onda(px) - meia]), ...[...xsDaTira].reverse().map((px): Ponto => [px, onda(px) + meia])])
  cena.sombras.push(contato(tira, 0.3))
  L.push(P(tira, pano, { eixo: QUARTO, tabua: 0, bisel: 0.4 * k, ruga: 0.7, tom: 0.78, contorno: 0.22, semente: 8700 }))
  for (const gomo of gomos) {
    cena.sombras.push({ forma: gomo.coluna, z: zPano, forca: 0.22 })
    if (gomo.frente < 0) continue
    L.push(P(gomo.face, pano, { eixo: QUARTO, tabua: 0, bisel: 0.4 * k, ruga: 0.7, tom: 1.05, contorno: 0.2, semente: 8701 + gomo.i, projeta: { dist: 1 * k, forca: 0.3, suave: 0.8 * k } }))
  }

  // A VARA e as pontas torneadas, no alto (o tampo solto em cima do pano), com as argolas onde o pano cruza a vara, uma
  // sim, uma não.
  const yVara = 0
  const xPonta = hw - 1.5 * k
  const vara = capsula(-xPonta, yVara, xPonta, yVara, 0.5 * k)
  const pontas = [-1, 1].map((lado) => elipse(lado * xPonta, yVara, 1.5 * k, 1.5 * k))
  const tudo = [vara, ...pontas].reduce((a, b) => uniao(a, b))
  // A 3/4 pinta as estruturas pela beira de baixo da caixa: a da vara vai até a beira da pegada, para a vara sair
  // depois das pregas da frente e ficar por cima delas (a forma é a mesma; só a caixa é mais funda).
  const naFrente: Forma = { b: [tudo.b[0], tudo.b[1], tudo.b[2], hh + 0.5], d: tudo.d }
  cena.sombras.push({ forma: naFrente, z: zVara, solta: true, forca: 0.24 })
  L.push(P(vara, VARA, { tabua: 0, bisel: 0.8 * k, contorno: 0.3, semente: 8720, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.6 * k } }))
  for (let i = 1; i < n; i += 2) {
    L.push(P(anel(xa + passo * i, yVara, 0.95 * k, 1.05 * k, 0.45 * k, 0.55 * k), ARGOLA, { tabua: 0, bisel: 0.3 * k, metal: 0.45, contorno: 0.26, semente: 8721 + i }))
  }
  pontas.forEach((ponta, i) => L.push(P(ponta, VARA, { tabua: 0, bisel: 1.3 * k, tom: 1.08, contorno: 0.3, semente: 8740 + i })))
}
