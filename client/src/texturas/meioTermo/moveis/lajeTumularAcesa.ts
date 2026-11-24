/**
 * LAJE TUMULAR ACESA (lote L06 de 24/11/2026, item 53: versão da laje tumular do lote L05, da capela da cripta do
 * mapa 8; desenho próprio, sem importar a outra, só combinando a pedra, a junta e o musgo). A lápide DEITADA, embutida
 * no piso e rente a ele, com a AMPULHETA no medalhão da cabeceira (o tempo que passa, sem símbolo de religião de
 * verdade), o friso duplo gravado em volta e o epitáfio gasto. Um NINHO DE CRISTAL ciano (0,3 casa, cinco lascas em
 * leque) rebentou a quina da cabeceira, à direita, e é ele que a separa da laje do item 44: a LUZ CORRE pelo friso
 * duplo por 40% do comprimento da laje a partir da quina, acende a trinca inteira que nasce ali e deixa um halo de
 * meia casa em volta. A luz é curta (a de verdade é do integrador, `LUZ_DOS_OBJETOS`).
 *
 * Objeto de CHÃO (`ehMovelDoChao`): a laje não faz sombra nem tem altura. Só as lascas de cristal são prismas em
 * fatias (`pedestalComCristal.ts`, o apoio do lote) e sobem um pouco na 3/4. Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; a junta, o musgo e o ciano são fixos. A cabeceira é o lado
 * de cima da pegada.
 *
 * Revisão do diretor de arte (24/11/2026): o cristal sumia a 50% (era uma pontinha) e a luz não aparecia na grade;
 * o musgo passava para fora da junta (agora fica preso dentro dela) e o contorno duplo escuro da junta, que fazia a
 * laje parecer porta embutida, clareou um tom.
 */
import { hash, limitar01 } from '../../ruido'
import { anel, cadeia, caixa, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { novoFatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { banhada, CIANO, CRISTAL, fatiarCristal, lascaDeRocha, MUSGO, MUSGO_DA_CRIPTA, musgoPreso, ninhoDeCristais, sombraDoCristal, SOMBRA_PINTADA, texHaloFrio, type FonteFria } from './pedestalComCristal'

/** A junta em volta (px a partir da beira da pegada) e a laje dentro dela: as medidas da laje tumular do L05. */
const JUNTA = 1.4
const LAJE = 2.8
/** O friso duplo: o de fora e o de dentro (px a partir da beira da laje) e a meia largura de cada um. */
const FRISOS: readonly number[] = [4.4, 6.6]
const MEIO_FRISO = 0.42
/** A quina da cabeceira que o cristal rebentou (px). */
const QUINA = 10
/** O ninho da quina: o raio (0,3 casa de ponta a ponta), a altura do maior (casas) e quantas lascas. */
const NINHO = { raio: 0.15, alto: 0.25, quantos: 5 } as const
/** O medalhão da ampulheta: o meio (px abaixo da cabeceira da laje) e o raio. */
const MEDALHAO = { y: 23, raio: 8.2 } as const
/** O epitáfio: as linhas, o passo (px) e a meia largura da mais comprida (fração da meia laje). */
const LINHAS = 4
const PASSO_DAS_LINHAS = 5.4
const LINHA_MAIS_LARGA = 0.62
/**
 * A LUZ que corre pelo friso a partir da quina: até onde vai acesa inteira e onde apaga (fração do comprimento da
 * laje: 40%), e o halo em volta da quina (casas).
 */
const LUZ_NO_FRISO = { cheia: 0.3, apaga: 0.42 } as const
const HALO = { raio: 0.5, alfa: 0.4 } as const
/** A junta: o pó claro de pedra, um tom acima do da laje do L05 (com o escuro de lá a laje lia como porta embutida). */
const FUNDO_DA_JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x57, 0x51] }
const SEMENTE = 5300

export const montarLajeTumularAcesa: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA

  const [x0, y0, x1, y1] = [-hw + LAJE, -hh + LAJE, hw - LAJE, hh - LAJE]
  const comprimento = y1 - y0
  // O ninho na quina rebentada e a luz dele na pedra.
  const [nx, ny] = [x1 - QUINA * 0.42, y0 + QUINA * 0.42]
  const fontes: FonteFria[] = [{ x: nx, y: ny, r: 0.34 * g, forca: 0.5 }]
  const naPedra = banhada(daPedra, fontes)
  /** A luz que corre: acesa inteira até `cheia` do comprimento, apagando até `apaga`; `ganho` estica o alcance (a trinca). */
  const correndo = (ganho: number): Textura => (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x - nx, y - ny) / (comprimento * ganho)
    s[0] = CIANO.claro[0]
    s[1] = CIANO.claro[1]
    s[2] = CIANO.claro[2]
    s[4] = 1
    s[5] = 0.92 * (1 - limitar01((d - LUZ_NO_FRISO.cheia) / (LUZ_NO_FRISO.apaga - LUZ_NO_FRISO.cheia)))
  }

  // O halo de meia casa em volta da quina (no piso), a JUNTA e a LAJE com a quina da cabeceira rebentada.
  const rHalo = HALO.raio * g
  L.push(P(elipse(nx, ny, rHalo, rHalo), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(nx, ny, rHalo, rHalo, HALO.alfa), semente: SEMENTE + 1 }))
  const junta = caixa(-hw + JUNTA, -hh + JUNTA, hw - JUNTA, hh - JUNTA, 1.4)
  L.push(P(junta, FUNDO_DA_JUNTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.62, suave: 0.6, semente: SEMENTE }))
  const laje = poligono([[x0, y0], [x1 - QUINA, y0], [x1 - QUINA * 0.72, y0 + QUINA * 0.22], [x1 - QUINA * 0.58, y0 + QUINA * 0.5], [x1 - QUINA * 0.3, y0 + QUINA * 0.62], [x1 - QUINA * 0.2, y0 + QUINA * 0.86], [x1, y0 + QUINA], [x1, y1], [x0, y1]])
  L.push(P(laje, pedra, { tabua: 0, bisel: 1.1, tom: 0.92, contorno: 0.16, textura: naPedra, semente: SEMENTE + 2 }))
  // O miolo gasto pelos passos: mais claro e liso, sem borda.
  L.push(P(elipse(0, hh * 0.2, hw * 0.52, hh * 0.42), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.12, alfa: 0.22, suave: 7, semente: SEMENTE + 3 }))

  // O FRISO duplo gravado, e a LUZ fria que corre por ele a partir da quina.
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.64, recesso: { k: 0.6, forca: 0.32 } }
  FRISOS.forEach((d, k) => {
    const friso = dentroDe(menos(caixa(x0 + d - MEIO_FRISO, y0 + d - MEIO_FRISO, x1 - d + MEIO_FRISO, y1 - d + MEIO_FRISO, 0.6), caixa(x0 + d + MEIO_FRISO, y0 + d + MEIO_FRISO, x1 - d - MEIO_FRISO, y1 - d - MEIO_FRISO, 0.3)), laje)
    L.push(P(friso, pedra, { ...gravada, semente: SEMENTE + 4 + k }))
    L.push(P(friso, CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: correndo(k === 0 ? 1 : 0.9), semente: SEMENTE + 6 + k }))
  })

  // O MEDALHÃO da cabeceira: o anel em relevo e a AMPULHETA (as duas tampas, os dois bojos e a areia que caiu).
  const cy = y0 + MEDALHAO.y
  const r = MEDALHAO.raio
  const mx = -2.4
  const relevo = { tabua: 0, bisel: 0.5, contorno: 0.18, projeta: { dist: 0.5, forca: 0.2 } }
  L.push(P(anel(mx, cy, r, r, r - 1.5, r - 1.5), pedra, { ...relevo, tom: 1.06, textura: naPedra, semente: SEMENTE + 10 }))
  const [meia, alto] = [r * 0.44, r * 0.56]
  L.push(P(poligono([[mx - meia, cy - alto], [mx + meia, cy - alto], [mx + 0.55, cy], [mx + meia, cy + alto], [mx - meia, cy + alto], [mx - 0.55, cy]]), pedra, { ...relevo, bisel: 0.7, tom: 1.1, textura: naPedra, semente: SEMENTE + 11 }))
  for (const lado of [-1, 1]) L.push(P(caixa(mx - meia - 0.9, cy + lado * (alto + 0.75) - 0.6, mx + meia + 0.9, cy + lado * (alto + 0.75) + 0.6, 0.3), pedra, { ...relevo, tom: 1.12, semente: SEMENTE + 12 }))
  // A areia: o bojo de cima quase vazio (rebaixado), o monte no de baixo.
  L.push(P(poligono([[mx - meia * 0.62, cy - alto * 0.72], [mx + meia * 0.62, cy - alto * 0.72], [mx, cy - alto * 0.1]]), pedra, { ...gravada, tom: 0.56, semente: SEMENTE + 13 }))
  L.push(P(poligono([[mx - meia * 0.66, cy + alto * 0.78], [mx, cy + alto * 0.3], [mx + meia * 0.66, cy + alto * 0.78]]), pedra, { ...gravada, tom: 0.7, recesso: { k: 0.4, forca: 0.2 }, semente: SEMENTE + 14 }))
  // Os quatro raios curtos gravados em volta do medalhão.
  for (let k = 0; k < 4; k += 1) {
    const a = Math.PI / 4 + (k * Math.PI) / 2
    L.push(P(cadeia([[mx + Math.cos(a) * (r + 1.6), cy + Math.sin(a) * (r + 1.6)], [mx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4)]], 0.4), pedra, { ...gravada, semente: SEMENTE + 15 + k }))
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

  // As TRINCAS que nascem na quina rebentada: a comprida desce a laje e fica ACESA inteira; a curta corre para a
  // esquerda; a terceira é um galho da comprida, já sem luz.
  const trincas: readonly (readonly Ponto[])[] = [
    [[x1 - QUINA * 0.44, y0 + QUINA * 0.56], [x1 - 8.4, y0 + 14], [x1 - 5.6, y0 + 22], [x1 - 10.6, y0 + 30], [x1 - 8, y0 + 39], [x1 - 13.6, y0 + 47], [x1 - 11.6, y0 + 56], [x1 - 15, y0 + 62]],
    [[x1 - QUINA * 0.7, y0 + QUINA * 0.3], [x1 - 15.4, y0 + 3.4], [x1 - 21.6, y0 + 5.6], [x1 - 27.4, y0 + 3.4]],
    [[x1 - 10.6, y0 + 30], [x1 - 16.6, y0 + 33.6], [x1 - 19, y0 + 38.4]],
  ]
  trincas.forEach((pontos, k) => {
    // A fenda afina da quina para a ponta; o galho já nasce fino.
    for (let i = 1; i < pontos.length; i += 1) {
      const fina = k === 2 ? 0.4 : 1 - 0.5 * ((i - 1) / Math.max(1, pontos.length - 2))
      const trecho = [pontos[i - 1], pontos[i]]
      L.push(P(dentroDe(cadeia(trecho, 0.8 * fina), laje), pedra, { tabua: 0, bisel: 0, tom: 0.4, contorno: 0, semente: SEMENTE + 70 + k }))
      // A comprida vai acesa até o fim (o alcance é esticado até a ponta dela); a curta, pelo comprimento que tem.
      if (k < 2) L.push(P(dentroDe(cadeia(trecho, 0.36 * fina + 0.06), laje), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: correndo(k === 0 ? 1.7 : 1), semente: SEMENTE + 74 + k }))
    }
  })

  // O MUSGO: dentro da junta, rente à beira da laje, e num canto do friso. Preso ao lugar, nada passa do contorno.
  const naJunta: Forma = menos(junta, laje)
  L.push(P(musgoPreso(elipse(-hw + 2.1, -hh * 0.2, 1.6, 5.2), naJunta, 0.2), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.2, contorno: 0.06, alfa: 0.6, suave: 0.4, semente: SEMENTE + 80 }))
  L.push(P(musgoPreso(elipse(hw - 2, hh * 0.46, 1.5, 4.4), naJunta, 0.2), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.2, contorno: 0.06, alfa: 0.54, suave: 0.4, semente: SEMENTE + 81 }))
  L.push(P(musgoPreso(elipse(hw * 0.24, hh - 2.1, 6.2, 1.5), naJunta, 0.2), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.2, contorno: 0.06, alfa: 0.58, suave: 0.4, semente: SEMENTE + 82 }))
  L.push(P(musgoPreso(elipse(x0 + FRISOS[0] + 0.4, y1 - FRISOS[0] - 3.4, 1.1, 3), laje), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.3, contorno: 0.08, alfa: 0.45, semente: SEMENTE + 83 }))

  // O NINHO: cinco lascas em leque abrindo da quina para DENTRO da laje (nenhuma passa da pegada), com a rocha
  // rebentada no pé e a sombra curta.
  const lascas = ninhoDeCristais({ cx: nx, cy: ny, raio: NINHO.raio * g, alto: NINHO.alto * g, quantos: NINHO.quantos, de: Math.PI * 0.34, ate: Math.PI * 1.16, tombo: 0.42, pende: [-0.12, 0.1], gordura: 0.4, semente: SEMENTE + 90 })
  lascas.forEach((cr, k) => {
    // A sombra é pintada na laje (a do chão ficaria debaixo dela).
    L.push(P(sombraDoCristal(cr, f.q), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.22, suave: 0.9, semente: SEMENTE + 88 + k }))
    L.push(P(lascaDeRocha(cr, SEMENTE + 91 + k), pedra, { tabua: 0, bisel: 0.6, tom: 0.8 + 0.08 * k, contorno: 0.24, textura: naPedra, semente: SEMENTE + 94 + k }))
    fatiarCristal(f, 0, 0.3, cr, SEMENTE + 97 + k)
  })
  f.fechar()
}
