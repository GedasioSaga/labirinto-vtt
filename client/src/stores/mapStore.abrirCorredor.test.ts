import { beforeEach, describe, expect, it } from 'vitest'
import { addDoorOnWall, addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { pisoDe } from '../lib/pisos'
import { selectionOfItem } from '../lib/selectionModel'
import type { MapData, Region, Wall } from '../types/map'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'
import {
  PAREDE_TRAVADA_SEGURA_O_VAO_TEXT,
  PORTA_NO_ENCOSTE_TEXT,
  SALA_SECRETA_NAO_ABRE_TEXT,
  SALA_SECRETA_SEGURA_O_VAO_TEXT,
  SALA_TRAVADA_NAO_ABRE_TEXT,
  avisoDoCorredorAberto,
} from '../components/labels'

/**
 * "Abrir para o corredor" na store (pedido 4 de 30/09/2026): a ação que o botão
 * do painel da Sala chama. Um Ctrl+Z desfaz tudo; recusa não grava passo no
 * histórico e diz o porquê; com tudo já aberto, o clique não faz nada — nem
 * passo vazio no desfazer, nem aviso de "aberto" falso.
 */
const GRADE = 64

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** A "Sala 3" da imagem 4: retângulo 0..600 × 0..500. Arestas: 0 topo, 1 direita, 2 baixo, 3 esquerda. */
function salaCom(linhas: Wall[]): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_store_corredor', 'Corredor', 30, 30, GRADE), region, walls)
  return { ...comSala, walls: [...comSala.walls, ...linhas] }
}

function comRegiao(map: MapData, id: string, mudanca: Partial<Region>): MapData {
  return { ...map, regions: map.regions.map((r) => (r.id === id ? { ...r, ...mudanca } : r)) }
}

function comParede(map: MapData, id: string, mudanca: Partial<Wall>): MapData {
  return { ...map, walls: map.walls.map((w) => (w.id === id ? { ...w, ...mudanca } : w)) }
}

function pontas(map: MapData, id: string): number[] | undefined {
  const w = map.walls.find((p) => p.id === id)
  return w === undefined ? undefined : [w.x1, w.y1, w.x2, w.y2].map((v) => Math.round(v))
}

// Imagem 4: A entra pela borda de cima, B pela lateral esquerda — um corredor só.
const A = parede('A', -200, -200, 150, 50)
const B = parede('B', -300, -100, 50, 180)
// Corredor de 2 células chegando reto na base e entrando 40 px no chão; o mesmo pelo topo.
const C1 = parede('C1', 256, 800, 256, 460)
const C2 = parede('C2', 384, 800, 384, 460)
const T1 = parede('T1', 256, -300, 256, 40)
const T2 = parede('T2', 384, -300, 384, 40)

function carregar(map: MapData): void {
  useMapStore.setState({ map, past: [], future: [], pisoAtivo: 0 })
  useToastStore.setState({ toasts: [] })
}

function abrir(): void {
  useMapStore.getState().abrirSalaParaCorredores('sala')
}

function avisos(): string[] {
  return useToastStore.getState().toasts.map((t) => t.text)
}

/** Recusa: o mapa fica o MESMO (referência), o desfazer não ganha passo, e o aviso diz o porquê (`null` = sem aviso). */
function esperarRecusa(map: MapData, aviso: string | null): void {
  carregar(map)
  abrir()
  expect(useMapStore.getState().map).toBe(map)
  expect(useMapStore.getState().past).toHaveLength(0)
  expect(avisos()).toEqual(aviso === null ? [] : [aviso])
}

describe('mapStore.abrirSalaParaCorredores — o botão "Abrir para o corredor"', () => {
  beforeEach(() => carregar(salaCom([])))

  it('imagem 4: abre num passo só do desfazer, e o aviso diz o nome da sala e quantos corredores', () => {
    carregar(salaCom([A, B]))
    const antes = useMapStore.getState().map
    abrir()
    const depois = useMapStore.getState().map
    expect(depois).not.toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useMapStore.getState().past[0]).toBe(antes)
    // As linhas param na borda; a Sala (nome, teto, pinos) nem é copiada.
    expect(pontas(depois, 'A')).toEqual([-200, -200, 80, 0])
    expect(pontas(depois, 'B')).toEqual([-300, -100, 0, 140])
    expect(depois.regions).toBe(antes.regions)
    expect(avisos()).toEqual([avisoDoCorredorAberto('Sala 3', 1)])
    expect(avisos()[0]).toContain('Sala 3')
  })

  it('um Ctrl+Z fecha tudo de uma vez, e o refazer abre de novo', () => {
    carregar(salaCom([A, B]))
    const antes = useMapStore.getState().map
    abrir()
    const aberto = useMapStore.getState().map
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().map.walls).toEqual(antes.walls)
    useMapStore.getState().redo()
    expect(useMapStore.getState().map).toBe(aberto)
  })

  it('clicar de novo com tudo aberto: nenhum passo vazio no desfazer, nenhum aviso de "aberto"', () => {
    carregar(salaCom([A, B]))
    abrir()
    const aberto = useMapStore.getState().map
    useToastStore.setState({ toasts: [] })
    abrir()
    expect(useMapStore.getState().map).toBe(aberto)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(avisos()).toEqual([])
  })

  it('dois corredores: um passo só, e o aviso conta os dois', () => {
    carregar(salaCom([C1, C2, T1, T2]))
    abrir()
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(avisos()).toEqual([avisoDoCorredorAberto('Sala 3', 2)])
    expect(avisos()[0]).toMatch(/\b2\b/)
  })

  it('sala secreta encostada: abre o lado de cá e avisa também que a parede dela ficou de pé', () => {
    const cofre = buildRoomFromDraft('cofre', ['k0', 'k1', 'k2', 'k3'], { x: 0, y: -300 }, { x: 600, y: 0 }, undefined, undefined, 'Cofre')
    const corredor = [parede('T1', 256, -200, 256, 40), parede('T2', 384, -200, 384, 40)]
    carregar(addRoom(salaCom(corredor), { ...cofre.region, secret: true }, cofre.walls))
    abrir()
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(avisos()).toEqual([avisoDoCorredorAberto('Sala 3', 1), SALA_SECRETA_SEGURA_O_VAO_TEXT])
  })

  it('sala fora do piso em edição (Ctrl+Z depois de "Levar ao piso"): os pedaços da parede ficam no piso da sala', () => {
    carregar(salaCom([C1, C2]))
    useMapStore.setState({ selection: selectionOfItem({ kind: 'region', id: 'sala' }) })
    useMapStore.getState().moverSelecaoAoPiso(1)
    useMapStore.getState().undo()
    // A Sala voltou ao térreo, selecionada, com o piso 1 ainda na tela.
    expect(useMapStore.getState().pisoAtivo).toBe(1)
    abrir()
    const base = useMapStore.getState().map.walls.filter((w) => w.regionId === 'sala' && w.regionEdgeIndex === 2)
    expect(base).toHaveLength(2)
    expect(base.map(pisoDe)).toEqual([0, 0])
  })
})

describe('mapStore.abrirSalaParaCorredores — recusas', () => {
  it('sem corredor encostando: nada muda, nada entra no desfazer, e não há aviso', () => {
    esperarRecusa(salaCom([]), null)
  })

  it('porta onde o corredor encosta: a porta fica, e o aviso diz o porquê', () => {
    esperarRecusa(addDoorOnWall(salaCom([C1, C2]), 's2', { x: 320, y: 500 }, 64, 'normal'), PORTA_NO_ENCOSTE_TEXT)
  })

  it('parede travada no trecho, ou linha do corredor travada: o aviso da parede travada', () => {
    esperarRecusa(comParede(salaCom([C1, C2]), 's2', { locked: true }), PAREDE_TRAVADA_SEGURA_O_VAO_TEXT)
    esperarRecusa(comParede(salaCom([C1, C2]), 'C1', { locked: true }), PAREDE_TRAVADA_SEGURA_O_VAO_TEXT)
  })

  it('a SALA travada (ela ou a camada Salas): o aviso fala da sala, não de uma parede', () => {
    esperarRecusa(comRegiao(salaCom([C1, C2]), 'sala', { locked: true }), SALA_TRAVADA_NAO_ABRE_TEXT)
    esperarRecusa({ ...salaCom([C1, C2]), lockedLayers: ['salas'] }, SALA_TRAVADA_NAO_ABRE_TEXT)
  })

  it('sala secreta: não abre, e o aviso diz por quê', () => {
    esperarRecusa(comRegiao(salaCom([C1, C2]), 'sala', { secret: true }), SALA_SECRETA_NAO_ABRE_TEXT)
  })

  it('sala que não existe: nada muda e não há aviso', () => {
    carregar(salaCom([C1, C2]))
    const antes = useMapStore.getState().map
    useMapStore.getState().abrirSalaParaCorredores('nao-existe')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(avisos()).toEqual([])
  })

  it('região comum (sem `room`, só os campos obrigatórios) com o corredor encostando: nada muda e não há aviso', () => {
    const regiao: Region = {
      id: 'regiao',
      points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 500 }, { x: 0, y: 500 }],
      tag: '',
      fillColor: '#888888',
      fillPattern: 'solid',
      data: {},
    }
    const map: MapData = { ...createEmptyMap('m_regiao', 'Região', 30, 30, GRADE), regions: [regiao], walls: [C1, C2] }
    carregar(map)
    useMapStore.getState().abrirSalaParaCorredores('regiao')
    expect(useMapStore.getState().map).toBe(map)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(avisos()).toEqual([])
  })
})
