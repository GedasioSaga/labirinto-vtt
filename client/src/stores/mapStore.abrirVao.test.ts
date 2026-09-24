import { beforeEach, describe, expect, it } from 'vitest'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import type { MapData, Wall } from '../types/map'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'
import { SALA_SECRETA_SEGURA_O_VAO_TEXT } from '../components/labels'

/**
 * As ações do menu da parede (WallGestureMenu, clique direito no mapa):
 * "Abrir vão aqui" e "Desabar parede" valem dos dois lados e desfazem num
 * Ctrl+Z só — o mestre não precisa desfazer um lado de cada vez.
 */
const GRADE = 64

function doisPredios(): MapData {
  const armazem = buildRoomFromDraft('armazem', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 0 }, { x: 512, y: 320 })
  const oficina = buildRoomFromDraft('oficina', ['o0', 'o1', 'o2', 'o3'], { x: 512, y: 0 }, { x: 1024, y: 320 })
  const base = createEmptyMap('m_store_vao', 'Dois prédios', 40, 20, GRADE)
  return addRoom(addRoom(base, armazem.region, armazem.walls), oficina.region, oficina.walls)
}

function divisa(map: MapData): Wall[] {
  return map.walls.filter((w) => Math.abs(w.x1 - 512) < 0.01 && Math.abs(w.x2 - 512) < 0.01)
}

describe('mapStore: abrirVaoAqui e desabarParede', () => {
  beforeEach(() => {
    useMapStore.setState({ map: doisPredios(), selection: [], past: [], future: [] })
  })

  it('abrirVaoAqui abre o vão de uma célula nas duas paredes da divisa', () => {
    useMapStore.getState().abrirVaoAqui('a1', { x: 512, y: 160 })
    const pedacos = divisa(useMapStore.getState().map)
    expect(pedacos).toHaveLength(4)
    // Nenhum pedaço cobre o meio do vão (y=160), dos dois lados.
    expect(pedacos.some((w) => Math.min(w.y1, w.y2) < 160 && Math.max(w.y1, w.y2) > 160)).toBe(false)
    // Uma célula de largura: de 128 a 192.
    const bordas = pedacos.flatMap((w) => [w.y1, w.y2]).map(Math.round)
    expect(bordas.filter((y) => y === 128)).toHaveLength(2)
    expect(bordas.filter((y) => y === 192)).toHaveLength(2)
  })

  it('um Ctrl+Z fecha o vão dos dois lados de uma vez', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().abrirVaoAqui('a1', { x: 512, y: 160 })
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
    expect(divisa(useMapStore.getState().map).map((w) => w.id).sort()).toEqual(['a1', 'o3'])
  })

  it('desabarParede derruba a divisa dos dois lados, e desfaz num passo', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().desabarParede('o3')
    expect(divisa(useMapStore.getState().map)).toHaveLength(0)
    expect(useMapStore.getState().map.walls).toHaveLength(6)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('divisa com sala secreta: abre só o lado de cá e o mestre é avisado do porquê', () => {
    useToastStore.setState({ toasts: [] })
    const map = useMapStore.getState().map
    useMapStore.setState({ map: { ...map, regions: map.regions.map((r) => (r.id === 'oficina' ? { ...r, secret: true } : r)) } })
    useMapStore.getState().abrirVaoAqui('a1', { x: 512, y: 160 })
    const walls = useMapStore.getState().map.walls
    expect(walls.some((w) => w.id === 'a1')).toBe(false)
    expect(walls.some((w) => w.id === 'o3')).toBe(true)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual([SALA_SECRETA_SEGURA_O_VAO_TEXT])
  })

  it('divisa comum não avisa nada', () => {
    useToastStore.setState({ toasts: [] })
    useMapStore.getState().abrirVaoAqui('a1', { x: 512, y: 160 })
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
