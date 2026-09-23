import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAYER_IDS, type LayerId } from '../types/map'
import { LayersPanel } from './LayersPanel'

const COUNTS: Record<LayerId, number> = {
  paredes: 3,
  portas: 1,
  salas: 0,
  escadas: 0,
  objetos: 2,
  decoracao: 0,
  iluminacao: 0,
  tokens: 4,
  anotacoes: 0,
}

/** Estado real (useState) para provar que aria-pressed e o nome acompanham o
 *  toggle, e espiões para provar que cada botão chama o callback certo. */
function Harness({ onLayer, onLock }: { onLayer: (id: LayerId) => void; onLock: (id: LayerId) => void }) {
  const [hidden, setHidden] = useState<LayerId[]>([])
  const [locked, setLocked] = useState<LayerId[]>([])
  const flip = (list: LayerId[], id: LayerId) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  return (
    <LayersPanel
      hiddenLayers={hidden}
      lockedLayers={locked}
      counts={COUNTS}
      onToggleLayer={(id) => {
        onLayer(id)
        setHidden((list) => flip(list, id))
      }}
      onToggleLock={(id) => {
        onLock(id)
        setLocked((list) => flip(list, id))
      }}
    />
  )
}

describe('LayersPanel (lista compacta)', () => {
  let container: HTMLDivElement
  let root: Root
  let onLayer: ReturnType<typeof vi.fn<(id: LayerId) => void>>
  let onLock: ReturnType<typeof vi.fn<(id: LayerId) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onLayer = vi.fn<(id: LayerId) => void>()
    onLock = vi.fn<(id: LayerId) => void>()
    act(() => root.render(<Harness onLayer={onLayer} onLock={onLock} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const button = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (el) => el.getAttribute('aria-label') === name,
    )
    if (found === undefined) throw new Error(`sem botão ${name}`)
    return found
  }

  it('uma linha por camada, com nome, contagem e 2 botões de ícone', () => {
    const rows = container.querySelectorAll('li')
    expect(rows).toHaveLength(LAYER_IDS.length)
    const walls = Array.from(rows).find((row) => row.textContent?.startsWith('Paredes'))
    expect(walls?.textContent).toBe('Paredes3')
    expect(walls?.querySelectorAll('button.lb-iconbtn')).toHaveLength(2)
    // Ícone decorativo: o nome acessível vem só do aria-label.
    expect(walls?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('olho chama onToggleLayer com a camada da linha e troca nome/aria-pressed', () => {
    const eye = button('Ocultar Paredes')
    expect(eye.getAttribute('aria-pressed')).toBe('false')
    act(() => eye.click())
    expect(onLayer).toHaveBeenCalledTimes(1)
    expect(onLayer).toHaveBeenCalledWith('paredes')
    expect(onLock).not.toHaveBeenCalled()
    const shown = button('Mostrar Paredes')
    expect(shown.getAttribute('aria-pressed')).toBe('true')
    expect(shown.closest('li')?.hasAttribute('data-hidden')).toBe(true)
    // As outras camadas não mudam.
    expect(button('Ocultar Portas').getAttribute('aria-pressed')).toBe('false')

    act(() => shown.click())
    expect(onLayer).toHaveBeenLastCalledWith('paredes')
    expect(button('Ocultar Paredes').getAttribute('aria-pressed')).toBe('false')
  })

  it('cadeado chama onToggleLock com a camada da linha e troca nome/aria-pressed', () => {
    const lock = button('Travar Tokens')
    expect(lock.getAttribute('aria-pressed')).toBe('false')
    act(() => lock.click())
    expect(onLock).toHaveBeenCalledTimes(1)
    expect(onLock).toHaveBeenCalledWith('tokens')
    expect(onLayer).not.toHaveBeenCalled()
    expect(button('Destravar Tokens').getAttribute('aria-pressed')).toBe('true')

    act(() => button('Destravar Tokens').click())
    expect(onLock).toHaveBeenLastCalledWith('tokens')
    expect(button('Travar Tokens').getAttribute('aria-pressed')).toBe('false')
  })
})
