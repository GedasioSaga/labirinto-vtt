import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { criarPisoDeBaixoNoEditor } from './pisoDeBaixoNoEditor'

describe('pisoDeBaixoNoEditor', () => {
  // Guardada em textura, a planta passa pelo filtro FORA da tela: com o corte na janela (o padrão do Pixi 8),
  // a área do filtro virava o tamanho da tela dividido pela resolução da textura, e num mapa 100x100 (0,32)
  // só o canto de cima à esquerda do térreo aparecia no editor (fecho da muralha, 14/11/2026).
  it('os filtros das duas partes da planta (chão e fichas) não cortam a área no tamanho da tela', () => {
    const { camada } = criarPisoDeBaixoNoEditor()
    const filtros = camada.children.flatMap((guardada) => {
      const borrado = guardada.children[0]
      if (!(borrado instanceof Container)) return []
      const lista = borrado.filters
      return Array.isArray(lista) ? lista : lista === null || lista === undefined ? [] : [lista]
    })
    expect(filtros).toHaveLength(4)
    expect(filtros.map((f) => f.clipToViewport)).toEqual([false, false, false, false])
  })
})
