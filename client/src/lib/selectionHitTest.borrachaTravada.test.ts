import { describe, expect, it } from 'vitest'
import type { LayerId, MapData, Region, Token, Wall } from '../types/map'
import { buildFreehandDrawing, buildRegionFromPoints, buildTextDrawing, buildWallFromDraft } from './drawingFactory'
import { createEmptyMap } from './mapFactory'
import { camadaTravadaNaBorracha, findErasableAt } from './selectionHitTest'

/**
 * BORRACHA × CAMADA TRAVADA (fase 3, fatia 5). O item de camada travada por
 * cima de outro destravado é uma BARREIRA: a borracha não passa por ele e não
 * apaga o de baixo. Antes, `eraseAt` (PixiCanvas) tirava o travado da lista e
 * o hit-test seguia em frente até a sala embaixo — e a apagava, sem aviso.
 */
const sala: Region = buildRegionFromPoints('sala', [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 400 },
  { x: 0, y: 400 },
])
const ficha: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
const parede: Wall = buildWallFromDraft('w', { x: 100, y: 300 }, { x: 300, y: 300 })
const rabisco = buildFreehandDrawing('risco', [{ x: 150, y: 300 }, { x: 250, y: 300 }], '#000000', 4)
const NA_FICHA = { x: 200, y: 200 }
const NO_RISCO = { x: 200, y: 300 }

function mapa(lockedLayers: LayerId[], hiddenLayers: LayerId[] = [], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 800, 800, 50), regions: [sala], tokens: [ficha], walls: [parede], drawings: [rabisco], lockedLayers, hiddenLayers, ...extra }
}

describe('camadaTravadaNaBorracha', () => {
  it('ficha de camada travada por cima da sala destravada barra a borracha e diz qual camada', () => {
    expect(camadaTravadaNaBorracha(mapa(['tokens']), NA_FICHA)).toBe('tokens')
  })

  it('com a camada destravada nada barra e a borracha acha a ficha como hoje', () => {
    const livre = mapa([])
    expect(camadaTravadaNaBorracha(livre, NA_FICHA)).toBeNull()
    expect(findErasableAt(livre, NA_FICHA)?.id).toBe('ana')
  })

  it('travar a camada de BAIXO não barra o item de cima destravado', () => {
    expect(camadaTravadaNaBorracha(mapa(['salas']), NA_FICHA)).toBeNull()
  })

  it('a sala travada sozinha no ponto barra (a borracha não a apaga)', () => {
    expect(camadaTravadaNaBorracha(mapa(['salas']), { x: 50, y: 50 })).toBe('salas')
  })

  it('camada travada e OCULTA não barra: o que não se vê não segura o gesto', () => {
    expect(camadaTravadaNaBorracha(mapa(['tokens'], ['tokens']), NA_FICHA)).toBeNull()
  })

  it('segue a ordem da BORRACHA (desenho antes da parede): risco em Anotações travada no mapa antigo barra', () => {
    expect(camadaTravadaNaBorracha(mapa(['anotacoes']), NO_RISCO)).toBe('anotacoes')
    expect(camadaTravadaNaBorracha(mapa(['paredes']), NO_RISCO)).toBeNull()
  })

  it('ficha travada POR ITEM por cima de um texto de Anotações travada: o texto barra e a sala de baixo fica', () => {
    const texto = buildTextDrawing('txt', NA_FICHA, '#000000', 24)
    const fichaTravada: Token = { ...ficha, locked: true }
    const semFicha = mapa(['anotacoes'], [], { tokens: [], drawings: [texto] })
    // Sem a ficha, o texto é o que a borracha acha no ponto (e a camada dele está travada).
    expect(findErasableAt(semFicha, NA_FICHA)?.id).toBe('txt')
    // A ficha travada por item não é alvo nem barreira (`eraseAt` a tira): quem barra é o texto.
    expect(camadaTravadaNaBorracha({ ...semFicha, tokens: [fichaTravada] }, NA_FICHA)).toBe('anotacoes')
  })

  it('ficha OCULTA no editor por cima de um texto de Anotações travada: o texto barra', () => {
    const texto = buildTextDrawing('txt', NA_FICHA, '#000000', 24)
    const fichaOculta: Token = { ...ficha, hidden: true }
    expect(camadaTravadaNaBorracha(mapa(['anotacoes'], [], { tokens: [fichaOculta], drawings: [texto] }), NA_FICHA)).toBe('anotacoes')
  })

  it('de cima destravado com travado embaixo: nada barra e a borracha apaga o de cima', () => {
    const texto = buildTextDrawing('txt', NA_FICHA, '#000000', 24)
    const comTexto = mapa(['anotacoes'], [], { drawings: [texto] })
    expect(camadaTravadaNaBorracha(comTexto, NA_FICHA)).toBeNull()
    expect(findErasableAt(comTexto, NA_FICHA)?.id).toBe('ana')
  })

  it('item com camada escolhida responde pela camada dele, não pela do tipo', () => {
    const fichaEmObjetos = { ...ficha, camada: 'objetos' as const }
    expect(camadaTravadaNaBorracha(mapa(['objetos'], [], { tokens: [fichaEmObjetos] }), NA_FICHA)).toBe('objetos')
    expect(camadaTravadaNaBorracha(mapa(['tokens'], [], { tokens: [fichaEmObjetos] }), NA_FICHA)).toBeNull()
  })
})
