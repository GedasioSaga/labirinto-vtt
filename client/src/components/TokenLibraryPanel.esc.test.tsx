import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemDoAcervoNaTela, PastaDoAcervo } from '../lib/tokenLibrary'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * ESC NO ACERVO, NO GESTO DE VERDADE (convenção "Menu de ações": Esc fecha e o
 * foco volta a quem abriu). O clique deixa o foco no botão que abriu — o Mover
 * continua montado ao lado do menu; o Apagar some quando a pergunta abre —,
 * então o Esc parte de `document.activeElement`, nunca de dentro do menu. E o
 * Esc não pode vazar até a janela: lá ele é o "cancelar" do mapa, que largaria
 * a seleção.
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

const PASTAS: PastaDoAcervo[] = [
  { id: 'npcs', nome: 'NPCs', recolhida: false },
  { id: 'veiculos', nome: 'Veículos', recolhida: false },
]

const GOBLIN = item('g', 'Goblin', null)
const CARROCA = item('c', 'Carroça', 'veiculos')

function montar(extra: Partial<TokenLibraryPanelProps> = {}) {
  const props: TokenLibraryPanelProps = {
    itens: [GOBLIN, CARROCA],
    pastas: PASTAS,
    aviso: null,
    podeOrganizar: true,
    onPlace: vi.fn(),
    onDropOnMap: vi.fn(() => false),
    onDelete: vi.fn(),
    onCriarPasta: vi.fn(),
    onMover: vi.fn(),
    onRecolherPasta: vi.fn(),
    onApagarPasta: vi.fn(),
    ...extra,
  }
  act(() => root.render(<TokenLibraryPanel {...props} />))
  return props
}

function botao(nome: string): HTMLButtonElement {
  const alvo = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === nome,
  )
  if (alvo === undefined) throw new Error(`sem o botão "${nome}"`)
  return alvo
}

const existe = (nome: string) => {
  try {
    botao(nome)
    return true
  } catch {
    return false
  }
}

/** Clica como o ponteiro: o botão recebe o foco e depois o clique. */
function clicar(nome: string) {
  const alvo = botao(nome)
  act(() => {
    alvo.focus()
    alvo.click()
  })
}

/** Esc onde o foco está agora, como o teclado manda; devolve se a janela o ouviu. */
function escNoFoco(): boolean {
  const naJanela = vi.fn()
  window.addEventListener('keydown', naJanela)
  act(() => {
    ;(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  })
  window.removeEventListener('keydown', naJanela)
  return naJanela.mock.calls.length > 0
}

describe('Acervo — Esc fecha o que está aberto e o foco volta a quem abriu', () => {
  it('menu Mover: o foco fica no Mover; Esc dali fecha o menu e o foco continua no Mover', () => {
    const props = montar()
    clicar('Mover Goblin para outra pasta')
    expect(container.querySelector('[role="group"][aria-label="Mover Goblin para"]')).not.toBeNull()
    expect(document.activeElement).toBe(botao('Mover Goblin para outra pasta'))

    expect(escNoFoco()).toBe(false)
    expect(container.querySelector('[role="group"][aria-label="Mover Goblin para"]')).toBeNull()
    expect(document.activeElement).toBe(botao('Mover Goblin para outra pasta'))
    expect(props.onMover).not.toHaveBeenCalled()
  })

  it('menu Mover: Esc com o foco num destino também fecha, e o foco volta ao Mover', () => {
    montar()
    clicar('Mover Goblin para outra pasta')
    act(() => botao('Veículos').focus())
    expect(escNoFoco()).toBe(false)
    expect(container.querySelector('[role="group"][aria-label="Mover Goblin para"]')).toBeNull()
    expect(document.activeElement).toBe(botao('Mover Goblin para outra pasta'))
  })

  it('apagar token: a pergunta abre com o foco em "Manter no acervo"; Esc desiste e devolve o foco ao Apagar', () => {
    const props = montar()
    clicar('Apagar Goblin do acervo')
    expect(document.activeElement).toBe(botao('Manter no acervo'))

    expect(escNoFoco()).toBe(false)
    expect(existe('Apagar Goblin para sempre')).toBe(false)
    expect(props.onDelete).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botao('Apagar Goblin do acervo'))
  })

  it('"Manter no acervo" também devolve o foco ao Apagar da mesma linha', () => {
    montar()
    clicar('Apagar Goblin do acervo')
    clicar('Manter no acervo')
    expect(existe('Manter no acervo')).toBe(false)
    expect(document.activeElement).toBe(botao('Apagar Goblin do acervo'))
  })

  it('apagar pasta com token dentro: a pergunta abre em "Manter a pasta"; Esc desiste e devolve o foco', () => {
    const props = montar()
    clicar('Apagar a pasta Veículos')
    expect(document.activeElement).toBe(botao('Manter a pasta'))

    expect(escNoFoco()).toBe(false)
    expect(existe('Apagar a pasta, manter os tokens')).toBe(false)
    expect(props.onApagarPasta).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botao('Apagar a pasta Veículos'))
  })

  it('campo de nova pasta: Esc com o foco no Cancelar fecha, e o foco volta ao "+ Pasta"', () => {
    const props = montar()
    clicar('Nova pasta')
    act(() => botao('Cancelar').focus())
    expect(escNoFoco()).toBe(false)
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).toBeNull()
    expect(props.onCriarPasta).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botao('Nova pasta'))
  })

  it('sem nada aberto, o Esc passa: é do mapa (largar a seleção)', () => {
    montar()
    act(() => botao('Colocar Goblin no mapa').focus())
    expect(escNoFoco()).toBe(true)
  })
})
