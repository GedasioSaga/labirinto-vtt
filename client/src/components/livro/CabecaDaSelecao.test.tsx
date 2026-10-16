import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PISO_MAX, PISO_MIN, nomeDoPiso } from '../../lib/pisos'
import type { Drawing, Prop, Region, Token, Wall } from '../../types/map'
// Os itens do menu moram num portal, no `body`: as buscas abaixo olham o documento inteiro.
import { MobiliaIcon, PropIcon } from '../icons'
import { TOOL_LABELS } from '../labels'
import {
  CabecaDaSelecao,
  deleteLabelFor,
  endireitarAction,
  floorActions,
  selectionIdentity,
  type CabecaDaSelecaoProps,
  type SelectedItems,
  type SelectionAction,
} from './CabecaDaSelecao'

/*
 * A cabeça da ficha da seleção (fatia 8 do design consolidado), no lugar da
 * faixa `SelectionHeader`: o que ela diz do item, o Apagar de sempre e o
 * "Mais ações" com as ações de cada tipo, por assunto.
 */

const NADA: SelectedItems = { region: null, token: null, wall: null, prop: null, light: null, stair: null, textLabel: null, floorPiece: null }

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
const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda do cais', x: 64, y: 64, size: 1, image: null, color: '#e2645a' }
const PAREDE: Wall = { id: 'p1', x1: 0, y1: 0, x2: 128, y2: 0, blocksLight: true, blocksMove: true, door: null }
const PORTA: Wall = { ...PAREDE, id: 'p2', door: { open: false, locked: false, kind: 'normal' } }
const PLACA: Extract<Drawing, { kind: 'text' }> = { id: 't1', kind: 'text', x: 0, y: 0, text: 'Cuidado\ncom o cão', color: '#fff', fontSize: 16 }

describe('selectionIdentity — o que a cabeça diz', () => {
  it('nome do item quando há; sem nome (ou em branco), só o tipo', () => {
    expect(selectionIdentity({ kind: 'region', count: 1 }, { ...NADA, region: sala('Salão') })).toEqual({ icon: 'room', type: 'Sala', name: 'Salão' })
    expect(selectionIdentity({ kind: 'region', count: 1 }, { ...NADA, region: sala('   ') })).toEqual({ icon: 'room', type: 'Sala', name: null })
    expect(selectionIdentity({ kind: 'region', count: 1 }, { ...NADA, region: REGIAO })).toEqual({ icon: 'region', type: 'Região', name: null })
    expect(selectionIdentity({ kind: 'token', count: 1 }, { ...NADA, token: GUARDA })).toEqual({ icon: 'token', type: 'Token', name: 'Guarda do cais' })
    expect(selectionIdentity({ kind: 'drawing', count: 1 }, { ...NADA, textLabel: PLACA })).toEqual({ icon: 'text', type: 'Texto', name: 'Cuidado' })
    expect(selectionIdentity({ kind: 'drawing', count: 1 }, NADA)).toEqual({ icon: 'drawing', type: 'Desenho', name: null })
  })

  it('vários itens: a cabeça conta quantos', () => {
    expect(selectionIdentity({ kind: 'token', count: 3 }, NADA)).toEqual({ icon: 'several', type: 'Seleção', name: '3 itens' })
  })

  it('móvel diz o que é ("Mesa", "Cama"); peça de imagem é "Peça"', () => {
    const deImagem: Prop = { id: 'o', src: 'x.png', x: 0, y: 0, width: 40, height: 40, linkedMapPath: null }
    const movel = (mobilia: Prop['mobilia']): Prop => ({ ...deImagem, src: '', mobilia })
    expect(selectionIdentity({ kind: 'prop', count: 1 }, { ...NADA, prop: movel('mesa') })).toEqual({ icon: 'mobilia', type: 'Mesa', name: null, mobilia: 'mesa' })
    expect(selectionIdentity({ kind: 'prop', count: 1 }, { ...NADA, prop: movel('catre') })).toEqual({ icon: 'mobilia', type: 'Cama', name: null, mobilia: 'catre' })
    expect(selectionIdentity({ kind: 'prop', count: 1 }, { ...NADA, prop: deImagem })).toEqual({ icon: 'prop', type: 'Peça', name: null })
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

describe('deleteLabelFor e floorActions — nomes de sempre', () => {
  it('o nome do Apagar não muda', () => {
    expect(deleteLabelFor({ kind: 'region', count: 1 })).toBe('Apagar região selecionada')
    expect(deleteLabelFor({ kind: 'token', count: 1 })).toBe('Apagar token selecionado')
    expect(deleteLabelFor({ kind: 'prop', count: 3 })).toBe('Apagar 3 itens selecionados')
  })

  it('"Levar ao piso": um acima e um abaixo; na ponta, o item fica com o motivo', () => {
    const onLevar = vi.fn()
    const acoes = floorActions(0, onLevar)
    expect(acoes.map((a) => a.label)).toEqual(['Levar ao 1º piso', 'Levar ao 1º subsolo'])
    acoes[1]?.onSelect()
    expect(onLevar).toHaveBeenCalledWith(-1)
    expect(floorActions(PISO_MAX, vi.fn())[0]?.disabledReason).toBe('Não há piso acima deste.')
    expect(floorActions(PISO_MIN, vi.fn())[1]?.disabledReason).toBe('Não há subsolo abaixo deste.')
  })
})

describe('CabecaDaSelecao', () => {
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

  const NOTA = 'O editor passa a mostrar o piso de destino.'

  function montar(extra: Partial<CabecaDaSelecaoProps> = {}) {
    const props: CabecaDaSelecaoProps = {
      identidade: { icon: 'room', type: 'Sala', name: 'Salão' },
      rotuloApagar: 'Apagar região selecionada',
      onApagar: () => {},
      acoes: [],
      notaDasAcoes: null,
      ...extra,
    }
    act(() => root.render(<CabecaDaSelecao {...props} />))
  }

  const barra = () => container.querySelector<HTMLElement>('[role="toolbar"]')
  const botao = (nome: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)
  const itens = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  const nomeDe = (item: Element) => document.getElementById(item.getAttribute('aria-labelledby') ?? '')?.textContent
  const tecla = (alvo: Element | null, key: string) => act(() => void alvo?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))

  it('é a barra das ações, sem título, descrita pelo nome e pelo tipo', () => {
    montar()
    expect(barra()?.getAttribute('aria-label')).toBe('Ações da seleção')
    expect(container.querySelector('h1, h2, h3, h4')).toBeNull()
    expect(document.getElementById(barra()?.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Salão Sala')
  })

  it('sem nome, uma linha só com o tipo; porta com as salas dela embaixo', () => {
    montar({ identidade: { icon: 'wall', type: 'Parede', name: null } })
    expect(container.querySelector('.gr-cabeca__nome')?.textContent).toBe('Parede')
    expect(container.querySelector('.gr-cabeca__tipo')).toBeNull()
    montar({ identidade: { icon: 'door', type: 'Porta', name: null }, onde: 'Adega e Corredor' })
    expect(container.querySelector('.gr-cabeca__tipo')?.textContent).toBe('Adega e Corredor')
  })

  it('token: retrato na cor dele com as iniciais; os outros tipos, medalha de latão', () => {
    montar({ identidade: { icon: 'token', type: 'Token', name: 'Guarda do cais' }, token: GUARDA })
    const retrato = container.querySelector<HTMLElement>('.gr-cabeca__retrato')
    // As iniciais do disco do Grupo e do Acervo (`iniciaisDaFicha`): as duas primeiras palavras.
    expect(retrato?.textContent).toBe('GD')
    expect(retrato?.style.background).toBe('rgb(226, 100, 90)')
    expect(container.querySelector('.gr-cabeca__med')).toBeNull()
    montar()
    expect(container.querySelector('.gr-cabeca__med svg')).not.toBeNull()
  })

  it('Apagar: um botão só, com o nome e o texto de sempre, a tecla Delete, e apaga', () => {
    const onApagar = vi.fn()
    montar({ onApagar })
    const apagar = Array.from(container.querySelectorAll('button')).filter((b) => /Apagar/.test(b.getAttribute('aria-label') ?? ''))
    expect(apagar).toHaveLength(1)
    expect(apagar[0]?.textContent).toBe('Apagar região selecionada')
    expect(apagar[0]?.getAttribute('aria-keyshortcuts')).toBe('Delete')
    act(() => apagar[0]?.click())
    expect(onApagar).toHaveBeenCalledTimes(1)
  })

  it('sem ação no menu, o "Mais ações" não aparece', () => {
    montar({ acoes: [] })
    expect(botao('Mais ações')).toBeNull()
  })

  describe('ícone do móvel na medalha', () => {
    function desenhoDe(icone: ReactElement): string {
      const avulso = document.createElement('div')
      const raiz = createRoot(avulso)
      act(() => raiz.render(icone))
      const html = avulso.innerHTML
      act(() => raiz.unmount())
      return html
    }
    const medalha = () => container.querySelector('.gr-cabeca__med')?.innerHTML

    it('a mesa é a mesa, o baú é o baú e a peça de imagem é o peão', () => {
      montar({ identidade: { icon: 'mobilia', type: 'Mesa', name: null, mobilia: 'mesa' } })
      expect(medalha()).toBe(desenhoDe(<MobiliaIcon tipo="mesa" />))
      montar({ identidade: { icon: 'mobilia', type: 'Baú', name: null, mobilia: 'bau' } })
      expect(medalha()).toBe(desenhoDe(<MobiliaIcon tipo="bau" />))
      montar({ identidade: { icon: 'prop', type: 'Peça', name: null } })
      expect(medalha()).toBe(desenhoDe(<PropIcon />))
    })
  })

  describe('"Mais ações"', () => {
    function acoes() {
      const endireitar = vi.fn()
      const subir = vi.fn()
      const lista: SelectionAction[] = [endireitarAction(endireitar), ...floorActions(PISO_MAX, subir)]
      return { lista, endireitar, subir }
    }

    it('um assunto por trecho, separados por um fio; nome limpo, tecla à vista e a nota no pé', () => {
      montar({ acoes: acoes().lista, notaDasAcoes: NOTA })
      const mais = botao('Mais ações')
      expect(mais?.getAttribute('aria-haspopup')).toBe('menu')
      act(() => mais?.click())
      expect(mais?.getAttribute('aria-expanded')).toBe('true')
      expect(itens().map(nomeDe)).toEqual(['Endireitar', `Levar ao ${nomeDoPiso(PISO_MAX + 1)}`, `Levar ao ${nomeDoPiso(PISO_MAX - 1)}`])
      expect(document.querySelectorAll('[role="menu"] [role="separator"]')).toHaveLength(1)
      expect(itens()[0]?.querySelector('kbd')?.textContent).toBe('Alt')
      expect(document.activeElement).toBe(itens()[0])
      // O item que age é explicado só pela nota; o do Endireitar, pelo detalhe dele.
      expect(document.getElementById(itens()[2]?.getAttribute('aria-describedby') ?? '')?.textContent).toBe(NOTA)
      expect(document.getElementById(itens()[0]?.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Sem mudar o tamanho')
    })

    it('na ponta da faixa de pisos, o item fica apagado com o motivo e não age', () => {
      const { lista, subir } = acoes()
      montar({ acoes: lista, notaDasAcoes: NOTA })
      act(() => botao('Mais ações')?.click())
      const acima = itens()[1]
      expect(acima?.disabled).toBe(true)
      const [motivoId, notaId] = (acima?.getAttribute('aria-describedby') ?? '').split(' ')
      expect(document.getElementById(motivoId ?? '')?.textContent).toBe('Não há piso acima deste.')
      expect(document.getElementById(notaId ?? '')?.textContent).toBe(NOTA)
      act(() => acima?.click())
      expect(subir).not.toHaveBeenCalled()
    })

    it('escolher age uma vez, fecha e devolve o foco ao "⋯"', () => {
      const { lista, endireitar } = acoes()
      montar({ acoes: lista })
      const mais = botao('Mais ações')
      act(() => mais?.click())
      act(() => itens()[0]?.click())
      expect(endireitar).toHaveBeenCalledTimes(1)
      expect(mais?.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(mais)
    })

    it('com o foco no menu, nenhuma tecla vira atalho do mapa (setas, Del, Esc)', () => {
      const atalhoDoMapa = vi.fn()
      window.addEventListener('keydown', atalhoDoMapa)
      try {
        montar({ acoes: acoes().lista })
        act(() => botao('Mais ações')?.click())
        tecla(document.activeElement, 'ArrowDown')
        tecla(document.activeElement, 'Delete')
        tecla(document.activeElement, 'Escape')
        expect(atalhoDoMapa).not.toHaveBeenCalled()
        expect(document.activeElement).toBe(botao('Mais ações'))
      } finally {
        window.removeEventListener('keydown', atalhoDoMapa)
      }
    })
  })
})
