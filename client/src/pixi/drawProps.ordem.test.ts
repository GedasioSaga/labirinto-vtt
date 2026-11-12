import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createPropsRenderer } from './drawProps'
import type { Prop } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * A PILHA DOS OBJETOS NO EDITOR (pedido de 12/11/2026, "a caixa menor por
 * baixo da grande"): a lista do mapa é a pilha, o último por cima — como na
 * tela do jogador (`emOrdemDeDesenho`) e no clique (`findPropAt`). Todo nó
 * novo do editor entra com `addChildAt(…, 0)`, e sem a ordenação o objeto
 * posto por último ficava POR BAIXO dos outros, só no editor.
 */

const ZOOM_1 = { cameraScale: 1, rendererResolution: 1 }

function caixa(id: string, x: number, tamanho: number): Prop {
  return { id, src: '', x, y: 100, width: tamanho, height: tamanho, linkedMapPath: null, mobilia: 'caixa' }
}

/** Os desenhos dos móveis, de baixo para cima, cada um pelo x do centro (as caixas têm x diferentes). */
function pilhaPeloX(container: Container): number[] {
  return container.children
    .filter((c): c is Graphics => c instanceof Graphics && c.label === 'mobilia')
    .map((g) => {
      const caixaDoDesenho = g.context.bounds
      return Math.round((caixaDoDesenho.minX + caixaDoDesenho.maxX) / 2)
    })
}

describe('createPropsRenderer — a ordem da lista é a pilha', () => {
  it('o último da lista fica por cima, e reordenar a lista reordena o desenho sem recriar nada', () => {
    const grande = caixa('grande', 100, 128)
    const pequena = caixa('pequena', 150, 48)
    const container = new Container()
    const renderer = createPropsRenderer()

    renderer.draw(container, [grande, pequena], null, ZOOM_1)
    expect(pilhaPeloX(container)).toEqual([100, 150])

    // "Pôr por baixo" na pequena: ela vai para o começo da lista e o desenho segue.
    renderer.draw(container, [pequena, grande], null, ZOOM_1)
    expect(pilhaPeloX(container)).toEqual([150, 100])
  })
})
