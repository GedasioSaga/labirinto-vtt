/**
 * As MESAS DE ANTES do pedido de 24/10/2026 ("a mesa parece um móvel, não uma
 * mesa"), copiadas como estavam em `mesa.ts`, `mesaQuadrada.ts` e
 * `mesaRedonda.ts` (main `6eb1466d`): o "antes" da folha de contato das mesas
 * e o CONTROLE POSITIVO dos testes de leitura (a mesa antiga tem de reprovar
 * nos mesmos testes que a nova passa).
 *
 * Só para teste: nenhum código do app importa isto.
 */
import { ehMaterial } from '../materiais'
import { caixa, elipse } from './formas'
import { contato, criarPecas, pintarCena, type Cena, type LimitesDaImagem } from './motor'
import { G, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'
import type { DesenhoDoMovel } from './index'

const montarMesaAntiga: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const H = c.g * 0.5
  const ponta = 0.06 * w
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.5), z: H, solta: true })
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (hw - 0.065 * w)
    const ly = sy * (hh - 0.1 * h)
    cena.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
  }
  cena.partes.push(P(caixa(-hw + ponta, -hh, hw - ponta, hh, 0), mad, { tabua: h / 4.2, bisel: 1.2, semente: 50 }))
  cena.partes.push(P(caixa(-hw, -hh, -hw + ponta, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 51 }))
  cena.partes.push(P(caixa(hw - ponta, -hh, hw, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 52 }))
}

const montarMesaQuadradaAntiga: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const H = c.g * 0.5
  const ponta = 0.08 * w
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.5), z: H, solta: true })
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (hw - 0.1 * w)
    const ly = sy * (hh - 0.1 * h)
    cena.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
  }
  cena.partes.push(P(caixa(-hw + ponta, -hh, hw - ponta, hh, 0), mad, { tabua: h / 4.2, bisel: 1.2, semente: 60 }))
  cena.partes.push(P(caixa(-hw, -hh, -hw + ponta, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 61 }))
  cena.partes.push(P(caixa(hw - ponta, -hh, hw, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 62 }))
}

const montarMesaRedondaAntiga: MontarMovel = (c, cena) => {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const H = c.g * 0.5
  cena.sombras.push({ forma: elipse(0, 0, hw, hh), z: H, solta: true })
  for (const a of [0.25, 0.75, 1.25, 1.75]) {
    const lx = Math.cos(a * Math.PI) * hw * 0.62
    const ly = Math.sin(a * Math.PI) * hh * 0.62
    cena.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
  }
  cena.partes.push(P(elipse(0, 0, hw, hh), mad, { tabua: h / 4.6, bisel: 2, semente: 70 }))
}

export type TipoDeMesa = 'mesa' | 'mesaQuadrada' | 'mesaRedonda'

const ANTIGAS: Readonly<Record<TipoDeMesa, MontarMovel>> = {
  mesa: montarMesaAntiga,
  mesaQuadrada: montarMesaQuadradaAntiga,
  mesaRedonda: montarMesaRedondaAntiga,
}

export function ehMesa(tipo: string): tipo is TipoDeMesa {
  return tipo === 'mesa' || tipo === 'mesaQuadrada' || tipo === 'mesaRedonda'
}

/** O contexto que `montarCena` (`index.ts`) daria a uma mesa: o único lugar de material é a madeira. */
export function contextoDaMesa(d: DesenhoDoMovel): ContextoDoMovel {
  const w = d.casasW * G
  const h = d.casasH * G
  const id = d.materiais[0]
  const madeira = id !== undefined && ehMaterial(id) ? id : 'carvalho'
  return { w, h, hw: w / 2, hh: h / 2, g: G, lado: d.lado, m: { madeira: materialDaPeca(madeira) }, peca: criarPecas(d.semente), forma: 'retangular', curva: 0, variante: 0, giro: 0 }
}

/** A mesa de ANTES, pintada pelo mesmo motor, com a mesma semente e o mesmo material. */
export function pintarMesaAntiga(d: DesenhoDoMovel, S: number): { limites: LimitesDaImagem; pixels: Uint8ClampedArray } {
  if (!ehMesa(d.tipo)) throw new Error(`${d.tipo} não é mesa`)
  const cena: Cena = { partes: [], sombras: [] }
  ANTIGAS[d.tipo](contextoDaMesa(d), cena)
  return pintarCena(cena, S)
}
