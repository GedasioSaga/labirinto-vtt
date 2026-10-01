import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemDoAcervoNaTela, PastaDoAcervo } from '../lib/tokenLibrary'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * PASTAS NA ESTANTE (turno da noite, 26/09/2026): o mestre separa o acervo em
 * NPCs, Veículos, Jogadores e pastas dele, move o token por menu ou arrastando
 * até a pasta, e recolhe a pasta que não quer ver agora.
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
  Reflect.deleteProperty(document, 'elementFromPoint')
})

function item(id: string, nome: string, pasta: string | null): ItemDoAcervoNaTela {
  return { id, nome, tamanho: 1, arquivo: `token_${id}.webp`, pasta, imagemNoDisco: false, caminho: `C:/acervo/token_${id}.webp` }
}

const PASTAS: PastaDoAcervo[] = [
  { id: 'npcs', nome: 'NPCs', recolhida: false },
  { id: 'veiculos', nome: 'Veículos', recolhida: false },
  { id: 'jogadores', nome: 'Jogadores', recolhida: false },
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

function pasta(nome: string): HTMLElement {
  const alvo = [...container.querySelectorAll<HTMLElement>('[data-acervo-pasta]')].find(
    (el) => el.getAttribute('aria-label') === nome,
  )
  if (!alvo) throw new Error(`pasta ${nome} não está na tela`)
  return alvo
}

function botao(nome: string, dentro: ParentNode = container): HTMLButtonElement {
  const alvo = [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === nome,
  )
  if (!alvo) throw new Error(`botão "${nome}" não está na tela`)
  return alvo
}

function nomesNaPasta(nome: string): string[] {
  return [...pasta(nome).querySelectorAll<HTMLButtonElement>('.lb-acervo__nome')].map((el) => el.textContent ?? '')
}

function ponteiro(tipo: string, alvo: EventTarget, x: number, y: number) {
  const evento = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperty(evento, 'pointerId', { value: 1 })
  Object.defineProperty(evento, 'isPrimary', { value: true })
  act(() => {
    alvo.dispatchEvent(evento)
  })
}

function digitar(campo: HTMLInputElement, texto: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('TokenLibraryPanel: pastas do acervo', () => {
  it('mostra as pastas, cada token dentro da sua, e o que não tem pasta em "Sem pasta"', () => {
    montar()

    expect(nomesNaPasta('Veículos')).toEqual(['Carroça'])
    expect(nomesNaPasta('NPCs')).toEqual([])
    expect(nomesNaPasta('Sem pasta')).toEqual(['Goblin'])
  })

  it('clicar no cabeçalho recolhe a pasta; recolhida, ela esconde os tokens e diz quantos tem', () => {
    const props = montar()

    act(() => botao('Veículos (1)').click())
    expect(props.onRecolherPasta).toHaveBeenCalledWith(PASTAS[1], true)

    montar({ pastas: [PASTAS[0], { ...PASTAS[1], recolhida: true }, PASTAS[2]] })
    const cabecalho = botao('Veículos (1)')
    expect(cabecalho.getAttribute('aria-expanded')).toBe('false')
    expect(nomesNaPasta('Veículos')).toEqual([])
  })

  it('"+ Pasta" (nome "Nova pasta") abre o campo; Enter cria com o nome digitado, Esc desiste', () => {
    const props = montar()

    expect(botao('Nova pasta').textContent?.replace(/\s+/g, ' ').trim()).toBe('+ Pasta')
    act(() => botao('Nova pasta').click())
    const campo = container.querySelector<HTMLInputElement>('input[aria-label="Nome da nova pasta"]')
    expect(campo).not.toBeNull()
    digitar(campo as HTMLInputElement, 'Chefes')
    act(() => {
      campo?.form?.requestSubmit()
    })
    expect(props.onCriarPasta).toHaveBeenCalledWith('Chefes')
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).toBeNull()

    act(() => botao('Nova pasta').click())
    const deNovo = container.querySelector<HTMLInputElement>('input[aria-label="Nome da nova pasta"]')
    act(() => {
      deNovo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).toBeNull()
    expect(props.onCriarPasta).toHaveBeenCalledTimes(1)
  })

  it('menu "Mover": lista as outras pastas e move para a escolhida', () => {
    const props = montar()

    act(() => botao('Mover Goblin para outra pasta').click())
    const destinos = container.querySelector<HTMLElement>('[role="group"][aria-label="Mover Goblin para"]')
    expect(destinos).not.toBeNull()
    const nomes = [...(destinos as HTMLElement).querySelectorAll('button')].map((el) => el.textContent?.trim())
    expect(nomes).toEqual(['NPCs', 'Veículos', 'Jogadores', 'Cancelar'])

    act(() => botao('Jogadores', destinos as HTMLElement).click())
    expect(props.onMover).toHaveBeenCalledWith(GOBLIN, 'jogadores')
  })

  it('menu "Mover" de token numa pasta oferece "Sem pasta" para tirá-lo de lá', () => {
    const props = montar()

    act(() => botao('Mover Carroça para outra pasta').click())
    const destinos = container.querySelector<HTMLElement>('[role="group"][aria-label="Mover Carroça para"]') as HTMLElement
    const nomes = [...destinos.querySelectorAll('button')].map((el) => el.textContent?.trim())
    expect(nomes).toEqual(['Sem pasta', 'NPCs', 'Jogadores', 'Cancelar'])

    act(() => botao('Sem pasta', destinos).click())
    expect(props.onMover).toHaveBeenCalledWith(CARROCA, null)
  })

  it('arrastar o token e soltar sobre uma pasta move para ela, sem pôr nada no mapa', () => {
    const props = montar()
    const npcs = pasta('NPCs')
    Reflect.set(document, 'elementFromPoint', () => npcs)

    ponteiro('pointerdown', botao('Colocar Goblin no mapa'), 10, 10)
    ponteiro('pointermove', window, 40, 40)
    expect(npcs.getAttribute('data-alvo')).toBe('dentro')
    ponteiro('pointerup', window, 40, 40)

    expect(props.onMover).toHaveBeenCalledWith(GOBLIN, 'npcs')
    expect(props.onDropOnMap).not.toHaveBeenCalled()
    expect(npcs.hasAttribute('data-alvo')).toBe(false)
  })

  it('arrastar e soltar fora das pastas continua sendo pôr no mapa', () => {
    const props = montar()
    Reflect.set(document, 'elementFromPoint', () => document.body)

    ponteiro('pointerdown', botao('Colocar Goblin no mapa'), 10, 10)
    ponteiro('pointermove', window, 400, 300)
    ponteiro('pointerup', window, 400, 300)

    expect(props.onDropOnMap).toHaveBeenCalledWith(GOBLIN, 400, 300)
    expect(props.onMover).not.toHaveBeenCalled()
  })

  it('apagar pasta com tokens pergunta antes; os tokens não são apagados', () => {
    const props = montar()

    act(() => botao('Apagar a pasta Veículos').click())
    expect(props.onApagarPasta).not.toHaveBeenCalled()
    act(() => botao('Apagar a pasta, manter os tokens').click())

    expect(props.onApagarPasta).toHaveBeenCalledWith(PASTAS[1])
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('sem disco (app no navegador), nem as pastas nem "+ Pasta" aparecem', () => {
    montar({ itens: [], pastas: [], podeOrganizar: false })

    expect(container.querySelector('[data-acervo-pasta]')).toBeNull()
    expect(() => botao('Nova pasta')).toThrow()
  })
})
