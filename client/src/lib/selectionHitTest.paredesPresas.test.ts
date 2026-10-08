import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Wall } from '../types/map'
import { selectEntitiesInArea } from './areaSelection'
import { resolveHoverHit } from './hoverHitTest'
import { createEmptyMap } from './mapFactory'
import { sincronizarParedesDosDesenhos } from './paredesPresas'
import { findErasableAt, findSelectableAt } from './selectionHitTest'

/**
 * PAREDES AO REDOR: a parede presa faz parte do desenho. Clicar nela pega o
 * DESENHO dono (é nele que se mexe nas paredes todas de uma vez); ela nunca é
 * selecionada sozinha — nem pelo clique, nem pela borracha de objeto, nem
 * pela seleção por área, nem pelo cursor de hover que promete o clique.
 */

/** Pintura de balde (área cheia, sem traço): a parede é a própria borda. */
const pintura: Drawing = {
  id: 'balde',
  kind: 'polygon',
  points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }],
  color: '#884400',
  width: 0,
  filled: true,
  fillAlpha: 1,
  paredes: { ativo: true, invisivel: false, passagem: 'bloqueia' },
}

const comum: Wall = { id: 'w-comum', x1: 400, y1: 100, x2: 400, y2: 300, blocksLight: true, blocksMove: true, door: null }

function mapa(extra: Partial<MapData> = {}): MapData {
  const base = createEmptyMap('m', 'M', 20, 12, 64)
  return sincronizarParedesDosDesenhos(base, { ...base, drawings: [pintura], walls: [comum], ...extra })
}

/** Em cima da borda de cima, fora da tinta: só a parede presa está ali. */
const naBorda = { x: 200, y: 97 }

describe('parede presa → desenho dono', () => {
  it('o mapa de teste tem as presas do balde', () => {
    expect(mapa().walls.filter((w) => w.desenhoId === 'balde')).toHaveLength(4)
  })

  it('clicar na presa seleciona o desenho, nunca a parede', () => {
    expect(findSelectableAt(mapa(), naBorda)).toEqual({ kind: 'drawing', id: 'balde', draggable: true })
  })

  it('a parede comum continua sendo parede', () => {
    expect(findSelectableAt(mapa(), { x: 400, y: 200 })).toMatchObject({ kind: 'wall', id: 'w-comum' })
  })

  it('desenho em camada oculta: a presa dele também não responde ao clique', () => {
    expect(findSelectableAt(mapa({ hiddenLayers: ['anotacoes'] }), naBorda)).toBeNull()
  })

  it('a borracha de objeto na presa pega o desenho', () => {
    expect(findErasableAt(mapa(), naBorda)).toMatchObject({ kind: 'drawing', id: 'balde' })
  })

  it('a seleção por área não pega presa sozinha (o desenho entra pela própria forma)', () => {
    const area = selectEntitiesInArea(mapa(), { x1: 50, y1: 50, x2: 350, y2: 350 })
    expect(area.walls).toEqual([])
    expect(area.drawings).toEqual(['balde'])
  })

  it('o hover sobre a presa promete o desenho', () => {
    const hit = resolveHoverHit({ map: mapa(), selection: null, areaSelection: null, activeTool: 'select', worldPoint: naBorda })
    expect(hit.target).toEqual({ kind: 'drawing', id: 'balde' })
  })
})
