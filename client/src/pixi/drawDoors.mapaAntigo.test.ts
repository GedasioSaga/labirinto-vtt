import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { deserializeMap } from '../lib/mapFile'
import type { Wall } from '../types/map'
import { DOOR_COLOR, DOOR_EDGE_COLOR, DOOR_LOCKED_COLOR, drawDoors } from './drawDoors'

/**
 * MAPA SALVO ANTES DA FAIXA A3 (22/10/2026): o `map.json` de antes da porta
 * creme, escrito à mão como o app gravava — a porta só com `open`, `locked` e
 * `kind`, sem `cor` nem `animacao`. Ele abre IGUAL e as portas saem no desenho
 * novo: creme com contorno escuro, vermelha a trancada, sem cadeado.
 */
const MAPA_DE_ANTES = `{
  "id": "map_antigo_a3",
  "name": "Mapa de antes da porta creme",
  "width": 20,
  "height": 12,
  "grid": 50,
  "regions": [],
  "tokens": [],
  "walls": [
    { "id": "w-parede", "x1": 0, "y1": 0, "x2": 100, "y2": 0, "blocksLight": true, "blocksMove": true, "door": null },
    { "id": "w-fechada", "x1": 100, "y1": 0, "x2": 140, "y2": 0, "blocksLight": true, "blocksMove": true, "door": { "open": false, "locked": false, "kind": "normal" } },
    { "id": "w-aberta", "x1": 200, "y1": 0, "x2": 200, "y2": 40, "blocksLight": true, "blocksMove": true, "door": { "open": true, "locked": false, "kind": "double" } },
    { "id": "w-trancada", "x1": 300, "y1": 0, "x2": 340, "y2": 0, "blocksLight": true, "blocksMove": true, "door": { "open": false, "locked": true, "kind": "normal" } }
  ]
}`

type Instruction = Graphics['context']['instructions'][number]

function preenchimentos(g: Graphics): { color: number; alpha: number }[] {
  return g.context.instructions.flatMap((i: Instruction) => (i.action === 'fill' ? [{ color: i.data.style.color, alpha: i.data.style.alpha }] : []))
}

function desenho(walls: Wall[]): Graphics {
  const g = new Graphics()
  drawDoors(g, walls, null, 2, 1)
  return g
}

describe('mapa salvo antes da A3 (porta sem cor nem animação)', () => {
  const mapa = deserializeMap(MAPA_DE_ANTES)
  const porta = (id: string) => mapa.walls.find((w) => w.id === id)

  it('as portas carregam com o estado gravado, sem campo novo inventado', () => {
    expect(mapa.walls.map((w) => w.id)).toEqual(['w-parede', 'w-fechada', 'w-aberta', 'w-trancada'])
    expect(porta('w-fechada')?.door).toMatchObject({ open: false, locked: false, kind: 'normal' })
    expect(porta('w-aberta')?.door).toMatchObject({ open: true, locked: false })
    expect(porta('w-trancada')?.door).toMatchObject({ open: false, locked: true })
    for (const id of ['w-fechada', 'w-aberta', 'w-trancada']) {
      expect(porta(id)?.door?.cor, id).toBeUndefined()
      expect(porta(id)?.door?.animacao, id).toBeUndefined()
    }
  })

  it('a fechada sai creme com o contorno escuro, opaca', () => {
    const fechada = porta('w-fechada')
    if (fechada === undefined) throw new Error('a porta fechada não carregou')
    const fills = preenchimentos(desenho([fechada]))
    expect(fills.map((f) => f.color)).toEqual([DOOR_EDGE_COLOR, DOOR_COLOR])
    expect(fills.every((f) => f.alpha === 1)).toBe(true)
  })

  it('a aberta sai como o batente creme com contorno, e a trancada vermelha com contorno, sem cadeado', () => {
    const aberta = porta('w-aberta')
    const trancada = porta('w-trancada')
    if (aberta === undefined || trancada === undefined) throw new Error('as portas não carregaram')
    const daAberta = new Set(preenchimentos(desenho([aberta])).map((f) => f.color))
    expect(daAberta).toEqual(new Set([DOOR_EDGE_COLOR, DOOR_COLOR]))
    expect(preenchimentos(desenho([trancada])).map((f) => f.color)).toEqual([DOOR_EDGE_COLOR, DOOR_LOCKED_COLOR])
  })

  it('o desenho é o mesmo da porta criada hoje sem cor: abrir o mapa antigo não muda nada', () => {
    const hoje: Wall[] = mapa.walls.map((w) => (w.door === null ? w : { ...w, door: { open: w.door.open, locked: w.door.locked, kind: w.door.kind } }))
    const instrucoes = (g: Graphics) => JSON.stringify(g.context.instructions.map((i: Instruction) => (i.action === 'fill' || i.action === 'stroke' ? [i.action, i.data.style.color, i.data.path.instructions.map((p) => [p.action, p.data])] : [i.action])))
    expect(instrucoes(desenho(mapa.walls))).toBe(instrucoes(desenho(hoje)))
  })
})
