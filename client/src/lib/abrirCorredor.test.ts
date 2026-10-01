// ABRIR A SALA PARA O CORREDOR — pedido 4 de 30/09/2026 (imagem 4): as duas
// linhas de um corredor entram na "Sala 3", uma pela quina de cima e a outra
// pela lateral esquerda, e riscam o chão dela. O mestre quer corredor e sala
// numa estrutura só: a parede da sala abre entre as duas linhas e as linhas
// param na borda.
import { describe, expect, it } from 'vitest'
import { abrirSalaParaCorredores, bloqueioDaSala, corredoresDaSala } from './abrirCorredor'
import { abrirTrecho } from './abrirVao'
import { addDoorOnWall, addOpeningOnWall, addRoom, createEmptyMap } from './mapFactory'
import { buildRegularPolygonRoomFromDraft, buildRoomFromDraft } from './drawingFactory'
import { findTokenPath } from './collision'
import { hasLineOfSight, visionSegments } from './visibility'
import { syncLinkedWallsToPoints } from './roomLink'
import type { DoorState, MapData, Region, Wall } from '../types/map'

const GRADE = 64

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** A "Sala 3": retângulo 0..600 × 0..500. Arestas de `buildRoomFromDraft`: 0 topo, 1 direita, 2 baixo, 3 esquerda. */
function salaCom(linhas: Wall[], grade = GRADE): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_corredor', 'Corredor', 30, 30, grade), region, walls)
  return { ...comSala, walls: [...comSala.walls, ...linhas] }
}

function comRegiao(map: MapData, id: string, mudanca: Partial<Region>): MapData {
  return { ...map, regions: map.regions.map((r) => (r.id === id ? { ...r, ...mudanca } : r)) }
}

function comParede(map: MapData, id: string, mudanca: Partial<Wall>): MapData {
  return { ...map, walls: map.walls.map((w) => (w.id === id ? { ...w, ...mudanca } : w)) }
}

/** Pedaços da sala numa aresta, como [x1, y1, x2, y2] arredondados, ordenados. */
function pedacos(map: MapData, aresta: number, salaId = 'sala'): number[][] {
  return map.walls
    .filter((w) => w.regionId === salaId && w.regionEdgeIndex === aresta)
    .map((w) => [w.x1, w.y1, w.x2, w.y2].map((v) => Math.round(v)))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function pontas(map: MapData, id: string): number[] | undefined {
  const w = map.walls.find((p) => p.id === id)
  return w === undefined ? undefined : [w.x1, w.y1, w.x2, w.y2].map((v) => Math.round(v))
}

function linhasDosCorredores(map: MapData): string[][] {
  return corredoresDaSala(map, 'sala').map((c) => c.linhas.map((l) => l.paredeId).sort())
}

// Imagem 4: A entra pela borda de cima (cruza em (80, 0)), B pela esquerda (cruza em (0, 140)).
const A = parede('A', -200, -200, 150, 50)
const B = parede('B', -300, -100, 50, 180)
// Corredor de 2 células chegando reto na aresta de baixo e entrando 40 px no chão.
const C1 = parede('C1', 256, 800, 256, 460)
const C2 = parede('C2', 384, 800, 384, 460)
// O mesmo, chegando pelo topo.
const T1 = parede('T1', 256, -300, 256, 40)
const T2 = parede('T2', 384, -300, 384, 40)
const PORTA: DoorState = { open: false, locked: false, kind: 'normal' }

describe('corredoresDaSala — conta CORREDORES (par de linhas), não paredes', () => {
  it('imagem 4: as duas linhas que entram pela quina são UM corredor', () => {
    expect(linhasDosCorredores(salaCom([A, B]))).toEqual([['A', 'B']])
  })

  it('sala sem nada encostando: lista vazia', () => {
    expect(corredoresDaSala(salaCom([]), 'sala')).toEqual([])
  })

  it('sala que não existe: lista vazia', () => {
    expect(corredoresDaSala(salaCom([A, B]), 'nao-existe')).toEqual([])
  })

  it('ignora parede que atravessa a sala de lado a lado, de outro piso, ou ligada a outra sala', () => {
    const atravessam = [parede('F1', 256, -100, 256, 700), parede('F2', 384, -100, 384, 700)]
    expect(corredoresDaSala(salaCom(atravessam), 'sala')).toEqual([])
    expect(corredoresDaSala(salaCom([{ ...C1, piso: 1 }, { ...C2, piso: 1 }]), 'sala')).toEqual([])
    const daOutra = [C1, C2].map((w) => ({ ...w, regionId: 'outra', regionEdgeIndex: 0 }))
    expect(corredoresDaSala(salaCom(daOutra), 'sala')).toEqual([])
  })
})

describe('parede solta sem relação NÃO vira corredor (nunca abre um lado inteiro)', () => {
  it('duas divisórias em lados opostos — uma sobe do topo, a outra desce da base — não abrem nada', () => {
    const naBorda = salaCom([parede('V1', 200, 0, 200, -300), parede('V2', 200, 500, 200, 800)])
    expect(corredoresDaSala(naBorda, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(naBorda, 'sala').motivo).toBe('nada')
    const entrando = salaCom([parede('V1', 200, -300, 200, 100), parede('V2', 260, 800, 260, 400)])
    expect(corredoresDaSala(entrando, 'sala')).toEqual([])
  })

  it('linhas paralelas longe demais uma da outra (mais de 4 células) não são corredor', () => {
    const map = salaCom([parede('W1', 100, 800, 100, 460), parede('W2', 500, 800, 500, 460)])
    expect(corredoresDaSala(map, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(map, 'sala').map).toBe(map)
  })

  it('linhas que não são quase paralelas não são corredor', () => {
    // A segunda chega a 45° da primeira.
    const map = salaCom([C1, parede('X2', 684, 800, 344, 460)])
    expect(corredoresDaSala(map, 'sala')).toEqual([])
  })

  it('linhas coladas (menos de meia célula, traço repetido) não são corredor', () => {
    expect(corredoresDaSala(salaCom([C1, parede('C1b', 262, 800, 262, 460)]), 'sala')).toEqual([])
  })

  it('a divisória solta encostada em outro lado da sala fica de fora do corredor', () => {
    const divisoria = parede('Z', 0, 250, -300, 250)
    const map = salaCom([C1, C2, divisoria])
    expect(linhasDosCorredores(map)).toEqual([['C1', 'C2']])
    const r = abrirSalaParaCorredores(map, 'sala')
    expect(r.corredores).toBe(1)
    expect(r.map.walls.find((w) => w.id === 'Z')).toBe(divisoria)
  })

  it('rua passando rente à parede (linhas quase deitadas sobre a borda) não abre a lateral', () => {
    // Paralelas, mesmo sentido, 59 px entre elas: mas encostam a 400 px uma da outra.
    const map = salaCom([parede('L1', 100, 0, -900, -150), parede('L2', 500, 0, -500, -150)])
    expect(corredoresDaSala(map, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(map, 'sala').map).toBe(map)
  })

  it('parede que corta o canto da sala por dentro antes de bater na borda não é linha de corredor', () => {
    // Q sai da lateral direita, atravessa o chão e sai pelo topo; P é uma linha boa ao lado.
    const map = salaCom([parede('P', 500, 0, 500, -300), parede('Q', 600, 100, 491, -200)])
    expect(corredoresDaSala(map, 'sala')).toEqual([])
  })

  it('terceira linha paralela perto do corredor: abre só o par mais estreito', () => {
    const terceira = parede('Z2', 550, 800, 550, 500)
    const r = abrirSalaParaCorredores(salaCom([C1, C2, terceira]), 'sala')
    expect(r.corredores).toBe(1)
    expect(pedacos(r.map, 2)).toEqual([
      [256, 500, 0, 500],
      [600, 500, 384, 500],
    ])
    expect(r.map.walls.find((w) => w.id === 'Z2')).toBe(terceira)
  })
})

describe('abrirSalaParaCorredores — o vão e as linhas', () => {
  it('imagem 4: o vão passa pela quina de cima à esquerda, as linhas param na borda e a sala é a mesma', () => {
    const antes = salaCom([A, B])
    const r = abrirSalaParaCorredores(antes, 'sala')

    expect(r.motivo).toBe('ok')
    expect(r.corredores).toBe(1)
    expect(r.salaSecretaPoupada).toBe(false)
    // As linhas mantêm id e a ponta de fora; a de dentro volta até a borda.
    expect(pontas(r.map, 'A')).toEqual([-200, -200, 80, 0])
    expect(pontas(r.map, 'B')).toEqual([-300, -100, 0, 140])
    // Topo e esquerda perdem o trecho em volta da quina (0, 0); os pedaços seguem ligados à aresta.
    expect(pedacos(r.map, 0)).toEqual([[80, 0, 600, 0]])
    expect(pedacos(r.map, 3)).toEqual([[0, 500, 0, 140]])
    // Direita e base nem são tocadas.
    for (const id of ['s1', 's2']) expect(r.map.walls.find((w) => w.id === id)).toBe(antes.walls.find((w) => w.id === id))
    // Nome, teto, cômodo, pinos: a Region nem é copiada.
    expect(r.map.regions).toBe(antes.regions)
  })

  it('corredor reto no meio da base: a aresta vira 2 pedaços ligados e o vão tem a largura do corredor', () => {
    const r = abrirSalaParaCorredores(salaCom([C1, C2]), 'sala')
    expect(r.motivo).toBe('ok')
    expect(pedacos(r.map, 2)).toEqual([
      [256, 500, 0, 500],
      [600, 500, 384, 500],
    ])
    expect(pontas(r.map, 'C1')).toEqual([256, 800, 256, 500])
    expect(pontas(r.map, 'C2')).toEqual([384, 800, 384, 500])
  })

  it('ponta que parou 10 px antes da borda (grade 50) é esticada até ela e o vão abre', () => {
    const map = salaCom([parede('D1', 250, 800, 250, 510), parede('D2', 350, 800, 350, 510)], 50)
    const r = abrirSalaParaCorredores(map, 'sala')
    expect(r.motivo).toBe('ok')
    expect(pontas(r.map, 'D1')).toEqual([250, 800, 250, 500])
    expect(pontas(r.map, 'D2')).toEqual([350, 800, 350, 500])
    expect(pedacos(r.map, 2)).toEqual([
      [250, 500, 0, 500],
      [600, 500, 350, 500],
    ])
  })

  it('ponta a 20 px da borda (grade 50, mais que 1/4 de célula) não encosta: nada abre', () => {
    const map = salaCom([parede('D1', 250, 800, 250, 520), parede('D2', 350, 800, 350, 520)], 50)
    expect(corredoresDaSala(map, 'sala')).toEqual([])
    expect(abrirSalaParaCorredores(map, 'sala').map).toBe(map)
  })

  it('pontas exatamente na borda: as linhas voltam as mesmas, só a sala ganha o vão', () => {
    const E1 = parede('E1', 256, 800, 256, 500)
    const E2 = parede('E2', 384, 800, 384, 500)
    const r = abrirSalaParaCorredores(salaCom([E1, E2]), 'sala')
    expect(r.motivo).toBe('ok')
    expect(r.map.walls.find((w) => w.id === 'E1')).toBe(E1)
    expect(r.map.walls.find((w) => w.id === 'E2')).toBe(E2)
    expect(pedacos(r.map, 2)).toEqual([
      [256, 500, 0, 500],
      [600, 500, 384, 500],
    ])
  })

  it('dois corredores em lados opostos: dois vãos, cada par com o seu', () => {
    const r = abrirSalaParaCorredores(salaCom([C1, C2, T1, T2]), 'sala')
    expect(r.motivo).toBe('ok')
    expect(r.corredores).toBe(2)
    expect(pedacos(r.map, 0)).toEqual([
      [0, 0, 256, 0],
      [384, 0, 600, 0],
    ])
    expect(pedacos(r.map, 2)).toEqual([
      [256, 500, 0, 500],
      [600, 500, 384, 500],
    ])
    expect(pontas(r.map, 'T1')).toEqual([256, -300, 256, 0])
  })

  it('divisórias soltas intercaladas entre dois corredores não estragam nenhum dos dois', () => {
    // Em volta da sala: T1, T2 (topo), Y (direita), C2, C1 (base), Z (esquerda).
    const divisorias = [parede('Y', 600, 250, 900, 250), parede('Z', 0, 250, -300, 250)]
    const map = salaCom([T1, T2, C1, C2, ...divisorias])
    expect(linhasDosCorredores(map)).toEqual([
      ['T1', 'T2'],
      ['C1', 'C2'],
    ])
    const r = abrirSalaParaCorredores(map, 'sala')
    expect(r.corredores).toBe(2)
    for (const d of divisorias) expect(r.map.walls.find((w) => w.id === d.id)).toBe(d)
  })

  it('polilinha da parede livre: o "L" que a linha fazia dentro do chão é apagado', () => {
    const G1 = parede('G1', 256, 800, 256, 440)
    const dobra = parede('G1b', 256, 440, 200, 440)
    const desce = parede('G1c', 200, 440, 200, 300)
    const solta = parede('I', 100, 100, 150, 100)
    const r = abrirSalaParaCorredores(salaCom([G1, dobra, desce, C2, solta]), 'sala')
    expect(r.motivo).toBe('ok')
    expect(pontas(r.map, 'G1')).toEqual([256, 800, 256, 500])
    expect(r.map.walls.some((w) => w.id === 'G1b' || w.id === 'G1c')).toBe(false)
    // Parede de dentro que não continua a linha fica.
    expect(r.map.walls.find((w) => w.id === 'I')).toBe(solta)
  })

  it('na bifurcação (duas paredes saindo da mesma ponta) a corrente para: nada de dentro é apagado', () => {
    const J1 = parede('J1', 256, 440, 200, 440)
    const J2 = parede('J2', 256, 440, 320, 440)
    const r = abrirSalaParaCorredores(salaCom([parede('G1', 256, 800, 256, 440), J1, J2, C2]), 'sala')
    expect(r.motivo).toBe('ok')
    expect(r.map.walls.find((w) => w.id === 'J1')).toBe(J1)
    expect(r.map.walls.find((w) => w.id === 'J2')).toBe(J2)
  })

  it('sala redonda (24 lados): um corredor só, o vão passa pela emenda das arestas e os pedaços seguem ligados', () => {
    const ids = Array.from({ length: 24 }, (_, i) => `r${i}`)
    const { region, walls } = buildRegularPolygonRoomFromDraft('sala', ids, { x: 500, y: 500 }, { x: 800, y: 500 }, 24, undefined, undefined, 'Sala redonda')
    const base = addRoom(createEmptyMap('m_redonda', 'Redonda', 30, 30, GRADE), region, walls)
    const antes = { ...base, walls: [...base.walls, parede('K1', 1100, 460, 700, 460), parede('K2', 1100, 540, 700, 540)] }

    expect(linhasDosCorredores(antes)).toEqual([['K1', 'K2']])
    const r = abrirSalaParaCorredores(antes, 'sala')
    expect(r.motivo).toBe('ok')

    // O vértice 0 (800, 500) fica no meio do vão: as arestas 23 e 0 perdem o trecho em volta dele.
    const a23 = r.map.walls.filter((w) => w.regionEdgeIndex === 23)
    const a0 = r.map.walls.filter((w) => w.regionEdgeIndex === 0)
    expect(a23).toHaveLength(1)
    expect(a0).toHaveLength(1)
    expect(a23[0].x2).toBeCloseTo(794.73, 1)
    expect(a23[0].y2).toBeCloseTo(460, 5)
    expect(a0[0].x1).toBeCloseTo(794.73, 1)
    expect(a0[0].y1).toBeCloseTo(540, 5)
    const k1 = r.map.walls.find((w) => w.id === 'K1')
    expect(k1?.x2).toBeCloseTo(794.73, 1)
    // A visão entra pelo vão até o centro.
    expect(hasLineOfSight({ x: 900, y: 500 }, { x: 500, y: 500 }, visionSegments(antes))).toBe(false)
    expect(hasLineOfSight({ x: 900, y: 500 }, { x: 500, y: 500 }, visionSegments(r.map))).toBe(true)
  })
})

describe('recusas — o mapa volta pela MESMA referência (quem chama não grava histórico)', () => {
  it('sem corredor: "nada"', () => {
    const map = salaCom([])
    expect(abrirSalaParaCorredores(map, 'sala')).toEqual({ map, motivo: 'nada', corredores: 0, salaSecretaPoupada: false })
    expect(abrirSalaParaCorredores(map, 'sala').map).toBe(map)
    expect(abrirSalaParaCorredores(map, 'nao-existe').map).toBe(map)
  })

  it('porta da sala dentro do trecho: "porta", e a porta não some', () => {
    const map = addDoorOnWall(salaCom([C1, C2]), 's2', { x: 320, y: 500 }, 64, 'normal')
    const r = abrirSalaParaCorredores(map, 'sala')
    expect(r.motivo).toBe('porta')
    expect(r.map).toBe(map)
    expect(r.corredores).toBe(0)
  })

  it('porta numa parede solta em cima da borda, no trecho (o corte a levaria junto): "porta"', () => {
    const map = salaCom([C1, C2, parede('PS', 300, 500, 340, 500, { door: PORTA })])
    const r = abrirSalaParaCorredores(map, 'sala')
    expect(r.motivo).toBe('porta')
    expect(r.map).toBe(map)
  })

  it('parede da sala travada no trecho, ou camada de paredes travada: "travada"', () => {
    const travada = comParede(salaCom([C1, C2]), 's2', { locked: true })
    expect(abrirSalaParaCorredores(travada, 'sala')).toMatchObject({ motivo: 'travada', map: travada })
    const camada: MapData = { ...salaCom([C1, C2]), lockedLayers: ['paredes'] }
    expect(abrirSalaParaCorredores(camada, 'sala')).toMatchObject({ motivo: 'travada', map: camada })
  })

  it('linha do corredor travada ou com porta, que precisaria encurtar: "travada" / "porta" (não "sem par")', () => {
    const travada = comParede(salaCom([C1, C2]), 'C1', { locked: true })
    expect(linhasDosCorredores(travada)).toEqual([['C1', 'C2']])
    expect(abrirSalaParaCorredores(travada, 'sala')).toMatchObject({ motivo: 'travada', map: travada })
    const comPorta = comParede(salaCom([C1, C2]), 'C1', { door: PORTA })
    expect(abrirSalaParaCorredores(comPorta, 'sala')).toMatchObject({ motivo: 'porta', map: comPorta })
  })

  it('linha travada que já está na borda não impede: ela não muda', () => {
    const E1 = parede('E1', 256, 800, 256, 500, { locked: true })
    const r = abrirSalaParaCorredores(salaCom([E1, parede('E2', 384, 800, 384, 500)]), 'sala')
    expect(r.motivo).toBe('ok')
    expect(r.map.walls.find((w) => w.id === 'E1')).toBe(E1)
  })

  it('sala travada, ou camada de salas travada: "travada"', () => {
    const travada = comRegiao(salaCom([C1, C2]), 'sala', { locked: true })
    expect(abrirSalaParaCorredores(travada, 'sala')).toMatchObject({ motivo: 'travada', map: travada })
    const camada: MapData = { ...salaCom([C1, C2]), lockedLayers: ['salas'] }
    expect(abrirSalaParaCorredores(camada, 'sala')).toMatchObject({ motivo: 'travada', map: camada })
  })

  it('sala secreta, ou dentro de sala oculta: "secreta"', () => {
    const secreta = comRegiao(salaCom([C1, C2]), 'sala', { secret: true })
    expect(abrirSalaParaCorredores(secreta, 'sala')).toMatchObject({ motivo: 'secreta', map: secreta })

    const casa = buildRoomFromDraft('casa', ['c0', 'c1', 'c2', 'c3'], { x: -100, y: -100 }, { x: 700, y: 600 }, undefined, undefined, 'Casa')
    const dentro = comRegiao(addRoom(salaCom([C1, C2]), { ...casa.region, hidden: true }, []), 'sala', { parentId: 'casa' })
    expect(abrirSalaParaCorredores(dentro, 'sala')).toMatchObject({ motivo: 'secreta', map: dentro })
  })
})

describe('bloqueioDaSala — o motivo do botão desabilitado', () => {
  it('sala comum: nenhum; secreta: "secreta"; travada: "travada"', () => {
    const map = salaCom([C1, C2])
    const sala = (m: MapData): Region => {
      const r = m.regions.find((x) => x.id === 'sala')
      if (r === undefined) throw new Error('fixture sem a sala')
      return r
    }
    expect(bloqueioDaSala(map, sala(map))).toBeNull()
    const secreta = comRegiao(map, 'sala', { secret: true })
    expect(bloqueioDaSala(secreta, sala(secreta))).toBe('secreta')
    const travada = comRegiao(map, 'sala', { locked: true })
    expect(bloqueioDaSala(travada, sala(travada))).toBe('travada')
  })
})

describe('depois de abrir', () => {
  it('abrir de novo devolve "nada" pelo MESMO mapa, e a sala não conta mais corredor (o botão some)', () => {
    const primeira = abrirSalaParaCorredores(salaCom([A, B]), 'sala')
    expect(primeira.motivo).toBe('ok')
    expect(corredoresDaSala(primeira.map, 'sala')).toEqual([])
    const segunda = abrirSalaParaCorredores(primeira.map, 'sala')
    expect(segunda.motivo).toBe('nada')
    expect(segunda.map).toBe(primeira.map)
    expect(segunda.corredores).toBe(0)
  })

  it('redimensionar a sala mantém o vão na mesma posição relativa', () => {
    const aberto = abrirSalaParaCorredores(salaCom([C1, C2]), 'sala').map
    const velhos = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 500 }, { x: 0, y: 500 }]
    const novos = velhos.map((p) => ({ x: p.x * 2, y: p.y * 2 }))
    const walls = syncLinkedWallsToPoints(aberto.walls, 'sala', velhos, novos)
    expect(pedacos({ ...aberto, walls }, 2)).toEqual([
      [512, 1000, 0, 1000],
      [1200, 1000, 768, 1000],
    ])
  })

  it('visão: do corredor não se via o centro da sala; depois de abrir, vê', () => {
    const antes = salaCom([A, B])
    const depois = abrirSalaParaCorredores(antes, 'sala').map
    const noCorredor = { x: -100, y: -50 }
    const centro = { x: 300, y: 250 }
    expect(hasLineOfSight(noCorredor, centro, visionSegments(antes))).toBe(false)
    expect(hasLineOfSight(noCorredor, centro, visionSegments(depois))).toBe(true)
  })

  it('colisão: a ficha do corredor não chegava ao centro da sala; depois de abrir, chega', () => {
    const antes = salaCom([A, B])
    const depois = abrirSalaParaCorredores(antes, 'sala').map
    const noCorredor = { x: -100, y: -50 }
    const centro = { x: 300, y: 250 }
    expect(findTokenPath(noCorredor, centro, antes.walls, GRADE)).toBeNull()
    expect(findTokenPath(noCorredor, centro, depois.walls, GRADE)).not.toBeNull()
  })

  it('sala secreta encostada: a parede dela fica de pé (e avisa), e o segundo clique NÃO a derruba', () => {
    const cofre = buildRoomFromDraft('cofre', ['k0', 'k1', 'k2', 'k3'], { x: 0, y: -300 }, { x: 600, y: 0 }, undefined, undefined, 'Cofre')
    const antes = addRoom(salaCom([parede('T1', 256, -200, 256, 40), parede('T2', 384, -200, 384, 40)]), { ...cofre.region, secret: true }, cofre.walls)
    const paredeDoCofre = antes.walls.find((w) => w.id === 'k2')

    const primeira = abrirSalaParaCorredores(antes, 'sala')
    expect(primeira.motivo).toBe('ok')
    expect(primeira.salaSecretaPoupada).toBe(true)
    expect(pedacos(primeira.map, 0)).toEqual([
      [0, 0, 256, 0],
      [384, 0, 600, 0],
    ])
    expect(primeira.map.walls.find((w) => w.id === 'k2')).toEqual(paredeDoCofre)

    expect(corredoresDaSala(primeira.map, 'sala')).toEqual([])
    const segunda = abrirSalaParaCorredores(primeira.map, 'sala')
    expect(segunda.motivo).toBe('nada')
    expect(segunda.map.walls.find((w) => w.id === 'k2')).toEqual(paredeDoCofre)
  })

  it('vão já aberto, linhas ainda entrando e sala secreta encostada: só as linhas mudam, a parede secreta fica', () => {
    // Sem parede da sala no trecho, `abrirTrecho` cortaria a do cofre (o único lado que sobrou).
    const cofre = buildRoomFromDraft('cofre', ['k0', 'k1', 'k2', 'k3'], { x: 0, y: -300 }, { x: 600, y: 0 }, undefined, undefined, 'Cofre')
    const comCofre = addRoom(salaCom([T1, T2]), { ...cofre.region, secret: true }, cofre.walls)
    // O vão do editor (só a parede clicada): a da sala some no trecho, a do cofre fica.
    const vaoAberto = addOpeningOnWall(comCofre, 's0', { x: 320, y: 0 }, 128)
    expect(pedacos(vaoAberto, 0)).toEqual([
      [0, 0, 256, 0],
      [384, 0, 600, 0],
    ])
    const paredeDoCofre = vaoAberto.walls.find((w) => w.id === 'k2')

    const r = abrirSalaParaCorredores(vaoAberto, 'sala')
    expect(r.motivo).toBe('ok')
    expect(pontas(r.map, 'T1')).toEqual([256, -300, 256, 0])
    expect(r.map.walls.find((w) => w.id === 'k2')).toBe(paredeDoCofre)
  })
})

describe('abrirTrecho — o corte entre dois pontos da borda (lib/abrirVao.ts)', () => {
  it('tira o trecho da parede que passa pelos dois pontos, e os pedaços seguem ligados', () => {
    const r = abrirTrecho(salaCom([]), { x: 256, y: 500 }, { x: 384, y: 500 })
    expect(r.travadaNoCaminho).toBe(false)
    expect(pedacos(r.map, 2)).toEqual([
      [256, 500, 0, 500],
      [600, 500, 384, 500],
    ])
  })

  it('sem parede no trecho, ou com os dois pontos iguais: o MESMO mapa', () => {
    const map = salaCom([])
    expect(abrirTrecho(map, { x: 1000, y: 1000 }, { x: 1100, y: 1000 }).map).toBe(map)
    expect(abrirTrecho(map, { x: 300, y: 500 }, { x: 300, y: 500 }).map).toBe(map)
  })
})
