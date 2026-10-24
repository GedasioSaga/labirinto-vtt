import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData, Prop, Token } from '../../types/map'
import { buildRoomFromDraft, buildTextDrawing } from '../drawingFactory'
import { filterMapForPlayer, planOfWholeMap } from '../fogFilter'
import { addDrawing, addProp, addRoom, addToken, createEmptyMap } from '../mapFactory'
import { deserializeMap, serializeMap } from '../mapFile'
import { apagarCamadaLivre } from './modelo'
import { MODELO_PADRAO } from './padrao'
import { camadaDosItens, moverParaCamada, refsDaSelecao, type RefDeItem } from './mover'

const GRADE = 64
const LIVRE: CamadaId = 'livre_0a1b2c3d'
const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 160, y: 160, size: 1, image: null }
const BRUNO: Token = { id: 'bruno', characterId: null, name: 'Bruno', x: 288, y: 160, size: 1, image: null }
const BAU: Prop = { id: 'bau', src: 'bau.png', x: 400, y: 400, width: 64, height: 64, linkedMapPath: null }

/** Salão com teto (r1, paredes w1..w4), Ana e Bruno dentro, um baú e um texto. */
function mapa(extra: Partial<MapData> = {}): MapData {
  let map = createEmptyMap('m', 'Mover', 12, 10, GRADE)
  const salao = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 64, y: 64 }, { x: 448, y: 320 }, undefined, undefined, 'Salão')
  map = addRoom(map, salao.region, salao.walls)
  map = { ...map, regions: map.regions.map((r) => (r.id === 'r1' && r.room !== undefined ? { ...r, room: { ...r.room, roof: true } } : r)) }
  map = addToken(addToken(map, ANA), BRUNO)
  map = addProp(map, BAU)
  map = addDrawing(map, buildTextDrawing('t1', { x: 200, y: 500 }, '#ffffff', 16))
  return { ...map, ...extra }
}

const ficha = (id: string): RefDeItem => ({ tipo: 'ficha', id })

describe('moverParaCamada: a regra pura', () => {
  it('ficha vai para Objetos num passo; voltar a Tokens tira o campo e o mapa volta a ser o de antes', () => {
    const antes = mapa()
    const ida = moverParaCamada(antes, [ficha('ana')], 'objetos')
    expect(ida.movidos).toBe(1)
    expect(ida.map.tokens.find((t) => t.id === 'ana')?.camada).toBe('objetos')
    expect(ida.map.tokens.find((t) => t.id === 'bruno')).toBe(antes.tokens.find((t) => t.id === 'bruno'))
    const volta = moverParaCamada(ida.map, [ficha('ana')], 'tokens')
    expect(volta.map.tokens.find((t) => t.id === 'ana')).not.toHaveProperty('camada')
    expect(serializeMap(volta.map)).toBe(serializeMap(antes))
  })

  it('vários itens de tipos diferentes num mapa só; a camada atual vira a mesma para todos', () => {
    const antes = mapa({ modeloCamadas: { ordem: [...MODELO_PADRAO.ordem, { id: LIVRE, nome: 'Segredo' }] } })
    const refs: RefDeItem[] = [ficha('ana'), ficha('bruno'), { tipo: 'parede', id: 'w1' }, { tipo: 'objeto', id: 'bau' }, { tipo: 'telhado', id: 'r1' }]
    expect(camadaDosItens(antes, refs)).toBe('varias')
    const r = moverParaCamada(antes, refs, LIVRE)
    expect(r.movidos).toBe(5)
    expect(camadaDosItens(r.map, refs)).toBe(LIVRE)
    expect(r.map.regions.find((x) => x.id === 'r1')?.room?.camadaDoTelhado).toBe(LIVRE)
    // A Região da sala não mudou de camada: só o teto dela.
    expect(r.map.regions.find((x) => x.id === 'r1')).not.toHaveProperty('camada')
  })

  it('objeto: Decoração e Objetos gravam no `layer` de antes; livre no `camada`; de volta, idêntico', () => {
    const antes = mapa({ modeloCamadas: { ordem: [...MODELO_PADRAO.ordem, { id: LIVRE }] } })
    const bau: RefDeItem = { tipo: 'objeto', id: 'bau' }
    const deco = moverParaCamada(antes, [bau], 'decoracao').map
    expect(deco.props[0]).toMatchObject({ layer: 'decoracao' })
    expect(deco.props[0]).not.toHaveProperty('camada')
    const livre = moverParaCamada(deco, [bau], LIVRE).map
    expect(livre.props[0].camada).toBe(LIVRE)
    const volta = moverParaCamada(livre, [bau], 'objetos').map
    expect(volta.props[0]).toEqual(antes.props[0])
  })

  it('a mesma camada não gasta passo: devolve o MESMO mapa', () => {
    const antes = mapa()
    expect(moverParaCamada(antes, [ficha('ana')], 'tokens').map).toBe(antes)
    expect(moverParaCamada(antes, [{ tipo: 'objeto', id: 'bau' }], 'objetos').map).toBe(antes)
  })

  it('camada travada NÃO RECEBE: recusa tudo e diz qual (no mapa de antes, Chão responde por Salas)', () => {
    const travada = mapa({ lockedLayers: ['iluminacao'] })
    const r = moverParaCamada(travada, [ficha('ana'), { tipo: 'parede', id: 'w1' }], 'iluminacao')
    expect(r).toMatchObject({ map: travada, movidos: 0, recusa: 'destino-travado', camadaQueRecusa: 'iluminacao' })
    const legado = mapa({ lockedLayers: ['salas'] })
    expect(moverParaCamada(legado, [ficha('ana')], 'chao')).toMatchObject({ map: legado, recusa: 'destino-travado', camadaQueRecusa: 'salas' })
  })

  it('camada travada NÃO ENTREGA: o item dela fica; o resto da seleção vai', () => {
    const travada = mapa({ lockedLayers: ['tokens'] })
    expect(moverParaCamada(travada, [ficha('ana')], 'objetos')).toMatchObject({ map: travada, recusa: 'origem-travada', camadaQueRecusa: 'tokens' })
    const misto = moverParaCamada(travada, [ficha('ana'), { tipo: 'parede', id: 'w1' }], 'objetos')
    expect(misto).toMatchObject({ movidos: 1, ficaram: 1 })
    expect(misto.map.walls.find((w) => w.id === 'w1')?.camada).toBe('objetos')
    expect(misto.map.tokens.find((t) => t.id === 'ana')).not.toHaveProperty('camada')
  })

  it('item travado (cadeado dele) fica, sem camada que recuse', () => {
    const preso = mapa()
    const comCadeado = { ...preso, tokens: preso.tokens.map((t) => (t.id === 'ana' ? { ...t, locked: true } : t)) }
    const r = moverParaCamada(comCadeado, [ficha('ana')], 'objetos')
    expect(r).toMatchObject({ map: comCadeado, recusa: 'origem-travada' })
    expect(r.camadaQueRecusa).toBeUndefined()
  })

  it('sala, texto e peça ainda desenham na padrão: ficam, e sozinhos recusam como "tipo na padrão"', () => {
    const antes = mapa()
    expect(moverParaCamada(antes, [{ tipo: 'regiao', id: 'r1' }, { tipo: 'desenho', id: 't1' }], 'objetos')).toMatchObject({ map: antes, recusa: 'tipo-na-padrao', ficaram: 2 })
    const misto = moverParaCamada(antes, [{ tipo: 'regiao', id: 'r1' }, ficha('ana')], 'objetos')
    expect(misto).toMatchObject({ movidos: 1, ficaram: 1 })
  })

  it('camada que não está na lista recusa; teto de sala sem teto não existe', () => {
    const antes = mapa()
    expect(moverParaCamada(antes, [ficha('ana')], LIVRE)).toMatchObject({ map: antes, recusa: 'camada-inexistente' })
    const semTeto = { ...antes, regions: antes.regions.map((r) => (r.room === undefined ? r : { ...r, room: { ...r.room, roof: false } })) }
    expect(moverParaCamada(semTeto, [{ tipo: 'telhado', id: 'r1' }], 'objetos').map).toBe(semTeto)
  })

  it('item numa camada livre APAGADA responde pela padrão; mover para a padrão limpa o id órfão', () => {
    const comLivre = mapa({ modeloCamadas: { ordem: [...MODELO_PADRAO.ordem, { id: LIVRE }] } })
    const naLivre = moverParaCamada(comLivre, [ficha('ana')], LIVRE).map
    const orfao = { ...naLivre, modeloCamadas: MODELO_PADRAO }
    expect(camadaDosItens(orfao, [ficha('ana')])).toBe('tokens')
    expect(moverParaCamada(orfao, [ficha('ana')], 'tokens').map.tokens.find((t) => t.id === 'ana')).not.toHaveProperty('camada')
    // E a regra da fatia 7 (apagar a camada) devolve o item à padrão do tipo.
    expect(apagarCamadaLivre(naLivre, LIVRE).map.tokens.find((t) => t.id === 'ana')).not.toHaveProperty('camada')
  })

  it('a camada escolhida atravessa o arquivo (ida e volta)', () => {
    const r = moverParaCamada(mapa(), [ficha('ana'), { tipo: 'telhado', id: 'r1' }], 'objetos').map
    const lido = deserializeMap(serializeMap(r))
    expect(lido.tokens.find((t) => t.id === 'ana')?.camada).toBe('objetos')
    expect(lido.regions.find((x) => x.id === 'r1')?.room?.camadaDoTelhado).toBe('objetos')
  })

  it('refsDaSelecao: tipos da seleção e o pino aberto', () => {
    expect(refsDaSelecao([{ kind: 'token', id: 'a' }, { kind: 'wall', id: 'w' }, { kind: 'floor', id: 'f' }], 'p')).toEqual([
      { tipo: 'ficha', id: 'a' },
      { tipo: 'parede', id: 'w' },
      { tipo: 'peca', id: 'f' },
      { tipo: 'pino', id: 'p' },
    ])
  })
})

describe('mover para camada escondida dos jogadores: o pacote REAL do host (filterMapForPlayer)', () => {
  const pacote = (map: MapData) =>
    filterMapForPlayer(map, 'p-ana', { 'p-ana': ['ana'] }, 12 * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(map)).map

  it('Bruno e a parede w1 chegam; movidos para Iluminação (escondida só dos jogadores), somem do pacote; o mestre segue vendo', () => {
    const antes = mapa({ versaoDasCamadas: 2, ocultasDoJogador: ['iluminacao'] })
    // Controle: sem mover, os dois chegam.
    expect(pacote(antes).tokens.map((t) => t.id)).toContain('bruno')
    expect(pacote(antes).walls.map((w) => w.id)).toContain('w1')
    const depois = moverParaCamada(antes, [ficha('bruno'), { tipo: 'parede', id: 'w1' }], 'iluminacao').map
    expect(pacote(depois).tokens.map((t) => t.id)).not.toContain('bruno')
    expect(pacote(depois).walls.map((w) => w.id)).not.toContain('w1')
    expect(depois.hiddenLayers).toEqual([])
  })
})
