/**
 * REVISÃO DA FATIA 6 NO RECORTE DO HOST (`docs/planos/camadas-fase3-2026-10-22.md`):
 * - o que o jogador não vê não existe para a visão DELE: paredes e peças de
 *   chão de camada escondida dos jogadores saem dos segmentos da visão
 *   ENVIADA (a autoridade do host segue com todas);
 * - opacidade 0 conta como "o jogador não vê": os itens são cortados e a
 *   camada não vai em `camadasDoJogador` com `alfa: 0`;
 * - `lockedLayers` do mestre não sai no recorte (o cadeado é do mestre, e no
 *   mapa v2 a lista leva id de camada livre).
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData } from '../types/map'
import { buildRectDrawing, buildRoomFromDraft } from './drawingFactory'
import { buildFloorPiece } from './floorTool'
import { filterMapForPlayer, type PlayerMapView } from './fogFilter'
import { addDrawing, addFloorPiece, addRoom, addToken, createEmptyMap } from './mapFactory'

const RAIO_TOTAL = 5000
const OLHO = { x: 320, y: 256 }

function doOlho(map: MapData): PlayerMapView {
  return filterMapForPlayer(map, 'p1', { p1: ['olho'] }, RAIO_TOTAL)
}

function v2(map: MapData, extra: Partial<MapData> = {}): MapData {
  return { ...map, versaoDasCamadas: 2, ocultasDoJogador: [], ...extra }
}

/** A ficha "olho" dentro de uma sala de 4 paredes. */
function salaComOlho(): MapData {
  let map = createEmptyMap('visao', 'Visão', 20, 12, 64)
  const sala = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 64, y: 64 }, { x: 576, y: 448 }, undefined, undefined, 'Sala')
  map = addRoom(map, sala.region, sala.walls)
  return addToken(map, { id: 'olho', characterId: null, name: 'Olho', ...OLHO, size: 1, image: null })
}

/** A ficha "olho" em cima de uma peça de chão, sem parede. */
function chaoComOlho(): MapData {
  let map = createEmptyMap('visao-chao', 'Visão', 20, 12, 64)
  map = addFloorPiece(map, buildFloorPiece('f1', { kind: 'rect', cx: OLHO.x, cy: OLHO.y, w: 256, h: 192 }, 'add'))
  return addToken(map, { id: 'olho', characterId: null, name: 'Olho', ...OLHO, size: 1, image: null })
}

describe('visão enviada sem as paredes e o chão que o jogador não vê', () => {
  it('Paredes escondida dos jogadores: a visão enviada é a de um mapa sem as paredes (e o pacote segue sem elas)', () => {
    const escondidas = doOlho(v2(salaComOlho(), { ocultasDoJogador: ['paredes'] }))
    const semParedes = doOlho(v2({ ...salaComOlho(), walls: [] }, { ocultasDoJogador: ['paredes'] }))
    expect(escondidas.map.walls).toHaveLength(0)
    expect(escondidas.vision).toEqual(semParedes.vision)
  })

  it('controle: com Paredes à vista dos jogadores, a sala muda a visão enviada', () => {
    const vistas = doOlho(v2(salaComOlho()))
    const semParedes = doOlho(v2({ ...salaComOlho(), walls: [] }))
    expect(vistas.map.walls.length).toBeGreaterThan(0)
    expect(vistas.vision).not.toEqual(semParedes.vision)
  })

  it('Chão escondida dos jogadores: a borda da peça não recorta a visão enviada', () => {
    const escondido = doOlho(v2(chaoComOlho(), { ocultasDoJogador: ['chao'] }))
    const semChao = doOlho(v2({ ...chaoComOlho(), floor: [] }, { ocultasDoJogador: ['chao'] }))
    expect(escondido.map.floor).toHaveLength(0)
    expect(escondido.vision).toEqual(semChao.vision)
  })

  it('controle: com Chão à vista dos jogadores, a borda da peça recorta a visão enviada', () => {
    const visto = doOlho(v2(chaoComOlho()))
    const semChao = doOlho(v2({ ...chaoComOlho(), floor: [] }))
    expect(visto.vision).not.toEqual(semChao.vision)
  })
})

describe('opacidade 0 = o jogador não vê', () => {
  const comDesenho = (): MapData => addDrawing(salaComOlho(), buildRectDrawing('d1', { x: 160, y: 160 }, { x: 288, y: 288 }, '#c0392b', 4, true, 1))

  it('Desenhos a 0%: o desenho sai do pacote e a camada não vai com alfa 0', () => {
    const view = doOlho(v2(comDesenho(), { opacidadeDasCamadas: { desenhos: 0 } }))
    expect(view.map.drawings).toHaveLength(0)
    expect(view.map.camadasDoJogador?.some((c) => c.id === 'desenhos') ?? false).toBe(false)
    expect(JSON.stringify(view.map.camadasDoJogador ?? [])).not.toContain('"alfa":0}')
  })

  it('Paredes a 0%: as paredes saem do pacote e da visão enviada', () => {
    const view = doOlho(v2(salaComOlho(), { opacidadeDasCamadas: { paredes: 0 } }))
    const semParedes = doOlho(v2({ ...salaComOlho(), walls: [] }, { opacidadeDasCamadas: { paredes: 0 } }))
    expect(view.map.walls).toHaveLength(0)
    expect(view.vision).toEqual(semParedes.vision)
  })

  it('controle: Desenhos a 50% segue no pacote, com o alfa na lista', () => {
    const view = doOlho(v2(comDesenho(), { opacidadeDasCamadas: { desenhos: 0.5 } }))
    expect(view.map.drawings.map((d) => d.id)).toEqual(['d1'])
    expect(view.map.camadasDoJogador).toContainEqual({ id: 'desenhos', alfa: 0.5 })
  })
})

describe('o cadeado do mestre não sai no recorte', () => {
  it.each([
    ['mapa v2 com uma livre travada', v2(salaComOlho(), { lockedLayers: ['paredes', 'livre_19e8b9d7' as CamadaId], modeloCamadas: { ordem: [{ id: 'livre_19e8b9d7', nome: 'Segredo' }] } })],
    ['mapa de antes', { ...salaComOlho(), lockedLayers: ['paredes', 'tokens'] } as MapData],
  ])('%s: lockedLayers vazio', (_nome, map) => {
    const view = doOlho(map)
    expect(view.map.lockedLayers).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('livre_19e8b9d7')
  })
})
