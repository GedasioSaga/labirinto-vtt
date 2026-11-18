import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemDoAcervoNaTela, PastaDoAcervo } from '../lib/tokenLibrary'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * BUSCA NO ACERVO (pedido de 17/11/2026: "É bom ter um botão de pesquisa", com
 * a pasta NPCs em 29 tokens): filtra pelo nome enquanto digita, sem ligar para
 * acento nem maiúscula, e abre as pastas que têm achado sem gravar nada.
 */

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

function item(id: string, nome: string, pasta: string | null): ItemDoAcervoNaTela {
  return { id, nome, tamanho: 1, arquivo: `token_${id}.webp`, pasta, imagemNoDisco: false, caminho: `C:/acervo/token_${id}.webp` }
}

const ITENS = [
  item('p', 'Pólvora', 'npcs'),
  item('c', 'Cervo', 'npcs'),
  item('l', 'Leo', 'npcs'),
  item('k', 'Cavaleiro Negro', 'veiculos'),
  item('d', 'Dorian', null),
]

function montar(pastas: PastaDoAcervo[]) {
  const props: TokenLibraryPanelProps = {
    itens: ITENS,
    pastas,
    aviso: null,
    podeOrganizar: true,
    onPlace: vi.fn(),
    onDropOnMap: vi.fn(() => false),
    onDelete: vi.fn(),
    onCriarPasta: vi.fn(),
    onMover: vi.fn(),
    onRecolherPasta: vi.fn(),
    onApagarPasta: vi.fn(),
  }
  act(() => root.render(<TokenLibraryPanel {...props} />))
  return props
}

function campo(): HTMLInputElement {
  const alvo = container.querySelector<HTMLInputElement>('input[type="search"]')
  if (!alvo) throw new Error('a busca não está na tela')
  return alvo
}

function digitar(texto: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(campo(), texto)
    campo().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const nomesNaTela = () => [...container.querySelectorAll('.lb-acervo__nome')].map((el) => el.textContent)
const resultado = () => container.querySelector('[role="status"]')?.textContent

describe('TokenLibraryPanel: busca', () => {
  it('filtra pelo nome sem acento nem maiúscula, diz quantos achou ou "Nada com", e o Esc limpa', () => {
    montar([
      { id: 'npcs', nome: 'NPCs', recolhida: false },
      { id: 'veiculos', nome: 'Veículos', recolhida: false },
    ])

    digitar('POLV')
    expect(nomesNaTela()).toEqual(['Pólvora'])
    expect(resultado()).toBe('1 de 5 tokens')

    digitar('cav neg')
    expect(nomesNaTela()).toEqual(['Cavaleiro Negro'])

    digitar('xyz')
    expect(nomesNaTela()).toEqual([])
    expect(resultado()).toBe('Nada com “xyz”.')

    act(() => {
      campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(campo().value).toBe('')
    expect(nomesNaTela()).toEqual(['Pólvora', 'Cervo', 'Leo', 'Cavaleiro Negro', 'Dorian'])
    expect(resultado()).toBe('')
  })

  it('abre a pasta recolhida que tem achado, esconde as outras e não grava o recolher', () => {
    const props = montar([
      { id: 'npcs', nome: 'NPCs', recolhida: true },
      { id: 'veiculos', nome: 'Veículos', recolhida: false },
    ])
    expect(nomesNaTela()).toEqual(['Cavaleiro Negro', 'Dorian'])

    digitar('leo')
    expect(nomesNaTela()).toEqual(['Leo'])
    const pastasNaTela = [...container.querySelectorAll('[data-acervo-pasta]')].map((el) => el.getAttribute('aria-label'))
    expect(pastasNaTela).toEqual(['NPCs'])

    digitar('')
    expect(nomesNaTela()).toEqual(['Cavaleiro Negro', 'Dorian'])
    expect(props.onRecolherPasta).not.toHaveBeenCalled()
  })
})
