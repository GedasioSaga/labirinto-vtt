/**
 * "Visão geral" na seção Cenas da aba Mapa (G14): o botão abre a janela das
 * miniaturas; escolher uma cena troca de cena e fecha; Esc fecha sem trocar.
 * O foco volta ao botão que abriu, nos dois casos.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salão', active: true, available: true, renamable: true, tokenCount: 0 },
  { id: 's-cripta', name: 'Cripta', active: false, available: true, renamable: true, tokenCount: 0 },
]

const MAPAS = new Map<string, MapData>([
  ['s-salao', createEmptyMap('map_salao', 'Salão', 20, 16, 50)],
  ['s-cripta', createEmptyMap('map_cripta', 'Cripta', 20, 16, 50)],
])

describe('ScenesSection: "Visão geral"', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(props: { scenes?: SceneListItem[]; maps?: ReadonlyMap<string, MapData>; onSelect?: (id: string) => void } = {}) {
    const onSelect = props.onSelect ?? vi.fn()
    const scenes = props.scenes ?? CENAS
    const maps = 'maps' in props ? props.maps : MAPAS
    act(() => root.render(<ScenesSection scenes={scenes} onSelect={onSelect} onCreate={() => {}} onRename={() => {}} maps={maps} />))
    return onSelect
  }

  const botao = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Visão geral')
  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const miniatura = (nome: string) =>
    Array.from(janela()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((b) => (b.getAttribute('aria-label') ?? '').startsWith(`${nome},`))
  const abrir = () => {
    const alvo = botao()
    if (!alvo) throw new Error('sem botão "Visão geral"')
    alvo.focus()
    act(() => alvo.click())
  }

  it('com duas cenas ou mais, a seção Cenas tem o botão "Visão geral", que anuncia a janela', () => {
    render()
    const alvo = botao()
    expect(alvo).toBeDefined()
    expect(alvo?.getAttribute('aria-haspopup')).toBe('dialog')
    expect(alvo?.getAttribute('aria-expanded')).toBe('false')
    // Mora na seção, junto do "+ Nova cena".
    expect(alvo?.closest('.lb-collapsible__body')).not.toBeNull()
  })

  it('mapa solto (uma cena só) ou sem os mapas das cenas: nada para comparar, então não há botão', () => {
    render({ scenes: [CENAS[0]] })
    expect(botao()).toBeUndefined()
    render({ maps: undefined })
    expect(botao()).toBeUndefined()
  })

  it('o botão abre a janela "Visão geral das cenas"', () => {
    render()
    expect(janela()).toBeNull()
    abrir()
    const tituloId = janela()?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(tituloId)?.textContent).toBe('Visão geral das cenas')
    expect(botao()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('escolher outra cena troca de cena, fecha a janela e devolve o foco ao botão', () => {
    const onSelect = render()
    abrir()
    act(() => miniatura('Cripta')?.click())
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('s-cripta')
    expect(janela()).toBeNull()
    expect(document.activeElement).toBe(botao())
  })

  it('escolher a cena que já está aberta só fecha a janela, sem pedir troca', () => {
    const onSelect = render()
    abrir()
    act(() => miniatura('Salão')?.click())
    expect(onSelect).not.toHaveBeenCalled()
    expect(janela()).toBeNull()
  })

  it('Esc fecha sem trocar de cena e devolve o foco ao botão', () => {
    const onSelect = render()
    abrir()
    const alvo = document.activeElement ?? janela()
    act(() => {
      alvo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(janela()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botao())
    expect(botao()?.getAttribute('aria-expanded')).toBe('false')
  })
})
