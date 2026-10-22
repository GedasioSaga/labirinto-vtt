import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chaveDaCorDaPorta, portaComCor } from '../../lib/corDaPorta'
import { createEmptyMap } from '../../lib/mapFactory'
import { useMapStore } from '../../stores/mapStore'
import type { DoorState, Wall } from '../../types/map'
import type { CorDaPortaProps } from './CorDaPorta'
import { FichaDaPorta } from './FichaDaPorta'
import { MedalhaDaPorta } from './MedalhaDaPorta'

/**
 * COR DA PORTA (fatia 22) na ficha Aparência: paleta, "Outra cor…" e "Cor
 * padrão" (que manda `null`, o campo ausente). Cada abertura de "Outra cor…" é
 * um arrasto, um Ctrl+Z. A medalha da cabeça segue a cor.
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

function render(door: DoorState, onCorChange?: CorDaPortaProps['onCorChange']) {
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

/** O que a caixa do sistema faz ao fechar: UM `change` nativo, depois dos `input` do arrasto. */
function fecharSeletor(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function seletor(): HTMLInputElement {
  const outra = container.querySelector<HTMLInputElement>('input[type="color"][aria-label="Outra cor…"]')
  if (outra === null) throw new Error('sem "Outra cor…"')
  return outra
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
    // O seletor nativo diz de que abertura a cor veio: é ela que vira um Ctrl+Z só.
    mudarValor(outra, '#123456')
    expect(onCorChange).toHaveBeenLastCalledWith('#123456', expect.any(String))
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

  it('o "change" de quando a caixa fecha encerra o arrasto: a abertura seguinte tem outra chave', () => {
    const onCorChange = vi.fn<CorDaPortaProps['onCorChange']>()
    render(FECHADA, onCorChange)
    mudarValor(seletor(), '#111111')
    mudarValor(seletor(), '#222222')
    fecharSeletor(seletor())
    mudarValor(seletor(), '#333333')
    const aberturas = onCorChange.mock.calls.map(([, abertura]) => abertura)
    expect(aberturas[0]).toEqual(expect.any(String))
    expect(aberturas[1]).toBe(aberturas[0])
    expect(aberturas[2]).not.toBe(aberturas[0])
    // O `change` sozinho não grava cor: só os três `input`.
    expect(onCorChange).toHaveBeenCalledTimes(3)
  })

  it('ficha remontada (Aparência recolhida e aberta) não emenda no arrasto da ficha de antes', () => {
    const onCorChange = vi.fn<CorDaPortaProps['onCorChange']>()
    render(FECHADA, onCorChange)
    mudarValor(seletor(), '#111111')
    fecharSeletor(seletor())
    act(() => root.unmount())
    root = createRoot(container)
    render(FECHADA, onCorChange)
    mudarValor(seletor(), '#222222')
    const [primeira, segunda] = onCorChange.mock.calls.map(([, abertura]) => abertura)
    expect(segunda).not.toBe(primeira)
  })
})

describe('FichaDaPorta: cor da porta ligada ao mapa, como o App', () => {
  const PAREDE: Wall = { id: 'd', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: FECHADA }
  const porta = () => useMapStore.getState().map.walls[0].door

  /** O `handleDoorCorChange` do App. */
  const aoMudarCor: CorDaPortaProps['onCorChange'] = (cor, abertura) => {
    const door = porta()
    if (door === null) throw new Error('a parede perdeu a porta')
    useMapStore.getState().setWallDoor('d', portaComCor(door, cor), chaveDaCorDaPorta('d', abertura))
  }

  it('arrastar até o verde, fechar, abrir e arrastar até o rosa: dois Ctrl+Z, sem pular o verde', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 10, 10, 40), walls: [PAREDE] })
    render(FECHADA, aoMudarCor)
    for (const cor of ['#5a9a90', '#3f9a52']) mudarValor(seletor(), cor)
    fecharSeletor(seletor())
    for (const cor of ['#8f7a70', '#e05a9c']) mudarValor(seletor(), cor)
    fecharSeletor(seletor())
    expect(porta()?.cor).toBe('#e05a9c')
    useMapStore.getState().undo()
    expect(porta()?.cor).toBe('#3f9a52')
    useMapStore.getState().undo()
    expect(porta()).toEqual(FECHADA)
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
