/**
 * A VIRADA NÃO REPINTA (revisão da fatia 6): as dependências de repintura do
 * editor (`pixi/shapesRedraw.ts`) comparam `hiddenLayers` por referência.
 * Quando a materialização não muda o conteúdo da lista, `paraVersao2` devolve
 * a MESMA lista, e a primeira mexida na opacidade de um mapa antigo não
 * repinta as camadas.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData } from '../../types/map'
import { createEmptyMap } from '../mapFactory'
import { definirOpacidade, paraVersao2 } from './estado'

function mapa(hiddenLayers: CamadaId[], lockedLayers: CamadaId[]): MapData {
  return { ...createEmptyMap('ref', 'Ref', 10, 10, 64), hiddenLayers, lockedLayers }
}

describe('paraVersao2 mantém a referência das listas que não mudam', () => {
  it('sem Salas nem Anotações nas listas: hiddenLayers e lockedLayers são as mesmas', () => {
    const antes = mapa(['paredes', 'tokens'], ['objetos'])
    const depois = paraVersao2(antes)
    expect(depois.versaoDasCamadas).toBe(2)
    expect(depois.hiddenLayers).toBe(antes.hiddenLayers)
    expect(depois.lockedLayers).toBe(antes.lockedLayers)
  })

  it('listas vazias: as mesmas (o caso de todo mapa novo)', () => {
    const antes = mapa([], [])
    const depois = definirOpacidade(antes, 'salas', 0.5)
    expect(depois.hiddenLayers).toBe(antes.hiddenLayers)
    expect(depois.lockedLayers).toBe(antes.lockedLayers)
  })

  it('com Salas oculta, a lista muda de verdade (Chão entra explícito): lista nova', () => {
    const antes = mapa(['salas'], ['anotacoes'])
    const depois = paraVersao2(antes)
    expect(depois.hiddenLayers).toEqual(['salas', 'chao'])
    expect(depois.lockedLayers).toEqual(['anotacoes', 'desenhos'])
  })
})
