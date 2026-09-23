import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import { RoomPanel } from './RoomPanel'
import { TABLE_LINK_WARNING, TableScreenSection, type TableScreenSectionProps } from './TableScreenSection'

const CENAS = [
  { key: 's-salao', name: 'Salão Norte' },
  { key: 's-cripta', name: 'Cripta Rubra' },
]

function props(overrides: Partial<TableScreenSectionProps> = {}): TableScreenSectionProps {
  return { url: 'http://10.0.0.2:7777/player?mesa=AB12CD', scenes: CENAS, sceneKey: null, screens: 0, onSceneChange: vi.fn(), ...overrides }
}

describe('TableScreenSection (aba Jogo)', () => {
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

  const select = () => {
    const found = container.querySelector<HTMLSelectElement>('select')
    if (found === null) throw new Error('sem seletor de cena')
    return found
  }

  it('mostra o link da TV e a cena escolhida, com rótulo associado', () => {
    act(() => root.render(<TableScreenSection {...props({ sceneKey: 's-cripta' })} />))
    expect(container.textContent).toContain('Tela da mesa')
    expect(container.textContent).toContain('http://10.0.0.2:7777/player?mesa=AB12CD')
    // O link leva a chave da tela: o mestre é avisado de não mandá-lo aos jogadores.
    expect(container.textContent).toContain(TABLE_LINK_WARNING)
    expect(select().value).toBe('s-cripta')
    const label = container.querySelector(`label[for="${select().id}"]`)
    expect(label?.textContent).toContain('Cena na tela')
    expect(Array.from(select().options).map((o) => o.textContent)).toEqual(['Nenhuma (tela espera)', 'Salão Norte', 'Cripta Rubra'])
  })

  it('escolher a cena chama onSceneChange; "Nenhuma" manda null', () => {
    const onSceneChange = vi.fn()
    act(() => root.render(<TableScreenSection {...props({ onSceneChange })} />))
    act(() => {
      select().value = 's-salao'
      select().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onSceneChange).toHaveBeenLastCalledWith('s-salao')
    act(() => root.render(<TableScreenSection {...props({ onSceneChange, sceneKey: 's-salao' })} />))
    act(() => {
      select().value = ''
      select().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onSceneChange).toHaveBeenLastCalledWith(null)
  })

  it('diz se a TV está conectada', () => {
    act(() => root.render(<TableScreenSection {...props({ screens: 0 })} />))
    expect(container.textContent).toContain('Nenhuma tela conectada')
    act(() => root.render(<TableScreenSection {...props({ screens: 1 })} />))
    expect(container.textContent).toContain('1 tela conectada')
  })

  it('cena escolhida que sumiu da lista não some calada: a opção continua, marcada', () => {
    act(() => root.render(<TableScreenSection {...props({ sceneKey: 's-velha' })} />))
    expect(select().value).toBe('s-velha')
    expect(container.textContent).toContain('Cena fechada')
  })
})

describe('RoomPanel com a seção da tela da mesa', () => {
  const noop = vi.fn()
  const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onRevealPlan: noop, onHidePlan: noop }
  const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777/player'], qrSvg: '<svg/>' }
  const IDLE: TunnelState = { kind: 'idle' }

  it('com a sala aberta, a seção aparece; fechada, não', () => {
    const aberta = renderToStaticMarkup(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} table={props()} />)
    expect(aberta).toContain('Tela da mesa')
    const fechada = renderToStaticMarkup(<RoomPanel room={null} players={[]} tokens={[]} tunnel={IDLE} {...handlers} table={props()} />)
    expect(fechada).not.toContain('Tela da mesa')
  })
})
