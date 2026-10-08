/**
 * "ESCOLHER DO LIVRO" na ficha em edição: o mestre escolhe do catálogo que o
 * sistema dele já tem; o jogador, do livro que pede ao mestre na hora. O item
 * escolhido vira um cartão NOVO com o texto copiado; Esc fecha só a lista.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resumoDoLivro, sistemaSemLivro } from '../lib/livroDeRegras'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { LivroDaFicha } from './EscolherDoLivro'
import { FichaDePersonagem } from './FichaDePersonagem'

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

const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }

/** A ficha em edição, guardando o rascunho como a janela guarda; `visto` recebe cada versão. */
function FichaEditando({ sistema, livro, visto }: { sistema: SistemaDeRpg; livro?: LivroDaFicha; visto: (p: Personagem) => void }) {
  const [personagem, setPersonagem] = useState(LUFFY)
  return (
    <FichaDePersonagem
      personagem={personagem}
      sistema={sistema}
      editando
      onChange={(novo) => {
        visto(novo)
        setPersonagem(novo)
      }}
      escolherImagem={async () => null}
      livro={livro}
    />
  )
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === nome || b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

const temBotao = (nome: string): boolean => Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.trim() === nome)

function aba(nome: string): void {
  const achada = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent?.startsWith(nome))
  if (achada === undefined) throw new Error(`aba ${nome} não existe`)
  act(() => achada.click())
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function filtro(): HTMLInputElement {
  const achado = container.querySelector<HTMLInputElement>('.lb-escolher input')
  if (achado === null) throw new Error('a lista do livro não está aberta')
  return achado
}

function item(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-escolher__item')).find((b) => b.querySelector('.lb-escolher__nome')?.firstChild?.textContent === nome)
  if (achado === undefined) throw new Error(`item "${nome}" não está na lista`)
  return achado
}

describe('escolher do livro: mestre', () => {
  it('Perícias: filtra sem acento e copia a escolhida para um cartão novo, com descrição e atributos', () => {
    const visto = vi.fn<(p: Personagem) => void>()
    act(() => root.render(<FichaEditando sistema={SISTEMA_ONE_PIECE} visto={visto} />))
    aba('Perícias')
    act(() => botao('Escolher do livro').click())
    expect(document.activeElement).toBe(filtro())
    digitar(filtro(), 'caca')
    act(() => item('Caça').click())
    const caca = SISTEMA_ONE_PIECE.catalogos?.pericias.find((p) => p.nome === 'Caça')
    const ultimo = visto.mock.calls.at(-1)?.[0]
    expect(ultimo?.abas.pericias).toEqual([expect.objectContaining({ nome: 'Caça', campos: { descricao: caca?.descricao }, atributos: caca?.atributos })])
    // A lista fecha e o foco volta ao botão.
    expect(container.querySelector('.lb-escolher')).toBeNull()
    expect(document.activeElement).toBe(botao('Escolher do livro'))
  })

  it('Vantagens: o efeito vai ao campo Efeito; escolher de novo marca "já na ficha" e cria outro cartão', () => {
    const visto = vi.fn<(p: Personagem) => void>()
    act(() => root.render(<FichaEditando sistema={SISTEMA_ONE_PIECE} visto={visto} />))
    aba('Vantagens')
    act(() => botao('Escolher do livro').click())
    act(() => item('Acrobata').click())
    act(() => botao('Escolher do livro').click())
    expect(item('Acrobata').textContent).toContain('já na ficha')
    act(() => item('Acrobata').click())
    const cartoes = visto.mock.calls.at(-1)?.[0].abas.vantagens ?? []
    expect(cartoes).toHaveLength(2)
    expect(cartoes[0]?.id).not.toBe(cartoes[1]?.id)
    expect(cartoes[0]?.campos.efeito?.length).toBeGreaterThan(0)
  })

  it('Esc fecha só a lista (a janela em volta não o recebe); aba sem catálogo (Habilidades) não oferece o livro', () => {
    const fora = vi.fn()
    act(() =>
      root.render(
        <div onKeyDown={fora}>
          <FichaEditando sistema={SISTEMA_ONE_PIECE} visto={vi.fn()} />
        </div>,
      ),
    )
    expect(temBotao('Escolher do livro')).toBe(false)
    aba('Desvantagens')
    act(() => botao('Escolher do livro').click())
    act(() => filtro().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('.lb-escolher')).toBeNull()
    expect(fora).not.toHaveBeenCalled()
  })
})

describe('escolher do livro: jogador (o livro vem do mestre)', () => {
  const SEM_LIVRO = sistemaSemLivro(SISTEMA_ONE_PIECE)

  it('abrir a lista pede o livro e espera; quando chega, a lista aparece e copia', () => {
    const pedir = vi.fn()
    const visto = vi.fn<(p: Personagem) => void>()
    const livro = (estado: LivroDaFicha['estado']): LivroDaFicha => ({ resumo: resumoDoLivro(SISTEMA_ONE_PIECE), estado, pedir })
    act(() => root.render(<FichaEditando sistema={SEM_LIVRO} livro={livro('ausente')} visto={visto} />))
    aba('Perícias')
    act(() => botao('Escolher do livro').click())
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.lb-escolher [role="status"]')?.textContent).toBe('Trazendo o livro da mesa…')
    act(() => root.render(<FichaEditando sistema={SISTEMA_ONE_PIECE} livro={livro('pronto')} visto={visto} />))
    act(() => item('Caça').click())
    expect(visto.mock.calls.at(-1)?.[0].abas.pericias?.[0]?.nome).toBe('Caça')
  })

  it('o livro não veio: avisa e oferece tentar de novo', () => {
    const pedir = vi.fn()
    act(() => root.render(<FichaEditando sistema={SEM_LIVRO} livro={{ resumo: resumoDoLivro(SISTEMA_ONE_PIECE), estado: 'falhou', pedir }} visto={vi.fn()} />))
    aba('Vantagens')
    act(() => botao('Escolher do livro').click())
    expect(pedir).toHaveBeenCalledTimes(1)
    act(() => botao('Tentar de novo').click())
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('sistema sem livro (sem resumo): sem botão', () => {
    act(() => root.render(<FichaEditando sistema={SEM_LIVRO} livro={{ resumo: null, estado: 'ausente', pedir: vi.fn() }} visto={vi.fn()} />))
    aba('Perícias')
    expect(temBotao('Escolher do livro')).toBe(false)
  })
})
