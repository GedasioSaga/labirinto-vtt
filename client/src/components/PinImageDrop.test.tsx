import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinImageDrop, imagemDaTransferencia } from './PinImageDrop'

function transferencia(files: File[], items: { kind: string; type: string; getAsFile: () => File | null }[] = []): DataTransfer {
  return { files, items, types: files.length > 0 ? ['Files'] : [] } as unknown as DataTransfer
}

const png = new File(['x'], 'mapa.png', { type: 'image/png' })
const texto = new File(['x'], 'notas.txt', { type: 'text/plain' })

describe('imagemDaTransferencia', () => {
  it('acha a imagem entre os arquivos, pulando o que não é imagem', () => {
    expect(imagemDaTransferencia(transferencia([texto, png]))).toBe(png)
  })

  it('acha a imagem copiada do navegador, que chega só como item', () => {
    const item = { kind: 'file', type: 'image/png', getAsFile: () => png }
    expect(imagemDaTransferencia(transferencia([], [item]))).toBe(png)
  })

  it('devolve null sem imagem nenhuma', () => {
    expect(imagemDaTransferencia(transferencia([texto]))).toBeNull()
    expect(imagemDaTransferencia(null)).toBeNull()
  })
})

describe('PinImageDrop', () => {
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

  function montar(onImage: (blob: Blob) => void): HTMLElement {
    act(() => root.render(<PinImageDrop onImage={onImage} />))
    const area = container.querySelector<HTMLElement>('[role="region"]')
    if (area === null) throw new Error('sem a área')
    return area
  }

  /** O jsdom não tem ClipboardEvent/DragEvent com dados: o campo vai pendurado no Event. */
  function disparar(alvo: HTMLElement, tipo: 'paste' | 'drop', campo: 'clipboardData' | 'dataTransfer', data: DataTransfer): void {
    const event = new Event(tipo, { bubbles: true, cancelable: true })
    Object.defineProperty(event, campo, { value: data })
    act(() => {
      alvo.dispatchEvent(event)
    })
  }

  it('colar uma imagem entrega o arquivo', () => {
    const onImage = vi.fn()
    disparar(montar(onImage), 'paste', 'clipboardData', transferencia([png]))
    expect(onImage).toHaveBeenCalledWith(png)
  })

  it('soltar uma imagem entrega o arquivo', () => {
    const onImage = vi.fn()
    disparar(montar(onImage), 'drop', 'dataTransfer', transferencia([png]))
    expect(onImage).toHaveBeenCalledWith(png)
  })

  it('sem rótulo, a área continua sendo a do ponto de interesse; com rótulo, diz de quem é', () => {
    expect(montar(vi.fn()).getAttribute('aria-label')).toBe('Colar ou soltar imagem do ponto de interesse')
    act(() => root.render(<PinImageDrop onImage={vi.fn()} rotulo="Colar ou soltar imagem do token" />))
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Colar ou soltar imagem do token')
  })

  it('colar sem imagem avisa e não entrega nada', () => {
    const onImage = vi.fn()
    disparar(montar(onImage), 'paste', 'clipboardData', transferencia([texto]))
    expect(onImage).not.toHaveBeenCalled()
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/Não veio imagem/)
  })
})
