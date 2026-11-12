import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RAIO_PADRAO_PX, SceneSettingsDialog, raioEmQuadrados } from './SceneSettingsDialog'

/** "Configurar cena" (07/10/2026): visão dos jogadores por cena, com o radar ao lado. */
describe('SceneSettingsDialog', () => {
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

  function abrir(visionCells: number | undefined, dark = false, extra: { onClose?: () => void; onVisionCellsChange?: (c: number | undefined) => void } = {}) {
    act(() =>
      root.render(
        <SceneSettingsDialog
          sceneName="Mina"
          cellPx={70}
          vision={{ visionCells, onVisionCellsChange: extra.onVisionCellsChange ?? vi.fn(), dark, onDarkChange: vi.fn() }}
          onClose={extra.onClose ?? vi.fn()}
        />,
      ),
    )
  }

  const radar = () => document.body.querySelector('svg[role="img"]')

  it('raio em quadrados: o da cena, senão o padrão convertido pelo quadro', () => {
    expect(raioEmQuadrados(4, 64)).toEqual({ cells: 4, padrao: false })
    expect(raioEmQuadrados(undefined, 70)).toEqual({ cells: RAIO_PADRAO_PX / 70, padrao: true })
    expect(raioEmQuadrados(undefined, 0).cells).toBeCloseTo(RAIO_PADRAO_PX / 64, 1)
  })

  it('mostra o nome da cena, o campo da visão e o radar com o raio', () => {
    abrir(3)
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Configurar Mina')
    expect(document.body.querySelector<HTMLInputElement>('#lb-scene-vision')?.value).toBe('3')
    expect(radar()?.getAttribute('aria-label')).toBe('Prévia: o jogador vê 3 quadrados em volta')
  })

  it('cena escura aparece no radar; sem valor, a legenda fala do raio padrão', () => {
    abrir(undefined, true)
    expect(radar()?.getAttribute('aria-label')).toContain('cena escura')
    expect(document.body.querySelector('figcaption')?.textContent).toContain('raio padrão')
  })

  // Pedido de 11/11/2026: no andar de cima o mestre não achava onde mudar o tamanho.
  it('Tamanho do mapa: a seção mostra o tamanho da cena e Aplicar manda o novo', () => {
    const onApply = vi.fn()
    act(() =>
      root.render(
        <SceneSettingsDialog
          sceneName="Caverna – andar de cima"
          cellPx={70}
          vision={{ visionCells: 3, onVisionCellsChange: vi.fn(), dark: false, onDarkChange: vi.fn() }}
          mapSize={{ width: 30, height: 10, onApply }}
          onClose={vi.fn()}
        />,
      ),
    )
    const secoes = Array.from(document.body.querySelectorAll('nav.gr-nav-vertical button')).map((secao) => secao.textContent)
    expect(secoes).toEqual(['Visão', 'Tamanho do mapa'])
    const largura = document.body.querySelector<HTMLInputElement>('#lb-mapsize-width')
    if (largura === null) throw new Error('campo da largura ausente')
    expect(largura.value).toBe('30')
    expect(document.body.querySelector<HTMLInputElement>('#lb-mapsize-height')?.value).toBe('10')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(largura, '40')
      largura.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => document.body.querySelector<HTMLButtonElement>('#lb-mapsize-apply')?.click())
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith(40, 10)
  })

  // Pedido de 12/11/2026: "eu quero me mover fora do chão e ver tudo". Opção por cena, na seção Visão.
  describe('Fora do Chão', () => {
    function abrirComChao(offFloor: 'free' | 'blocked', temChao: boolean, onOffFloorChange = vi.fn()) {
      act(() =>
        root.render(
          <SceneSettingsDialog
            sceneName="Convés"
            cellPx={70}
            vision={{ visionCells: 3, onVisionCellsChange: vi.fn(), dark: false, onDarkChange: vi.fn(), offFloor, temChao, onOffFloorChange }}
            onClose={vi.fn()}
          />,
        ),
      )
      return onOffFloorChange
    }
    const grupo = () => document.body.querySelector('[role="radiogroup"][aria-label="Fora do Chão"]')
    const opcoes = () => Array.from(grupo()?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
    const marcada = () => opcoes().find((o) => o.getAttribute('aria-checked') === 'true')?.textContent
    const linha = () => document.getElementById(grupo()?.getAttribute('aria-describedby') ?? '')?.textContent

    it('duas opções no padrão dos vizinhos; a linha muda com a escolha e o clique grava', () => {
      const onOffFloorChange = abrirComChao('blocked', true)
      expect(opcoes().map((o) => o.textContent)).toEqual(['Bloqueado', 'Livre'])
      expect(opcoes().every((o) => o.className === 'lb-seg__option' && !o.disabled)).toBe(true)
      expect(marcada()).toBe('Bloqueado')
      expect(linha()).toBe('A ficha do jogador só anda e enxerga dentro do Chão desta cena.')
      act(() => opcoes()[1]?.click())
      expect(onOffFloorChange).toHaveBeenCalledTimes(1)
      expect(onOffFloorChange).toHaveBeenCalledWith('free')

      abrirComChao('free', true, onOffFloorChange)
      expect(marcada()).toBe('Livre')
      expect(linha()).toBe('A ficha anda e enxerga em qualquer lugar. O que está fora do Chão passa a aparecer para o jogador. Só parede, porta, escuridão e o alcance da visão limitam.')
      act(() => opcoes()[0]?.click())
      expect(onOffFloorChange).toHaveBeenLastCalledWith('blocked')
    })

    it('cena sem nenhuma peça de Chão: o controle fica desligado e a linha diz por quê', () => {
      const onOffFloorChange = abrirComChao('blocked', false)
      expect(opcoes().map((o) => o.textContent)).toEqual(['Bloqueado', 'Livre'])
      expect(opcoes().every((o) => o.disabled)).toBe(true)
      expect(linha()).toBe('Esta cena não tem Chão: a ficha já anda e enxerga em qualquer lugar.')
      act(() => opcoes()[1]?.click())
      expect(onOffFloorChange).not.toHaveBeenCalled()
    })
  })

  it('mudar o campo grava; Esc fecha', () => {
    const onVisionCellsChange = vi.fn()
    const onClose = vi.fn()
    abrir(undefined, false, { onVisionCellsChange, onClose })
    const campo = document.body.querySelector<HTMLInputElement>('#lb-scene-vision')
    if (campo === null) throw new Error('campo ausente')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, '5')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onVisionCellsChange).toHaveBeenCalledWith(5)
    act(() => {
      document.body.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })
})
