import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinKind } from '../types/map'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * Painel do pino: "Só o círculo, sem haste". É propriedade do pino aberto (não
 * preferência do próximo), vale para qualquer tipo e fica no topo das opções,
 * logo depois da aparência do pino (tipo e ícone), antes do texto.
 */

const ROTULO = 'Só o círculo, sem haste'

describe('PinControls: só o círculo, sem haste', () => {
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

  function render(extra: Partial<PinControlsProps>): void {
    const props: PinControlsProps = {
      kind: 'exclamacao',
      onKindChange: () => {},
      description: 'Baú',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      onDelete: () => {},
      iconChoice: null,
      ...extra,
    }
    act(() => root.render(<PinControls {...props} />))
  }

  /** O checkbox do interruptor com este rótulo, ou `null` se ele não está na tela. */
  function interruptor(rotulo: string): HTMLInputElement | null {
    const label = Array.from(container.querySelectorAll('label.lb-switch')).find((l) => l.querySelector('span')?.textContent === rotulo)
    const input = label?.querySelector('input')
    return input instanceof HTMLInputElement ? input : null
  }

  it('ligar chama o pino sem haste; desligar devolve a haste', () => {
    const onSemHasteChange = vi.fn()
    render({ semHaste: false, onSemHasteChange })
    const toggle = interruptor(ROTULO)
    if (!toggle) throw new Error(`sem o interruptor "${ROTULO}"`)
    expect(toggle.checked).toBe(false)
    act(() => toggle.click())
    expect(onSemHasteChange).toHaveBeenLastCalledWith(true)

    render({ semHaste: true, onSemHasteChange })
    const ligado = interruptor(ROTULO)
    expect(ligado?.checked).toBe(true)
    act(() => ligado?.click())
    expect(onSemHasteChange).toHaveBeenLastCalledWith(false)
  })

  it('a dica diz que os jogadores também veem o pino assim', () => {
    render({ onSemHasteChange: () => {} })
    const toggle = interruptor(ROTULO)
    const dicaId = toggle?.getAttribute('aria-describedby')
    expect(dicaId).toBeTruthy()
    const dica = dicaId ? document.getElementById(dicaId) : null
    expect(dica?.textContent).toMatch(/jogadores também veem/)
  })

  it.each<PinKind>(['exclamacao', 'interrogacao', 'alavanca', 'viagem'])('aparece no pino do tipo %s', (kind) => {
    render({ kind, onSemHasteChange: () => {} })
    expect(interruptor(ROTULO)).not.toBeNull()
  })

  it('fica antes da descrição: a forma do pino vem antes do texto', () => {
    render({ onSemHasteChange: () => {} })
    const toggle = interruptor(ROTULO)
    const descricao = container.querySelector('#lb-pin-description')
    if (!toggle || !descricao) throw new Error('faltou o interruptor ou a descrição')
    expect(toggle.compareDocumentPosition(descricao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sem pino aberto não aparece: é do pino, não preferência do próximo', () => {
    render({ description: null, onSemHasteChange: () => {} })
    expect(interruptor(ROTULO)).toBeNull()
  })

  it('sem quem grave a escolha, o interruptor não entra', () => {
    render({ semHaste: false })
    expect(interruptor(ROTULO)).toBeNull()
  })
})
