/**
 * "Corte da torre" na seção Cenas: o botão abre a janela com os andares
 * empilhados, os poços e as fichas como pontos. Clicar num ponto leva o
 * editor à cena e à ficha; clicar numa cena troca de cena; Esc fecha. O foco
 * volta ao botão que abriu.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { CorteJogador } from '../lib/corteDaTorre'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData, Pin, Token } from '../types/map'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 'terreo', name: 'Térreo', active: true, available: true, renamable: true, tokenCount: 0 },
  { id: 'cume', name: 'Cume', active: false, available: true, renamable: true, tokenCount: 1 },
]

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function pino(id: string, sceneId: string, pinId: string): Pin {
  return { id, x: 10, y: 10, kind: 'viagem', description: 'Espinha', image: null, destino: { sceneId, pinId } }
}

const MAPAS = new Map<string, MapData>([
  ['terreo', { ...createEmptyMap('m_terreo', 'Térreo', 20, 16, 50), pins: [pino('pa', 'cume', 'pc')] }],
  ['cume', { ...createEmptyMap('m_cume', 'Cume', 20, 16, 50), pins: [pino('pc', 'terreo', 'pa')], tokens: [ficha('t-ana', 120, 80, { color: '#3cff00' })] }],
])

const JOGADORES: CorteJogador[] = [{ playerId: 'p-ana', name: 'Ana', connected: true, tokenIds: ['t-ana'], sceneId: 'cume', travelPending: false }]

describe('ScenesSection: "Corte da torre"', () => {
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

  function render(opts: { comIrLa?: boolean } = {}) {
    const onSelect = vi.fn()
    const onGoToPoint = vi.fn()
    act(() =>
      root.render(
        <ScenesSection
          scenes={CENAS}
          onSelect={onSelect}
          onCreate={() => {}}
          onRename={() => {}}
          maps={MAPAS}
          towerPlayers={JOGADORES}
          onGoToPoint={opts.comIrLa === false ? undefined : onGoToPoint}
        />,
      ),
    )
    return { onSelect, onGoToPoint }
  }

  const botao = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Corte da torre')
  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const abrir = () => {
    const alvo = botao()
    if (!alvo) throw new Error('sem botão "Corte da torre"')
    alvo.focus()
    act(() => alvo.click())
  }
  const botaoNaJanela = (inicio: string) =>
    Array.from(janela()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').startsWith(inicio))

  it('sem como levar o editor a um ponto, não há botão; com, o botão anuncia a janela', () => {
    render({ comIrLa: false })
    expect(botao()).toBeUndefined()
    render()
    expect(botao()?.getAttribute('aria-haspopup')).toBe('dialog')
    expect(botao()?.getAttribute('aria-expanded')).toBe('false')
  })

  it('abre com os andares empilhados (o último da lista no alto), o poço e a ficha como ponto', () => {
    render()
    abrir()
    const tituloId = janela()?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(tituloId)?.textContent).toBe('Corte da torre')
    const andares = Array.from(janela()?.querySelectorAll('[data-andar]') ?? []).map((el) => el.getAttribute('data-andar'))
    expect(andares).toEqual(['cume', 'terreo'])
    const poco = janela()?.querySelector('[data-poco]')
    expect(poco?.getAttribute('aria-label')).toBe('Poço Espinha: do andar 1 ao 2')
    const ponto = botaoNaJanela('Ana,')
    expect(ponto?.getAttribute('aria-label')).toBe('Ana, fora de sala, Cume')
    expect(ponto?.style.backgroundColor).toBe('rgb(60, 255, 0)')
  })

  it('clicar no ponto leva o editor à cena e à ficha, fecha e devolve o foco ao botão', () => {
    const { onGoToPoint, onSelect } = render()
    abrir()
    act(() => botaoNaJanela('Ana,')?.click())
    expect(onGoToPoint).toHaveBeenCalledTimes(1)
    expect(onGoToPoint).toHaveBeenCalledWith('cume', 120, 80)
    expect(onSelect).not.toHaveBeenCalled()
    expect(janela()).toBeNull()
    expect(document.activeElement).toBe(botao())
  })

  it('clicar no nome de outra cena troca de cena; Esc fecha sem trocar', () => {
    const { onSelect } = render()
    abrir()
    act(() => botaoNaJanela('Cume')?.click())
    expect(onSelect).toHaveBeenCalledWith('cume')
    expect(janela()).toBeNull()

    abrir()
    act(() => {
      ;(document.activeElement ?? janela())?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(janela()).toBeNull()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(botao())
  })
})
