/**
 * LAJE TUMULAR ACESA (lote L06 de 24/11/2026, item 53: versão da laje tumular do lote L05, da capela da cripta do
 * mapa 8; desenho próprio, sem importar a outra, só combinando a pedra, a junta e o musgo). A lápide DEITADA, embutida
 * no piso e rente a ele, com a AMPULHETA no medalhão da cabeceira (o tempo que passa, sem símbolo de religião de
 * verdade), o friso duplo gravado em volta e o epitáfio gasto. Um CRISTALZINHO ciano rebentou a quina da cabeceira,
 * à direita: quatro lascas saem dela, a pedra em volta pega a luz fria e a luz corre um trecho pelo friso e pela trinca
 * que nasce ali. A luz é curta (a de verdade é do integrador, `LUZ_DOS_OBJETOS`).
 *
 * Objeto de CHÃO (`ehMovelDoChao`): a laje não faz sombra nem tem altura. Só as lascas de cristal são prismas em
 * fatias (`pedestalComCristal.ts`, o apoio do lote) e sobem um pouco na 3/4. Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; a junta, o musgo e o ciano são fixos. A cabeceira é o lado
 * de cima da pegada.
 */
import { hash } from '../../ruido'
import { anel, cadeia, caixa, dentroDe, elipse, menos, poligono, type Ponto } from './formas'
import { texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { novoFatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { banhada, CRISTAL, fatiarCristal, lascaDeRocha, MUSGO_DA_CRIPTA, ninhoDeCristais, sombraDoCristal, SOMBRA_PINTADA, texHaloFrio, type FonteFria } from './pedestalComCristal'

/** A junta em volta (px a partir da beira da pegada) e a laje dentro dela: as medidas da laje tumular do L05. */
const JUNTA = 1.4
const LAJE = 2.8
/** O friso duplo: o de fora e o de dentro (px a partir da beira da laje) e a meia largura de cada um. */
const FRISOS: readonly number[] = [4.4, 6.6]
const MEIO_FRISO = 0.42
/** A quina da cabeceira que o cristal rebentou (px). */
const QUINA = 6.6
/** O medalhão da ampulheta: o meio (px abaixo da cabeceira da laje) e o raio. */
const MEDALHAO = { y: 21, raio: 8.2 } as const
/** O epitáfio: as linhas, o passo (px) e a meia largura da mais comprida (fração da meia laje). */
const LINHAS = 4
const PASSO_DAS_LINHAS = 5.4
const LINHA_MAIS_LARGA = 0.62
/** Até onde a luz corre pelo friso e pela trinca a partir do cristal (px). */
const ALCANCE_DA_LUZ = 30
/** A junta: o escuro da pedra com pó, o da laje tumular do L05. */
const FUNDO_DA_JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x3c, 0x38] }
const SEMENTE = 5300

export const montarLajeTumularAcesa: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA

  const [x0, y0, x1, y1] = [-hw + LAJE, -hh + LAJE, hw - LAJE, hh - LAJE]
  // O cristalzinho na quina rebentada e a luz dele na pedra.
  const [nx, ny] = [x1 - QUINA * 0.34, y0 + QUINA * 0.34]
  const fontes: FonteFria[] = [{ x: nx, y: ny, r: 13, forca: 0.52 }]
  const naPedra = banhada(daPedra, fontes)
  const acesaAte = (alcance: number): Textura => texHaloFrio(nx, ny, alcance, alcance, 0.9)

  // A JUNTA, o halo curto e a LAJE com a quina da cabeceira rebentada.
  L.push(P(caixa(-hw + JUNTA, -hh + JUNTA, hw - JUNTA, hh - JUNTA, 1.4), FUNDO_DA_JUNTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.72, suave: 0.6, semente: SEMENTE }))
  L.push(P(elipse(nx - 2, ny + 2, 13, 13), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(nx - 2, ny + 2, 13, 13, 0.36), semente: SEMENTE + 1 }))
  const laje = poligono([[x0, y0], [x1 - QUINA, y0], [x1 - QUINA * 0.66, y0 + QUINA * 0.3], [x1 - QUINA * 0.42, y0 + QUINA * 0.62], [x1, y0 + QUINA], [x1, y1], [x0, y1]])
  L.push(P(laje, pedra, { tabua: 0, bisel: 1.1, tom: 0.9, contorno: 0.24, textura: naPedra, semente: SEMENTE + 2 }))
  // O miolo gasto pelos passos: mais claro e liso, sem borda.
  L.push(P(elipse(0, hh * 0.2, hw * 0.52, hh * 0.42), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.12, alfa: 0.22, suave: 7, semente: SEMENTE + 3 }))

  // O FRISO duplo gravado, e a luz fria que corre por ele perto do cristal.
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, recesso: { k: 0.6, forca: 0.32 } }
  FRISOS.forEach((d, k) => {
    const friso = dentroDe(menos(caixa(x0 + d - MEIO_FRISO, y0 + d - MEIO_FRISO, x1 - d + MEIO_FRISO, y1 - d + MEIO_FRISO, 0.6), caixa(x0 + d + MEIO_FRISO, y0 + d + MEIO_FRISO, x1 - d - MEIO_FRISO, y1 - d - MEIO_FRISO, 0.3)), laje)
    L.push(P(friso, pedra, { ...gravada, semente: SEMENTE + 4 + k }))
    L.push(P(dentroDe(friso, elipse(nx, ny, ALCANCE_DA_LUZ, ALCANCE_DA_LUZ)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: acesaAte(ALCANCE_DA_LUZ * (k === 0 ? 1 : 0.8)), semente: SEMENTE + 6 + k }))
  })

  // O MEDALHÃO da cabeceira: o anel em relevo e a AMPULHETA (as duas tampas, os dois bojos e a areia que caiu).
  const cy = y0 + MEDALHAO.y
  const r = MEDALHAO.raio
  const relevo = { tabua: 0, bisel: 0.5, contorno: 0.18, projeta: { dist: 0.5, forca: 0.2 } }
  L.push(P(anel(0, cy, r, r, r - 1.5, r - 1.5), pedra, { ...relevo, tom: 1.06, textura: naPedra, semente: SEMENTE + 10 }))
  const [meia, alto] = [r * 0.44, r * 0.56]
  L.push(P(poligono([[-meia, cy - alto], [meia, cy - alto], [0.55, cy], [meia, cy + alto], [-meia, cy + alto], [-0.55, cy]]), pedra, { ...relevo, bisel: 0.7, tom: 1.1, textura: naPedra, semente: SEMENTE + 11 }))
  for (const lado of [-1, 1]) L.push(P(caixa(-meia - 0.9, cy + lado * (alto + 0.75) - 0.6, meia + 0.9, cy + lado * (alto + 0.75) + 0.6, 0.3), pedra, { ...relevo, tom: 1.12, semente: SEMENTE + 12 }))
  // A areia: o bojo de cima quase vazio (rebaixado), o monte no de baixo.
  L.push(P(poligono([[-meia * 0.62, cy - alto * 0.72], [meia * 0.62, cy - alto * 0.72], [0, cy - alto * 0.1]]), pedra, { ...gravada, tom: 0.56, semente: SEMENTE + 13 }))
  L.push(P(poligono([[-meia * 0.66, cy + alto * 0.78], [0, cy + alto * 0.3], [meia * 0.66, cy + alto * 0.78]]), pedra, { ...gravada, tom: 0.7, recesso: { k: 0.4, forca: 0.2 }, semente: SEMENTE + 14 }))
  // Os quatro raios curtos gravados em volta do medalhão.
  for (let k = 0; k < 4; k += 1) {
    const a = Math.PI / 4 + (k * Math.PI) / 2
    L.push(P(cadeia([[Math.cos(a) * (r + 1.6), cy + Math.sin(a) * (r + 1.6)], [Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4)]], 0.4), pedra, { ...gravada, semente: SEMENTE + 15 + k }))
  }

  // O EPITÁFIO gasto: cada linha em palavras de comprimentos diferentes, algumas quase apagadas, e a linha das datas.
  const meiaLaje = (x1 - x0) / 2
  const yTexto = cy + r + 9
  for (let i = 0; i < LINHAS; i += 1) {
    const largura = meiaLaje * LINHA_MAIS_LARGA * (i === 0 ? 0.58 : 0.8 + 0.2 * hash(i, 1, SEMENTE))
    const y = yTexto + i * PASSO_DAS_LINHAS
    let x = -largura
    let p = 0
    while (x < largura - 1.5) {
      const palavra = Math.min(largura - x, 2.6 + 5.6 * hash(i, p, SEMENTE + 1))
      L.push(P(caixa(x, y - 0.55, x + palavra, y + 0.55, 0.3), pedra, { ...gravada, alfa: hash(i, p, SEMENTE + 2) < 0.28 ? 0.35 : 0.85, semente: SEMENTE + 20 + i * 9 + p }))
      x += palavra + 1.7
      p += 1
    }
  }
  const yDatas = Math.min(yTexto + LINHAS * PASSO_DAS_LINHAS + 3.6, y1 - 11)
  L.push(P(caixa(-9, yDatas - 0.55, -2, yDatas + 0.55, 0.3), pedra, { ...gravada, alfa: 0.8, semente: SEMENTE + 60 }))
  L.push(P(caixa(2, yDatas - 0.55, 9, yDatas + 0.55, 0.3), pedra, { ...gravada, alfa: 0.6, semente: SEMENTE + 61 }))
  L.push(P(poligono([[0, yDatas - 1], [0.9, yDatas], [0, yDatas + 1], [-0.9, yDatas]]), pedra, { ...gravada, semente: SEMENTE + 62 }))

  // As TRINCAS que nascem na quina rebentada: a comprida desce a laje, a curta corre para a esquerda; a luz vaza perto.
  const trincas: readonly (readonly Ponto[])[] = [
    [[x1 - QUINA * 0.5, y0 + QUINA * 0.6], [x1 - 6.4, y0 + 12], [x1 - 4.2, y0 + 19], [x1 - 9.4, y0 + 27], [x1 - 7, y0 + 36], [x1 - 13, y0 + 44], [x1 - 11.4, y0 + 52]],
    [[x1 - QUINA * 0.7, y0 + QUINA * 0.4], [x1 - 13, y0 + 3.2], [x1 - 19, y0 + 5.4], [x1 - 25, y0 + 3.6]],
    [[x1 - 9.4, y0 + 27], [x1 - 15.6, y0 + 30.4], [x1 - 18, y0 + 35]],
  ]
  trincas.forEach((pontos, k) => {
    L.push(P(dentroDe(cadeia(pontos, k === 2 ? 0.26 : 0.36), laje), pedra, { tabua: 0, bisel: 0, tom: 0.42, contorno: 0, semente: SEMENTE + 70 + k }))
    if (k < 2) L.push(P(dentroDe(cadeia(pontos, 0.19), laje), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: acesaAte(ALCANCE_DA_LUZ * 0.86), semente: SEMENTE + 74 + k }))
  })

  // O MUSGO na junta e no friso.
  const musgo = { tabua: 0, bisel: 0.3, contorno: 0.08, alfa: 0.58, suave: 0.9 }
  L.push(P(elipse(-hw + 2.1, -hh * 0.2, 1.6, 5.2), MUSGO_DA_CRIPTA, { ...musgo, semente: SEMENTE + 80 }))
  L.push(P(elipse(hw - 2, hh * 0.46, 1.5, 4.4), MUSGO_DA_CRIPTA, { ...musgo, alfa: 0.5, semente: SEMENTE + 81 }))
  L.push(P(elipse(hw * 0.24, hh - 2.1, 6.2, 1.5), MUSGO_DA_CRIPTA, { ...musgo, alfa: 0.55, semente: SEMENTE + 82 }))
  L.push(P(elipse(x0 + FRISOS[0] + 0.4, y1 - FRISOS[0] - 3.4, 1.1, 3), MUSGO_DA_CRIPTA, { ...musgo, alfa: 0.45, semente: SEMENTE + 83 }))

  // O CRISTALZINHO: quatro lascas na quina, com a rocha rebentada no pé e a sombra curta.
  const lascas = ninhoDeCristais({ cx: nx, cy: ny, raio: 4, alto: 0.24 * g, quantos: 4, de: Math.PI * 0.25, ate: Math.PI * 1.05, tombo: 0.62, semente: SEMENTE + 90 })
  lascas.forEach((cr, k) => {
    // A sombra é pintada na laje (a do chão ficaria debaixo dela).
    L.push(P(sombraDoCristal(cr, f.q), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 0.9, semente: SEMENTE + 88 + k }))
    L.push(P(lascaDeRocha(cr, SEMENTE + 91 + k), pedra, { tabua: 0, bisel: 0.6, tom: 0.8 + 0.1 * k, contorno: 0.24, textura: naPedra, semente: SEMENTE + 94 + k }))
    fatiarCristal(f, 0, 0.3, cr, SEMENTE + 97 + k)
  })
  f.fechar()
}
