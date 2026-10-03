import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenImageControls } from './TokenImageControls'
import { ATRIBUTO_COLA_IMAGEM } from './PinImageDrop'

/**
 * "Imagem do token" ganha a mesma área do pino: arrastar uma imagem ou colar
 * com Ctrl+V, ACIMA do "Trocar imagem..." (ou do "Escolher imagem..."), que
 * continua lá.
 */

const png = new File(['x'], 'heroi.png', { type: 'image/png' })

function transferencia(files: File[]): DataTransfer {
  return { files, items: [], types: files.length > 0 ? ['Files'] : [] } as unknown as DataTransfer
}

describe('TokenImageControls: arrastar ou colar a imagem', () => {
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

  const montar = (image: string | null, onImageBlob?: (blob: Blob) => void) =>
    act(() => root.render(<TokenImageControls image={image} onChangeImage={() => {}} onImageBlob={onImageBlob} onClearImage={() => {}} onSaveToLibrary={() => {}} />))
  const area = () => container.querySelector<HTMLElement>('[role="region"]')
  const textos = () => Array.from(container.querySelectorAll('section > *')).map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '')

  function disparar(alvo: HTMLElement, tipo: 'paste' | 'drop', campo: 'clipboardData' | 'dataTransfer', data: DataTransfer): void {
    const event = new Event(tipo, { bubbles: true, cancelable: true })
    Object.defineProperty(event, campo, { value: data })
    act(() => {
      alvo.dispatchEvent(event)
    })
  }

  it('com imagem: a área fica entre o título e o "Trocar imagem...", com o nome do token', () => {
    montar('C:/mapas/m1/token_t1_original.png', vi.fn())
    expect(area()?.getAttribute('aria-label')).toBe('Colar ou soltar imagem do token')
    expect(area()?.hasAttribute(ATRIBUTO_COLA_IMAGEM)).toBe(true)
    const ordem = textos()
    expect(ordem.indexOf('Colar ou soltar imagem do token')).toBeLessThan(ordem.indexOf('Trocar imagem...'))
    expect(ordem).toContain('Remover imagem (voltar ao círculo)')
  })

  it('sem imagem: a área fica acima do "Escolher imagem..."', () => {
    montar(null, vi.fn())
    const ordem = textos()
    expect(ordem.indexOf('Colar ou soltar imagem do token')).toBeLessThan(ordem.indexOf('Escolher imagem...'))
  })

  it('soltar e colar entregam o arquivo', () => {
    const onImageBlob = vi.fn()
    montar(null, onImageBlob)
    const alvo = area()
    if (alvo === null) throw new Error('sem a área')
    disparar(alvo, 'drop', 'dataTransfer', transferencia([png]))
    disparar(alvo, 'paste', 'clipboardData', transferencia([png]))
    expect(onImageBlob).toHaveBeenCalledTimes(2)
    expect(onImageBlob).toHaveBeenCalledWith(png)
  })

  it('sem o retorno, sem a área (o painel continua só com o diálogo)', () => {
    montar(null)
    expect(area()).toBeNull()
  })
})
