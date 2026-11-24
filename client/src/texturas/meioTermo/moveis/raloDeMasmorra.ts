/**
 * RALO DE MASMORRA de cima (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão de
 * masmorra do bueiro): a grade quadrada de ferro chumbada RENTE ao chão de pedra, no meio da sala de tortura ou no
 * fundo da cela, por onde se lava o chão. O QUADRO de ferro chato encaixado numa junta escura na pedra, com os quatro
 * PARAFUSOS dos cantos; dentro, a GRADE cruzada (três barras de cada lado, as de través por cima das de pé, cada uma
 * fazendo sombra no buraco) e, lá embaixo, o brilho da água parada. Em volta, a MANCHA ÚMIDA da pedra molhada que
 * escoa para o ralo e o RASTRO de água suja, com sangue velho diluído, que escorre até ele.
 *
 * O que diz "ralo" (e não bueiro) a 25% de zoom é o quadrado escuro quadriculado, menor que a pegada, cercado pela
 * mancha escura e sem moldura de pedra.
 *
 * É OBJETO DE CHÃO rente: nenhuma sombra tem altura, e a 3/4 sai igual à vista de cima (como o bueiro). Esticado, o
 * ralo fica no meio, do tamanho do menor lado (a grade não estica: vira retângulo só a mancha úmida).
 *
 * Material: `grade` (o ferro). O buraco, a água, a umidade, o sangue velho e a ferrugem são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, dentroDe, elipse, elipseGirada, menos, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (frações do menor meio lado, salvo onde diz px) ----------

/** O meio lado de fora do quadro e a largura dele (px). */
const LADO_DO_QUADRO = 0.56
const LARGURA_DO_QUADRO = 3.2
/** A junta escura entre o quadro e a pedra (px). */
const JUNTA = 1.3
/** Quantas barras de cada lado e a meia largura de cada uma (px). */
const BARRAS = 3
const MEIA_BARRA = 1.05
/** A sombra que cada barra faz no fundo (px). */
const SOMBRA_DA_BARRA = 2.2
/**
 * O rastro molhado que escorre até o ralo: uma mancha comprida e borrada vinda do canto de cima à esquerda (o meio em
 * frações da meia pegada, os meios eixos em frações do menor meio lado, o giro em radianos). Em faixa fina saía um
 * pavio saindo da mancha, como o de uma bomba.
 */
const RASTRO = { x: -0.5, y: -0.32, comprido: 0.5, largo: 0.17, giro: 0.59 }

// ---------- os materiais fixos ----------

const BURACO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x29, 0x2a, 0x2a] }
const ESCURO_DO_BURACO: Rgb = [0x3c, 0x3d, 0x3e]
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x3d, 0x3b] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x93, 0x90] }
const UMIDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x28, 0x25] }
const JUNTA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x2f, 0x2c, 0x29] }
/** O sangue velho diluído na água: vinho apagado, nunca vermelho. */
const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x2c, 0x27] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }

/** A pedra molhada em volta: três manchas que se juntam, puxadas para onde o fio chega. */
function manchaUmida(hw: number, hh: number, R: number, cresce: number): Forma {
  return uniao(uniao(elipse(-0.06 * hw, 0, R * 0.74 * cresce, R * 0.68 * cresce), elipse(-0.4 * hw, -0.3 * hh, R * 0.36 * cresce, R * 0.3 * cresce)), elipse(0.28 * hw, 0.2 * hh, R * 0.44 * cresce, R * 0.4 * cresce))
}

export const montarRaloDeMasmorra: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const grade = c.m.grade
  const L = cena.partes
  const R = Math.min(hw, hh)
  const s = LADO_DO_QUADRO * R
  const i = s - LARGURA_DO_QUADRO
  cena.corDoPiso = ESCURO_DO_BURACO

  // ---------- a pedra molhada e o rastro de sangue velho ----------
  L.push(P(manchaUmida(hw, hh, R, 1.12), UMIDO, { bisel: 0, contorno: 0, alfa: 0.2, suave: 4, semente: 9401 }))
  L.push(P(manchaUmida(hw, hh, R, 0.86), UMIDO, { bisel: 0, contorno: 0, alfa: 0.18, suave: 2.6, semente: 9402 }))
  // O rastro: a pedra molhada puxada para o canto, e o sangue velho diluído só no trecho perto do ralo.
  const { x: rx, y: ry, comprido, largo, giro } = RASTRO
  L.push(P(elipseGirada(rx * hw, ry * hh, comprido * R, largo * R, giro), UMIDO, { bisel: 0, contorno: 0, alfa: 0.24, suave: 3.2, semente: 9403 }))
  L.push(P(elipseGirada(rx * hw * 0.7, ry * hh * 0.7, comprido * R * 0.55, largo * R * 0.7, giro), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.18, suave: 2.4, semente: 9404 }))

  // ---------- a junta escura na pedra ----------
  const fora = caixa(-s, -s, s, s, 1.2)
  cena.sombras.push(contato(fora, 0.2))
  L.push(P(caixa(-s - JUNTA, -s - JUNTA, s + JUNTA, s + JUNTA, 1.8), JUNTA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.78, suave: 0.6, semente: 9408 }))

  // ---------- o buraco, a água lá embaixo ----------
  const boca = caixa(-i, -i, i, i, 0.4)
  L.push(P(boca, BURACO_FUNDO, { bisel: 0, contorno: 0.2, recesso: { k: 3, forca: 0.6 }, semente: 9410 }))
  L.push(P(dentroDe(elipse(i * 0.12, i * 0.24, i * 0.72, i * 0.46), boca), AGUA, { bisel: 0, contorno: 0, alfa: 0.86, suave: 1.4, semente: 9411 }))
  L.push(P(dentroDe(elipseGirada(i * 0.3, i * 0.36, i * 0.3, 0.8, -0.1), boca), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.7, semente: 9412 }))

  // ---------- a grade: as barras de pé por baixo, as de través por cima ----------
  const passo = (i * 2) / (BARRAS + 1)
  for (let b = 1; b <= BARRAS; b += 1) {
    const x = -i + b * passo
    L.push(P(caixa(x - MEIA_BARRA, -i - 0.4, x + MEIA_BARRA, i + 0.4, 0.4), grade, { eixo: QUARTO, tabua: 0, bisel: MEIA_BARRA, tom: 0.9, contorno: 0.3, semente: 9420 + b, projeta: { dist: SOMBRA_DA_BARRA, forca: 0.55, suave: 0.8 } }))
  }
  for (let b = 1; b <= BARRAS; b += 1) {
    const y = -i + b * passo
    L.push(P(caixa(-i - 0.4, y - MEIA_BARRA, i + 0.4, y + MEIA_BARRA, 0.4), grade, { tabua: 0, bisel: MEIA_BARRA, tom: 1.02, contorno: 0.3, semente: 9430 + b, projeta: { dist: SOMBRA_DA_BARRA * 0.8, forca: 0.5, suave: 0.8 } }))
  }

  // ---------- o quadro, os parafusos e a ferrugem ----------
  const quadro = menos(fora, caixa(-i + 0.3, -i + 0.3, i - 0.3, i - 0.3, 0.4))
  L.push(P(quadro, grade, { tabua: 0, bisel: 1.1, tom: 0.86, contorno: 0.32, semente: 9440, projeta: { dist: 1.4, forca: 0.45, suave: 0.8 } }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const bx = sx * (s - LARGURA_DO_QUADRO / 2)
    const by = sy * (s - LARGURA_DO_QUADRO / 2)
    L.push(P(elipse(bx, by, 1.15, 1.15), grade, { bisel: 0.7, contorno: 0.32, tom: 1.16, metal: 0.55, semente: 9441 }))
    L.push(P(caixa(bx - 0.75, by - 0.18, bx + 0.75, by + 0.18), JUNTA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.6, semente: 9442 }))
  }
  L.push(P(dentroDe(elipse(-s * 0.55, -s, s * 0.42, LARGURA_DO_QUADRO * 1.2), quadro), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.5, suave: 1.1, semente: 9443 }))
  L.push(P(dentroDe(elipse(s, s * 0.3, LARGURA_DO_QUADRO * 1.1, s * 0.4), quadro), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.4, suave: 1.1, semente: 9444 }))
  L.push(P(dentroDe(elipse(-s * 0.9, -s * 0.45, LARGURA_DO_QUADRO, s * 0.3), quadro), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.35 + hash(1, 2, 9445) * 0.1, suave: 1.1, semente: 9445 }))
}
