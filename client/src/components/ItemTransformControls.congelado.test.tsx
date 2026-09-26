import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONGELADO_HINT, ItemTransformControls, type ItemTransformControlsProps } from './ItemTransformControls'

/**
 * CONGELAR FICHA na ficha técnica: o interruptor "Congelado" mora logo abaixo
 * do "Travado", com o porquê à vista — Travado segura o mestre também;
 * Congelado segura só o jogador. Só a ficha liga (Objeto, Sala e Região não
 * têm jogador que as mova): sem os dois campos, o interruptor não existe.
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

function render(extra: Partial<ItemTransformControlsProps> = {}) {
  const props: ItemTransformControlsProps = { title: 'Trava e visibilidade', locked: false, onLockedChange: vi.fn(), secret: false, onSecretChange: vi.fn(), rarosNoAvancado: true, ...extra }
  act(() => root.render(<ItemTransformControls {...props} />))
  return props
}

const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
const interruptores = () => Array.from(container.querySelectorAll('label.lb-switch'))
const interruptor = (rotulo: string) => interruptores().find((l) => texto(l) === rotulo) ?? null
const caixa = (rotulo: string) => interruptor(rotulo)?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null

describe('ItemTransformControls — Congelado', () => {
  it('logo depois do Travado e antes do "Oculto para jogadores", com o porquê ligado ao interruptor', () => {
    render({ congelado: false, onCongeladoChange: vi.fn() })
    expect(interruptores().map(texto)).toEqual(['Travado', 'Congelado', 'Oculto para jogadores'])
    const hintId = caixa('Congelado')?.getAttribute('aria-describedby') ?? null
    expect(hintId === null ? null : document.getElementById(hintId)?.textContent).toBe(CONGELADO_HINT)
    expect(CONGELADO_HINT).toContain('jogador')
  })

  it('mostra o estado e o clique devolve o valor novo', () => {
    const onCongeladoChange = vi.fn()
    render({ congelado: true, onCongeladoChange })
    expect(caixa('Congelado')?.checked).toBe(true)
    act(() => caixa('Congelado')?.click())
    expect(onCongeladoChange).toHaveBeenCalledWith(false)
  })

  it('sem os campos (Objeto, Sala, Região): nenhum "Congelado"', () => {
    render()
    expect(interruptor('Congelado')).toBeNull()
  })
})
