import { beforeEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { MapData, Prop } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { createEmptyMap } from '../lib/mapFactory'
import { criarMovel } from '../lib/mobilia'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { alcaDaCurvaDaCerca } from '../lib/cercaCurva'
import { createCercaCurvaGesture } from './cercaCurvaGesture'
import { drawEditHandles } from './drawEditHandles'
import { CORNER_HANDLE_KEYLINE_COLOR, SELECTION_COLOR } from './constants'

/**
 * O gesto da alça de curvar a cerca, como a mão o faz: pega a bolinha do meio
 * do fio, puxa para o lado e solta. Sem Pixi — o PixiCanvas só repassa os
 * eventos (mesmo molde de `stairHandleGesture.ts`).
 */

const GRADE = 40

function mapaComCerca(extra: Partial<Prop> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, GRADE), props: [{ ...criarMovel('cerca', { x: 200, y: 200 }, GRADE, 'c'), ...extra }] }
}

const cerca = (): Prop => {
  const prop = useMapStore.getState().map.props.find((p) => p.id === 'c')
  if (!prop) throw new Error('a cerca sumiu')
  return prop
}

describe('alça de curvar a cerca — o gesto', () => {
  let antes: MapData

  beforeEach(() => {
    antes = mapaComCerca()
    useMapStore.setState({ map: antes, selection: EMPTY_SELECTION, past: [], future: [] })
  })

  it('pegar fora da alça não começa nada', () => {
    const gesto = createCercaCurvaGesture()
    expect(gesto.begin('c', { x: 230, y: 200 }, 1)).toBe(false)
    expect(gesto.isActive()).toBe(false)
  })

  it('o arrasto inteiro vira UM Ctrl+Z, e o desfazer devolve a cerca reta', () => {
    const gesto = createCercaCurvaGesture()
    expect(gesto.begin('c', { x: 200, y: 200 }, 1)).toBe(true)
    for (const y of [205, 215, 230]) gesto.move({ x: 200, y }, false)
    expect(cerca().mobiliaCurva).toBeGreaterThan(0)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(gesto.finish()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(cerca()).not.toHaveProperty('mobiliaCurva')
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('o retorno do arrasto diz a cerca de agora, para o rótulo em graus', () => {
    const gesto = createCercaCurvaGesture()
    gesto.begin('c', { x: 200, y: 200 }, 1)
    const retorno = gesto.move({ x: 200, y: 900 }, true)
    expect(retorno?.mobiliaCurva).toBe(180)
  })

  it('sem a grade, voltar a poucos px de TELA da corda endireita — no zoom de longe, mais px de mundo', () => {
    useMapStore.setState({ map: mapaComCerca({ mobiliaCurva: 90 }) })
    const alca = alcaDaCurvaDaCerca(cerca())
    if (alca === null) throw new Error('cerca sem alça')
    // Zoom 0,5: o encaixe de 4 px de tela vale 8 px de mundo — 3 px de mundo da corda endireitam.
    const gesto = createCercaCurvaGesture()
    expect(gesto.begin('c', alca, 0.5)).toBe(true)
    gesto.move({ x: 200, y: 203 }, false)
    expect(cerca()).not.toHaveProperty('mobiliaCurva')
    // Zoom 4: os mesmos 3 px de mundo ficam longe da corda na tela, e a cerca curva.
    gesto.cancel()
    const dePerto = createCercaCurvaGesture()
    const alcaDePerto = alcaDaCurvaDaCerca(cerca())
    if (alcaDePerto === null) throw new Error('cerca sem alça')
    expect(dePerto.begin('c', alcaDePerto, 4)).toBe(true)
    dePerto.move({ x: 200, y: 203 }, false)
    expect(cerca().mobiliaCurva).toBeGreaterThan(0)
  })

  it('Esc no meio devolve a cerca como estava e não grava passo', () => {
    const gesto = createCercaCurvaGesture()
    gesto.begin('c', { x: 200, y: 200 }, 1)
    gesto.move({ x: 200, y: 230 }, false)
    expect(gesto.cancel()).toBe(true)
    expect(cerca()).not.toHaveProperty('mobiliaCurva')
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('clique sem mexer não vira passo', () => {
    const gesto = createCercaCurvaGesture()
    gesto.begin('c', { x: 200, y: 200 }, 1)
    gesto.finish()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('cerca travada, ou objeto que não é cerca, não tem alça de curva', () => {
    useMapStore.setState({ map: mapaComCerca({ locked: true }) })
    expect(createCercaCurvaGesture().begin('c', { x: 200, y: 200 }, 1)).toBe(false)
    useMapStore.setState({ map: mapaComCerca({ mobilia: 'mesa' }) })
    expect(createCercaCurvaGesture().begin('c', { x: 200, y: 200 }, 1)).toBe(false)
  })
})

describe('drawEditHandles — cerca selecionada', () => {
  const SELECAO = { kind: 'prop' as const, id: 'c' }
  const conta = (g: Graphics, action: 'fill' | 'stroke') => g.context.instructions.filter((i) => i.action === action).length

  /** Centro do fundo escuro da bolinha vazada (o `circle` pintado de CORNER_HANDLE_KEYLINE_COLOR). */
  function centrosDasVazadas(g: Graphics): { x: number; y: number }[] {
    return g.context.instructions.flatMap((i) => {
      if (i.action !== 'fill' || i.data.style.color !== CORNER_HANDLE_KEYLINE_COLOR) return []
      return i.data.path.instructions.flatMap((passo) => {
        if (passo.action !== 'circle') return []
        const [x, y]: unknown[] = passo.data
        return typeof x === 'number' && typeof y === 'number' ? [{ x, y }] : []
      })
    })
  }

  it('a cerca ganha a bolinha vazada de curvar no meio do arco, além dos 4 cantos', () => {
    const map = mapaComCerca({ mobiliaCurva: 90 })
    const g = new Graphics()
    drawEditHandles(g, map, SELECAO, 'select', { cameraScale: 1 })
    // 4 chips (faixa escura + amarelo cada) + o fundo escuro da vazada; o aro amarelo é o único traço.
    expect(conta(g, 'fill')).toBe(4 * 2 + 1)
    expect(conta(g, 'stroke')).toBe(1)
    const stroke = g.context.instructions.find((i) => i.action === 'stroke')
    expect(stroke?.action === 'stroke' ? stroke.data.style.color : null).toBe(SELECTION_COLOR)
    const [centro] = centrosDasVazadas(g)
    const alca = alcaDaCurvaDaCerca(map.props[0])
    expect(centro?.x).toBeCloseTo(alca?.x ?? Number.NaN, 9)
    expect(centro?.y).toBeCloseTo(alca?.y ?? Number.NaN, 9)
  })

  it('móvel que não é cerca e cerca travada não ganham a alça de curvar', () => {
    for (const extra of [{ mobilia: 'mesa' as const }, { locked: true }]) {
      const g = new Graphics()
      drawEditHandles(g, mapaComCerca(extra), SELECAO, 'select', { cameraScale: 1 })
      expect(centrosDasVazadas(g), JSON.stringify(extra)).toEqual([])
    }
  })
})
