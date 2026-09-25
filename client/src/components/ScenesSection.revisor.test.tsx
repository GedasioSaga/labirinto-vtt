/**
 * "Revisar aventura" na seção Cenas: o botão abre a janela do revisor; "Ir lá"
 * fecha e leva o editor ao ponto; Esc fecha e devolve o foco ao botão.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [{ id: '', name: 'Masmorra', active: true, available: true, renamable: false, tokenCount: 0 }]

const MAPAS = new Map<string, MapData>([
  ['', { ...createEmptyMap('map_solto', 'Masmorra', 20, 16, 50), pins: [{ id: 'p1', x: 70, y: 90, kind: 'interrogacao', description: '', image: null }] }],
])

describe('ScenesSection: "Revisar aventura"', () => {
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

  function render(extra: { onFix?: () => boolean } = {}) {
    const onGoToPoint = vi.fn()
    act(() =>
      root.render(
        <ScenesSection
          scenes={CENAS}
          onSelect={() => {}}
          onCreate={() => {}}
          onRename={() => {}}
          maps={MAPAS}
          onGoToPoint={onGoToPoint}
          {...('onFix' in extra ? { onFix: extra.onFix } : {})}
        />,
      ),
    )
    return onGoToPoint
  }

  const botao = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Revisar aventura')
  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const abrir = () => {
    const alvo = botao()
    if (!alvo) throw new Error('sem botão "Revisar aventura"')
    alvo.focus()
    act(() => alvo.click())
  }

  it('sem o conserto ligado, a seção não oferece o revisor', () => {
    render()
    expect(botao()).toBeUndefined()
  })

  it('mesmo com uma cena só, o botão abre a janela do revisor', () => {
    render({ onFix: () => true })
    expect(botao()?.getAttribute('aria-haspopup')).toBe('dialog')
    abrir()
    const tituloId = janela()?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(tituloId)?.textContent).toBe('Revisar aventura')
    expect(botao()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('"Ir lá" fecha a janela e leva o editor ao ponto do problema', () => {
    const onGoToPoint = render({ onFix: () => true })
    abrir()
    const irLa = Array.from(janela()?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Ir lá')
    if (!irLa) throw new Error('sem "Ir lá"')
    act(() => irLa.click())
    expect(janela()).toBeNull()
    expect(onGoToPoint).toHaveBeenCalledWith('', 70, 90)
  })

  it('Esc fecha e o foco volta ao botão que abriu', () => {
    render({ onFix: () => true })
    abrir()
    const box = janela()
    if (!box) throw new Error('sem janela')
    act(() => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(janela()).toBeNull()
    expect(document.activeElement).toBe(botao())
  })
})
