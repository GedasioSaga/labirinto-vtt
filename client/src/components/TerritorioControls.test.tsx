import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerritorioControls, type TerritorioControlsProps } from './TerritorioControls'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * FACÇÃO E ALERTA, lado do mestre: o bloco "Território" (filtro "Quem manda
 * aqui", legenda das facções e o alerta da cena) e o campo "Facção" no painel
 * da Sala.
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

function renderTerritorio(overrides: Partial<TerritorioControlsProps> = {}): TerritorioControlsProps {
  const props: TerritorioControlsProps = {
    filtroLigado: false,
    onFiltroChange: vi.fn(),
    legenda: [
      { faccao: 'Guarda Carmesim', cor: '#c0504d', salas: 2 },
      { faccao: 'Sindicato das Cinzas', cor: '#4f81bd', salas: 1 },
    ],
    alerta: 'calmo',
    onAlertaChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<TerritorioControls {...props} />))
  return props
}

function interruptor(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(rotulo))
  const input = label?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem o interruptor "${rotulo}"`)
  return input
}

function radio(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  const input = label?.querySelector('input[type="radio"]')
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem a opção "${rotulo}"`)
  return input
}

describe('TerritorioControls', () => {
  it('ligar "Quem manda aqui" avisa o callback', () => {
    const props = renderTerritorio()
    const filtro = interruptor('Quem manda aqui')
    expect(filtro.checked).toBe(false)
    act(() => filtro.click())
    expect(props.onFiltroChange).toHaveBeenCalledWith(true)
  })

  it('a legenda lista cada facção com a cor e quantas salas ela manda', () => {
    renderTerritorio({ filtroLigado: true })
    const itens = [...container.querySelectorAll('[data-testid="legenda-faccao"]')]
    expect(itens.map((i) => i.textContent)).toEqual(['Guarda Carmesim · 2 salas', 'Sindicato das Cinzas · 1 sala'])
    const amostra = itens[0].querySelector('[data-testid="cor-faccao"]')
    expect(amostra instanceof HTMLElement ? amostra.style.backgroundColor : '').toBe('rgb(192, 80, 77)')
  })

  it('sem facção nenhuma, diz onde escolher uma', () => {
    renderTerritorio({ legenda: [] })
    expect(container.textContent).toContain('Nenhuma sala tem facção')
    expect(container.querySelector('[data-testid="legenda-faccao"]')).toBeNull()
  })

  it('o alerta da cena é um grupo de três opções, com a atual marcada', () => {
    renderTerritorio({ alerta: 'atento' })
    const grupo = container.querySelector('fieldset')
    expect(grupo?.querySelector('legend')?.textContent).toBe('Alerta da cena')
    expect(radio('Calmo').checked).toBe(false)
    expect(radio('Atento').checked).toBe(true)
    expect(radio('Caçada').checked).toBe(false)
  })

  it('escolher Caçada sobe o alerta', () => {
    const props = renderTerritorio()
    act(() => radio('Caçada').click())
    expect(props.onAlertaChange).toHaveBeenCalledWith('cacada')
  })

  it('o painel diz que facção e alerta nunca vão para os jogadores', () => {
    renderTerritorio()
    const grupo = container.querySelector('fieldset')
    const dica = document.getElementById(grupo?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toMatch(/jogadores não/i)
  })
})

function renderSala(overrides: Partial<RoomControlsProps> = {}): RoomControlsProps {
  const props: RoomControlsProps = {
    name: 'Quartel',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 300,
    height: 300,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    faccao: '',
    onFaccaoChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

function campoFaccao(): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Facção')
  const alvo = label ? document.getElementById(label.htmlFor) : null
  if (!(alvo instanceof HTMLInputElement)) throw new Error('o painel da sala não tem o campo "Facção"')
  return alvo
}

function digitar(alvo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, valor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('RoomControls: campo Facção', () => {
  it('mostra a facção gravada e digitar avisa o callback', () => {
    const props = renderSala({ faccao: 'Guarda Carmesim' })
    const campo = campoFaccao()
    expect(campo.value).toBe('Guarda Carmesim')
    digitar(campo, 'Sindicato')
    expect(props.onFaccaoChange).toHaveBeenLastCalledWith('Sindicato')
  })

  it('sala sem facção dentro de distrito mostra de quem herda', () => {
    renderSala({ faccaoHerdada: 'Guarda Carmesim' })
    const campo = campoFaccao()
    expect(campo.value).toBe('')
    const dica = document.getElementById(campo.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('Guarda Carmesim')
  })

  it('sugere as facções que já existem no mapa', () => {
    renderSala({ faccoesConhecidas: ['Guarda Carmesim', 'Sindicato das Cinzas'] })
    const lista = document.getElementById(campoFaccao().getAttribute('list') ?? '')
    expect([...(lista?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual(['Guarda Carmesim', 'Sindicato das Cinzas'])
  })

  it('sem o callback, o campo não aparece', () => {
    renderSala({ onFaccaoChange: undefined })
    expect([...container.querySelectorAll('label')].some((l) => l.textContent?.trim() === 'Facção')).toBe(false)
  })
})
