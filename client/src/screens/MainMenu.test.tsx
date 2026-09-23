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

describe('MainMenu: oferta de recuperação', () => {
  const oferta = (extra: Partial<{ onRecover: () => void; onDismiss: () => void; mapName: string }> = {}) => ({
    mapName: 'Masmorra do Autosave',
    savedAtLabel: 'hoje às 14:05',
    onRecover: vi.fn(),
    onDismiss: vi.fn(),
    ...extra,
  })

  it('sem cópia de recuperação o menu não oferece Recuperar', () => {
    act(() => root.render(<MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={vi.fn()} />))
    expect(container.textContent).not.toContain('Recuperar')
  })

  it('com cópia, oferece Recuperar com o nome do mapa e a hora, sem esconder o menu', () => {
    const onRecover = vi.fn()
    act(() => root.render(<MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={vi.fn()} recovery={oferta({ onRecover })} />))
    const recuperar = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').startsWith('Recuperar'))
    expect(recuperar).toBeDefined()
    expect(container.textContent).toContain('Masmorra do Autosave')
    expect(container.textContent).toContain('14:05')
    // Não é modal: os cartões continuam na tela e nada é diálogo.
    expect(container.querySelector('[role="dialog"], [role="alertdialog"], dialog')).toBeNull()
    expect(cardTitles()).toEqual(['Criar Mapas', 'Carregar Mapa existente'])
    act(() => recuperar?.click())
    expect(onRecover).toHaveBeenCalledTimes(1)
  })

  it('"Agora não" chama onDismiss', () => {
    const onDismiss = vi.fn()
    act(() => root.render(<MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={vi.fn()} recovery={oferta({ onDismiss })} />))
    const agoraNao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Agora não')
    act(() => agoraNao?.click())
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('nome do mapa vindo do disco é texto, nunca HTML', () => {
    act(() => root.render(<MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={vi.fn()} recovery={oferta({ mapName: '<img src=x onerror=alert(1)>' })} />))
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})
