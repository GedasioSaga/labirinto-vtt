import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemDoAcervoNaTela, PastaDoAcervo } from '../lib/tokenLibrary'
import { ACERVO_COMO_ENCHER, ACERVO_VAZIO, TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * ACERVO VAZIO NUMA FAIXA SÓ (moldura do painel enxuta, 27/09/2026): a bar é o
 * Explorer do VS Code sem pasta aberta — uma linha que diz o que falta e como
 * resolver. Antes eram dois parágrafos soltos (o segundo com quatro linhas)
 * e, embaixo, as três pastas padrão vazias brigando com eles.
 */

/** Uma linha do rail (232 px de texto a 11,5 px) leva ~40-43 caracteres: a dica cabe na segunda. */
const DICA_MAX = 45

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

/** As pastas que o acervo novo já traz (`pastasPadrao`), todas vazias. */
const PASTAS: PastaDoAcervo[] = [
  { id: 'npcs', nome: 'NPCs', recolhida: false },
  { id: 'veiculos', nome: 'Veículos', recolhida: false },
  { id: 'jogadores', nome: 'Jogadores', recolhida: false },
]

const GOBLIN = item('g', 'Goblin', null)

function montar(extra: Partial<TokenLibraryPanelProps> = {}) {
  const props: TokenLibraryPanelProps = {
    itens: [],
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

function secao(): HTMLElement {
  const alvo = container.querySelector<HTMLElement>('section')
  if (alvo === null) throw new Error('sem a seção do acervo')
  return alvo
}

function botoes(): string[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '')
}

describe('acervo vazio numa faixa só', () => {
  it('um parágrafo: o que falta, com o texto de sempre, e como encher, curto e ainda falando de foto', () => {
    montar()
    const estados = container.querySelectorAll('.lb-acervo__vazio-estado')
    expect(estados).toHaveLength(1)
    const [titulo, dica] = [...estados[0].children]
    expect(titulo.textContent).toBe('Nenhum token no acervo ainda.')
    expect(titulo.textContent).toBe(ACERVO_VAZIO)
    expect(dica.textContent).toBe(ACERVO_COMO_ENCHER)
    expect(ACERVO_COMO_ENCHER).toMatch(/foto/i)
    expect(ACERVO_COMO_ENCHER.length).toBeLessThanOrEqual(DICA_MAX)
    // Os dois parágrafos soltos de antes saíram.
    expect(container.querySelectorAll('p.lb-acervo__vazio')).toHaveLength(0)
  })

  it('vazio, as pastas padrão e o "+ Nova pasta" saem de cena, e a seção fica mais justa', () => {
    montar()
    expect(container.querySelectorAll('[data-acervo-pasta]')).toHaveLength(0)
    expect(botoes()).not.toContain('+ Nova pasta')
    expect(secao().classList.contains('lb-acervo--vazio')).toBe(true)
  })

  it('com o primeiro token, as pastas e o "+ Nova pasta" voltam e o estado vazio some', () => {
    montar({ itens: [GOBLIN] })
    expect(container.querySelectorAll('[data-acervo-pasta]').length).toBeGreaterThan(0)
    expect(botoes()).toContain('+ Nova pasta')
    expect(container.querySelector('.lb-acervo__vazio-estado')).toBeNull()
    expect(secao().classList.contains('lb-acervo--vazio')).toBe(false)
  })

  it('o aviso de erro de leitura continua à vista junto do vazio', () => {
    montar({ aviso: 'Não foi possível ler o acervo de tokens: arquivo sumiu.' })
    expect(container.querySelector('.lb-acervo__aviso')?.textContent).toContain('Não foi possível ler o acervo de tokens')
    expect(container.querySelector('.lb-acervo__vazio-estado')).not.toBeNull()
  })

  it('se o acervo esvazia com o campo de nova pasta aberto, o campo fecha junto', () => {
    montar({ itens: [GOBLIN] })
    const novaPasta = [...container.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === '+ Nova pasta')
    if (novaPasta === undefined) throw new Error('sem "+ Nova pasta" com token no acervo')
    act(() => novaPasta.click())
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).not.toBeNull()
    montar({ itens: [] })
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).toBeNull()
    expect(container.querySelector('.lb-acervo__vazio-estado')).not.toBeNull()
  })
})
