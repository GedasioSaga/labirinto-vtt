import { describe, expect, it } from 'vitest'
import { serializeMap, deserializeMap } from './mapFile'
import legacyMapJson from './__fixtures__/legacy-map.json'

/**
 * Fixture congelada: `legacy-map.json` é cópia byte-a-byte de um map.json
 * REAL (`C:\dev\labirinto\maps\L1.json`), salvo pelo app ANTES desta rodada
 * de migração — sem gridSettings/stairs/hiddenLayers/scale/measurementMode,
 * sem DoorState.kind, sem Drawing.fillAlpha. Ela já exercita os dois pontos
 * de maior risco da migração (plano §5):
 *  - w87/w101 têm `door` preenchido (open/locked) sem `kind` -> precisa
 *    migrar para 'normal', preservando open/locked.
 *  - d144 é um circle com `filled: true` e SEM `fillAlpha` -> risco nº 2 do
 *    plano: sem a linha de migração, alpha vira 1 (opaco) no Pixi em vez do
 *    0.5 que `drawDrawings.ts` já usa hoje.
 *  - d125-d128 são circle com `filled: false` -> fillAlpha tem que migrar
 *    para 0, não para 0.5 (senão um círculo nunca preenchido passaria a
 *    "vazar" alpha 0.5 se algum dia `filled` for ignorado).
 */
const legacyJson = JSON.stringify(legacyMapJson)

describe('deserializeMap — migração de mapa legado (fixture real)', () => {
  it('preenche gridSettings com os defaults literais de drawGrid.ts/drawHexGrid.ts', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.gridSettings).toEqual({ color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid' })
  })

  it('preenche stairs: [] (mapa sem escada)', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.stairs).toEqual([])
  })

  it('preenche hiddenLayers: [] (tudo visível)', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.hiddenLayers).toEqual([])
  })

  it('preenche lockedLayers: [] (Onda 4, Frente D — nada travado)', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.lockedLayers).toEqual([])
  })

  it('preenche scale com o default 5ft', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.scale).toEqual({ unitsPerCell: 5, unit: 'ft', precision: 0 })
  })

  it('preenche measurementMode derivado do gridShape JÁ RESOLVIDO ("square" -> "chessboard")', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.gridShape).toBe('square')
    expect(restored.measurementMode).toBe('chessboard')
  })

  it('porta antiga (sem kind) migra para kind: "normal", preservando open/locked', () => {
    const restored = deserializeMap(legacyJson)
    const w87 = restored.walls.find((w) => w.id === 'w87')
    const w101 = restored.walls.find((w) => w.id === 'w101')
    expect(w87?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(w101?.door).toEqual({ open: false, locked: false, kind: 'normal' })
  })

  it('parede sem porta continua com door: null, e sem wallKind (undefined === "exterior")', () => {
    const restored = deserializeMap(legacyJson)
    const w2 = restored.walls.find((w) => w.id === 'w2')
    expect(w2?.door).toBeNull()
    expect(w2?.wallKind).toBeUndefined()
  })

  it('região antiga não ganha room (permanece região comum, sem retroatividade), preservando fillColor/fillPattern já existentes', () => {
    const restored = deserializeMap(legacyJson)
    const r1 = restored.regions.find((r) => r.id === 'r1')
    expect(r1?.room).toBeUndefined()
    expect(r1?.fillColor).toBe('#e9e4d8')
    expect(r1?.fillPattern).toBe('solid')
  })

  it('risco nº 2 do plano: circle preenchido (filled: true) sem fillAlpha migra para 0.5, não para 1 (opaco)', () => {
    const restored = deserializeMap(legacyJson)
    const d144 = restored.drawings.find((d) => d.id === 'd144')
    expect(d144?.kind).toBe('circle')
    if (d144?.kind === 'circle') {
      expect(d144.filled).toBe(true)
      expect(d144.fillAlpha).toBe(0.5)
    }
  })

  it('circle não preenchido (filled: false) sem fillAlpha migra para 0, não para 0.5', () => {
    const restored = deserializeMap(legacyJson)
    for (const id of ['d125', 'd126', 'd127', 'd128']) {
      const d = restored.drawings.find((drawing) => drawing.id === id)
      expect(d?.kind).toBe('circle')
      if (d?.kind === 'circle') {
        expect(d.filled).toBe(false)
        expect(d.fillAlpha).toBe(0)
      }
    }
  })

  it('drawing que não é circle (line) não ganha fillAlpha', () => {
    const restored = deserializeMap(legacyJson)
    const line = restored.drawings.find((d) => d.id === 'd129')
    expect(line?.kind).toBe('line')
    if (line) expect('fillAlpha' in line).toBe(false)
  })

  it('serializeMap(deserializeMap(json)) é idempotente na segunda passada — migração não reaplica nem altera nada de novo', () => {
    const once = deserializeMap(legacyJson)
    const twice = deserializeMap(serializeMap(once))
    expect(twice).toEqual(once)
  })

  it('id/name/width/height/grid do mapa legado são preservados sem alteração', () => {
    const restored = deserializeMap(legacyJson)
    expect(restored.id).toBe('map-l1-nivel1')
    expect(restored.name).toBe('L1')
    expect(restored.width).toBe(20)
    expect(restored.height).toBe(15)
    expect(restored.grid).toBe(40)
  })
})
