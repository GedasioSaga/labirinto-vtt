import { describe, expect, it } from 'vitest'
import { criarMovel, ehTipoMobilia, propMobiliaFromFile, ROTULO_MOBILIA, TIPOS_MOBILIA, tracosDoGlifo } from './mobilia'
import type { Prop } from '../types/map'

/**
 * MOBÍLIA DESENHADA — o catálogo (catre, mesa, baú), o móvel que o painel da
 * sala põe no mapa e o glifo de cada tipo, tudo sem Pixi.
 */

const GRADE = 40

describe('catálogo da mobília', () => {
  it('tem catre, mesa e baú, com o nome que o painel mostra', () => {
    expect([...TIPOS_MOBILIA]).toEqual(['catre', 'mesa', 'bau'])
    expect(ROTULO_MOBILIA).toEqual({ catre: 'Catre', mesa: 'Mesa', bau: 'Baú' })
  })

  it('reconhece só os tipos do catálogo', () => {
    expect(ehTipoMobilia('catre')).toBe(true)
    expect(ehTipoMobilia('bau')).toBe(true)
    expect(ehTipoMobilia('dragão')).toBe(false)
    expect(ehTipoMobilia(undefined)).toBe(false)
    expect(ehTipoMobilia(3)).toBe(false)
  })
})

describe('criarMovel — o móvel que o painel da sala põe', () => {
  it('é um objeto sem imagem, com o tipo, no centro pedido e do tamanho padrão em casas da grade', () => {
    const catre = criarMovel('catre', { x: 250, y: 300 }, GRADE, 'movel-1')
    expect(catre).toEqual({ id: 'movel-1', src: '', x: 250, y: 300, width: GRADE, height: 2 * GRADE, linkedMapPath: null, mobilia: 'catre' })
  })

  it('a mesa é deitada (mais larga que alta) e o baú é menor que uma casa de altura', () => {
    const mesa = criarMovel('mesa', { x: 0, y: 0 }, GRADE, 'm')
    expect(mesa.width).toBe(2 * GRADE)
    expect(mesa.height).toBe(GRADE)
    const bau = criarMovel('bau', { x: 0, y: 0 }, GRADE, 'b')
    expect(bau.width).toBe(GRADE)
    expect(bau.height).toBeGreaterThan(0)
    expect(bau.height).toBeLessThan(GRADE)
  })
})

describe('tracosDoGlifo — os traços finos dentro da silhueta', () => {
  it('cada tipo tem um desenho próprio, não vazio', () => {
    const catre = tracosDoGlifo('catre', 40, 80)
    const mesa = tracosDoGlifo('mesa', 80, 40)
    const bau = tracosDoGlifo('bau', 40, 24)
    expect(catre.length).toBeGreaterThan(0)
    expect(mesa.length).toBeGreaterThan(0)
    expect(bau.length).toBeGreaterThan(0)
    // Mesmo tamanho, desenho diferente: o jogador distingue um do outro.
    expect(tracosDoGlifo('catre', 60, 60)).not.toEqual(tracosDoGlifo('mesa', 60, 60))
    expect(tracosDoGlifo('mesa', 60, 60)).not.toEqual(tracosDoGlifo('bau', 60, 60))
  })

  it('todo traço cabe dentro do retângulo do móvel (centro na origem)', () => {
    for (const tipo of TIPOS_MOBILIA) {
      const tracos = tracosDoGlifo(tipo, 40, 80)
      expect(tracos.length).toBeGreaterThan(0)
      for (const t of tracos) {
        for (const [x, y] of [
          [t.x1, t.y1],
          [t.x2, t.y2],
        ]) {
          expect(Math.abs(x)).toBeLessThanOrEqual(20)
          expect(Math.abs(y)).toBeLessThanOrEqual(40)
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
        }
      }
    }
  })

  it('tamanho não desenhável não tem traço', () => {
    expect(tracosDoGlifo('catre', 0, 80)).toEqual([])
    expect(tracosDoGlifo('mesa', Number.NaN, 40)).toEqual([])
  })
})

describe('propMobiliaFromFile — leitura do arquivo', () => {
  const base: Prop = { id: 'p', src: '', x: 1, y: 2, width: 3, height: 4, linkedMapPath: null }

  it('objeto sem o campo passa igual, sem ganhar chave', () => {
    const lido = propMobiliaFromFile(base)
    expect(lido).toEqual(base)
    expect(lido).not.toHaveProperty('mobilia')
  })

  it('tipo do catálogo fica; tipo desconhecido some e o objeto volta a ser objeto comum', () => {
    expect(propMobiliaFromFile({ ...base, mobilia: 'mesa' })).toEqual({ ...base, mobilia: 'mesa' })
    const torto = JSON.parse(JSON.stringify({ ...base, mobilia: 'trono' })) as Prop // arquivo editado à mão: o tipo mente de propósito
    const lido = propMobiliaFromFile(torto)
    expect(lido).toEqual(base)
    expect(lido).not.toHaveProperty('mobilia')
  })
})
