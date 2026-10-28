/**
 * GELADEIRA de cima com volume (móveis de casa, 28/10/2026): a CAIXA DE GELO
 * de madeira da época, um armário alto. A frente é o lado de baixo. Por cima, a
 * moldura de tábuas e a tampa forrada de zinco, de onde se põe o gelo, com o
 * fecho de latão; na beira da frente, os dois trincos grandes das portas. O
 * zinco frio no meio da madeira quente é o que separa a geladeira do armário
 * e do baú a 25% de zoom; a sombra comprida diz que ela é alta. Materiais:
 * `madeira` e `ferragens`.
 */
import { caixa } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Altura da geladeira em casas (mais alta que o armário de baixo, menos que o de cima). */
const ALTURA = 1.45
/** O zinco da tampa: cinza claro puxado para o frio, sem saturar (HSV ~0,1). */
const ZINCO: MaterialDaPeca = { classe: 'metal', rgb: [0x98, 0xa2, 0xa6] }

export const montarGeladeira: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const R = Math.min(w, h)
  const corpo = caixa(-hw, -hh, hw, hh, 1.2)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA }, contato(corpo))
  const L = cena.partes
  L.push(P(corpo, mad, { tabua: 6.5, bisel: 1.4, semente: 621 }))
  // A tampa de zinco, um pouco funda na moldura, com a borda de madeira em volta.
  const mx = 0.2 * w
  const topo = -hh + 0.2 * h
  const base = hh - 0.32 * h
  L.push(P(caixa(-hw + mx - 1.2, topo - 1.2, hw - mx + 1.2, base + 1.2, 1.4), mad, { tabua: 0, bisel: 1, tom: 0.86, semente: 622 }))
  L.push(P(caixa(-hw + mx, topo, hw - mx, base, 0.9), ZINCO, { bisel: 0.9, recesso: { k: 1.6, forca: 0.24 }, contorno: 0.15, metal: 0.18, semente: 623 }))
  // O fecho da tampa, no meio da beira da frente dela.
  L.push(P(caixa(-0.06 * w, base - 0.6, 0.06 * w, base + 0.09 * h, 0.6), fer, { bisel: 0.8, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
  // Os trincos das duas portas, saindo da beira da frente como os puxadores do armário.
  for (const sx of [-1, 1]) {
    const xc = sx * 0.3 * w
    L.push(P(caixa(xc - 0.05 * R, hh - 0.16 * h, xc + 0.05 * R, hh + 1.2, 0.6), fer, { bisel: 0.8, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
  }
}
