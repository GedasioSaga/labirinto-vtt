/**
 * CORREÇÕES DA REVISÃO DA FATIA 4 NO HOST (`docs/planos/camadas-fase3-2026-10-22.md`):
 * a camada do telhado só atravessa com o teto fechado; o disfarce da borda de
 * sala secreta leva a camada da parede vizinha; no mapa-mundi a lista de
 * camadas é recalculada depois da troca pela caravana; o modo memória não
 * devolve item que o mestre moveu para camada escondida; e a livre longe da
 * visão não entra na lista.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, DoorState, MapData, ModeloDeCamadas, Region, Token, Wall } from '../types/map'
import { CAMADAS_PADRAO } from './camadas/padrao'
import { filterMapForPlayer, planOfWholeMap, type PlayerMapView } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { mapaCompleto, mapaDeItens } from './__fixtures__/recorteDeCamadas'

const LIVRE: CamadaId = 'livre_k3j9x2'
const RAIO_TOTAL = 5000

function modelo(ids: readonly CamadaId[]): ModeloDeCamadas {
  return { ordem: ids.map((id) => ({ id })) }
}

function comLivre(map: MapData, ocultas: CamadaId[], extra: Partial<MapData> = {}): MapData {
  return { ...map, versaoDasCamadas: 2, modeloCamadas: modelo([...CAMADAS_PADRAO, LIVRE]), ocultasDoJogador: ocultas, ...extra }
}

function doOlho(map: MapData, raio: number, remembered?: ReturnType<typeof planOfWholeMap>): PlayerMapView {
  return filterMapForPlayer(map, 'p1', { p1: ['olho'] }, raio, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, remembered)
}

describe('camadaDoTelhado só com o teto fechado', () => {
  /** A Casa de `mapaDeItens` (teto fechado, longe do olho) com o telhado numa camada livre. */
  const casaComTelhadoNaLivre = (ocultas: CamadaId[], room: Partial<NonNullable<Region['room']>> = {}): MapData => {
    const base = mapaDeItens()
    return comLivre(base, ocultas, {
      regions: base.regions.map((r) => (r.id === 'casa' && r.room !== undefined ? { ...r, room: { ...r.room, camadaDoTelhado: LIVRE, ...room } } : r)),
    })
  }
  const casaDe = (view: PlayerMapView): Region | undefined => view.map.regions.find((r) => r.id === 'casa')

  it('telhado numa livre escondida dos jogadores: nem o campo, nem o id da camada no recorte', () => {
    const view = doOlho(casaComTelhadoNaLivre([LIVRE]), RAIO_TOTAL)
    const casa = casaDe(view)
    expect(casa?.room).toBeDefined()
    expect(casa?.room?.roof).toBeUndefined()
    expect(casa?.room).not.toHaveProperty('camadaDoTelhado')
    expect(JSON.stringify(view.map)).not.toContain(LIVRE)
  })

  it('caminho curto (sala sem teto, só com a camada do telhado): o campo não sai', () => {
    const view = doOlho(casaComTelhadoNaLivre([], { roof: undefined }), RAIO_TOTAL)
    const casa = casaDe(view)
    expect(casa?.room).toBeDefined()
    expect(casa?.room).not.toHaveProperty('camadaDoTelhado')
    expect(JSON.stringify(view.map)).not.toContain(LIVRE)
  })

  it('camada visível e teto fechado: o campo segue, junto do teto', () => {
    const view = doOlho(casaComTelhadoNaLivre([]), RAIO_TOTAL)
    const casa = casaDe(view)
    expect(casa?.room?.roof).toBe(true)
    expect(casa?.room?.camadaDoTelhado).toBe(LIVRE)
  })
})

describe('disfarce da borda de sala secreta leva a camada da parede vizinha', () => {
  // Planta de `fogFilter.salaSecreta.test.ts`: a estante (porta trancada do
  // Quarto Secreto) parte a parede leste da Biblioteca.
  const trancada: DoorState = { open: false, locked: true, kind: 'normal' }
  const parede = (id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({ id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra })
  const sala = (id: string, nome: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region => ({
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  })
  const lanterna: Token = { id: 'olho', characterId: null, name: 'Lanterna', x: 825, y: 275, size: 1, image: null }
  const bib: Partial<Wall> = { regionId: 'r-bib', wallKind: 'interior', camada: LIVRE }
  const sec: Partial<Wall> = { regionId: 'r-secreto', wallKind: 'exterior', thickness: 'thick', lineStyle: 'straight' }
  const mansao: MapData = comLivre(
    {
      ...createEmptyMap('map_estante', 'Mansao', 1200, 600, 50),
      walls: [
        parede('bib-n', 500, 100, 900, 100, { ...bib, regionEdgeIndex: 0 }),
        parede('bib-l1', 900, 100, 900, 250, { ...bib, regionEdgeIndex: 1 }),
        parede('bib-l2', 900, 300, 900, 450, { ...bib, regionEdgeIndex: 1 }),
        parede('bib-s', 900, 450, 500, 450, { ...bib, regionEdgeIndex: 2 }),
        parede('bib-o', 500, 450, 500, 100, { ...bib, regionEdgeIndex: 3 }),
        parede('estante', 900, 250, 900, 300, { ...sec, door: trancada }),
        parede('sec-n', 900, 100, 1150, 100, sec),
        parede('sec-l', 1150, 100, 1150, 450, sec),
        parede('sec-s', 1150, 450, 900, 450, sec),
      ],
      regions: [sala('r-bib', 'Biblioteca', 500, 100, 900, 450), sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: true })],
      tokens: [lanterna],
    },
    [],
    { opacidadeDasCamadas: { [LIVRE]: 0.5 } },
  )

  it('vizinha numa livre a 50%: o trecho disfarçado leva a mesma camada (o mesmo nó e a mesma opacidade)', () => {
    const { map } = doOlho(mansao, 700)
    const naEstante = map.walls.filter((w) => w.x1 === 900 && w.x2 === 900 && Math.min(w.y1, w.y2) <= 250 && Math.max(w.y1, w.y2) >= 300)
    expect(naEstante).toHaveLength(1)
    expect(naEstante[0]?.door).toBeNull()
    expect(naEstante[0]?.camada).toBe(LIVRE)
    // Nenhuma parede da borda leste da Biblioteca sai em outra camada: o trecho não se destaca.
    const bordaLeste = map.walls.filter((w) => w.x1 === 900 && w.x2 === 900)
    expect(bordaLeste.every((w) => w.camada === LIVRE)).toBe(true)
  })
})

describe('mapa-mundi: camadasDoJogador depois da troca pela caravana', () => {
  const ficha = (id: string, x: number, y: number, extra: Partial<Token> = {}): Token => ({ id, characterId: null, name: id, x, y, size: 1, image: null, ...extra })
  const mundo = (extra: Partial<MapData>): MapData => ({
    ...createEmptyMap('m-mundo', 'Continente', 30, 10, 50),
    worldMap: true,
    versaoDasCamadas: 2,
    modeloCamadas: modelo([...CAMADAS_PADRAO, LIVRE]),
    ocultasDoJogador: [],
    tokens: [ficha('ana', 100, 100, { camada: LIVRE }), ficha('npc', 200, 100)],
    ...extra,
  })
  const doMundo = (map: MapData): PlayerMapView => filterMapForPlayer(map, 'p1', { p1: ['ana'] }, 300)

  it('a única ficha da livre vira caravana: a livre não fica na lista sem item no pacote', () => {
    const view = doMundo(mundo({}))
    expect(view.map.tokens.some((t) => t.camada === LIVRE)).toBe(false)
    expect(view.map).not.toHaveProperty('camadasDoJogador')
    expect(JSON.stringify(view.map)).not.toContain(LIVRE)
  })

  it('a livre com outro item no pacote continua na lista', () => {
    const view = doMundo(mundo({ tokens: [ficha('ana', 100, 100, { camada: LIVRE }), ficha('npc', 200, 100, { camada: LIVRE })] }))
    expect(view.map.tokens.some((t) => t.camada === LIVRE)).toBe(true)
    expect(view.map.camadasDoJogador).toEqual([...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE }])
  })
})

describe('modo memória: item que o mestre moveu para camada escondida não volta pela lembrança', () => {
  const MOVIDOS = ['cml1', 'cmk1', 'cs1', 'cd1']
  const moverParaLivre = (map: MapData): MapData => ({
    ...map,
    lines: map.lines.map((l) => ({ ...l, camada: LIVRE })),
    markers: map.markers.map((m) => ({ ...m, camada: LIVRE })),
    stairs: map.stairs.map((s) => ({ ...s, camada: LIVRE })),
    drawings: map.drawings.map((d) => (d.id === 'cd1' ? { ...d, camada: LIVRE } : d)),
  })
  // Raio pequeno: o olho não vê nada agora, então tudo sai pela versão lembrada.
  const RAIO_CEGO = 1

  it('controle: com a livre visível, a lembrança devolve os itens', () => {
    const antes = comLivre(mapaCompleto(), [])
    const lembranca = planOfWholeMap(antes)
    const texto = JSON.stringify(doOlho(moverParaLivre(antes), RAIO_CEGO, lembranca).map)
    for (const id of MOVIDOS) expect(texto, id).toContain(`"${id}"`)
  })

  it('com a livre escondida dos jogadores, nenhum item movido sai, nem a versão que ele viu antes', () => {
    const antes = comLivre(mapaCompleto(), [LIVRE])
    const lembranca = planOfWholeMap(antes)
    const view = doOlho(moverParaLivre(antes), RAIO_CEGO, lembranca)
    const texto = JSON.stringify(view.map)
    for (const id of MOVIDOS) expect(texto, id).not.toContain(`"${id}"`)
    expect(texto).not.toContain(LIVRE)
  })
})

describe('camadasDoJogador conta só a livre com item NO PACOTE (não no mapa do mestre)', () => {
  it('raio pequeno, objetos da livre longe do olho: a livre não entra na lista', () => {
    const base = mapaCompleto()
    // O olho fica no canto, longe de tudo; os móveis da livre ficam no meio do mapa.
    const map = comLivre(base, [], {
      props: base.props.map((p) => ({ ...p, camada: LIVRE })),
      tokens: base.tokens.map((t) => (t.id === 'olho' ? { ...t, x: 64, y: 64 } : t)),
    })
    const view = doOlho(map, 64)
    expect(view.map.props.some((p) => p.camada === LIVRE)).toBe(false)
    expect(view.map).not.toHaveProperty('camadasDoJogador')
  })

  it('controle: com o raio que alcança os móveis, a livre entra', () => {
    const base = mapaCompleto()
    const map = comLivre(base, [], { props: base.props.map((p) => ({ ...p, camada: LIVRE })) })
    const view = doOlho(map, RAIO_TOTAL)
    expect(view.map.props.some((p) => p.camada === LIVRE)).toBe(true)
    expect(view.map.camadasDoJogador?.some((c) => c.id === LIVRE)).toBe(true)
  })
})
