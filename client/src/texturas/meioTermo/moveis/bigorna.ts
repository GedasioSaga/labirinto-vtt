/**
 * BIGORNA de ferro num TOCO, de cima com volume (29/10/2026). O toco redondo,
 * com a casca em volta e os anéis do corte aparecendo nas beiras; por cima,
 * a bigorna deitada ao comprido: o CHIFRE afinando para a esquerda, o degrau,
 * a MESA de aço polido (a parte mais clara, onde se bate), o calcanhar com o
 * furo quadrado e o furo redondo, e os quatro pés saindo por baixo. A 25% de
 * zoom sobra a silhueta da bigorna (o chifre em ponta e a mesa reta) sobre o
 * disco do toco: é o que diz "bigorna" e não "mesa". Materiais: `metal` (a
 * bigorna) e `madeira` (o toco); a casca é fixa, a da lenha de carvalho.
 */
import { caixa, elipse, poligono, uniao, type Ponto } from './formas'
import { contato, ruido, type Textura } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'

/** Alturas em casas: o topo do toco e o da mesa da bigorna. */
const ALTURA_DO_TOCO = 0.42
const ALTURA_DA_BIGORNA = 0.66

/** Os anéis do corte do toco, em volta do centro (cx, cy): faixas finas, um pouco tortas. */
function texAneis(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x - cx, y - cy) + ruido(x * 0.25, y * 0.25) * 0.8
    s[3] += Math.sin(d * 1.6) * 0.06 + ruido(x * 0.7, y * 0.7) * 0.04
  }
}

export const montarBigorna: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const ferro = c.m.metal
  const mad = c.m.madeira
  const casca = materialDaPeca('lenhaCarvalho')
  const X = (f: number): number => f * w
  const Y = (f: number): number => f * h
  // O toco: um disco que enche a altura da pegada, um pouco à direita (o chifre passa da beira dele).
  const tx = X(0.06)
  const rt = Math.min(Y(0.48), X(0.3))
  const toco = elipse(tx, 0, rt, rt)
  // A bigorna: o chifre em ponta, o degrau, a mesa e o calcanhar.
  const meiaMesa = Y(0.2)
  const xChifre = X(-0.48)
  const xDegrau = X(-0.2)
  const xMesa = X(-0.12)
  const xCalcanhar = X(0.38)
  const xFim = X(0.47)
  const chifre: Ponto[] = [
    [xDegrau, -meiaMesa * 0.9],
    [X(-0.3), -meiaMesa * 0.74],
    [X(-0.4), -meiaMesa * 0.44],
    [xChifre, Y(0.02)],
    [X(-0.4), meiaMesa * 0.4],
    [X(-0.3), meiaMesa * 0.7],
    [xDegrau, meiaMesa * 0.9],
  ]
  const formaChifre = poligono(chifre)
  const formaDegrau = caixa(xDegrau - 0.5, -meiaMesa * 0.88, xMesa + 0.5, meiaMesa * 0.88, 0.6)
  const formaMesa = caixa(xMesa, -meiaMesa, xCalcanhar, meiaMesa, 1)
  const formaCalcanhar = caixa(xCalcanhar - 0.5, -meiaMesa * 0.74, xFim, meiaMesa * 0.74, 1.2)
  const corpo = uniao(uniao(formaChifre, formaDegrau), uniao(formaMesa, formaCalcanhar))
  cena.sombras.push({ forma: toco, z: g * ALTURA_DO_TOCO }, { forma: corpo, z: g * ALTURA_DA_BIGORNA, forca: 0.3 }, contato(toco, 0.3))
  const L = cena.partes

  // O toco: a casca em volta e o corte com os anéis.
  L.push(P(toco, casca, { eixo: 0, bisel: rt * 0.25, contorno: 0.25, semente: 501 }))
  L.push(P(elipse(tx, 0, rt * 0.86, rt * 0.86), mad, { tabua: 0, bisel: 0.8, contorno: 0.15, textura: texAneis(tx, 0), semente: 502 }))
  // Os quatro pés, saindo por baixo da cintura.
  const pe = Y(0.1)
  for (const [px, py] of [[X(-0.1), -1], [X(-0.1), 1], [X(0.27), -1], [X(0.27), 1]] as const) {
    L.push(P(caixa(px - pe * 1.2, py * meiaMesa * 1.45 - pe * 0.7, px + pe * 1.2, py * meiaMesa * 1.45 + pe * 0.7, pe * 0.5), ferro, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.2, semente: 510 }))
  }
  // O corpo: o chifre (o metal cru, arredondado), o degrau mais baixo e a mesa polida.
  L.push(P(formaChifre, ferro, { tabua: 0, bisel: meiaMesa * 0.8, tom: 0.92, contorno: 0.25, semente: 520, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(formaDegrau, ferro, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.25, semente: 521 }))
  L.push(P(formaCalcanhar, ferro, { tabua: 0, bisel: 1.2, tom: 0.9, contorno: 0.25, semente: 522 }))
  L.push(P(formaMesa, ferro, { tabua: 0, bisel: 1.3, tom: 1.08, metal: 0.55, contorno: 0.25, semente: 523, projeta: { dist: 0.8, forca: 0.28 } }))
  // O furo quadrado (da talhadeira) e o redondo, no calcanhar da mesa.
  const lado = Math.max(1, meiaMesa * 0.32)
  const xFuro = X(0.33)
  L.push(P(caixa(xFuro - lado, -lado, xFuro + lado, lado, 0.3), BURACO, { bisel: 0.3, contorno: 0.1, recesso: { k: 0.8, forca: 0.3 }, semente: 530 }))
  L.push(P(elipse(X(0.24), 0, lado * 0.7, lado * 0.7), BURACO, { bisel: 0.3, contorno: 0.1, semente: 531 }))
}
