import { describe, expect, it } from 'vitest'
import type { MensagemDoMuralDoServidor, NoticiaDoMural, PedidoDoMural } from '../../lib/nuvem/muralDoLobby'
import { criarMuralDaCampanha } from './muralDaCampanha'

/**
 * O mural do site (M2) nos dois pontos em que ele decide sozinho: o aviso
 * marcado como lido some na hora e não volta depois de uma queda (o lido sai
 * de novo até o servidor confirmar), e a recusa do DO, que não diz a notícia,
 * cai na notícia certa (a fila dos pedidos em voo).
 */

function noticia(id: number, mais: Partial<NoticiaDoMural> = {}): NoticiaDoMural {
  return {
    id,
    autorContaId: 'mestre',
    autorNome: 'Rafa',
    texto: `Notícia ${id}`,
    imagem: null,
    mencoes: [],
    fixada: false,
    versao: 1,
    criadaEm: 1_000 * id,
    editadaEm: null,
    apagadaEm: null,
    reacoes: [],
    minhaReacao: null,
    lida: false,
    ...mais,
  }
}

function estado(noticias: NoticiaDoMural[]): MensagemDoMuralDoServidor {
  return { t: 'mural.estado', fixadas: noticias.filter((n) => n.fixada), noticias, temMaisAntigas: false }
}

function muralDeTeste() {
  const enviados: PedidoDoMural[] = []
  const mural = criarMuralDaCampanha({
    enviar: (pedido) => {
      enviados.push(pedido)
      return true
    },
    aoMudar: () => undefined,
    relogio: { agora: () => 0, depois: () => () => undefined },
    novoId: () => 'id_1',
  })
  return { mural, enviados }
}

describe('mural do site (M2)', () => {
  it('o aviso marcado como lido some na hora, o lido sai uma vez e sai de novo depois de uma queda até o servidor confirmar', () => {
    const { mural, enviados } = muralDeTeste()
    const aviso = noticia(1, { fixada: true, versao: 2 })
    mural.aoFicarEmDia()
    mural.aoReceber(estado([aviso]))

    mural.marcarLido(1, 2)
    mural.marcarLido(1, 2)
    expect(mural.estado().fixadas[0].lida).toBe(true)
    expect(enviados).toEqual([{ t: 'mural.lido', id: 1, versao: 2 }])

    // Caiu antes da resposta: o estado da volta ainda diz "não lida", mas o aviso não reaparece e o lido sai de novo.
    mural.aoCair()
    mural.aoFicarEmDia()
    mural.aoReceber(estado([aviso]))
    expect(mural.estado().fixadas[0].lida).toBe(true)
    expect(enviados.filter((pedido) => pedido.t === 'mural.lido')).toHaveLength(2)

    // O mestre edita o aviso (versão 3): ele volta para quem tinha lido a versão 2.
    mural.aoReceber({ t: 'mural.noticia', noticia: { ...aviso, versao: 3, editadaEm: 5_000 } })
    expect(mural.estado().fixadas[0].lida).toBe(false)
  })

  it('a recusa do DO, que não diz a notícia, cai na notícia do pedido certo', () => {
    const { mural } = muralDeTeste()
    mural.aoFicarEmDia()
    mural.aoReceber(estado([noticia(1), noticia(2)]))

    expect(mural.fixar(1, true)).toBe(true)
    expect(mural.apagar(2)).toBe(true)
    expect([...mural.estado().aCaminho]).toEqual([
      [1, 'fixar'],
      [2, 'apagar'],
    ])

    mural.aoReceber({ t: 'mural.noticia', noticia: noticia(2, { texto: '', apagadaEm: 9_000 }) })
    mural.aoReceber({ t: 'mural.recusado', pedido: 'mural.fixar', motivo: 'cota' })

    const depois = mural.estado()
    expect(depois.aCaminho.size).toBe(0)
    expect(depois.recusas.get(1)).toEqual({ acao: 'fixar', motivo: 'cota' })
    expect(depois.recusas.has(2)).toBe(false)
    expect(depois.noticias.find((n) => n.id === 2)?.apagadaEm).toBe(9_000)
  })
})
