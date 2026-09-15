import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MainMenu } from './MainMenu'
import { FEATURES } from '../lib/features'

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

const cardTitles = () => Array.from(container.querySelectorAll('.lb-menucard__title')).map((node) => node.textContent)

describe('MainMenu', () => {
  it('com as flags padrão mostra 2 cartões, sem Opções e sem "isométrico"', () => {
    act(() => root.render(<MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={vi.fn()} />))
    expect(cardTitles()).toEqual(['Criar Mapas', 'Carregar Mapa existente'])
    expect(container.textContent).not.toContain('Opções')
    expect(container.textContent).not.toContain('isométrico')
    expect(container.textContent).toContain('Planta em grade, paredes, portas e tokens')
  })

  it('com optionsScreen e otherMapTypes ligados mostra 3 cartões e o subtítulo antigo', () => {
    const onOptions = vi.fn()
    const flags = { ...FEATURES, optionsScreen: true, otherMapTypes: true }
    act(() => root.render(<MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={onOptions} flags={flags} />))
    expect(cardTitles()).toEqual(['Criar Mapas', 'Carregar Mapa existente', 'Opções'])
    expect(container.textContent).toContain('Dungeon, isométrico ou mundo')
    const options = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Opções'))
    act(() => options?.click())
    expect(onOptions).toHaveBeenCalledTimes(1)
  })
})
