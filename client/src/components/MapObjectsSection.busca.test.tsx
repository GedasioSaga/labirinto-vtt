import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneSearchSource } from '../lib/buscaNaAventura'
import type { MapData, Region } from '../types/map'
import { MapObjectsSection, type MapObjectsSectionProps } from './MapObjectsSection'

/**
 * BUSCA DO MESTRE (Ctrl+K) em todas as cenas: com algo digitado, a seção
 * "Objetos do mapa" também lista, num grupo "Outras cenas", as salas, pinos e
 * fichas das OUTRAS cenas da aventura — cada linha com o caminho de onde mora.
 * Clique ou Enter leva lá; "Mandar ficha" pergunta quem vai para lá.
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
  regions: [sala('r-cripta', 'Cripta', 1500, 1850)],
  tokens: [{ id: 'k-heroi', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }],
}

const CRIPTA: MapData = {
  ...createEmptyMap('map_cripta', 'Cripta Rubra', 40, 16, 50),
  regions: [sala('r-trono', 'Sala do Trono', 100, 600), sala('r-antecripta', 'Antecâmara da Cripta', 700, 900)],
  tokens: [{ id: 'k-vigia', characterId: null, name: 'Vigia', x: 250, y: 300, size: 1, image: null }],
}

const OUTRAS: SceneSearchSource[] = [{ sceneId: 's-cripta', path: ['Vale', 'Cripta Rubra'], map: CRIPTA }]

const JOGADORES = [
  { playerId: 'ana', name: 'Ana', color: '#ff0000' },
  { playerId: 'bia', name: 'Bia', color: '#00ff00' },
]

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
  const props: MapObjectsSectionProps = {
    map: SALAO,
    currentKey: null,
    onGoTo: vi.fn(),
    searchRequest: 0,
    otherScenes: OUTRAS,
    onGoToOther: vi.fn(),
    ...overrides,
  }
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

function nomeAcessivel(el: Element): string {
  let texto = ''
  for (const filho of el.childNodes) {
    if (filho instanceof Element) {
      if (filho.getAttribute('aria-hidden') === 'true') continue
      texto += ' ' + nomeAcessivel(filho) + ' '
    } else {
      texto += filho.textContent ?? ''
    }
  }
  return texto.replace(/\s+/g, ' ').trim()
}

/** As linhas de objeto (o botão grande), sem os botões "Mandar" ao lado. */
function linhas(): HTMLButtonElement[] {
  return [...corpo().querySelectorAll<HTMLButtonElement>('button[data-objeto]')]
}

function linha(nome: string): HTMLButtonElement {
  const achada = linhas().find((b) => nomeAcessivel(b).includes(nome))
  if (!achada) throw new Error(`a lista não tem a linha "${nome}"`)
  return achada
}

function botaoPorNome(nome: string): HTMLButtonElement {
  const achado = [...corpo().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? nomeAcessivel(b)) === nome)
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(alvo: HTMLElement, key: string, shiftKey = false): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  act(() => {
    alvo.dispatchEvent(evento)
  })
  return evento
}

function titulosDosGrupos(): string[] {
  return [...corpo().querySelectorAll('h3')].map((h) => h.textContent?.replace(/\s+/g, ' ').trim() ?? '')
}

describe('MapObjectsSection: busca em todas as cenas', () => {
  it('sem nada digitado, só a cena aberta: as outras cenas não entram na lista', () => {
    render()
    abrir()
    expect(titulosDosGrupos()).toEqual(['Salas 1', 'Tokens 1'])
    expect(corpo().textContent).not.toContain('Sala do Trono')
  })

  it('digitando, o grupo "Outras cenas" mostra o achado com o caminho de onde ele mora', () => {
    render()
    abrir()
    digitar(busca(), 'trono')
    expect(titulosDosGrupos()).toEqual(['Outras cenas 1'])
    expect(nomeAcessivel(linha('Sala do Trono'))).toBe('Sala do Trono Vale › Cripta Rubra')
    expect(corpo().textContent).toContain('Nenhum nesta cena · 1 em outras cenas')
  })

  it('o mesmo nome aqui e lá: a cena aberta primeiro, depois as outras', () => {
    render()
    abrir()
    digitar(busca(), 'cripta')
    expect(titulosDosGrupos()).toEqual(['Salas 1', 'Outras cenas 1'])
    expect(linhas().map((b) => nomeAcessivel(b))).toEqual(['Cripta', 'Antecâmara da Cripta Vale › Cripta Rubra'])
    expect(corpo().textContent).toContain('1 de 2 objetos · 1 em outras cenas')
  })

  it('clique na linha de outra cena pede o "Ir lá" com a cena e o objeto', () => {
    const props = render()
    abrir()
    digitar(busca(), 'vigia')
    act(() => linha('Vigia').click())
    expect(props.onGoTo).not.toHaveBeenCalled()
    expect(props.onGoToOther).toHaveBeenCalledTimes(1)
    expect(vi.mocked(props.onGoToOther ?? vi.fn()).mock.calls[0][0]).toMatchObject({ sceneId: 's-cripta', objectKey: 'token:k-vigia', name: 'Vigia' })
  })

  it('Enter sem achado na cena aberta vai ao primeiro de outra cena, e a linha dele mostra isso', () => {
    const props = render()
    abrir()
    digitar(busca(), 'trono')
    expect(linha('Sala do Trono').dataset.enter).toBe('true')
    tecla(busca(), 'Enter')
    expect(props.onGoToOther).toHaveBeenCalledTimes(1)
    expect(vi.mocked(props.onGoToOther ?? vi.fn()).mock.calls[0][0]).toMatchObject({ objectKey: 'room:r-trono' })
  })

  it('cena aberta vazia, mas com outras cenas: o campo aparece e acha lá', () => {
    render({ map: createEmptyMap('map_vazio', 'Vazio', 10, 10, 50) })
    abrir()
    digitar(busca(), 'trono')
    expect(linhas().map((b) => nomeAcessivel(b))).toEqual(['Sala do Trono Vale › Cripta Rubra'])
  })

  it('sem jogador com ficha, não há "Mandar ficha"', () => {
    render()
    abrir()
    digitar(busca(), 'trono')
    expect([...corpo().querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Mandar ficha'))).toBe(false)
  })

  it('"Mandar ficha" pergunta quem vai; escolher manda e diz o que aconteceu', () => {
    const onSendHere = vi.fn(() => ({ ok: true, mensagem: 'Bia foi para Sala do Trono.' }))
    render({ senders: JOGADORES, onSendHere })
    abrir()
    digitar(busca(), 'trono')
    act(() => botaoPorNome('Mandar ficha para Sala do Trono').click())
    const grupo = corpo().querySelector<HTMLElement>('[role="group"]')
    expect(grupo?.getAttribute('aria-label')).toBe('Mandar quem para Sala do Trono?')
    expect(document.activeElement?.textContent).toContain('Ana')
    act(() => botaoPorNome('Bia').click())
    expect(onSendHere).toHaveBeenCalledWith('bia', { sceneId: 's-cripta', objectKey: 'room:r-trono', name: 'Sala do Trono' })
    expect(corpo().querySelector('[role="group"]')).toBeNull()
    expect(corpo().textContent).toContain('Bia foi para Sala do Trono.')
  })

  it('sala da cena aberta também recebe ficha: o alvo vai sem cena (a aberta)', () => {
    const onSendHere = vi.fn(() => ({ ok: true, mensagem: 'Ana foi para Cripta.' }))
    render({ senders: JOGADORES, onSendHere })
    abrir()
    digitar(busca(), 'cripta')
    act(() => botaoPorNome('Mandar ficha para Cripta').click())
    act(() => botaoPorNome('Ana').click())
    expect(onSendHere).toHaveBeenCalledWith('ana', { sceneId: null, objectKey: 'room:r-cripta', name: 'Cripta' })
  })

  it('ficha não recebe ficha: a linha de token não tem "Mandar"', () => {
    render({ senders: JOGADORES, onSendHere: vi.fn(() => ({ ok: true, mensagem: '' })) })
    abrir()
    digitar(busca(), 'vigia')
    expect(linhas()).toHaveLength(1)
    expect([...corpo().querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Mandar ficha'))).toBe(false)
  })

  it('Shift+Enter na linha abre a pergunta; Esc fecha sem mandar e devolve o foco à linha', () => {
    const onSendHere = vi.fn(() => ({ ok: true, mensagem: '' }))
    const props = render({ senders: JOGADORES, onSendHere })
    abrir()
    digitar(busca(), 'trono')
    const alvo = linha('Sala do Trono')
    act(() => alvo.focus())
    const shiftEnter = tecla(alvo, 'Enter', true)
    expect(shiftEnter.defaultPrevented).toBe(true)
    expect(props.onGoToOther).not.toHaveBeenCalled()
    expect(corpo().querySelector('[role="group"]')).not.toBeNull()
    const esc = tecla(document.activeElement instanceof HTMLElement ? document.activeElement : corpo(), 'Escape')
    expect(esc.defaultPrevented).toBe(true)
    expect(corpo().querySelector('[role="group"]')).toBeNull()
    expect(onSendHere).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(linha('Sala do Trono'))
  })

  it('Shift+Enter na busca abre a pergunta para o primeiro resultado', () => {
    render({ senders: JOGADORES, onSendHere: vi.fn(() => ({ ok: true, mensagem: '' })) })
    abrir()
    digitar(busca(), 'trono')
    tecla(busca(), 'Enter', true)
    expect(corpo().querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Mandar quem para Sala do Trono?')
  })

  it('muitos achados em outras cenas: mostra os primeiros e diz quantos faltam', () => {
    const celas: MapData = {
      ...createEmptyMap('map_celas', 'Celas', 400, 10, 50),
      regions: Array.from({ length: 60 }, (_, i) => sala(`r-cela-${i}`, `Cela ${i + 1}`, i * 60, i * 60 + 50)),
    }
    render({ otherScenes: [{ sceneId: 's-celas', path: ['Celas'], map: celas }] })
    abrir()
    digitar(busca(), 'cela')
    expect(titulosDosGrupos()).toEqual(['Outras cenas 60'])
    expect(linhas().length).toBeLessThan(60)
    expect(linhas().length).toBeGreaterThan(0)
    expect(corpo().textContent).toContain('Digite mais do nome para ver o resto')
  })
})
