import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * "Não, porque…" do pedido de passagem: o campo do motivo traz os motivos
 * recentes prontos. Um toque num deles responde com ele e tira o aviso; sem
 * motivo recente, o campo é o de sempre.
 */
describe('Toast: motivos recentes no campo de resposta', () => {
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

  function pedido(id: string, text: string, enviar: (texto: string) => void, recentes: readonly string[]): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text,
      grupo: 'Pedidos',
      actions: [
        { label: 'Deixar ir', run: vi.fn(), emLote: true },
        { label: 'Não', run: vi.fn() },
      ],
      resposta: { rotulo: 'Não, porque…', maxLength: 80, enviar, recentes: () => recentes },
    }
  }

  function botoes(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll('button'))
  }

  function abrirCampo(): void {
    act(() => botoes().find((b) => b.textContent === 'Não, porque…')?.click())
  }

  it('com o campo aberto, os motivos recentes aparecem num grupo com nome; tocar num responde com ele e tira o aviso', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', 'Felipe quer passar por Portão → Estrada', enviar, ['o portão fecha à noite', 'a ponte caiu'])]} onDismiss={onDismiss} />))
    // Fechado, o campo não mostra motivo nenhum: a linha continua curta.
    expect(container.querySelector('[role="group"]')).toBeNull()
    abrirCampo()
    const grupo = container.querySelector('[role="group"]')
    expect(grupo?.getAttribute('aria-label')).toBe('Motivos recentes')
    const motivos = Array.from(grupo?.querySelectorAll('button') ?? []).map((b) => b.textContent)
    expect(motivos).toEqual(['o portão fecha à noite', 'a ponte caiu'])
    act(() => botoes().find((b) => b.textContent === 'o portão fecha à noite')?.click())
    expect(enviar).toHaveBeenCalledWith('o portão fecha à noite')
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })

  it('o campo do motivo respeita o teto e, sem motivo recente, não mostra grupo vazio', () => {
    act(() => root.render(<Toast toasts={[pedido('t1', 'Felipe quer passar', vi.fn(), [])]} onDismiss={vi.fn()} />))
    abrirCampo()
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    expect(campo?.maxLength).toBe(80)
    expect(container.querySelector('[role="group"]')).toBeNull()
  })
})
