/**
 * REVISÃO DA FATIA 6, item 8: relevo, balde (texturas), nomes dos lugares e
 * textos perguntam se o desenho está à vista pelo MAPA, não pela lista
 * `hiddenLayers`. Na forma de lista, `drawingLayer` põe todo desenho em
 * Anotações: no mapa v2, ocultar Anotações tirava os desenhos de Desenhos do
 * relevo e do balde, e ocultar Desenhos não tirava. O `PixiCanvas` não monta
 * em teste de unidade (Pixi + WebGL): a guarda é no texto, e o comportamento
 * da mesma pergunta está provado na store (`mapStore.camadasFatia6.test.ts`,
 * o balde) e em `lib/layers` (a forma de mapa).
 */
import { describe, expect, it, vi } from 'vitest'

/** O fonte como está no disco (mesmo jeito de `components/polimentoDoMestre.test.ts`: o jsdom não lê `new URL`). */
async function lerFonte(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'PixiCanvas.tsx'), 'utf8')
}

describe('PixiCanvas: desenhos à vista pelo mapa', () => {
  it('nenhuma chamada de visibleDrawings pela lista hiddenLayers', async () => {
    expect((await lerFonte()).match(/visibleDrawings\([^)]*hiddenLayers\)/g) ?? []).toEqual([])
  })

  it('relevo, texturas, nomes e textos chamam visibleDrawings(map.drawings, map)', async () => {
    expect(((await lerFonte()).match(/visibleDrawings\(map\.drawings, map\)/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })
})
