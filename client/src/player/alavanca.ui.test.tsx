import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from '../components/PinControls'
import { buildPin } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * ALAVANCA nas telas: o cartão do jogador oferece "Puxar a alavanca"; o painel
 * do mestre liga a alavanca a uma porta ("Abre a porta") e deixa acionar dali.
 */

const ALAVANCA: Pin = { ...buildPin('alav', { x: 100, y: 100 }, 'alavanca'), description: 'Uma alavanca enferrujada.' }

function painel(lever: PinControlsProps['lever']): PinControlsProps {
  return {
    kind: 'alavanca',
    onKindChange: vi.fn(),
    description: '',
    onDescriptionChange: vi.fn(),
    locked: false,
    onLockedChange: vi.fn(),
    marco: false,
    onMarcoChange: vi.fn(),
    lerDePerto: null,
    onLerDePertoChange: vi.fn(),
    image: null,
    onChooseImage: vi.fn(),
    onClearImage: vi.fn(),
    onDelete: vi.fn(),
    iconChoice: null,
    lever,
  }
}

describe('telas da alavanca', () => {
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

  const botoes = (): HTMLButtonElement[] => [...container.querySelectorAll('button')]
  const botao = (texto: string): HTMLButtonElement => {
    const achado = botoes().find((b) => b.textContent === texto)
    if (achado === undefined) throw new Error(`sem botão "${texto}" em: ${container.textContent ?? ''}`)
    return achado
  }
  const lista = (): HTMLSelectElement => {
    const achada = container.querySelector('select')
    if (achada === null) throw new Error('sem lista')
    return achada
  }

  it('cartão: a alavanca se chama Alavanca e "Puxar a alavanca" manda o pedido', () => {
    const onPull = vi.fn()
    act(() => root.render(<PlayerPinCard pin={ALAVANCA} stairs={[]} onClose={vi.fn()} onPullLever={onPull} />))
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Alavanca')
    expect(container.textContent).toContain('Uma alavanca enferrujada.')
    act(() => botao('Puxar a alavanca').click())
    expect(onPull).toHaveBeenCalledTimes(1)
  })

  it('cartão: pino que não é alavanca não oferece puxar, mesmo com o callback', () => {
    const marco: Pin = { ...ALAVANCA, kind: 'exclamacao' }
    act(() => root.render(<PlayerPinCard pin={marco} stairs={[]} onClose={vi.fn()} onPullLever={vi.fn()} />))
    expect(botoes().map((b) => b.textContent)).not.toContain('Puxar a alavanca')
  })

  it('painel: "Abre a porta" lista as portas e liga a escolhida; "Nenhuma" desliga', () => {
    const onChange = vi.fn()
    const opcoes = [
      { id: 'p1', label: 'Porta 1 · Cripta' },
      { id: 'p2', label: 'Porta 2' },
    ]
    act(() => root.render(<PinControls {...painel({ value: null, options: opcoes, onChange, onPull: vi.fn(), pullBlocked: null })} />))
    expect(container.querySelector('h2')?.textContent).toBe('Alavanca')
    const select = lista()
    expect(container.querySelector(`label[for="${select.id}"]`)?.textContent).toBe('Abre a porta')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Nenhuma', 'Porta 1 · Cripta', 'Porta 2'])
    act(() => {
      select.value = 'p2'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith('p2')
  })

  it('painel: com porta ligada, "Acionar agora" aciona; "Nenhuma" manda null', () => {
    const onChange = vi.fn()
    const onPull = vi.fn()
    act(() => root.render(<PinControls {...painel({ value: 'p1', options: [{ id: 'p1', label: 'Porta 1' }], onChange, onPull, pullBlocked: null })} />))
    expect(lista().value).toBe('p1')
    act(() => botao('Acionar agora').click())
    expect(onPull).toHaveBeenCalledTimes(1)
    act(() => {
      lista().value = ''
      lista().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('painel: porta trancada desliga "Acionar agora" e diz por quê', () => {
    act(() =>
      root.render(
        <PinControls
          {...painel({ value: 'p1', options: [{ id: 'p1', label: 'Porta 1' }], onChange: vi.fn(), onPull: vi.fn(), pullBlocked: 'A porta ligada está trancada: a alavanca não a move.' })}
        />,
      ),
    )
    expect(botao('Acionar agora').disabled).toBe(true)
    expect(container.textContent).toContain('A porta ligada está trancada: a alavanca não a move.')
  })

  it('painel: mapa sem porta desliga a lista e ensina o que fazer', () => {
    act(() => root.render(<PinControls {...painel({ value: null, options: [], onChange: vi.fn(), onPull: vi.fn(), pullBlocked: null })} />))
    expect(lista().disabled).toBe(true)
    expect(container.textContent).toContain('Ponha uma porta no mapa para ligar a alavanca.')
    expect(botoes().map((b) => b.textContent)).not.toContain('Acionar agora')
  })

  it('painel: a alavanca é um dos tipos do pino', () => {
    act(() => root.render(<PinControls {...painel(null)} />))
    const radios = [...container.querySelectorAll('[role="radio"]')].map((r) => r.textContent)
    expect(radios).toContain('Alavanca')
    expect(radios.length).toBe(4)
  })
})
