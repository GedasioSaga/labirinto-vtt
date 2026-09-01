import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import type { Drawing, Light, Prop, Region, Stair, Token, Wall } from '../types/map'

/**
 * FRENTE F (onda 1, plano de refinamento — itens 3 e 4) — REDE DE SEGURANÇA
 * DO UNDO.
 *
 * Problema medido (docs/PLANO-REFINAMENTO.md item 3): 40 `pointermove` de um
 * único arrasto produzem hoje 40 entradas em `past`, porque `moveToken`,
 * `moveProp`, `moveWall`, `moveRegion`, `moveStair` e `moveDrawing` chamam
 * `withHistory` (mapStore.ts) a cada chamada — não existe variante "live"
 * pra eles, ao contrário de `moveCurve`/`moveCurveLive` ou
 * `resizeRoomDimensions`/`resizeRoomCornerLive`, que já seguem o padrão
 * correto (mapStore.ts:328-351, :651-653). O mesmo defeito atinge os 3
 * sliders de propriedade citados no item 4: intensidade de luz
 * (`updateLight`), opacidade de preenchimento (`setDrawingFillAlpha`) e
 * espessura de contorno de região (`setRegionStrokeWidthForRegion`) — cada
 * um É `withHistory`, sem par "*Live" pro `onChange` de um `<input type=
 * "range">`, que dispara a cada pixel arrastado.
 *
 * Esta suíte é TESTE DE CONTRATO, não de implementação: as 9 actions abaixo
 * (`moveTokenLive`, `movePropLive`, `moveWallLive`, `moveRegionLive`,
 * `moveStairLive`, `moveDrawingLive`, `updateLightIntensityLive`,
 * `setDrawingFillAlphaLive`, `setRegionStrokeWidthForRegionLive`) AINDA NÃO
 * EXISTEM em `stores/mapStore.ts` — são exatamente o trecho que o CONTRATO
 * do relatório desta frente pede pro integrador colar lá. `mapStore.ts` é
 * arquivo de risco, fora do escopo de arquivos desta frente (só o
 * integrador da onda o edita), então não há "origem" alcançável aqui para
 * resolver a tipagem de outra forma — daí o cast em `liveContract()`
 * abaixo, comentado ali. Toda chamada às actions do contrato joga
 * `TypeError: ... is not a function` em runtime até o integrador
 * implementá-las: é o vermelho que esta suíte existe para mostrar. Nenhum
 * teste usa `skip` — todos rodam e falham de propósito.
 */

/**
 * As 9 actions que o integrador precisa adicionar a `MapStoreState`
 * (mapStore.ts), pareadas com o `commitDragHistory` que já existe. Mesma
 * assinatura da action com histórico que cada uma substitui no pointermove
 * (`moveToken`/`moveProp`/`moveWall`/`moveRegion`/`moveStair`/`moveDrawing`/
 * `updateLight`(patch restrito a `intensity`)/`setDrawingFillAlpha`/
 * `setRegionStrokeWidthForRegion`), só que aplicando com `set()` puro (sem
 * `withHistory`) — ver o trecho pronto para colar no relatório desta frente.
 */
interface DragHistoryLiveContract {
  moveTokenLive: (id: string, targetX: number, targetY: number) => void
  movePropLive: (id: string, x: number, y: number) => void
  moveWallLive: (wallId: string, dx: number, dy: number) => void
  moveRegionLive: (regionId: string, dx: number, dy: number) => void
  moveStairLive: (id: string, dx: number, dy: number) => void
  moveDrawingLive: (drawingId: string, dx: number, dy: number) => void
  updateLightIntensityLive: (id: string, intensity: number) => void
  setDrawingFillAlphaLive: (id: string, fillAlpha: number) => void
  setRegionStrokeWidthForRegionLive: (id: string, strokeWidth: number) => void
}

type StoreState = ReturnType<typeof useMapStore.getState>

/**
 * `as unknown as` justificado: `DragHistoryLiveContract` descreve actions
 * que ainda não existem no tipo real de `useMapStore.getState()` — não há
 * cast mais estreito possível para "método que a store de hoje não tem".
 * Isto não silencia um erro que esta frente poderia corrigir na origem
 * (regra 2 normalmente pede isso): a origem é `mapStore.ts`, proibido a
 * todas as frentes desta onda por regra do próprio plano. O cast documenta
 * o contrato esperado; quem prova que ele foi cumprido é o teste FALHANDO
 * em runtime (TypeError) enquanto a action não existir, e passando quando
 * existir — não o compilador.
 */
function liveContract(): StoreState & DragHistoryLiveContract {
  return useMapStore.getState() as unknown as StoreState & DragHistoryLiveContract
}

/** Número de pointermove medido no diagnóstico do plano (item 3) — usado
 *  como N do "arrasto simulado" em todo teste desta suíte. */
const POINTERMOVES_PER_DRAG = 40

const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }
const prop: Prop = { id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }
const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 10, y2: 0, blocksLight: true, blocksMove: true, door: null }
const region: Region = {
  id: 'r1',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  tag: '',
  fillColor: '#3a7ad0',
  fillPattern: 'solid',
  data: {},
}
const stair: Stair = { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 0, y2: 64 }], stepWidth: 32 }
const lineDrawing: Drawing = { id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 }
const light: Light = { id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }
const rectDrawing: Drawing = { id: 'd2', kind: 'rect', x: 0, y: 0, w: 100, h: 100, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
const regionWithStroke: Region = { ...region, id: 'r2', strokeWidth: 2 }

beforeEach(() => {
  useMapStore.setState({
    map: {
      ...useMapStore.getState().map,
      tokens: [], props: [], walls: [], regions: [], stairs: [], drawings: [], lights: [],
    },
    selection: [],
    past: [],
    future: [],
  })
})

describe('Frente F — rede de segurança do undo (onda 1, item 3: mover corpo)', () => {
  it('moveTokenLive: 40 chamadas + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à posição de antes do arrasto', () => {
    useMapStore.getState().addToken(token)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.moveTokenLive('t1', i, i)
    }
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 't1')).toMatchObject({ x: POINTERMOVES_PER_DRAG, y: POINTERMOVES_PER_DRAG })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore) // nada empurrado ainda

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 't1')).toEqual(token)
  })

  it('movePropLive: 40 chamadas + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à posição de antes do arrasto', () => {
    useMapStore.getState().addProp(prop)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.movePropLive('p1', i, i)
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.props.find((p) => p.id === 'p1')).toEqual(prop)
  })

  it('moveWallLive: 40 chamadas + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à posição de antes do arrasto', () => {
    useMapStore.getState().addWall(wall)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.moveWallLive('w1', 1, 0) // 40 micro-passos de dx=1 == dx total 40
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.walls.find((w) => w.id === 'w1')).toEqual(wall)
  })

  it('moveRegionLive: 40 chamadas + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à posição de antes do arrasto', () => {
    useMapStore.getState().addRegion(region)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.moveRegionLive('r1', 1, 0)
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.regions.find((r) => r.id === 'r1')).toEqual(region)
  })

  it('moveStairLive: 40 chamadas + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à posição de antes do arrasto', () => {
    useMapStore.getState().addStair(stair)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.moveStairLive('s1', 1, 0)
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.stairs.find((s) => s.id === 's1')).toEqual(stair)
  })

  it('moveDrawingLive: 40 chamadas + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à posição de antes do arrasto', () => {
    useMapStore.getState().addDrawing(lineDrawing)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.moveDrawingLive('d1', 1, 0)
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.drawings.find((d) => d.id === 'd1')).toEqual(lineDrawing)
  })
})

describe('Frente F — rede de segurança do undo (onda 1, item 4: sliders de propriedade)', () => {
  it('updateLightIntensityLive: 40 chamadas (arrasto do slider) + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à intensidade de antes', () => {
    useMapStore.getState().addLight(light)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.updateLightIntensityLive('l1', i / POINTERMOVES_PER_DRAG) // varre 0.025 → 1
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.lights.find((l) => l.id === 'l1')).toEqual(light)
  })

  it('setDrawingFillAlphaLive: 40 chamadas (arrasto do slider) + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à opacidade de antes', () => {
    useMapStore.getState().addDrawing(rectDrawing)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.setDrawingFillAlphaLive('d2', i / POINTERMOVES_PER_DRAG)
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.drawings.find((d) => d.id === 'd2')).toEqual(rectDrawing)
  })

  it('setRegionStrokeWidthForRegionLive: 40 chamadas (arrasto do slider) + commitDragHistory = exatamente 1 entrada de undo, e 1 Ctrl+Z volta à espessura de antes', () => {
    useMapStore.getState().addRegion(regionWithStroke)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length
    const store = liveContract()

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      store.setRegionStrokeWidthForRegionLive('r2', i) // varre 1..40 px
    }
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.regions.find((r) => r.id === 'r2')).toEqual(regionWithStroke)
  })
})

describe('Frente F — caracterização do bug ATUAL (evidência do diagnóstico, sem o contrato novo)', () => {
  it('HOJE: moveToken chamado 40× (simulando um arrasto) produz 40 entradas de undo, não 1 — é o defeito que o item 3 do plano corrige', () => {
    useMapStore.getState().addToken(token)
    const pastLengthBefore = useMapStore.getState().past.length

    for (let i = 1; i <= POINTERMOVES_PER_DRAG; i++) {
      useMapStore.getState().moveToken('t1', i, i)
    }

    // Comportamento ATUAL (o bug medido): cada chamada é `withHistory`, então
    // 40 pointermove viram 40 entradas — não 1. Este teste passa HOJE porque
    // descreve o defeito; ele não é a meta da onda (as 9 `it`s acima são).
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + POINTERMOVES_PER_DRAG)

    // E por isso um único Ctrl+Z "não anda": desfaz só o último micro-passo.
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 't1')).toMatchObject({ x: POINTERMOVES_PER_DRAG - 1, y: POINTERMOVES_PER_DRAG - 1 })
  })
})
