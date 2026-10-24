// @vitest-environment jsdom
/**
 * "Acesa em: Dia / Tarde / Noite" no painel da luz (Luz L3): liga e desliga de
 * vários (`aria-pressed`); campo ausente = os três marcados; com a regra do
 * estado a escolha fica parada e diz por quê; sem o handler, não aparece.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Periodo } from '../types/map'
import { LightControls, type LightControlsProps } from './LightControls'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function montar(overrides: Partial<LightControlsProps> = {}): LightControlsProps {
  const props: LightControlsProps = {
    color: '#ffba7b',
    onColorChange: vi.fn(),
    intensity: 0.85,
    onIntensityChange: vi.fn(),
    tokens: [],
    attachedTokenId: null,
    onAttach: vi.fn(),
    onDetach: vi.fn(),
    onAcesaEmChange: vi.fn(),
    ...overrides,
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  const r = createRoot(host)
  root = r
  act(() => r.render(<LightControls {...props} />))
  return props
}

function grupo(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="group"]')).find((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === 'Acesa em') ?? null
}

function botao(rotulo: string): HTMLButtonElement {
  const achado = Array.from(grupo()?.querySelectorAll('button') ?? []).find((b) => b.textContent === rotulo)
  if (achado === undefined) throw new Error(`sem o botão ${rotulo}`)
  return achado
}

function marcados(): string[] {
  return Array.from(grupo()?.querySelectorAll('button') ?? []).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent ?? '')
}

describe('LightControls — Acesa em', () => {
  it('luz sem o campo: os três marcados; desmarcar Dia grava tarde e noite', () => {
    const props = montar()
    expect(marcados()).toEqual(['Dia', 'Tarde', 'Noite'])
    act(() => botao('Dia').click())
    expect(props.onAcesaEmChange).toHaveBeenCalledWith(['tarde', 'noite'])
  })

  it('luz da tarde e da noite: marcar Dia grava os três', () => {
    const props = montar({ acesaEm: ['tarde', 'noite'] })
    expect(marcados()).toEqual(['Tarde', 'Noite'])
    act(() => botao('Dia').click())
    const gravado = vi.mocked(props.onAcesaEmChange)?.mock.calls[0]?.[0] ?? []
    expect([...gravado].sort()).toEqual<Periodo[]>(['dia', 'noite', 'tarde'])
  })

  it('nenhum marcado: diz que a luz não acende nas cenas externas', () => {
    montar({ acesaEm: [] })
    expect(marcados()).toEqual([])
    expect(document.body.textContent).toContain('Nenhum período marcado')
  })

  it('com a regra do estado: os botões ficam parados e a dica diz que o estado manda', () => {
    montar({ acesaEm: ['noite'], porEstado: { estadoId: 'energia', efeitos: [] } })
    expect(botao('Noite').disabled).toBe(true)
    expect(document.body.textContent).toContain('segue o estado do mundo')
  })

  it('sem onAcesaEmChange a escolha não aparece', () => {
    montar({ onAcesaEmChange: undefined })
    expect(grupo()).toBeNull()
  })
})
