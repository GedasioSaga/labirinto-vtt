import { describe, expect, it } from 'vitest'
import { descidaDosNomes, type NomeNoMapa } from './nomesEncostados'

/** Uma linha do nome com fonte 12: 12 x 1,25 = 15 px de mundo. */
const LINHA = 15

function nome(texto: string, x: number, extra: Partial<NomeNoMapa> = {}): NomeNoMapa {
  return { x, topo: 100, texto, fonte: 12, tamanho: 1, ...extra }
}

describe('nomes encostados (caça 12/11, P32): a regra única do editor e da janela do jogador', () => {
  it('três fichas empilhadas: cada nome numa linha própria; a ficha maior fica no lugar, no empate desce a que vem depois', () => {
    expect(descidaDosNomes([nome('Vincent G.', 0), nome('Nav', 4), nome('Frog', 2)])).toEqual([0, LINHA, 2 * LINHA])
    // A maior fica no lugar, mesmo vindo por último na lista.
    expect(descidaDosNomes([nome('Vincent G.', 0), nome('Nav', 4), nome('Ogro', 2, { tamanho: 2 })])).toEqual([LINHA, 2 * LINHA, 0])
    // Longe no x (ou já numa linha livre), nada desce.
    expect(descidaDosNomes([nome('Vincent G.', 0), nome('Nav', 200)])).toEqual([0, 0])
  })

  it('o bloco com o nome do companheiro ocupa duas linhas: o vizinho desce para baixo dele, e quem desce anda a própria altura', () => {
    const descidas = descidaDosNomes([nome('Ryoko', 0, { linhas: 2 }), nome('Nav', 0), nome('Saga', 0)])
    expect(descidas).toEqual([0, 2 * LINHA, 3 * LINHA])
    // Nenhum par se cruza no fim.
    const blocos = [
      { y0: 100 + descidas[0], y1: 100 + descidas[0] + 2 * LINHA },
      { y0: 100 + descidas[1], y1: 100 + descidas[1] + LINHA },
      { y0: 100 + descidas[2], y1: 100 + descidas[2] + LINHA },
    ]
    for (const [i, a] of blocos.entries()) for (const b of blocos.slice(i + 1)) expect(a.y0 < b.y1 && b.y0 < a.y1).toBe(false)
  })
})
