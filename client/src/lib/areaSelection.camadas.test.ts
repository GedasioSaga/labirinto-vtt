import { describe, expect, it } from 'vitest'
import type { CamadaId, LayerId, MapData, Prop, Region, Token } from '../types/map'
import { selectEntitiesInArea, type AreaRect } from './areaSelection'
import { buildFreehandDrawing, buildRegionFromPoints, buildTextDrawing } from './drawingFactory'
import { createEmptyMap } from './mapFactory'
import { criarMovel } from './mobilia'

/**
 * SELEÇÃO EM ÁREA E Ctrl+A × CAMADAS (fase 3, fatia 5). O laço e o Ctrl+A
 * perguntam ao ponto único (`lib/camadas/consulta.ts`): item de camada
 * travada (`podeMexer` falso) ou escondida do mestre (`mestreVe` falso) não
 * entra. Desenho Texto/Caminho é Anotações, o resto é Desenhos; no mapa de
 * antes Desenhos segue Anotações.
 */
const sala: Region = buildRegionFromPoints('sala', [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 400 },
  { x: 0, y: 400 },
])
const ficha: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
const barril: Prop = criarMovel('barril', { x: 300, y: 300 }, 50, 'barril')
const rabisco = buildFreehandDrawing('risco', [{ x: 100, y: 100 }, { x: 150, y: 150 }], '#000000', 4)
const texto = buildTextDrawing('nota', { x: 120, y: 300 }, '#000000', 12)

/** O laço que pega o mapa inteiro, como o Ctrl+A do editor (`SELECT_ALL_RECT`). */
const TUDO: AreaRect = { x1: -1e9, y1: -1e9, x2: 1e9, y2: 1e9 }
/** Um laço de verdade, arrastado sobre a sala. */
const LACO: AreaRect = { x1: -10, y1: -10, x2: 410, y2: 410 }

function mapa(lockedLayers: LayerId[], extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 800, 800, 50),
    regions: [sala],
    tokens: [ficha],
    props: [barril],
    drawings: [rabisco, texto],
    lockedLayers,
    ...extra,
  }
}

describe('selectEntitiesInArea respeita o cadeado das camadas', () => {
  it.each([['Ctrl+A', TUDO], ['laço', LACO]] as const)('%s: ficha de camada travada fica de fora; a sala destravada entra', (_nome, rect) => {
    const sel = selectEntitiesInArea(mapa(['tokens']), rect)
    expect(sel.tokens).toEqual([])
    expect(sel.regions).toEqual(['sala'])
    expect(sel.props).toEqual(['barril'])
  })

  it('sem camada travada tudo entra como hoje', () => {
    const sel = selectEntitiesInArea(mapa([]), TUDO)
    expect(sel).toMatchObject({ tokens: ['ana'], regions: ['sala'], props: ['barril'], drawings: ['risco', 'nota'] })
  })

  it('mapa de antes: Anotações travada leva junto TODO desenho (Desenhos segue Anotações)', () => {
    expect(selectEntitiesInArea(mapa(['anotacoes']), TUDO).drawings).toEqual([])
  })

  it('mapa v2: Anotações travada leva só Texto/Caminho; o rabisco é Desenhos e continua entrando', () => {
    expect(selectEntitiesInArea(mapa(['anotacoes'], { versaoDasCamadas: 2 }), TUDO).drawings).toEqual(['risco'])
  })

  it('item com camada escolhida responde pela camada dele, não pela do tipo', () => {
    const emObjetos: CamadaId = 'objetos'
    const fichaEmObjetos: Token = { ...ficha, camada: emObjetos }
    expect(selectEntitiesInArea(mapa(['objetos'], { tokens: [fichaEmObjetos] }), TUDO).tokens).toEqual([])
    expect(selectEntitiesInArea(mapa(['tokens'], { tokens: [fichaEmObjetos] }), TUDO).tokens).toEqual(['ana'])
  })

  it('camada escondida do mestre não entra, nem pela camada escolhida', () => {
    const fichaEmDecoracao: Token = { ...ficha, camada: 'decoracao' }
    expect(selectEntitiesInArea(mapa([], { hiddenLayers: ['decoracao'], tokens: [fichaEmDecoracao] }), TUDO).tokens).toEqual([])
    expect(selectEntitiesInArea(mapa([], { hiddenLayers: ['tokens'] }), TUDO).tokens).toEqual([])
  })

  it('a trava POR ITEM continua valendo junto com a da camada', () => {
    expect(selectEntitiesInArea(mapa([], { props: [{ ...barril, locked: true }] }), TUDO).props).toEqual([])
  })
})
