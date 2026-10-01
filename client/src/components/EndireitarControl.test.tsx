import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildLineDrawing, buildWallFromDraft } from '../lib/drawingFactory'
import { createEmptyMap } from '../lib/mapFactory'
import type { SelectionSet } from '../lib/selectionModel'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { Drawing, MapData, Wall } from '../types/map'
import { ENDIREITAR_DICA, EndireitarControl } from './EndireitarControl'
import { avisoDoEndireitar } from './labels'

/*
 * Pedido 5 (PEDIDOS.md, 30/09/2026), fatia 3: o botão "Endireitar" do painel.
 * É a porta de entrada visível do Alt tocado — aparece sozinho quando o clique
 * mudaria alguma coisa na seleção e some quando não há mais o que endireitar.
 * O botão nunca fica na tela sem efeito: parede presa nas duas pontas não o
 * mostra (o Alt, que avisa por quê, continua valendo para ela).
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { ...buildWallFromDraft(id, { x: x1, y: y1 }, { x: x2, y: y2 }), ...extra }
}

function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
  return buildLineDrawing(id, { x: x1, y: y1 }, { x: x2, y: y2 }, '#ffffff', 2)
}

/** A linha torta da e2e, uma reta, uma parede de Sala e uma parede presa nas duas pontas (com as âncoras). */
const MAPA: MapData = {
  ...createEmptyMap('m_botao_endireitar', 'Endireitar', 30, 20, 64),
  walls: [
    parede('sala', 700, 0, 800, 10, { regionId: 'r', regionEdgeIndex: 0 }),
    parede('presa', 0, 300, 100, 320),
    parede('p', 0, 300, 0, 250),
    parede('q', 100, 320, 100, 400),
  ],
  drawings: [linha('torta', 300, 200, 360, 420), linha('reta', 0, 40, 200, 40)],
}

/** O nome que o leitor de tela lê: o texto do botão sem o que está escondido dele (a tecla desenhada). */
function nomeAcessivel(elemento: Element): string {
  const copia = elemento.cloneNode(true)
  if (!(copia instanceof Element)) return ''
  for (const escondido of Array.from(copia.querySelectorAll('[aria-hidden="true"]'))) escondido.remove()
  return (copia.textContent ?? '').replace(/\s+/g, ' ').trim()
}

let container: HTMLDivElement
let root: Root

function selecionar(selection: SelectionSet): void {
  act(() => useMapStore.setState({ selection }))
}

function botoes(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
}

function oBotao(): HTMLButtonElement {
  const [botao, ...outros] = botoes()
  if (botao === undefined || outros.length > 0) throw new Error(`esperava um botão só, veio ${botoes().length}`)
  return botao
}

function linhaDoMapa(id: string): Extract<Drawing, { kind: 'line' }> {
  const achada = useMapStore.getState().map.drawings.find((d) => d.id === id)
  if (achada === undefined || achada.kind !== 'line') throw new Error(`a linha ${id} sumiu`)
  return achada
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.setState({ map: MAPA, selection: [], past: [], future: [], activeTool: 'select' })
  useToastStore.setState({ toasts: [] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<EndireitarControl />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('EndireitarControl — o botão "Endireitar" do painel', () => {
  it('linha torta selecionada: um botão só, chamado "Endireitar", com a tecla Alt à vista', () => {
    selecionar([{ kind: 'drawing', id: 'torta' }])
    const botao = oBotao()
    expect(botao.type).toBe('button')
    expect(nomeAcessivel(botao)).toBe('Endireitar')
    const tecla = botao.querySelector('kbd')
    expect(tecla?.textContent).toBe('Alt')
    // A tecla é para os olhos; o leitor de tela ouve o atalho na descrição.
    expect(tecla?.getAttribute('aria-hidden')).toBe('true')
  })

  it('a frase do balão existe, é a descrição do botão e ensina o atalho e o desfazer', () => {
    selecionar([{ kind: 'drawing', id: 'torta' }])
    const idDaDica = oBotao().getAttribute('aria-describedby') ?? ''
    const dica = document.getElementById(idDaDica)
    expect(dica).not.toBeNull()
    expect(dica?.classList.contains('lb-field__hint')).toBe(true)
    expect(dica?.textContent).toBe(ENDIREITAR_DICA)
    expect(ENDIREITAR_DICA).toMatch(/tocar o Alt/)
    expect(ENDIREITAR_DICA).toMatch(/Ctrl\+Z/)
  })

  it('seleção vazia, linha já reta, parede de Sala ou só parede presa nas duas pontas: não desenha nada', () => {
    const casos: SelectionSet[] = [
      [],
      [{ kind: 'drawing', id: 'reta' }],
      [{ kind: 'wall', id: 'sala' }],
      [{ kind: 'wall', id: 'presa' }],
    ]
    for (const caso of casos) {
      selecionar(caso)
      expect(container.innerHTML, JSON.stringify(caso)).toBe('')
    }
  })

  it('o clique endireita a linha num passo de desfazer e o botão some; o Ctrl+Z traz a linha torta e o botão de volta', () => {
    selecionar([{ kind: 'drawing', id: 'torta' }])
    act(() => oBotao().click())

    const reta = linhaDoMapa('torta')
    expect(reta.x1).toBe(reta.x2)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(botoes()).toHaveLength(0)
    // Sucesso não avisa: a linha reta já está na tela.
    expect(useToastStore.getState().toasts).toHaveLength(0)

    act(() => useMapStore.getState().undo())
    expect(linhaDoMapa('torta').x1).not.toBe(linhaDoMapa('torta').x2)
    expect(nomeAcessivel(oBotao())).toBe('Endireitar')
  })

  it('linha solta e parede presa juntas: o clique endireita a linha, o aviso diz por que a parede ficou e o botão some', () => {
    selecionar([
      { kind: 'drawing', id: 'torta' },
      { kind: 'wall', id: 'presa' },
    ])
    act(() => oBotao().click())

    expect(linhaDoMapa('torta').x1).toBe(linhaDoMapa('torta').x2)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual([avisoDoEndireitar({ presas: 1, travados: 0 })])
    expect(botoes()).toHaveLength(0)
  })

  it('com a camada Anotações travada, a linha torta não oferece o botão', () => {
    act(() => useMapStore.setState({ map: { ...MAPA, lockedLayers: ['anotacoes'] }, selection: [{ kind: 'drawing', id: 'torta' }] }))
    expect(botoes()).toHaveLength(0)
  })
})
