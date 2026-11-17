/**
 * BARRANCO PELO CHÃO (`barrancoPorChao.ts`): a tabela de chão para material
 * acompanha o catálogo de texturas. Todo piso de pedra do catálogo vira Rocha,
 * e a Terra da tabela é a mesma tinta de hoje (`TONS_DO_BARRANCO`).
 */
import { describe, expect, it } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from '../embutidas'
import { TONS_DO_BARRANCO, corDoBarranco } from './barranco'
import { corDaFacePorChao, MATERIAL_DO_CHAO, materialDaEscolha, materialDoChao, TONS_POR_CHAO } from './barrancoPorChao'

describe('do chão pintado ao material do barranco', () => {
  it('todo piso de pedra do catálogo é Rocha; areia, neve e campo verde têm o seu; o resto é Terra', () => {
    const pisosDePedra = TEXTURAS_EMBUTIDAS.filter((t) => t.forma?.grupo === 'pisos-de-pedra').map((t) => t.id)
    expect(pisosDePedra.length).toBeGreaterThan(0)
    expect(pisosDePedra.filter((id) => materialDoChao(id) !== 'pedra')).toEqual([])
    expect(['cascalho', 'duna', 'neve', 'grama-escura'].map(materialDoChao)).toEqual(['pedra', 'areia', 'neve', 'grama'])
    expect([null, undefined, 'mata', 'campo-amarelo', 'textura-que-nao-existe'].map(materialDoChao)).toEqual(['terra', 'terra', 'terra', 'terra', 'terra'])
    // Nenhum id da tabela sobrou de uma textura que saiu do catálogo.
    const doCatalogo = new Set(TEXTURAS_EMBUTIDAS.map((t) => t.id))
    expect(Object.keys(MATERIAL_DO_CHAO).filter((id) => !doCatalogo.has(id))).toEqual([])
  })

  it('a Terra pinta com a tinta de hoje, e o material do painel vence o chão', () => {
    expect(TONS_POR_CHAO.terra.face).toEqual(TONS_DO_BARRANCO)
    for (const fracao of [0, 0.25, 0.5, 0.75, 1]) {
      expect(corDaFacePorChao(TONS_POR_CHAO.terra.face, fracao)).toEqual(corDoBarranco(fracao))
    }
    expect(materialDaEscolha('automatico', 'neve')).toBe('neve')
    expect(materialDaEscolha('pedra', 'neve')).toBe('pedra')
  })
})
