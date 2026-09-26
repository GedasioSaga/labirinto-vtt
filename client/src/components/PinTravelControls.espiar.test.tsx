import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DA_VISTA_MAX_CASAS, DA_VISTA_PADRAO_CASAS } from '../lib/espiar'
import type { Pin } from '../types/map'
import { PinTravelControls, type PinTravelExitView } from './PinTravelControls'

/** ESPIAR — "Dá vista (N casas)" no painel do pino de viagem do mestre. */

const PAR: Pin = { id: 'boca', x: 0, y: 0, kind: 'viagem', description: 'Boca do poço', image: null }
const LIGADA: PinTravelExitView = { id: 'principal', rotulo: '', travel: { status: 'ligado', sceneId: 'cena-cripta', sceneName: 'Cripta', partner: PAR } }
const SOLTA: PinTravelExitView = { id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }

describe('PinTravelControls: Dá vista', () => {
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

  function render(exit: PinTravelExitView, daVista: number | null, onDaVistaChange: (casas: number | null) => void): void {
    act(() =>
      root.render(
        <PinTravelControls
          exits={[exit]}
          scenes={[]}
          pinsIn={() => []}
          onLinkNew={() => {}}
          onLinkExisting={() => {}}
          onUnlink={() => {}}
          onRename={() => {}}
          onGo={() => {}}
          passage="pede"
          onPassageChange={() => {}}
          motivo={undefined}
          onMotivoChange={() => {}}
          passItem=""
          onPassItemChange={() => {}}
          passTokens={[]}
          onPassTokenToggle={() => {}}
          onOneWayChange={() => {}}
          onBothSidesChange={() => {}}
          arrivalOnly={false}
          daVista={daVista}
          onDaVistaChange={onDaVistaChange}
        />,
      ),
    )
  }

  const botao = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Dá vista')

  it('ligar sugere o padrão de casas; desligar tira', () => {
    const onChange = vi.fn()
    render(LIGADA, null, onChange)
    expect(botao()?.getAttribute('aria-pressed')).toBe('false')
    act(() => botao()?.click())
    expect(onChange).toHaveBeenLastCalledWith(DA_VISTA_PADRAO_CASAS)
    render(LIGADA, 2, onChange)
    expect(botao()?.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('até 2 casas')
    act(() => botao()?.click())
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('o número de casas acima do teto é cortado no teto', () => {
    const onChange = vi.fn()
    render(LIGADA, 2, onChange)
    const campo = container.querySelector<HTMLInputElement>('input[type="number"]')
    if (campo === null) throw new Error('esperava o campo de casas')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo, '40')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith(DA_VISTA_MAX_CASAS)
  })

  it('sem a saída ligada não há o que espiar: o painel não oferece', () => {
    render(SOLTA, null, () => {})
    expect(botao()).toBeUndefined()
  })
})
