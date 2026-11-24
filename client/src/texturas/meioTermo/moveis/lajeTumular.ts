/**
 * LAJE TUMULAR (lote L05 de 24/11/2026, item 44, da capela da cripta do mapa 8; desenho próprio, só a ideia do
 * objeto): a lápide DEITADA, embutida no piso e rente a ele (`ehMovelDoChao`): não faz sombra, só a JUNTA escura em
 * volta, onde o pó e o musgo juntam. Na laje, o friso gravado em volta, na cabeceira a CAVEIRA ALADA em relevo baixo
 * (o lembrete da morte das lajes antigas, sem símbolo de religião de verdade), embaixo dela o EPITÁFIO gasto e
 * ilegível (linhas de palavras rebaixadas, algumas quase sumidas) e a linha curta das datas. O miolo é mais claro e
 * liso, gasto pelos passos; uma TRINCA com um galho atravessa o terço do pé, e a quina do pé, à direita, é partida.
 * A cabeceira é o lado de cima da pegada.
 *
 * Rente ao chão, a 3/4 é a mesma vista de cima. Material: `pedra`; a junta e o musgo são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, elipseGirada, menos, poligono, type Ponto } from './formas'
import type { MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** A junta em volta (px a partir da beira da pegada) e a laje dentro dela. */
const JUNTA = 1.4
const LAJE = 2.8
/** O friso gravado: o lado de fora e a largura dele (px a partir da beira da laje). */
const FRISO = 5
const LARGURA_DO_FRISO = 1.3
/** A quina partida do pé, à direita (px). */
const QUINA = 5.4
/** As linhas do epitáfio: quantas, o passo entre elas (px) e a meia largura da mais comprida (fração da meia laje). */
const LINHAS = 5
const PASSO_DAS_LINHAS = 5.2
const LINHA_MAIS_LARGA = 0.66
/** A junta: o escuro da pedra com pó, meio transparente (o chão aparece um pouco). */
const FUNDO_DA_JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x3c, 0x38] }
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarLajeTumular: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA

  // A JUNTA e a LAJE, com a quina do pé partida (a junta aparece nela).
  L.push(P(caixa(-hw + JUNTA, -hh + JUNTA, hw - JUNTA, hh - JUNTA, 1.4), FUNDO_DA_JUNTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.72, suave: 0.6, semente: 4400 }))
  const [x0, y0, x1, y1] = [-hw + LAJE, -hh + LAJE, hw - LAJE, hh - LAJE]
  const laje = poligono([[x0, y0], [x1, y0], [x1, y1 - QUINA], [x1 - QUINA * 0.3, y1 - QUINA * 0.62], [x1 - QUINA * 0.62, y1 - QUINA * 0.5], [x1 - QUINA, y1], [x0, y1]])
  L.push(P(laje, pedra, { tabua: 0, bisel: 1.1, tom: 0.9, contorno: 0.24, semente: 4401 }))
  // O miolo gasto pelos passos: mais claro e liso, sem borda.
  L.push(P(elipse(0, hh * 0.12, hw * 0.52, hh * 0.46), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.12, alfa: 0.22, suave: 7, semente: 4402 }))

  // O FRISO gravado em volta.
  const fora = caixa(x0 + FRISO, y0 + FRISO, x1 - FRISO, y1 - FRISO, 0.6)
  const dentro = caixa(x0 + FRISO + LARGURA_DO_FRISO, y0 + FRISO + LARGURA_DO_FRISO, x1 - FRISO - LARGURA_DO_FRISO, y1 - FRISO - LARGURA_DO_FRISO, 0.3)
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, recesso: { k: 0.6, forca: 0.32 } }
  L.push(P(menos(fora, dentro), pedra, { ...gravada, semente: 4403 }))

  // A CAVEIRA ALADA da cabeceira: as asas (quatro penas de cada lado, abrindo para cima), o crânio e o queixo,
  // as órbitas, o nariz e a fresta dos dentes rebaixados.
  const cy = y0 + 18
  const relevo = { tabua: 0, bisel: 0.5, contorno: 0.18, projeta: { dist: 0.5, forca: 0.2 } }
  for (const lado of [-1, 1]) {
    for (let k = 0; k < 4; k += 1) {
      const x = lado * (6.2 + k * 2.7)
      const y = cy + 0.6 - k * 1.1 + k * k * 0.16
      L.push(P(elipseGirada(x, y, 4.3 - k * 0.45, 1.4 - k * 0.08, lado * (-0.3 - k * 0.2)), pedra, { ...relevo, tom: 1.02 + k * 0.02, semente: 4410 + k + (lado > 0 ? 4 : 0) }))
    }
  }
  L.push(P(caixa(-3, cy + 2.4, 3, cy + 5.8, 1.3), pedra, { ...relevo, bisel: 0.8, tom: 1.04, semente: 4420 }))
  L.push(P(elipse(0, cy - 0.6, 5.2, 4.7), pedra, { ...relevo, bisel: 1.3, tom: 1.1, projeta: { dist: 0.6, forca: 0.22 }, semente: 4421 }))
  for (const lado of [-1, 1]) L.push(P(elipse(lado * 2.05, cy - 0.3, 1.35, 1.5), pedra, { ...gravada, tom: 0.5, recesso: { k: 0.8, forca: 0.36 }, semente: 4422 }))
  L.push(P(poligono([[0, cy + 1.2], [0.8, cy + 2.6], [-0.8, cy + 2.6]]), pedra, { ...gravada, tom: 0.52, semente: 4423 }))
  L.push(P(caixa(-2.2, cy + 3.9, 2.2, cy + 4.5, 0.2), pedra, { ...gravada, tom: 0.56, semente: 4424 }))

  // O EPITÁFIO gasto: cada linha em palavras de comprimentos diferentes, algumas quase apagadas.
  const meia = (x1 - x0) / 2
  const yTexto = cy + 13
  for (let i = 0; i < LINHAS; i += 1) {
    const largura = meia * LINHA_MAIS_LARGA * (i === 0 ? 0.62 : 0.8 + 0.2 * hash(i, 1, 4430))
    const y = yTexto + i * PASSO_DAS_LINHAS
    let x = -largura
    let p = 0
    while (x < largura - 1.5) {
      const palavra = Math.min(largura - x, 2.6 + 6 * hash(i, p, 4431))
      const apagada = hash(i, p, 4432) < 0.28
      L.push(P(caixa(x, y - 0.55, x + palavra, y + 0.55, 0.3), pedra, { ...gravada, alfa: apagada ? 0.35 : 0.85, semente: 4433 + i * 9 + p }))
      x += palavra + 1.7
      p += 1
    }
  }
  const yDatas = yTexto + LINHAS * PASSO_DAS_LINHAS + 3.4
  L.push(P(caixa(-9.5, yDatas - 0.55, -2, yDatas + 0.55, 0.3), pedra, { ...gravada, alfa: 0.8, semente: 4480 }))
  L.push(P(caixa(2, yDatas - 0.55, 9.5, yDatas + 0.55, 0.3), pedra, { ...gravada, alfa: 0.6, semente: 4481 }))
  L.push(P(elipse(0, yDatas, 0.7, 0.7), pedra, { ...gravada, semente: 4482 }))

  // A TRINCA do terço do pé, com um galho.
  const trinca: Ponto[] = [[x0 + 0.6, y1 - 24], [x0 + 7, y1 - 20.6], [x0 + 12.4, y1 - 21.8], [x0 + 19, y1 - 16.4], [x0 + 26, y1 - 15.2], [x1 - 0.6, y1 - 10.2]]
  L.push(P(cadeia(trinca, 0.34), pedra, { tabua: 0, bisel: 0, tom: 0.42, contorno: 0, semente: 4490 }))
  L.push(P(cadeia([[x0 + 12.4, y1 - 21.8], [x0 + 14.8, y1 - 27.6], [x0 + 18.2, y1 - 30]], 0.25), pedra, { tabua: 0, bisel: 0, tom: 0.48, contorno: 0, semente: 4491 }))

  // O MUSGO na junta e no friso.
  const musgo = { tabua: 0, bisel: 0.3, contorno: 0.08, alfa: 0.6, suave: 0.9, semente: 4495 }
  L.push(P(elipse(-hw + 2.2, hh * 0.5, 1.7, 5.4), MUSGO, musgo))
  L.push(P(elipse(hw - 2, -hh * 0.36, 1.5, 4.2), MUSGO, { ...musgo, alfa: 0.5, semente: 4496 }))
  L.push(P(elipse(-hw * 0.3, hh - 2.1, 6, 1.5), MUSGO, { ...musgo, alfa: 0.55, semente: 4497 }))
  L.push(P(elipse(x1 - FRISO - 0.6, y1 - FRISO - 3, 1.1, 3.2), MUSGO, { ...musgo, alfa: 0.45, semente: 4498 }))
  L.push(P(elipse(x1 - QUINA * 0.5, y1 - QUINA * 0.4, 2.6, 2), MUSGO, { ...musgo, alfa: 0.5, semente: 4499 }))
}
