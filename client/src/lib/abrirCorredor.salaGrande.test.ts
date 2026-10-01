// "AINDA NÃO CONSIGO VER" (01/10/2026): a linha "Abrir para o corredor" sumia no
// mapa do mestre. As Salas dele têm 20 a 40 células de lado e os corredores
// chegam com 6 a 9 células entre as duas linhas; o teto fixo de 4 células
// recusava todos. O teto agora cresce com a Sala: até metade do menor lado da
// caixa dela, nunca menos que as 4 células de antes, nunca mais que 16.
// Os números da Sala 1 e da Sala 3 são os do mapa dele (copiados, sem o arquivo).
import { describe, expect, it } from 'vitest'
import { abrirSalaParaCorredores, corredoresDaSala, motivoSemCorredor } from './abrirCorredor'
import { buildFreeRoomFromPoints, buildRoomFromDraft } from './drawingFactory'
import { addRoom, createEmptyMap } from './mapFactory'
import { hasLineOfSight, visionSegments } from './visibility'
import type { MapData, RegionPoint, Wall } from '../types/map'

const GRADE = 64

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function comLinhas(base: MapData, linhas: Wall[]): MapData {
  return { ...base, walls: [...base.walls, ...linhas] }
}

/** Sala retangular de `de` a `ate`. Arestas de `buildRoomFromDraft`: 0 topo, 1 direita, 2 baixo, 3 esquerda. */
function retangulo(de: RegionPoint, ate: RegionPoint, linhas: Wall[]): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], de, ate, undefined, undefined, 'Sala')
  return comLinhas(addRoom(createEmptyMap('m_sala_grande', 'Mapa do mestre', 150, 120, GRADE), region, walls), linhas)
}

function linhasDosCorredores(map: MapData): string[][] {
  return corredoresDaSala(map, 'sala').map((c) => c.linhas.map((l) => l.paredeId).sort())
}

/** Pedaços da sala numa aresta, como [x1, y1, x2, y2] arredondados, ordenados. */
function pedacos(map: MapData, aresta: number): number[][] {
  return map.walls
    .filter((w) => w.regionId === 'sala' && w.regionEdgeIndex === aresta)
    .map((w) => [w.x1, w.y1, w.x2, w.y2].map((v) => Math.round(v)))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function pontas(map: MapData, id: string): number[] | undefined {
  const w = map.walls.find((p) => p.id === id)
  return w === undefined ? undefined : [w.x1, w.y1, w.x2, w.y2].map((v) => Math.round(v))
}

// ─── Sala 3 do mapa: 30 × 26 células, corredor chegando na diagonal pela quina de cima à esquerda ───
const SALA_3_DE = { x: 6915.610725426702, y: 4649.274407215158 }
const SALA_3_ATE = { x: 8845.6107254267, y: 6339.274407215158 }
// Uma linha termina em cima da borda de cima, a outra em cima da borda da
// esquerda; a quina fica entre as duas. 6,3° entre elas e ~9 células de largura
// medida na boca (as linhas se abrem um pouco na chegada).
const PELO_TOPO = parede('pelo-topo', 6335.273606505386, 3776, 7295.065215866066, 4649.274407215158)
const PELA_ESQUERDA = parede('pela-esquerda', 5955.610725426702, 4019.2008260027305, 6915.610725426702, 5109.739368855875)

function sala3(linhas: Wall[]): MapData {
  return retangulo(SALA_3_DE, SALA_3_ATE, linhas)
}

// ─── Sala 1 do mapa: polígono de 8 cantos, 24 × 44 células, corredor reto chegando pela direita ───
const SALA_1: RegionPoint[] = [
  { x: 3054.26234779242, y: 1845.8531953638762 },
  { x: 3108.4124287890236, y: 1881.9532493616134 },
  { x: 3079.4390503799605, y: 4613.669015977378 },
  { x: 3031.8780164822138, y: 4679.274407215158 },
  { x: 1614.9508970710547, y: 4679.274407215156 },
  { x: 1542.7507890755815, y: 4579.99925872138 },
  { x: 1605.9258835716205, y: 1926.6452898877455 },
  { x: 1660.0759645682253, y: 1845.4201683928372 },
]
// 6,1 células entre as duas. A de cima entra 1,5 px no chão; a de baixo parou
// 12,7 px antes da borda (menos que 1/4 de célula) e é esticada até ela.
const ENTRA = parede('entra', 4765.610725426702, 2949.2008260027305, 3095.610725426702, 2949.2008260027305)
const PAROU_ANTES = parede('parou-antes', 4765.610725426702, 3339.2008260027305, 3105.610725426702, 3339.2008260027305)

function sala1(linhas: Wall[]): MapData {
  const ids = SALA_1.map((_, k) => `w${k}`)
  const { region, walls } = buildFreeRoomFromPoints('sala', ids, SALA_1, undefined, undefined, 'Sala 1')
  return comLinhas(addRoom(createEmptyMap('m_sala_1', 'Mapa do mestre', 150, 120, GRADE), region, walls), linhas)
}

describe('mapa do mestre: corredor largo em Sala grande é corredor', () => {
  it('Sala 3: as duas linhas na diagonal, uma na borda de cima e a outra na da esquerda, são UM corredor', () => {
    expect(linhasDosCorredores(sala3([PELO_TOPO, PELA_ESQUERDA]))).toEqual([['pela-esquerda', 'pelo-topo']])
  })

  it('Sala 3: o vão abre dos dois lados da quina, e as linhas (já na borda) ficam como estão', () => {
    const antes = sala3([PELO_TOPO, PELA_ESQUERDA])
    const r = abrirSalaParaCorredores(antes, 'sala')

    expect(r.motivo).toBe('ok')
    expect(r.corredores).toBe(1)
    // Topo: sai da quina até a linha de cima. Esquerda: sai da linha da esquerda até a quina.
    expect(pedacos(r.map, 0)).toEqual([[7295, 4649, 8846, 4649]])
    expect(pedacos(r.map, 3)).toEqual([[6916, 6339, 6916, 5110]])
    expect(r.map.walls.find((w) => w.id === 'pelo-topo')).toBe(PELO_TOPO)
    expect(r.map.walls.find((w) => w.id === 'pela-esquerda')).toBe(PELA_ESQUERDA)
    // Direita e base nem são tocadas; a Sala volta pela mesma referência.
    for (const id of ['s1', 's2']) expect(r.map.walls.find((w) => w.id === id)).toBe(antes.walls.find((w) => w.id === id))
    expect(r.map.regions).toBe(antes.regions)
  })

  it('Sala 3: do meio do corredor não se via o centro da sala; depois de abrir, vê', () => {
    const antes = sala3([PELO_TOPO, PELA_ESQUERDA])
    const depois = abrirSalaParaCorredores(antes, 'sala').map
    const noCorredor = { x: 6705, y: 4436 }
    const centro = { x: 7880.6, y: 5494.3 }
    expect(hasLineOfSight(noCorredor, centro, visionSegments(antes))).toBe(false)
    expect(hasLineOfSight(noCorredor, centro, visionSegments(depois))).toBe(true)
  })

  it('Sala 1 (polígono): corredor de 6 células pela direita; a linha que entrava volta à borda e a que parou antes é esticada', () => {
    const map = sala1([ENTRA, PAROU_ANTES])
    expect(linhasDosCorredores(map)).toEqual([['entra', 'parou-antes']])

    const r = abrirSalaParaCorredores(map, 'sala')
    expect(r.motivo).toBe('ok')
    expect(pontas(r.map, 'entra')).toEqual([4766, 2949, 3097, 2949])
    expect(pontas(r.map, 'parou-antes')).toEqual([4766, 3339, 3093, 3339])
    // A aresta da direita (1) perde o trecho entre as duas linhas.
    expect(pedacos(r.map, 1)).toEqual([
      [3093, 3339, 3079, 4614],
      [3108, 1882, 3097, 2949],
    ])
  })
})

describe('o teto da largura cresce com a Sala', () => {
  // Salão de 30 × 26 células: metade do menor lado = 13 células (832 px).
  const SALAO_DE = { x: 0, y: 0 }
  const SALAO_ATE = { x: 30 * GRADE, y: 26 * GRADE }
  const BASE = 26 * GRADE

  /** Duas linhas retas chegando à base do salão, `celulas` uma da outra, entrando 40 px no chão. */
  function naBaseDoSalao(celulas: number): Wall[] {
    const meio = 15 * GRADE
    const meia = (celulas * GRADE) / 2
    return [parede('V1', meio - meia, BASE + 400, meio - meia, BASE - 40), parede('V2', meio + meia, BASE + 400, meio + meia, BASE - 40)]
  }

  it('salão de 30 × 26 células: 12,5 células entre as linhas ainda é corredor; 13,5 (mais que meia sala) não é', () => {
    expect(linhasDosCorredores(retangulo(SALAO_DE, SALAO_ATE, naBaseDoSalao(12.5)))).toEqual([['V1', 'V2']])
    const largo = retangulo(SALAO_DE, SALAO_ATE, naBaseDoSalao(13.5))
    expect(corredoresDaSala(largo, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(largo, 'sala').map).toBe(largo)
  })

  it('Sala pequena (600 × 500 px) fica com as 4 células de antes, mesmo com meia sala menor que isso', () => {
    // Metade do menor lado: 250 px. As 4 células (256 px) valem por baixo.
    const pequena = (largura: number) => retangulo({ x: 0, y: 0 }, { x: 600, y: 500 }, [parede('P1', 100, 800, 100, 460), parede('P2', 100 + largura, 800, 100 + largura, 460)])
    expect(linhasDosCorredores(pequena(252))).toEqual([['P1', 'P2']])
    expect(corredoresDaSala(pequena(262), 'sala')).toEqual([])
  })

  it('nem num salão enorme passa de 16 células: 15,5 é corredor, 16,5 não é', () => {
    // 64 × 64 células: meia sala seriam 32 células; o teto absoluto corta em 16.
    const enorme = (celulas: number) => {
      const meia = (celulas * GRADE) / 2
      const lado = 64 * GRADE
      const linhas = [parede('E1', 2048 - meia, lado + 400, 2048 - meia, lado - 40), parede('E2', 2048 + meia, lado + 400, 2048 + meia, lado - 40)]
      return retangulo({ x: 0, y: 0 }, { x: lado, y: lado }, linhas)
    }
    expect(linhasDosCorredores(enorme(15.5))).toEqual([['E1', 'E2']])
    expect(corredoresDaSala(enorme(16.5), 'sala')).toEqual([])
  })
})

describe('no salão, as outras réguas continuam barrando parede sem relação', () => {
  const SALAO_DE = { x: 0, y: 0 }
  const SALAO_ATE = { x: 30 * GRADE, y: 26 * GRADE }

  it('sentidos opostos (uma sobe do topo, a outra desce da base), mesmo a 10 células: não é corredor', () => {
    const opostas = [parede('D1', 640, 0, 640, -300), parede('D2', 1280, 26 * GRADE, 1280, 26 * GRADE + 300)]
    expect(corredoresDaSala(retangulo(SALAO_DE, SALAO_ATE, opostas), 'sala')).toEqual([])
  })

  it('rua passando rente (10° da parede, 4,5 células entre as linhas): o vão de 26 células não abre', () => {
    // Paralelas e no mesmo sentido, largura dentro do teto do salão, mas encostam a 1658 px uma da outra.
    const rua = [parede('L1', 1800, 0, 815, -174), parede('L2', 142, 0, -843, -174)]
    const map = retangulo(SALAO_DE, SALAO_ATE, rua)
    expect(corredoresDaSala(map, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(map, 'sala').map).toBe(map)
  })

  /** A mesma rua, de 1000 px, saindo do topo nos mesmos dois pontos (26 células um do outro), a `graus` da parede. */
  function ruaNoTopo(graus: number): Wall[] {
    const angulo = (graus * Math.PI) / 180
    const dx = -1000 * Math.cos(angulo)
    const dy = -1000 * Math.sin(angulo)
    return [parede('L1', 1800, 0, 1800 + dx, dy), parede('L2', 142, 0, 142 + dx, dy)]
  }

  // Revisão do 41c50bf: o vão até 4× a largura só barra linha abaixo de ~14,5° da parede. Com a
  // largura presa em 4 células, o vão nunca passava de 16; com o teto crescendo com a Sala, a mesma
  // rua a 15°-25° tem 6,7 a 10,9 células de largura (abaixo das 13 do salão) e abria 26 das 30 do topo.
  it.each([15, 20, 25])('a mesma rua a %i° da parede: o vão de 26 células continua fechado, e o motivo é "rente"', (graus) => {
    const map = retangulo(SALAO_DE, SALAO_ATE, ruaNoTopo(graus))
    expect(corredoresDaSala(map, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(map, 'sala').map).toBe(map)
    expect(motivoSemCorredor(map, 'sala')).toBe('rente')
  })

  it('nem chegando de frente o vão passa de 16 células, o maior de antes: 15,5 abre, 16,5 não', () => {
    // Salão de 40 × 40 células (teto da largura: 16). As linhas chegam à base a 60° da parede,
    // com 13,4 e 14,3 células entre elas: só o tamanho do vão separa os dois casos.
    const lado = 40 * GRADE
    const aSessentaGraus = (vaoCelulas: number) => {
      const de = 10 * GRADE
      const ate = de + vaoCelulas * GRADE
      const linhas = [parede('S1', de, lado, de + 500, lado + 866), parede('S2', ate, lado, ate + 500, lado + 866)]
      return retangulo({ x: 0, y: 0 }, { x: lado, y: lado }, linhas)
    }
    expect(linhasDosCorredores(aSessentaGraus(15.5))).toEqual([['S1', 'S2']])
    const grande = aSessentaGraus(16.5)
    expect(corredoresDaSala(grande, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(grande, 'sala').map).toBe(grande)
    expect(motivoSemCorredor(grande, 'sala')).toBe('rente')
  })
})
