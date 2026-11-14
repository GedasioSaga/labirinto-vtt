/**
 * A RODA GIGANTE DE MADEIRA (lote L19 de 14/11/2026, item 107 da lista do dia; construção do parque que barra).
 * A roda de aros de madeira com os raios, o anel de dentro e a treliça em zigue-zague entre eles, o cubo de ferro,
 * os dois cavaletes em A (o de trás mais escuro, deslocado: a espessura da roda), oito cadeirinhas penduradas pelo
 * pino, cada uma com o toldinho (a cor do `pano` alternada com o creme) e o banco, e o estrado de embarque com a
 * escadinha.
 *
 * DESENHADA DE FRENTE NAS DUAS VISTAS (perfil em pé), como as velas do moinho e o alvo de dardos: vista do alto,
 * a roda é um risco comprido com as cadeirinhas em fila e ninguém diria o que é. O giro deita a imagem (girada um
 * quarto de volta, a roda fica de lado no mapa); o mestre a põe sem giro. A roda fica parada: não há camada
 * animada para ela (o motor dos objetos não gira peça).
 *
 * Materiais: `madeira` (os aros, os raios, os cavaletes, o estrado e os bancos) e `pano` (os toldinhos).
 */
import { rgb } from '../../ruido'
import { anel, barra, capsula, caixa, elipse, poligono, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { materialDaPeca, QUARTO, type MontarMovel } from './contexto'

const CREME: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb('#ddd2bb') }
const FERRO = materialDaPeca('ferro')
const LATAO = materialDaPeca('latao')
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x26] }

/** A meia pegada de partida (4 casas): `k` = 1 nela. */
const LADO_DE_PARTIDA = 112
/** Folgas da pegada (px): em cima da roda e embaixo do estrado. */
const FOLGA_DE_CIMA = 4
const FOLGA_DO_CHAO = 5
/** O estrado de embarque: a meia largura (fração da meia pegada), a altura e a beira de cima (px). */
const MEIA_LARGURA_DO_ESTRADO = 0.84
const ALTURA_DO_ESTRADO = 9
const BEIRA_DO_ESTRADO = 2.6
/** Quanto a cadeirinha pende abaixo do pino (px): o raio da roda sai do que sobra da altura. */
const PENDURO = 24
/** O raio da roda nunca passa desta fração da meia largura (as cadeirinhas do lado cabem na pegada). */
const RAIO_NA_LARGURA = 0.8
/** Os aros (meia grossura), o anel de dentro (fração do raio), os raios e a treliça (px). */
const ARO = 2.1
const ANEL_DE_DENTRO = 0.52
const ARO_DE_DENTRO = 1.3
const RAIOS = 16
const RAIO_DO_RAIO = 1.05
const RAIO_DA_TRELICA = 0.62
/** O cavalete de trás fica deslocado assim (px, para a direita e para cima): a espessura da roda vista de frente. */
const FUNDO_X = 3.2
const FUNDO_Y = -2.2
/** Os cavaletes: o pé (fração da meia largura), a largura da perna e a altura da travessa (fração do cubo ao estrado). */
const PE_DO_CAVALETE = 0.6
const PERNA = 5
const TRAVESSA = 0.55
/** O cubo: o raio do ferro e o do miolo de latão. */
const CUBO = 7.5
const MIOLO = 3.4
/** As cadeirinhas: quantas, a meia largura, a altura do toldinho e do banco (px). */
const CADEIRINHAS = 8
const MEIA_CADEIRINHA = 8.4
const HASTE = 3.2
const TOLDO = 5.2
const BANCO_DE = 13.5
const BANCO_ATE = 21.5
/** A escadinha do estrado, na frente do meio: os degraus (px). */
const DEGRAUS = 2
const DEGRAU = 3.6

export const montarRodaGigante: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const k = Math.min(c.hw, c.hh) / LADO_DE_PARTIDA
  const mad = c.m.madeira
  const chao = c.hh - FOLGA_DO_CHAO * k
  const estrado = chao - ALTURA_DO_ESTRADO * k
  const topo = -c.hh + FOLGA_DE_CIMA * k
  const R = Math.min((estrado - topo - PENDURO * k - ARO * k) / 2, RAIO_NA_LARGURA * c.hw)
  const cy = topo + ARO * k + R
  const pe = PE_DO_CAVALETE * c.hw
  const madeira = (semente: number, tom = 1) => ({ tabua: 0, bisel: 0.9 * k, contorno: 0.28, tom, semente })

  // O pé no chão: a sombra do estrado e o contato; o estrado tem altura, a roda é desenhada de pé.
  const base = caixa(-MEIA_LARGURA_DO_ESTRADO * c.hw, estrado, MEIA_LARGURA_DO_ESTRADO * c.hw, chao, 1.2 * k)
  cena.sombras.push({ forma: base, z: ALTURA_DO_ESTRADO * k }, contato(base, 0.3))

  // O cavalete de trás, escuro e deslocado.
  for (const lado of [-1, 1]) {
    L.push(P(barra(FUNDO_X * k, cy + FUNDO_Y * k, lado * pe + FUNDO_X * k, estrado + FUNDO_Y * k, PERNA * k * 0.85), mad, { ...madeira(10 + lado, 0.6), eixo: Math.atan2(estrado - cy, lado * pe) }))
  }
  // O aro de trás, escuro e deslocado: a espessura da roda.
  L.push(P(anel(FUNDO_X * k, cy + FUNDO_Y * k, R + ARO * k, R + ARO * k, R - ARO * k, R - ARO * k), mad, { ...madeira(12, 0.62), arco: { cx: FUNDO_X * k, cy: cy + FUNDO_Y * k, r: R, a0: 0 } }))
  // Os raios, do cubo ao aro, e a treliça em zigue-zague entre o anel de dentro e o aro.
  const r2 = ANEL_DE_DENTRO * R
  for (let i = 0; i < RAIOS; i += 1) {
    const a = (i * 2 * Math.PI) / RAIOS
    const b = ((i + 1) * 2 * Math.PI) / RAIOS
    L.push(P(capsula(0, cy, R * Math.cos(a), cy + R * Math.sin(a), RAIO_DO_RAIO * k), mad, { ...madeira(20 + i, 0.92), eixo: a, bisel: 0.6 * k }))
    L.push(P(capsula(r2 * Math.cos(a), cy + r2 * Math.sin(a), R * Math.cos(b), cy + R * Math.sin(b), RAIO_DA_TRELICA * k), mad, { ...madeira(40 + i, 0.8), eixo: (a + b) / 2, bisel: 0.4 * k }))
  }
  L.push(P(anel(0, cy, r2 + ARO_DE_DENTRO * k, r2 + ARO_DE_DENTRO * k, r2 - ARO_DE_DENTRO * k, r2 - ARO_DE_DENTRO * k), mad, { ...madeira(60, 0.95), arco: { cx: 0, cy, r: r2, a0: 0 } }))
  // O aro da frente, claro, com o veio pela volta.
  L.push(P(anel(0, cy, R + ARO * k, R + ARO * k, R - ARO * k, R - ARO * k), mad, { ...madeira(61, 1.04), arco: { cx: 0, cy, r: R, a0: 0 }, tabua: 9 * k }))
  // O cubo: o ferro, o miolo de latão e os parafusos em volta.
  L.push(P(elipse(0, cy, CUBO * k, CUBO * k), FERRO, { bisel: 2.2 * k, contorno: 0.3, metal: 0.5, semente: 62 }))
  L.push(P(elipse(0, cy, MIOLO * k, MIOLO * k), LATAO, { bisel: 1.4 * k, contorno: 0.26, metal: 0.6, semente: 63 }))

  // O cavalete da frente: as duas pernas do cubo ao estrado, a travessa e o X embaixo dela.
  const travessaY = cy + (estrado - cy) * TRAVESSA
  const naPerna = (lado: number, y: number): number => (lado * pe * (y - cy)) / (estrado - cy)
  L.push(P(barra(naPerna(-1, travessaY) - 2 * k, travessaY, naPerna(1, travessaY) + 2 * k, travessaY, 3.4 * k), mad, { ...madeira(70, 0.9), eixo: 0 }))
  const xY = travessaY + (estrado - travessaY) * 0.92
  L.push(P(barra(naPerna(-1, travessaY), travessaY, naPerna(1, xY), xY, 2.2 * k), mad, { ...madeira(71, 0.82) }))
  L.push(P(barra(naPerna(1, travessaY), travessaY, naPerna(-1, xY), xY, 2.2 * k), mad, { ...madeira(72, 0.86) }))
  for (const lado of [-1, 1]) {
    L.push(P(barra(lado * 1.5 * k, cy, lado * pe, estrado + 1 * k, PERNA * k), mad, { ...madeira(73 + lado, lado < 0 ? 1.02 : 0.88), eixo: Math.atan2(estrado - cy, lado * pe), tabua: 0 }))
  }
  // O mancal por cima do encontro das pernas: o bloco de ferro e o eixo.
  L.push(P(caixa(-5 * k, cy - 3.6 * k, 5 * k, cy + 3.6 * k, 1.2 * k), FERRO, { bisel: 1 * k, contorno: 0.3, metal: 0.45, tom: 0.9, semente: 76 }))
  L.push(P(elipse(0, cy, 2.4 * k, 2.4 * k), LATAO, { bisel: 1 * k, contorno: 0.28, metal: 0.65, semente: 77 }))

  // O estrado de embarque: a beira de cima clara, a frente de tábuas de pé e a escadinha no meio.
  const x0 = -MEIA_LARGURA_DO_ESTRADO * c.hw
  const x1 = MEIA_LARGURA_DO_ESTRADO * c.hw
  L.push(P(caixa(x0, estrado + BEIRA_DO_ESTRADO * k, x1, chao, 0.8 * k), mad, { tabua: 6 * k, eixo: QUARTO, bisel: 0.8 * k, contorno: 0.3, tom: 0.78, semente: 80 }))
  L.push(P(caixa(x0 - 0.6 * k, estrado, x1 + 0.6 * k, estrado + BEIRA_DO_ESTRADO * k, 0.8 * k), mad, { tabua: 0, eixo: 0, bisel: 0.8 * k, contorno: 0.3, tom: 1.06, semente: 81 }))
  for (let d = 0; d < DEGRAUS; d += 1) {
    const y = estrado + (d + 1) * DEGRAU * k
    const meia = (6 + d * 2.5) * k
    L.push(P(caixa(-meia, y - 1.4 * k, meia, Math.min(chao, y + DEGRAU * k - 1.4 * k), 0.6 * k), mad, { tabua: 0, eixo: 0, bisel: 0.7 * k, contorno: 0.3, tom: 0.96 - d * 0.04, semente: 82 + d }))
  }

  // As cadeirinhas, penduradas pelo pino no aro: a haste, o toldinho, os dois paus, o banco e a faixa da cor.
  for (let i = 0; i < CADEIRINHAS; i += 1) {
    const a = (i * 2 * Math.PI) / CADEIRINHAS
    const px = R * Math.cos(a)
    const py = cy + R * Math.sin(a)
    const w = MEIA_CADEIRINHA * k
    const toldo = i % 2 === 0 ? c.m.pano : CREME
    const tToldo = py + (HASTE + TOLDO) * k
    L.push(P(capsula(px, py, px, py + HASTE * k + 1 * k, 0.7 * k), FERRO, { bisel: 0.4, contorno: 0.26, metal: 0.4, semente: 90 + i }))
    for (const lado of [-1, 1]) L.push(P(capsula(px + lado * (w - 1.6 * k), tToldo, px + lado * (w - 1.6 * k), py + BANCO_DE * k + 1, 0.55 * k), FERRO, { bisel: 0.3, contorno: 0.24, metal: 0.4, tom: 0.9, semente: 100 + i }))
    const arco: Forma = uniao(elipse(px, tToldo, w, TOLDO * k), caixa(px - w, tToldo - 0.1, px + w, tToldo + 1.4 * k))
    L.push(P(poligono([[px - w, tToldo], [px + w, tToldo], [px + w, tToldo + 1.4 * k], [px - w, tToldo + 1.4 * k]]), toldo, { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.8 }))
    L.push(P(dentroDoArco(arco, py + HASTE * k, tToldo + 1.4 * k), toldo, { tabua: 0, bisel: 1 * k, contorno: 0.28, ruga: 0.2, eixo: QUARTO, semente: 110 + i }))
    L.push(P(caixa(px - w + 0.6 * k, py + BANCO_DE * k, px + w - 0.6 * k, py + BANCO_ATE * k, 1.2 * k), mad, { tabua: 0, eixo: 0, bisel: 1 * k, contorno: 0.3, tom: 0.98, semente: 120 + i }))
    L.push(P(caixa(px - w + 2 * k, py + BANCO_DE * k + 1.2 * k, px + w - 2 * k, py + BANCO_DE * k + 3.2 * k, 0.6 * k), VAO, { tabua: 0, bisel: 0.4, contorno: 0.16, alfa: 0.75 }))
    L.push(P(caixa(px - w + 0.6 * k, py + (BANCO_ATE - 3) * k, px + w - 0.6 * k, py + (BANCO_ATE - 1.6) * k), toldo, { tabua: 0, bisel: 0.3, contorno: 0.18, tom: 0.92 }))
    L.push(P(elipse(px, py, 1.5 * k, 1.5 * k), LATAO, { bisel: 0.8 * k, contorno: 0.28, metal: 0.6, semente: 130 + i }))
  }
}

/** O toldinho: a cúpula (a metade de cima da elipse) entre o alto da haste e a barra de baixo. */
function dentroDoArco(arco: Forma, de: number, ate: number): Forma {
  return { b: [arco.b[0], de, arco.b[2], ate], d: (x, y) => Math.max(arco.d(x, y), de - y, y - ate) }
}
