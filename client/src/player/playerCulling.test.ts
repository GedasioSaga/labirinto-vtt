import { describe, expect, it } from 'vitest'
import { createExploration, markAll, markRings } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { FloorPiece, MapData, RegionPoint, Wall } from '../types/map'
import { createPlayerCuller, type PlayerDrawSet } from './playerCulling'

/**
 * CENA GRANDE NO CELULAR. A cidade-torre tem cena com 2.828 salas; o jogador
 * recebe a planta inteira (chão e paredes sem porta, decisão do usuário em
 * `lib/fogFilter.ts`) e desenhava tudo, mesmo o que está debaixo da névoa
 * preta. O recorte de desenho escolhe só o que está perto da ficha (a visão)
 * e o que ele já viu (o explorado) — e o custo dele não pode crescer com o
 * tamanho da cena inteira, senão o celular trava do mesmo jeito.
 */

const GRID = 40
/** Cada sala do quarteirão: 5 x 5 células. */
const SALA = 5 * GRID

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function chao(id: string, cx: number, cy: number, op: FloorPiece['op'] = 'add'): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w: SALA, h: SALA }, op, modifiers: {} }
}

/** Quarteirão de `lado` x `lado` salas, cada uma com 4 paredes e 1 peça de chão. */
function quarteirao(lado: number): MapData {
  const walls: Wall[] = []
  const floor: FloorPiece[] = []
  for (let linha = 0; linha < lado; linha += 1) {
    for (let coluna = 0; coluna < lado; coluna += 1) {
      const x = coluna * SALA
      const y = linha * SALA
      const id = `s${coluna}-${linha}`
      walls.push(
        parede(`${id}-n`, x, y, x + SALA, y),
        parede(`${id}-l`, x + SALA, y, x + SALA, y + SALA),
        parede(`${id}-s`, x, y + SALA, x + SALA, y + SALA),
        parede(`${id}-o`, x, y, x, y + SALA),
      )
      floor.push(chao(`${id}-chao`, x + SALA / 2, y + SALA / 2))
    }
  }
  return { ...createEmptyMap('m-blocos', '', lado * 5, lado * 5, GRID), walls, floor }
}

/** A ficha está na sala do canto (0, 0) e enxerga o interior dela. */
function salaDoCanto(coluna = 0, linha = 0): RegionPoint[] {
  const x = coluna * SALA
  const y = linha * SALA
  return [
    { x: x + 1, y: y + 1 },
    { x: x + SALA - 1, y: y + 1 },
    { x: x + SALA - 1, y: y + SALA - 1 },
    { x: x + 1, y: y + SALA - 1 },
  ]
}

function ids(itens: readonly { id: string }[]): string[] {
  return itens.map((i) => i.id).sort()
}

describe('recorte de desenho do jogador — cena grande', () => {
  it('desenha as paredes e o chão da sala onde a ficha está, e não os do outro lado da cidade', () => {
    const map = quarteirao(20)
    const set = createPlayerCuller().cull(map, [salaDoCanto()], undefined)

    // A sala da ficha sai inteira: as 4 paredes e o chão.
    for (const lado of ['n', 'l', 's', 'o']) expect(ids(set.walls)).toContain(`s0-0-${lado}`)
    expect(ids(set.floor)).toContain('s0-0-chao')
    // A sala do canto oposto, debaixo da névoa preta, não é desenhada.
    expect(ids(set.walls)).not.toContain('s19-19-n')
    expect(ids(set.floor)).not.toContain('s19-19-chao')
    // Uma fração pequena do total: 1.600 paredes na cena.
    expect(map.walls.length).toBe(1600)
    expect(set.walls.length * 20).toBeLessThan(map.walls.length)
    expect(set.walls.length).toBeGreaterThanOrEqual(4)
  })

  it('a montagem do índice é contada: a primeira chegada da planta indexa a cena inteira', () => {
    const grande = quarteirao(60)
    const primeira = createPlayerCuller().cull(grande, [salaDoCanto()], undefined)
    // 14.400 paredes + 3.600 peças de chão: a montagem cresce com a cena, e a medida diz isso.
    expect(primeira.indexed).toBe(grande.walls.length + grande.floor.length)
    expect(primeira.indexed).toBe(18_000)
  })

  it('o custo do recorte a cada snapshot NÃO cresce com o tamanho da cena: 16 salas ou 3.600, mesma vizinhança, mesmo trabalho', () => {
    const pequena = quarteirao(4)
    const grande = quarteirao(60)
    expect(grande.walls.length).toBe(14_400)

    /**
     * Como na tela: a planta chegou uma vez, e cada snapshot/delta seguinte
     * traz tudo recém-parseado (arrays e objetos novos, mesmo conteúdo) com a
     * ficha em outro lugar. A chamada medida é a do snapshot seguinte.
     */
    function snapshotSeguinte(map: MapData): PlayerDrawSet {
      const culler = createPlayerCuller()
      culler.cull(map, [salaDoCanto()], undefined)
      return culler.cull(structuredClone(map), [salaDoCanto(1, 0)], undefined)
    }
    const naPequena = snapshotSeguinte(pequena)
    const naGrande = snapshotSeguinte(grande)

    // Nada indexado de novo nas duas, o mesmo desenho item por item e o mesmo
    // número de itens examinados: a cena ter 225x mais salas não muda o trabalho.
    expect(naGrande.indexed).toBe(0)
    expect(naPequena.indexed).toBe(0)
    expect(ids(naGrande.walls)).toEqual(ids(naPequena.walls))
    expect(ids(naGrande.floor)).toEqual(ids(naPequena.floor))
    expect(naGrande.examined).toBe(naPequena.examined)
    expect(naGrande.examined).toBeGreaterThan(0)
  })

  it('o mestre mexe na planta: o índice é remontado e a parede nova aparece', () => {
    const map = quarteirao(20)
    const culler = createPlayerCuller()
    culler.cull(map, [salaDoCanto()], undefined)
    const editado: MapData = { ...map, walls: [...map.walls, parede('nova', 10, 10, 100, 10)] }
    const depois = culler.cull(editado, [salaDoCanto()], undefined)
    expect(depois.indexed).toBe(editado.walls.length)
    expect(ids(depois.walls)).toContain('nova')
  })

  it('o que o jogador já viu continua desenhado longe da ficha (explorado)', () => {
    const map = quarteirao(20)
    const explored = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    // Ele passou pela sala (15, 15) antes; agora está no canto (0, 0).
    markRings(explored, [salaDoCanto(15, 15)])

    const set = createPlayerCuller().cull(map, [salaDoCanto()], explored)

    for (const lado of ['n', 'l', 's', 'o']) expect(ids(set.walls)).toContain(`s15-15-${lado}`)
    expect(ids(set.floor)).toContain('s15-15-chao')
    expect(ids(set.walls)).toContain('s0-0-n')
    // Sala nunca vista, entre as duas, fica de fora.
    expect(ids(set.walls)).not.toContain('s8-8-n')
  })

  it('"Revelar planta" (tudo explorado) desenha a planta inteira: nada some do que o jogador já pode ver', () => {
    const map = quarteirao(12)
    const explored = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    markAll(explored)
    const set = createPlayerCuller().cull(map, [], explored)
    expect(set.walls.length).toBe(map.walls.length)
    expect(set.floor.map((f) => f.id)).toEqual(map.floor.map((f) => f.id))
  })

  it('sem visão e sem memória não desenha nada da planta (tela toda na névoa)', () => {
    const set = createPlayerCuller().cull(quarteirao(10), [], undefined)
    expect(set.walls).toEqual([])
    expect(set.floor).toEqual([])
  })

  it('o chão sai na ORDEM do mestre: peça que apaga continua depois da que soma', () => {
    const map: MapData = {
      ...quarteirao(10),
      floor: [chao('primeiro', 100, 100), chao('buraco', 120, 120, 'subtract'), chao('depois', 140, 140), chao('longe', 1900, 1900)],
    }
    const set = createPlayerCuller().cull(map, [salaDoCanto()], undefined)
    expect(set.floor.map((f) => f.id)).toEqual(['primeiro', 'buraco', 'depois'])
  })

  it('parede fora do retângulo do mapa (sem névoa por cima) e parede com coordenada quebrada continuam desenhadas', () => {
    const base = quarteirao(10)
    const fora = parede('fora-do-mapa', base.width * GRID + 50, 10, base.width * GRID + 50, 300)
    const quebrada = parede('quebrada', Number.NaN, 0, 10, 10)
    const set = createPlayerCuller().cull({ ...base, walls: [...base.walls, fora, quebrada] }, [salaDoCanto()], undefined)
    expect(ids(set.walls)).toContain('fora-do-mapa')
    expect(ids(set.walls)).toContain('quebrada')
    expect(ids(set.walls)).not.toContain('s9-9-n')
  })

  it('a mesma entrada devolve o mesmo desenho (referência estável): zoom não refaz o recorte', () => {
    const map = quarteirao(10)
    const vision = [salaDoCanto()]
    const culler = createPlayerCuller()
    const a = culler.cull(map, vision, undefined)
    const b = culler.cull(map, vision, undefined)
    expect(b).toBe(a)
    expect(b.walls.length).toBeGreaterThan(0)
  })
})
