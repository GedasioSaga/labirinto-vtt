/**
 * LIVRO DE REGRAS na ficha em tela cheia do jogador: o "Livro" aparece quando
 * o sistema tem livro, pede ao mestre ao abrir, mostra a espera, o livro
 * (com busca) e a falha com "Tentar de novo"; Esc volta à ficha, sem fechar.
 * Com o livro aqui, o "Escolher do livro" da edição usa o mesmo livro.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resumoDoLivro, sistemaSemLivro } from '../lib/livroDeRegras'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { PlayerFicha, type PlayerFichaProps } from './PlayerFicha'
import type { LivroDoJogador } from './playerConnection'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }
const SEM_LIVRO = sistemaSemLivro(SISTEMA_ONE_PIECE)
const PRONTO: LivroDoJogador = { estado: 'pronto', sistemaId: SISTEMA_ONE_PIECE.id, livro: SISTEMA_ONE_PIECE.livro ?? [], catalogos: SISTEMA_ONE_PIECE.catalogos }

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

function props(extra: Partial<PlayerFichaProps> = {}): PlayerFichaProps {
  return {
    sistema: SEM_LIVRO,
    personagens: [LUFFY],
    tokens: [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: LUFFY.id }],
    envio: undefined,
    onCriar: vi.fn(() => true),
    onSalvar: vi.fn(() => ({ ok: true as const, nada: false })),
    onClose: vi.fn(),
    escolherImagem: vi.fn(async () => null),
    resumoDoLivro: resumoDoLivro(SISTEMA_ONE_PIECE) ?? undefined,
    onPedirLivro: vi.fn(() => true),
    ...extra,
  }
}

function render(p: PlayerFichaProps): void {
  act(() => root.render(<PlayerFicha {...p} />))
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === nome || b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

const temBotao = (nome: string): boolean => Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.trim() === nome)
const tela = (): HTMLElement => {
  const achada = container.querySelector<HTMLElement>('.pp-ficha')
  if (achada === null) throw new Error('a ficha não está na tela')
  return achada
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('livro na ficha do jogador', () => {
  it('sem livro no sistema: sem botão "Livro"', () => {
    render(props({ resumoDoLivro: undefined }))
    expect(temBotao('Livro')).toBe(false)
  })

  it('"Livro" pede ao mestre e mostra a espera; a tela se nomeia pelo livro', () => {
    const p = props()
    render(p)
    act(() => botao('Livro').click())
    expect(p.onPedirLivro).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Trazendo o livro de regras da mesa…')
    const rotulo = document.getElementById(tela().getAttribute('aria-labelledby') ?? '')
    expect(rotulo?.textContent).toBe('Livro de regras · One Piece')
    expect(document.activeElement).toBe(tela())
  })

  it('o livro chegou: capítulos e busca; Esc volta à ficha sem fechar a tela', () => {
    const p = props({ livroDeRegras: PRONTO })
    render(p)
    act(() => botao('Livro').click())
    // Já pronto: não pede de novo.
    expect(p.onPedirLivro).not.toHaveBeenCalled()
    expect(container.querySelector('.lb-livro__leitor h2')?.textContent).toBe('Mecânicas')
    const busca = container.querySelector<HTMLInputElement>('input[aria-label="Buscar no livro"]')
    if (busca === null) throw new Error('sem busca')
    digitar(busca, 'akuma')
    expect(container.querySelector('.lb-livro__resultados')?.textContent).toContain('Akuma no Mi')
    act(() => tela().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(p.onClose).not.toHaveBeenCalled()
    expect(container.querySelector('.lb-livro')).toBeNull()
    expect(temBotao('Editar')).toBe(true)
  })

  it('não veio: o aviso e "Tentar de novo" pede outra vez', () => {
    const p = props({ livroDeRegras: { estado: 'falhou' } })
    render(p)
    act(() => botao('Livro').click())
    expect(p.onPedirLivro).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não deu para trazer o livro')
    act(() => botao('Tentar de novo').click())
    expect(p.onPedirLivro).toHaveBeenCalledTimes(2)
  })

  it('a edição continua guardada enquanto ele lê; com o livro aqui, o "Escolher do livro" usa os catálogos dele', () => {
    render(props({ livroDeRegras: PRONTO }))
    act(() => botao('Editar').click())
    act(() => botao('Livro').click())
    act(() => botao('Voltar à ficha').click())
    expect(temBotao('Salvar')).toBe(true)
    const pericias = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent?.startsWith('Perícias'))
    act(() => pericias?.click())
    act(() => botao('Escolher do livro').click())
    expect(container.querySelectorAll('.lb-escolher__item')).toHaveLength(47)
  })
})
