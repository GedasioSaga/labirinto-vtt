import { describe, expect, it } from 'vitest'
import type { FloorPiece, LayerId, MapData, Token } from '../../types/map'
import { encherNaCamada, apagarNaCamada, pintarNaCamada } from '../camadasDoPincel'
import { buildBlocosShape } from '../floorBlocks'
import { buildFloorPiece, findFloorPieceAt } from '../floorTool'
import { createEmptyMap } from '../mapFactory'
import { mapObjectsOf } from '../mapObjects'

/**
 * FERRAMENTAS QUE JÁ RECUSAVAM POR OUTRO CAMINHO (fase 3, fatia 5) passam a
 * perguntar também à camada, pelo ponto único: o pincel de blocos (pintar,
 * apagar, encher) recusa com Chão travada ou escondida do mestre (no mapa de
 * antes, Chão segue Salas), além da trava por peça; o clique no chão e a lista
 * de objetos seguem a camada ESCOLHIDA do item, não só a do tipo.
 */
const CELULA = 50
const blocos = [{ col: 1, row: 1 }]
const shape = buildBlocosShape(CELULA, [{ col: 1, row: 1 }, { col: 2, row: 1 }])
if (shape === null) throw new Error('fixture: forma de blocos vazia')
const tinta: FloorPiece = { ...buildFloorPiece('tinta', shape, 'add'), nome: 'Camada 1' }
const novoId = () => 'nova'
const opcoes = { novoId, cor: null }

function mapa(lockedLayers: LayerId[], hiddenLayers: LayerId[] = [], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 800, 800, CELULA), floor: [tinta], lockedLayers, hiddenLayers, ...extra }
}

describe('pincel de blocos × camada Chão', () => {
  it('mapa de antes, Salas travada: pintar, apagar e encher recusam pela CAMADA e dizem qual', () => {
    const m = mapa(['salas'])
    for (const r of [
      pintarNaCamada(m, 0, 'tinta', blocos, CELULA, opcoes),
      apagarNaCamada(m, 0, 'tinta', blocos, CELULA, novoId),
      encherNaCamada(m, 0, 'tinta', { x: 400, y: 400 }, opcoes),
    ]) {
      expect(r.map).toBe(m)
      expect(r).toMatchObject({ recusa: 'travada', camadaQueRecusa: 'salas' })
    }
  })

  it('mapa de antes, Salas escondida: recusa como escondida', () => {
    const m = mapa([], ['salas'])
    const r = pintarNaCamada(m, 0, 'tinta', blocos, CELULA, opcoes)
    expect(r.map).toBe(m)
    expect(r).toMatchObject({ recusa: 'escondida', camadaQueRecusa: 'salas' })
  })

  it('sem camada nenhuma ainda (a pincelada criaria a primeira) também recusa', () => {
    const m = mapa(['salas'], [], { floor: [] })
    expect(pintarNaCamada(m, 0, null, blocos, CELULA, opcoes)).toMatchObject({ map: m, recusa: 'travada', camadaQueRecusa: 'salas' })
  })

  it('mapa v2: Salas travada não segura o Chão; destravado tudo como hoje', () => {
    expect(pintarNaCamada(mapa(['salas'], [], { versaoDasCamadas: 2 }), 0, 'tinta', blocos, CELULA, opcoes).recusa).toBeUndefined()
    expect(pintarNaCamada(mapa([]), 0, 'tinta', blocos, CELULA, opcoes).recusa).toBeUndefined()
  })

  it('a trava POR PEÇA continua recusando, sem camada que recuse', () => {
    const r = pintarNaCamada(mapa([], [], { floor: [{ ...tinta, locked: true }] }), 0, 'tinta', blocos, CELULA, opcoes)
    expect(r.recusa).toBe('travada')
    expect(r.camadaQueRecusa).toBeUndefined()
  })
})

describe('clique no chão e lista de objetos seguem a camada escolhida', () => {
  it('peça de chão posta em Objetos travada não se pega; com Salas travada no v2, pega', () => {
    const emObjetos: FloorPiece = { ...tinta, camada: 'objetos' }
    const ponto = { x: 75, y: 75 }
    expect(findFloorPieceAt(mapa(['objetos'], [], { floor: [emObjetos] }), ponto)).toBeNull()
    expect(findFloorPieceAt(mapa(['salas'], [], { floor: [tinta], versaoDasCamadas: 2 }), ponto)?.id).toBe('tinta')
    expect(findFloorPieceAt(mapa(['salas'], [], { floor: [tinta] }), ponto)).toBeNull()
  })

  it('ficha posta em Objetos travada aparece bloqueada na lista de objetos', () => {
    const ficha: Token = { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null, camada: 'objetos' }
    const lista = mapObjectsOf(mapa(['objetos'], [], { tokens: [ficha] }))
    expect(lista.find((entrada) => entrada.id === 'ana')?.blockedReason).toBe('camada travada')
  })
})
