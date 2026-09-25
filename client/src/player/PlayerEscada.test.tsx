import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Stair, Token } from '../types/map'
import { PISO_PENDENTE_MAX_MS, PlayerEscada } from './PlayerEscada'

/**
 * PISOS NA MESMA CENA na tela do jogador: com a ficha dele encostada numa
 * escada que liga pisos, um botão "Subir ao 1º piso" / "Descer ao térreo".
 * Tocar manda o pedido (só os ids) e o botão espera o host, sem girar para sempre.
 */
function ficha(id: string, x: number, y: number, piso?: number): Token {
  const base: Token = { id, characterId: null, name: id, x, y, size: 1, image: null }
  return piso === undefined ? base : { ...base, piso }
}

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 200, y1: 180, x2: 200, y2: 260 }], stepWidth: 40, levaAoPiso: 1 }

function mapa(tokens: Token[], stairs: Stair[] = [ESCADA]): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, 40), tokens, stairs }
}

describe('PlayerEscada — subir e descer na tela do jogador', () => {
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
    vi.useRealTimers()
  })

  const render = (map: MapData, own: string[], onTrocar: (tokenId: string, stairId: string) => void = () => {}) =>
    act(() => root.render(<PlayerEscada map={map} ownTokens={own} onTrocar={onTrocar} />))
  const botao = (): HTMLButtonElement | null => container.querySelector('button')

  it('ficha dele no 1º piso, no mapa que o RECORTE entrega: "Descer ao térreo", nunca "Subir ao 1º piso"', () => {
    const recorte = filterMapForPlayer(mapa([ficha('lia', 200, 220, 1)]), 'p1', { p1: ['lia'] }, 400).map
    render(recorte, ['lia'])
    expect(botao()?.textContent).toBe('Descer ao térreo')
  })

  it('ficha dele na escada: "Subir ao 1º piso", e o toque manda os dois ids', () => {
    const onTrocar = vi.fn()
    render(mapa([ficha('lia', 200, 220)]), ['lia'], onTrocar)
    expect(botao()?.textContent).toBe('Subir ao 1º piso')
    act(() => botao()?.click())
    expect(onTrocar).toHaveBeenCalledWith('lia', 'escada')
  })

  it('no piso de cima, a mesma escada desce ao térreo', () => {
    render(mapa([ficha('lia', 200, 220, 1)]), ['lia'])
    expect(botao()?.textContent).toBe('Descer ao térreo')
  })

  it('sem escada perto, escada de enfeite ou ficha que não é dele: nenhum botão', () => {
    render(mapa([ficha('lia', 600, 600)]), ['lia'])
    expect(botao()).toBeNull()
    render(mapa([ficha('lia', 200, 220)], [{ ...ESCADA, levaAoPiso: undefined }]), ['lia'])
    expect(botao()).toBeNull()
    render(mapa([ficha('caio', 200, 220)]), ['lia'])
    expect(botao()).toBeNull()
  })

  it('ficha travada pelo mestre (cadeado) na escada, no mapa que o RECORTE entrega: nenhum botão', () => {
    const recorte = filterMapForPlayer(mapa([{ ...ficha('lia', 200, 220), locked: true }]), 'p1', { p1: ['lia'] }, 400).map
    render(recorte, ['lia'])
    expect(botao()).toBeNull()
    // Pré-condição: sem o cadeado, o mesmo recorte oferece o botão.
    render(filterMapForPlayer(mapa([ficha('lia', 200, 220)]), 'p1', { p1: ['lia'] }, 400).map, ['lia'])
    expect(botao()?.textContent).toBe('Subir ao 1º piso')
  })

  it('depois do toque espera o host ("Subindo…", indisponível) e não manda de novo; sem resposta, volta a valer', () => {
    vi.useFakeTimers()
    const onTrocar = vi.fn()
    render(mapa([ficha('lia', 200, 220)]), ['lia'], onTrocar)
    act(() => botao()?.click())
    expect(botao()?.textContent).toBe('Subindo…')
    expect(botao()?.getAttribute('aria-disabled')).toBe('true')
    act(() => botao()?.click())
    expect(onTrocar).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(PISO_PENDENTE_MAX_MS + 1))
    expect(botao()?.textContent).toBe('Subir ao 1º piso')
    expect(botao()?.getAttribute('aria-disabled')).toBe('false')
  })

  it('o piso novo chegou: o botão já é o de descer, sem espera', () => {
    const onTrocar = vi.fn()
    render(mapa([ficha('lia', 200, 220)]), ['lia'], onTrocar)
    act(() => botao()?.click())
    render(mapa([ficha('lia', 200, 220, 1)]), ['lia'], onTrocar)
    expect(botao()?.textContent).toBe('Descer ao térreo')
    expect(botao()?.getAttribute('aria-disabled')).toBe('false')
  })
})
