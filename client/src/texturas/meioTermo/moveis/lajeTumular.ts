/**
 * LAJE TUMULAR (lote L05 de 24/11/2026, item 44, da capela da cripta do mapa 8; desenho próprio, só a ideia do
 * objeto): a lápide DEITADA, embutida no piso e rente a ele (`ehMovelDoChao`): não faz sombra. A laje fica um pouco
 * ABAIXO do piso: a JUNTA em volta é um vão escuro, a sombra da beira de cima e da esquerda cai para dentro dela
 * (o recesso), e o pó do chão entra pela quina partida do pé, à direita. Na laje, o friso gravado em volta, na
 * cabeceira a CAVEIRA ALADA em relevo baixo (o lembrete da morte das lajes antigas, sem símbolo de religião de
 * verdade, com três penas de cada lado varridas para trás), embaixo dela o EPITÁFIO gasto e ilegível (palavras de
 * comprimentos bem diferentes, duas linhas quase apagadas) e a linha curta das datas. O miolo é mais claro e liso,
 * gasto pelos passos; a TRINCA curta sai da quina partida. A cabeceira é o lado de cima da pegada.
 *
 * Revisão do diretor de arte (24/11): o friso claro da beira (o chanfro) fazia a laje parecer um tampo solto, como o
 * topo do túmulo de pedra; a trinca atravessava a laje em preto e vencia a caveira; o epitáfio em traços regulares
 * parecia código Morse; as asas liam como bigode.
 *
 * Rente ao chão, a 3/4 é a mesma vista de cima. Material: `pedra`; a junta, o pó e o musgo são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, dentroDe, elipse, elipseGirada, menos, poligono, type Ponto } from './formas'
import type { MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** A junta em volta (px a partir da beira da pegada) e a laje dentro dela: o vão tem 1,8 px. */
const JUNTA = 1
const LAJE = 2.8
/** A sombra da beira de cima e da esquerda dentro da laje (px) e a força dela. */
const RECESSO = { k: 1.5, forca: 0.42 } as const
/** O friso gravado: o lado de fora e a largura dele (px a partir da beira da laje). */
const FRISO = 5
const LARGURA_DO_FRISO = 1.3
/** A quina partida do pé, à direita (px). */
const QUINA = 5.4
/**
 * O EPITÁFIO: cada linha é a lista dos comprimentos das palavras (px) e o alfa dela; a 1 e a 3 estão quase apagadas.
 * Comprimentos bem diferentes e vãos sorteados: com palavras parecidas e passo regular a linha virava código Morse.
 */
const EPITAFIO: readonly { readonly palavras: readonly number[]; readonly alfa: number }[] = [
  { palavras: [6.4, 10.2], alfa: 0.85 },
  { palavras: [3.4, 8.6, 2.2, 6.8, 5.2], alfa: 0.35 },
  { palavras: [9.6, 3, 6.2, 8.4], alfa: 0.85 },
  { palavras: [5, 2.6, 7.8, 4.4], alfa: 0.35 },
  { palavras: [7.2, 4.6, 9], alfa: 0.8 },
]
const PASSO_DAS_LINHAS = 5.2
/** As penas de cada asa: a raiz (px do meio da caveira, y a partir do meio dela), a meia grossura e a ponta. */
const PENAS: readonly { readonly raiz: Ponto; readonly meia: number; readonly ponta: Ponto; readonly tom: number }[] = [
  { raiz: [6.4, -2.4], meia: 1.25, ponta: [18.2, -5.8], tom: 1.06 },
  { raiz: [6.5, -0.2], meia: 1.15, ponta: [16, -3.2], tom: 1.02 },
  { raiz: [6.4, 2], meia: 1.05, ponta: [13.8, -0.6], tom: 0.98 },
]
/** A junta: o escuro da pedra com pó, quase opaco (o vão entre a laje e o piso). */
const FUNDO_DA_JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x3c, 0x38] }
/** O pó do chão que entra pela quina partida: um cinza-terra claro, meio transparente (no vão escuro ele aparece). */
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xa8, 0x94] }
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarLajeTumular: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA

  // A JUNTA e a LAJE afundada (sem chanfro claro na beira, com a sombra de cima e da esquerda caindo para dentro), com
  // a quina do pé partida (a junta aparece nela).
  L.push(P(caixa(-hw + JUNTA, -hh + JUNTA, hw - JUNTA, hh - JUNTA, 1.4), FUNDO_DA_JUNTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.9, suave: 0.6, semente: 4400 }))
  const [x0, y0, x1, y1] = [-hw + LAJE, -hh + LAJE, hw - LAJE, hh - LAJE]
  const laje = poligono([[x0, y0], [x1, y0], [x1, y1 - QUINA], [x1 - QUINA * 0.3, y1 - QUINA * 0.62], [x1 - QUINA * 0.62, y1 - QUINA * 0.5], [x1 - QUINA, y1], [x0, y1]])
  L.push(P(laje, pedra, { tabua: 0, bisel: 0.35, tom: 0.9, contorno: 0.22, recesso: RECESSO, semente: 4401 }))
  // O miolo gasto pelos passos: mais claro e liso, sem borda.
  L.push(P(elipse(0, hh * 0.12, hw * 0.52, hh * 0.46), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.12, alfa: 0.22, suave: 7, semente: 4402 }))

  // O FRISO gravado em volta.
  const fora = caixa(x0 + FRISO, y0 + FRISO, x1 - FRISO, y1 - FRISO, 0.6)
  const dentro = caixa(x0 + FRISO + LARGURA_DO_FRISO, y0 + FRISO + LARGURA_DO_FRISO, x1 - FRISO - LARGURA_DO_FRISO, y1 - FRISO - LARGURA_DO_FRISO, 0.3)
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, recesso: { k: 0.6, forca: 0.32 } }
  L.push(P(menos(fora, dentro), pedra, { ...gravada, alfa: 0.8, semente: 4403 }))

  // A CAVEIRA ALADA da cabeceira: as asas (três penas de cada lado, compridas e varridas para trás, a 1 px do crânio;
  // a de cima por cima das outras), o crânio e o queixo, as órbitas, o nariz e a fresta dos dentes rebaixados.
  const cy = y0 + 18
  const relevo = { tabua: 0, bisel: 0.5, contorno: 0.18, projeta: { dist: 0.5, forca: 0.2 } }
  for (const lado of [-1, 1]) {
    for (let k = PENAS.length - 1; k >= 0; k -= 1) {
      const { raiz, meia, ponta, tom } = PENAS[k]
      const [bx, by] = [lado * raiz[0], cy + raiz[1]]
      const [tx, ty] = [lado * ponta[0], cy + ponta[1]]
      const [mx, my] = [bx + (tx - bx) * 0.45, by + (ty - by) * 0.45]
      const pena: Ponto[] = [[bx, by - meia], [mx, my - meia * 0.7], [tx, ty], [mx, my + meia * 0.55], [bx, by + meia]]
      L.push(P(poligono(pena), pedra, { ...relevo, tom, semente: 4410 + k + (lado > 0 ? 4 : 0) }))
    }
  }
  L.push(P(caixa(-3, cy + 2.4, 3, cy + 5.8, 1.3), pedra, { ...relevo, bisel: 0.8, tom: 1.04, semente: 4420 }))
  L.push(P(elipse(0, cy - 0.6, 5.2, 4.7), pedra, { ...relevo, bisel: 1.3, tom: 1.1, projeta: { dist: 0.6, forca: 0.22 }, semente: 4421 }))
  for (const lado of [-1, 1]) L.push(P(elipse(lado * 2.05, cy - 0.3, 1.35, 1.5), pedra, { ...gravada, tom: 0.5, recesso: { k: 0.8, forca: 0.36 }, semente: 4422 }))
  L.push(P(poligono([[0, cy + 1.2], [0.8, cy + 2.6], [-0.8, cy + 2.6]]), pedra, { ...gravada, tom: 0.52, semente: 4423 }))
  L.push(P(caixa(-2.2, cy + 3.9, 2.2, cy + 4.5, 0.2), pedra, { ...gravada, tom: 0.56, semente: 4424 }))

  // O EPITÁFIO gasto: cada linha centrada, com as palavras e os vãos dela; numa linha legível, uma palavra ou outra
  // também se apagou.
  const yTexto = cy + 13
  EPITAFIO.forEach(({ palavras, alfa }, i) => {
    const vaos = palavras.slice(1).map((_, p) => 1.5 + 0.9 * hash(i, p, 4434))
    const largura = palavras.reduce((s, w) => s + w, 0) + vaos.reduce((s, v) => s + v, 0)
    const y = yTexto + i * PASSO_DAS_LINHAS
    let x = -largura / 2
    palavras.forEach((w, p) => {
      const sumida = alfa > 0.5 && hash(i, p, 4432) < 0.22
      L.push(P(caixa(x, y - 0.55, x + w, y + 0.55, 0.3), pedra, { ...gravada, alfa: sumida ? 0.4 : alfa, semente: 4433 + i * 9 + p }))
      x += w + (vaos[p] ?? 0)
    })
  })
  const yDatas = yTexto + EPITAFIO.length * PASSO_DAS_LINHAS + 3.4
  L.push(P(caixa(-9.5, yDatas - 0.55, -2, yDatas + 0.55, 0.3), pedra, { ...gravada, alfa: 0.8, semente: 4480 }))
  L.push(P(caixa(2, yDatas - 0.55, 9.5, yDatas + 0.55, 0.3), pedra, { ...gravada, alfa: 0.6, semente: 4481 }))
  L.push(P(elipse(0, yDatas, 0.7, 0.7), pedra, { ...gravada, semente: 4482 }))

  // A TRINCA curta: uma reta quebrada que sai da quina partida e corre um terço da largura, no tom da pedra gasta.
  const trinca: Ponto[] = [[x1 - QUINA * 0.62, y1 - QUINA * 0.5], [x1 - 7, y1 - 6.6], [x1 - 10.1, y1 - 6], [x1 - 14.8, y1 - 10.8], [x1 - 19.8, y1 - 13.1]]
  L.push(P(dentroDe(cadeia(trinca, 0.3), laje), pedra, { tabua: 0, bisel: 0, tom: 0.6, alfa: 0.7, contorno: 0, semente: 4490 }))

  // O PÓ do chão entrando pela quina partida, na diagonal, da quina para dentro; e o MUSGO na junta.
  L.push(P(dentroDe(elipseGirada(x1 - QUINA * 0.55, y1 - QUINA * 0.5, 6.4, 2.8, Math.PI / 4), caixa(-hw + 1.2, -hh + 1.2, hw - 1.2, hh - 1.2)), PO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 2, semente: 4494 }))
  const musgo = { tabua: 0, bisel: 0.3, contorno: 0.08, alfa: 0.6, suave: 0.9, semente: 4495 }
  L.push(P(elipse(-hw + 2.2, hh * 0.5, 1.7, 5.4), MUSGO, musgo))
  L.push(P(elipse(hw - 2, -hh * 0.36, 1.5, 4.2), MUSGO, { ...musgo, alfa: 0.5, semente: 4496 }))
  L.push(P(elipse(-hw * 0.3, hh - 2.1, 6, 1.5), MUSGO, { ...musgo, alfa: 0.55, semente: 4497 }))
}
