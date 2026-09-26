import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PISO_MAX, PISO_MIN } from '../lib/pisos'
import type { Drawing, Region, Token, Wall } from '../types/map'
import { TOOL_LABELS } from './labels'
import {
  SelectionHeader,
  deleteLabelFor,
  floorActions,
  selectionIdentity,
  type SelectedItems,
  type SelectionAction,
  type SelectionHeaderProps,
} from './SelectionHeader'

const NADA: SelectedItems = {
  region: null,
  token: null,
  wall: null,
  prop: null,
  light: null,
  stair: null,
  textLabel: null,
  floorPiece: null,
}

function sala(nome: string): Region {
  return {
    id: 'salao',
    points: [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 128 }, { x: 0, y: 128 }],
    tag: '',
    fillColor: '#8a6a5a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

const REGIAO: Region = { ...sala(''), id: 'campo', room: undefined }
const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 64, y: 64, size: 1, image: null }
const PAREDE: Wall = { id: 'p1', x1: 0, y1: 0, x2: 128, y2: 0, blocksLight: true, blocksMove: true, door: null }
const PORTA: Wall = { ...PAREDE, id: 'p2', door: { open: false, locked: false, kind: 'normal' } }
const PLACA: Extract<Drawing, { kind: 'text' }> = { id: 't1', kind: 'text', x: 0, y: 0, text: 'Cuidado\ncom o cão', color: '#fff', fontSize: 16 }

describe('selectionIdentity — o que a faixa diz', () => {
  it('sala: o nome em cima e "Sala" como tipo; sem nome, só o tipo', () => {
    expect(selectionIdentity({ kind: 'region', count: 1 }, { ...NADA, region: sala('Salão') })).toEqual({ icon: 'room', type: 'Sala', name: 'Salão' })
    expect(selectionIdentity({ kind: 'region', count: 1 }, { ...NADA, region: sala('   ') })).toEqual({ icon: 'room', type: 'Sala', name: null })
  })

  it('região simples é "Região", ficha é "Token" com o nome, porta e parede pelo que são', () => {
    expect(selectionIdentity({ kind: 'region', count: 1 }, { ...NADA, region: REGIAO })).toEqual({ icon: 'region', type: 'Região', name: null })
    expect(selectionIdentity({ kind: 'token', count: 1 }, { ...NADA, token: GUARDA })).toEqual({ icon: 'token', type: 'Token', name: 'Guarda' })
    expect(selectionIdentity({ kind: 'wall', count: 1 }, { ...NADA, wall: PORTA }).type).toBe('Porta')
    expect(selectionIdentity({ kind: 'wall', count: 1 }, { ...NADA, wall: PAREDE }).type).toBe('Parede')
  })

  it('rótulo de texto se chama pela primeira linha; outro desenho é "Desenho"', () => {
    expect(selectionIdentity({ kind: 'drawing', count: 1 }, { ...NADA, textLabel: PLACA })).toEqual({ icon: 'text', type: 'Texto', name: 'Cuidado' })
    expect(selectionIdentity({ kind: 'drawing', count: 1 }, NADA)).toEqual({ icon: 'drawing', type: 'Desenho', name: null })
  })

  it('vários itens: a faixa conta quantos', () => {
    expect(selectionIdentity({ kind: 'token', count: 3 }, NADA)).toEqual({ icon: 'several', type: 'Seleção', name: '3 itens' })
  })

  it('o tipo repete, letra por letra, o botão da ferramenta que cria a coisa', () => {
    const tipo = (kind: Parameters<typeof selectionIdentity>[0]['kind'], items: SelectedItems) => selectionIdentity({ kind, count: 1 }, items).type
    expect(tipo('region', { ...NADA, region: sala('Salão') })).toBe(TOOL_LABELS.room)
    expect(tipo('region', { ...NADA, region: REGIAO })).toBe(TOOL_LABELS.region)
    expect(tipo('token', { ...NADA, token: GUARDA })).toBe(TOOL_LABELS.token)
    expect(tipo('wall', { ...NADA, wall: PAREDE })).toBe(TOOL_LABELS.wall)
    expect(tipo('wall', { ...NADA, wall: PORTA })).toBe(TOOL_LABELS.door)
    expect(tipo('light', NADA)).toBe(TOOL_LABELS.light)
    expect(tipo('stair', NADA)).toBe(TOOL_LABELS.stair)
    expect(tipo('prop', NADA)).toBe(TOOL_LABELS.prop)
    expect(tipo('drawing', { ...NADA, textLabel: PLACA })).toBe(TOOL_LABELS.text)
  })
})

describe('deleteLabelFor — o nome do Apagar não muda', () => {
  it('um item: o rótulo de sempre, com gênero; vários: a contagem', () => {
    expect(deleteLabelFor({ kind: 'region', count: 1 })).toBe('Apagar região selecionada')
    expect(deleteLabelFor({ kind: 'token', count: 1 })).toBe('Apagar token selecionado')
    expect(deleteLabelFor({ kind: 'wall', count: 1 })).toBe('Apagar parede selecionada')
    expect(deleteLabelFor({ kind: 'prop', count: 3 })).toBe('Apagar 3 itens selecionados')
  })
})

describe('floorActions — "Levar ao piso" do menu', () => {
  it('no térreo: 1º piso e 1º subsolo, os dois agem e levam a seleção', () => {
    const onLevar = vi.fn<(piso: number) => void>()
    const acoes = floorActions(0, onLevar)
    expect(acoes.map((a) => a.label)).toEqual(['Levar ao 1º piso', 'Levar ao 1º subsolo'])
    expect(acoes.map((a) => a.disabledReason)).toEqual([undefined, undefined])
    acoes[0]?.onSelect()
    acoes[1]?.onSelect()
    expect(onLevar.mock.calls).toEqual([[1], [-1]])
  })

  it('na ponta da faixa de pisos o item fica, esmaecido, com o motivo', () => {
    expect(floorActions(PISO_MAX, vi.fn())[0]?.disabledReason).toBe('Não há piso acima deste.')
    expect(floorActions(PISO_MAX, vi.fn())[1]?.disabledReason).toBeUndefined()
    expect(floorActions(PISO_MIN, vi.fn())[1]?.disabledReason).toBe('Não há subsolo abaixo deste.')
  })
})

describe('SelectionHeader — a faixa', () => {
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

  const DICA = 'O editor passa a mostrar o piso de destino.'

  function renderFaixa(extra: Partial<SelectionHeaderProps> = {}) {
    const props: SelectionHeaderProps = {
      identity: { icon: 'room', type: 'Sala', name: 'Salao' },
      deleteLabel: 'Apagar região selecionada',
      onDelete: () => {},
      actions: [],
      actionsHint: null,
      ...extra,
    }
    act(() => root.render(<SelectionHeader {...props} />))
  }

  const faixa = () => container.querySelector<HTMLElement>('[role="toolbar"]')
  const botao = (nome: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)
  const itens = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  const tecla = (alvo: Element | null, key: string) => act(() => void alvo?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))

  it('é uma barra de ferramentas sem título, com o nome e o tipo do item', () => {
    renderFaixa()
    expect(faixa()?.getAttribute('aria-label')).toBe('Ações da seleção')
    expect(container.querySelector('h1, h2, h3, h4')).toBeNull()
    const descricao = document.getElementById(faixa()?.getAttribute('aria-describedby') ?? '')
    expect(descricao?.textContent).toBe('Salao Sala')
  })

  it('Apagar: um botão só, com o nome e o texto de sempre, e apaga', () => {
    const onDelete = vi.fn()
    renderFaixa({ onDelete })
    const apagar = Array.from(container.querySelectorAll('button')).filter((b) => /Apagar/.test(b.getAttribute('aria-label') ?? ''))
    expect(apagar).toHaveLength(1)
    expect(apagar[0]?.textContent).toBe('Apagar região selecionada')
    expect(apagar[0]?.getAttribute('aria-keyshortcuts')).toBe('Delete')
    act(() => apagar[0]?.click())
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('sem ação no menu, o "Mais ações" não aparece', () => {
    renderFaixa({ actions: [] })
    expect(botao('Mais ações')).toBeNull()
  })

  describe('"Mais ações"', () => {
    function acoes(): { acoes: SelectionAction[]; subir: ReturnType<typeof vi.fn>; descer: ReturnType<typeof vi.fn>; fundo: ReturnType<typeof vi.fn> } {
      const subir = vi.fn()
      const descer = vi.fn()
      const fundo = vi.fn()
      return {
        subir,
        descer,
        fundo,
        acoes: [
          { label: 'Levar ao 1º piso', onSelect: subir },
          { label: 'Levar ao fundo', onSelect: fundo, disabledReason: 'Não há subsolo abaixo deste.' },
          { label: 'Levar ao 1º subsolo', onSelect: descer },
        ],
      }
    }

    it('abre o menu com os itens e o foco no primeiro que age; o botão diz que está aberto', () => {
      renderFaixa({ actions: acoes().acoes, actionsHint: DICA })
      const mais = botao('Mais ações')
      expect(mais?.getAttribute('aria-haspopup')).toBe('menu')
      expect(mais?.getAttribute('aria-expanded')).toBe('false')
      act(() => mais?.click())
      expect(mais?.getAttribute('aria-expanded')).toBe('true')
      const menu = container.querySelector('[role="menu"]')
      expect(menu?.id).toBe(mais?.getAttribute('aria-controls'))
      expect(itens().map((item) => item.textContent)).toEqual(['Levar ao 1º piso', 'Levar ao fundo Não há subsolo abaixo deste.', 'Levar ao 1º subsolo'])
      expect(document.activeElement).toBe(itens()[0])
    })

    it('setas andam pulando o item esmaecido, com volta; Home e End vão às pontas', () => {
      renderFaixa({ actions: acoes().acoes })
      act(() => botao('Mais ações')?.click())
      tecla(document.activeElement, 'ArrowDown')
      expect(document.activeElement).toBe(itens()[2])
      tecla(document.activeElement, 'ArrowDown')
      expect(document.activeElement).toBe(itens()[0])
      tecla(document.activeElement, 'ArrowUp')
      expect(document.activeElement).toBe(itens()[2])
      tecla(document.activeElement, 'Home')
      expect(document.activeElement).toBe(itens()[0])
      tecla(document.activeElement, 'End')
      expect(document.activeElement).toBe(itens()[2])
    })

    it('Esc fecha, devolve o foco ao "⋯" e não vira atalho do mapa', () => {
      const atalhoDoMapa = vi.fn()
      window.addEventListener('keydown', atalhoDoMapa)
      try {
        renderFaixa({ actions: acoes().acoes })
        act(() => botao('Mais ações')?.click())
        tecla(document.activeElement, 'Escape')
        expect(container.querySelector('[role="menu"]')).toBeNull()
        expect(document.activeElement).toBe(botao('Mais ações'))
        expect(atalhoDoMapa).not.toHaveBeenCalled()
      } finally {
        window.removeEventListener('keydown', atalhoDoMapa)
      }
    })

    it('escolher age uma vez, fecha e devolve o foco ao "⋯"', () => {
      const { acoes: lista, subir, descer } = acoes()
      renderFaixa({ actions: lista })
      act(() => botao('Mais ações')?.click())
      act(() => itens()[2]?.click())
      expect(descer).toHaveBeenCalledTimes(1)
      expect(subir).not.toHaveBeenCalled()
      expect(container.querySelector('[role="menu"]')).toBeNull()
      expect(document.activeElement).toBe(botao('Mais ações'))
    })

    it('item esmaecido fica no lugar, diz o motivo e não age', () => {
      const { acoes: lista, fundo } = acoes()
      renderFaixa({ actions: lista, actionsHint: DICA })
      act(() => botao('Mais ações')?.click())
      const esmaecido = itens()[1]
      expect(esmaecido?.getAttribute('aria-disabled')).toBe('true')
      const [motivoId, dicaId] = (esmaecido?.getAttribute('aria-describedby') ?? '').split(' ')
      expect(document.getElementById(motivoId ?? '')?.textContent).toBe('Não há subsolo abaixo deste.')
      expect(document.getElementById(dicaId ?? '')?.textContent).toBe(DICA)
      act(() => esmaecido?.click())
      expect(fundo).not.toHaveBeenCalled()
      expect(container.querySelector('[role="menu"]')).not.toBeNull()
    })

    it('a frase que explica os itens fica no pé do menu, ligada a cada item que age', () => {
      renderFaixa({ actions: acoes().acoes, actionsHint: DICA })
      act(() => botao('Mais ações')?.click())
      const primeiro = itens()[0]
      expect(primeiro?.getAttribute('aria-labelledby')).not.toBeNull()
      expect(document.getElementById(primeiro?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Levar ao 1º piso')
      expect(document.getElementById(primeiro?.getAttribute('aria-describedby') ?? '')?.textContent).toBe(DICA)
    })

    it('clique fora e Tab fecham sem roubar o foco; clicar de novo no "⋯" fecha', () => {
      renderFaixa({ actions: acoes().acoes })
      const mais = botao('Mais ações')
      act(() => mais?.click())
      act(() => void document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
      expect(container.querySelector('[role="menu"]')).toBeNull()

      act(() => mais?.click())
      tecla(document.activeElement, 'Tab')
      expect(container.querySelector('[role="menu"]')).toBeNull()

      act(() => mais?.click())
      expect(container.querySelector('[role="menu"]')).not.toBeNull()
      act(() => mais?.click())
      expect(container.querySelector('[role="menu"]')).toBeNull()
      expect(mais?.getAttribute('aria-expanded')).toBe('false')
    })
  })
})
