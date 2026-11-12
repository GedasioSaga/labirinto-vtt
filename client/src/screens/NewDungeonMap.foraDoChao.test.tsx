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
})
