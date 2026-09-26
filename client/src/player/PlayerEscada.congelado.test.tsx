import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Stair, Token } from '../types/map'
import { PlayerEscada } from './PlayerEscada'

/**
 * CONGELAR FICHA na escada entre pisos: o host recusa em silêncio a ficha
 * congelada (`handleTokenPiso`), então o botão "Subir…" não oferece o que vai
 * ser recusado — a mesma regra do cadeado.
 */
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 200, y1: 180, x2: 200, y2: 260 }], stepWidth: 40, levaAoPiso: 1 }

function lia(extra: Partial<Token> = {}): Token {
  return { id: 'lia', characterId: null, name: 'Lia', x: 200, y: 220, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, 40), tokens, stairs: [ESCADA] }
}

describe('PlayerEscada — ficha congelada', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = (map: MapData) =>
    act(() => root.render(<PlayerEscada map={map} ownTokens={['lia']} onTrocar={() => {}} turn={undefined} confronto={undefined} paused={false} />))

  it('controle: solta na escada, o botão aparece', () => {
    render(mapa([lia()]))
    expect(container.querySelector('button')?.textContent).toBe('Subir ao 1º piso')
  })

  it('congelada na escada, nenhum botão', () => {
    render(mapa([lia({ congelado: true })]))
    expect(container.querySelector('button')).toBeNull()
  })
})
