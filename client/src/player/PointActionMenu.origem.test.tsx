import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POINT_MENU_HEIGHT_PX, POINT_MENU_OFFSET_PX, POINT_MENU_WALK_HEIGHT_PX, POINT_MENU_WIDTH_PX, PointActionMenu } from './PointActionMenu'

/*
 * DE ONDE O MENU DO TOQUE LONGO CRESCE. A entrada é uma escala de 0,96 a 1
 * (`pp-pointmenu-in`, no player.css), e a escala parte do `transform-origin`.
 * Perto da borda o menu vira para cima ou para a esquerda do dedo; com a
 * origem fixa no canto de cima à esquerda, ele crescia de um canto longe do
 * dedo. A origem agora é o próprio ponto do dedo, contado do canto do menu.
 */
describe('PointActionMenu: a entrada cresce de onde está o dedo', () => {
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
    vi.unstubAllGlobals()
  })

  function janela(largura: number, altura: number): void {
    vi.stubGlobal('innerWidth', largura)
    vi.stubGlobal('innerHeight', altura)
  }

  function abrir(x: number, y: number, comAndar = false): HTMLElement {
    act(() =>
      root.render(
        <PointActionMenu
          screenX={x}
          screenY={y}
          onSignal={vi.fn()}
          onChoose={vi.fn()}
          onClose={vi.fn()}
          walk={comAndar ? { canWalk: false, onWalk: vi.fn() } : undefined}
        />,
      ),
    )
    const menu = container.querySelector<HTMLElement>('[role="menu"]')
    if (menu === null) throw new Error('sem o menu')
    return menu
  }

  /** A origem em px, contada do canto de cima à esquerda do menu. */
  function origem(menu: HTMLElement): { x: number; y: number } {
    const [x = '', y = ''] = menu.style.transformOrigin.split(' ')
    return { x: Number.parseFloat(x), y: Number.parseFloat(y) }
  }

  /** O ponto da tela de onde a escala parte: o canto do menu mais a origem. */
  function origemNaTela(menu: HTMLElement): { x: number; y: number } {
    const { x, y } = origem(menu)
    return { x: Number.parseFloat(menu.style.left) + x, y: Number.parseFloat(menu.style.top) + y }
  }

  it('com espaço à direita e abaixo, a escala parte do dedo, logo fora do canto de cima à esquerda', () => {
    janela(1024, 768)
    const menu = abrir(200, 150)
    expect(origem(menu)).toEqual({ x: -POINT_MENU_OFFSET_PX, y: -POINT_MENU_OFFSET_PX })
    expect(origemNaTela(menu)).toEqual({ x: 200, y: 150 })
  })

  it('no canto de baixo à direita o menu vira e a escala parte do canto de baixo à direita, onde está o dedo', () => {
    janela(1024, 768)
    const menu = abrir(1004, 748)
    expect(origem(menu)).toEqual({ x: POINT_MENU_WIDTH_PX + POINT_MENU_OFFSET_PX, y: POINT_MENU_HEIGHT_PX + POINT_MENU_OFFSET_PX })
    expect(origemNaTela(menu)).toEqual({ x: 1004, y: 748 })
  })

  it('virado só para cima (pé da tela, lado esquerdo), a origem fica embaixo à esquerda', () => {
    janela(1024, 768)
    const menu = abrir(100, 748)
    expect(origem(menu)).toEqual({ x: -POINT_MENU_OFFSET_PX, y: POINT_MENU_HEIGHT_PX + POINT_MENU_OFFSET_PX })
  })

  it('virado só para a esquerda (borda direita, alto da tela), a origem fica em cima à direita', () => {
    janela(1024, 768)
    const menu = abrir(1004, 100)
    expect(origem(menu)).toEqual({ x: POINT_MENU_WIDTH_PX + POINT_MENU_OFFSET_PX, y: -POINT_MENU_OFFSET_PX })
  })

  it('com o "Andar até aqui", virado para cima, a origem conta a altura do item a mais', () => {
    janela(1024, 768)
    const menu = abrir(100, 748, true)
    expect(origem(menu).y).toBe(POINT_MENU_HEIGHT_PX + POINT_MENU_WALK_HEIGHT_PX + POINT_MENU_OFFSET_PX)
    expect(origemNaTela(menu)).toEqual({ x: 100, y: 748 })
  })

  it('sem espaço em cima nem embaixo (celular deitado), o menu fica preso à margem e a escala parte de dentro dele, no dedo', () => {
    janela(844, 390)
    const menu = abrir(400, 200, true)
    expect(origemNaTela(menu)).toEqual({ x: 400, y: 200 })
    expect(origem(menu).y).toBeGreaterThan(0)
    expect(origem(menu).y).toBeLessThan(POINT_MENU_HEIGHT_PX + POINT_MENU_WALK_HEIGHT_PX)
  })
})
