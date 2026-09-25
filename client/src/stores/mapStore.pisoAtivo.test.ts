import { beforeEach, describe, expect, it } from 'vitest'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import { comFichaNoPiso, escadaDaFicha, mapaDoPiso, pisoDe } from '../lib/pisos'
import { selectionOfItem } from '../lib/selectionModel'
import type { FloorPiece, Light, MapData, Region, Stair, Token, Wall } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PISOS NA MESMA CENA — o mestre CONSTRÓI o 1º piso pelo editor. Cenário do
 * revisor: a escada leva ao piso 1, o jogador sobe e caía numa tela vazia,
 * atravessando as paredes do térreo, porque nada do que o mestre desenha
 * nascia fora do térreo. Com o piso em edição (`pisoAtivo`), o que o mestre
 * cria nasce no piso que ele está vendo.
 */
function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, name: string): Region {
  const points = [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 900 },
    { x: 100, y: 900 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name } }
}

const paredesDaSala = (prefixo: string, regionId: string): Wall[] => [
  wall(`${prefixo}-n`, 100, 100, 900, 100, { regionId }),
  wall(`${prefixo}-l`, 900, 100, 900, 900, { regionId }),
  wall(`${prefixo}-s`, 900, 900, 100, 900, { regionId }),
  wall(`${prefixo}-o`, 100, 900, 100, 100, { regionId }),
]

const lia: Token = { id: 'lia', characterId: null, name: 'Lia', x: 500, y: 500, size: 1, image: null }
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 500, y1: 450, x2: 500, y2: 550 }], stepWidth: 40 }

function terreo(): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 25, 25, 40),
    regions: [sala('hall', 'Hall de entrada')],
    walls: paredesDaSala('hall', 'hall'),
    tokens: [lia],
    stairs: [ESCADA],
  }
}

const store = () => useMapStore.getState()
const atual = (): MapData => store().map

beforeEach(() => {
  store().loadMap(terreo())
})

describe('mapStore — o mestre constrói outro piso pelo editor', () => {
  it('cenário do revisor: escada ao 1º piso, o mestre desenha lá, e o jogador que sobe vê o 1º piso e esbarra nas paredes dele', () => {
    // O mestre liga a escada ao 1º piso e vai editar o outro lado dela.
    store().setStairPisos('escada', { levaAoPiso: 1 })
    store().setPisoAtivo(1)
    expect(store().pisoAtivo).toBe(1)

    // Desenha o 1º piso com as ferramentas de sempre: sala (com paredes), parede solta, chão e luz.
    store().addRoom(sala('biblioteca', 'Biblioteca'), paredesDaSala('bib', 'biblioteca'))
    store().addWall(wall('divisoria', 300, 100, 300, 900))
    const piece: FloorPiece = { id: 'tapete', op: 'add', shape: { kind: 'rect', cx: 200, cy: 200, w: 80, h: 80 }, modifiers: {} }
    store().addFloorPiece(piece)
    const luz: Light = { id: 'lustre', x: 400, y: 400, radius: 200, color: '#ffffff', intensity: 1 }
    store().addLight(luz)

    const map = atual()
    expect(map.regions.find((r) => r.id === 'biblioteca')?.piso).toBe(1)
    expect(map.walls.filter((w) => w.regionId === 'biblioteca').map(pisoDe)).toEqual([1, 1, 1, 1])
    expect(map.walls.find((w) => w.id === 'divisoria')?.piso).toBe(1)
    expect(map.floor.find((p) => p.id === 'tapete')?.piso).toBe(1)
    expect(map.lights.find((l) => l.id === 'lustre')?.piso).toBe(1)
    // O térreo continua térreo: nada do que já existia mudou de piso.
    expect(map.regions.find((r) => r.id === 'hall')).not.toHaveProperty('piso')
    expect(map.walls.filter((w) => w.regionId === 'hall').every((w) => !('piso' in w))).toBe(true)

    // O jogador encosta na escada e sobe (o host grava `token.piso`).
    const escada = escadaDaFicha(map, lia)
    expect(escada).toEqual({ stairId: 'escada', destino: 1 })
    const noAlto = comFichaNoPiso(map, 'lia', 1)
    const view = filterMapForPlayer(noAlto, 'p1', { p1: ['lia'] }, 700)
    const recebeu = JSON.stringify(view.map)
    expect(recebeu).toContain('Biblioteca')
    expect(recebeu).not.toContain('Hall de entrada')
    const paredesVistas = view.map.walls.map((w) => w.id)
    expect(paredesVistas).toContain('divisoria')
    expect(paredesVistas).toContain('bib-l')
    expect(paredesVistas.filter((id) => id.startsWith('hall-'))).toEqual([])

    // Lá em cima a divisória do 1º piso barra; a parede do térreo não existe.
    store().loadMap(noAlto)
    store().moveToken('lia', 200, 500)
    expect(atual().tokens.find((t) => t.id === 'lia')).toMatchObject({ x: 500, y: 500, piso: 1 })
  })

  it('no térreo, nada nasce com piso: o arquivo de um mapa sem pisos fica igual ao de sempre', () => {
    store().addWall(wall('nova', 0, 0, 40, 0))
    expect(atual().walls.find((w) => w.id === 'nova')).not.toHaveProperty('piso')
    expect(store().pisoAtivo).toBe(0)
  })

  it('trocar de piso limpa a seleção e não entra no desfazer; outro mapa volta ao térreo', () => {
    store().setSelection(selectionOfItem({ kind: 'token', id: 'lia' }))
    store().setPisoAtivo(2)
    expect(store().selection).toHaveLength(0)
    expect(store().past).toHaveLength(0)
    store().setPisoAtivo(Number.NaN)
    expect(store().pisoAtivo).toBe(2)
    store().loadMap(terreo())
    expect(store().pisoAtivo).toBe(0)
  })

  it('"Levar ao piso" da seleção: a sala leva as paredes; um Ctrl+Z desfaz; o editor vai junto com a seleção', () => {
    store().setSelection(selectionOfItem({ kind: 'region', id: 'hall' }))
    store().moverSelecaoAoPiso(1)
    expect(store().pisoAtivo).toBe(1)
    expect(store().selection).toHaveLength(1)
    expect(atual().regions[0].piso).toBe(1)
    expect(atual().walls.map(pisoDe)).toEqual([1, 1, 1, 1])
    expect(mapaDoPiso(atual(), 0).walls).toHaveLength(0)
    expect(store().past).toHaveLength(1)
    store().undo()
    expect(atual().walls.every((w) => !('piso' in w))).toBe(true)
  })

  it('a ficha que o painel põe em outro piso leva o editor junto (senão ela some, selecionada)', () => {
    store().setTokenPiso('lia', 3)
    expect(store().pisoAtivo).toBe(3)
    expect(mapaDoPiso(atual(), 3).tokens.map((t) => t.id)).toEqual(['lia'])
  })
})
