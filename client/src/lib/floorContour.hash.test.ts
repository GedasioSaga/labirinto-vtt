/**
 * CONTORNO IGUAL (F5 da otimização do mapa grande, 27/10/2026): pular as
 * células sem borda no marching squares e guardar o contorno não pode mudar
 * um ponto do chão. Os hashes saíram do código ANTES da F5 (commit b06ce4cc)
 * sobre o mapa sintético do harness (`desempenho/mapaSintetico.ts`, semente fixa).
 */
import { describe, expect, it } from 'vitest'
import { mapaSintetico } from '../../desempenho/mapaSintetico'
import type { FloorPiece } from '../types/map'
import { buildFloorOutline, mapFloorClip } from './floorContour'

const HASH_ANTES_DA_F5: Record<string, { editor: string; visao: string }> = {
  '50': { editor: 'ec22e0a39e1a7259b0c609b9ef20aad8cac9216abed92c8536bba9921fe21673', visao: '792fe8b04fdb05689701f7be52b58563db9b2999266bfc9fb5347ba80355cd65' },
  '200': { editor: '59d98b7945d836633c2bdb945f286b92623bd4dd61d6f0e096b3430caa7cc141', visao: '1f3092793ffd2dacffe6d7d717c2038ea5486b06ee41c418bd5a6b3f8557b31d' },
}

async function hashDe(valor: unknown): Promise<string> {
  const resumo = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(valor)))
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('contorno guardado por versão do chão', () => {
  const chao = (w: number): FloorPiece[] => [
    { id: 'a', shape: { kind: 'rect', cx: 100, cy: 100, w, h: 80 }, op: 'add', modifiers: {} },
    { id: 'b', shape: { kind: 'ellipse', cx: 100, cy: 100, rx: 10, ry: 10 }, op: 'subtract', modifiers: {} },
  ]
  it('mesma lista ou lista nova com o mesmo desenho (o mapa aberto de novo): não recalcula', () => {
    const primeira = chao(120)
    const contorno = buildFloorOutline(primeira, { step: 2 })
    expect(buildFloorOutline(primeira, { step: 2 })).toBe(contorno)
    // Outra cor e outro nome não mudam o desenho.
    const reaberta = chao(120).map((p) => ({ ...p, fillColor: '#123456', nome: 'outro' }))
    expect(buildFloorOutline(reaberta, { step: 2 })).toBe(contorno)
  })
  it('desenho, passo ou recorte diferentes: contorno novo, igual ao calculado do zero', () => {
    const contorno = buildFloorOutline(chao(120), { step: 2 })
    const maior = buildFloorOutline(chao(160), { step: 2 })
    expect(maior).not.toBe(contorno)
    expect(maior).not.toEqual(contorno)
    expect(buildFloorOutline(chao(120), { step: 4 })).not.toBe(contorno)
    expect(buildFloorOutline(chao(120), { step: 2, clip: { minX: 0, minY: 0, maxX: 120, maxY: 300 } })).not.toBe(contorno)
    const oculta = chao(120).map((p) => (p.op === 'subtract' ? { ...p, hidden: true } : p))
    expect(buildFloorOutline(oculta, { step: 2 })[0].holes).toHaveLength(0)
  })
})

describe('contorno do chão: o mesmo de antes da F5', () => {
  for (const lado of [50, 200]) {
    it(`sintético ${lado}x${lado}: contorno do editor (passo + recorte do mapa) e o da visão (padrão)`, async () => {
      const map = mapaSintetico({ lado })
      expect(await hashDe(buildFloorOutline(map.floor, { step: map.floorStyle.sampleStep, clip: mapFloorClip(map) }))).toBe(HASH_ANTES_DA_F5[lado].editor)
      expect(await hashDe(buildFloorOutline(map.floor))).toBe(HASH_ANTES_DA_F5[lado].visao)
    })
  }
})
