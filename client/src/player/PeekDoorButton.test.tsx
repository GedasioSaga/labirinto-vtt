import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { DoorState, MapData, Token, Wall } from '../types/map'
import { PeekDoorButton, peekableDoorId } from './PeekDoorButton'

/** "Espiar pela porta": só aparece com a ficha do jogador encostada numa porta FECHADA. */
function porta(door: DoorState | null, x1 = 500): Wall {
  return { id: `porta-${x1}`, x1, y1: 250, x2: x1, y2: 350, blocksLight: true, blocksMove: true, door }
}

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 300, size: 1, image: null }
}

function mapa(walls: Wall[], tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 20, 12, 50), walls, tokens }
}

const FECHADA: DoorState = { open: false, locked: true, kind: 'normal' }

describe('peekableDoorId', () => {
  it('ficha encostada em porta fechada (mesmo trancada): essa porta', () => {
    expect(peekableDoorId(mapa([porta(FECHADA)], [ficha('ana', 460)]), ['ana'])).toBe('porta-500')
  })

  it('porta aberta, parede sem porta, ficha longe ou ficha de outro: nada', () => {
    expect(peekableDoorId(mapa([porta({ ...FECHADA, open: true, locked: false })], [ficha('ana', 460)]), ['ana'])).toBeNull()
    expect(peekableDoorId(mapa([porta(null)], [ficha('ana', 460)]), ['ana'])).toBeNull()
    expect(peekableDoorId(mapa([porta(FECHADA)], [ficha('ana', 100)]), ['ana'])).toBeNull()
    expect(peekableDoorId(mapa([porta(FECHADA)], [ficha('ana', 460)]), ['bia'])).toBeNull()
  })

  it('duas portas ao alcance: a mais perto da ficha', () => {
    expect(peekableDoorId(mapa([porta(FECHADA, 500), porta(FECHADA, 440)], [ficha('ana', 460)]), ['ana'])).toBe('porta-440')
  })
})

describe('PeekDoorButton', () => {
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

  it('encostada na porta fechada: o botão aparece e espia aquela porta', () => {
    const onPeek = vi.fn()
    act(() => root.render(<PeekDoorButton map={mapa([porta(FECHADA)], [ficha('ana', 460)])} ownTokens={['ana']} onPeek={onPeek} />))
    const button = container.querySelector('button')
    expect(button?.textContent).toBe('Espiar pela porta')
    act(() => button?.click())
    expect(onPeek).toHaveBeenCalledWith('porta-500')
  })

  it('longe de porta: nenhum botão', () => {
    act(() => root.render(<PeekDoorButton map={mapa([porta(FECHADA)], [ficha('ana', 100)])} ownTokens={['ana']} onPeek={vi.fn()} />))
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toBe('')
  })
})
