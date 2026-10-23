/**
 * CAMA (catre) de cima com volume (`objetos.js:1065-1109`): a armação, o
 * lençol amassado, o travesseiro, o cobertor com a dobra, o pé e a cabeceira
 * com os postes (a cabeceira por último: fica por cima e faz sombra no
 * travesseiro). Materiais: `madeira`, `cobertor` e `travesseiro` (os 3 campos
 * de cor de hoje).
 */
import { caixa } from './formas'
import { contato } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

export const montarCatre: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const zM = c.g * 0.34
  const zH = c.g * 0.72
  const zF = c.g * 0.44
  const yCab = -hh + 0.075 * h
  const yPe = hh - 0.05 * h
  const beira = 0.07 * w
  const poste = 0.13 * w
  cena.sombras.push(
    { forma: caixa(-hw, -hh, hw, hh, 1.5), z: zM },
    { forma: caixa(-hw, -hh, hw, yCab), z: zH },
    { forma: caixa(-hw, yPe, hw, hh), z: zF },
    contato(caixa(-hw, -hh, hw, hh, 1.5)),
  )
  const L = cena.partes
  L.push(P(caixa(-hw, -hh, hw, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, semente: 34 }))
  L.push(P(caixa(-hw + beira, yCab, hw - beira, yPe, 2), LENCOL, { bisel: 2.4, ruga: 1.2, semente: 35 }))
  const yTr = yCab + 1.5
  L.push(P(caixa(-hw + 0.12 * w, yTr, hw - 0.12 * w, yTr + 0.16 * h, 4), c.m.travesseiro, { bisel: 0.07 * h, ruga: 1.5, semente: 36, projeta: { dist: 1.6, forca: 0.3, suave: 1.2 } }))
  const yDobra = -hh + 0.42 * h
  L.push(P(caixa(-hw + beira * 0.6, yDobra, hw - beira * 0.6, yPe + 0.5, 2), c.m.cobertor, { bisel: 2.6, ruga: 2.2, eixo: QUARTO, semente: 37, projeta: { dist: 1.2, forca: 0.28 } }))
  L.push(P(caixa(-hw + beira * 0.6 - 0.3, yDobra - 0.5, hw - beira * 0.6 + 0.3, yDobra + 0.075 * h, 2), c.m.cobertor, { tom: 1.1, bisel: 2.4, ruga: 1, semente: 38, projeta: { dist: 1.4, forca: 0.34 } }))
  L.push(P(caixa(-hw, yPe, hw, hh, 1), mad, { tabua: 0, bisel: 1.2, semente: 41 }))
  for (const x0 of [-hw, hw - poste]) L.push(P(caixa(x0, hh - poste, x0 + poste, hh, 1.5), mad, { tabua: 0, bisel: 2.4, semente: 42 }))
  L.push(P(caixa(-hw, -hh, hw, yCab, 1), mad, { tabua: 0, bisel: 1.3, semente: 32, projeta: { dist: 3.2, forca: 0.32, suave: 1.6 } }))
  for (const x0 of [-hw, hw - poste]) L.push(P(caixa(x0, -hh, x0 + poste, -hh + poste, 1.5), mad, { tabua: 0, bisel: 2.4, semente: 33 }))
}
