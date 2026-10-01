import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { addDoorOnWall, addRoom, createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Region, Wall } from '../types/map'
import { PORTA_NO_ENCOSTE_TEXT, avisoDoCorredorAberto } from './labels'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * "Abrir para o corredor" no painel da Sala (pedido 4 de 30/09/2026, fatia 3).
 * A linha de ação lê a store direto (quantos corredores o clique abre e por
 * que a Sala recusaria) e chama `abrirSalaParaCorredores`: o App não passa
 * nada, o painel só diz de que Sala é (`salaId`). A conta é de CORREDORES, par
 * de linhas, não de paredes — a imagem 4 tem duas linhas e mostra "(1)". Com
 * tudo aberto a linha some: botão na tela sempre faz alguma coisa, e o segundo
 * clique não tem como gravar um passo vazio no desfazer.
 */

const GRADE = 64

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** A "Sala 3" da imagem 4: retângulo 0..600 × 0..500, paredes s0 (topo), s1, s2 (baixo), s3. */
function salaCom(linhas: Wall[]): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_painel_corredor', 'Corredor', 30, 30, GRADE), region, walls)
  return { ...comSala, walls: [...comSala.walls, ...linhas] }
}

function comRegiao(map: MapData, mudanca: Partial<Region>): MapData {
  return { ...map, regions: map.regions.map((r) => (r.id === 'sala' ? { ...r, ...mudanca } : r)) }
}

function pontas(map: MapData, id: string): number[] | undefined {
  const w = map.walls.find((p) => p.id === id)
  return w === undefined ? undefined : [w.x1, w.y1, w.x2, w.y2].map((v) => Math.round(v))
}

// Imagem 4: A entra pela borda de cima, B pela lateral esquerda — um corredor só.
const A = parede('A', -200, -200, 150, 50)
const B = parede('B', -300, -100, 50, 180)
// Corredor de 2 células chegando reto na base e entrando 40 px no chão; o mesmo pelo topo.
const C1 = parede('C1', 256, 800, 256, 460)
const C2 = parede('C2', 384, 800, 384, 460)
const T1 = parede('T1', 256, -300, 256, 40)
const T2 = parede('T2', 384, -300, 384, 40)
// Duas divisórias soltas batendo na Sala em lados opostos: não são corredor.
const D1 = parede('D1', 200, 0, 200, -300)
const D2 = parede('D2', 200, 500, 200, 800)

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

function carregar(map: MapData): void {
  useMapStore.setState({ map, past: [], future: [], pisoAtivo: 0 })
  useToastStore.setState({ toasts: [] })
}

/** O painel da Sala como o PropertiesPanel o monta: com o id dela e o "Criar sala dentro". */
function render(overrides: Partial<RoomControlsProps> = {}): void {
  const props: RoomControlsProps = {
    name: 'Sala 3',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 600,
    height: 500,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    salaId: 'sala',
    onCreateRoomInside: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
}

function linhaAbrir(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Abrir para'))
}

function linhaObrigatoria(): HTMLButtonElement {
  const linha = linhaAbrir()
  if (linha === undefined) throw new Error('o painel da Sala não tem a linha "Abrir para o corredor"')
  return linha
}

/** A frase ligada à linha por aria-describedby, ou `null` se não há. */
function motivoDa(linha: HTMLButtonElement): string | null {
  const id = linha.getAttribute('aria-describedby')
  return id === null ? null : (document.getElementById(id)?.textContent ?? null)
}

function avisos(): string[] {
  return useToastStore.getState().toasts.map((t) => t.text)
}

describe('RoomControls: "Abrir para o corredor"', () => {
  it('imagem 4: duas linhas são UM corredor — a linha diz "(1)" e fecha a lista, depois de "Criar sala dentro"', () => {
    carregar(salaCom([A, B]))
    render()
    const linha = linhaObrigatoria()
    expect(linha.textContent).toBe('Abrir para o corredor (1)')
    expect(linha.disabled).toBe(false)
    expect(linha.getAttribute('aria-describedby')).toBeNull()
    // Última: quando some (o clique abriu tudo) ou aparece (o mestre desenhou o
    // corredor), nenhuma outra linha desliza para debaixo do ponteiro.
    const acoes = [...container.querySelectorAll('.lb-room-extras button')].map((b) => b.textContent)
    expect(acoes.slice(-2)).toEqual(['Criar sala dentro', 'Abrir para o corredor (1)'])
  })

  it('dois corredores: a conta concorda com o número', () => {
    carregar(salaCom([C1, C2, T1, T2]))
    render()
    expect(linhaObrigatoria().textContent).toBe('Abrir para os corredores (2)')
  })

  it('o clique abre num passo só do desfazer e avisa; aberto tudo, a linha some; o Ctrl+Z a traz de volta', () => {
    carregar(salaCom([A, B]))
    const antes = useMapStore.getState().map
    render()
    act(() => linhaObrigatoria().click())

    const depois = useMapStore.getState().map
    expect(depois).not.toBe(antes)
    expect(useMapStore.getState().past).toEqual([antes])
    expect(pontas(depois, 'A')).toEqual([-200, -200, 80, 0])
    expect(pontas(depois, 'B')).toEqual([-300, -100, 0, 140])
    expect(avisos()).toEqual([avisoDoCorredorAberto('Sala 3', 1)])
    expect(linhaAbrir()).toBeUndefined()

    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map).toBe(antes)
    expect(linhaObrigatoria().textContent).toBe('Abrir para o corredor (1)')
  })

  it('sem corredor encostando a linha não existe: Sala vazia, ou duas divisórias soltas em lados opostos', () => {
    carregar(salaCom([]))
    render()
    expect(linhaAbrir()).toBeUndefined()

    carregar(salaCom([D1, D2]))
    render()
    expect(linhaAbrir()).toBeUndefined()
  })

  it('a linha acompanha o mapa: o corredor desenhado com o painel aberto faz a linha aparecer', () => {
    carregar(salaCom([]))
    render()
    expect(linhaAbrir()).toBeUndefined()
    act(() => useMapStore.setState({ map: salaCom([A, B]) }))
    expect(linhaObrigatoria().textContent).toBe('Abrir para o corredor (1)')
  })

  it('sem o id da Sala (quem monta o painel sem ela), não há linha — mesmo com corredor no mapa', () => {
    carregar(salaCom([A, B]))
    render({ salaId: undefined })
    expect(linhaAbrir()).toBeUndefined()
  })

  it('Sala travada, ela ou a camada Salas: a linha fica, desabilitada, com o motivo escrito e ligado a ela', () => {
    const salaTravada = comRegiao(salaCom([A, B]), { locked: true })
    const camadaTravada: MapData = { ...salaCom([A, B]), lockedLayers: ['salas'] }
    // `locked` do painel é o Travado da própria Sala; a camada travada não o liga.
    const casos: [MapData, boolean][] = [
      [salaTravada, true],
      [camadaTravada, false],
    ]
    for (const [travada, locked] of casos) {
      carregar(travada)
      render({ locked })
      const linha = linhaObrigatoria()
      expect(linha.textContent).toBe('Abrir para o corredor (1)')
      expect(linha.disabled).toBe(true)
      expect(motivoDa(linha)).toBe('Sala travada, ela ou a camada Salas: destrave para abrir o vão.')
      act(() => linha.click())
      expect(useMapStore.getState().map).toBe(travada)
      expect(useMapStore.getState().past).toHaveLength(0)
    }
  })

  it('Sala secreta: a linha fica, desabilitada, e diz por que (o vão entregaria o esconderijo)', () => {
    const secreta = comRegiao(salaCom([A, B]), { secret: true })
    carregar(secreta)
    render()
    const linha = linhaObrigatoria()
    expect(linha.disabled).toBe(true)
    expect(motivoDa(linha)).toBe('Sala secreta, ou dentro de sala secreta ou oculta: o vão mostraria o esconderijo aos jogadores. Revele a sala para abrir.')
    act(() => linha.click())
    expect(useMapStore.getState().map).toBe(secreta)
  })

  it('porta onde o corredor encosta: a linha fica habilitada, e o clique recusa com o aviso, sem passo no desfazer', () => {
    const comPorta = addDoorOnWall(salaCom([C1, C2]), 's2', { x: 320, y: 500 }, GRADE, 'normal')
    carregar(comPorta)
    render()
    const linha = linhaObrigatoria()
    expect(linha.disabled).toBe(false)
    act(() => linha.click())
    expect(useMapStore.getState().map).toBe(comPorta)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(avisos()).toEqual([PORTA_NO_ENCOSTE_TEXT])
    expect(linhaObrigatoria().textContent).toBe('Abrir para o corredor (1)')
  })
})
