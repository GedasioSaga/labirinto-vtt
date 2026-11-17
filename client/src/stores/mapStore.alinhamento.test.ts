import { describe, expect, it } from 'vitest'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft, buildWallFromDraft } from '../lib/drawingFactory'
import { isAxisAlignedRect } from '../lib/roomOps'
import { roomRotationOf } from '../lib/roomRotation'
import type { MapData, Region } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * ALINHAMENTO DAS PAREDES (pedido de 17/11/2026), o lado da store: o arrasto de
 * ponta que vira UM Ctrl+Z, o Endireitar da sala e a grade lembrada por mapa.
 */

const vazio = (): MapData => mapFactory.createEmptyMap('m_alinhamento', 'Alinhamento', 30, 20, 64)

/** Sala retangular na grade, com as quatro paredes presas (w0…w3). */
function comSala(): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 576, y: 256 }, { x: 704, y: 640 })
  return mapFactory.addRoom(vazio(), region, walls)
}

/** A mesma sala como polígono, com o canto de baixo à direita 12 px para fora: o lado direito fica 1,8° torto. */
function comSalaEmPoligonoTorta(): MapData {
  const base = comSala()
  const emPoligono: MapData = {
    ...base,
    regions: base.regions.map((r) => (r.room === undefined ? r : { ...r, room: { ...r.room, shape: 'polygon' } })),
  }
  const canto = sala(emPoligono).points.findIndex((p) => p.x === 704 && p.y === 640)
  return mapFactory.updateRegionPoint(emPoligono, 'sala', canto, 716, 640)
}

function sala(map: MapData): Region {
  const regiao = map.regions.find((r) => r.id === 'sala')
  if (regiao === undefined) throw new Error('a sala sumiu')
  return regiao
}

const LIGADOS = { token: true, wall: true, prop: true }

function abrir(map: MapData): void {
  useMapStore.setState({ map, selection: [], past: [], future: [], snapTargets: LIGADOS })
}

describe('arrasto de ponta de parede e de vértice de sala: um Ctrl+Z por gesto', () => {
  it('o defeito de antes: updateWallPoint grava um passo por movimento; o par Live + commitDragHistory grava um só', () => {
    const antes: MapData = { ...vazio(), walls: [buildWallFromDraft('p', { x: 0, y: 0 }, { x: 200, y: 10 })] }
    abrir(antes)
    for (const x of [210, 220, 230]) useMapStore.getState().updateWallPoint('p', 1, x, 10)
    expect(useMapStore.getState().past).toHaveLength(3)

    abrir(antes)
    for (const x of [210, 220, 230]) useMapStore.getState().updateWallPointLive('p', 1, x, 10)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useMapStore.getState().map.walls[0]).toMatchObject({ x2: 230, y2: 10 })
    useMapStore.getState().commitDragHistory(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('vértice de sala: os passos Live levam as paredes presas junto e fecham num Ctrl+Z; a mão parada não muda nada', () => {
    const antes = comSalaEmPoligonoTorta()
    abrir(antes)
    const canto = sala(antes).points.findIndex((p) => p.x === 716 && p.y === 640)
    for (const x of [712, 708, 704]) useMapStore.getState().updateRegionPointLive('sala', canto, x, 640)
    const parado = useMapStore.getState().map
    useMapStore.getState().updateRegionPointLive('sala', canto, 704, 640)
    expect(useMapStore.getState().map).toBe(parado)
    expect(useMapStore.getState().past).toHaveLength(0)
    // As paredes presas seguiram o canto: nenhuma ficou com a ponta antiga.
    expect(parado.walls.some((w) => w.x1 === 716 || w.x2 === 716)).toBe(false)
    useMapStore.getState().commitDragHistory(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })
})

describe('Endireitar a sala', () => {
  it('sala retangular girada 3°: volta à reta, na grade, e um Ctrl+Z devolve a torta', () => {
    const torta = mapFactory.rotateRegion(comSala(), 'sala', 3)
    expect(isAxisAlignedRect(sala(torta).points)).toBe(false)
    abrir(torta)
    useMapStore.setState({ selection: [{ kind: 'region', id: 'sala' }] })
    const resultado = useMapStore.getState().endireitarSelecionados()
    const depois = sala(useMapStore.getState().map)
    expect(resultado.alterados).toBe(1)
    expect(isAxisAlignedRect(depois.points)).toBe(true)
    expect(depois.room === undefined ? null : roomRotationOf(depois.room)).toBe(0)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(torta)
  })

  it('polígono com um lado torto, pela PAREDE da sala: o canto volta para a grade e as paredes presas acompanham', () => {
    const torta = comSalaEmPoligonoTorta()
    abrir(torta)
    const paredeTorta = torta.walls.find((w) => w.x1 !== w.x2 && w.y1 !== w.y2)
    if (paredeTorta === undefined) throw new Error('a sala de teste não tem parede torta')
    useMapStore.setState({ selection: [{ kind: 'wall', id: paredeTorta.id }] })
    expect(useMapStore.getState().endireitarSelecionados().alterados).toBe(1)
    const { map, past } = useMapStore.getState()
    expect(sala(map).points).toContainEqual({ x: 704, y: 640 })
    expect(map.walls.filter((w) => w.x1 !== w.x2 && w.y1 !== w.y2)).toHaveLength(0)
    expect(past).toHaveLength(1)
  })
})

describe('grade lembrada por mapa', () => {
  it('a escolha vai para o mapa sem passo de desfazer, e abrir o mapa de novo a devolve', () => {
    abrir(vazio())
    useMapStore.getState().setSnapTarget('wall', false)
    const salvo = useMapStore.getState().map
    expect(salvo.encaixeNaGrade).toEqual({ token: true, wall: false, prop: true })
    expect(useMapStore.getState().past).toHaveLength(0)

    // Outro mapa, sem escolha gravada, com tudo ligado; depois o primeiro de novo.
    useMapStore.getState().loadMap({ ...vazio(), id: 'outro' })
    useMapStore.setState({ snapTargets: LIGADOS })
    useMapStore.getState().loadMap(salvo)
    expect(useMapStore.getState().snapTargets).toEqual({ token: true, wall: false, prop: true })
  })

  it('mapa antigo abre com os interruptores como estavam, e desfazer uma edição não troca a escolha', () => {
    abrir({ ...vazio(), id: 'outro' })
    const antigo = vazio()
    useMapStore.getState().loadMap(antigo)
    expect(useMapStore.getState().snapTargets).toEqual(LIGADOS)
    expect(useMapStore.getState().map).toBe(antigo)

    useMapStore.getState().addWall(buildWallFromDraft('p', { x: 0, y: 0 }, { x: 128, y: 0 }))
    useMapStore.getState().setSnapTarget('prop', false)
    useMapStore.getState().undo()
    const { map, snapTargets } = useMapStore.getState()
    expect(map.walls).toHaveLength(0)
    expect(map.encaixeNaGrade).toEqual({ token: true, wall: true, prop: false })
    expect(snapTargets.prop).toBe(false)
  })
})
