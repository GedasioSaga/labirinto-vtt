import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState } from '../../types/map'
import { FichaDaPorta } from './FichaDaPorta'
import { MedalhaDaPorta } from './MedalhaDaPorta'

/**
 * COR DA PORTA (fatia 22) na ficha Aparência: paleta, "Outra cor…" e "Cor
 * padrão" (que manda `null`, o campo ausente). A medalha da cabeça segue a cor.
 */
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

const FECHADA: DoorState = { open: false, locked: false, kind: 'normal' }

function render(door: DoorState, onCorChange?: (cor: string | null) => void) {
  const handlers = { onToggleDoor: vi.fn(), onToggleOpen: vi.fn(), onToggleLocked: vi.fn(), onToggleSemEspiar: vi.fn(), onToggleSecret: vi.fn(), onRevealPassage: vi.fn(), onOpensFromChange: vi.fn() }
  act(() => root.render(<FichaDaPorta door={door} {...handlers} onKindChange={vi.fn()} onCorChange={onCorChange} />))
}

function grupoDaCor(): HTMLElement | null {
  const rotulo = [...container.querySelectorAll('.gr-campo__rot')].find((r) => r.textContent === 'Cor da porta')
  return rotulo === undefined ? null : document.querySelector(`[role="radiogroup"][aria-labelledby="${rotulo.id}"]`)
}

function mudarValor(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!setter) throw new Error('sem o setter de value')
  act(() => {
    setter.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('FichaDaPorta: cor da porta', () => {
  it('sem o handler o campo não aparece', () => {
    render(FECHADA)
    expect(grupoDaCor()).toBeNull()
  })

  it('a paleta, "Outra cor…" e "Cor padrão" chamam onCorChange; o padrão chama null', () => {
    const onCorChange = vi.fn()
    render(FECHADA, onCorChange)
    const grupo = grupoDaCor()
    if (grupo === null) throw new Error('sem o campo "Cor da porta"')
    // Sem cor própria, nenhuma bolinha marcada, e o seletor nativo mostra o laranja de sempre.
    expect(grupo.querySelector('[role="radio"][aria-checked="true"]')).toBeNull()
    const azul = grupo.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Cor #79a9cc"]')
    if (azul === null) throw new Error('a paleta não tem o azul do protótipo')
    act(() => azul.click())
    expect(onCorChange).toHaveBeenLastCalledWith('#79a9cc')
    const outra = grupo.querySelector<HTMLInputElement>('input[type="color"][aria-label="Outra cor…"]')
    if (outra === null) throw new Error('sem "Outra cor…"')
    expect(outra.value).toBe('#d08c3a')
    // O seletor nativo avisa que a cor veio do arrasto: é ele que vira um Ctrl+Z só.
    mudarValor(outra, '#123456')
    expect(onCorChange).toHaveBeenLastCalledWith('#123456', true)
    const padrao = [...grupo.querySelectorAll('button')].find((b) => b.textContent === 'Cor padrão')
    if (padrao === undefined) throw new Error('sem "Cor padrão"')
    act(() => padrao.click())
    expect(onCorChange).toHaveBeenLastCalledWith(null)
  })

  it('cor da paleta marca a bolinha; cor fora dela marca o "Outra cor…"', () => {
    render({ ...FECHADA, cor: '#79a9cc' }, vi.fn())
    expect(grupoDaCor()?.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute('aria-label')).toBe('Cor #79a9cc')
    expect(container.querySelector('.lb-pin-outra-cor--marcada')).toBeNull()
    render({ ...FECHADA, cor: '#123456' }, vi.fn())
    expect(container.querySelector('.lb-pin-outra-cor--marcada')).not.toBeNull()
  })
})

describe('MedalhaDaPorta: segue a cor', () => {
  function medalha(porta: DoorState): SVGSVGElement | null {
    act(() => root.render(<MedalhaDaPorta porta={porta} />))
    return container.querySelector('svg.lb-medalha-porta')
  }

  it('com cor própria a folha leva a cor (e a trancada, a marca de trancada)', () => {
    const svg = medalha({ ...FECHADA, locked: true, cor: '#79a9cc' })
    expect(svg?.hasAttribute('data-cor')).toBe(true)
    expect(svg?.hasAttribute('data-trancada')).toBe(true)
    expect(svg?.style.getPropertyValue('--lb-porta-cor')).toBe('#79a9cc')
  })

  it('SEGURANÇA: sem cor, ou cor torta, nada vai para o CSS', () => {
    for (const porta of [FECHADA, { ...FECHADA, cor: 'red; background: url(x)' }]) {
      const svg = medalha(porta)
      expect(svg?.hasAttribute('data-cor')).toBe(false)
      expect(svg?.style.getPropertyValue('--lb-porta-cor')).toBe('')
    }
  })
})
