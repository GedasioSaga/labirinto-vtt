import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinIcon, PinKind } from '../types/map'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * Painel do marcador: TIPO e ÍCONE juntos. Antes eram duas seções com dois
 * títulos ("Ícone no mapa" em cima, "Ponto de interesse" embaixo), e o mestre
 * não entendia que o ícone é o que aparece NO LUGAR do "!"/"?" do tipo. Agora
 * é um bloco só: o título, o tipo e logo abaixo o ícone, na mesma seção.
 */

function props(extra: Partial<PinControlsProps> = {}): PinControlsProps {
  return {
    kind: 'exclamacao',
    onKindChange: () => {},
    description: 'Baú no canto',
    onDescriptionChange: () => {},
    locked: false,
    onLockedChange: () => {},
    image: null,
    onChooseImage: () => {},
    onClearImage: () => {},
    onDelete: () => {},
    iconChoice: { icon: null, onIconChange: () => {}, pinSelected: true },
    ...extra,
  }
}

describe('PinControls: tipo e ícone no mesmo bloco', () => {
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

  function render(p: PinControlsProps): void {
    act(() => root.render(<PinControls {...p} />))
  }

  function grupo(nome: string): HTMLElement {
    const achado = Array.from(container.querySelectorAll<HTMLElement>('[role="radiogroup"]')).find((el) => {
      const rotulo = el.getAttribute('aria-label') ?? document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent
      return rotulo === nome
    })
    if (achado === undefined) throw new Error(`sem grupo "${nome}"`)
    return achado
  }

  it('uma seção e um título só: o ícone mora logo abaixo do tipo', () => {
    render(props())
    const secoes = container.querySelectorAll('section')
    expect(secoes).toHaveLength(1)
    const titulos = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)
    expect(titulos).toEqual(['Ponto de interesse'])
    const tipo = grupo('Tipo do pino')
    const icone = grupo('Ícone no mapa')
    expect(tipo.closest('section')).toBe(icone.closest('section'))
    // Na ordem de leitura: tipo, ícone, e só depois a descrição.
    const descricao = container.querySelector('textarea')
    expect(descricao).not.toBeNull()
    expect(tipo.compareDocumentPosition(icone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    if (descricao !== null) expect(icone.compareDocumentPosition(descricao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a linha de apoio diz que o ícone troca o "!" do tipo, e o excluir continua o último botão', () => {
    render(props())
    expect(container.textContent).toContain('O ícone aparece no lugar do "!" — no mapa e no cartão do jogador.')
    const botoes = Array.from(container.querySelectorAll('button'))
    expect(botoes[botoes.length - 1]?.textContent).toBe('Excluir ponto de interesse')
  })

  it('escolher um ícone chama onIconChange com ele; "Sem ícone" devolve null', () => {
    const onIconChange = vi.fn<(icon: PinIcon | null) => void>()
    render(props({ iconChoice: { icon: 'bau', onIconChange, pinSelected: true } }))
    const armadilha = Array.from(grupo('Ícone no mapa').querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (b) => b.textContent === 'Armadilha',
    )
    act(() => armadilha?.click())
    expect(onIconChange).toHaveBeenLastCalledWith('armadilha')
    const semIcone = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Sem ícone')
    act(() => semIcone?.click())
    expect(onIconChange).toHaveBeenLastCalledWith(null)
  })

  it('pino de viagem não mostra a grade de ícones', () => {
    const kind: PinKind = 'viagem'
    render(props({ kind, iconChoice: null }))
    expect(grupo('Tipo do pino')).not.toBeNull()
    expect(() => grupo('Ícone no mapa')).toThrow()
  })

  it('sem pino aberto, a grade vale para o próximo e o texto diz isso', () => {
    render(props({ description: null, iconChoice: { icon: null, onIconChange: () => {}, pinSelected: false } }))
    expect(grupo('Ícone no mapa')).not.toBeNull()
    expect(container.textContent).toContain('Vale para o próximo ponto de interesse que você cravar.')
  })
})
