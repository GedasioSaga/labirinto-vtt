/**
 * O CAMPO DE RESPOSTA do aviso (agir sobre uma ficha): o mestre escreve o que
 * o NPC responde e aperta Aceitar ou Recusar; o texto vai para a `run` do
 * botão. Vale no aviso solto e na linha da caixa "Pedidos (N)".
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * Aviso que pede um TEXTO de volta ("Responder" do chamado): o botão abre um
 * campo na própria linha; Enter envia e tira o aviso, Esc fecha o campo e o
 * aviso continua. E o botão que "mantém" ("Ir lá") age sem tirar o aviso.
 */
describe('Toast: responder dentro do aviso', () => {
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

  function chamado(id: string, text: string, enviar: (texto: string) => void, irLa = vi.fn()): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text,
      grupo: 'Chamados',
      actions: [
        { label: 'Ir lá', run: irLa, mantem: true },
        { label: 'Visto', run: vi.fn() },
      ],
      resposta: { rotulo: 'Responder', maxLength: 500, enviar },
    }
  }

  function botoes(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll('button'))
  }

  function digita(campo: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function render(toasts: ToastMessage[], onDismiss: (id: string) => void): void {
    act(() => root.render(<Toast toasts={toasts} onDismiss={onDismiss} />))
  }

  it('aviso solto: Responder abre o campo, Enviar manda o texto e tira o aviso', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    render([chamado('t1', 'Carla: Pergunta', enviar)], onDismiss)
    expect(botoes().map((b) => b.textContent)).toEqual(['Ir lá', 'Visto', 'Responder', '×'])
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    if (campo === null) throw new Error('sem campo')
    expect(document.activeElement).toBe(campo)
    expect(campo.getAttribute('aria-label')).toBe('Resposta para Carla: Pergunta')
    digita(campo, 'Pode usar.')
    act(() => campo.form?.requestSubmit())
    expect(enviar).toHaveBeenCalledWith('Pode usar.')
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })

  it('resposta vazia não sai; Esc fecha o campo, o aviso fica e o foco volta ao Responder', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    render([chamado('t1', 'Carla: Pergunta', enviar)], onDismiss)
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const enviarBtn = botoes().find((b) => b.textContent === 'Enviar')
    expect(enviarBtn?.disabled).toBe(true)
    const campo = container.querySelector<HTMLInputElement>('input[type="text"]')
    act(() => {
      campo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('input[type="text"]')).toBeNull()
    expect(enviar).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
    expect(document.activeElement?.textContent).toBe('Responder')
  })

  it('"Ir lá" (mantém) age sem tirar o aviso; na caixa, sem "Deixar todos" para quem não tem ação em lote', () => {
    const irLa = vi.fn()
    const onDismiss = vi.fn()
    render([chamado('t1', 'Duda: Quero agir', vi.fn(), irLa), chamado('t2', 'Carla: Pergunta', vi.fn())], onDismiss)
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Chamados (2)')
    expect(botoes().some((b) => b.textContent === 'Deixar todos')).toBe(false)
    act(() => botoes().find((b) => b.textContent === 'Ir lá')?.click())
    expect(irLa).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
    // Responder também funciona na linha da caixa.
    act(() => botoes().filter((b) => b.textContent === 'Responder')[1]?.click())
    expect(container.querySelector<HTMLInputElement>('input[type="text"]')?.getAttribute('aria-label')).toBe('Resposta para Carla: Pergunta')
  })

  function campoPara(texto: string): HTMLInputElement | null {
    return container.querySelector<HTMLInputElement>(`input[aria-label="Resposta para ${texto}"]`)
  }

  it('chamado novo chegando enquanto o mestre escreve: aviso vira caixa e a resposta continua lá, com o foco', () => {
    const duda = chamado('t1', 'Duda: Quero agir', vi.fn())
    render([duda], vi.fn())
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const campo = campoPara('Duda: Quero agir')
    if (campo === null) throw new Error('sem campo')
    digita(campo, 'Pode abrir o')
    // A Carla chama: a pilha passa de 1 para 2 linhas e vira a caixa "Chamados (2)".
    render([duda, chamado('t2', 'Carla: Pergunta', vi.fn())], vi.fn())
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Chamados (2)')
    const depois = campoPara('Duda: Quero agir')
    expect(depois?.value).toBe('Pode abrir o')
    expect(document.activeElement).toBe(depois)
    // Só a linha da Duda está respondendo; a da Carla segue com o botão.
    expect(campoPara('Carla: Pergunta')).toBeNull()
  })

  it('chamado saindo enquanto o mestre escreve: caixa vira aviso solto e a resposta continua, e ainda envia', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    const carla = chamado('t2', 'Carla: Pergunta', enviar)
    render([chamado('t1', 'Duda: Quero agir', vi.fn()), carla], onDismiss)
    act(() => botoes().filter((b) => b.textContent === 'Responder')[1]?.click())
    const campo = campoPara('Carla: Pergunta')
    if (campo === null) throw new Error('sem campo')
    digita(campo, 'Sim, com a corda.')
    // A Duda baixa a mão: a caixa volta a ser o aviso solto da Carla.
    render([carla], onDismiss)
    expect(container.querySelector('[role="region"]')).toBeNull()
    const depois = campoPara('Carla: Pergunta')
    expect(depois?.value).toBe('Sim, com a corda.')
    expect(document.activeElement).toBe(depois)
    act(() => depois?.form?.requestSubmit())
    expect(enviar).toHaveBeenCalledWith('Sim, com a corda.')
    expect(onDismiss).toHaveBeenCalledWith('t2')
  })

  it('resposta aberta sem o foco nela: a troca mantém o rascunho e não rouba o foco', () => {
    const duda = chamado('t1', 'Duda: Quero agir', vi.fn())
    render([duda], vi.fn())
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const campo = campoPara('Duda: Quero agir')
    if (campo === null) throw new Error('sem campo')
    digita(campo, 'Espera')
    // O mestre volta para o mapa (fora da pilha de avisos) antes de a Carla chamar.
    const fora = document.createElement('button')
    document.body.appendChild(fora)
    act(() => fora.focus())
    render([duda, chamado('t2', 'Carla: Pergunta', vi.fn())], vi.fn())
    expect(campoPara('Duda: Quero agir')?.value).toBe('Espera')
    expect(document.activeElement).toBe(fora)
    fora.remove()
  })

  it('Cancelar esquece o rascunho: a troca seguinte não reabre o campo', () => {
    const duda = chamado('t1', 'Duda: Quero agir', vi.fn())
    render([duda], vi.fn())
    act(() => botoes().find((b) => b.textContent === 'Responder')?.click())
    const campo = campoPara('Duda: Quero agir')
    if (campo === null) throw new Error('sem campo')
    digita(campo, 'rascunho')
    act(() => botoes().find((b) => b.textContent === 'Cancelar')?.click())
    render([duda, chamado('t2', 'Carla: Pergunta', vi.fn())], vi.fn())
    expect(container.querySelector('input[type="text"]')).toBeNull()
  })
})

function pedido(id: string, run: (resposta?: string) => void): ToastMessage {
  return {
    id,
    kind: 'instrucao',
    text: `Ana → Severa: Falar (${id})`,
    grupo: 'Pedidos',
    resposta: { rotulo: 'Resposta só para Ana (opcional)', maxLength: 20 },
    actions: [
      { label: 'Aceitar', run },
      { label: 'Recusar', run: () => {} },
    ],
  }
}

describe('Toast: campo de resposta do aviso', () => {
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

  function digita(campo: HTMLInputElement, valor: string): void {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function campoCom(rotulo: string, dentro: ParentNode): HTMLInputElement {
    const label = [...dentro.querySelectorAll('label')].find((l) => l.textContent === rotulo)
    const campo = label?.control
    if (!(campo instanceof HTMLInputElement)) throw new Error(`sem campo "${rotulo}"`)
    return campo
  }

  function botao(texto: string, dentro: ParentNode): HTMLButtonElement {
    const achado = [...dentro.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (!achado) throw new Error(`sem botão "${texto}"`)
    return achado
  }

  it('aviso solto: o texto escrito vai aparado para a ação, e o campo respeita o teto', () => {
    const run = vi.fn()
    const onDismiss = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', run)]} onDismiss={onDismiss} />))
    const campo = campoCom('Resposta só para Ana (opcional)', container)
    expect(campo.maxLength).toBe(20)
    digita(campo, '  Subiu ontem.  ')
    act(() => botao('Aceitar', container).click())
    expect(onDismiss).toHaveBeenCalledWith('t1')
    expect(run).toHaveBeenCalledWith('Subiu ontem.')
  })

  it('na caixa "Pedidos (2)", cada linha tem o seu campo, e o texto de uma não vai para a outra', () => {
    const primeira = vi.fn()
    const segunda = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', primeira), pedido('t2', segunda)]} onDismiss={() => {}} />))
    const linhas = [...container.querySelectorAll('li')]
    expect(linhas).toHaveLength(2)
    const [um, dois] = linhas
    if (um === undefined || dois === undefined) throw new Error('esperava duas linhas')
    digita(campoCom('Resposta só para Ana (opcional)', dois), 'Ela te ignora.')
    act(() => botao('Aceitar', dois).click())
    expect(segunda).toHaveBeenCalledWith('Ela te ignora.')
    act(() => botao('Aceitar', um).click())
    expect(primeira).toHaveBeenCalledWith('')
  })

  it('chega outro pedido no meio da escrita: o aviso vira caixa e o texto já escrito continua no campo', () => {
    const run = vi.fn()
    act(() => root.render(<Toast toasts={[pedido('t1', run)]} onDismiss={() => {}} />))
    digita(campoCom('Resposta só para Ana (opcional)', container), 'Ela sorri.')
    act(() => root.render(<Toast toasts={[pedido('t1', run), pedido('t2', () => {})]} onDismiss={() => {}} />))
    const [um] = [...container.querySelectorAll('li')]
    if (um === undefined) throw new Error('esperava a caixa com as linhas')
    expect(campoCom('Resposta só para Ana (opcional)', um).value).toBe('Ela sorri.')
    act(() => botao('Aceitar', um).click())
    expect(run).toHaveBeenCalledWith('Ela sorri.')
  })

  it('aviso sem campo continua só com os botões', () => {
    const run = vi.fn()
    act(() => root.render(<Toast toasts={[{ id: 'x', kind: 'instrucao', text: 'Grog quer passar', actions: [{ label: 'Deixar ir', run }] }]} onDismiss={() => {}} />))
    expect(container.querySelector('input')).toBeNull()
    act(() => botao('Deixar ir', container).click())
    expect(run).toHaveBeenCalledTimes(1)
  })
})
