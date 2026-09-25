import { describe, expect, it } from 'vitest'
import { filterMapForPlayer, type PlayerMapView } from './fogFilter'
import { createExploration, markAll, markRings } from './exploration'
import { createEmptyMap } from './mapFactory'
import { contarComodosConhecidos } from './portasPorAtravessar'
import type { ConcealZone, DoorState, MapData, Region, RegionPoint, Wall } from '../types/map'

/**
 * PORTAS POR ATRAVESSAR no recorte do jogador (`PlayerMapView.portasPorAtravessar`):
 * a porta que ELE conhece e cujo outro lado ainda está na névoa para ELE. A
 * conta usa só o que o jogador já tem (visão de agora, explorado dele, cômodo
 * lembrado); lugar que o mestre esconde (sala secreta, zona oculta, teto
 * fechado) conta como névoa, então a marca nunca diz nada sobre ele.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function porta(extra: Partial<DoorState> = {}): DoorState {
  return { open: false, locked: false, kind: 'normal', ...extra }
}

function retangulo(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

/** Parede norte-sul partida em 3 na altura y 500; o pedaço do meio (450..500) é a porta 'pa'. Gabi fica ao sul, colada nela. */
function corredor(door: DoorState, gabi: RegionPoint = { x: 475, y: 540 }): MapData {
  return {
    ...createEmptyMap('m', 'Corredor', 20, 20, 50),
    walls: [parede('n1', 0, 500, 450, 500), parede('pa', 450, 500, 500, 500, { door }), parede('n2', 500, 500, 1000, 500)],
    tokens: [{ id: 't', characterId: null, name: 'Gabi', x: gabi.x, y: gabi.y, size: 1, image: null }],
  }
}

function sala(id: string, points: RegionPoint[], extra: Partial<Region> = {}, room: Partial<NonNullable<Region['room']>> = {}): Region {
  return { id, points, tag: '', fillColor: '#2b2b2b', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}`, ...room }, ...extra }
}

function zonaNorte(): ConcealZone {
  return { id: 'z-ala', name: 'Ala escondida', revealed: false, points: retangulo(0, 0, 1000, 490) }
}

/** Memória do jogador na planta inteira (a do host: largura e altura em px de mundo). */
function memoria(map: MapData) {
  return createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
}

/** Toda marca é de uma porta que SAIU no recorte, como porta: nenhum id novo atravessa. */
function soPortasDoRecorte(view: PlayerMapView): void {
  const portas = new Set(view.map.walls.filter((w) => w.door !== null).map((w) => w.id))
  expect(view.portasPorAtravessar.filter((id) => !portas.has(id))).toEqual([])
}

describe('fogFilter: portas por atravessar', () => {
  it('porta fechada vista de um lado só: sai marcada', () => {
    const view = filterMapForPlayer(corredor(porta()), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.find((w) => w.id === 'pa')?.door).not.toBeNull()
    expect(view.portasPorAtravessar).toEqual(['pa'])
    soPortasDoRecorte(view)
  })

  it('porta aberta com o outro lado à vista: sem marca', () => {
    const view = filterMapForPlayer(corredor(porta({ open: true })), 'p', { p: ['t'] }, 400)
    expect(view.visibleDoorIds).toEqual(['pa'])
    expect(view.portasPorAtravessar).toEqual([])
  })

  it('porta lembrada longe da ficha: marcada enquanto o outro lado não foi explorado, sem marca depois', () => {
    const map = corredor(porta(), { x: 950, y: 950 })
    const exp = memoria(map)
    markRings(exp, [retangulo(0, 510, 1000, 1000)])
    const soSul = filterMapForPlayer(map, 'p', { p: ['t'] }, 400, exp)
    expect(soSul.visibleDoorIds).toEqual([])
    expect(soSul.portasPorAtravessar).toEqual(['pa'])
    soPortasDoRecorte(soSul)

    markRings(exp, [retangulo(0, 0, 1000, 490)])
    const osDois = filterMapForPlayer(map, 'p', { p: ['t'] }, 400, exp)
    expect(osDois.map.walls.some((w) => w.id === 'pa' && w.door !== null)).toBe(true)
    expect(osDois.portasPorAtravessar).toEqual([])
  })

  it('SEGURANÇA: porta na névoa (nem vista, nem explorada) não sai, nem na marca', () => {
    const view = filterMapForPlayer(corredor(porta(), { x: 950, y: 950 }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.some((w) => w.id === 'pa')).toBe(false)
    expect(view.portasPorAtravessar).toEqual([])
    expect(JSON.stringify(view.portasPorAtravessar)).not.toContain('pa')
  })

  it('SEGURANÇA: porta secreta é parede para o jogador e nunca ganha marca', () => {
    const view = filterMapForPlayer(corredor(porta({ secret: true })), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.every((w) => w.door === null)).toBe(true)
    expect(view.portasPorAtravessar).toEqual([])
  })

  it('SEGURANÇA: zona oculta atrás da porta aberta conta como névoa (a marca não diz o que ela esconde)', () => {
    const map: MapData = { ...corredor(porta({ open: true })), concealZones: [zonaNorte()] }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.portasPorAtravessar).toEqual(['pa'])
    expect(JSON.stringify(view.portasPorAtravessar)).not.toContain('z-ala')
    soPortasDoRecorte(view)
  })

  /**
   * SALA SECRETA atrás da porta aberta. A visão enviada é montada sem a sala
   * (a tela dele mostra o lado de lá como visto), então a marca tem de sair
   * IGUAL à da mesma planta sem sala nenhuma: senão o ponto claro seria o
   * único sinal, no fio e na tela, de que o mestre esconde algo ali.
   */
  it('SEGURANÇA: sala secreta atrás da porta aberta não muda a marca (mesmo recorte de quando não há sala)', () => {
    const cofre = sala('cofre', retangulo(0, 0, 1000, 500), { secret: true }, { name: 'Cofre do Barão' })
    const semNada = filterMapForPlayer(corredor(porta({ open: true })), 'p', { p: ['t'] }, 400)
    const comSecreta = filterMapForPlayer({ ...corredor(porta({ open: true })), regions: [cofre] }, 'p', { p: ['t'] }, 400)
    // O cenário é o do vazamento: o resto do que ele recebe é idêntico nos dois casos.
    expect(comSecreta.map).toEqual(semNada.map)
    expect(comSecreta.vision).toEqual(semNada.vision)
    expect(comSecreta.concealed).toEqual(semNada.concealed)
    expect(comSecreta.portasPorAtravessar).toEqual(semNada.portasPorAtravessar)
    expect(comSecreta.portasPorAtravessar).toEqual([])
    expect(JSON.stringify(comSecreta)).not.toContain('Cofre do Barão')
  })

  it('SEGURANÇA: sala secreta COM paredes atrás da porta aberta: a marca segue a visão enviada, não a do host', () => {
    const cofre = sala('cofre', retangulo(0, 0, 1000, 500), { secret: true }, { name: 'Cofre do Barão' })
    // Parede interna da sala secreta: bloqueia a visão do host, mas não vai ao jogador.
    const paredeDoCofre = parede('cofre-w', 300, 400, 700, 400, { regionId: 'cofre' })
    const base = corredor(porta({ open: true }))
    const comSecreta = filterMapForPlayer({ ...base, regions: [cofre], walls: [...base.walls, paredeDoCofre] }, 'p', { p: ['t'] }, 400)
    const semNada = filterMapForPlayer(corredor(porta({ open: true })), 'p', { p: ['t'] }, 400)
    expect(comSecreta.map.walls.some((w) => w.id === 'cofre-w')).toBe(false)
    expect(comSecreta.vision).toEqual(semNada.vision)
    expect(comSecreta.portasPorAtravessar).toEqual(semNada.portasPorAtravessar)
  })

  it('SEGURANÇA: sala secreta com o explorado antigo de lá, ficha longe: mesma marca de quando não há sala', () => {
    const cofre = sala('cofre', retangulo(0, 0, 1000, 500), { secret: true }, { name: 'Cofre do Barão' })
    const longe = { x: 950, y: 950 }
    const semNadaMap = corredor(porta({ open: true }), longe)
    const comSecretaMap: MapData = { ...corredor(porta({ open: true }), longe), regions: [cofre] }
    // Os dois viram o corredor inteiro antes (o explorado é o mesmo e vai igual no fio).
    const expSem = memoria(semNadaMap)
    markRings(expSem, [retangulo(0, 0, 1000, 1000)])
    const expCom = memoria(comSecretaMap)
    markRings(expCom, [retangulo(0, 0, 1000, 1000)])
    const semNada = filterMapForPlayer(semNadaMap, 'p', { p: ['t'] }, 400, expSem)
    const comSecreta = filterMapForPlayer(comSecretaMap, 'p', { p: ['t'] }, 400, expCom)
    expect(comSecreta.map).toEqual(semNada.map)
    expect(comSecreta.portasPorAtravessar).toEqual(semNada.portasPorAtravessar)
    expect(comSecreta.portasPorAtravessar).toEqual([])
  })

  it('SEGURANÇA: zona oculta sobre a PORTA tira a porta e a marca', () => {
    const map: MapData = { ...corredor(porta()), concealZones: [{ id: 'z-porta', name: 'Porta', revealed: false, points: retangulo(400, 450, 550, 520) }] }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.map.walls.some((w) => w.id === 'pa' && w.door !== null)).toBe(false)
    expect(view.portasPorAtravessar).toEqual([])
  })
})

describe('contagem de cômodos conhecidos do prédio (a partir do recorte)', () => {
  /** Albergue (prédio) com quatro quartos: comum, de nome oculto, secreto e debaixo de zona oculta. */
  function albergue(): MapData {
    const base = createEmptyMap('m-alb', 'Albergue', 20, 20, 50)
    const regions: Region[] = [
      sala('alb', retangulo(0, 0, 1000, 1000), {}, { name: 'Albergue Santa Balaustrada' }),
      sala('q1', retangulo(0, 0, 400, 400), { parentId: 'alb' }, { name: 'Quarto 1' }),
      sala('q2', retangulo(600, 0, 1000, 400), { parentId: 'alb' }, { name: 'Quarto 2', nameHiddenFromPlayers: true }),
      sala('q3', retangulo(0, 600, 400, 1000), { parentId: 'alb', secret: true }, { name: 'Quarto do Segredo' }),
      sala('q4', retangulo(600, 600, 1000, 1000), { parentId: 'alb' }, { name: 'Quarto da Zona' }),
    ]
    return {
      ...base,
      regions,
      concealZones: [{ id: 'z-q4', name: 'Zona', revealed: false, points: retangulo(590, 590, 1000, 1000) }],
      tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 500, y: 500, size: 1, image: null }],
    }
  }

  it('SEGURANÇA: só conta o quarto que chegou com nome; secreto, de nome oculto e sob zona oculta ficam fora', () => {
    const map = albergue()
    const exp = memoria(map)
    markAll(exp)
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 100, exp)
    const contagem = contarComodosConhecidos(view.map.regions)
    expect([...contagem]).toEqual([['alb', 1]])
    expect(JSON.stringify(view.map)).not.toContain('Quarto do Segredo')
  })
})
