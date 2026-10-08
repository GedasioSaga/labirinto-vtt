import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import type { Drawing, ParedesDoDesenho } from '../types/map'
import { PropertiesPanel } from './PropertiesPanel'
import { avisoDaParedePresa, paredesAoRedorDoPainel } from './paredesAoRedorNoPainel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'

/**
 * "Paredes ao redor" no painel DE VERDADE, ligado à store de verdade: a seção
 * aparece para o desenho que aceita paredes (o pincel, sim; o caminho, não),
 * ligar cria as paredes, e escolher "Invisível" passa a passagem para "Vê mas
 * não passa" (parede invisível que barra a visão deixaria uma borda de
 * escuridão sem parede à vista). Parede presa selecionada mostra o aviso no
 * lugar dos controles de parede.
 */

const nada = (): void => {}

const pincel: Drawing = {
  id: 'pincel',
  kind: 'freehand',
  points: [{ x: 100, y: 100 }, { x: 200, y: 140 }, { x: 300, y: 100 }],
  color: '#ffffff',
  width: 4,
}
const caminho: Drawing = { id: 'caminho', kind: 'path', points: [{ x: 0, y: 300 }, { x: 300, y: 300 }], color: '#8a6a45', width: 32 }

const acoes = {
  setParedesDoDesenho: (id: string, patch: Partial<ParedesDoDesenho>) => useMapStore.getState().setParedesDoDesenho(id, patch),
  soltarParedesDoDesenho: (id: string) => useMapStore.getState().soltarParedesDoDesenho(id),
  selecionarDesenho: (id: string) => useMapStore.getState().setSelection([{ kind: 'drawing', id }]),
}

/** O painel como o App o monta com Selecionar e UM desenho selecionado. */
function painelDoDesenho(id: string): PainelProps {
  const map = useMapStore.getState().map
  const desenho = map.drawings.find((d) => d.id === id) ?? null
  return propsDoPainel(null, {
    groups: relevantPropertyGroups('select', { drawingKind: desenho !== null && desenho.kind !== 'text' ? desenho.kind : null }),
    selection: { selection: { kind: 'drawing', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
    paredesAoRedor: paredesAoRedorDoPainel(map, desenho, acoes),
  })
}

function painelDaParede(id: string): PainelProps {
  const map = useMapStore.getState().map
  const parede = map.walls.find((w) => w.id === id) ?? null
  return propsDoPainel(null, {
    groups: relevantPropertyGroups('select', { wall: true, wallPresa: parede?.desenhoId !== undefined }),
    selection: { selection: { kind: 'wall', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
    selectedWall: parede,
    paredePresa: avisoDaParedePresa(map, parede, acoes),
  })
}

describe('painel de propriedades — paredes ao redor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.getState().loadMap({ ...createEmptyMap('m1', 'Casa', 30, 20, 64), drawings: [pincel, caminho] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const interruptor = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((i) => i.closest('label')?.textContent?.includes('Paredes ao redor'))
  const botao = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)

  it('o pincel selecionado mostra a seção; ligar cria as paredes presas', () => {
    act(() => root.render(<PropertiesPanel {...painelDoDesenho('pincel')} />))
    const toggle = interruptor()
    if (toggle === undefined) throw new Error('o interruptor "Paredes ao redor" não apareceu')
    act(() => toggle.click())
    expect(useMapStore.getState().map.walls.filter((w) => w.desenhoId === 'pincel').length).toBeGreaterThan(0)
  })

  it('o caminho selecionado não mostra a seção', () => {
    act(() => root.render(<PropertiesPanel {...painelDoDesenho('caminho')} />))
    expect(interruptor()).toBeUndefined()
  })

  it('escolher Invisível passa a passagem para "Vê mas não passa"', () => {
    useMapStore.getState().setParedesDoDesenho('pincel', { ativo: true, invisivel: false, passagem: 'bloqueia' })
    act(() => root.render(<PropertiesPanel {...painelDoDesenho('pincel')} />))
    const invisivel = botao('Invisível')
    if (invisivel === undefined) throw new Error('a opção Invisível não apareceu')
    act(() => invisivel.click())
    expect(useMapStore.getState().map.drawings.find((d) => d.id === 'pincel')?.paredes).toEqual({ ativo: true, invisivel: true, passagem: 'janela' })
    act(() => root.render(<PropertiesPanel {...painelDoDesenho('pincel')} />))
    expect(botao('Vê mas não passa')?.getAttribute('aria-checked')).toBe('true')
  })

  it('parede presa selecionada: o aviso no lugar dos controles de parede, e "Selecionar desenho" leva ao dono', () => {
    useMapStore.getState().setParedesDoDesenho('pincel', { ativo: true, invisivel: false, passagem: 'bloqueia' })
    const presa = useMapStore.getState().map.walls[0]
    act(() => root.render(<PropertiesPanel {...painelDaParede(presa.id)} />))
    expect(container.textContent).toContain('Esta parede é do desenho')
    expect(container.textContent).toContain('Pincel')
    expect(Array.from(container.querySelectorAll('h2')).some((h) => h.textContent === 'Parede')).toBe(false)
    const selecionar = botao('Selecionar desenho')
    if (selecionar === undefined) throw new Error('sem o botão Selecionar desenho')
    act(() => selecionar.click())
    expect(useMapStore.getState().selection).toEqual([{ kind: 'drawing', id: 'pincel' }])
  })
})
