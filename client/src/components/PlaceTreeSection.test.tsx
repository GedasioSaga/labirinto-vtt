import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Region, RegionPoint } from '../types/map'
import { PLACE_ROW_HEIGHT, PlaceTreeSection, type PlaceTreeSectionProps } from './PlaceTreeSection'

/**
 * "Locais", na aba Mapa: a árvore Distrito > Quarteirão > Prédio > Piso >
 * Cômodo da cena aberta. Virtualizada (a a09 tem 2.828 locais), com a
 * contagem do que há dentro de cada um e o clique que enquadra o local.
 */

function quadrado(x: number, y: number, lado: number): RegionPoint[] {
  return [
    { x, y },
    { x: x + lado, y },
    { x: x + lado, y: y + lado },
    { x, y: y + lado },
  ]
}

function sala(id: string, nome: string, parentId?: string): Region {
  const region: Region = { id, points: quadrado(0, 0, 100), tag: '', fillColor: '#333333', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: nome } }
  return parentId === undefined ? region : { ...region, parentId }
}

const CIDADE: Region[] = [
  sala('d-porto', 'Distrito do Porto'),
  sala('q-1', 'Quarteirão 1', 'd-porto'),
  sala('p-farol', 'Prédio do Farol', 'q-1'),
  sala('piso-1', 'Piso 1', 'p-farol'),
  sala('c-cozinha', 'Cozinha', 'piso-1'),
  sala('p-banco', 'Banco', 'q-1'),
  sala('d-mercado', 'Distrito do Mercado'),
]

/** A a09 achatada: 2.828 locais todos no primeiro nível — a lista visível mais longa possível. */
function cenaPlana(total: number): Region[] {
  return Array.from({ length: total }, (_, i) => sala(`s${i}`, `Local ${String(i).padStart(4, '0')}`))
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
})

function render(overrides: Partial<PlaceTreeSectionProps> = {}): PlaceTreeSectionProps {
  const props: PlaceTreeSectionProps = { regions: CIDADE, currentId: null, onFrame: vi.fn(), ...overrides }
  act(() => root.render(<PlaceTreeSection {...props} />))
  return props
}

function cabecalho(): HTMLButtonElement {
  const botao = [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent?.trim() === 'Locais')
  if (!botao) throw new Error('sem o botão "Locais"')
  return botao
}

function abrir(): void {
  if (cabecalho().getAttribute('aria-expanded') !== 'true') act(() => cabecalho().click())
}

function arvore(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[role="tree"]')
  if (el === null) throw new Error('sem a árvore')
  return el
}

function itens(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')]
}

function item(nome: string): HTMLElement {
  const achado = itens().find((el) => el.querySelector('.lb-locais__nome')?.textContent === nome)
  if (!achado) throw new Error(`a árvore não mostra "${nome}"`)
  return achado
}

function nomesVisiveis(): string[] {
  return itens().map((el) => el.querySelector('.lb-locais__nome')?.textContent ?? '')
}

function tecla(alvo: HTMLElement, key: string): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    alvo.dispatchEvent(evento)
  })
  return evento
}

function focado(): string {
  const el = document.activeElement
  return el instanceof HTMLElement ? (el.querySelector('.lb-locais__nome')?.textContent ?? '') : ''
}

describe('PlaceTreeSection', () => {
  it('nasce recolhida e a árvore nem existe no DOM', () => {
    render()
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[role="tree"]')).toBeNull()
  })

  it('aberta: distritos no topo, já abertos, com a contagem do que há dentro', () => {
    render()
    abrir()
    expect(arvore().getAttribute('aria-label')).toBe('Locais da cena')
    expect(nomesVisiveis()).toEqual(['Distrito do Mercado', 'Distrito do Porto', 'Quarteirão 1'])
    const porto = item('Distrito do Porto')
    expect(porto.getAttribute('aria-level')).toBe('1')
    expect(porto.getAttribute('aria-expanded')).toBe('true')
    expect(porto.querySelector('.lb-locais__conta')?.textContent).toBe('5')
    expect(item('Quarteirão 1').getAttribute('aria-expanded')).toBe('false')
    expect(item('Distrito do Mercado').hasAttribute('aria-expanded')).toBe(false)
    expect(container.textContent).toContain('7 locais')
  })

  it('a seta abre e fecha sem enquadrar; o clique na linha enquadra o local', () => {
    const props = render()
    abrir()
    const seta = item('Quarteirão 1').querySelector<HTMLElement>('.lb-locais__seta')
    if (seta === null) throw new Error('Quarteirão 1 tem filhos e devia ter a seta')
    act(() => seta.click())
    expect(nomesVisiveis()).toContain('Prédio do Farol')
    expect(nomesVisiveis()).toContain('Banco')
    expect(props.onFrame).not.toHaveBeenCalled()
    act(() => item('Prédio do Farol').click())
    expect(props.onFrame).toHaveBeenCalledWith('p-farol')
  })

  it('teclado de árvore: → abre e depois entra, ← volta ao pai e depois fecha, Enter enquadra', () => {
    const props = render()
    abrir()
    act(() => item('Quarteirão 1').focus())
    tecla(item('Quarteirão 1'), 'ArrowRight')
    expect(item('Quarteirão 1').getAttribute('aria-expanded')).toBe('true')
    expect(focado()).toBe('Quarteirão 1')
    tecla(item('Quarteirão 1'), 'ArrowRight')
    expect(focado()).toBe('Banco')
    tecla(item('Banco'), 'ArrowDown')
    expect(focado()).toBe('Prédio do Farol')
    tecla(item('Prédio do Farol'), 'Enter')
    expect(props.onFrame).toHaveBeenCalledWith('p-farol')
    tecla(item('Prédio do Farol'), 'ArrowLeft')
    expect(focado()).toBe('Quarteirão 1')
    tecla(item('Quarteirão 1'), 'ArrowLeft')
    expect(item('Quarteirão 1').getAttribute('aria-expanded')).toBe('false')
    expect(nomesVisiveis()).not.toContain('Banco')
  })

  it('digitar a inicial salta para o local, e a tecla não chega aos atalhos do mapa', () => {
    render()
    abrir()
    const atalhoDoMapa = vi.fn()
    window.addEventListener('keydown', atalhoDoMapa)
    try {
      act(() => item('Distrito do Mercado').focus())
      const evento = tecla(item('Distrito do Mercado'), 'q')
      expect(focado()).toBe('Quarteirão 1')
      expect(evento.defaultPrevented).toBe(true)
      tecla(item('Quarteirão 1'), 'ArrowUp')
      expect(focado()).toBe('Distrito do Porto')
      expect(atalhoDoMapa).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', atalhoDoMapa)
    }
  })

  it('o local selecionado no editor fica marcado', () => {
    render({ currentId: 'q-1' })
    abrir()
    expect(item('Quarteirão 1').getAttribute('aria-selected')).toBe('true')
    expect(item('Distrito do Porto').getAttribute('aria-selected')).toBe('false')
  })

  it('cena sem sala diz isso em vez de abrir espaço em branco', () => {
    render({ regions: [] })
    abrir()
    expect(container.querySelector('[role="tree"]')).toBeNull()
    expect(container.textContent).toContain('Esta cena ainda não tem sala.')
  })

  it('a09 (2.828 locais): monta só as linhas da janela, e a rolagem troca a janela sem montar a lista inteira', () => {
    render({ regions: cenaPlana(2828) })
    abrir()
    expect(container.textContent).toContain('2.828 locais')
    const inicio = itens()
    expect(inicio.length).toBeGreaterThan(5)
    expect(inicio.length).toBeLessThanOrEqual(40)
    expect(inicio[0].getAttribute('aria-posinset')).toBe('1')
    expect(inicio[0].getAttribute('aria-setsize')).toBe('2828')
    // O espaço rolável é o da lista inteira, para a barra de rolagem dizer o tamanho real.
    const espaco = arvore().firstElementChild
    expect(espaco instanceof HTMLElement ? espaco.style.height : '').toBe(`${2828 * PLACE_ROW_HEIGHT}px`)

    act(() => {
      arvore().scrollTop = 2000 * PLACE_ROW_HEIGHT
      arvore().dispatchEvent(new Event('scroll'))
    })
    const depois = itens()
    expect(depois.length).toBeLessThanOrEqual(40)
    const posicoes = depois.map((el) => Number(el.getAttribute('aria-posinset')))
    expect(posicoes).toContain(2001)
    // Fora da janela só fica montada a parada do Tab (a linha 1): sem ela a árvore sairia da ordem do Tab.
    expect(posicoes.filter((p) => p < 1900)).toEqual([1])
    expect(itens().find((el) => el.getAttribute('aria-posinset') === '1')?.tabIndex).toBe(0)
  })

  it('End leva ao último local da a09 e ele está montado e com foco', () => {
    render({ regions: cenaPlana(2828) })
    abrir()
    act(() => itens()[0].focus())
    tecla(itens()[0], 'End')
    expect(focado()).toBe('Local 2827')
    expect(itens().length).toBeLessThanOrEqual(40)
  })
})
