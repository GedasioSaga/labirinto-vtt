/**
 * LIVRO DE REGRAS na tela: sumário com capítulos e catálogos, leitor, busca
 * sem acento que leva ao capítulo (com os achados marcados) ou ao item do
 * catálogo, filtro de catálogo; e a janela do mestre (Esc fecha) com as duas
 * entradas — a zona Aventura e a ficha.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { novoPersonagem } from '../lib/personagem'
import { sistemaSemLivro } from '../lib/livroDeRegras'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { FichaDePersonagemDialog } from './FichaDePersonagemDialog'
import { LivroDeRegras } from './LivroDeRegras'
import { LivroDeRegrasDialog } from './LivroDeRegrasDialog'
import { PersonagensSection, type PersonagensSectionProps } from './PersonagensSection'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function botao(nome: string, dentro: ParentNode = document.body): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === nome || b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function campo(rotulo: string): HTMLInputElement {
  const achado = document.body.querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)
  if (achado === null) throw new Error(`campo "${rotulo}" não está na tela`)
  return achado
}

const leitor = (): HTMLElement => {
  const achado = container.querySelector<HTMLElement>('.lb-livro__leitor')
  if (achado === null) throw new Error('sem leitor')
  return achado
}

function renderLivro(): void {
  act(() => root.render(<LivroDeRegras sistema={SISTEMA_ONE_PIECE} livro={SISTEMA_ONE_PIECE.livro ?? []} catalogos={SISTEMA_ONE_PIECE.catalogos} />))
}

describe('livro na tela: sumário e leitor', () => {
  it('abre no primeiro capítulo; o sumário lista os 14 capítulos e os 5 catálogos com a contagem', () => {
    renderLivro()
    expect(leitor().querySelector('h2')?.textContent).toBe('Mecânicas')
    const sumario = container.querySelector('nav')
    expect(sumario?.querySelectorAll('button')).toHaveLength(19)
    expect(botao('Perícias47', sumario ?? container)).toBeDefined()
  })

  it('o capítulo escolhido abre no leitor, marcado no sumário; "próximo" anda', () => {
    renderLivro()
    act(() => botao('Akuma no Mi').click())
    expect(leitor().querySelector('h2')?.textContent).toBe('Akuma no Mi')
    expect(botao('Akuma no Mi').getAttribute('aria-current')).toBe('true')
    expect(leitor().textContent).toContain('Paramecia')
    act(() => botao('Raça: Humano →').click())
    expect(leitor().querySelector('h2')?.textContent).toBe('Raça: Humano')
  })

  it('catálogo: a lista inteira, e o filtro sem acento', () => {
    renderLivro()
    act(() => botao('Vantagens30').click())
    expect(leitor().querySelectorAll('.lb-livro__item')).toHaveLength(30)
    digitar(campo('Filtrar vantagens'), 'acrobata')
    const nomes = Array.from(leitor().querySelectorAll('.lb-livro__item-nome')).map((h) => h.textContent)
    expect(nomes[0]).toBe('Acrobata')
    expect(leitor().textContent).toContain('Efeito')
  })
})

describe('livro na tela: busca', () => {
  it('"pericia" acha o capítulo e itens; clicar no capítulo abre com os achados marcados', () => {
    renderLivro()
    digitar(campo('Buscar no livro'), 'pericia')
    const capitulo = Array.from(leitor().querySelectorAll<HTMLButtonElement>('.lb-livro__achado')).find((b) => b.textContent?.startsWith('Perícias'))
    if (capitulo === undefined) throw new Error('o capítulo Perícias não apareceu na busca')
    act(() => capitulo.click())
    expect(leitor().querySelector('h2')?.textContent).toBe('Perícias')
    expect(leitor().querySelectorAll('mark').length).toBeGreaterThan(0)
    expect(campo('Buscar no livro').value).toBe('')
    act(() => botao('Tirar marcas').click())
    expect(leitor().querySelectorAll('mark')).toHaveLength(0)
  })

  it('achado de catálogo abre o catálogo filtrado pelo nome do item', () => {
    renderLivro()
    digitar(campo('Buscar no livro'), 'AMNESIA')
    const item = Array.from(leitor().querySelectorAll<HTMLButtonElement>('.lb-livro__achado')).find((b) => b.textContent?.startsWith('Amnésia'))
    if (item === undefined) throw new Error('Amnésia não apareceu na busca')
    act(() => item.click())
    expect(leitor().querySelector('h2')?.textContent).toBe('Desvantagens')
    expect(campo('Filtrar desvantagens').value).toBe('Amnésia')
    expect(leitor().querySelector('.lb-livro__item-nome')?.textContent).toBe('Amnésia')
  })

  it('busca sem achado diz isso', () => {
    renderLivro()
    digitar(campo('Buscar no livro'), 'xyzzyx')
    expect(leitor().textContent).toContain('Nada no livro com essa busca')
  })
})

describe('livro do mestre: as entradas e a janela', () => {
  it('a janela mostra o livro; Esc fecha', () => {
    const onClose = vi.fn()
    act(() => root.render(<LivroDeRegrasDialog sistema={SISTEMA_ONE_PIECE} onClose={onClose} />))
    const janela = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(janela?.textContent).toContain('Livro de regras · One Piece')
    act(() => janela?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('aba Jogo: "Livro de regras" só quando o sistema tem livro', () => {
    const onAbrirLivro = vi.fn()
    const base: PersonagensSectionProps = {
      sistema: SISTEMA_ONE_PIECE,
      sistemaId: SISTEMA_ONE_PIECE.id,
      personagens: [],
      onAbrirFicha: vi.fn(),
      onCriar: vi.fn(),
      onApagar: vi.fn(),
      onImportar: vi.fn(async () => null),
    }
    act(() => root.render(<PersonagensSection {...base} onAbrirLivro={onAbrirLivro} />))
    act(() => botao('Livro de regras').click())
    expect(onAbrirLivro).toHaveBeenCalledTimes(1)
    act(() => root.render(<PersonagensSection {...base} sistema={sistemaSemLivro(SISTEMA_ONE_PIECE)} />))
    expect(() => botao('Livro de regras')).toThrow()
  })

  it('a ficha do mestre tem "Livro" quando recebe como abrir', () => {
    const onAbrirLivro = vi.fn()
    const personagem = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy')
    act(() =>
      root.render(
        <FichaDePersonagemDialog
          personagem={personagem}
          sistema={SISTEMA_ONE_PIECE}
          sistemaId={SISTEMA_ONE_PIECE.id}
          editandoNoInicio={false}
          onSalvar={vi.fn()}
          onClose={vi.fn()}
          escolherImagem={vi.fn(async () => null)}
          onAbrirLivro={onAbrirLivro}
          tokens={[]}
          onLigarToken={vi.fn()}
        />,
      ),
    )
    act(() => botao('Livro').click())
    expect(onAbrirLivro).toHaveBeenCalledTimes(1)
  })
})
