import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import type { Region, Token, Wall } from '../types/map'
import { PropertiesPanel, type PisosWiring } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import type { SelectionSummary } from './SelectionControls'

/*
 * A faixa da seleção e a ordem por tarefa no painel DE VERDADE (a costura com o
 * `PropertiesPanel`, não a faixa solta): Apagar numa instância só, no topo do
 * corpo; "Levar ao piso" fora da coluna, no menu; e cada item na ordem da
 * tarefa (sala: Travado e "Jogadores" logo depois do bloco Sala; porta: Porta e
 * Tipo antes de Parede; ficha: Rotação/Travado/Oculto logo depois de Condições).
 */

const SALA: Region = {
  id: 'salao',
  points: [{ x: 0, y: 0 }, { x: 256, y: 0 }, { x: 256, y: 256 }, { x: 0, y: 256 }],
  tag: '',
  fillColor: '#8a6a5a',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Salao' },
}
const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 320, y: 320, size: 1, image: null }
const PAREDE: Wall = { id: 'aresta', x1: 256, y1: 0, x2: 256, y2: 256, blocksLight: true, blocksMove: true, door: null }
const PORTA: Wall = { ...PAREDE, door: { open: false, locked: false, kind: 'normal' } }

const nada = (): void => {}

function selecao(summary: SelectionSummary | null, onRemoveSelected: () => void = nada): PainelProps['selection'] {
  return { selection: summary, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected }
}

function pisosNoTerreo(onLevarSelecaoAoPiso: (piso: number) => void = nada): PisosWiring {
  return { onTokenPisoChange: nada, onStairPisosChange: nada, pisoAtivo: 0, onEditarPiso: nada, onLevarSelecaoAoPiso }
}

describe('painel de propriedades — faixa da seleção e ordem por tarefa', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({
      map: { ...createEmptyMap('m1', 'Casa', 30, 20, 64), regions: [SALA], tokens: [GUARDA], walls: [PORTA] },
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function renderPainel(props: PainelProps): void {
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  const corpo = () => container.querySelector<HTMLElement>('.lb-inspector__body')
  /** Títulos de seção em ordem de DOM — a ordem do leitor de tela e da coluna. */
  const titulos = () => Array.from(container.querySelectorAll('.lb-inspector__body h2')).map((h) => (h.textContent ?? '').trim())
  const botoesComTexto = (texto: RegExp) => Array.from(container.querySelectorAll('button')).filter((b) => texto.test(b.textContent ?? ''))
  /** `a` vem antes de `b` no documento. */
  const antes = (a: Node | null | undefined, b: Node | null | undefined) =>
    a !== null && a !== undefined && b !== null && b !== undefined && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

  function painelDaFicha(extra: Partial<PainelProps> = {}): PainelProps {
    return propsDoPainel(GUARDA, {
      selection: selecao({ kind: 'token', count: 1 }),
      // Os quatro controles da transformação, como o App liga (`tokenTransform`).
      tokenTransform: { onRotationChange: nada, onLockedChange: nada, onHiddenChange: nada, onSecretChange: nada },
      ...extra,
    })
  }

  function painelDaSala(extra: Partial<PainelProps> = {}): PainelProps {
    return propsDoPainel(null, {
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selectedRegion: SALA,
      selection: selecao({ kind: 'region', count: 1 }),
      // Com os dois campos do Avançado ligados, como o App faz com uma região selecionada.
      regionStyle: {
        color: SALA.fillColor,
        onColorChange: nada,
        pattern: 'solid',
        onPatternChange: nada,
        strokeJoin: 'round',
        onStrokeJoinChange: nada,
        onSmoothRegion: nada,
      },
      playerSecret: { secret: false, onSecretChange: nada },
      areaTrigger: { kind: null, revealed: false, onKindChange: nada, onRevealedChange: nada },
      perigoDaSala: (
        <section className="lb-section" aria-label="Perigo">
          <h2 className="lb-eyebrow">Perigo</h2>
        </section>
      ),
      ...extra,
    })
  }

  it('com seleção, a faixa é o primeiro filho do corpo, com o tipo e o nome, e o único Apagar do painel', () => {
    const onRemoveSelected = vi.fn()
    renderPainel(painelDaFicha({ selection: selecao({ kind: 'token', count: 1 }, onRemoveSelected) }))

    const faixa = corpo()?.firstElementChild
    expect(faixa?.getAttribute('role')).toBe('toolbar')
    expect(faixa?.getAttribute('aria-label')).toBe('Ações da seleção')
    expect(faixa?.textContent).toContain('Guarda')
    expect(faixa?.textContent).toContain('Token')

    const apagar = botoesComTexto(/^Apagar token selecionado$/)
    expect(apagar).toHaveLength(1)
    expect(faixa?.contains(apagar[0] ?? null)).toBe(true)
    expect(botoesComTexto(/Nada selecionado/)).toHaveLength(0)
    // A seção "Seleção" continua, com o que vale sem seleção.
    expect(botoesComTexto(/^Adicionar token$/)).toHaveLength(1)

    act(() => apagar[0]?.click())
    expect(onRemoveSelected).toHaveBeenCalledTimes(1)
  })

  it('"Levar ao piso" saiu da coluna: só aparece no menu "Mais ações", e leva a seleção', () => {
    const onLevar = vi.fn<(piso: number) => void>()
    renderPainel(painelDaFicha({ pisos: pisosNoTerreo(onLevar) }))
    expect(botoesComTexto(/^Levar ao/)).toHaveLength(0)

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Mais ações"]')?.click())
    const itens = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(itens.map((item) => item.textContent)).toEqual(['Levar ao 1º piso', 'Levar ao 1º subsolo'])
    act(() => itens[0]?.click())
    expect(onLevar).toHaveBeenCalledWith(1)
  })

  it('sem a ligação de pisos (mapa sem aventura montada), o "Mais ações" não aparece', () => {
    renderPainel(painelDaFicha({ pisos: undefined }))
    expect(container.querySelector('button[aria-label="Mais ações"]')).toBeNull()
    expect(botoesComTexto(/^Apagar token selecionado$/)).toHaveLength(1)
  })

  it('ficha: Rotação, Travado e Oculto logo depois de Condições; a ordem item → Seleção → Chão do mapa → Camadas continua', () => {
    renderPainel(painelDaFicha())
    const lista = titulos()
    const condicoes = lista.indexOf('Condições')
    expect(condicoes).toBeGreaterThan(0)
    expect(lista[condicoes + 1]).toBe('Token')
    const transformacao = container.querySelectorAll('.lb-inspector__body h2')[condicoes + 1]?.closest('section')
    expect(transformacao?.textContent).toContain('Rotação')
    expect(transformacao?.textContent).toContain('Travado')
    expect(transformacao?.textContent).toContain('Oculto para jogadores')
    // "Ficha de jogador" foi para junto de "Ficha de NPC", fora dos gestos de mesa.
    expect(transformacao?.textContent).not.toContain('Ficha de jogador')
    const rotulo = (texto: string) => Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').includes(texto))
    expect(antes(rotulo('Ficha de NPC'), rotulo('Ficha de jogador'))).toBe(true)

    const selecaoIdx = lista.indexOf('Seleção')
    expect(selecaoIdx).toBeGreaterThan(condicoes + 1)
    expect(lista.indexOf('Chão do mapa')).toBeGreaterThan(selecaoIdx)
    expect(lista.indexOf('Camadas')).toBeGreaterThan(lista.indexOf('Chão do mapa'))
  })

  it('sala: Travado e Oculto para jogadores num bloco só, logo depois do bloco Sala; depois Região, Preenchimento, Gatilho, Perigo e o Avançado', () => {
    const onSecretChange = vi.fn<(secret: boolean) => void>()
    renderPainel(painelDaSala({ playerSecret: { secret: false, onSecretChange } }))
    const lista = titulos()
    expect(lista.slice(0, 4)).toEqual(['Sala', 'Sala', 'Região', 'Preenchimento'])
    // Na região o "Oculto para jogadores" não traz mais nada: sem o bloco "Jogadores" à parte.
    expect(lista).not.toContain('Jogadores')
    const h2 = Array.from(container.querySelectorAll('.lb-inspector__body h2'))
    const travado = h2[1]?.closest('section')
    const interruptores = Array.from(travado?.querySelectorAll('label.lb-switch') ?? []).map((l) => (l.textContent ?? '').trim())
    expect(interruptores).toEqual(['Travado', 'Oculto para jogadores'])
    // Um "Oculto para jogadores" só no painel, e é ele que grava o segredo.
    const ocultos = Array.from(container.querySelectorAll('label.lb-switch')).filter((l) => (l.textContent ?? '').includes('Oculto para jogadores'))
    expect(ocultos).toHaveLength(1)
    act(() => ocultos[0]?.querySelector('input')?.click())
    expect(onSecretChange).toHaveBeenCalledWith(true)

    const preenchimento = h2[3]
    const gatilho = container.querySelector('[role="radiogroup"][aria-label="Gatilho da área"]')
    const perigo = h2.find((h) => h.textContent === 'Perigo')
    const avancado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Avançado'))
    expect(antes(preenchimento, gatilho)).toBe(true)
    expect(antes(gatilho, perigo)).toBe(true)
    expect(antes(perigo, avancado)).toBe(true)
    expect(antes(avancado, h2.find((h) => h.textContent === 'Seleção'))).toBe(true)

    const faixa = corpo()?.firstElementChild
    expect(faixa?.textContent).toContain('Salao')
    expect(faixa?.textContent).toContain('Sala')
    expect(botoesComTexto(/^Apagar região selecionada$/)).toHaveLength(1)
  })

  it('fora da região (texto, escada, pino), o "Jogadores" continua no bloco dele', () => {
    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { textLabel: true }),
        selectedTextLabel: { id: 'placa', kind: 'text', x: 0, y: 0, text: 'Cuidado', color: '#ffffff', fontSize: 16 },
        selection: selecao({ kind: 'drawing', count: 1 }),
        playerSecret: { secret: false, onSecretChange: nada },
      }),
    )
    const jogadores = Array.from(container.querySelectorAll('.lb-inspector__body h2')).find((h) => h.textContent === 'Jogadores')
    expect(jogadores?.closest('section')?.textContent).toContain('Oculto para jogadores')
    expect(corpo()?.firstElementChild?.textContent).toContain('Cuidado')
  })

  it('porta: Porta e Tipo de porta antes de Parede; parede lisa continua Parede antes de Porta', () => {
    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { wall: true, wallHasDoor: true }),
        selectedWall: PORTA,
        selection: selecao({ kind: 'wall', count: 1 }),
      }),
    )
    expect(titulos().slice(0, 3)).toEqual(['Porta', 'Tipo de porta', 'Parede'])
    expect(corpo()?.firstElementChild?.textContent).toContain('Porta')
    expect(botoesComTexto(/^Apagar parede selecionada$/)).toHaveLength(1)

    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { wall: true, wallHasDoor: false }),
        selectedWall: PAREDE,
        selection: selecao({ kind: 'wall', count: 1 }),
      }),
    )
    expect(titulos().slice(0, 2)).toEqual(['Parede', 'Porta'])
  })

  it('vários itens: a faixa conta quantos e apaga todos de uma vez', () => {
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: selecao({ kind: 'token', count: 3 }) }))
    const faixa = corpo()?.firstElementChild
    expect(faixa?.textContent).toContain('3 itens')
    expect(botoesComTexto(/^Apagar 3 itens selecionados$/)).toHaveLength(1)
  })

  it('nada selecionado: sem faixa, e o "Nada selecionado" desabilitado na seção Seleção', () => {
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: selecao(null) }))
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
    const nadaSel = botoesComTexto(/^Nada selecionado$/)
    expect(nadaSel).toHaveLength(1)
    expect(nadaSel[0]?.disabled).toBe(true)
    expect(botoesComTexto(/Apagar/)).toHaveLength(0)
  })

  it('ferramenta armada sem seleção: sem faixa, e o primeiro título é o da ferramenta', () => {
    renderPainel(propsDoPainel(null, { activeTool: 'room', groups: relevantPropertyGroups('room'), selection: selecao(null) }))
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
    expect(titulos()[0]).toBe('Ferramenta · Sala')
  })
})
