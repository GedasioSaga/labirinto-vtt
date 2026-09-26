/**
 * MOEDAS E TROCA, lado do RECORTE: a bolsa (`Token.moedas`) só chega ao DONO
 * da ficha, e só como inteiro válido. A ficha do colega, a do NPC e a que o
 * mestre escondeu não levam bolsa nenhuma — nem o número, nem a chave.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 700
/** Valor que só o mestre conhece: se aparecer no recorte, vazou. */
const BOLSA_DO_MESTRE = 777_123

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y: 100, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'Porto', 30, 10, 50), tokens }
}

/** Duda é dona de "arco" e "mula"; Beto, de "lanca". */
const posse = { duda: ['arco', 'mula'], beto: ['lanca'] }

function recorteDaDuda(tokens: Token[]): Token[] {
  return filterMapForPlayer(mapaCom(tokens), 'duda', posse, RAIO).map.tokens
}

describe('recorte: a bolsa só chega ao dono', () => {
  it('a Duda lê a própria bolsa; a do colega e a do NPC não chegam', () => {
    const recebidas = recorteDaDuda([
      ficha('arco', 100, { moedas: 12 }),
      ficha('lanca', 200, { moedas: BOLSA_DO_MESTRE }),
      ficha('npc', 300, { npc: true, moedas: BOLSA_DO_MESTRE }),
    ])
    expect(recebidas.map((t) => t.id).sort()).toEqual(['arco', 'lanca', 'npc'])
    expect(recebidas.find((t) => t.id === 'arco')?.moedas).toBe(12)
    for (const outra of recebidas.filter((t) => t.id !== 'arco')) expect('moedas' in outra).toBe(false)
    expect(JSON.stringify(recebidas)).not.toContain(String(BOLSA_DO_MESTRE))
  })

  it('a ficha da Duda que o mestre escondeu não chega, e com ela a bolsa', () => {
    const recebidas = recorteDaDuda([ficha('arco', 100, { moedas: 3 }), ficha('mula', 200, { hidden: true, moedas: BOLSA_DO_MESTRE })])
    expect(recebidas.map((t) => t.id)).toEqual(['arco'])
    expect(JSON.stringify(recebidas)).not.toContain(String(BOLSA_DO_MESTRE))
  })

  it('bolsa torta na própria ficha (negativa, quebrada, texto) não viaja; zero viaja como zero', () => {
    const tortas: unknown[] = [-5, 2.5, '9', Number.NaN]
    for (const torta of tortas) {
      const arco = ficha('arco', 100)
      Reflect.set(arco, 'moedas', torta) // valor fora do tipo, como viria de arquivo editado à mão
      const [recebida] = recorteDaDuda([arco])
      expect(recebida?.id).toBe('arco')
      expect(recebida !== undefined && 'moedas' in recebida).toBe(false)
    }
    const [vazia] = recorteDaDuda([ficha('arco', 100, { moedas: 0 })])
    expect(vazia?.id).toBe('arco')
    expect(vazia?.moedas ?? 0).toBe(0)
    // Ficha de antes das moedas (sem o campo): continua sem ele, sem migração.
    const [antiga] = recorteDaDuda([ficha('arco', 100)])
    expect(antiga?.id).toBe('arco')
    expect(antiga !== undefined && 'moedas' in antiga).toBe(false)
  })
})
