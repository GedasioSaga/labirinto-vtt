import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'
import { corAoTrocarDeModelo, miniaturaDoTelhado } from './EstiloDoTelhado'

/**
 * MODELO E COR DO TELHADO no painel da Sala: aparecem só com o teto ligado,
 * Telhas | Madeira troca o modelo, a bolinha troca a cor e "Cor padrão" grava
 * ausente (`null`).
 */

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

function render(overrides: Partial<RoomControlsProps> = {}) {
  const props: RoomControlsProps = {
    name: 'Casa',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 128,
    height: 128,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    roof: true,
    onRoofChange: vi.fn(),
    onRoofStyleChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

function radio(grupo: string, nome: string): HTMLButtonElement {
  const rotulo = [...container.querySelectorAll('.gr-campo__rot')].find((r) => r.textContent === grupo)
  const campo = rotulo?.parentElement
  const achado = [...(campo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find(
    (b) => b.textContent === nome || b.getAttribute('aria-label') === nome,
  )
  if (!achado) throw new Error(`sem "${nome}" em "${grupo}"`)
  return achado
}

describe('RoomControls — modelo e cor do telhado', () => {
  it('teto desligado: não mostra modelo nem cor', () => {
    render({ roof: false })
    expect(container.querySelector('[data-testid="estilo-do-telhado"]')).toBeNull()
  })

  it('sem nada no mapa: Telhas e Barro marcados', () => {
    render()
    expect(radio('Modelo do telhado', 'Telhas').getAttribute('aria-checked')).toBe('true')
    expect(radio('Cor do telhado', 'Barro').getAttribute('aria-checked')).toBe('true')
  })

  it('Madeira troca o modelo; as cores passam a ser as da madeira', () => {
    const props = render()
    act(() => radio('Modelo do telhado', 'Madeira').click())
    expect(props.onRoofStyleChange).toHaveBeenCalledWith({ modelo: 'madeira' })
    render({ modeloDoTeto: 'madeira' })
    expect(radio('Cor do telhado', 'Carvalho').getAttribute('aria-checked')).toBe('true')
    expect(() => radio('Cor do telhado', 'Barro')).toThrow()
  })

  it('Palha (MT6) troca o modelo; as cores passam a ser as 6 da palha, com Palha dourada marcada', () => {
    const props = render()
    act(() => radio('Modelo do telhado', 'Palha').click())
    expect(props.onRoofStyleChange).toHaveBeenCalledWith({ modelo: 'palha' })
    render({ modeloDoTeto: 'palha' })
    expect(radio('Modelo do telhado', 'Palha').getAttribute('aria-checked')).toBe('true')
    expect(radio('Cor do telhado', 'Palha dourada').getAttribute('aria-checked')).toBe('true')
    expect(() => radio('Cor do telhado', 'Barro')).toThrow()
    expect(corAoTrocarDeModelo('telhas', '#8a5a46', 'palha')).toBe('#d6b56a')
    expect(miniaturaDoTelhado('palha', '#d6b56a').largura).toBeGreaterThan(0)
  })

  it('a bolinha grava a cor; "Cor padrão" grava null', () => {
    const props = render({ modeloDoTeto: 'madeira', corDoTeto: '#4d5f4f' })
    expect(radio('Cor do telhado', 'Verde').getAttribute('aria-checked')).toBe('true')
    act(() => radio('Cor do telhado', 'Nogueira').click())
    expect(props.onRoofStyleChange).toHaveBeenCalledWith({ cor: '#5f4532' })
    const padrao = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cor padrão')
    act(() => padrao?.click())
    expect(props.onRoofStyleChange).toHaveBeenCalledWith({ cor: null })
  })

  it('"Outra cor…" mostra a cor livre do mapa', () => {
    render({ corDoTeto: '#123456' })
    const outra = container.querySelector<HTMLInputElement>('input[aria-label="Outra cor…"]')
    expect(outra?.value).toBe('#123456')
  })

  it('a miniatura é o desenho de verdade, pintado uma vez por cor', () => {
    const a = miniaturaDoTelhado('madeira', '#4d5f4f')
    expect(a.largura).toBeGreaterThan(0)
    expect(miniaturaDoTelhado('madeira', '#4d5f4f')).toBe(a)
    expect(corAoTrocarDeModelo('telhas', '#656b72', 'madeira')).toBe('#8b6b47')
    expect(corAoTrocarDeModelo('telhas', '#123456', 'madeira')).toBe('#123456')
  })
})
