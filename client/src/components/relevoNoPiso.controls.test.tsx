import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { MapData } from '../types/map'
import { CarimbosControls } from './CarimbosControls'
import { PenhascoControls } from './PenhascoControls'
import { TexturasControls } from './TexturasControls'

/*
 * PISOS x "APAGAR TODOS": o botão só apaga o piso em edição (`stores/mapStore.ts`).
 * O painel conta e mostra o botão pelo MESMO recorte; senão, com tudo no
 * térreo e o mestre no 1º piso, o botão aparece e o clique não faz nada, e a
 * contagem soma pisos que o botão não alcança.
 */

let raiz: Root
let palco: HTMLDivElement

/** Carimbo, textura e penhasco só no térreo; uma escada leva ao 1º piso. */
function mapaComTudoNoTerreo(): MapData {
  return {
    ...createEmptyMap('m-pisos', 'M', 20, 20, 50),
    continente: true,
    carimbos: [{ id: 'c1', tipo: 'pinheiro', x: 100, y: 100, tamanho: 1, giro: 0 }],
    texturas: [{ id: 't1', tipo: 'pincel', textura: 'areia', forca: 1, raio: 30, pontos: [{ x: 100, y: 100 }] }],
    penhascos: [{ id: 'p1', modo: 'riscar', raio: 10, pontos: [{ x: 0, y: 0 }] }],
  }
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  palco = document.createElement('div')
  document.body.appendChild(palco)
  raiz = createRoot(palco)
  useMapStore.getState().loadMap(mapaComTudoNoTerreo())
})

afterEach(() => {
  act(() => raiz.unmount())
  palco.remove()
  vi.restoreAllMocks()
})

function montar(): void {
  act(() =>
    raiz.render(
      <>
        <CarimbosControls />
        <TexturasControls />
        <PenhascoControls />
      </>,
    ),
  )
}

function botoesDeApagarTodos(): string[] {
  return Array.from(palco.querySelectorAll('button'))
    .map((b) => b.textContent ?? '')
    .filter((t) => t.startsWith('Apagar tod'))
}

describe('"Apagar todos" no editor com pisos', () => {
  it('no térreo, onde está tudo: os três botões aparecem e a contagem diz "neste piso"', () => {
    useMapStore.setState({ pisoAtivo: 0 })
    // Um carimbo no 1º piso: a contagem do térreo não o soma.
    useMapStore.getState().loadMap({
      ...useMapStore.getState().map,
      carimbos: [...(useMapStore.getState().map.carimbos ?? []), { id: 'c2', tipo: 'pinheiro', x: 1, y: 1, tamanho: 1, giro: 0, piso: 1 }],
    })
    montar()
    expect(botoesDeApagarTodos()).toHaveLength(3)
    expect(palco.textContent).toContain('1 objeto neste piso')
  })

  it('no 1º piso, vazio: nenhum botão de apagar todos nem contagem', () => {
    useMapStore.setState({ pisoAtivo: 1 })
    montar()
    expect(botoesDeApagarTodos()).toEqual([])
    expect(palco.textContent).not.toMatch(/objetos? (nesta cena|neste piso)/)
  })
})
