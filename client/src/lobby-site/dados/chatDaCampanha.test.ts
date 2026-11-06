import { describe, expect, it } from 'vitest'
import type { MensagemDoChat, MensagemDoChatDoServidor, PedidoDoChat } from '../../lib/nuvem/chatDoLobby'
import type { Membro } from '../../lib/nuvem/tipos'
import { criarChatDaCampanha, pendentesACaminho, type PendentesGuardadas } from './chatDaCampanha'
import { criarChatDaDemo } from './chatDaDemo'
import type { Relogio } from './fonte'

/**
 * O chat do site (C2) contra os dois achados da revisão: o `chat.lida` não
 * repete o que já saiu (o DO passa todo frame da conta pelo ritmo, fichas
 * inclusive), e a mensagem que ainda não saiu sobrevive a sair da mesa.
 */

const AGORA = 1_000_000
const EU = 'conta_eu'
const OUTRA = 'conta_bia'

type RelogioDeTeste = Relogio & { andar(ms: number): void }

function relogioDeTeste(): RelogioDeTeste {
  let agora = AGORA
  let timers: { quando: number; fazer: () => void }[] = []
  return {
    agora: () => agora,
    depois(ms, fazer) {
      const timer = { quando: agora + ms, fazer }
      timers.push(timer)
      return () => {
        timers = timers.filter((candidato) => candidato !== timer)
      }
    },
    andar(ms) {
      const fim = agora + ms
      for (;;) {
        const proximo = timers.filter((timer) => timer.quando <= fim).sort((a, b) => a.quando - b.quando)[0]
        if (proximo === undefined) break
        timers = timers.filter((timer) => timer !== proximo)
        agora = proximo.quando
        proximo.fazer()
      }
      agora = fim
    },
  }
}

function msg(id: number, autorContaId: string): MensagemDoChat {
  return { id, autorContaId, autorNome: 'Bia', texto: `fala ${id}`, mencoes: [], criadaEm: AGORA, apagadaEm: null, mudou: id }
}

function chatDeTeste(opcoes: { comCanal?: boolean; pendentesGuardadas?: readonly PendentesGuardadas[] } = {}) {
  const relogio = relogioDeTeste()
  const pedidos: PedidoDoChat[] = []
  let contador = 0
  const chat = criarChatDaCampanha({
    enviar: (pedido) => {
      if (opcoes.comCanal === false) return false
      pedidos.push(pedido)
      return true
    },
    quemSouEu: () => EU,
    aoMudar: () => {},
    pendentesGuardadas: opcoes.pendentesGuardadas,
    relogio,
    novoId: () => `id${(contador += 1)}`,
  })
  const lidas = () => pedidos.filter((pedido) => pedido.t === 'chat.lida')
  return { chat, relogio, pedidos, lidas }
}

/** Em dia, com não lidas na sala e num privado. */
function emDiaComNaoLidas() {
  const teste = chatDeTeste()
  teste.chat.aoFicarEmDia()
  teste.chat.aoReceber({
    t: 'chat.resumo',
    cursor: 10,
    canais: [
      { canal: 'sala', ultimaId: 5, lidaAte: 2, naoLidas: 3 },
      { canal: { dm: OUTRA }, ultimaId: 7, lidaAte: 4, naoLidas: 2 },
    ],
  })
  return teste
}

describe('chat.lida (achado: cada leitura reenviava todas as conversas já lidas)', () => {
  it('cada leitura manda só a lida dela, nunca repete a que já saiu', () => {
    const { chat, relogio, lidas } = emDiaComNaoLidas()
    chat.marcarLida('sala')
    relogio.andar(1_000)
    chat.marcarLida({ dm: OUTRA })
    relogio.andar(1_000)
    chat.aoReceber({ t: 'chat.msg', canal: 'sala', msg: msg(8, OUTRA) })
    chat.marcarLida('sala')
    relogio.andar(5_000)
    expect(lidas()).toEqual([
      { t: 'chat.lida', canal: 'sala', ateId: 5 },
      { t: 'chat.lida', canal: { dm: OUTRA }, ateId: 7 },
      { t: 'chat.lida', canal: 'sala', ateId: 8 },
    ])
  })

  it('a lida recusada pelo ritmo volta uma vez só, depois da hora que o servidor deu', () => {
    const { chat, relogio, lidas } = emDiaComNaoLidas()
    chat.marcarLida('sala')
    relogio.andar(400)
    expect(lidas()).toHaveLength(1)
    const recusa: MensagemDoChatDoServidor = { t: 'chat.recusado', pedido: 'chat.lida', motivo: 'ritmo', tentarDepoisDe: relogio.agora() + 2_000 }
    chat.aoReceber(recusa)
    // Ler outra conversa durante a espera não fura a hora do servidor.
    chat.marcarLida({ dm: OUTRA })
    // E um resumo velho que chega no meio (de outra aba, ou da volta) não desfaz a leitura na tela.
    chat.aoReceber({ t: 'chat.resumo', cursor: 10, canais: [{ canal: { dm: OUTRA }, ultimaId: 7, lidaAte: 4, naoLidas: 2 }] })
    expect(chat.estado().naoLidas).toBe(0)
    relogio.andar(1_500)
    expect(lidas()).toHaveLength(1)
    relogio.andar(10_000)
    expect(lidas().slice(1)).toEqual([
      { t: 'chat.lida', canal: 'sala', ateId: 5 },
      { t: 'chat.lida', canal: { dm: OUTRA }, ateId: 7 },
    ])
  })
})

describe('mensagem que ainda não saiu (achado: sair da mesa a perdia calada)', () => {
  it('guardada ao fechar, volta com a mesa e sai com o mesmo idDoCliente; recusada não conta como a caminho', () => {
    const semRede = chatDeTeste({ comCanal: false })
    expect(semRede.chat.enviar('sala', 'vou atrasar 10 min')).toBe(true)
    expect(pendentesACaminho(semRede.chat.estado().conversas.values())).toBe(1)
    const guardadas = semRede.chat.guardarPendentes()
    semRede.chat.fechar()
    expect(pendentesACaminho(guardadas)).toBe(1)

    const reaberta = chatDeTeste({ pendentesGuardadas: guardadas })
    expect(pendentesACaminho(reaberta.chat.estado().conversas.values())).toBe(1)
    reaberta.chat.aoFicarEmDia()
    const enviada = reaberta.pedidos.find((pedido) => pedido.t === 'chat.enviar')
    expect(enviada).toEqual({ t: 'chat.enviar', canal: 'sala', texto: 'vou atrasar 10 min', idDoCliente: guardadas[0].pendentes[0].idDoCliente })

    reaberta.chat.aoReceber({ t: 'chat.recusado', pedido: 'chat.enviar', idDoCliente: guardadas[0].pendentes[0].idDoCliente, motivo: 'texto' })
    expect(pendentesACaminho(reaberta.chat.estado().conversas.values())).toBe(0)
    expect(reaberta.chat.guardarPendentes()).toHaveLength(1)
  })
})

describe('demo (achado: o ritmo só valia para chat.enviar)', () => {
  it('o ritmo da conta conta todo pedido do chat, lida e página inclusive', () => {
    const membros: Membro[] = [{ contaId: EU, nome: 'Eu', papel: 'jogador', email: 'eu@example.com', estado: 'ativo' }]
    const demo = criarChatDaDemo('mesa_de_teste', EU, () => membros, () => AGORA, () => {})
    const respostas: MensagemDoChatDoServidor[] = []
    const eu = membros[0]
    for (let i = 0; i < 3; i += 1) demo.atender({ t: 'chat.lida', canal: 'sala', ateId: 1 }, eu, (resposta) => respostas.push(resposta))
    for (let i = 0; i < 2; i += 1) demo.atender({ t: 'chat.antes', canal: 'sala', antesDeId: null, limite: 50 }, eu, (resposta) => respostas.push(resposta))
    demo.atender({ t: 'chat.desde', cursor: 0 }, eu, (resposta) => respostas.push(resposta))
    const recusas = respostas.filter((resposta) => resposta.t === 'chat.recusado')
    expect(recusas).toEqual([{ t: 'chat.recusado', pedido: 'chat.desde', motivo: 'ritmo', tentarDepoisDe: expect.any(Number) }])
    expect(respostas.filter((resposta) => resposta.t === 'chat.lista')).toHaveLength(2)
  })
})
