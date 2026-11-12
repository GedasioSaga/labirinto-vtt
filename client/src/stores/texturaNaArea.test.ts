import { beforeEach, describe, expect, it } from 'vitest'
import type { Drawing, MapData, PinceladaDeTextura, Wall } from '../types/map'
import { useMapStore } from './mapStore'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { consultaDoChaoPintado } from '../lib/chaoPintado'
import { lerTexturas } from '../lib/texturas'

/**
 * BALDE DE TEXTURA NA ÁREA FECHADA POR PAREDES (pedido de 12/11/2026: "coloque
 * para dar para colocar textura em lugar só com apertar sendo o limite as
 * paredes"). Um clique enche só a área; o círculo desenhado dentro não vira
 * buraco; outra textura troca; Alt + clique tira; a sala com paredes continua
 * enchendo a sala; fora de área fechada e de forma, nada.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** O L do print, em paredes soltas. */
const L: Wall[] = [
  parede('topo', 70, 70, 350, 70),
  parede('degrau-v', 350, 70, 350, 210),
  parede('degrau-h', 350, 210, 560, 210),
  parede('direita', 560, 210, 560, 490),
  parede('baixo', 560, 490, 70, 490),
  parede('esquerda', 70, 490, 70, 70),
]

/** O círculo do print: um traço desenhado dentro do L, sem fundo. */
const CIRCULO: Drawing = { id: 'circulo', kind: 'circle', cx: 300, cy: 380, radius: 60, color: '#ffffff', width: 2, filled: false, fillAlpha: 0 }

function mapaDoPrint(): MapData {
  return { ...createEmptyMap('m', 'M', 10, 10, 70), walls: L, drawings: [CIRCULO] }
}

/** A textura que a tela mostra no ponto, pelos passos que estão no mapa agora. */
function texturaEm(x: number, y: number): string | null {
  const { map } = useMapStore.getState()
  return consultaDoChaoPintado(map.texturas, map.regions, map.drawings)({ x, y })
}

const passos = (): PinceladaDeTextura[] => useMapStore.getState().map.texturas ?? []

describe('Balde de Texturas na área fechada por paredes', () => {
  beforeEach(() => {
    useMapStore.setState({ map: mapaDoPrint(), selection: [], past: [], future: [], pisoAtivo: 0 })
    useMapStore.setState({ texturaEscolhida: 'lajotas', texturaForca: 1 })
  })

  it('um clique enche só o L (o círculo não vira buraco); outra textura troca a do L; cada clique é um Ctrl+Z', () => {
    expect(useMapStore.getState().encherComTextura({ x: 150, y: 300 })).toBe('pintou')
    expect(passos()).toHaveLength(1)
    expect(passos()[0]).toMatchObject({ tipo: 'balde', textura: 'lajotas', alvo: { tipo: 'area' } })
    expect(texturaEm(150, 300)).toBe('lajotas')
    expect(texturaEm(500, 400)).toBe('lajotas')
    expect(texturaEm(300, 380)).toBe('lajotas')
    expect(texturaEm(450, 140)).toBeNull()
    expect(texturaEm(30, 30)).toBeNull()

    useMapStore.setState({ texturaEscolhida: 'areia' })
    expect(useMapStore.getState().encherComTextura({ x: 500, y: 400 })).toBe('pintou')
    expect(texturaEm(150, 300)).toBe('areia')
    expect(useMapStore.getState().past).toHaveLength(2)
    useMapStore.getState().undo()
    expect(texturaEm(150, 300)).toBe('lajotas')
  })

  it('Alt + clique tira a textura do L; fora de área fechada e sem forma embaixo, nada é gravado e o clique avisa', () => {
    useMapStore.getState().encherComTextura({ x: 150, y: 300 })
    expect(useMapStore.getState().encherComTextura({ x: 150, y: 300 }, true)).toBe('pintou')
    expect(passos().at(-1)).toMatchObject({ tipo: 'esvaziar', alvo: { tipo: 'area' } })
    expect(texturaEm(150, 300)).toBeNull()

    const antes = useMapStore.getState().map
    expect(useMapStore.getState().encherComTextura({ x: 630, y: 630 })).toBe('fora-de-forma')
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('sala com paredes: o clique continua enchendo a SALA (a textura segue a sala)', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 70, y: 70 }, { x: 350, y: 350 })
    useMapStore.setState({ map: addRoom(createEmptyMap('m', 'M', 10, 10, 70), region, walls) })
    expect(useMapStore.getState().encherComTextura({ x: 200, y: 200 })).toBe('pintou')
    expect(passos()[0]).toMatchObject({ tipo: 'balde', alvo: { tipo: 'regiao', id: 'sala' } })
  })

  it('caverna de pilares demais: o contorno passaria do que a leitura aceita; nada é gravado e o clique avisa', () => {
    // Caverna 2000x2000 de paredes soltas com ~4.000 pilares quadrados de 12 px, a cada 30 px: o contorno da área tem ~21.600 pontos.
    const walls: Wall[] = [parede('n', 20, 20, 1980, 20), parede('l', 1980, 20, 1980, 1980), parede('s', 1980, 1980, 20, 1980), parede('o', 20, 1980, 20, 20)]
    for (let x = 60; x + 12 < 1960; x += 30) {
      for (let y = 60; y + 12 < 1960; y += 30) {
        const id = `${x}-${y}`
        walls.push(parede(`${id}n`, x, y, x + 12, y), parede(`${id}l`, x + 12, y, x + 12, y + 12), parede(`${id}s`, x + 12, y + 12, x, y + 12), parede(`${id}o`, x, y + 12, x, y))
      }
    }
    useMapStore.setState({ map: { ...createEmptyMap('m', 'M', 50, 50, 40), walls } })

    const resultado = useMapStore.getState().encherComTextura({ x: 40, y: 40 })
    // O que fica gravado abre de volta igual: o mapa salvo, lido de novo, não perde passo.
    expect(lerTexturas(JSON.parse(JSON.stringify(passos()))) ?? [], 'a textura gravada some ao reabrir o mapa').toEqual(passos())
    expect(resultado).toBe('area-grande')
  })
})
