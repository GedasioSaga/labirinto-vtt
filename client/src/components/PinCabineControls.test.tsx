import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CabineDeTransporte } from '../lib/cabine'
import { PinCabineControls, type PinCabineControlsProps } from './PinCabineControls'

/**
 * CABINE DE TRANSPORTE no painel do pino (mestre): escolher a cabine da
 * parada, criar uma nova pelo nome, ler onde a cabine está e trazê-la.
 */

const AQUI = { sceneId: 'cena-terreo', pinId: 'grade-terreo' }
const LA = { sceneId: 'cena-topo', pinId: 'grade-topo' }
const ESPINHA: CabineDeTransporte = { id: 'cab-espinha', nome: 'Espinha', paradas: [AQUI, LA], atual: LA }

describe('PinCabineControls', () => {
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

  function montar(extra: Partial<PinCabineControlsProps> = {}) {
    const props: PinCabineControlsProps = {
      cabines: [ESPINHA],
      parada: AQUI,
      nomeDaCena: (sceneId) => (sceneId === LA.sceneId ? 'Topo do Farol' : 'Térreo'),
      onCriar: vi.fn(),
      onEscolher: vi.fn(),
      onTrazer: vi.fn(),
      onAtender: vi.fn(),
      onLimparFila: vi.fn(),
      ...extra,
    }
    act(() => root.render(<PinCabineControls {...props} />))
    return props
  }

  const select = (): HTMLSelectElement => {
    const el = container.querySelector('select')
    if (!(el instanceof HTMLSelectElement)) throw new Error('sem a lista de cabines')
    return el
  }
  const botao = (texto: string): HTMLButtonElement => {
    const el = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (el === undefined) throw new Error(`sem o botão ${texto}`)
    return el
  }

  it('parada de uma cabine que está em outra parada: diz onde e oferece trazer', () => {
    const props = montar()
    expect(select().value).toBe('cab-espinha')
    expect(container.textContent).toContain('A cabine está em outra parada (Topo do Farol).')
    act(() => botao('Trazer a cabine para cá').click())
    expect(props.onTrazer).toHaveBeenCalledWith('cab-espinha')
  })

  it('a cabine está aqui: diz isso e o trazer fica desligado', () => {
    montar({ cabines: [{ ...ESPINHA, atual: AQUI }] })
    expect(container.textContent).toContain('A cabine está aqui.')
    expect(botao('Trazer a cabine para cá').disabled).toBe(true)
  })

  it('o rótulo leva à lista, e trocar para Nenhuma tira a parada da cabine', () => {
    const props = montar()
    const label = container.querySelector(`label[for="${select().id}"]`)
    expect(label?.textContent).toBe('Cabine (elevador, cesto)')
    act(() => {
      select().value = ''
      select().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(props.onEscolher).toHaveBeenCalledWith(null)
  })

  it('pino sem cabine: cria uma nova pelo nome (Enter envia), e nome vazio avisa sem criar', () => {
    const props = montar({ cabines: [] })
    const campo = container.querySelector('input')
    if (!(campo instanceof HTMLInputElement)) throw new Error('sem o campo do nome')
    const form = campo.form
    if (form === null) throw new Error('o campo não está num formulário')
    act(() => form.requestSubmit())
    expect(props.onCriar).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Dê um nome à cabine.')
    expect(document.activeElement).toBe(campo)

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setValue?.call(campo, 'Cesto do poço')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => form.requestSubmit())
    expect(props.onCriar).toHaveBeenCalledWith('Cesto do poço')
  })
})
