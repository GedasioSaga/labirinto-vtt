/**
 * MAPA NOVO nasce com "Fora do Chão" LIVRE (`MapData.offFloor`, pedido de
 * 12/11/2026): o mestre desenha Sala, textura e Chão e a ficha do jogador anda
 * e enxerga em tudo, sem esbarrar na borda do Chão. Mapa aberto do disco não
 * passa por esta tela e continua como foi salvo.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'
import { NewDungeonMap } from './NewDungeonMap'

describe('NewDungeonMap', () => {
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

  it('"Criar mapa" entrega o mapa com Fora do Chão livre', () => {
    const onCreate = vi.fn<(map: MapData) => void>()
    act(() => root.render(<NewDungeonMap onCreate={onCreate} onBack={vi.fn()} />))
    const form = container.querySelector('form')
    if (form === null) throw new Error('formulário do mapa novo ausente')
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]?.[0].offFloor).toBe('free')
  })

  it('caça 12/11 (P22): 2000 casas viram 500, o app avisa e o campo não fica barrado pelo navegador', () => {
    const onCreate = vi.fn<(map: MapData) => void>()
    act(() => root.render(<NewDungeonMap onCreate={onCreate} onBack={vi.fn()} />))
    const largura = container.querySelector<HTMLInputElement>('#lb-map-width')
    const form = container.querySelector('form')
    if (largura === null || form === null) throw new Error('formulário do mapa novo ausente')
    const aviso = () => container.querySelector('#lb-map-teto')?.textContent
    expect(aviso()).toBe('')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(largura, '2000')
      largura.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(aviso()).toBe('O mapa tem no máximo 500 casas de lado.')
    // Sem `max`, o navegador não barra o envio (rangeOverflow era o que impedia o mapa de nascer).
    expect(largura.validity.valid).toBe(true)
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]?.[0].width).toBe(500)
  })
})
