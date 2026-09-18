import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Pin, Prop, Region, Stair, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { filterMapForPlayer, playerBlockedRings } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * TETO DE CONSTRUÇÃO, lado da REDE. O que esta bateria mede é uma coisa só: o
 * que o jogador RECEBE. Pintar um polígono opaco por cima e mandar o conteúdo
 * junto seria reprovado aqui, porque a asserção é sobre o pacote, não sobre a
 * tela — `JSON.stringify` do recorte, como no resto de `fogFilter.test.ts`.
 *
 * Geometria (px de mundo, mapa 1000x1000 de grade 40, sem parede nenhuma para
 * que só o teto possa esconder o que esconde):
 *   casa      100..400 x 100..400, Sala com `room.roof`;
 *   interior  mobília, prop, escada, pino, luz e token alheio, todos dentro;
 *   FORA      (250, 600) — 200 px abaixo da casa, com linha de visão livre
 *             para dentro dela. É de propósito: se o teto só escondesse o que
 *             uma parede já esconde, ele não seria teto nenhum;
 *   DENTRO    (250, 300) — dentro do polígono, abaixo da mobília.
 */
const CASA: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
/** Sub-sala inteira dentro da casa, com uma parede própria. */
const QUARTO: Region['points'] = [
  { x: 150, y: 150 },
  { x: 250, y: 150 },
  { x: 250, y: 250 },
  { x: 150, y: 250 },
]
const FORA = { x: 250, y: 600 }
const DENTRO = { x: 250, y: 300 }
/** Lanterna que alcança a casa inteira de fora: sem teto, tudo lá dentro sai. */
const RADIUS = 700
const OWNERSHIP = { p1: ['heroi'] }

function sala(id: string, points: Region['points'], extra: Partial<Region> = {}): Region {
  return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}` }, ...extra }
}

function mapaDaCasa(roof: boolean | undefined, heroi: { x: number; y: number }, extra: Partial<MapData> = {}): MapData {
  const casa = sala('casa', CASA, { room: { shape: 'rect', name: 'nome-casa', roof } })
  const mobilia: Drawing = {
    id: 'mobilia-de-dentro',
    kind: 'rect',
    x: 150,
    y: 150,
    w: 200,
    h: 100,
    color: '#ff00ff',
    width: 4,
    filled: true,
    fillAlpha: 1,
  }
  const prop: Prop = { id: 'prop-de-dentro', x: 300, y: 300, width: 40, height: 40, src: 'barril-de-dentro.png', linkedMapPath: null }
  const escada: Stair = {
    id: 'escada-de-dentro',
    shape: 'straight',
    direction: 'up',
    segments: [{ x1: 320, y1: 150, x2: 320, y2: 220 }],
    stepWidth: 30,
  }
  const pino: Pin = { id: 'pino-de-dentro', kind: 'exclamacao', x: 200, y: 350, description: 'segredo-do-pino', image: null }
  const tokens: Token[] = [
    { id: 'heroi', characterId: null, name: 'nome-heroi', x: heroi.x, y: heroi.y, size: 1, image: null },
    { id: 'vilao-de-dentro', characterId: null, name: 'nome-vilao', x: 350, y: 350, size: 1, image: null },
  ]
  return {
    ...createEmptyMap('m-teto', 'Casa', 1000, 1000, 40),
    regions: [casa],
    drawings: [mobilia],
    props: [prop],
    stairs: [escada],
    pins: [pino],
    lights: [{ id: 'luz-de-dentro', x: 250, y: 200, radius: 100, color: '#fff', intensity: 1 }],
    markers: [{ id: 'marca-de-dentro', cx: 180, cy: 380, w: 4, h: 4, rotation: 0, color: '#000' }],
    tokens,
    ...extra,
  }
}

/** Tudo que é INTERIOR da casa — nenhum destes ids pode aparecer no pacote com o teto fechado. */
const INTERIOR_IDS = [
  'mobilia-de-dentro',
  'prop-de-dentro',
  'escada-de-dentro',
  'pino-de-dentro',
  'luz-de-dentro',
  'marca-de-dentro',
  'vilao-de-dentro',
]

describe('filterMapForPlayer — teto de construção', () => {
  it('SEGURANÇA: com o token FORA, o jogador recebe a silhueta e NADA do interior', () => {
    const { map: out } = filterMapForPlayer(mapaDaCasa(true, FORA), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(out)

    // A construção sai, marcada: é ela que o jogador pinta chapada.
    const casa = out.regions.find((r) => r.id === 'casa')
    expect(casa?.room?.roof).toBe(true)
    expect(casa?.points).toEqual(CASA)

    // E nada de dentro atravessa. Não é "escondido no render": está AUSENTE.
    for (const id of INTERIOR_IDS) expect(json).not.toContain(id)
    expect(json).not.toContain('segredo-do-pino')
    expect(out.tokens.map((t) => t.id)).toEqual(['heroi'])

    // O nome é anotação do mestre sobre o que tem lá dentro: também não sai.
    expect(json).not.toContain('nome-casa')
    expect(casa?.room?.name).toBe('')
  })

  it('o token do jogador DENTRO do polígono abre o teto e entrega o interior', () => {
    const { map: out } = filterMapForPlayer(mapaDaCasa(true, DENTRO), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(out)

    for (const id of INTERIOR_IDS) expect(json).toContain(id)
    // Teto aberto some com a marca: a Sala volta a desenhar como sempre desenhou.
    expect(out.regions.find((r) => r.id === 'casa')?.room?.roof).toBeUndefined()
    expect(out.regions.find((r) => r.id === 'casa')?.room?.name).toBe('nome-casa')
  })

  it('SEGURANÇA: o jogador SAIU e o teto fecha de novo, inclusive sobre o que ele já tinha visto', () => {
    // 1. Ele entra: o recorte entrega o interior e a memória guarda o que viu.
    const dentro = filterMapForPlayer(mapaDaCasa(true, DENTRO), 'p1', OWNERSHIP, RADIUS)
    const explorado = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(explorado, dentro.vision, dentro.blocked)
    expect(JSON.stringify(dentro.map)).toContain('mobilia-de-dentro')

    // 2. Ele sai. A memória continua lá — e o teto vence a memória.
    const { map: out } = filterMapForPlayer(mapaDaCasa(true, FORA), 'p1', OWNERSHIP, RADIUS, explorado)
    const json = JSON.stringify(out)
    for (const id of INTERIOR_IDS) expect(json).not.toContain(id)
    // E a construção continua saindo: o prédio não some da rua por causa disso.
    expect(out.regions.find((r) => r.id === 'casa')?.room?.roof).toBe(true)
  })

  it('CONTROLE: Sala SEM teto (`roof` ausente) continua entregando o interior', () => {
    const { map: out } = filterMapForPlayer(mapaDaCasa(undefined, FORA), 'p1', OWNERSHIP, RADIUS)
    const json = JSON.stringify(out)
    for (const id of INTERIOR_IDS) expect(json).toContain(id)
    expect(out.regions.find((r) => r.id === 'casa')?.room?.roof).toBeUndefined()
    expect(out.regions.find((r) => r.id === 'casa')?.room?.name).toBe('nome-casa')

    // `roof: false` explícito é o mesmo que ausente.
    const desligado = filterMapForPlayer(mapaDaCasa(false, FORA), 'p1', OWNERSHIP, RADIUS).map
    expect(JSON.stringify(desligado)).toContain('mobilia-de-dentro')
  })

  describe('sub-sala dentro de sala com teto', () => {
    const paredeDoQuarto: Wall = {
      id: 'parede-do-quarto',
      x1: 250,
      y1: 150,
      x2: 250,
      y2: 250,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: 'quarto-de-dentro',
      regionEdgeIndex: 1,
    }
    /** Parede solta com o traço INTEIRO dentro da casa: é mobília, não é o prédio. */
    const paredeSolta: Wall = {
      id: 'parede-solta-de-dentro',
      x1: 300,
      y1: 300,
      x2: 380,
      y2: 300,
      blocksLight: true,
      blocksMove: true,
      door: null,
    }
    /** Parede da PRÓPRIA casa: fica na borda do polígono e é o contorno do prédio. */
    const paredeDaCasa: Wall = {
      id: 'parede-da-casa',
      x1: 100,
      y1: 100,
      x2: 400,
      y2: 100,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: 'casa',
      regionEdgeIndex: 0,
    }

    function comQuarto(heroi: { x: number; y: number }): MapData {
      const base = mapaDaCasa(true, heroi)
      return {
        ...base,
        regions: [...base.regions, sala('quarto-de-dentro', QUARTO, { parentId: 'casa' })],
        walls: [paredeDaCasa, paredeDoQuarto, paredeSolta],
      }
    }

    it('SEGURANÇA: com o teto fechado, a sub-sala e as paredes de dentro somem; a parede da casa fica', () => {
      const { map: out } = filterMapForPlayer(comQuarto(FORA), 'p1', OWNERSHIP, RADIUS)
      const json = JSON.stringify(out)
      expect(json).not.toContain('quarto-de-dentro')
      expect(json).not.toContain('parede-do-quarto')
      expect(json).not.toContain('parede-solta-de-dentro')
      expect(out.walls.map((w) => w.id)).toEqual(['parede-da-casa'])
      expect(out.regions.map((r) => r.id)).toEqual(['casa'])
    })

    it('com o token dentro, a sub-sala e as paredes de dentro voltam', () => {
      const { map: out } = filterMapForPlayer(comQuarto(DENTRO), 'p1', OWNERSHIP, RADIUS)
      expect(out.regions.map((r) => r.id).sort()).toEqual(['casa', 'quarto-de-dentro'])
      expect(out.walls.map((w) => w.id).sort()).toEqual(['parede-da-casa', 'parede-do-quarto', 'parede-solta-de-dentro'])
    })
  })

  it('"Revelar planta" não abre teto: a sala com teto entra nas áreas bloqueadas do mapa', () => {
    const anelis = playerBlockedRings(mapaDaCasa(true, FORA))
    expect(anelis).toContainEqual(CASA)
    expect(playerBlockedRings(mapaDaCasa(undefined, FORA))).toEqual([])
  })
})
