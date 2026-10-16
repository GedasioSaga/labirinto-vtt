/**
 * SOM DA MESA no mestre (pedido "sons"; lugar novo na fatia 4 do design
 * consolidado): o botão "Som" do topo da Sala, com a sala aberta, abre o pop
 * "Som da mesa" com a barra e o mudo; a página Mesa tem a ficha "Som da mesa"
 * com o volume no resumo e os mesmos controles à vista.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import { PREFERENCIA_DE_SOM_PADRAO, useSomStore } from '../stores/somStore'
import { TITULO_DO_SOM } from './ControleDeSom'
import { PaginaMesa } from './livro/PaginaMesa'
import { TopoDaSala } from './livro/TopoDaSala'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop }
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

describe('Som da mesa no livro da mesa', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    useSomStore.setState({ ...PREFERENCIA_DE_SOM_PADRAO })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** O botão "Som" do topo, que abre o pop "Som da mesa". */
  function som(): HTMLButtonElement | null {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')).find((b) => b.textContent === 'Som') ?? null
  }

  it('com a sala aberta, o botão Som do topo abre o pop "Som da mesa" com a barra (com o foco) e o mudo', () => {
    act(() => root.render(<TopoDaSala room={ROOM} players={[]} tunnel={IDLE} {...handlers} onToggleLaser={noop} />))
    const botao = som()
    if (botao === null) throw new Error('sem o botão Som')
    expect(botao.textContent).toBe('Som')
    expect(botao.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => botao.click())
    expect(botao.getAttribute('aria-expanded')).toBe('true')
    const pop = document.querySelector(`[role="dialog"][aria-label="${TITULO_DO_SOM}"]`)
    const barra = pop?.querySelector('input[type="range"]')
    expect(barra).not.toBeNull()
    expect(pop?.querySelector('button[aria-label="Mudo"]')).not.toBeNull()
    expect(document.activeElement).toBe(barra)
  })

  it('a página Mesa tem a ficha "Som da mesa": o volume no resumo, a barra e o mudo dentro', () => {
    act(() => root.render(<PaginaMesa room={ROOM} players={[]} />))
    const cabecalho = Array.from(container.querySelectorAll('.gr-ficha__cab')).find((b) => b.textContent?.startsWith(TITULO_DO_SOM))
    if (cabecalho === undefined) throw new Error('sem a ficha Som da mesa')
    expect(cabecalho.querySelector('.gr-ficha__resumo')?.textContent).toBe(`${Math.round(PREFERENCIA_DE_SOM_PADRAO.volume * 100)}%`)
    const ficha = cabecalho.closest('.gr-ficha')
    expect(ficha?.querySelector('input[type="range"]')).not.toBeNull()
    act(() => ficha?.querySelector<HTMLButtonElement>('button[aria-label="Mudo"]')?.click())
    expect(cabecalho.querySelector('.gr-ficha__resumo')?.textContent).toBe('Mudo')
  })

  it('sem sala aberta o topo não tem o botão Som', () => {
    act(() => root.render(<TopoDaSala room={null} players={[]} tunnel={IDLE} {...handlers} />))
    expect(som()).toBeNull()
  })
})
