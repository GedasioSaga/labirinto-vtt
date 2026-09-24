import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonalNoteDraft, PersonalNoteList } from './PlayerPersonalNotes'
import type { PersonalNote } from './personalNotes'

describe('PlayerPersonalNotes', () => {
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

  function campo(): HTMLInputElement {
    const achado = container.querySelector<HTMLInputElement>('input[type="text"]')
    if (!achado) throw new Error('sem o campo da anotação')
    return achado
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome)
    if (!achado) throw new Error(`sem o botão ${nome}`)
    return achado
  }

  /** Digitar como o React espera: o setter nativo e o evento `input`. */
  function digita(valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo(), valor)
      campo().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  describe('PersonalNoteDraft: escrever a anotação', () => {
    it('abre com o foco no campo rotulado, limite de 40 e o aviso de que só você vê', () => {
      act(() => root.render(<PersonalNoteDraft onSave={() => {}} onCancel={() => {}} />))
      const input = campo()
      expect(document.activeElement).toBe(input)
      expect(input.maxLength).toBe(40)
      const rotulo = container.querySelector(`label[for="${input.id}"]`)
      expect(rotulo?.textContent).toBe('O que anotar')
      expect(container.textContent).toContain('Só você vê')
      expect(container.textContent).toContain('Faltam 40')
    })

    it('o contador mostra quanto falta enquanto digita', () => {
      act(() => root.render(<PersonalNoteDraft onSave={() => {}} onCancel={() => {}} />))
      digita('baú trancado')
      expect(container.textContent).toContain('Faltam 28')
    })

    it('Enter salva o texto aparado', () => {
      const onSave = vi.fn()
      act(() => root.render(<PersonalNoteDraft onSave={onSave} onCancel={() => {}} />))
      digita('  baú trancado aqui ')
      const form = campo().form
      if (!form) throw new Error('o campo não está num formulário')
      act(() => form.requestSubmit())
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('baú trancado aqui')
    })

    it('salvar vazio não salva: marca o campo, diz o que falta e devolve o foco a ele', () => {
      const onSave = vi.fn()
      act(() => root.render(<PersonalNoteDraft onSave={onSave} onCancel={() => {}} />))
      digita('   ')
      act(() => botao('Cancelar').focus())
      act(() => botao('Salvar').click())
      expect(onSave).not.toHaveBeenCalled()
      expect(campo().getAttribute('aria-invalid')).toBe('true')
      expect(container.querySelector('[role="alert"]')?.textContent).toBe('Escreva a anotação.')
      expect(document.activeElement).toBe(campo())
      // O erro some assim que o valor fica válido.
      digita('poço')
      expect(container.querySelector('[role="alert"]')).toBeNull()
    })

    it('Cancelar e Escape desistem sem salvar', () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()
      act(() => root.render(<PersonalNoteDraft onSave={onSave} onCancel={onCancel} />))
      act(() => botao('Cancelar').click())
      expect(onCancel).toHaveBeenCalledTimes(1)
      act(() => {
        campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(onCancel).toHaveBeenCalledTimes(2)
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe('PersonalNoteList: Minhas notas', () => {
    const notas: PersonalNote[] = [
      { id: 'n1', mapId: 'vila', x: 1, y: 2, text: 'baú trancado aqui' },
      { id: 'n2', mapId: 'vila', x: 3, y: 4, text: '<b>poço</b>' },
    ]

    it('sem nota: diz como anotar', () => {
      act(() => root.render(<PersonalNoteList notes={[]} onFocus={() => {}} onRemove={() => {}} />))
      expect(container.querySelector('li')).toBeNull()
      expect(container.textContent).toContain('Nenhuma nota nesta cena')
    })

    it('lista a mais nova em cima; tocar centraliza, "Apagar" apaga; HTML aparece literal', () => {
      const onFocus = vi.fn()
      const onRemove = vi.fn()
      act(() => root.render(<PersonalNoteList notes={notas} onFocus={onFocus} onRemove={onRemove} />))
      const itens = Array.from(container.querySelectorAll('li'))
      expect(itens).toHaveLength(2)
      expect(itens[0]?.textContent).toContain('<b>poço</b>')
      expect(container.querySelector('b')).toBeNull()
      const centrar = container.querySelector<HTMLButtonElement>('button[aria-label="Centralizar em baú trancado aqui"]')
      if (!centrar) throw new Error('sem o botão de centralizar')
      act(() => centrar.click())
      expect(onFocus).toHaveBeenCalledWith('n1')
      const apagar = container.querySelector<HTMLButtonElement>('button[aria-label="Apagar nota baú trancado aqui"]')
      if (!apagar) throw new Error('sem o botão de apagar')
      act(() => apagar.click())
      expect(onRemove).toHaveBeenCalledWith('n1')
      expect(onFocus).toHaveBeenCalledTimes(1)
    })
  })
})
