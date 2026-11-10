import type { PedidoDoArbitro } from '../../lib/treino/arbitroDaLuta'
import type { JogadaDoDuelo } from '../../lib/treino/duelo'
import type { ModoDaLuta } from '../../lib/treino/luta'
import type { ConvidadoDaLuta, EsperaDaLuta, FimDaEspera, LutaAcontecendo, LutaNoHistorico, MotivoDaLutaRecusada, PedidoDaLuta, TipoDoPedidoDaLuta } from '../../lib/treino/lutaDoLobby'
import type { LadoDaLuta } from '../../lib/treino/mesaEmMemoria'
import type { FrameDaLutaNoFio } from './fonte'
import { lerFrameDaLuta, type LutaRecebida } from './fioDaLuta'

/**
 * AS LUTAS DA CAMPANHA no site (Arena multijogador F5): o estado que as telas
 * da luta de N lados leem, montado dos frames `luta.*` que chegam pelo MESMO
 * canal das fichas, como o duelo (`dueloDaCampanha.ts`). O servidor (DO
 * Campanha, `lobby/nuvem/src/luta.ts`) é o dono de tudo: aqui só se guarda o
 * último de cada coisa e o pedido que saiu e ainda não teve resposta (o botão
 * fica em "Enviando…" e não sai duas vezes).
 *
 * O DO só manda `luta.*` ao socket que já falou `luta.*` (o site velho nunca
 * recebe nada): a cada canal em dia esta parte pede `luta.lista` e a primeira
 * página do histórico.
 */

/** Uma página do histórico, no máximo (o teto do servidor é 20). */
export const PAGINA_DO_HISTORICO = 10

export interface RecusaDaLuta {
  pedido: TipoDoPedidoDaLuta | 'luta'
  motivo: MotivoDaLutaRecusada
  id?: string
  /** O motivo que a regra da batalha deu (o texto do app); ausente = a frase do código. */
  texto?: string
  n: number
}

/** A sala de espera acabou para esta conta: o aviso de uma linha. */
export interface EsperaFechada {
  id: string
  motivo: FimDaEspera
  /** A sala como estava (para dizer quem criou); `null` = esta aba não a tinha. */
  espera: EsperaDaLuta | null
  n: number
}

export interface HistoricoDasLutas {
  lista: readonly LutaNoHistorico[]
  temMais: boolean
  /** A página pedida que ainda não chegou. */
  carregando: boolean
  /** A luta antiga aberta para ler o registro (pedida pelo `id`); `null` = nenhuma. */
  aberta: LutaNoHistorico | null
  /** O id pedido que ainda não chegou. */
  abrindo: string | null
}

export interface EstadoDasLutas {
  /** A `luta.lista` chegou depois do último canal em dia: antes, a tela diz "abrindo". */
  emDia: boolean
  /** As salas de espera em que esta conta está (criou ou foi convidada). */
  convites: readonly EsperaDaLuta[]
  /** As lutas acontecendo agora na mesa, para escolher qual assistir. */
  acontecendo: readonly LutaAcontecendo[]
  /** As lutas desta conta (jogando, arbitrando ou assistindo), a mais nova primeiro, cada uma do papel dela. */
  lutas: readonly LutaRecebida[]
  historico: HistoricoDasLutas
  esperando: { tipo: TipoDoPedidoDaLuta; id: string | null } | null
  recusa: RecusaDaLuta | null
  fechada: EsperaFechada | null
  /** Chegou frame da luta que este site não lê (o Worker é mais novo): a tela pede para recarregar. */
  torta: boolean
}

export interface CriacaoDaLutaNoSite {
  modo: ModoDaLuta
  lados: LadoDaLuta[]
  convidados: ConvidadoDaLuta[]
  fichas: string[]
  ajustes?: Record<string, unknown>
}

/** O que chega pelo canal da campanha: como as outras partes (chat, mural, duelo). */
export interface ParteDasLutas {
  aoFicarEmDia(): void
  /** O frame `luta.*` cru: o leitor dele (`lerFrameDaLuta`) carrega junto com as lutas. */
  aoReceber(frame: FrameDaLutaNoFio): void
  aoCair(): void
}

export interface LutasDaCampanha extends ParteDasLutas {
  estado(): EstadoDasLutas
  /** `false` = o canal não está em dia, ou já há um pedido esperando resposta. */
  criar(criacao: CriacaoDaLutaNoSite): boolean
  aceitar(id: string, lado: LadoDaLuta | null, fichas: readonly string[], ajustes?: Record<string, unknown>): boolean
  /** Recusar o convite; quem criou desiste da sala inteira. */
  recusar(id: string): boolean
  comecar(id: string): boolean
  jogar(id: string, jogada: JogadaDoDuelo): boolean
  arbitrar(id: string, pedido: PedidoDoArbitro): boolean
  sair(id: string): boolean
  assistir(id: string): boolean
  parar(id: string): boolean
  /** A próxima página do histórico (as mais velhas). */
  maisHistorico(): boolean
  /** Abre uma luta antiga para ler o registro final. */
  abrirDoHistorico(id: string): boolean
  fecharDoHistorico(): void
  /** Some com os avisos de recusa, de sala fechada e de frame torto (a pessoa leu). */
  esquecerAvisos(): void
  fechar(): void
}

export interface OpcoesDasLutas {
  enviar(pedido: PedidoDaLuta): boolean
  aoMudar(estado: EstadoDasLutas): void
}

const HISTORICO_VAZIO: HistoricoDasLutas = { lista: [], temMais: false, carregando: false, aberta: null, abrindo: null }

const VAZIO: EstadoDasLutas = { emDia: false, convites: [], acontecendo: [], lutas: [], historico: HISTORICO_VAZIO, esperando: null, recusa: null, fechada: null, torta: false }

function semOId<T extends { id: string }>(lista: readonly T[], id: string): T[] {
  return lista.filter((item) => item.id !== id)
}

/** O histórico junta a página nova à que já tinha, sem repetir (a mesma luta pode chegar duas vezes numa corrida). */
function juntarHistorico(antes: readonly LutaNoHistorico[], novas: readonly LutaNoHistorico[]): LutaNoHistorico[] {
  const vistos = new Set(antes.map((luta) => luta.id))
  return [...antes, ...novas.filter((luta) => !vistos.has(luta.id))].sort((a, b) => b.fim - a.fim)
}

export function criarLutasDaCampanha(opcoes: OpcoesDasLutas): LutasDaCampanha {
  let estado: EstadoDasLutas = VAZIO
  let fechada = false
  let avisos = 0

  function mudar(novo: Partial<EstadoDasLutas>): void {
    if (fechada) return
    estado = { ...estado, ...novo }
    opcoes.aoMudar(estado)
  }

  function mandar(pedido: PedidoDaLuta, id: string | null): boolean {
    if (fechada || !estado.emDia || estado.esperando !== null) return false
    if (!opcoes.enviar(pedido)) return false
    mudar({ esperando: { tipo: pedido.t, id }, recusa: null, fechada: null })
    return true
  }

  /** Pedidos que não prendem os botões (a lista e o histórico): saem sem `esperando`. */
  function pedirSemEsperar(pedido: PedidoDaLuta): boolean {
    if (fechada) return false
    return opcoes.enviar(pedido)
  }

  /** A resposta que chegou termina o pedido que esperava por ela. */
  function terminou(tipos: readonly TipoDoPedidoDaLuta[], id: string | null): Pick<EstadoDasLutas, 'esperando'> {
    const { esperando } = estado
    if (esperando === null) return { esperando }
    if (!tipos.includes(esperando.tipo)) return { esperando }
    return esperando.id === null || id === null || esperando.id === id ? { esperando: null } : { esperando }
  }

  function receberEstado(luta: LutaRecebida): void {
    const lutas = [luta, ...semOId(estado.lutas, luta.id)]
    // A luta começou: a sala de espera dela sai (o id é o mesmo).
    mudar({ lutas, convites: semOId(estado.convites, luta.id), ...terminou(['luta.jogar', 'luta.arbitrar', 'luta.comecar', 'luta.assistir', 'luta.sair'], luta.id) })
  }

  function receberHistorico(lista: readonly LutaNoHistorico[], temMais: boolean): void {
    const { historico } = estado
    // Resposta do "abrir" (pedido com id): só ela, com o registro (a página do histórico nunca traz o registro).
    const doAbrir = historico.abrindo !== null && lista.length <= 1 && lista.every((luta) => luta.registro !== undefined)
    if (doAbrir) {
      mudar({ historico: { ...historico, abrindo: null, aberta: lista.find((luta) => luta.id === historico.abrindo) ?? null } })
      return
    }
    mudar({ historico: { ...historico, carregando: false, temMais, lista: juntarHistorico(historico.lista, lista) } })
  }

  return {
    estado: () => estado,
    aoFicarEmDia() {
      // O DO só difunde `luta.*` a quem já falou `luta.*`: a lista liga este socket e traz o estado das lutas da conta.
      mudar({ esperando: null, historico: { ...HISTORICO_VAZIO, carregando: true } })
      pedirSemEsperar({ t: 'luta.lista' })
      pedirSemEsperar({ t: 'luta.historico', antesDe: null, limite: PAGINA_DO_HISTORICO })
    },
    aoCair() {
      mudar({ emDia: false, esperando: null, historico: { ...estado.historico, carregando: false, abrindo: null } })
    },
    aoReceber(frame) {
      const mensagem = lerFrameDaLuta(frame.bruto)
      switch (mensagem.t) {
        case 'luta.lista':
          mudar({ emDia: true, convites: mensagem.convites, acontecendo: mensagem.acontecendo })
          return
        case 'luta.espera':
          mudar({ convites: [mensagem.espera, ...semOId(estado.convites, mensagem.espera.id)], ...terminou(['luta.criar', 'luta.aceitar', 'luta.recusar'], null) })
          return
        case 'luta.fechada': {
          avisos += 1
          const espera = estado.convites.find((candidata) => candidata.id === mensagem.id) ?? null
          // Quem assistia (ou saiu) deixa de receber a luta: ela sai da lista desta conta.
          const lutas = espera === null ? semOId(estado.lutas, mensagem.id) : estado.lutas
          mudar({
            convites: semOId(estado.convites, mensagem.id),
            lutas,
            fechada: { id: mensagem.id, motivo: mensagem.motivo, espera, n: avisos },
            ...terminou(['luta.recusar', 'luta.sair', 'luta.parar', 'luta.aceitar', 'luta.comecar'], mensagem.id),
          })
          return
        }
        case 'luta.estado':
          receberEstado(mensagem.luta)
          return
        case 'luta.historico':
          receberHistorico(mensagem.lista, mensagem.temMais)
          return
        case 'luta.recusado': {
          avisos += 1
          const { historico } = estado
          const doHistorico = mensagem.pedido === 'luta.historico'
          mudar({
            recusa: { pedido: mensagem.pedido, motivo: mensagem.motivo, n: avisos, ...(mensagem.id === undefined ? {} : { id: mensagem.id }), ...(mensagem.texto === undefined ? {} : { texto: mensagem.texto }) },
            ...(doHistorico ? { historico: { ...historico, carregando: false, abrindo: null } } : {}),
            ...(mensagem.pedido === 'luta' ? { esperando: null } : mensagem.pedido === 'luta.lista' || doHistorico ? {} : terminou([mensagem.pedido], mensagem.id ?? null)),
          })
          return
        }
        case 'luta.torta':
          mudar({ torta: true })
          return
      }
    },
    criar: (criacao) =>
      mandar(
        {
          t: 'luta.criar',
          modo: criacao.modo,
          lados: [...criacao.lados],
          convidados: criacao.convidados.map((convidado) => ({ ...convidado })),
          fichas: [...criacao.fichas],
          ...(criacao.ajustes === undefined ? {} : { ajustes: criacao.ajustes }),
        },
        null,
      ),
    aceitar: (id, lado, fichas, ajustes) => mandar({ t: 'luta.aceitar', id, lado, fichas: [...fichas], ...(ajustes === undefined ? {} : { ajustes }) }, id),
    recusar: (id) => mandar({ t: 'luta.recusar', id }, id),
    comecar: (id) => mandar({ t: 'luta.comecar', id }, id),
    jogar: (id, jogada) => mandar({ t: 'luta.jogar', id, jogada }, id),
    arbitrar: (id, pedido) => mandar({ t: 'luta.arbitrar', id, pedido }, id),
    sair: (id) => mandar({ t: 'luta.sair', id }, id),
    assistir: (id) => mandar({ t: 'luta.assistir', id }, id),
    parar: (id) => mandar({ t: 'luta.parar', id }, id),
    maisHistorico() {
      const { historico } = estado
      if (!estado.emDia || historico.carregando || !historico.temMais) return false
      const ultima = historico.lista.at(-1)
      if (!pedirSemEsperar({ t: 'luta.historico', antesDe: ultima?.fim ?? null, limite: PAGINA_DO_HISTORICO })) return false
      mudar({ historico: { ...historico, carregando: true } })
      return true
    },
    abrirDoHistorico(id) {
      const { historico } = estado
      if (!estado.emDia || historico.abrindo !== null) return false
      if (!pedirSemEsperar({ t: 'luta.historico', antesDe: null, limite: 1, id })) return false
      mudar({ historico: { ...historico, abrindo: id, aberta: null } })
      return true
    },
    fecharDoHistorico() {
      if (estado.historico.aberta !== null || estado.historico.abrindo !== null) mudar({ historico: { ...estado.historico, aberta: null, abrindo: null } })
    },
    esquecerAvisos() {
      if (estado.recusa !== null || estado.fechada !== null || estado.torta) mudar({ recusa: null, fechada: null, torta: false })
    },
    fechar() {
      fechada = true
    },
  }
}
