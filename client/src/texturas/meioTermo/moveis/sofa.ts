/**
 * SOFÁ de cima com volume (móveis de casa, 28/10/2026): o estofado de taverna
 * ou de casa rica. O fundo (em cima) é o encosto alto e fofo, com a régua de
 * madeira por cima dele; dos lados, os dois braços redondos com a ponta de
 * madeira; no meio, uma almofada de assento por casa de comprimento (o sofá
 * estica e as almofadas acompanham, sem detalhe miúdo). A POLTRONA é o mesmo
 * estofado com uma almofada só e braços mais largos (`poltrona.ts`). A 25% de
 * zoom lê o "U" do encosto e dos braços em volta do assento. Materiais:
 * `tecido` (o estofado) e `madeira`.
 */
import { caixa, elipse } from './formas'
import { contato, type Cena } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** Alturas em casas: o assento, o braço e o encosto. */
const ALTURA_DO_ASSENTO = 0.45
const ALTURA_DO_BRACO = 0.62
const ALTURA_DO_ENCOSTO = 0.9

/**
 * O estofado: `larguraDoBraco` em fração da largura, `almofadas` no assento.
 * O sofá e a poltrona são este desenho com números diferentes.
 */
export function montarEstofado(c: ContextoDoMovel, cena: Cena, larguraDoBraco: number, almofadas: number): void {
  const { hw, hh, w, h, peca: P } = c
  const tecido = c.m.tecido
  const mad = c.m.madeira
  const R = Math.min(w, h)
  const fimDoEncosto = -hh + 0.3 * h
  const braco = larguraDoBraco * w
  const base = caixa(-hw, -hh, hw, hh, 0.12 * R)
  const encosto = caixa(-hw, -hh, hw, fimDoEncosto, 0.1 * R)
  const bracos = [caixa(-hw, -hh + 0.06 * h, -hw + braco, hh, 0.12 * R), caixa(hw - braco, -hh + 0.06 * h, hw, hh, 0.12 * R)]
  cena.sombras.push({ forma: base, z: c.g * ALTURA_DO_ASSENTO }, contato(base), { forma: encosto, z: c.g * ALTURA_DO_ENCOSTO })
  for (const b of bracos) cena.sombras.push({ forma: b, z: c.g * ALTURA_DO_BRACO })
  const L = cena.partes
  // O corpo por baixo de tudo (aparece nas frestas das almofadas), um pouco mais escuro.
  L.push(P(base, tecido, { bisel: 2, tom: 0.8, contorno: 0.2, semente: 741 }))
  // As almofadas do assento, entre os braços, da frente do encosto até a beira da frente.
  const x0 = -hw + braco
  const vao = (hw - braco - x0) / almofadas
  for (let i = 0; i < almofadas; i += 1) {
    const a = x0 + i * vao
    L.push(P(caixa(a + 0.6, fimDoEncosto - 1, a + vao - 0.6, hh - 0.05 * h, 0.14 * R), tecido, { bisel: 0.09 * R, ruga: 1, semente: 742 + i, projeta: { dist: 1, forca: 0.22 } }))
  }
  // O encosto fofo, a régua de madeira em cima dele e os braços com a ponta de madeira na frente.
  L.push(P(encosto, tecido, { bisel: 0.12 * R, ruga: 0.8, tom: 0.94, semente: 760, projeta: { dist: 2.2, forca: 0.3, suave: 1.6 } }))
  L.push(P(caixa(-hw + 0.5, -hh, hw - 0.5, -hh + 0.07 * h, 0.035 * R), mad, { tabua: 0, bisel: 0.9, semente: 761 }))
  for (const [i, b] of bracos.entries()) {
    L.push(P(b, tecido, { bisel: 0.1 * R, ruga: 0.6, semente: 762 + i, projeta: { dist: 1.6, forca: 0.28 } }))
    const xc = (b.b[0] + b.b[2]) / 2
    const rc = 0.36 * braco
    L.push(P(elipse(xc, hh - rc - 0.04 * h, rc, rc), mad, { tabua: 0, bisel: rc * 0.5, contorno: 0.2, semente: 764 + i }))
  }
}

export const montarSofa: MontarMovel = (c, cena) => {
  // Uma almofada por casa de comprimento, contando o que sobra dos braços.
  const almofadas = Math.max(1, Math.round((c.w * (1 - 2 * 0.11)) / c.g))
  montarEstofado(c, cena, 0.11, almofadas)
}
