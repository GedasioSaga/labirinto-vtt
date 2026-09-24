// ABRIR VÃO / DESABAR entre dois prédios encostados, valendo dos dois lados.
//
// Dois prédios lado a lado: a divisa em x=512 é DUAS paredes na mesma linha —
// a aresta leste do Armazém e a aresta oeste da Oficina, cada uma vinculada à
// própria Sala. Abrir o vão só numa delas (o que `addOpeningOnWall` faz) deixa
// a outra inteira por baixo: a ficha continua barrada.
import { describe, expect, it } from 'vitest'
import { abrirVaoDosDoisLados, desabarParede, paredeDoGesto } from './abrirVao'
import { addOpeningOnWall, addRoom, createEmptyMap } from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'
import { findTokenPath } from './collision'
import type { MapData, Wall } from '../types/map'

const GRADE = 64

/** Armazém (0..512) e Oficina (512..1024), mesma altura (0..320). Arestas de
 *  `buildRoomFromDraft`: 0 topo, 1 direita, 2 baixo, 3 esquerda. */
function doisPredios(): MapData {
  const armazem = buildRoomFromDraft('armazem', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 0 }, { x: 512, y: 320 })
  const oficina = buildRoomFromDraft('oficina', ['o0', 'o1', 'o2', 'o3'], { x: 512, y: 0 }, { x: 1024, y: 320 })
  const base = createEmptyMap('m_predios', 'Dois prédios', 40, 20, GRADE)
  return addRoom(addRoom(base, armazem.region, armazem.walls), oficina.region, oficina.walls)
}

/** Pedaços que estão na divisa x=512, ordenados de cima para baixo. */
function divisa(map: MapData): Wall[] {
  return map.walls
    .filter((w) => Math.abs(w.x1 - 512) < 0.01 && Math.abs(w.x2 - 512) < 0.01)
    .sort((a, b) => Math.min(a.y1, a.y2) - Math.min(b.y1, b.y2))
}

function trecho(w: Wall): [number, number] {
  return [Math.round(Math.min(w.y1, w.y2)), Math.round(Math.max(w.y1, w.y2))]
}

function passa(map: MapData, de: { x: number; y: number }, para: { x: number; y: number }): boolean {
  return findTokenPath(de, para, map.walls, GRADE) !== null
}

const DENTRO_DO_ARMAZEM = { x: 480, y: 160 }
const DENTRO_DA_OFICINA = { x: 544, y: 160 }

describe('abrirVaoDosDoisLados — um clique abre a passagem entre dois prédios', () => {
  it('o cenário é mesmo de duas paredes sobrepostas, e a ficha não passa', () => {
    const map = doisPredios()
    expect(divisa(map).map((w) => w.regionId).sort()).toEqual(['armazem', 'oficina'])
    expect(passa(map, DENTRO_DO_ARMAZEM, DENTRO_DA_OFICINA)).toBe(false)
  })

  it('abrir só a parede clicada (o vão do editor) não basta: a do outro lado segura a ficha', () => {
    const map = addOpeningOnWall(doisPredios(), 'a1', { x: 512, y: 160 }, GRADE)
    expect(passa(map, DENTRO_DO_ARMAZEM, DENTRO_DA_OFICINA)).toBe(false)
  })

  it('o vão sai nas DUAS paredes, no mesmo trecho, e a ficha passa', () => {
    const map = abrirVaoDosDoisLados(doisPredios(), 'a1', { x: 512, y: 160 }, GRADE).map

    const pedacos = divisa(map)
    expect(pedacos).toHaveLength(4)
    const doArmazem = pedacos.filter((w) => w.regionId === 'armazem').map(trecho)
    const daOficina = pedacos.filter((w) => w.regionId === 'oficina').map(trecho)
    expect(doArmazem).toEqual([
      [0, 128],
      [192, 320],
    ])
    expect(daOficina).toEqual(doArmazem)
    expect(passa(map, DENTRO_DO_ARMAZEM, DENTRO_DA_OFICINA)).toBe(true)
  })

  it('clicar na parede da Oficina abre o mesmo vão (o gesto vale de qualquer lado)', () => {
    const map = abrirVaoDosDoisLados(doisPredios(), 'o3', { x: 512, y: 160 }, GRADE).map
    expect(passa(map, DENTRO_DA_OFICINA, DENTRO_DO_ARMAZEM)).toBe(true)
    expect(divisa(map).map(trecho)).toEqual([
      [0, 128],
      [0, 128],
      [192, 320],
      [192, 320],
    ])
  })

  it('o resto da divisa continua parede e os pedaços mantêm o vínculo com a própria Sala', () => {
    const map = abrirVaoDosDoisLados(doisPredios(), 'a1', { x: 512, y: 160 }, GRADE).map
    expect(passa(map, { x: 480, y: 32 }, { x: 544, y: 32 })).toBe(false)
    for (const w of divisa(map)) {
      expect(w.door).toBeNull()
      expect(w.regionEdgeIndex).toBe(w.regionId === 'armazem' ? 1 : 3)
    }
    // As outras 6 paredes não foram tocadas.
    expect(map.walls.filter((w) => Math.abs(w.x1 - 512) >= 0.01 || Math.abs(w.x2 - 512) >= 0.01)).toHaveLength(6)
  })

  it('parede na mesma linha mas longe do clique fica inteira', () => {
    const longe: Wall = { id: 'longe', x1: 512, y1: 900, x2: 512, y2: 1100, blocksLight: true, blocksMove: true, door: null }
    const antes = { ...doisPredios(), walls: [...doisPredios().walls, longe] }
    const map = abrirVaoDosDoisLados(antes, 'a1', { x: 512, y: 160 }, GRADE).map
    expect(map.walls.find((w) => w.id === 'longe')).toBe(longe)
  })

  it('parede inexistente devolve o MESMO mapa', () => {
    const map = doisPredios()
    expect(abrirVaoDosDoisLados(map, 'nao-existe', { x: 0, y: 0 }, GRADE)).toEqual({ map, salaSecretaPoupada: false, travadaNoCaminho: false })
    expect(abrirVaoDosDoisLados(map, 'nao-existe', { x: 0, y: 0 }, GRADE).map).toBe(map)
  })
})

describe('paredeDoGesto — qual parede o clique direito pegou', () => {
  it('acha a parede sob o clique, dentro da folga', () => {
    expect(paredeDoGesto(doisPredios(), { x: 250, y: 4 }, 8)?.id).toBe('a0')
  })

  it('fora de parede: nenhuma (o clique direito segue sendo o do navegador)', () => {
    expect(paredeDoGesto(doisPredios(), { x: 250, y: 160 }, 8)).toBeNull()
  })

  it('parede de camada escondida ou travada, ou parede travada, não entra no gesto', () => {
    const map = doisPredios()
    expect(paredeDoGesto({ ...map, hiddenLayers: ['paredes'] }, { x: 250, y: 0 }, 8)).toBeNull()
    expect(paredeDoGesto({ ...map, lockedLayers: ['paredes'] }, { x: 250, y: 0 }, 8)).toBeNull()
    const travada = { ...map, walls: map.walls.map((w) => (w.id === 'a0' ? { ...w, locked: true } : w)) }
    expect(paredeDoGesto(travada, { x: 250, y: 0 }, 8)).toBeNull()
    // A mesma parede, sem trava, entra: os nulos acima são da trava.
    expect(paredeDoGesto(map, { x: 250, y: 0 }, 8)?.id).toBe('a0')
  })
})

describe('desabarParede — a parede cai inteira, dos dois lados', () => {
  it('some a divisa inteira: as duas paredes, e a ficha passa em qualquer altura', () => {
    const map = desabarParede(doisPredios(), 'a1').map
    expect(divisa(map)).toHaveLength(0)
    expect(map.walls).toHaveLength(6)
    expect(passa(map, { x: 480, y: 32 }, { x: 544, y: 32 })).toBe(true)
    expect(passa(map, { x: 480, y: 288 }, { x: 544, y: 288 })).toBe(true)
  })

  it('a parede do outro lado que é mais comprida perde só o trecho encostado', () => {
    // Oficina mais alta (0..640): só 0..320 encosta no Armazém.
    const armazem = buildRoomFromDraft('armazem', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 0 }, { x: 512, y: 320 })
    const oficina = buildRoomFromDraft('oficina', ['o0', 'o1', 'o2', 'o3'], { x: 512, y: 0 }, { x: 1024, y: 640 })
    const base = createEmptyMap('m_desigual', 'Desigual', 40, 20, GRADE)
    const antes = addRoom(addRoom(base, armazem.region, armazem.walls), oficina.region, oficina.walls)

    const map = desabarParede(antes, 'a1').map

    const sobra = divisa(map)
    expect(sobra).toHaveLength(1)
    expect(sobra[0].regionId).toBe('oficina')
    expect(trecho(sobra[0])).toEqual([320, 640])
    // Mesmo sentido da aresta original da Oficina (de baixo para cima na esquerda).
    expect(sobra[0].y1).toBeGreaterThan(sobra[0].y2)
  })

  it('parede inexistente devolve o MESMO mapa', () => {
    const map = doisPredios()
    expect(desabarParede(map, 'nao-existe').map).toBe(map)
    expect(desabarParede(map, 'nao-existe').salaSecretaPoupada).toBe(false)
  })
})

describe('parede TRAVADA do outro lado — trava vale para o gesto inteiro', () => {
  function comArmazemTravado(): MapData {
    const map = doisPredios()
    return { ...map, walls: map.walls.map((w) => (w.id === 'a1' ? { ...w, locked: true } : w)) }
  }

  it('o clique direito na divisa pega a Oficina (a parede destravada da linha)', () => {
    const map = comArmazemTravado()
    expect(paredeDoGesto(map, { x: 512, y: 160 }, 8)?.id).toBe('o3')
    expect(map.walls.find((w) => w.id === 'a1')?.locked).toBe(true)
  })

  it('abrir o vão pela Oficina recusa: a parede travada do Armazém não perde trecho', () => {
    const antes = comArmazemTravado()
    const corte = abrirVaoDosDoisLados(antes, 'o3', { x: 512, y: 160 }, GRADE)
    expect(corte.travadaNoCaminho).toBe(true)
    expect(corte.salaSecretaPoupada).toBe(false)
    expect(corte.map).toBe(antes)
    expect(divisa(corte.map).map((w) => w.id).sort()).toEqual(['a1', 'o3'])
    expect(passa(corte.map, DENTRO_DA_OFICINA, DENTRO_DO_ARMAZEM)).toBe(false)
  })

  it('desabar pela Oficina recusa: a parede travada do Armazém fica inteira', () => {
    const antes = comArmazemTravado()
    const corte = desabarParede(antes, 'o3')
    expect(corte.travadaNoCaminho).toBe(true)
    expect(corte.map).toBe(antes)
    expect(corte.map.walls.find((w) => w.id === 'a1')).toEqual(antes.walls.find((w) => w.id === 'a1'))
  })

  it('camada de paredes travada: nem a parede clicada, nem a do outro lado, mudam', () => {
    const antes = { ...doisPredios(), lockedLayers: ['paredes' as const] }
    const corte = desabarParede(antes, 'o3')
    expect(corte.travadaNoCaminho).toBe(true)
    expect(corte.map).toBe(antes)
  })

  it('parede travada na mesma linha mas FORA do trecho não impede o vão', () => {
    const longe: Wall = { id: 'longe', x1: 512, y1: 900, x2: 512, y2: 1100, blocksLight: true, blocksMove: true, door: null, locked: true }
    const antes = { ...doisPredios(), walls: [...doisPredios().walls, longe] }
    const corte = abrirVaoDosDoisLados(antes, 'a1', { x: 512, y: 160 }, GRADE)
    expect(corte.travadaNoCaminho).toBe(false)
    expect(corte.map.walls.find((w) => w.id === 'longe')).toBe(longe)
    expect(passa(corte.map, DENTRO_DO_ARMAZEM, DENTRO_DA_OFICINA)).toBe(true)
  })

  it('divisa sem trava não é recusada', () => {
    expect(abrirVaoDosDoisLados(doisPredios(), 'o3', { x: 512, y: 160 }, GRADE).travadaNoCaminho).toBe(false)
    expect(desabarParede(doisPredios(), 'o3').travadaNoCaminho).toBe(false)
  })
})

describe('sala SECRETA do outro lado — a parede dela guarda o segredo', () => {
  function comOficinaSecreta(): MapData {
    const map = doisPredios()
    return { ...map, regions: map.regions.map((r) => (r.id === 'oficina' ? { ...r, secret: true } : r)) }
  }

  it('abrir o vão corta só o lado de cá; a parede da sala secreta fica inteira e avisa', () => {
    const corte = abrirVaoDosDoisLados(comOficinaSecreta(), 'a1', { x: 512, y: 160 }, GRADE)
    expect(corte.salaSecretaPoupada).toBe(true)
    expect(corte.map.walls.find((w) => w.id === 'o3')).toEqual(comOficinaSecreta().walls.find((w) => w.id === 'o3'))
    expect(corte.map.walls.some((w) => w.id === 'a1')).toBe(false)
    // A parede secreta segura a ficha até o mestre revelar a sala.
    expect(passa(corte.map, DENTRO_DO_ARMAZEM, DENTRO_DA_OFICINA)).toBe(false)
  })

  it('desabar pelo lado da sala secreta também poupa a parede dela', () => {
    const corte = desabarParede(comOficinaSecreta(), 'o3')
    expect(corte.salaSecretaPoupada).toBe(true)
    expect(corte.map.walls.some((w) => w.id === 'o3')).toBe(true)
    expect(corte.map.walls.some((w) => w.id === 'a1')).toBe(false)
  })

  it('revelada a sala (secret desligado), o vão abre dos dois lados sem aviso', () => {
    const corte = abrirVaoDosDoisLados(doisPredios(), 'a1', { x: 512, y: 160 }, GRADE)
    expect(corte.salaSecretaPoupada).toBe(false)
    expect(passa(corte.map, DENTRO_DO_ARMAZEM, DENTRO_DA_OFICINA)).toBe(true)
  })
})
