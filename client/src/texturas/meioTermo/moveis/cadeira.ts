/**
 * CADEIRA de cima com volume (`objetos.js:1143-1206`). De Frente: o assento
 * (de palha na moldura ou de tábuas), o encosto com os dois postes e a sombra
 * de cada perna. De Lado: o L do encosto e do assento, a perna e a travessa.
 * Materiais: `madeira` e `assento` (palha, ou a madeira da própria cadeira).
 */
import { caixa, menos, uniao } from './formas'
import { contato, type Cena, type OpcoesDaPeca } from './motor'
import { QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura da cadeira de lado, em px do protótipo (a sombra). */
const ALTURA_DE_LADO = 10

function montarAssento(c: ContextoDoMovel, cena: Cena, o: OpcoesDaPeca, x0: number, y0: number, x1: number, y1: number): void {
  const P = c.peca
  const mad = c.m.madeira
  if (c.m.assento.classe === 'palha') {
    const m = Math.min(x1 - x0, y1 - y0) * 0.16
    cena.partes.push(P(menos(caixa(x0, y0, x1, y1, 1.4), caixa(x0 + m, y0 + m, x1 - m, y1 - m)), mad, { ...o, tabua: 0, bisel: 0.9, semente: 61 }))
    cena.partes.push(P(caixa(x0 + m, y0 + m, x1 - m, y1 - m, 0.4), c.m.assento, { ...o, bisel: 0.7, recesso: { k: 1.2, forca: 0.3 }, contorno: 0.1, semente: 62 }))
    return
  }
  cena.partes.push(P(caixa(x0, y0, x1, y1, 1.4), mad, { ...o, tabua: (y1 - y0) / 2, bisel: 1.1, semente: 61 }))
}

function montarCadeiraDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const fimEncosto = -hw + w * 0.2
  const topoAss = -hh + h * 0.5
  const baseAss = topoAss + h * 0.14
  const recuo = (w * 0.2) / 2
  const poste = caixa(-hw, -hh, fimEncosto, hh, 1)
  const sentar = caixa(fimEncosto - 0.5, topoAss, hw, baseAss, 1)
  const perna = caixa(hw - recuo - 1.8, baseAss - 0.5, hw - recuo + 1.8, hh, 0.6)
  sombraDeLado(cena, uniao(uniao(poste, sentar), perna), ALTURA_DE_LADO)
  const L = cena.partes
  L.push(P(caixa(fimEncosto - 0.5, hh - 9, hw - recuo, hh - 7.2, 0.3), mad, { tabua: 0, bisel: 0.5, tom: 0.82, semente: 72 }))
  L.push(P(perna, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, semente: 73 }))
  L.push(P(poste, mad, { eixo: QUARTO, tabua: 0, bisel: 1, semente: 74 }))
  L.push(P(sentar, mad, { tabua: 0, bisel: 1, semente: 75 }))
  if (c.m.assento.classe === 'palha') L.push(P(caixa(fimEncosto, topoAss - 1.6, hw - 1.4, topoAss + 0.6, 0.6), c.m.assento, { bisel: 0.6, contorno: 0.1 }))
}

export const montarCadeira: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarCadeiraDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const zS = c.g * 0.27
  const zE = c.g * 0.62
  const yAss = -hh + 0.18 * h
  const yTrilho = -hh + 0.16 * h
  const posteL = 0.18 * w
  cena.sombras.push({ forma: caixa(-hw, yAss, hw, hh, 1.4), z: zS, solta: true }, { forma: caixa(-hw, -hh, hw, yTrilho, 1.2), z: zE, solta: true })
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (hw - 2.2)
    const ly = sy * (hh - 2.2)
    cena.sombras.push(contato(caixa(lx - 1.8, ly - 1.8, lx + 1.8, ly + 1.8), 0.3), { forma: caixa(lx - 1.6, ly - 1.6, lx + 1.6, ly + 1.6), z: sy < 0 ? zE : zS, forca: 0.24 })
  }
  montarAssento(c, cena, {}, -hw, yAss, hw, hh)
  cena.partes.push(P(caixa(-hw, -hh, hw, yTrilho, 1.2), mad, { tabua: 0, bisel: 1.2, semente: 63, projeta: { dist: (zE - zS) * 0.3, forca: 0.32, suave: 1.4 } }))
  for (const x0 of [-hw, hw - posteL]) cena.partes.push(P(caixa(x0, -hh, x0 + posteL, -hh + 0.2 * h, 1.2), mad, { tabua: 0, bisel: 1.6, semente: 64 }))
}
