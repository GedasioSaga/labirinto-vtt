/**
 * RECADO PARA ESCOLHIDOS: dentro do "Recado" da cena, uma marca por jogador
 * presente e os atalhos "Quem está em: <sala>". O botão diz quantos recebem, e
 * só os marcados vão para `onNote`.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenePeople } from '../lib/party'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-vila', name: 'Vila de Pedravel', active: true, available: true, renamable: true, tokenCount: 4 },
  { id: 's-mina', name: 'Mina', active: false, available: true, renamable: false, tokenCount: 0 },
]

const TAVERNA = { id: 'taverna', name: 'Taverna' }
const CASA = { id: 'casa', name: 'Casa do prefeito' }
const QUARTO = { id: 'quarto', name: 'Quarto do prefeito' }

const GENTE = new Map<string, ScenePeople>([
  [
    's-vila',
    {
      pendingRequests: 0,
      people: [
        { playerId: 'ana', name: 'Ana', color: '#3cff00', rooms: [TAVERNA] },
        { playerId: 'bruno', name: 'Bruno', color: '#ff5a00', rooms: [QUARTO, CASA] },
        { playerId: 'carla', name: 'Carla', color: '#123456', rooms: [TAVERNA] },
        { playerId: 'duda', name: 'Duda', color: '#abcdef', rooms: [TAVERNA] },
      ],
    },
  ],
])

describe('ScenesSection: recado para quem o mestre escolhe', () => {
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

  function abre(onNote: (sceneId: string, text: string, playerIds?: readonly string[]) => number | null): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} people={GENTE} onNote={onNote} />))
    act(() => botao('Recado para Vila de Pedravel')?.click())
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === nome)
  }

  function enviar(): HTMLButtonElement {
    const alvo = container.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (alvo === null) throw new Error('sem botão de enviar')
    return alvo
  }

  /** A caixa de marcar pelo texto do rótulo dela. */
  function marca(nome: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === nome)
    const input = label?.querySelector('input[type="checkbox"]')
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem a marca de ${nome}`)
    return input
  }

  function marcados(): string[] {
    return ['Ana', 'Bruno', 'Carla', 'Duda'].filter((nome) => marca(nome).checked)
  }

  function digita(texto: string): void {
    const alvo = container.querySelector('textarea')
    if (alvo === null) throw new Error('campo do recado não abriu')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('abre com todos os presentes marcados e "Enviar": o recado da cena inteira, como antes', () => {
    const onNote = vi.fn(() => 4)
    abre(onNote)
    expect(container.querySelector('fieldset legend')?.textContent).toBe('Quem recebe')
    expect(marcados()).toEqual(['Ana', 'Bruno', 'Carla', 'Duda'])
    expect(enviar().textContent).toBe('Enviar')
    digita('A porta range ao longe.')
    act(() => enviar().click())
    // Todos marcados = a cena inteira: sem lista, o recado vira o da cena e chega também a quem entrar depois.
    expect(onNote).toHaveBeenCalledWith('s-vila', 'A porta range ao longe.')
  })

  it('"Quem está em: Taverna" deixa 3 marcados, "Enviar para 3", e só os 3 vão', () => {
    const onNote = vi.fn(() => 3)
    abre(onNote)
    act(() => botao('Quem está em: Taverna')?.click())
    expect(marcados()).toEqual(['Ana', 'Carla', 'Duda'])
    expect(enviar().textContent).toBe('Enviar para 3')
    digita('O taverneiro cochicha.')
    act(() => enviar().click())
    expect(onNote).toHaveBeenCalledWith('s-vila', 'O taverneiro cochicha.', ['ana', 'carla', 'duda'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Recado enviado a 3 jogadores')
  })

  it('"Quem está em: Quarto do prefeito" manda só ao Bruno; a casa de fora também vira atalho', () => {
    const onNote = vi.fn(() => 1)
    abre(onNote)
    expect(botao('Quem está em: Casa do prefeito')).toBeDefined()
    act(() => botao('Quem está em: Quarto do prefeito')?.click())
    expect(marcados()).toEqual(['Bruno'])
    expect(enviar().textContent).toBe('Enviar para 1')
    digita('Uma carta sob o travesseiro.')
    act(() => enviar().click())
    expect(onNote).toHaveBeenCalledWith('s-vila', 'Uma carta sob o travesseiro.', ['bruno'])
  })

  it('clicar no nome desmarca só ele; "Todos" fica misto e volta a marcar todos', () => {
    abre(() => 4)
    act(() => marca('Ana').click())
    expect(marcados()).toEqual(['Bruno', 'Carla', 'Duda'])
    expect(enviar().textContent).toBe('Enviar para 3')
    const todos = marca('Todos')
    expect(todos.indeterminate).toBe(true)
    act(() => todos.click())
    expect(marcados()).toEqual(['Ana', 'Bruno', 'Carla', 'Duda'])
    expect(marca('Todos').checked).toBe(true)
    expect(marca('Todos').indeterminate).toBe(false)
  })

  it('ninguém marcado: diz para marcar alguém e não envia, nem com Ctrl+Enter', () => {
    const onNote = vi.fn(() => 0)
    abre(onNote)
    act(() => marca('Todos').click())
    expect(marcados()).toEqual([])
    expect(enviar().disabled).toBe(true)
    expect(enviar().textContent).toBe('Enviar para 0')
    expect(container.textContent).toContain('Marque quem recebe o recado')
    digita('ninguém lê')
    const campo = container.querySelector('textarea')
    act(() => {
      campo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    })
    expect(onNote).not.toHaveBeenCalled()
  })

  it('cena sem ninguém presente: sem marcas, "Enviar" manda para a cena como antes', () => {
    const onNote = vi.fn(() => 0)
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} people={GENTE} onNote={onNote} />))
    act(() => botao('Recado para Mina')?.click())
    expect(container.querySelector('fieldset')).toBeNull()
    expect(enviar().textContent).toBe('Enviar')
    digita('eco')
    act(() => enviar().click())
    expect(onNote).toHaveBeenCalledWith('s-mina', 'eco')
  })
})
