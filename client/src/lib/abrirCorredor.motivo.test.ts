// POR QUE NÃO HÁ CORREDOR (01/10/2026, "ainda não consigo ver"): com parede
// solta encostando na Sala e nenhum corredor reconhecido, a linha "Abrir para o
// corredor" aparecia nunca, e o mestre não tinha como saber o que acertar no
// desenho. `motivoSemCorredor` diz qual régua recusou; o painel mostra a linha
// desabilitada com a frase (`MOTIVO_SEM_CORREDOR`, components/labels.ts). Sem
// parede nenhuma encostando, continua `null` e a linha some.
import { describe, expect, it } from 'vitest'
import { abrirSalaParaCorredores, motivoSemCorredor } from './abrirCorredor'
import { buildFreeRoomFromPoints, buildRoomFromDraft } from './drawingFactory'
import { addRoom, createEmptyMap } from './mapFactory'
import type { MapData, Region, Wall } from '../types/map'

const GRADE = 64

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** A "Sala 3" dos outros testes: retângulo 0..600 × 0..500. Arestas: 0 topo, 1 direita, 2 baixo, 3 esquerda. */
function salaCom(linhas: Wall[]): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_motivo', 'Motivo', 30, 30, GRADE), region, walls)
  return { ...comSala, walls: [...comSala.walls, ...linhas] }
}

function motivo(map: MapData): ReturnType<typeof motivoSemCorredor> {
  return motivoSemCorredor(map, 'sala')
}

// Corredor de 2 células chegando reto na base e entrando 40 px no chão.
const C1 = parede('C1', 256, 800, 256, 460)
const C2 = parede('C2', 384, 800, 384, 460)
// Divisória solta encostada na lateral esquerda.
const Z = parede('Z', 0, 250, -300, 250)

describe('motivoSemCorredor — sem parede encostando, nada a dizer (a linha some)', () => {
  it('sala vazia, sala que não existe, e região comum: null', () => {
    expect(motivo(salaCom([]))).toBeNull()
    expect(motivoSemCorredor(salaCom([C1, C2]), 'nao-existe')).toBeNull()
    const regiao: Region = {
      id: 'regiao',
      points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 500 }, { x: 0, y: 500 }],
      tag: '',
      fillColor: '#888888',
      fillPattern: 'solid',
      data: {},
    }
    const map: MapData = { ...createEmptyMap('m_regiao', 'Região', 30, 30, GRADE), regions: [regiao], walls: [C1] }
    expect(motivoSemCorredor(map, 'regiao')).toBeNull()
  })

  it('parede longe, que atravessa a sala de lado a lado, de outro piso, ou ligada a outra sala: não encosta', () => {
    expect(motivo(salaCom([parede('longe', 1000, 1000, 1300, 1000)]))).toBeNull()
    expect(motivo(salaCom([parede('F1', 256, -100, 256, 700)]))).toBeNull()
    expect(motivo(salaCom([{ ...C1, piso: 1 }]))).toBeNull()
    expect(motivo(salaCom([{ ...C1, regionId: 'outra', regionEdgeIndex: 0 }]))).toBeNull()
  })
})

describe('motivoSemCorredor — com corredor reconhecido, nada a dizer (a conta decide)', () => {
  it('corredor por abrir, ou já aberto: null', () => {
    const map = salaCom([C1, C2])
    expect(motivo(map)).toBeNull()
    const aberto = abrirSalaParaCorredores(map, 'sala')
    expect(aberto.motivo).toBe('ok')
    expect(motivo(aberto.map)).toBeNull()
  })

  it('a divisória a mais, ao lado de um corredor reconhecido, não acende motivo', () => {
    expect(motivo(salaCom([C1, C2, Z]))).toBeNull()
  })
})

describe('motivoSemCorredor — a régua que recusou', () => {
  it('só 1 linha encostando: "uma-linha"', () => {
    expect(motivo(salaCom([C1]))).toBe('uma-linha')
    expect(motivo(salaCom([Z]))).toBe('uma-linha')
  })

  it('uma sobe do topo, a outra desce da base: "opostas"', () => {
    expect(motivo(salaCom([parede('D1', 200, 0, 200, -300), parede('D2', 200, 500, 200, 800)]))).toBe('opostas')
  })

  it('a segunda chega a 45° da primeira: "nao-paralelas"', () => {
    expect(motivo(salaCom([C1, parede('X2', 684, 800, 344, 460)]))).toBe('nao-paralelas')
  })

  it('menos de meia célula entre as duas (traço repetido): "coladas"', () => {
    expect(motivo(salaCom([C1, parede('C1b', 262, 800, 262, 460)]))).toBe('coladas')
    // A mesma parede duas vezes, uma em cima da outra.
    expect(motivo(salaCom([C1, { ...C1, id: 'C1-copia' }]))).toBe('coladas')
  })

  it('paralelas, mas mais longe que o teto da sala: "longe"', () => {
    // Sala de 600 × 500: o teto é o piso de 4 células (256 px); são 400 px.
    expect(motivo(salaCom([parede('W1', 100, 800, 100, 460), parede('W2', 500, 800, 500, 460)]))).toBe('longe')
  })

  it('quase deitadas sobre a borda (rua passando rente): "rente"', () => {
    // Paralelas, mesmo sentido, 59 px entre elas: mas encostam a 400 px uma da outra.
    expect(motivo(salaCom([parede('L1', 100, 0, -900, -150), parede('L2', 500, 0, -500, -150)]))).toBe('rente')
  })

  it('quina da sala fora das duas linhas (Sala livre com um ressalto entre elas): "canto"', () => {
    // A lateral esquerda tem um ressalto de 100 × 50 px que sai para fora; Q passa por ele.
    const pontos = [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 500 },
      { x: 0, y: 500 },
      { x: 0, y: 300 },
      { x: -100, y: 300 },
      { x: -100, y: 250 },
      { x: 0, y: 250 },
    ]
    const { region, walls } = buildFreeRoomFromPoints('sala', pontos.map((_, k) => `w${k}`), pontos, undefined, undefined, 'Sala com ressalto')
    const base = addRoom(createEmptyMap('m_ressalto', 'Ressalto', 30, 30, GRADE), region, walls)
    const map = { ...base, walls: [...base.walls, parede('P', 100, -300, 100, 0), parede('Q', -170, -70, 0, 400)] }
    expect(motivo(map)).toBe('canto')
  })

  it('com várias linhas, vale a recusa mais perto de virar corredor', () => {
    // W1-W2 só falham na largura; os pares com a divisória Z nem são paralelos.
    expect(motivo(salaCom([parede('W1', 100, 800, 100, 460), parede('W2', 500, 800, 500, 460), Z]))).toBe('longe')
  })
})
