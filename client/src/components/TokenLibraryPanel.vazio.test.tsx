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
 *
 * O "+ Nova pasta" fica na linha do título mesmo vazio, como o "+" de seção do
 * Explorer: organizar a estante antes do primeiro token é trabalho legítimo, e
 * a pasta criada tem de aparecer.
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

/** Pasta que o mestre criou: `id` aleatório, como o que `criarPastaNoAcervo` dá. */
const CHEFES: PastaDoAcervo = { id: '3f9c2a71-8d4e-4b6a-9c1f-5e7d2b8a0c64', nome: 'Chefes', recolhida: false }

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

/** Nomes das pastas à vista, na ordem da tela. */
function pastasNaTela(): (string | null)[] {
  return [...container.querySelectorAll('[data-acervo-pasta]')].map((el) => el.getAttribute('aria-label'))
}

function campoNovaPasta(): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('input[aria-label="Nome da nova pasta"]')
}

/** Clica no "+ Nova pasta" e devolve o campo que ele abre. */
function abrirNovaPasta(): HTMLInputElement {
  const botao = [...container.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === '+ Nova pasta')
  if (botao === undefined) throw new Error('sem "+ Nova pasta" no acervo')
  act(() => botao.click())
  const campo = campoNovaPasta()
  if (campo === null) throw new Error('o campo "Nome da nova pasta" não abriu')
  return campo
}

/** Digita como a pessoa: o React só vê a troca pelo setter nativo seguido do evento `input`. */
function digitar(campo: HTMLInputElement, texto: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter === undefined) throw new Error('o jsdom não expôs o setter de value')
  act(() => {
    setter.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
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

  it('vazio, as pastas padrão saem de cena, o "+ Nova pasta" fica na linha do título e a seção fica mais justa', () => {
    montar()
    expect(pastasNaTela()).toEqual([])
    const topo = container.querySelector('.lb-acervo__topo')
    if (topo === null) throw new Error('sem a linha do título do acervo')
    // Título e ação na mesma linha, como o "+" de seção do Explorer.
    expect([...topo.children].map((el) => el.textContent?.trim())).toEqual(['Acervo de tokens', '+ Nova pasta'])
    expect(secao().classList.contains('lb-acervo--vazio')).toBe(true)
  })

  it('vazio, criar pasta funciona: o nome vai para a gravação e a pasta criada aparece', () => {
    const props = montar()
    const campo = abrirNovaPasta()
    digitar(campo, 'Chefes')
    act(() => campo.form?.requestSubmit())
    expect(props.onCriarPasta).toHaveBeenCalledWith('Chefes')
    expect(campoNovaPasta()).toBeNull()
    // O App grava, relê o disco e devolve a estante com a pasta nova no fim.
    montar({ pastas: [...PASTAS, CHEFES] })
    // Com uma pasta do mestre, a estante aparece inteira — a mesma vista de
    // depois do primeiro token. "Sem pasta" não: não há token solto.
    expect(pastasNaTela()).toEqual(['NPCs', 'Veículos', 'Jogadores', 'Chefes'])
    expect(container.querySelectorAll('.lb-acervo__vazio-estado')).toHaveLength(1)
    expect(botoes()).toContain('+ Nova pasta')
  })

  it('vazio, a pasta do mestre conta pelo id: mesmo com o nome "NPCs", a estante aparece inteira', () => {
    // Nome idêntico ao de uma padrão; só o `id` (aleatório, como o de `criarPastaNoAcervo`) diz que é do mestre.
    const npcsDoMestre: PastaDoAcervo = { id: '9b2e4f60-1c7a-4d38-a5e2-7f0c3b6d9e18', nome: 'NPCs', recolhida: false }
    montar({ pastas: [...PASTAS, npcsDoMestre] })
    expect(pastasNaTela()).toEqual(['NPCs', 'Veículos', 'Jogadores', 'NPCs'])
  })

  it('com o primeiro token, as pastas voltam, o "+ Nova pasta" segue lá e o estado vazio some', () => {
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

  it('se o acervo esvazia com o campo de nova pasta aberto, o campo fica, com o que já foi digitado', () => {
    montar({ itens: [GOBLIN] })
    digitar(abrirNovaPasta(), 'Chefes')
    montar({ itens: [] })
    // Esvaziar a estante não é motivo para jogar fora o nome que a pessoa digitava.
    expect(campoNovaPasta()?.value).toBe('Chefes')
    expect(container.querySelector('.lb-acervo__vazio-estado')).not.toBeNull()
  })

  it('se o recarregar falha na leitura com o campo de nova pasta aberto, o campo fecha; a estante só vazia não o fecha', () => {
    montar()
    digitar(abrirNovaPasta(), 'Chefes')
    // Sem token e sem pasta nenhuma, mas com o disco lido: ainda dá para criar.
    montar({ pastas: [] })
    expect(campoNovaPasta()?.value).toBe('Chefes')
    // O que `recarregar` põe na tela quando a leitura falha (tokenLibraryStore):
    // nada lido, nada a organizar. O "Criar" só colheria a recusa de
    // `criarPastaNoAcervo` (ACERVO_NAO_LIDO).
    montar({ itens: [], pastas: [], podeOrganizar: false, aviso: 'Não foi possível ler o acervo de tokens: arquivo sumiu.' })
    expect(campoNovaPasta()).toBeNull()
    expect(botoes()).not.toContain('Criar')
    expect(botoes()).not.toContain('+ Nova pasta')
    // Fechou, e não só se escondeu: a leitura seguinte, que dá certo, não traz
    // de volta o campo velho (que, com `autoFocus`, roubaria o foco).
    montar()
    expect(campoNovaPasta()).toBeNull()
    expect(botoes()).toContain('+ Nova pasta')
  })
})
