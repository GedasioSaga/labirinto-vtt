import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StairControls, type StairTravelProps } from './StairControls'

/**
 * "Leva a…" no painel da escada: escolher o andar liga (o painel não cria pino
 * nenhum à vista), o modo de passagem aparece só com a escada ligada, e
 * "Nenhum outro andar" desliga. Sem aventura, a seção nem aparece.
 */

function travel(extra: Partial<StairTravelProps> = {}): StairTravelProps {
  return {
    scenes: [
      { id: 'cena-andar1', name: '1º andar', available: true },
      { id: 'cena-porao', name: 'Porão', available: false },
    ],
    linkedSceneId: null,
    passage: 'pede',
    onLink: vi.fn(),
    onUnlink: vi.fn(),
    onPassageChange: vi.fn(),
    onCreateFloor: vi.fn(),
    ...extra,
  }
}

describe('StairControls: Leva a…', () => {
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

  function render(t: StairTravelProps | null): void {
    act(() =>
      root.render(<StairControls direction="up" onDirectionChange={() => {}} shape="straight" onShapeChange={() => {}} stepWidth={64} onStepWidthChange={() => {}} grid={64} travel={t} />),
    )
  }

  function escolher(select: HTMLSelectElement, value: string): void {
    act(() => {
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function modo(texto: string): HTMLButtonElement {
    const grupo = container.querySelector('[aria-label="Passagem da escada"]')
    const achado = Array.from(grupo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []).find((b) => b.textContent === texto)
    if (achado === undefined) throw new Error(`sem o modo "${texto}"`)
    return achado
  }

  it('sem ligação: lista os andares (o que não abriu, desligado) e escolher um liga com o modo escolhido antes', () => {
    const t = travel()
    render(t)
    const select = container.querySelector<HTMLSelectElement>('#lb-stair-leva-a')
    if (select === null) throw new Error('sem o campo "Leva a"')
    expect(container.querySelector('label[for="lb-stair-leva-a"]')?.textContent).toBe('Leva a')
    expect(Array.from(select.options).map((o) => [o.textContent, o.disabled])).toEqual([
      ['Nenhum outro andar', false],
      ['1º andar', false],
      ['Porão (não abriu)', true],
    ])
    // Sem ligação, o modo é só a escolha para a ligação que vem: não grava nada ainda.
    expect(modo('Pede ao mestre').getAttribute('aria-checked')).toBe('true')
    act(() => modo('Livre').click())
    expect(modo('Livre').getAttribute('aria-checked')).toBe('true')
    expect(t.onPassageChange).not.toHaveBeenCalled()
    escolher(select, 'cena-andar1')
    expect(t.onLink).toHaveBeenCalledWith('cena-andar1', 'livre')
    expect(t.onUnlink).not.toHaveBeenCalled()
  })

  it('ligada: mostra para onde leva e o modo de passagem; trocar o modo e desligar', () => {
    const t = travel({ linkedSceneId: 'cena-andar1', passage: 'pede' })
    render(t)
    const select = container.querySelector<HTMLSelectElement>('#lb-stair-leva-a')
    if (select === null) throw new Error('sem o campo "Leva a"')
    expect(select.value).toBe('cena-andar1')
    const modos = container.querySelector('[aria-label="Passagem da escada"]')
    // PASSAGEM POR PASSE (outra feature) entrou na ordem comum dos modos (`PIN_PASSAGE_ORDER`).
    expect(Array.from(modos?.querySelectorAll('[role="radio"]') ?? []).map((b) => [b.textContent, b.getAttribute('aria-checked')])).toEqual([
      ['Pede ao mestre', 'true'],
      ['Livre', 'false'],
      ['Com passe', 'false'],
      ['Trancada', 'false'],
    ])
    const livre = Array.from(modos?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []).find((b) => b.textContent === 'Livre')
    act(() => livre?.click())
    expect(t.onPassageChange).toHaveBeenCalledWith('livre')
    escolher(select, '')
    expect(t.onUnlink).toHaveBeenCalledTimes(1)
  })

  it('sem aventura (mapa solto): a seção "Leva a" não aparece', () => {
    render(null)
    expect(container.querySelector('#lb-stair-leva-a')).toBeNull()
    expect(container.querySelector('[aria-label="Sentido da escada"]')).not.toBeNull()
  })
})
