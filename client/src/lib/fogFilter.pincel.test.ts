import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { paintRevealBrush } from './concealBrush'
import { pieceDistance } from './floorSdf'
import type { ConcealZone, MapData, Region, RegionPoint, Token, Wall } from '../types/map'

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/**
 * PINCEL DE REVELAR no recorte do jogador: só o pedaço pintado da zona oculta
 * deixa de esconder. Mesma cena da régua e2e
 * (`e2e/task-jornada-pincel-revelar-esconder.spec.ts`): zona na metade
 * direita, Sentinela no corredor pintado, Espiao longe dele.
 */

const RAIO_VISAO = 700
const NOME_DA_ZONA = 'Ala leste secreta'

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

/** A cena com o chão da régua: uma peça de cada lado da borda da zona (a de dentro nunca sai para o jogador). */
function cenaComChao(): MapData {
  const base = cena()
  return {
    ...base,
    floor: [
      { id: 'chao-oeste', shape: { kind: 'rect', cx: 255, cy: 300, w: 490, h: 580 }, op: 'add', modifiers: {} },
      { id: 'chao-leste', shape: { kind: 'rect', cx: 745, cy: 300, w: 490, h: 580 }, op: 'add', modifiers: {} },
    ],
  }
}

const naVisao = (vision: RegionPoint[][], p: RegionPoint): boolean => vision.some((anel) => anel.length >= 3 && pointInRing(p, anel))

function cena(): MapData {
  const zona: ConcealZone = {
    id: 'zona-ala-leste',
    name: NOME_DA_ZONA,
    revealed: false,
    points: [
      { x: 500, y: 20 },
      { x: 980, y: 20 },
      { x: 980, y: 580 },
      { x: 500, y: 580 },
    ],
  }
  return {
    ...createEmptyMap('m', 'Ala do Pincel', 20, 12, 50),
    tokens: [ficha('tok-lanterna', 'Lanterna', 420, 300), ficha('tok-sentinela', 'Sentinela', 800, 450), ficha('tok-espiao', 'Espiao', 600, 180)],
    concealZones: [zona],
  }
}

const TRACO: RegionPoint[] = [
  { x: 560, y: 450 },
  { x: 700, y: 450 },
  { x: 940, y: 450 },
]
const RAIO_PINCEL = 25
const DONO = { ana: ['tok-lanterna'] }

const pintado = (mapa: MapData): MapData => paintRevealBrush(mapa, TRACO, RAIO_PINCEL, 'revelar').map
const preto = (pecas: RegionPoint[][], p: RegionPoint): boolean => pecas.some((peca) => pointInRing(p, peca))

describe('fogFilter + pincel de revelar', () => {
  it('controle: sem pincel, a zona inteira esconde as duas fichas', () => {
    const view = filterMapForPlayer(cena(), 'ana', DONO, RAIO_VISAO)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['tok-lanterna'])
    expect(preto(view.concealed, { x: 700, y: 451 })).toBe(true)
  })

  it('depois de pintar o corredor, a Sentinela sai para o jogador e o corredor deixa de ser preto', () => {
    const view = filterMapForPlayer(pintado(cena()), 'ana', DONO, RAIO_VISAO)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['tok-lanterna', 'tok-sentinela'])
    for (const x of [640, 700, 900]) expect(preto(view.concealed, { x, y: 451 }), `x=${x}`).toBe(false)
    // O resto da zona continua preto.
    for (const p of [{ x: 760, y: 150 }, { x: 900, y: 250 }, { x: 600, y: 180 }]) expect(preto(view.concealed, p)).toBe(true)
  })

  it('SEGURANÇA: com o corredor pintado, o Espiao, o nome da zona, o id dela e as células do pincel NÃO saem', () => {
    const view = filterMapForPlayer(pintado(cena()), 'ana', DONO, RAIO_VISAO)
    const fio = JSON.stringify({ map: view.map, concealed: view.concealed, vision: view.vision })
    expect(fio).not.toContain('Espiao')
    expect(fio).not.toContain('tok-espiao')
    expect(fio).not.toContain(NOME_DA_ZONA)
    expect(fio).not.toContain('zona-ala-leste')
    expect(fio).not.toContain('unveiledCells')
    expect(view.map.concealZones).toEqual([])
  })

  it('o pedaço pintado é o MESTRE mostrando: vale mesmo fora da visão do token, e só ele', () => {
    // Visão curta: Ana (420,300) não enxerga o corredor em y=450, x≥640.
    const view = filterMapForPlayer(pintado(cena()), 'ana', DONO, 150)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['tok-lanterna', 'tok-sentinela'])
    expect(preto(view.concealed, { x: 700, y: 451 })).toBe(false)
    expect(naVisao(view.vision, { x: 700, y: 451 })).toBe(true)
    // O resto da zona, e o que está nela, continua escondido.
    expect(preto(view.concealed, { x: 760, y: 150 })).toBe(true)
    expect(naVisao(view.vision, { x: 760, y: 150 })).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Espiao')
  })

  it('SEGURANÇA: com a visão curta, NADA fora do pedaço pintado passa — nem fora da zona', () => {
    const base = pintado(cena())
    const longe = { ...base, tokens: [...base.tokens, ficha('tok-orc', 'Orc', 250, 500)] }
    const view = filterMapForPlayer(longe, 'ana', DONO, 150)
    // O Orc está fora da zona e fora da visão curta de Ana: o pincel não abre o mapa todo.
    expect(view.map.tokens.map((t) => t.id)).not.toContain('tok-orc')
  })

  it('esconder de volta com o mesmo traço devolve o preto e tira a Sentinela', () => {
    const escondido = paintRevealBrush(pintado(cena()), TRACO, RAIO_PINCEL, 'esconder').map
    const view = filterMapForPlayer(escondido, 'ana', DONO, RAIO_VISAO)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['tok-lanterna'])
    expect(preto(view.concealed, { x: 700, y: 451 })).toBe(true)
  })

  it('com o chão da zona escondido, o corredor revelado entra na visão enviada (senão a névoa o pintaria de preto) e o resto da zona não', () => {
    const controle = filterMapForPlayer(cenaComChao(), 'ana', DONO, RAIO_VISAO)
    // Controle: sem pincel, o chão escondido corta a visão na borda da zona.
    expect(naVisao(controle.vision, { x: 700, y: 451 })).toBe(false)
    expect(controle.map.floor.map((f) => f.id)).toEqual(['chao-oeste'])

    const view = filterMapForPlayer(pintado(cenaComChao()), 'ana', DONO, RAIO_VISAO)
    for (const x of [640, 700, 900]) expect(naVisao(view.vision, { x, y: 451 }), `x=${x}`).toBe(true)
    for (const p of [{ x: 760, y: 150 }, { x: 900, y: 250 }, { x: 600, y: 180 }]) expect(naVisao(view.vision, p), `(${p.x},${p.y})`).toBe(false)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['tok-lanterna', 'tok-sentinela'])
  })

  it('o corredor pintado mostra o CHÃO que existe ali — só nas células pintadas, nunca a peça inteira da zona', () => {
    const view = filterMapForPlayer(pintado(cenaComChao()), 'ana', DONO, RAIO_VISAO)
    const recorte = view.map.floor.find((f) => f.id !== 'chao-oeste')
    expect(recorte, 'peça de chão sob o corredor pintado').toBeDefined()
    if (recorte === undefined) return
    // Chão sob o corredor: o jogador vê o corredor, não o fundo cinza.
    for (const x of [540, 640, 700, 900]) expect(pieceDistance(recorte, x, 451), `x=${x}`).toBeLessThanOrEqual(0)
    // SEGURANÇA: o resto do chão da zona NÃO sai (nem a forma da peça, nem as células fora do traço).
    for (const p of [{ x: 760, y: 150 }, { x: 900, y: 250 }, { x: 600, y: 180 }, { x: 700, y: 520 }])
      expect(pieceDistance(recorte, p.x, p.y), `(${p.x},${p.y})`).toBeGreaterThan(0)
    expect(recorte.shape.kind).toBe('blocos')
    expect(JSON.stringify(view.map.floor)).not.toContain('"cx":745')
  })

  it('paredes do corredor pintado saem SÓ no trecho pintado; o trecho escondido não vai no fio', () => {
    const base = pintado(cenaComChao())
    const comParedes: MapData = {
      ...base,
      walls: [
        // Dentro da zona, com a ponta oeste fora do traço (x=520 não foi pintado).
        parede('parede-norte', 520, 430, 700, 430),
        // Atravessa o corredor de cima a baixo: só o meio está pintado.
        parede('parede-cruzada', 800, 100, 800, 560),
      ],
    }
    const view = filterMapForPlayer(comParedes, 'ana', DONO, RAIO_VISAO)
    const noCorredor = (p: RegionPoint): boolean => p.y >= 420 && p.y <= 480 && p.x >= 530 && p.x <= 970
    const pontas = view.map.walls.flatMap((w) => [
      { x: w.x1, y: w.y1 },
      { x: w.x2, y: w.y2 },
    ])
    expect(view.map.walls.length).toBeGreaterThanOrEqual(2)
    for (const p of pontas) expect(noCorredor(p), `(${p.x},${p.y})`).toBe(true)
    // Cobre o corredor: a parede norte vai até x=700, a cruzada atravessa a faixa pintada.
    const norte = view.map.walls.filter((w) => w.y1 === 430 && w.y2 === 430)
    expect(Math.max(...norte.map((w) => Math.max(w.x1, w.x2)))).toBeGreaterThanOrEqual(695)
    const cruzada = view.map.walls.filter((w) => w.x1 === 800 && w.x2 === 800)
    expect(cruzada.length).toBe(1)
    // Células pintadas em x=800 vão de y=430 a y=470.
    expect(Math.abs(cruzada[0].y2 - cruzada[0].y1)).toBeGreaterThanOrEqual(30)
  })

  it('SEGURANÇA: o pincel não abre a sala "Oculta para jogadores" — ficha, prop e luz dela não saem', () => {
    const cofre: Region = {
      id: 'sala-cofre',
      points: [
        { x: 750, y: 400 },
        { x: 900, y: 400 },
        { x: 900, y: 550 },
        { x: 750, y: 550 },
      ],
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Cofre' },
      secret: true,
    }
    const base = cena()
    const mapa: MapData = {
      ...base,
      regions: [cofre],
      tokens: [ficha('tok-lanterna', 'Lanterna', 420, 300), ficha('tok-guarda', 'GuardaDoCofre', 800, 450), ficha('tok-vigia', 'Vigia', 650, 450)],
      props: [{ id: 'bau-do-cofre', src: '', x: 820, y: 470, width: 40, height: 40, linkedMapPath: null }],
      lights: [{ id: 'tocha-do-cofre', x: 850, y: 440, radius: 80, color: '#ffaa00', intensity: 1 }],
    }
    const antes = filterMapForPlayer(mapa, 'ana', DONO, RAIO_VISAO)
    expect(antes.map.tokens.map((t) => t.id)).toEqual(['tok-lanterna'])

    const view = filterMapForPlayer(pintado(mapa), 'ana', DONO, RAIO_VISAO)
    // O pincel continua revelando o corredor fora do cofre.
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['tok-lanterna', 'tok-vigia'])
    const fio = JSON.stringify(view)
    for (const segredo of ['GuardaDoCofre', 'tok-guarda', 'bau-do-cofre', 'tocha-do-cofre', 'Cofre', 'sala-cofre']) expect(fio).not.toContain(segredo)
    // O interior do cofre continua preto.
    expect(preto(view.concealed, { x: 800, y: 451 })).toBe(true)
    expect(preto(view.concealed, { x: 650, y: 451 })).toBe(false)

    // Visão curta: o que o jogador vê ali é só o que o pincel mostra — e o pincel não mostra o cofre.
    const curta = filterMapForPlayer(pintado(mapa), 'ana', DONO, 150)
    expect(curta.map.tokens.map((t) => t.id).sort()).toEqual(['tok-lanterna', 'tok-vigia'])
    expect(naVisao(curta.vision, { x: 650, y: 451 })).toBe(true)
    expect(naVisao(curta.vision, { x: 800, y: 451 })).toBe(false)
    expect(JSON.stringify(curta)).not.toContain('GuardaDoCofre')
  })

  it('o que a zona bloqueia na memória continua sendo a zona inteira (o pincel não vira explorado)', () => {
    const view = filterMapForPlayer(pintado(cena()), 'ana', DONO, RAIO_VISAO)
    expect(view.blocked).toEqual([cena().concealZones[0].points])
  })

  it('zona sobreposta que NÃO foi pintada ali continua escondendo o ponto', () => {
    const base = pintado(cena())
    const outra: ConcealZone = {
      id: 'zona-2',
      name: 'Cofre',
      revealed: false,
      points: [
        { x: 760, y: 400 },
        { x: 860, y: 400 },
        { x: 860, y: 500 },
        { x: 760, y: 500 },
      ],
    }
    const view = filterMapForPlayer({ ...base, concealZones: [...base.concealZones, outra] }, 'ana', DONO, RAIO_VISAO)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['tok-lanterna'])
    expect(preto(view.concealed, { x: 800, y: 451 })).toBe(true)
    expect(preto(view.concealed, { x: 700, y: 451 })).toBe(false)
  })
})

describe('fogFilter + pincel: forma e parede que só em parte caem no pedaço pintado', () => {
  function sala(id: string, x1: number, y1: number, x2: number, y2: number, name?: string): Region {
    const base: Region = {
      id,
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ],
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
    }
    return name === undefined ? base : { ...base, room: { shape: 'rect', name } }
  }

  it('SEGURANÇA: sala comum dentro da zona NÃO sai inteira quando o traço passa por ela — com visão longa ou curta', () => {
    const mapa: MapData = { ...cena(), regions: [sala('sala-arsenal', 520, 300, 960, 570, 'Arsenal')] }
    expect(filterMapForPlayer(mapa, 'ana', DONO, RAIO_VISAO).map.regions).toEqual([])
    for (const raio of [RAIO_VISAO, 50]) {
      const view = filterMapForPlayer(pintado(mapa), 'ana', DONO, raio)
      expect(view.map.regions, `raio ${raio}`).toEqual([])
      expect(JSON.stringify(view), `raio ${raio}`).not.toContain('Arsenal')
    }
  })

  it('SEGURANÇA: Área e desenho com área que passam do pedaço pintado não saem; os que cabem inteiros nele saem', () => {
    const mapa: MapData = {
      ...cena(),
      regions: [sala('area-grande', 520, 300, 960, 570), sala('area-no-corredor', 600, 440, 680, 460)],
      drawings: [
        { id: 'circulo-grande', kind: 'circle', cx: 740, cy: 450, radius: 100, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 },
        { id: 'circulo-no-corredor', kind: 'circle', cx: 760, cy: 450, radius: 10, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 },
        { id: 'linha-que-sai-do-corredor', kind: 'line', x1: 700, y1: 450, x2: 700, y2: 100, color: '#fff', width: 2 },
      ],
    }
    for (const raio of [RAIO_VISAO, 50]) {
      const view = filterMapForPlayer(pintado(mapa), 'ana', DONO, raio)
      expect(view.map.regions.map((r) => r.id), `raio ${raio}`).toEqual(['area-no-corredor'])
      expect(view.map.drawings.map((d) => d.id), `raio ${raio}`).toEqual(['circulo-no-corredor'])
    }
  })

  it('SEGURANÇA: parede sem porta que atravessa a zona sai SÓ fora dela e no trecho pintado, mesmo com as 3 amostras fora do escondido', () => {
    // Zona em x 500..980: de dentro dela só sai o pintado (x 625..675); os trechos
    // de fora (x 300..500 e 980..1000) saem, senão a parede seguia na visão invisível.
    const mapa: MapData = { ...cena(), walls: [parede('parede-longa', 300, 200, 1000, 200)] }
    const fora = (w: Wall): boolean => Math.max(w.x1, w.x2) <= 500 || Math.min(w.x1, w.x2) >= 980
    const semPincel = filterMapForPlayer(mapa, 'ana', DONO, RAIO_VISAO).map.walls
    expect(semPincel.map((w) => [Math.min(w.x1, w.x2) === 300, Math.max(w.x1, w.x2) === 1000])).toEqual([
      [true, false],
      [false, true],
    ])
    expect(semPincel.every(fora)).toBe(true)
    const view = filterMapForPlayer(paintRevealBrush(mapa, [{ x: 650, y: 200 }], RAIO_PINCEL, 'revelar').map, 'ana', DONO, RAIO_VISAO)
    const pintado = view.map.walls.filter((w) => !fora(w))
    expect(view.map.walls).toHaveLength(3)
    expect(pintado).toHaveLength(1)
    for (const w of view.map.walls) expect(w.id).not.toBe('parede-longa')
    for (const x of [pintado[0].x1, pintado[0].x2]) expect(x).toBeGreaterThanOrEqual(620)
    for (const x of [pintado[0].x1, pintado[0].x2]) expect(x).toBeLessThanOrEqual(680)
  })

  it('SEGURANÇA: parede e porta inteiras dentro da zona entram na visão enviada SÓ no trecho pintado', () => {
    const porta: Wall = { ...parede('porta-int', 900, 400, 900, 500), door: { open: false, locked: false, kind: 'normal' } }
    const mapa: MapData = { ...cena(), walls: [parede('w-int', 700, 360, 700, 540), porta] }
    const antes = filterMapForPlayer(mapa, 'ana', DONO, RAIO_VISAO)
    const depois = filterMapForPlayer(pintado(mapa), 'ana', DONO, RAIO_VISAO)
    // Nenhum vértice da visão sobre as partes escondidas das paredes (fora do corredor pintado y 425..475).
    for (const x of [700, 900]) {
      const ys = depois.vision.flat().filter((p) => Math.abs(p.x - x) < 0.5).map((p) => p.y)
      for (const y of ys) {
        expect(y, `x=${x}`).toBeGreaterThanOrEqual(415)
        expect(y, `x=${x}`).toBeLessThanOrEqual(485)
      }
    }
    // Fora da zona, a sombra das pontas escondidas não aparece: o raio até (1050,560)
    // passa pela ponta escondida da parede (x=700, y~416) e da porta (x=900, y~498).
    const foraDaZona = { x: 1050, y: 560 }
    expect(naVisao(antes.vision, foraDaZona)).toBe(true)
    expect(naVisao(depois.vision, foraDaZona)).toBe(true)
  })
})
