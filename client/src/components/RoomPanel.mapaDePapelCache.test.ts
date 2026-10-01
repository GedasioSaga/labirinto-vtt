/**
 * MAPA DE PAPEL — `giftScenesOf` guarda as Salas de cada `regions` já vista: o
 * App a chama a cada render (cada quadro de arrasto), para a cena aberta e para
 * todas as de fundo. O que precisa continuar igual: a mesma resposta de antes,
 * Sala renomeada ou escondida aparecendo na hora, e o nome da cena vindo da
 * cena (não do que ficou guardado).
 */
import { describe, expect, it } from 'vitest'
import { giftableRoomsOf } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import type { HostScene, HostWorld } from '../net/hostSession'
import type { MapData, Region } from '../types/map'
import { giftScenesOf, type GiftScene } from './RoomPanel'

function sala(id: string, nome: string, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

function mapa(id: string, regions: Region[]): MapData {
  return { ...createEmptyMap(id, id, 10, 10, 50), regions }
}

function cena(sceneId: string, name: string, map: MapData): HostScene {
  return { sceneId, name, map }
}

/** O `giftScenesOf` de antes do cache, linha por linha: o oráculo da equivalência. */
function semCache(world: HostWorld): GiftScene[] {
  return [world.open, ...world.background].flatMap((scene) => {
    const rooms = giftableRoomsOf(scene.map).map((region) => ({ id: region.id, name: region.room?.name.trim() || 'Sala sem nome' }))
    return rooms.length === 0 ? [] : [{ sceneId: scene.sceneId, name: scene.name, rooms }]
  })
}

const SALAO = mapa('m-salao', [
  sala('r-bib', '  Biblioteca  '),
  sala('r-sec', 'Passagem', { secret: true }),
  sala('r-dentro', 'Nicho', { parentId: 'r-sec' }),
  sala('r-oculta', 'Despensa', { hidden: true }),
  sala('r-teto', 'Torre', { room: { shape: 'rect', name: 'Torre', roof: true } }),
  sala('r-sob-teto', 'Sino', { parentId: 'r-teto' }),
  { ...sala('r-comum', 'x'), room: undefined },
  sala('r-sem-nome', '   '),
])
const CRIPTA = mapa('m-cripta', [sala('r-pombal', 'Pombal'), sala('r-porao', 'Porão')])
const VAZIA = mapa('m-vazia', [])

function mundo(open: MapData = SALAO): HostWorld {
  return { open: cena('s-salao', 'Salão Nobre', open), background: [cena('s-cripta', 'Cripta Funda', CRIPTA), cena('s-vazia', 'Poço Vazio', VAZIA)] }
}

describe('giftScenesOf com as Salas guardadas por regions', () => {
  it('dá a mesma resposta de antes do cache, na primeira chamada e nas seguintes', () => {
    const world = mundo()
    const esperado = semCache(world)
    expect(esperado).toEqual([
      { sceneId: 's-salao', name: 'Salão Nobre', rooms: [{ id: 'r-bib', name: 'Biblioteca' }, { id: 'r-sem-nome', name: 'Sala sem nome' }] },
      { sceneId: 's-cripta', name: 'Cripta Funda', rooms: [{ id: 'r-pombal', name: 'Pombal' }, { id: 'r-porao', name: 'Porão' }] },
    ])
    expect(giftScenesOf(world)).toEqual(esperado)
    expect(giftScenesOf(world)).toEqual(esperado)
  })

  it('arrasto de ficha (só tokens mudam, regions é o mesmo array): devolve as Salas guardadas, sem recalcular', () => {
    const antes = giftScenesOf(mundo())
    const arrastado = mundo({ ...SALAO, tokens: [{ id: 'k1', characterId: null, name: 'Heroi', x: 30, y: 40, size: 1, image: null, color: null }] })
    const depois = giftScenesOf(arrastado)
    expect(depois).toEqual(antes)
    // Mesma referência = veio do que estava guardado, não de um giftableRoomsOf novo.
    expect(depois[0].rooms).toBe(antes[0].rooms)
    expect(depois[1].rooms).toBe(antes[1].rooms)
  })

  it('Sala renomeada (regions novo) aparece com o nome novo na hora', () => {
    giftScenesOf(mundo())
    const renomeado = mapa('m-salao', SALAO.regions.map((r) => (r.id === 'r-bib' ? sala('r-bib', 'Arquivo') : r)))
    const world = mundo(renomeado)
    expect(giftScenesOf(world)[0].rooms).toEqual([{ id: 'r-bib', name: 'Arquivo' }, { id: 'r-sem-nome', name: 'Sala sem nome' }])
    expect(giftScenesOf(world)).toEqual(semCache(world))
  })

  it('Sala que vira secreta sai da lista; cena que fica sem Sala some, e volta quando a Sala volta', () => {
    giftScenesOf(mundo())
    const criptaSecreta = mapa('m-cripta', CRIPTA.regions.map((r) => ({ ...r, secret: true })))
    const world: HostWorld = { ...mundo(), background: [cena('s-cripta', 'Cripta Funda', criptaSecreta)] }
    expect(giftScenesOf(world).map((s) => s.sceneId)).toEqual(['s-salao'])
    expect(giftScenesOf(mundo()).map((s) => s.sceneId)).toEqual(['s-salao', 's-cripta'])
  })

  it('nome e id da cena vêm da cena, não do cache: renomear a cena com as mesmas regions aparece', () => {
    giftScenesOf(mundo())
    const world: HostWorld = { ...mundo(), open: cena('s-salao-2', 'Salão Reformado', SALAO) }
    expect(giftScenesOf(world)[0]).toEqual({ sceneId: 's-salao-2', name: 'Salão Reformado', rooms: semCache(world)[0].rooms })
  })

  it('duas cenas com o mesmo array de regions: cada uma com o seu nome e id', () => {
    const copia = { ...CRIPTA, id: 'm-copia' }
    const world: HostWorld = { open: cena('s-cripta', 'Cripta Funda', CRIPTA), background: [cena('s-copia', 'Cripta Copiada', copia)] }
    expect(giftScenesOf(world)).toEqual(semCache(world))
    expect(giftScenesOf(world).map((s) => [s.sceneId, s.name])).toEqual([
      ['s-cripta', 'Cripta Funda'],
      ['s-copia', 'Cripta Copiada'],
    ])
  })
})
