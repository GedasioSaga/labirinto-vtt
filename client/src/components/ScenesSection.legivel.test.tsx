import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MINUTO_MS } from '../lib/cenaQueEspera'
import type { SceneDeletionInfo, SceneListItem } from '../stores/adventureStore'
import { ScenesSection, type ScenesSectionProps } from './ScenesSection'

/**
 * cenas-legiveis — a linha da cena dá a largura ao nome (bar: painel de camadas
 * do Figma e o Explorer do VS Code). A primeira linha do item vira
 * nome | info (selos, espera, contagem) | controles: o nome inteiro mora no
 * title, a contagem fica discreta (ícone + número) sem perder o texto para o
 * leitor de tela, e o estado que antes só o botão mostrava (pausada, planta
 * conhecida) ganha um selo que fica visível quando os controles se escondem.
 */
const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salão principal da mansão', active: true, available: true, renamable: true, tokenCount: 12 },
  {
    id: 's-biblioteca',
    name: 'Biblioteca do segundo andar',
    active: false,
    available: true,
    renamable: true,
    tokenCount: 1,
    parentId: 's-salao',
    planKnownByAll: true,
  },
  { id: 's-torre', name: 'Torre', active: false, available: false, loading: true, renamable: false, tokenCount: null },
  { id: 's-poco', name: 'Poço', active: false, available: false, renamable: false, tokenCount: null },
]

const SEM_BLOQUEIO: SceneDeletionInfo = { orphanPins: 0, blockers: [], inside: 0 }
const AGORA = Date.UTC(2026, 8, 27, 21, 0, 0)

describe('ScenesSection: nomes legíveis na lista de cenas', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA)
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function render(extra: Partial<ScenesSectionProps> = {}): void {
    act(() =>
      root.render(
        <ScenesSection
          scenes={CENAS}
          onSelect={() => {}}
          onCreate={() => {}}
          onRename={() => {}}
          onDuplicate={() => {}}
          onShift={() => {}}
          onDelete={() => {}}
          deletionInfo={() => SEM_BLOQUEIO}
          onTogglePause={() => {}}
          onTogglePlanKnown={() => {}}
          {...extra}
        />,
      ),
    )
  }

  function linha(id: string): HTMLLIElement {
    const li = container.querySelector<HTMLLIElement>(`li[data-cena-id="${id}"]`)
    if (li === null) throw new Error(`sem a linha ${id}`)
    return li
  }

  function nome(id: string): HTMLButtonElement {
    const botao = container.querySelector<HTMLButtonElement>(`button[data-cena-nome="${id}"]`)
    if (botao === null) throw new Error(`sem o nome de ${id}`)
    return botao
  }

  /** A primeira linha do item: filha direta do `<li>`, como a linha de uma árvore. */
  function primeiraLinha(id: string): HTMLElement {
    const achada = Array.from(linha(id).children).find((filho) => filho.classList.contains('lb-cenas__linha'))
    if (!(achada instanceof HTMLElement)) throw new Error(`a linha ${id} não tem .lb-cenas__linha como filha direta`)
    return achada
  }

  function parte(id: string, seletor: string): HTMLElement {
    const achada = primeiraLinha(id).querySelector<HTMLElement>(seletor)
    if (achada === null) throw new Error(`sem ${seletor} na linha ${id}`)
    return achada
  }

  function antes(a: Node, b: Node): boolean {
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  }

  it('o title do nome traz o nome inteiro e, na cena que não abre, o motivo', () => {
    render()
    expect(nome('s-salao').getAttribute('title')).toBe('Salão principal da mansão')
    expect(nome('s-torre').getAttribute('title')).toBe('Torre\nEsta cena ainda está sendo lida do disco')
    expect(nome('s-poco').getAttribute('title')).toBe('Poço\nO arquivo desta cena não foi encontrado')
    // O texto do botão continua sendo só o nome: é ele o nome acessível e o que as jornadas clicam.
    expect(nome('s-salao').textContent).toBe('Salão principal da mansão')
    expect(nome('s-biblioteca').textContent).toBe('Biblioteca do segundo andar')
  })

  it('a cena que espera repete a espera no title do nome, e o selo fica na info', () => {
    render({ waitingSince: new Map([['s-biblioteca', AGORA - 11 * MINUTO_MS]]) })
    expect(nome('s-biblioteca').getAttribute('title')).toBe('Biblioteca do segundo andar\nEsperando você há 11 min · Ctrl+J abre a que espera mais')
    const espera = parte('s-biblioteca', '.lb-cenas__info .lb-cenas__espera')
    expect(espera.textContent).toBe('há 11 min')
    expect(espera.getAttribute('title')).toContain('Ctrl+J')
  })

  it('a primeira linha é nome, depois info, depois os controles, em toda profundidade', () => {
    render()
    for (const [id, cena] of [
      ['s-salao', 'Salão principal da mansão'],
      ['s-biblioteca', 'Biblioteca do segundo andar'],
    ] as const) {
      const botaoNome = parte(id, '.lb-cenas__nome')
      const info = parte(id, '.lb-cenas__info')
      const controles = parte(id, '.lb-cenas__controles')
      expect(botaoNome).toBe(nome(id))
      expect(antes(botaoNome, info)).toBe(true)
      expect(antes(info, controles)).toBe(true)
      for (const acao of [`Pausar ${cena}`, `Planta de ${cena}`, `Mais ações de ${cena}`]) {
        expect(controles.querySelector(`button[aria-label="${acao}"]`), acao).not.toBeNull()
      }
    }
  })

  it('a contagem é discreta (ícone + número) e o leitor de tela ainda ouve "tokens"', () => {
    render()
    const salao = parte('s-salao', '.lb-cenas__info .lb-cenas__conta')
    expect(salao.textContent).toBe('12 tokens')
    expect(salao.getAttribute('title')).toBe('12 tokens')
    expect(salao.querySelector('svg')).not.toBeNull()
    expect(salao.querySelector('.lb-sr-only')?.textContent).toBe(' tokens')
    expect(parte('s-biblioteca', '.lb-cenas__conta').textContent).toBe('1 token')
    const torre = parte('s-torre', '.lb-cenas__conta')
    expect(torre.textContent).toBe('carregando…')
    expect(torre.getAttribute('title')).toBe('Esta cena ainda está sendo lida do disco')
    expect(parte('s-poco', '.lb-cenas__conta').textContent).toBe('indisponível')
  })

  it('pausada e planta conhecida ganham selo na info, fora dos controles que se escondem', () => {
    render({ paused: new Set(['s-biblioteca']) })
    const pausa = parte('s-biblioteca', '.lb-cenas__info .lb-cenas__selo--pausa')
    const planta = parte('s-biblioteca', '.lb-cenas__info .lb-cenas__selo--planta')
    // O selo é só olho: quem lê a tela ouve o estado no próprio botão (aria-pressed / rótulo da planta).
    expect(pausa.getAttribute('aria-hidden')).toBe('true')
    expect(planta.getAttribute('aria-hidden')).toBe('true')
    expect(primeiraLinha('s-salao').querySelector('.lb-cenas__selo')).toBeNull()
    expect(parte('s-biblioteca', 'button[aria-label="Pausar Biblioteca do segundo andar"]').getAttribute('aria-pressed')).toBe('true')
  })
})
