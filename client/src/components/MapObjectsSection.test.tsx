import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region } from '../types/map'
import { MapObjectsSection, type MapObjectsSectionProps } from './MapObjectsSection'

/**
 * "Objetos do mapa" na aba Mapa: a busca filtra enquanto digita, cada objeto é
 * um botão com o nome dele, e o clique (ou Enter) pede o "Ir até lá". O que o
 * pedido faz no editor (selecionar, câmera) é de `stores/mapObjectNavigation`.
 */

function sala(id: string, nome: string, x1: number, x2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: 100 },
      { x: x2, y: 100 },
      { x: x2, y: 500 },
      { x: x1, y: 500 },
    ],
    tag: '',
    fillColor: '#1e8c8c',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

const SALAO: MapData = {
  ...createEmptyMap('map_salao', 'Salão', 40, 16, 50),
  regions: [sala('r-entrada', 'Salão de Entrada', 100, 600), sala('r-cripta', 'Cripta', 1500, 1850)],
  walls: [{ id: 'w-porta', x1: 1500, y1: 350, x2: 1500, y2: 450, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }],
  pins: [{ id: 'p-bau', x: 1650, y: 250, kind: 'exclamacao', description: 'Baú do tesouro', image: null }],
  drawings: [{ id: 't-aviso', kind: 'text', x: 900, y: 100, text: 'Cuidado com o chão', color: '#ffffff', fontSize: 24 }],
  tokens: [
    { id: 'k-lanterna', characterId: null, name: 'Lanterna', x: 1250, y: 700, size: 1, image: null, color: '#ff5a00' },
    { id: 'k-heroi', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null },
  ],
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

function render(overrides: Partial<MapObjectsSectionProps> = {}): MapObjectsSectionProps {
  const props: MapObjectsSectionProps = { map: SALAO, currentKey: null, onGoTo: vi.fn(), searchRequest: 0, ...overrides }
  act(() => root.render(<MapObjectsSection {...props} />))
  return props
}

function cabecalho(): HTMLButtonElement {
  const botao = [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent?.trim() === 'Objetos do mapa')
  if (!botao) throw new Error('sem o botão "Objetos do mapa"')
  return botao
}

function corpo(): HTMLElement {
  const el = document.getElementById(cabecalho().getAttribute('aria-controls') ?? '')
  if (el === null) throw new Error('o cabeçalho não aponta para o corpo')
  return el
}

function abrir(): void {
  if (cabecalho().getAttribute('aria-expanded') !== 'true') act(() => cabecalho().click())
}

function busca(): HTMLInputElement {
  const campo = corpo().querySelector<HTMLInputElement>('input[type="search"]')
  if (campo === null) throw new Error('sem o campo de busca')
  return campo
}

/** Nome acessível da linha como o leitor de tela ouve: o texto, sem as marcas `aria-hidden`. */
function nomeAcessivel(el: Element): string {
  let texto = ''
  for (const filho of el.childNodes) {
    if (filho instanceof Element) {
      if (filho.getAttribute('aria-hidden') === 'true') continue
      texto += nomeAcessivel(filho)
    } else {
      texto += filho.textContent ?? ''
    }
  }
  return texto.replace(/\s+/g, ' ').trim()
}

function linhas(): HTMLButtonElement[] {
  return [...corpo().querySelectorAll<HTMLButtonElement>('li button')]
}

function linha(nome: string): HTMLButtonElement {
  const achada = linhas().find((b) => nomeAcessivel(b).includes(nome))
  if (!achada) throw new Error(`a lista não tem a linha "${nome}"`)
  return achada
}

/** Digita como o React vê: muda o valor pelo setter nativo e dispara `input`. */
function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(alvo: HTMLElement, key: string): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('MapObjectsSection', () => {
  it('nasce recolhida: só o cabeçalho "Objetos do mapa", e a lista nem existe no DOM', () => {
    render()
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false')
    expect(corpo().hidden).toBe(true)
    expect(container.textContent).not.toContain('Cripta')
    expect(container.querySelector('input')).toBeNull()
  })

  it('aberta: campo de busca e um botão por objeto da cena, com o nome dele', () => {
    render()
    abrir()
    expect(busca().labels?.[0]?.textContent).toContain('Buscar objeto')
    const nomes = linhas().map(nomeAcessivel)
    for (const nome of ['Salão de Entrada', 'Cripta', 'Porta', 'Baú do tesouro', 'Lanterna', 'Heroi', 'Cuidado com o chão']) {
      expect(nomes.some((n) => n.includes(nome)), `falta "${nome}" em ${JSON.stringify(nomes)}`).toBe(true)
    }
    expect(linhas()).toHaveLength(7)
    // Os grupos têm título, com quantos há em cada um.
    const grupos = [...corpo().querySelectorAll('h3')].map((h) => h.textContent?.replace(/\s+/g, ' ').trim())
    expect(grupos).toEqual(['Salas 2', 'Portas 1', 'Pinos 1', 'Tokens 2', 'Textos 1'])
  })

  it('a sala vem antes da porta dela: o primeiro "Cripta" da lista é a sala', () => {
    render()
    abrir()
    const primeiraCripta = linhas().find((b) => nomeAcessivel(b).includes('Cripta'))
    expect(primeiraCripta && nomeAcessivel(primeiraCripta)).toBe('Cripta')
    expect(nomeAcessivel(linha('Porta'))).toBe('Porta Cripta')
  })

  it('digitar filtra enquanto digita, sem diferença de maiúscula; apagar traz tudo de volta', () => {
    render()
    abrir()
    digitar(busca(), 'CRIP')
    expect(linhas().map(nomeAcessivel)).toEqual(['Cripta', 'Porta Cripta'])
    expect(corpo().textContent).toContain('2 de 7 objetos')
    digitar(busca(), '')
    expect(linhas()).toHaveLength(7)
    expect(corpo().textContent).toContain('7 objetos')
  })

  it('sem resultado, a lista diz que não achou, e "Limpar busca" traz tudo de volta com o cursor no campo', () => {
    render()
    abrir()
    digitar(busca(), 'zzz')
    expect(linhas()).toHaveLength(0)
    expect(corpo().textContent).toContain('Nenhum objeto com “zzz”')
    const limpar = [...corpo().querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Limpar busca')
    if (!limpar) throw new Error('sem o botão "Limpar busca"')
    act(() => limpar.click())
    expect(busca().value).toBe('')
    expect(linhas()).toHaveLength(7)
    expect(document.activeElement).toBe(busca())
  })

  it('clique na linha pede o "Ir até lá" daquele objeto', () => {
    const props = render()
    abrir()
    act(() => linha('Lanterna').click())
    expect(props.onGoTo).toHaveBeenCalledTimes(1)
    expect(vi.mocked(props.onGoTo).mock.calls[0][0]).toMatchObject({ key: 'token:k-lanterna', name: 'Lanterna' })
  })

  it('Enter na busca vai ao primeiro resultado, que aparece destacado; sem nada digitado, o Enter não escolhe ninguém', () => {
    const props = render()
    abrir()
    const destacadas = () => linhas().filter((b) => b.dataset.enter === 'true').map(nomeAcessivel)
    expect(destacadas()).toEqual([])
    tecla(busca(), 'Enter')
    expect(props.onGoTo).not.toHaveBeenCalled()

    digitar(busca(), 'luz')
    tecla(busca(), 'Enter')
    expect(props.onGoTo).not.toHaveBeenCalled()

    digitar(busca(), 'crip')
    expect(destacadas()).toEqual(['Cripta'])
    digitar(busca(), 'lant')
    expect(destacadas()).toEqual(['Lanterna'])
    tecla(busca(), 'Enter')
    expect(props.onGoTo).toHaveBeenCalledTimes(1)
    expect(vi.mocked(props.onGoTo).mock.calls[0][0]).toMatchObject({ key: 'token:k-lanterna' })
  })

  it('setas: da busca para a lista, de linha em linha sem chegar ao mapa, e de volta à busca', () => {
    render()
    abrir()
    const noMapa = vi.fn()
    window.addEventListener('keydown', noMapa)
    try {
      busca().focus()
      tecla(busca(), 'ArrowDown')
      expect(document.activeElement).toBe(linhas()[0])
      tecla(linhas()[0], 'ArrowDown')
      expect(document.activeElement).toBe(linhas()[1])
      tecla(linhas()[1], 'End')
      expect(document.activeElement).toBe(linhas()[6])
      tecla(linhas()[6], 'Home')
      expect(document.activeElement).toBe(linhas()[0])
      tecla(linhas()[0], 'ArrowUp')
      expect(document.activeElement).toBe(busca())
      // Seta com foco num botão empurraria o objeto selecionado no mapa (atalho de mover).
      expect(noMapa).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', noMapa)
    }
  })

  it('só uma linha por vez entra no Tab (a última que teve foco), para o Tab atravessar a lista num passo', () => {
    render()
    abrir()
    const tabulaveis = () => linhas().filter((b) => b.tabIndex === 0)
    expect(tabulaveis()).toEqual([linhas()[0]])
    busca().focus()
    tecla(busca(), 'ArrowDown')
    tecla(linhas()[0], 'ArrowDown')
    expect(tabulaveis()).toEqual([linhas()[1]])
  })

  it('Esc na busca apaga o texto sem chegar ao mapa; com o campo vazio, sai do campo', () => {
    render()
    abrir()
    const noMapa = vi.fn()
    window.addEventListener('keydown', noMapa)
    try {
      busca().focus()
      digitar(busca(), 'crip')
      tecla(busca(), 'Escape')
      expect(busca().value).toBe('')
      expect(linhas()).toHaveLength(7)
      expect(document.activeElement).toBe(busca())
      tecla(busca(), 'Escape')
      expect(document.activeElement).not.toBe(busca())
      // Esc no mapa larga a seleção: aqui ele é do campo.
      expect(noMapa).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', noMapa)
    }
  })

  it('Delete numa linha que não é a do objeto selecionado não chega ao mapa (lá ele apagaria o selecionado, outro objeto)', () => {
    render({ currentKey: 'room:r-cripta' })
    abrir()
    const noMapa = vi.fn()
    window.addEventListener('keydown', noMapa)
    try {
      tecla(linha('Lanterna'), 'Delete')
      tecla(linha('Lanterna'), 'Backspace')
      expect(noMapa).not.toHaveBeenCalled()
      // Na linha do selecionado, o Delete segue para o mapa e apaga ELE, como no clique.
      tecla(linha('Cripta'), 'Delete')
      expect(noMapa).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', noMapa)
    }
  })

  it('a linha do objeto selecionado no editor fica marcada, e só ela', () => {
    render({ currentKey: 'room:r-cripta' })
    abrir()
    expect(linha('Cripta').getAttribute('aria-current')).toBe('true')
    expect(linhas().filter((b) => b.getAttribute('aria-current') === 'true')).toHaveLength(1)
  })

  it('o atalho (searchRequest) abre a seção e põe o cursor na busca; reabrir à mão depois não rouba o foco', () => {
    render({ searchRequest: 0 })
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false')
    render({ searchRequest: 1 })
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(busca())

    act(() => cabecalho().click())
    act(() => cabecalho().focus())
    act(() => cabecalho().click())
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(cabecalho())

    // Com a seção já aberta, o atalho de novo volta o cursor à busca.
    render({ searchRequest: 2 })
    expect(document.activeElement).toBe(busca())
  })

  it('cena vazia: diz que ainda não há objetos, sem campo de busca que não teria o que achar', () => {
    render({ map: createEmptyMap('vazio', 'Vazio', 10, 10, 50) })
    abrir()
    expect(corpo().querySelector('input')).toBeNull()
    expect(corpo().textContent).toContain('Esta cena ainda não tem sala, porta, pino, token nem texto.')
  })

  it('objeto que o clique não pode selecionar diz por quê, e o clique continua levando até lá', () => {
    const props = render({ map: { ...SALAO, lockedLayers: ['portas'] } })
    abrir()
    expect(nomeAcessivel(linha('Porta'))).toBe('Porta Cripta camada travada')
    act(() => linha('Porta').click())
    expect(props.onGoTo).toHaveBeenCalledTimes(1)
  })
})
