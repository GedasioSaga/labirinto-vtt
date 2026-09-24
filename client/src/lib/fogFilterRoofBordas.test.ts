import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Prop, Region, RegionPoint, RoomMeta, Token, Wall } from '../types/map'
import { createExploration, forgetInside, isPointExplored, markRings, type Exploration } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * TETO DE CONSTRUÇÃO — a bateria de BORDA. Cada teste aqui é um defeito que a
 * primeira versão da feature tinha, com a MESMA entrada com que ele foi
 * medido: a casa 100..400 e o jogador na rua, em (250,600).
 *
 * A raiz de quase todos era uma só: "está dentro do prédio?" respondido por
 * dois predicados diferentes — `pointInRing`, raycast de borda EXCLUSIVA e
 * assimétrica (inclui norte/oeste, exclui sul/leste), para esconder; e
 * `pointInPolygonInclusive` para abrir. Qualquer coisa ENCOSTADA no muro caía
 * na fresta entre os dois.
 */
const CASA: RegionPoint[] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
const RUA = { x: 250, y: 600 }
const DENTRO = { x: 250, y: 250 }
const RADIUS = 700
const OWNERSHIP = { p1: ['heroi'] }

function sala(id: string, points: RegionPoint[], extra: Partial<Region> = {}): Region {
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}` }, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function heroi(p: { x: number; y: number }): Token {
  return { id: 'heroi', characterId: null, name: 'nome-heroi', x: p.x, y: p.y, size: 1, image: null }
}

const PROP_DENTRO: Prop = { id: 'prop-de-dentro', x: 250, y: 200, width: 40, height: 40, src: 'barril.png', linkedMapPath: null }
const MOBILIA: Drawing = {
  id: 'mobilia-de-dentro',
  kind: 'rect',
  x: 150,
  y: 150,
  w: 100,
  h: 60,
  color: '#ff00ff',
  width: 4,
  filled: true,
  fillAlpha: 1,
}

/**
 * Casa com teto, mobília e um prop dentro; o resto vem por `extra`.
 *
 * `room` entra inteiro (e não um `roof?: boolean`) porque parte destes testes é
 * justamente sobre o campo AUSENTE e sobre valor escrito à mão (`1`, `"sim"`):
 * um parâmetro com valor padrão trocaria `undefined` por `true` sem avisar.
 */
function mapaDaCasa(pos: { x: number; y: number }, extra: Partial<MapData> = {}, room = COM_TETO): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    regions: [sala('casa', CASA, { room })],
    drawings: [MOBILIA],
    props: [PROP_DENTRO],
    tokens: [heroi(pos)],
    ...extra,
  }
}

const COM_TETO: RoomMeta = { shape: 'rect', name: 'nome-casa', roof: true }
const SEM_TETO: RoomMeta = { shape: 'rect', name: 'nome-casa' }
/** `as RoomMeta` DE PROPÓSITO: o teste é sobre arquivo de mapa editado à mão, onde
 *  `roof` chega como `1` ou `"sim"` — valor que o tipo proíbe e o disco entrega. */
const comRoof = (valor: unknown): RoomMeta => ({ shape: 'rect', name: 'nome-casa', roof: valor }) as RoomMeta

const idsDe = (view: { map: MapData }, campo: 'walls' | 'regions'): string[] => view.map[campo].map((x) => x.id)

/**
 * Só o BITSET, sem os contornos lembrados.
 *
 * A diferença importa: o bitset é a grade de células que desenha POR ONDE o
 * jogador andou — é ele que traçava a planta do prédio na rede depois que o
 * teto fechava. O contorno lembrado é a borda da névoa e, de fora, ainda pode
 * cobrir o pedaço do interior que a linha de visão alcança pelo VÃO aberto,
 * porque isso é o que a pessoa está enxergando agora e o `vision` do pacote já
 * diz. Nada do interior atravessa por causa disso: `filterMapForPlayer` veta
 * item por item.
 */
function celulaMarcada(exp: Exploration, p: RegionPoint): boolean {
  const col = Math.floor(p.x / exp.cell)
  const row = Math.floor(p.y / exp.cell)
  const index = row * exp.cols + col
  return ((exp.bits[index >> 3] ?? 0) & (1 << (index & 7))) !== 0
}

// ---------------------------------------------------------------------------
// 1, 2 e 8 — o predicado de borda: o que ENCOSTA no muro
// ---------------------------------------------------------------------------
describe('teto de construção — o que encosta no muro', () => {
  const divisorias = [
    parede('divisoria-toca-LESTE', 250, 250, 400, 250),
    parede('divisoria-toca-SUL', 250, 250, 250, 400),
    parede('divisoria-toca-NORTE', 250, 100, 250, 250),
    parede('divisoria-toca-OESTE', 100, 250, 250, 250),
  ]

  it('SEGURANÇA: divisória interna que ENCOSTA no muro não sai no pacote (achado 1)', () => {
    const view = filterMapForPlayer(mapaDaCasa(RUA, { walls: divisorias }), 'p1', OWNERSHIP, RADIUS)
    expect(idsDe(view, 'walls')).toEqual([])
    // Controle: sem teto, são planta comum e saem as que a rua vê. A do NORTE
    // fica atrás da linha que LESTE + OESTE fazem em y = 250: nunca vista, não
    // sai (paredes-so-as-vistas) — e o teto não tem nada com isso.
    const semTeto = filterMapForPlayer(mapaDaCasa(RUA, { walls: divisorias }, SEM_TETO), 'p1', OWNERSHIP, RADIUS)
    expect(idsDe(semTeto, 'walls').sort()).toEqual(['divisoria-toca-LESTE', 'divisoria-toca-OESTE', 'divisoria-toca-SUL'])
  })

  it('a parede SOLTA sobre o muro — e a porta da frente nela — continua saindo (achado 8)', () => {
    // Sem isto o jogador não recebe a porta, não entra, e o teto nunca abre.
    // Um muro por vez: com os quatro no mapa, o do sul tapa a visão do norte e
    // a porta cairia pela régua de visão, não pelo teto — o teste mediria outra coisa.
    const muros = [
      parede('muro-norte', 150, 100, 350, 100, { door: { open: false, locked: false, kind: 'normal' } }),
      parede('muro-oeste', 100, 150, 100, 350),
      parede('muro-sul', 150, 400, 350, 400),
      parede('muro-leste', 400, 150, 400, 350),
    ]
    for (const muro of muros) {
      const view = filterMapForPlayer(mapaDaCasa(RUA, { walls: [muro] }), 'p1', OWNERSHIP, RADIUS)
      expect(idsDe(view, 'walls'), `o muro ${muro.id} sumiu do mapa do jogador`).toEqual([muro.id])
    }
  })

  it('SEGURANÇA: a porta interna encostada no muro some quando o teto fecha, mesmo explorada (achado 2)', () => {
    const porta = parede('porta-interna-toca-SUL', 300, 300, 300, 400, { door: { open: true, locked: false, kind: 'normal' } })
    const mapaDentro = mapaDaCasa(DENTRO, { walls: [porta] })
    const dentro = filterMapForPlayer(mapaDentro, 'p1', OWNERSHIP, RADIUS)
    // Controle: com o teto ABERTO ele recebe a porta — senão o teste de baixo não prova nada.
    expect(idsDe(dentro, 'walls')).toEqual(['porta-interna-toca-SUL'])

    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, dentro.vision, dentro.blocked)
    const fora = filterMapForPlayer(mapaDaCasa(RUA, { walls: [porta] }), 'p1', OWNERSHIP, RADIUS, exp)
    expect(idsDe(fora, 'walls')).toEqual([])
    expect(JSON.stringify(fora.map)).not.toContain('porta-interna-toca-SUL')
  })

  it('token EM CIMA do muro não abre o teto de fora (achado 11)', () => {
    for (const pos of [{ x: 400, y: 250 }, { x: 400.4, y: 250 }, { x: 100, y: 250 }]) {
      const view = filterMapForPlayer(mapaDaCasa(pos), 'p1', OWNERSHIP, RADIUS)
      expect(view.map.regions[0]?.room?.roof, `token em (${pos.x},${pos.y}) abriu o teto de fora`).toBe(true)
      expect(view.map.props, `token em (${pos.x},${pos.y}) levou o interior`).toEqual([])
    }
    // Controle: um passo para dentro e o teto abre mesmo.
    const aberto = filterMapForPlayer(mapaDaCasa({ x: 398, y: 250 }), 'p1', OWNERSHIP, RADIUS)
    expect(aberto.map.props.map((p) => p.id)).toEqual(['prop-de-dentro'])
  })
})

// ---------------------------------------------------------------------------
// 3 e 4 — região engolida pelo prédio, sem `parentId`
// ---------------------------------------------------------------------------
describe('teto de construção — região dentro do prédio sem parentId', () => {
  const dentroDaCasa: RegionPoint[] = [
    { x: 150, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
  ]

  it('SEGURANÇA: cômodo órfão, Área sem sala e teto dentro de teto não saem (achados 3 e 4)', () => {
    const regions = [
      sala('casa', CASA, { room: COM_TETO }),
      sala('quarto-orfao', dentroDaCasa),
      { ...sala('area-orfa', dentroDaCasa), room: undefined },
      sala('cofre-orfao', dentroDaCasa, { room: { shape: 'rect', name: 'nome-cofre', roof: true } }),
    ]
    const view = filterMapForPlayer(mapaDaCasa(RUA, { regions }), 'p1', OWNERSHIP, RADIUS)
    expect(idsDe(view, 'regions')).toEqual(['casa'])
    const json = JSON.stringify(view.map)
    for (const id of ['quarto-orfao', 'area-orfa', 'cofre-orfao', 'nome-quarto-orfao', 'nome-cofre']) expect(json).not.toContain(id)
  })

  it('a Área GRANDE que CONTÉM o prédio continua sendo do jogador', () => {
    const patio: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ]
    const regions = [
      sala('casa', CASA, { room: COM_TETO }),
      { ...sala('patio', patio), room: undefined },
    ]
    const view = filterMapForPlayer(mapaDaCasa(RUA, { regions }), 'p1', OWNERSHIP, RADIUS)
    expect(idsDe(view, 'regions').sort()).toEqual(['casa', 'patio'])
  })
})

// ---------------------------------------------------------------------------
// 5, 6 e 9 — memória do explorado
// ---------------------------------------------------------------------------
describe('teto de construção — memória do explorado', () => {
  /** O que `net/hostSession.ts` faz a cada snapshot, na mesma ordem. */
  function snapshot(map: MapData, exp: Exploration) {
    const view = filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS, exp)
    markRings(exp, view.vision, view.blocked)
    forgetInside(exp, view.roofs)
    return view
  }

  /** Casa de verdade: quatro muros e um vão no sul, por onde se entra. */
  const MUROS = [
    parede('muro-norte', 100, 100, 400, 100),
    parede('muro-leste', 400, 100, 400, 400),
    parede('muro-oeste', 100, 100, 100, 400),
    parede('muro-sul-esq', 100, 400, 220, 400),
    parede('muro-sul-dir', 280, 400, 400, 400),
  ]

  it('SEGURANÇA: o que ele percorreu DENTRO some da memória quando o teto fecha (achado 5)', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    snapshot(mapaDaCasa(DENTRO, { walls: MUROS }), exp)
    // Controle: enquanto ele está lá dentro, o interior É memória dele.
    expect(isPointExplored(exp, { x: 250, y: 200 })).toBe(true)

    snapshot(mapaDaCasa(RUA, { walls: MUROS }), exp)
    // Os cantos que ele percorreu e que, da rua, o vão não alcança: esquecidos.
    expect(isPointExplored(exp, { x: 150, y: 150 }), 'o canto noroeste que ele visitou ficou na memória').toBe(false)
    expect(isPointExplored(exp, { x: 350, y: 350 }), 'o canto sudeste que ele visitou ficou na memória').toBe(false)
    // A GRADE de células — o que de fato desenha o caminho dele — é apagada até
    // no eixo do vão, onde a linha de visão de quem está na rua ainda chega.
    expect(celulaMarcada(exp, { x: 250, y: 200 }), 'a célula do caminho dele ficou marcada').toBe(false)
    // E a rua de onde ele veio continua lembrada: o teto apaga o DENTRO, não tudo.
    expect(isPointExplored(exp, { x: 250, y: 500 })).toBe(true)
  })

  it('o prédio no campo de visão NÃO apaga a memória da rua, longe dele (achado 6)', () => {
    const comTeto = createExploration({ width: 1000, height: 1000, grid: 40 })
    snapshot(mapaDaCasa(RUA), comTeto)
    const semTeto = createExploration({ width: 1000, height: 1000, grid: 40 })
    snapshot(mapaDaCasa(RUA, {}, SEM_TETO), semTeto)

    // O contorno lembrado é a borda da memória; com o teto ele sumia inteiro.
    expect(comTeto.rings.length, 'o teto jogou fora o contorno da visão').toBe(semTeto.rings.length)
    expect(comTeto.rings.length).toBeGreaterThan(0)
    // E a rua longe do prédio continua lembrada, ponto a ponto.
    for (const p of [{ x: 250, y: 700 }, { x: 450, y: 620 }, { x: 60, y: 620 }]) {
      expect(isPointExplored(comTeto, p), `esqueceu a rua em (${p.x},${p.y})`).toBe(isPointExplored(semTeto, p))
      expect(isPointExplored(comTeto, p)).toBe(true)
    }
  })

  it('a silhueta do prédio NÃO some quando o jogador se afasta (achado 9)', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    const daRua = snapshot(mapaDaCasa(RUA), exp)
    expect(idsDe(daRua, 'regions'), 'controle: da rua ele tem de ver o prédio').toEqual(['casa'])

    const longe = filterMapForPlayer(mapaDaCasa({ x: 900, y: 900 }), 'p1', OWNERSHIP, 100, exp)
    expect(idsDe(longe, 'regions'), 'o prédio sumiu do mapa do jogador quando ele se afastou').toEqual(['casa'])
    expect(longe.map.regions[0]?.room?.roof).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 10, 12, 13, 14, 15 — falhar FECHADO
// ---------------------------------------------------------------------------
describe('teto de construção — na dúvida, fecha', () => {
  it('camada Salas escondida desliga o teto em vez de abrir um buraco (achado 10)', () => {
    const view = filterMapForPlayer(mapaDaCasa(RUA, { hiddenLayers: ['salas'] }), 'p1', OWNERSHIP, RADIUS)
    // Sem região nenhuma não há silhueta, então esconder o interior deixaria
    // um vazio sem nada no lugar: o teto sai de cena junto com a camada.
    expect(view.map.regions).toEqual([])
    expect(view.map.props.map((p) => p.id)).toEqual(['prop-de-dentro'])
    expect(view.roofs).toEqual([])
  })

  it('SEGURANÇA: vértice NaN fecha o teto em vez de abrir (achado 12)', () => {
    const quebrada = [{ x: Number.NaN, y: 100 }, ...CASA.slice(1)]
    const regions = [sala('casa', quebrada, { room: COM_TETO })]
    const view = filterMapForPlayer(mapaDaCasa(DENTRO, { regions }), 'p1', OWNERSHIP, RADIUS)
    expect(view.map.props, 'o interior vazou por uma sala de geometria inválida').toEqual([])
    expect(view.map.drawings).toEqual([])
    // A sala indecidível também não vira silhueta: ela some.
    expect(idsDe(view, 'regions')).toEqual([])
  })

  it('SEGURANÇA: `roof` escrito à mão como 1 ou "sim" conta como teto (achado 13)', () => {
    for (const valor of [1, 'sim']) {
      const view = filterMapForPlayer(mapaDaCasa(RUA, {}, comRoof(valor)), 'p1', OWNERSHIP, RADIUS)
      expect(view.map.props, `roof=${JSON.stringify(valor)} entregou o interior`).toEqual([])
      expect(view.map.regions[0]?.room?.roof).toBe(true)
    }
  })

  it('sala de teto com menos de 3 pontos não vira anel nem silhueta (achados 14 e 15)', () => {
    const regions = [
      sala('casa', CASA, { room: COM_TETO }),
      sala('risco', [{ x: 700, y: 700 }, { x: 760, y: 700 }], { room: { shape: 'rect', name: 'nome-risco', roof: true } }),
      sala('ponto', [{ x: 800, y: 800 }], { room: { shape: 'rect', name: 'nome-ponto', roof: true } }),
    ]
    const view = filterMapForPlayer(mapaDaCasa(RUA, { regions }), 'p1', OWNERSHIP, RADIUS)
    for (const anel of [...view.blocked, ...view.roofs]) expect(anel.length).toBeGreaterThanOrEqual(3)
    expect(idsDe(view, 'regions')).toEqual(['casa'])
  })
})
