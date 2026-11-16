import { describe, expect, it } from 'vitest'
import type { Prop } from '../../types/map'
import { TIPOS_COM_TEXTURA } from '../../texturas/meioTermo/moveis'
import { perfilDoTresQuartos } from '../../texturas/meioTermo/moveis/tresQuartos'
import { createEmptyMap, trocarNeveDaMontanha } from '../mapFactory'
import { GRUPO_DA_CONSTRUCAO, GRUPOS_DE_CONSTRUCAO } from './construcoes'
import { TIPOS_DE_MONTANHA, varianteDaMontanha } from './montanha'
import { FICHAS_DAS_PECAS_NOVAS } from './pecasNovas'

describe('leva E2 (16/11/2026): a torre do dragão e as montanhas', () => {
  it('estão registradas (grupo da Construção, desenho com textura, 3/4 derivada) e a neve vai e volta pelo mapa', () => {
    expect(GRUPO_DA_CONSTRUCAO.torreDoDragao).toBe('construcoesDoCastelo')
    expect(GRUPOS_DE_CONSTRUCAO.map((g) => g.id)).toContain('naturezaERelevo')
    for (const tipo of ['torreDoDragao', ...TIPOS_DE_MONTANHA] as const) {
      expect(TIPOS_COM_TEXTURA, tipo).toContain(tipo)
      expect(perfilDoTresQuartos(tipo, 'frente').modo, tipo).toBe('derivado')
    }
    expect(TIPOS_DE_MONTANHA.map((tipo) => GRUPO_DA_CONSTRUCAO[tipo])).toEqual(['naturezaERelevo', 'naturezaERelevo', 'naturezaERelevo'])
    expect(TIPOS_DE_MONTANHA.map((tipo) => FICHAS_DAS_PECAS_NOVAS[tipo].tamanho)).toEqual([
      { largura: 4, altura: 4 },
      { largura: 6, altura: 6 },
      { largura: 10, altura: 8 },
    ])

    // A neve: ausente = sem neve; "Com" grava 'nevada' (a variante 1 do desenho), "Sem" tira o campo.
    const montanha: Prop = { id: 'm', src: '', x: 400, y: 400, width: 400, height: 320, linkedMapPath: null, mobilia: 'montanhaGrande' }
    const torre: Prop = { id: 't', src: '', x: 100, y: 100, width: 120, height: 120, linkedMapPath: null, mobilia: 'torreDoDragao' }
    const mapa = { ...createEmptyMap('m1', 'Serra', 1200, 1200, 40), props: [montanha, torre] }
    expect(varianteDaMontanha(montanha.mobiliaForma)).toBe(0)
    const nevada = trocarNeveDaMontanha(mapa, 'm', 'nevada')
    expect(nevada.props[0].mobiliaForma).toBe('nevada')
    expect(varianteDaMontanha(nevada.props[0].mobiliaForma)).toBe(1)
    expect(trocarNeveDaMontanha(nevada, 'm', 'nevada')).toBe(nevada)
    expect('mobiliaForma' in trocarNeveDaMontanha(nevada, 'm', 'semNeve').props[0]).toBe(false)
    // A torre não tem neve: o mapa volta o mesmo.
    expect(trocarNeveDaMontanha(mapa, 't', 'nevada')).toBe(mapa)
  })
})
