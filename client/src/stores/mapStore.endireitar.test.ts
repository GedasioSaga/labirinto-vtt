import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { buildLineDrawing, buildWallFromDraft } from '../lib/drawingFactory'
import type { Drawing, MapData, Wall } from '../types/map'
import { avisoDoEndireitar } from '../components/labels'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * Pedido 5: um aperto de Alt é UM passo de desfazer para a seleção inteira, e
 * um Alt que não muda nada não deixa passo vazio no histórico (o Ctrl+Z
 * seguinte desfaria outra coisa sem o mestre perceber).
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return buildWallFromDraft(id, { x: x1, y: y1 }, { x: x2, y: y2 })
}

function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
  return buildLineDrawing(id, { x: x1, y: y1 }, { x: x2, y: y2 }, '#ffffff', 2)
}

function mapa(walls: Wall[], drawings: Drawing[]): MapData {
  return { ...createEmptyMap('m_store_endireitar', 'Endireitar', 30, 20, 64), walls, drawings }
}

/** Uma linha torta, uma reta, e uma parede torta presa nas duas pontas. */
const MAPA = mapa(
  [parede('presa', 0, 300, 100, 320), parede('p', 0, 300, 0, 250), parede('q', 100, 320, 100, 400)],
  [linha('torta', 300, 200, 360, 420), linha('reta', 0, 40, 200, 40)],
)

describe('mapStore: endireitarSelecionados', () => {
  beforeEach(() => {
    useMapStore.setState({ map: MAPA, selection: [], past: [], future: [] })
    useToastStore.setState({ toasts: [] })
  })

  it('endireita a linha selecionada, num passo só que um Ctrl+Z desfaz inteiro', () => {
    useMapStore.setState({ selection: [{ kind: 'drawing', id: 'torta' }] })
    const r = useMapStore.getState().endireitarSelecionados()
    const depois = useMapStore.getState().map.drawings.find((d) => d.id === 'torta')
    if (depois === undefined || depois.kind !== 'line') throw new Error('a linha sumiu')
    expect(depois.x1).toBe(depois.x2)
    expect(r).toEqual({ alterados: 1, ignorados: { presas: 0, travados: 0, sala: 0 } })
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(MAPA)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('sucesso não avisa: a linha reta já está na tela', () => {
    useMapStore.setState({ selection: [{ kind: 'drawing', id: 'torta' }] })
    useMapStore.getState().endireitarSelecionados()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('linha já reta ou seleção vazia: o histórico não cresce e o refazer pendente continua', () => {
    const refazer = mapa([], [])
    useMapStore.setState({ selection: [{ kind: 'drawing', id: 'reta' }], future: [refazer] })
    useMapStore.getState().endireitarSelecionados()
    expect(useMapStore.getState().map).toBe(MAPA)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useMapStore.getState().future).toEqual([refazer])

    useMapStore.setState({ selection: [] })
    const r = useMapStore.getState().endireitarSelecionados()
    expect(r.alterados).toBe(0)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useMapStore.getState().future).toEqual([refazer])
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('parede presa nas duas pontas: fica como estava e o mestre é avisado do porquê', () => {
    useMapStore.setState({ selection: [{ kind: 'wall', id: 'presa' }] })
    const r = useMapStore.getState().endireitarSelecionados()
    expect(r.ignorados.presas).toBe(1)
    expect(useMapStore.getState().map).toBe(MAPA)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual([avisoDoEndireitar({ presas: 1, travados: 0 })])
    expect(useToastStore.getState().toasts[0].kind).toBe('info')
  })

  it('seleção mista: endireita o que dá, num passo, e avisa do que ficou', () => {
    useMapStore.setState({ selection: [{ kind: 'drawing', id: 'torta' }, { kind: 'wall', id: 'presa' }] })
    const r = useMapStore.getState().endireitarSelecionados()
    expect(r.alterados).toBe(1)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })
})

describe('avisoDoEndireitar', () => {
  it('nada ficou de fora: sem aviso', () => {
    expect(avisoDoEndireitar({ presas: 0, travados: 0 })).toBeNull()
  })

  it('fala em singular e plural, e diz o porquê de cada caso', () => {
    expect(avisoDoEndireitar({ presas: 1, travados: 0 })).toMatch(/^1 item ficou como estava: está preso nas duas pontas/)
    expect(avisoDoEndireitar({ presas: 3, travados: 0 })).toMatch(/^3 itens ficaram como estavam: estão presos nas duas pontas/)
    expect(avisoDoEndireitar({ presas: 0, travados: 1 })).toMatch(/^1 item travado ficou como estava/)
    expect(avisoDoEndireitar({ presas: 0, travados: 2 })).toMatch(/^2 itens travados ficaram como estavam/)
  })

  it('preso e travado juntos: as duas frases, uma depois da outra', () => {
    const texto = avisoDoEndireitar({ presas: 1, travados: 1 })
    expect(texto).toContain('preso nas duas pontas')
    expect(texto).toContain('travado')
  })
})
