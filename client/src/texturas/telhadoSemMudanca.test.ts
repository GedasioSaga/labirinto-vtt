import { describe, expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { pintarTelhado } from './telhado'

/**
 * O DESENHO DE HOJE NÃO MUDA (fatia MT6, palha): a palha é modelo NOVO e não
 * passa pela chave de obra, então telha e madeira têm de sair com os mesmos
 * bytes de antes dela. As digitais abaixo foram tiradas do código de ANTES da
 * MT6 (commit ee3ba7b2), sala retangular, sala em L e a miniatura do painel,
 * em 3 escalas, nas cores da paleta e numa cor livre.
 */

const p = (x: number, y: number): PontoDoTelhado => ({ x, y })
const RET = [p(40, 60), p(320, 60), p(320, 220), p(40, 220)]
const L = [p(0, 0), p(240, 0), p(240, 100), p(100, 100), p(100, 240), p(0, 240)]
const MINIATURA = [p(9, 9), p(57, 9), p(57, 37), p(9, 37)]

/** FNV-1a de 32 bits dos bytes: digital curta, igual em qualquer máquina para os mesmos bytes. */
function digital(bytes: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const CASOS: readonly { nome: string; poligono: readonly PontoDoTelhado[]; modelo: ModeloDoTeto; cor: string; escala: number }[] = [
  { nome: 'ret telhas barro 1x', poligono: RET, modelo: 'telhas', cor: PALETA_DO_TETO.telhas[0].hex, escala: 1 },
  { nome: 'ret telhas ardosia 3x', poligono: RET, modelo: 'telhas', cor: PALETA_DO_TETO.telhas[2].hex, escala: 3 },
  { nome: 'L telhas livre 2x', poligono: L, modelo: 'telhas', cor: '#3f7fbf', escala: 2 },
  { nome: 'ret madeira carvalho 1x', poligono: RET, modelo: 'madeira', cor: PALETA_DO_TETO.madeira[0].hex, escala: 1 },
  { nome: 'L madeira verde 3x', poligono: L, modelo: 'madeira', cor: PALETA_DO_TETO.madeira[5].hex, escala: 3 },
  { nome: 'ret madeira livre 2x', poligono: RET, modelo: 'madeira', cor: '#d8c8a0', escala: 2 },
  { nome: 'miniatura telhas 2x', poligono: MINIATURA, modelo: 'telhas', cor: PALETA_DO_TETO.telhas[0].hex, escala: 2 },
  { nome: 'miniatura madeira 2x', poligono: MINIATURA, modelo: 'madeira', cor: PALETA_DO_TETO.madeira[0].hex, escala: 2 },
]

/** Tiradas em ee3ba7b2, antes da palha. */
const ESPERADO: Readonly<Record<string, string>> = {
  'ret telhas barro 1x': '075a41e7',
  'ret telhas ardosia 3x': 'e88a956e',
  'L telhas livre 2x': '239308da',
  'ret madeira carvalho 1x': '802ca4a9',
  'L madeira verde 3x': 'b1ec9297',
  'ret madeira livre 2x': '763ed148',
  'miniatura telhas 2x': '5282b133',
  'miniatura madeira 2x': '1279567a',
}

describe('telhado de hoje, byte a byte (a palha não muda telha nem madeira)', () => {
  it('as digitais de telha e madeira são as de antes da MT6', () => {
    const atual = Object.fromEntries(CASOS.map((c) => [c.nome, digital(pintarTelhado(c.poligono, c.modelo, c.cor, c.escala).pixels)]))
    expect(atual).toEqual(ESPERADO)
  })
})
