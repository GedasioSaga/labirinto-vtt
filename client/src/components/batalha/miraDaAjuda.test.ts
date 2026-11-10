// @vitest-environment node
/**
 * Conserto de 09/11/2026 (a Bolha do Tree, achado 5): a mira da ajuda (cura,
 * Buff) mostra primeiro quem é do lado de quem usa, os feridos antes; o outro
 * lado fica no fim. Sem ferido do lado, a cura abre sem alvo. Dados
 * inventados; no máximo 2 testes.
 */
import { describe, expect, it } from 'vitest'
import { alvosNaOrdemDaAjuda, golpeDeAjuda, semFeridoDoLado, type AlvoNaMira } from './dadosDoMenu'

function alvo(tokenId: string, lado: AlvoNaMira['lado'], atual: number, maximo: number, extra: Partial<AlvoNaMira> = {}): AlvoNaMira {
  return { tokenId, nome: tokenId, lado, caiu: false, vida: { atual, maximo }, ...extra }
}

describe('a mira da ajuda na mão do mestre', () => {
  it('a ordem: feridos do lado (o mais ferido antes), o resto do lado, e por último o outro lado, sem perder ninguém', () => {
    const alvos = [
      alvo('capita_ferida', 'outro', 100, 600),
      alvo('urso_cheio', 'aliado', 300, 300),
      alvo('arvore', 'eu', 480, 500),
      alvo('urso_ferido', 'aliado', 120, 300),
      alvo('grumete', 'outro', 400, 400),
      alvo('urso_caido', 'aliado', 0, 300, { caiu: true }),
    ]
    expect(alvosNaOrdemDaAjuda(alvos).map((item) => item.tokenId)).toEqual(['urso_ferido', 'arvore', 'urso_cheio', 'urso_caido', 'capita_ferida', 'grumete'])
    expect([golpeDeAjuda({ cura: true }), golpeDeAjuda({ reacao: 'nunca' }), golpeDeAjuda({ reacao: 'sempre' }), golpeDeAjuda({})]).toEqual([true, true, false, false])
  })

  it('"ninguém do lado está ferido" só quando a lista sabe a vida: com um ferido do lado, ou sem a vida (a tela do jogador), não', () => {
    const cheios = [alvo('arvore', 'eu', 500, 500), alvo('urso', 'aliado', 300, 300), alvo('capita_ferida', 'outro', 100, 600)]
    expect(semFeridoDoLado(cheios)).toBe(true)
    expect(semFeridoDoLado([...cheios, alvo('lobo', 'aliado', 10, 300)])).toBe(false)
    expect(semFeridoDoLado([{ tokenId: 'sapo', nome: 'Sapo', lado: 'eu', caiu: false }])).toBe(false)
  })
})
