/**
 * ÍDOLO DOURADO (lote L08 de 24/11/2026, item 74: objeto novo, o "tesouro do templo" do tema do mapa 6; desenho próprio,
 * só a ideia do objeto). Uma ESTATUETA DE OURO atarracada, sentada de pernas cruzadas, com as mãos na barriga, a cabeça
 * grande de olhos e boca vazados, as rodelas nas orelhas e a COROA EM DEGRAUS (a pirâmide do templo em miniatura), em
 * cima de um PEDESTAL de pedra de dois degraus com o quadrado entalhado na face, o musgo nos cantos e umas folhas secas
 * no pé.
 *
 * O brilho é CONTIDO: o ouro é o do tesouro do app (o mesmo tom, sem amarelo vivo), a luz do chanfro e o brilho do metal
 * fazem o volume, dois cintilos pequenos pousam na coroa e no ombro, e atrás da estatueta há um HALO morno e fraco
 * (emite: não escurece na sombra), que aparece no chão escuro e some no claro. Quem ilumina a sala é a entrada em
 * `LUZ_DOS_OBJETOS`, que o integrador registra (sugestão no lote-L08.json: luz quente, fraca e parada).
 *
 * Figura desenhada de uma vista só, DE FRENTE: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a sombra de baixo
 * (`EM_PE` em `tresQuartos.ts`); o giro gira a imagem inteira. O desenho é feito numa meia pegada de 28 px e escala com
 * o menor lado. Material: `pedra` (o pedestal); o ouro é fixo. Escreve `cena.corDoPiso`.
 */
import { caixa, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { acasoDoTemplo, ESCURO_DA_PEDRA_DO_TEMPLO, MUSGO_DO_TEMPLO, texDaPedraDoTemplo } from './piramideEmDegraus'

/** A meia pegada em que o ídolo é desenhado (px do protótipo). */
const MEIA_PEGADA = 28
/** O ouro do tesouro do app (`tesouroDeOuro.ts`: `OURO`, `BRILHO_DO_OURO` e `ESCURO_DO_OURO`, os valores copiados, sem import). */
const OURO: MaterialDaPeca = { classe: 'metal', rgb: [0xbc, 0x98, 0x56] }
const VAO_DO_OURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x47, 0x2e] }
const CINTILO: MaterialDaPeca = { classe: 'liso', rgb: [0xf2, 0xe0, 0xa8] }
/** O halo morno atrás da estatueta. */
const HALO: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xcb, 0x86] }
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x80, 0x52] }
/** O brilho do metal do ouro (menor que o padrão do motor: polido demais, estourava no nível 3). */
const BRILHO_DO_METAL = 0.3
/** A altura do conjunto para a sombra no chão (px no desenho de 28). */
const ALTURA_DA_SOMBRA = 26

/** O halo emite (não pega a luz do chanfro nem a sombra) e some para a beira. */
const texDoHalo: Textura = (_u, _v, _x, _y, _p, s) => {
  s[4] = 1
}

export const montarIdoloDourado: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIA_PEGADA
  if (!(k > 0)) return
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO

  const cx = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const el = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * k, y * k, rx * k, ry * k)
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([x, y]): Ponto => [x * k, y * k]))
  const ouro = { metal: BRILHO_DO_METAL, contorno: 0.28 }

  cena.sombras.push({ forma: el(0, 21.5, 16, 4), z: ALTURA_DA_SOMBRA * k }, contato(el(0, 23, 19, 3.6), 0.32))

  // ---------- o HALO morno, por trás de tudo ----------
  L.push(P(el(0, -8, 17, 19), HALO, { bisel: 0, contorno: 0, alfa: 0.2, suave: 9 * k, textura: texDoHalo, semente: 6000 }))
  L.push(P(el(0, -10, 10, 12), HALO, { bisel: 0, contorno: 0, alfa: 0.16, suave: 6 * k, textura: texDoHalo, semente: 6001 }))

  // ---------- o PEDESTAL: o degrau de baixo, o dado com o quadrado entalhado e a tampa ----------
  const daPedra = texDaPedraDoTemplo(0.5, 61)
  L.push(P(cx(-19, 16.5, 19, 24.5, 1.6), pedra, { tabua: 0, bisel: 1.8 * k, tom: 0.86, contorno: 0.28, textura: daPedra, semente: 6010 }))
  L.push(P(cx(-14, 7, 14, 18, 1.2), pedra, { tabua: 0, bisel: 1.6 * k, tom: 0.96, contorno: 0.26, textura: daPedra, semente: 6011, projeta: { dist: 1.6 * k, forca: 0.34 } }))
  L.push(P(cx(-4.2, 9.2, 4.2, 15.8, 0.8), pedra, { tabua: 0, bisel: 0, tom: 0.7, contorno: 0.14, recesso: { k: 1 * k, forca: 0.34 }, semente: 6012 }))
  L.push(P(cx(-1.7, 11, 1.7, 14, 0.4), pedra, { tabua: 0, bisel: 0.7 * k, tom: 1.02, contorno: 0.16, semente: 6013 }))
  L.push(P(cx(-16, 3.4, 16, 8.4, 1.6), pedra, { tabua: 0, bisel: 1.9 * k, tom: 1.06, contorno: 0.28, textura: daPedra, semente: 6014, projeta: { dist: 1.8 * k, forca: 0.36 } }))
  // O musgo nos cantos e as folhas secas no pé.
  for (const [x, y, rx, ry] of [[-15.5, 17.5, 4, 2.2], [13, 8, 3, 1.6], [16, 23, 4.4, 2], [-9, 4, 3, 1.2]] as const) {
    L.push(P(el(x, y, rx, ry), MUSGO_DO_TEMPLO, { bisel: 1 * k, contorno: 0.14, alfa: 0.82, suave: 0.6 * k, tom: 0.94, semente: 6020 + Math.round(x) }))
  }
  for (let i = 0; i < 5; i += 1) {
    const [x, y] = [-21 + 42 * acasoDoTemplo(i, 61), 23.4 + 2.4 * acasoDoTemplo(i, 62)]
    L.push(P(elipseGirada(x * k, y * k, 1.8 * k, 0.9 * k, acasoDoTemplo(i, 63) * Math.PI), FOLHA_SECA, { bisel: 0.5, contorno: 0.2, alfa: 0.85, tom: 0.86 + 0.3 * acasoDoTemplo(i, 64), semente: 6030 + i }))
  }

  // ---------- a ESTATUETA: as pernas cruzadas, o tronco, os braços e as mãos na barriga ----------
  L.push(P(uniao(el(-4.6, 1.7, 6.4, 2.9), el(4.6, 1.7, 6.4, 2.9)), OURO, { ...ouro, bisel: 2.2 * k, tom: 0.92, semente: 6040, projeta: { dist: 1.3 * k, forca: 0.36 } }))
  L.push(P(pol([[-6.4, -9], [6.4, -9], [8.6, 0.4], [6, 2.6], [-6, 2.6], [-8.6, 0.4]]), OURO, { ...ouro, bisel: 3.4 * k, tom: 0.98, semente: 6041 }))
  for (const lado of [-1, 1]) {
    L.push(P(pol([[lado * 6, -8.4], [lado * 9.8, -6], [lado * 9.6, -0.6], [lado * 6.4, 0.4]]), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.02, semente: 6043 + lado, projeta: { dist: 0.9 * k, forca: 0.3 } }))
    L.push(P(el(lado * 3.1, -1.2, 3.4, 1.8), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.08, semente: 6046 + lado, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  }
  // O colar de três contas.
  for (const dx of [-3.2, 0, 3.2]) L.push(P(el(dx, -7 + (dx === 0 ? 0.9 : 0), 1.3, 1.3), OURO, { ...ouro, bisel: 1 * k, tom: 1.12, contorno: 0.24, semente: 6050 + Math.round(dx) }))

  // ---------- a CABEÇA grande: as rodelas das orelhas, o rosto vazado e a coroa em degraus ----------
  for (const lado of [-1, 1]) L.push(P(el(lado * 8.8, -13.2, 2.4, 2.9), OURO, { ...ouro, bisel: 1.4 * k, tom: 0.96, semente: 6055 + lado }))
  L.push(P(cx(-7.8, -20, 7.8, -8.2, 4.4), OURO, { ...ouro, bisel: 4 * k, tom: 1.04, semente: 6060, projeta: { dist: 1.3 * k, forca: 0.36 } }))
  for (const lado of [-1, 1]) {
    L.push(P(cx(lado * 3.6 - 1.7, -16, lado * 3.6 + 1.7, -13.4, 0.5), VAO_DO_OURO, { bisel: 0, contorno: 0, alfa: 0.9, recesso: { k: 0.7 * k, forca: 0.3 }, semente: 6062 + lado }))
  }
  L.push(P(pol([[-0.9, -14.6], [0.9, -14.6], [1.7, -11.6], [-1.7, -11.6]]), OURO, { ...ouro, bisel: 0.9 * k, tom: 1.12, contorno: 0.2, semente: 6065, projeta: { dist: 0.7 * k, forca: 0.28 } }))
  L.push(P(cx(-3.1, -10.8, 3.1, -9.5, 0.5), VAO_DO_OURO, { bisel: 0, contorno: 0, alfa: 0.9, semente: 6066 }))
  // A coroa: três degraus, cada um mais estreito, o de cima com a conta no meio.
  L.push(P(cx(-9.4, -22.4, 9.4, -18.8, 0.9), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.08, semente: 6070, projeta: { dist: 1.2 * k, forca: 0.36 } }))
  L.push(P(cx(-6.3, -25.2, 6.3, -21.6, 0.9), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.12, semente: 6071, projeta: { dist: 1 * k, forca: 0.3 } }))
  L.push(P(cx(-3.2, -27.8, 3.2, -24.4, 0.9), OURO, { ...ouro, bisel: 1.4 * k, tom: 1.16, semente: 6072, projeta: { dist: 0.9 * k, forca: 0.3 } }))
  L.push(P(el(0, -20.6, 1.25, 1.25), VAO_DO_OURO, { bisel: 0, contorno: 0, alfa: 0.8, recesso: { k: 0.5 * k, forca: 0.3 }, semente: 6073 }))

  // ---------- os dois CINTILOS: a estrela de quatro pontas, pequena e clara ----------
  for (const [x, y, r] of [[-5.4, -25.6, 2.6], [8.2, -6.4, 1.9]] as const) {
    const cintura = r * 0.2
    const estrela = pol([[x + r, y], [x + cintura, y + cintura], [x, y + r], [x - cintura, y + cintura], [x - r, y], [x - cintura, y - cintura], [x, y - r], [x + cintura, y - cintura]])
    L.push(P(el(x, y, r * 0.9, r * 0.9), CINTILO, { bisel: 0, contorno: 0, alfa: 0.26, suave: r * 0.8 * k, textura: texDoHalo, semente: 6080 + Math.round(x) }))
    L.push(P(estrela, CINTILO, { bisel: 0, contorno: 0, alfa: 0.9, suave: 0.3, textura: texDoHalo, semente: 6082 + Math.round(x) }))
  }
}
