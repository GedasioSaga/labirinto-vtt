import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { comAparenciaDoMovel, criarMovel, mesmaAparenciaDoMovel, movelComOutroTipo } from './mobilia'

/**
 * MT12: o pedido "Desenho" do painel (`desenho: 'linhas' | null`) e a troca
 * de tipo. Só os 11 móveis de antes guardam a versão em linhas; a peça nova
 * nem aceita o pedido nem herda o campo ao trocar de tipo.
 */

const GRADE = 50

function mesa(extra: Partial<Prop> = {}): Prop {
  return { ...criarMovel('mesa', { x: 100, y: 100 }, GRADE, 'mesa'), ...extra }
}

describe('comAparenciaDoMovel: o desenho', () => {
  it('linhas grava, null tira, e sem pedido o campo fica como estava', () => {
    const emLinhas = comAparenciaDoMovel(mesa(), { desenho: 'linhas' })
    expect(emLinhas.mobiliaDesenho).toBe('linhas')
    expect(comAparenciaDoMovel(emLinhas, { cor: '#8b6b47' }).mobiliaDesenho).toBe('linhas')
    expect('mobiliaDesenho' in comAparenciaDoMovel(emLinhas, { desenho: null })).toBe(false)
  })

  it('a peça nova não aceita linhas', () => {
    const redonda = criarMovel('mesaRedonda', { x: 100, y: 100 }, GRADE, 'r')
    expect('mobiliaDesenho' in comAparenciaDoMovel(redonda, { desenho: 'linhas' })).toBe(false)
  })

  it('mudar o desenho muda a aparência (o mapa ganha um passo de desfazer)', () => {
    expect(mesmaAparenciaDoMovel(mesa(), comAparenciaDoMovel(mesa(), { desenho: 'linhas' }))).toBe(false)
    expect(mesmaAparenciaDoMovel(mesa(), comAparenciaDoMovel(mesa(), { desenho: null }))).toBe(true)
  })
})

describe('movelComOutroTipo: o desenho em linhas', () => {
  it('fica entre os móveis de antes e sai ao virar peça nova', () => {
    const emLinhas = mesa({ mobiliaDesenho: 'linhas' })
    expect(movelComOutroTipo(emLinhas, 'cadeira', GRADE).mobiliaDesenho).toBe('linhas')
    expect('mobiliaDesenho' in movelComOutroTipo(emLinhas, 'mesaQuadrada', GRADE)).toBe(false)
  })
})
