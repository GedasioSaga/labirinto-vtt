/**
 * O QUE SÓ PASSA PELA SALA SECRETA E A ÁGUA NA VISÃO (provas da 0.5.62,
 * FX-NEVOA-062). A sala secreta fechada é chão aberto para o jogador: o rio, o
 * pincel do Ambiente e a faixa de Texturas que a atravessam saem inteiros (F-N04,
 * F-N08, F-N09); o que mora nela continua escondido. A água conta como Chão,
 * mas a visão enviada não conta a água que ele não recebe: a da camada Chão
 * escondida dele e a secreta (F-N13).
 */
import { describe, expect, it } from 'vitest'
import type {
  Agua,
  FloorPiece,
  MapData,
  PinceladaDeAmbiente,
  PinceladaDeTextura,
  QuadradoAlto,
  RampaDeBarranco,
  Region,
  RegionPoint,
  RiscoDeBarranco,
  Token,
  TracoDePenhasco,
  Wall,
} from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { mapForImageExport } from './mapImageExport'
import { areaPassaPorParede } from './texturas'

const GRID = 50
const POSSE: Record<string, string[]> = { ana: ['ryoko'] }
const VISAO = 10 * GRID
const SEM_O_MESTRE = { grid: false, masterOnly: false }

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const ficha = (x: number, y: number): Token => ({ id: 'ryoko', characterId: null, name: 'Ryoko', x: x * GRID, y: y * GRID, size: 1, image: null })
const lago = (id: string, pontos: RegionPoint[], extra: Partial<Agua> = {}): Agua => ({ id, tipo: 'lago', pontos, cor: '#2f7f8f', ...extra })

/** A sala secreta fechada S (12..16 x 6..11), com as quatro paredes dela. */
function salaSecreta(): { regions: Region[]; walls: Wall[] } {
  const pts = rect(12, 6, 16, 11)
  const region: Region = { id: 'S', points: pts, tag: 'region', fillColor: '#4d2f05', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Cofre' }, secret: true }
  const walls = pts.map((a, i): Wall => {
    const b = pts[(i + 1) % pts.length]
    return { id: `sw${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null, regionId: 'S', regionEdgeIndex: i }
  })
  return { regions: [region], walls }
}

/** Rio, pincel de neve e faixa de Texturas atravessando S; poço dentro dela. A ficha a oeste da sala. */
function cena(comSala: boolean): MapData {
  const rio: Agua = { id: 'rio', tipo: 'rio', pontos: [P(8, 3), P(13, 7), P(15, 9), P(18, 12), P(24, 14)], cor: '#2f6f9f', largura: 1.5 }
  const neve: PinceladaDeAmbiente = { id: 'neve', tipo: 'pincel', forca: 1, raio: GRID, pontos: [P(8, 8.5), P(14, 8.5), P(20, 8.5)], efeito: 'neve' }
  // O lado de baixo da faixa corre a 0,2 casa da parede sul de S por 4 das 28 casas dela.
  const faixa: PinceladaDeTextura = { id: 'faixa', tipo: 'balde', textura: 'lajotas', forca: 1, alvo: { tipo: 'area', pontos: rect(1, 9.6, 29, 10.8) } }
  const sala = comSala ? salaSecreta() : { regions: [], walls: [] }
  return {
    ...createEmptyMap('m', 'M', 30, 20, GRID),
    ...sala,
    aguas: comSala ? [rio, lago('poco', rect(13, 7, 15, 9))] : [rio],
    ambientePintado: [neve],
    texturas: [faixa],
    tokens: [ficha(10, 8.5)],
  }
}

const dentroDeS = (x: number, y: number): boolean => x > 12 * GRID && x < 16 * GRID && y > 6 * GRID && y < 11 * GRID
const pontosEmS = (xy: readonly number[]): number => xy.filter((_, i) => i % 2 === 0 && dentroDeS(xy[i], xy[i + 1])).length

describe('o que só passa pela sala secreta fechada sai inteiro', () => {
  it('F-N04 e F-N08: o rio e a neve pintada passam por dentro da sala; o poço que mora nela não sai', () => {
    const recorte = filterMapForPlayer(cena(true), 'ana', POSSE, VISAO).map
    const rio = recorte.aguas?.find((a) => a.id === 'rio')
    const trechos = rio?.recorte?.trechos ?? []
    expect(trechos.reduce((n, t) => n + pontosEmS(t.pontos), 0), 'o rio dentro da sala').toBeGreaterThan(0)
    expect(recorte.aguas?.some((a) => a.id === 'poco'), 'o poço da sala').toBe(false)
    const neve = (recorte.ambientePintado ?? []).flatMap((t) => t.pontos)
    expect(neve.some((p) => dentroDeS(p.x, p.y)), 'a neve dentro da sala').toBe(true)
  })

  it('F-N09: a faixa de Texturas que atravessa a sala, rente à parede dela, vai ao jogador e à imagem como sem a sala', () => {
    const comSala = cena(true)
    // A causa: o lado de baixo corre rente à parede sul da sala, e a régua de antes (só as paredes escondidas) segurava a faixa.
    const faixa = rect(1, 9.6, 29, 10.8)
    expect(areaPassaPorParede(faixa, comSala.walls, GRID), 'régua sem as paredes do mapa').toBe(true)
    expect(areaPassaPorParede(faixa, comSala.walls, GRID, comSala.walls), 'o lado não é feito de parede').toBe(false)
    expect(filterMapForPlayer(comSala, 'ana', POSSE, VISAO).map.texturas?.map((t) => t.id), 'jogador').toEqual(['faixa'])
    expect(filterMapForPlayer(cena(false), 'ana', POSSE, VISAO).map.texturas?.map((t) => t.id), 'controle sem a sala').toEqual(['faixa'])
    expect(mapForImageExport(comSala, SEM_O_MESTRE).texturas?.map((t) => t.id), 'imagem').toEqual(['faixa'])
  })
})

describe('o barranco e o penhasco que só passam pela sala secreta fechada (FX-BARRANCO-062)', () => {
  /** Barranco e penhasco que atravessam S; com a sala, também o que mora nela. */
  function terreno(comSala: boolean): MapData {
    const quadrados: QuadradoAlto[] = []
    // Platô 5x3 ao norte de S: a última fila (y = 6) tem 2 quadrados dentro dela (x 12 e 13).
    for (let x = 9; x <= 13; x += 1) for (let y = 4; y <= 6; y += 1) quadrados.push({ x, y, alturas: ['medio'] })
    const riscos: RiscoDeBarranco[] = [{ id: 'barr-passa', pontos: [P(6, 7.5), P(10, 7.6), P(14, 7.8), P(18, 8), P(21, 8)], lado: 1 }]
    const rampas: RampaDeBarranco[] = [{ id: 'rampa-passa', x: 14 * GRID, y: 7.8 * GRID }]
    const penhascos: TracoDePenhasco[] = [{ id: 'pen-passa', modo: 'riscar', raio: 0.4 * GRID, pontos: [P(6, 9.5), P(10, 9.5), P(14, 9.5), P(18, 9.5)] }]
    if (comSala) {
      riscos.push({ id: 'barr-mora', pontos: [P(13, 10), P(15.5, 10.4)], lado: 1 })
      quadrados.push({ x: 13, y: 8, alturas: ['medio'] }, { x: 14, y: 8, alturas: ['medio'] })
      rampas.push({ id: 'rampa-mora', x: 14 * GRID, y: 10.2 * GRID })
      penhascos.push({ id: 'pen-mora', modo: 'riscar', raio: 0.4 * GRID, pontos: [P(14.5, 7), P(15, 8.5)] })
    }
    return {
      ...createEmptyMap('m', 'M', 30, 20, GRID),
      ...(comSala ? salaSecreta() : { regions: [], walls: [] }),
      barranco: { quadrado: GRID, origem: { x: 0, y: 0 }, riscos, quadrados, rampas },
      penhascos,
      tokens: [ficha(10, 8.5)],
    }
  }

  it('o barranco que atravessa a sala sai como sem a sala (risco, platô e rampa); o que mora nela não sai', () => {
    const com = filterMapForPlayer(terreno(true), 'ana', POSSE, VISAO).map.barranco
    const sem = filterMapForPlayer(terreno(false), 'ana', POSSE, VISAO).map.barranco
    expect(sem?.quadrados.some((c) => c.y === 6 && c.x >= 12), 'controle: o platô entra na sala').toBe(true)
    expect(com, 'com a sala = sem a sala').toEqual(sem)
    expect(com?.riscos.map((r) => r.id), 'o risco passa inteiro').toEqual(['barr-passa~0'])
    expect(com?.rampas.map((r) => r.id), 'a rampa da sala que só passa').toEqual(['rampa-passa'])
  })

  it('o penhasco que atravessa a sala sai como sem a sala; o que mora nela não sai', () => {
    const com = filterMapForPlayer(terreno(true), 'ana', POSSE, VISAO).map.penhascos
    const sem = filterMapForPlayer(terreno(false), 'ana', POSSE, VISAO).map.penhascos
    expect(com?.map((t) => t.id), 'só o que passa, inteiro').toEqual(['pen-passa~0'])
    expect(com).toEqual(sem)
  })
})

describe('a água na visão enviada ao jogador', () => {
  const chao: FloorPiece = { id: 'chao', shape: { kind: 'rect', cx: 7.5 * GRID, cy: 10 * GRID, w: 15 * GRID, h: 20 * GRID }, op: 'add', modifiers: {} }
  const comAgua = (aguas: Agua[], extra: Partial<MapData> = {}): MapData => ({ ...createEmptyMap('m', 'M', 30, 20, GRID), floor: [chao], aguas, tokens: [ficha(13, 10)], ...extra })
  // O lago encostado na borda leste do Chão: contado como Chão, a visão passaria por cima dele.
  const lagoAoLado = (extra: Partial<Agua> = {}): Agua => lago('lago', rect(15, 7, 20, 13), extra)

  it('F-N13: com a camada Chão escondida dos jogadores, a água não recorta a visão dele (igual à cena sem água)', () => {
    const escondida: Partial<MapData> = { versaoDasCamadas: 2, ocultasDoJogador: ['chao'] }
    const com = filterMapForPlayer(comAgua([lagoAoLado()], escondida), 'ana', POSSE, VISAO)
    const sem = filterMapForPlayer(comAgua([], escondida), 'ana', POSSE, VISAO)
    expect(com.map.aguas, 'a água não sai').toBeUndefined()
    expect(com.vision).toEqual(sem.vision)
  })

  it('F-N13: a água secreta não abre a visão dele por cima dela; a comum abre (controle)', () => {
    const sem = filterMapForPlayer(comAgua([]), 'ana', POSSE, VISAO).vision
    expect(filterMapForPlayer(comAgua([lagoAoLado({ secret: true })]), 'ana', POSSE, VISAO).vision, 'secreta').toEqual(sem)
    expect(filterMapForPlayer(comAgua([lagoAoLado()]), 'ana', POSSE, VISAO).vision, 'comum').not.toEqual(sem)
  })
})
