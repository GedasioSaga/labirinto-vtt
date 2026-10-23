/**
 * BAÚ de cima com volume (`objetos.js:997-1063`). De Frente: a tampa em arco
 * com duas cintas, os rebites, as cantoneiras e o fecho com o buraco da
 * fechadura. De Lado: o corpo, a tampa em arco com a cinta de ferro e a alça.
 * Materiais: `madeira` e `ferragens`.
 */
import { anel, caixa, dentroDe, elipse, poligono, uniao } from './formas'
import { contato, type Cena, type CurvaY } from './motor'
import { BURACO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura do baú de lado, em px do protótipo (a sombra). */
const ALTURA_DE_LADO = 12

function montarBauDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const costura = -hh + h * 0.4
  const raio = costura + hh
  const corpo = caixa(-hw, costura, hw, hh, 0.6)
  const arco = dentroDe(elipse(0, costura, hw, raio), caixa(-hw, -hh - 1, hw, costura + 0.5))
  sombraDeLado(cena, uniao(corpo, arco), ALTURA_DE_LADO)
  const L = cena.partes
  L.push(P(corpo, mad, { tabua: (hh - costura) / 3, bisel: 0.9, semente: 8 }))
  L.push(P(arco, mad, { tabua: raio / 2, bisel: 1, semente: 9 }))
  L.push(P(dentroDe(anel(0, costura, hw, raio, hw - 2.4, raio - 2.4), caixa(-hw, -hh - 1, hw, costura)), fer, { bisel: 0.8, contorno: 0.25 }))
  L.push(P(caixa(-hw, costura - 0.4, hw, costura + 1.6, 0.3), fer, { bisel: 0.6, tom: 0.92 }))
  const ya = costura + (hh - costura) * 0.5
  L.push(P(caixa(-3.4, ya - 3.4, 3.4, ya - 1.6, 0.5), fer, { bisel: 0.6 }))
  L.push(P(anel(0, ya + 0.2, 3.1, 3.1, 1.9, 1.9), fer, { bisel: 0.6, projeta: { dist: 0.8, forca: 0.3 } }))
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    L.push(P(poligono([[xa, hh], [xa - sx * 5, hh], [xa, hh - 5]]), fer, { bisel: 0.6 }))
  }
}

/** A tampa vista de cima: tábuas em arco, as duas cintas com rebites e as quatro cantoneiras. */
function tampa(c: ContextoDoMovel, cena: Cena, arco: CurvaY): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const L = cena.partes
  L.push(P(caixa(-hw, -hh, hw, hh, 2), mad, { tabua: h / 4, bisel: 1.2, curvaY: arco, semente: 2 }))
  for (const sx of [-1, 1]) {
    const xc = sx * 0.3 * w
    L.push(P(caixa(xc - 0.045 * w, -hh, xc + 0.045 * w, hh, 0.5), fer, { bisel: 0.8, curvaY: arco, projeta: { dist: 0.8, forca: 0.25, suave: 0.7 }, semente: 3 + sx }))
    for (const fy of [-0.32, 0, 0.32]) L.push(P(elipse(xc, fy * h, 0.9, 0.9), fer, { bisel: 0.9, contorno: 0.1, tom: 0.9 }))
  }
  const cw = 0.13 * w
  const ch = 0.2 * h
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xa = sx * hw
    const ya = sy * hh
    L.push(P(poligono([[xa, ya], [xa - sx * cw, ya], [xa, ya - sy * ch]]), fer, { bisel: 0.7, curvaY: arco, contorno: 0.2 }))
  }
}

export const montarBau: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarBauDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const H = c.g * 0.55
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 2), z: H }, contato(caixa(-hw, -hh, hw, hh, 2)))
  tampa(c, cena, { c: 0, r: hh, forca: 0.55 })
  // Fecho na frente, com o buraco da fechadura.
  cena.partes.push(P(caixa(-0.065 * w, hh - 0.26 * h, 0.065 * w, hh + 0.6, 0.8), c.m.ferragens, { bisel: 0.9, projeta: { dist: 0.9, forca: 0.3 } }))
  cena.partes.push(P(elipse(0, hh - 0.12 * h, 0.75, 1.15), BURACO, { bisel: 0, contorno: 0 }))
}
