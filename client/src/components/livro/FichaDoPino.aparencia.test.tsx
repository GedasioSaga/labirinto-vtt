import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinKind } from '../../types/map'
import { PinControls } from '../PinControls'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

/**
 * Ficha do pino (fatia 12), "Só o círculo, sem haste": é propriedade do pino
 * aberto (não preferência do próximo), vale para qualquer tipo e mora na ficha
 * recolhida "Aparência", que nasce fechada como no protótipo. Portado de
 * `PinControls.semHaste.test.tsx`, do painel de antes.
 */

const ROTULO = 'Só o círculo, sem haste'

describe('FichaDoPino: só o círculo, sem haste', () => {
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
    window.localStorage.clear()
  })

  function render(extra: Partial<FichaDoPinoProps>): void {
    const props: FichaDoPinoProps = {
      pinId: 'pin-1',
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
      iconChoice: null,
      quemVe: null,
      ...extra,
    }
    act(() => root.render(<FichaDoPino {...props} />))
  }

  /** O checkbox do interruptor com este rótulo, ou `null` se ele não está na tela. */
  function interruptor(rotulo: string): HTMLInputElement | null {
    const label = Array.from(container.querySelectorAll('label.lb-switch')).find((l) => l.querySelector('span')?.textContent === rotulo)
    const input = label?.querySelector('input')
    return input instanceof HTMLInputElement ? input : null
  }

  /** O cabeçalho da ficha recolhida "Aparência" (o nome dele leva o resumo). */
  function cabecalhoDaAparencia(): HTMLButtonElement | null {
    const botao = Array.from(container.querySelectorAll('button[aria-expanded]')).find((b) => (b.textContent ?? '').includes('Aparência'))
    return botao instanceof HTMLButtonElement ? botao : null
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

  it('mora na ficha "Aparência", que nasce fechada: a forma do pino é aparência, fora do essencial', () => {
    render({ onSemHasteChange: () => {} })
    const toggle = interruptor(ROTULO)
    const cabecalho = cabecalhoDaAparencia()
    if (!toggle || !cabecalho) throw new Error('faltou o interruptor ou a ficha "Aparência"')
    expect(cabecalho.getAttribute('aria-expanded')).toBe('false')
    expect(cabecalho.closest('.gr-ficha')?.contains(toggle)).toBe(true)
  })

  it('sem quem grave a escolha, o interruptor não entra', () => {
    render({ semHaste: false })
    expect(interruptor(ROTULO)).toBeNull()
  })

  it('sem pino aberto (a ferramenta Pino na mão) não aparece: é do pino, não preferência do próximo', () => {
    act(() =>
      root.render(
        <PinControls
          kind="exclamacao"
          onKindChange={() => {}}
          description={null}
          onDescriptionChange={() => {}}
          locked={false}
          onLockedChange={() => {}}
          marco={false}
          onMarcoChange={() => {}}
          lerDePerto={null}
          onLerDePertoChange={() => {}}
          image={null}
          onChooseImage={() => {}}
          onClearImage={() => {}}
          onDelete={() => {}}
          iconChoice={null}
          onSemHasteChange={() => {}}
        />,
      ),
    )
    expect(interruptor(ROTULO)).toBeNull()
  })
})
