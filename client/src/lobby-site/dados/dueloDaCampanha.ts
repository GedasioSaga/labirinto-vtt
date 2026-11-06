import type { DueloNoFio, JogadaDoDuelo } from '../../lib/treino/duelo'
import type { ConviteDoDuelo, FimDoConvite, MensagemDoDueloDoServidor, MotivoDoDueloRecusado, PedidoDoDuelo, TipoDoPedidoDoDuelo } from '../../lib/treino/dueloDoLobby'
import type { ParteDoDuelo } from './sessaoDaCampanha'

/**
 * O DUELO DA CAMPANHA no site (fatia T7): o estado que a tela do duelo lê,
 * montado dos frames `duelo.*` que chegam pelo MESMO canal das fichas. O
 * servidor (DO Campanha, `lobby/nuvem/src/duelo.ts`) é o dono de tudo: aqui só
 * se guarda o último convite e o último estado de cada duelo, e o pedido que
 * saiu e ainda não teve resposta (o botão fica em "Enviando…" e não sai duas vezes).
 */

/** O servidor recusou o último pedido. `n` muda a cada recusa (a tela anuncia a nova). */
export interface RecusaDoDuelo {
  pedido: TipoDoPedidoDoDuelo | 'duelo'
  motivo: MotivoDoDueloRecusado
  id?: string
  tentarDepoisDe?: number
  n: number
}

/** Um convite acabou sem duelo (recusado, desistido, vencido): o aviso de uma linha. */
export interface ConviteFechado {
  id: string
  motivo: FimDoConvite
  convite: ConviteDoDuelo | null
  n: number
}

export interface EstadoDoDuelo {
  /** A lista do servidor chegou depois do último `ola`: antes disso, a tela diz "abrindo". */
  emDia: boolean
  convites: readonly ConviteDoDuelo[]
  /** Os duelos desta conta: o em andamento e os acabados que o servidor ainda guarda (24 h). */
  duelos: readonly DueloNoFio[]
  /** O pedido que saiu e espera a resposta do servidor. */
  esperando: { tipo: TipoDoPedidoDoDuelo; id: string | null } | null
  recusa: RecusaDoDuelo | null
  fechado: ConviteFechado | null
}

export interface DueloDaCampanha extends ParteDoDuelo {
  estado(): EstadoDoDuelo
  /** `false` = o canal não está em dia, ou já há um pedido esperando resposta. */
  convidar(para: string, fichas: readonly string[]): boolean
  aceitar(id: string, fichas: readonly string[]): boolean
  /** Recusar o convite recebido, ou desistir do convite enviado. */
  recusar(id: string): boolean
  jogar(id: string, jogada: JogadaDoDuelo): boolean
  desistir(id: string): boolean
  /** Some com o aviso de recusa e de convite fechado (a pessoa leu). */
  esquecerAvisos(): void
  fechar(): void
}

export interface OpcoesDoDuelo {
  enviar(pedido: PedidoDoDuelo): boolean
  aoMudar(estado: EstadoDoDuelo): void
}

const VAZIO: EstadoDoDuelo = { emDia: false, convites: [], duelos: [], esperando: null, recusa: null, fechado: null }

function semOId<T extends { id: string }>(lista: readonly T[], id: string): T[] {
  return lista.filter((item) => item.id !== id)
}

export function criarDueloDaCampanha(opcoes: OpcoesDoDuelo): DueloDaCampanha {
  let estado: EstadoDoDuelo = VAZIO
  let fechada = false
  let avisos = 0

  function mudar(novo: Partial<EstadoDoDuelo>): void {
    if (fechada) return
    estado = { ...estado, ...novo }
    opcoes.aoMudar(estado)
  }

  function mandar(pedido: PedidoDoDuelo, id: string | null): boolean {
    if (fechada || !estado.emDia || estado.esperando !== null) return false
    if (!opcoes.enviar(pedido)) return false
    mudar({ esperando: { tipo: pedido.t, id }, recusa: null, fechado: null })
    return true
  }

  /** A resposta chegou: o pedido que esperava por ela termina. */
  function respondido(tipo: TipoDoPedidoDoDuelo | 'duelo', id: string | null): Pick<EstadoDoDuelo, 'esperando'> {
    const { esperando } = estado
    if (esperando === null) return { esperando }
    if (tipo === 'duelo' || esperando.tipo === tipo || esperando.id === null || esperando.id === id) return { esperando: null }
    return { esperando }
  }

  function receberEstado(duelo: DueloNoFio): void {
    const duelos = [duelo, ...semOId(estado.duelos, duelo.id)]
    // O duelo novo tem o id do convite que virou duelo: o convite sai da lista.
    const esperando = estado.esperando !== null && (estado.esperando.id === duelo.id || estado.esperando.id === null) ? null : estado.esperando
    mudar({ duelos, convites: semOId(estado.convites, duelo.id), esperando })
  }

  return {
    estado: () => estado,
    aoFicarEmDia() {
      // A lista do servidor vem logo depois do `ola`; até ela chegar, o que está na tela pode ser velho.
      mudar({ esperando: null })
    },
    aoCair() {
      mudar({ emDia: false, esperando: null })
    },
    aoReceber(mensagem: MensagemDoDueloDoServidor) {
      switch (mensagem.t) {
        case 'duelo.lista':
          mudar({ emDia: true, convites: mensagem.convites, duelos: mensagem.duelos, esperando: null })
          return
        case 'duelo.convite':
          mudar({ convites: [mensagem.convite, ...semOId(estado.convites, mensagem.convite.id)], ...respondido('duelo.convidar', mensagem.convite.id) })
          return
        case 'duelo.fechado': {
          avisos += 1
          const convite = estado.convites.find((candidato) => candidato.id === mensagem.id) ?? null
          const { esperando } = estado
          const terminou = esperando !== null && (esperando.id === mensagem.id || esperando.tipo === 'duelo.aceitar')
          mudar({ convites: semOId(estado.convites, mensagem.id), fechado: { id: mensagem.id, motivo: mensagem.motivo, convite, n: avisos }, esperando: terminou ? null : esperando })
          return
        }
        case 'duelo.estado':
          receberEstado(mensagem.duelo)
          return
        case 'duelo.recusado':
          avisos += 1
          mudar({
            recusa: { pedido: mensagem.pedido, motivo: mensagem.motivo, n: avisos, ...(mensagem.id === undefined ? {} : { id: mensagem.id }), ...(mensagem.tentarDepoisDe === undefined ? {} : { tentarDepoisDe: mensagem.tentarDepoisDe }) },
            ...respondido(mensagem.pedido, mensagem.id ?? null),
          })
          return
      }
    },
    convidar: (para, fichas) => mandar({ t: 'duelo.convidar', para, fichas: [...fichas] }, null),
    aceitar: (id, fichas) => mandar({ t: 'duelo.aceitar', id, fichas: [...fichas] }, id),
    recusar: (id) => mandar({ t: 'duelo.recusar', id }, id),
    jogar: (id, jogada) => mandar({ t: 'duelo.jogar', id, jogada }, id),
    desistir: (id) => mandar({ t: 'duelo.desistir', id }, id),
    esquecerAvisos() {
      if (estado.recusa !== null || estado.fechado !== null) mudar({ recusa: null, fechado: null })
    },
    fechar() {
      fechada = true
    },
  }
}
