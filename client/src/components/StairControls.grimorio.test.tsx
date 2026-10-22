import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StairControls, type StairControlsProps, type StairTamanhoProps } from './StairControls'

/**
 * O essencial da escada na gramática do Grimório (fatia 17'): Sentido, Forma
 * e Tamanho no seg, Comprimento e Largura no número, Curva no deslizante. Só
 * mudou o lugar e o visual: ids, nomes e o andar de meia casa são os de antes.
 */

const GRID = 64

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

function tamanho(extra: Partial<StairTamanhoProps> = {}): StairTamanhoProps {
  return { length: 4 * GRID, onLengthChange: vi.fn(), curve: { degrees: 0, maxDegrees: 120 }, onCurveChange: vi.fn(), ...extra }
}

function montar(extra: Partial<StairControlsProps> = {}): void {
  act(() =>
    root.render(
      <StairControls
        direction="up"
        onDirectionChange={vi.fn()}
        shape="straight"
        onShapeChange={vi.fn()}
        stepWidth={GRID}
        onStepWidthChange={vi.fn()}
        grid={GRID}
        travel={null}
        tamanho={tamanho()}
        parte="essencial"
        {...extra}
      />,
    ),
  )
}

const um = <T extends Element>(seletor: string): T => {
  const achado = container.querySelector<T>(seletor)
  if (!achado) throw new Error(`não achei ${seletor}`)
  return achado
}
const botao = (nome: string) => um<HTMLButtonElement>(`button[aria-label="${nome}"]`)
const grupo = (nome: string) => um<HTMLElement>(`[role="radiogroup"][aria-label="${nome}"]`)
const marcadas = (nome: string) => Array.from(grupo(nome).querySelectorAll('[role="radio"]')).map((r) => r.getAttribute('aria-checked'))
function teclar(el: Element, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('StairControls na gramática do Grimório', () => {
  it('cada campo é o primitivo, com os ids e nomes que os testes e o e2e procuram', () => {
    montar()
    for (const nome of ['Sentido da escada', 'Forma da escada', 'Tamanho da escada']) expect(grupo(nome).classList.contains('gr-seg')).toBe(true)
    expect(um('#lb-stair-length').closest('.gr-num')).not.toBeNull()
    expect(um('#lb-stair-step-width').closest('.gr-num')).not.toBeNull()
    expect(um<HTMLInputElement>('#lb-stair-curve').classList.contains('gr-faixa')).toBe(true)
    expect(um('#lb-stair-length').getAttribute('role')).toBe('spinbutton')
    expect(botao('Aumentar o comprimento').classList.contains('gr-num__passo')).toBe(true)
    expect(botao('Diminuir a largura').classList.contains('gr-num__passo')).toBe(true)
    // Na ficha os campos moram direto no cartão do essencial: nada de seção nem título de antes.
    expect(container.querySelector('section, h2, .lb-field, .lb-seg')).toBeNull()
  })

  it('a placa do Sentido vai dentro da opção, com o nome só do rótulo', () => {
    montar()
    const opcoes = Array.from(grupo('Sentido da escada').querySelectorAll('[role="radio"]'))
    expect(opcoes.map((o) => o.textContent)).toEqual(['Sobe', 'Desce'])
    expect(opcoes.every((o) => o.querySelector('svg.lb-escada-placa') !== null)).toBe(true)
  })

  it('a alça mexeu sem grade (4,37 casas): mostra 4,37, e − e + caem na meia casa mais perto', () => {
    const t = tamanho({ length: 4.37 * GRID })
    montar({ tamanho: t })
    expect(um<HTMLInputElement>('#lb-stair-length').value).toBe('4,37')
    act(() => botao('Aumentar o comprimento').click())
    expect(t.onLengthChange).toHaveBeenLastCalledWith(4.5 * GRID)
    act(() => botao('Diminuir o comprimento').click())
    expect(t.onLengthChange).toHaveBeenLastCalledWith(4 * GRID)
  })

  it('uma casa no singular; no mínimo o − fica aria-disabled, como antes', () => {
    montar({ tamanho: tamanho({ length: 0.25 * GRID }) })
    expect(um('#lb-stair-step-width').closest('.gr-campo')?.querySelector('.gr-campo__rot b')?.textContent).toBe('casa')
    expect(um('#lb-stair-length').closest('.gr-campo')?.querySelector('.gr-campo__rot b')?.textContent).toBe('casas')
    expect(botao('Diminuir o comprimento').getAttribute('aria-disabled')).toBe('true')
    expect(botao('Aumentar o comprimento').hasAttribute('aria-disabled')).toBe(false)
  })

  it('largura fora dos presets: nenhum Tamanho marcado; o preset escolhido grava a largura dele', () => {
    const onStepWidthChange = vi.fn()
    montar({ stepWidth: 1.25 * GRID, onStepWidthChange })
    expect(marcadas('Tamanho da escada')).toEqual(['false', 'false', 'false'])
    const media = Array.from(grupo('Tamanho da escada').querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((r) => r.textContent === 'Média')
    act(() => media?.click())
    expect(onStepWidthChange).toHaveBeenCalledTimes(1)
  })

  it('o seg anda pelas setas: Desce a partir de Sobe chama a troca de sentido', () => {
    const onDirectionChange = vi.fn()
    montar({ onDirectionChange })
    const sobe = grupo('Sentido da escada').querySelector('[role="radio"][aria-checked="true"]')
    if (!sobe) throw new Error('sem sentido marcado')
    teclar(sobe, 'ArrowRight')
    expect(onDirectionChange).toHaveBeenLastCalledWith('down')
  })

  it('curva: leitura "60°", o leitor de tela ouve "60 graus"; sem folga para curvar, o deslizante apaga', () => {
    montar({ tamanho: tamanho({ curve: { degrees: 60, maxDegrees: 90 } }) })
    const curva = um<HTMLInputElement>('#lb-stair-curve')
    expect(curva.closest('.gr-campo')?.querySelector('output')?.textContent).toBe('60°')
    expect(curva.getAttribute('aria-valuetext')).toBe('60 graus')
    expect(curva.disabled).toBe(false)
    montar({ tamanho: tamanho({ curve: { degrees: 0, maxDegrees: 0 } }) })
    expect(um<HTMLInputElement>('#lb-stair-curve').disabled).toBe(true)
    expect(um<HTMLInputElement>('#lb-stair-curve').getAttribute('aria-valuetext')).toBe('reta')
  })

  it('todo opcional ausente (sem tamanho, sem destino): só Sentido, Forma, Tamanho e Largura', () => {
    montar({ tamanho: undefined })
    expect(container.querySelector('#lb-stair-length')).toBeNull()
    expect(container.querySelector('#lb-stair-curve')).toBeNull()
    expect(container.querySelector('#lb-stair-step-width')).not.toBeNull()
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(3)
  })

  it('L e dupla (o schema tem, a UI não desenha): nenhuma Forma marcada e sem Curva', () => {
    montar({ shape: 'l', tamanho: tamanho({ curve: null }) })
    expect(marcadas('Forma da escada')).toEqual(['false', 'false'])
    expect(container.querySelector('#lb-stair-curve')).toBeNull()
    expect(container.querySelector('#lb-stair-step-width')).not.toBeNull()
  })
})
