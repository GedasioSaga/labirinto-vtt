import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { paintRevealBrush } from './concealBrush'
import type { ConcealZone, MapData, RegionPoint, Token } from '../types/map'

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
    // O chão de dentro da zona continua sem sair: o corredor aparece pelo buraco, não pelo polígono do chão.
    expect(view.map.floor.map((f) => f.id)).toEqual(['chao-oeste'])
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['tok-lanterna', 'tok-sentinela'])
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
