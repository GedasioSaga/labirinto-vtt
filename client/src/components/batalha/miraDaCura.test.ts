// @vitest-environment node
/**
 * Pedido de 09/11/2026 (item 2, a Bolha do NPC): a mira da cura abre nos
 * feridos do lado de quem usa, não em quem usa com a vida cheia. Dados
 * inventados; no máximo 2 testes.
 */
import { describe, expect, it } from 'vitest'
import { feridosParaACura, type AlvoNaMira } from './dadosDoMenu'

function alvo(tokenId: string, lado: AlvoNaMira['lado'], atual: number, maximo: number, extra: Partial<AlvoNaMira> = {}): AlvoNaMira {
  return { tokenId, nome: tokenId, lado, caiu: false, vida: { atual, maximo }, ...extra }
}

describe('quem a mira da cura marca ao abrir', () => {
  it('os feridos do lado de quem usa, o mais ferido primeiro, até o teto; inimigo e caído ficam de fora', () => {
    const alvos = [
      alvo('inimiga_ferida', 'outro', 100, 600),
      alvo('urso_cheio', 'aliado', 300, 300),
      alvo('urso_ferido', 'aliado', 215, 300),
      alvo('urso_caido', 'aliado', 0, 300, { caiu: true }),
      alvo('lobo_arranhado', 'aliado', 290, 300),
      alvo('sapo', 'eu', 460, 500),
    ]
    expect(feridosParaACura(alvos, 2)).toEqual(['urso_ferido', 'sapo'])
    expect(feridosParaACura(alvos, 1)).toEqual(['urso_ferido'])
  })

  it('ninguém ferido, ou lista sem a vida (a tela do jogador): `null`, e a mira segue a regra de sempre', () => {
    expect(feridosParaACura([alvo('sapo', 'eu', 500, 500), alvo('urso', 'aliado', 300, 300)], 2)).toBeNull()
    expect(feridosParaACura([{ tokenId: 'sapo', nome: 'Sapo', lado: 'eu', caiu: false }], 2)).toBeNull()
  })
})
