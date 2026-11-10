import { segmentoValido } from '../nuvem/caminho'
import { proprio } from '../nuvem/json'
import { jogadaDoValor, type JogadaDoDuelo, type MotivoDaRecusa } from './duelo'
import { VAGAS_POR_LADO_MAX } from './mesaEmMemoria'
import type { DueloRecebido } from './vistaDoDuelo'

/**
 * DUELO DO LOBBY (plano do Lobby §4.5 e §8.2, fatia T6): o protocolo que o DO
 * Campanha fala com o site pela MESMA conexão WebSocket das fichas
 * (mensagens `duelo.*`). A regra da luta é a da T5 (`duelo.ts`); o SQLite, os
 * prazos e a difusão ficam no DO (`lobby/nuvem/src/duelo.ts`). O site (T7)
 * usa os mesmos tipos.
 *
 * Fica fora de `lib/nuvem` de propósito: a regra do duelo puxa a store da
 * batalha (zustand), e a guarda de pureza do núcleo (`pureza.test.ts`) não
 * deixa pacote nenhum no fecho dos imports de lá.
 *
 * O fluxo: A convida B com as fichas dele; B aceita com as dele (ou recusa;
 * A pode desistir do convite pelo mesmo `duelo.recusar`); o servidor monta o
 * duelo (Lado A = quem convidou) e manda `duelo.estado` aos dois a cada
 * jogada aceita. Ninguém escolhe o dano: o servidor recalcula (T5). Sem tempo
 * por turno (12.15), quem cansou de esperar sai pelo `duelo.desistir`: o outro vence.
 */

/** O convite que ninguém respondeu some depois disto. */
export const CONVITE_VALE_MS = 10 * 60_000

/** O duelo acabado fica para os dois verem o resultado (ao voltar) e depois é apagado. */
export const DUELO_ACABADO_FICA_MS = 24 * 60 * 60_000

/** Uma conta no duelo, como os dois a veem: nunca o e-mail (§6.4). */
export interface ContaNoDuelo {
  contaId: string
  nome: string
}

export interface ConviteDoDuelo {
  id: string
  de: ContaNoDuelo
  para: ContaNoDuelo
  /** As fichas que quem convidou escolheu (ids; o site acha o nome no `estado`). */
  fichasDe: string[]
  criadoEm: number
  venceEm: number
}

export type PedidoDoDuelo =
  /** `fichas` = as minhas, de 1 a `VAGAS_POR_LADO_MAX` (a mesma pode repetir, como no treino). */
  | { t: 'duelo.convidar'; para: string; fichas: string[] }
  | { t: 'duelo.aceitar'; id: string; fichas: string[] }
  /** Quem foi convidado recusa; quem convidou desiste. */
  | { t: 'duelo.recusar'; id: string }
  /** A jogada da T5, com o `seq` do último estado; dano e custo do pedido já chegam `null` (`jogadaDoValor`). */
  | { t: 'duelo.jogar'; id: string; jogada: JogadaDoDuelo }
  /** Quem está no duelo em andamento desiste, em qualquer vez: o outro lado vence (`fim.tipo` 'desistencia'). */
  | { t: 'duelo.desistir'; id: string }

export type TipoDoPedidoDoDuelo = PedidoDoDuelo['t']

/**
 * `formato` = pedido torto (conta como violação, §6.5); `nao-existe` = duelo
 * ou convite que não existe (ou não é desta conta), ou convidado que não é
 * membro ativo; `ocupado` = alguém já está num duelo, ou quem convida já tem
 * um convite esperando; `fichas` = ficha que não é da conta, não está na mesa
 * ou passa do teto; `sistema` = a campanha não é do motor do One Piece;
 * `ritmo`/`cota` = espere `tentarDepoisDe`. O resto vem da regra da jogada (T5).
 */
export type MotivoDoDueloRecusado = 'formato' | 'nao-existe' | 'ocupado' | 'fichas' | 'sistema' | 'ritmo' | 'cota' | MotivoDaRecusa

/** Como o convite acabou sem duelo. `fichas` = as fichas de quem convidou não servem mais (apagadas, mudaram de dono). */
export type FimDoConvite = 'recusado' | 'desistiu' | 'expirou' | 'fichas'

export type MensagemDoDueloDoServidor =
  /** Às duas contas: o convite novo. */
  | { t: 'duelo.convite'; convite: ConviteDoDuelo }
  /** Às duas contas: o convite acabou sem duelo. */
  | { t: 'duelo.fechado'; id: string; motivo: FimDoConvite }
  /**
   * Às duas contas: o duelo começou, alguém jogou, caiu, voltou ou o duelo
   * acabou. Cada conta recebe o do lado DELA (`DueloDoLado`, fatia M2: o fio
   * recortado para ela e a vista dela), nunca o do outro. O site lê a vista
   * como opcional (`DueloRecebido`): o Worker de antes da M2 não a manda.
   */
  | { t: 'duelo.estado'; duelo: DueloRecebido }
  /** Só a quem acabou de mandar `ola`: os convites e os duelos dele (em andamento e os acabados que ainda ficam), cada um do lado dele. */
  | { t: 'duelo.lista'; convites: ConviteDoDuelo[]; duelos: DueloRecebido[] }
  /**
   * `texto` (R1 do plano de unificação do combate): o motivo que a regra da
   * batalha deu, em português simples, o mesmo do app. Campo a mais: o site de
   * antes o ignora e segue lendo o código `motivo` (N-1). Ausente = só o código.
   */
  | { t: 'duelo.recusado'; pedido: TipoDoPedidoDoDuelo | 'duelo'; motivo: MotivoDoDueloRecusado; id?: string; tentarDepoisDe?: number; texto?: string }

/** O pedido lido; fora do formato, o tipo (se conhecido) e o `id` (se legível) para a resposta. */
export type LeituraDoPedidoDoDuelo = { ok: true; pedido: PedidoDoDuelo } | { ok: false; pedido: TipoDoPedidoDoDuelo | 'duelo'; id?: string }

const TIPOS_DO_PEDIDO: readonly TipoDoPedidoDoDuelo[] = ['duelo.convidar', 'duelo.aceitar', 'duelo.recusar', 'duelo.jogar', 'duelo.desistir']

function tipoDoPedido(valor: unknown): TipoDoPedidoDoDuelo | null {
  return TIPOS_DO_PEDIDO.find((tipo) => tipo === valor) ?? null
}

/** De 1 a `VAGAS_POR_LADO_MAX` ids válidos; senão `null`. */
function lerFichas(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > VAGAS_POR_LADO_MAX) return null
  const fichas: string[] = []
  for (const id of valor) {
    if (!segmentoValido(id)) return null
    fichas.push(id)
  }
  return fichas
}

function pedidoDoRegistro(tipo: TipoDoPedidoDoDuelo, registro: Record<string, unknown>): PedidoDoDuelo | null {
  if (tipo === 'duelo.convidar') {
    const para = proprio(registro, 'para')
    const fichas = lerFichas(proprio(registro, 'fichas'))
    return segmentoValido(para) && fichas !== null ? { t: tipo, para, fichas } : null
  }
  const id = proprio(registro, 'id')
  if (!segmentoValido(id)) return null
  switch (tipo) {
    case 'duelo.aceitar': {
      const fichas = lerFichas(proprio(registro, 'fichas'))
      return fichas === null ? null : { t: tipo, id, fichas }
    }
    case 'duelo.recusar':
      return { t: tipo, id }
    case 'duelo.desistir':
      return { t: tipo, id }
    case 'duelo.jogar': {
      const jogada = jogadaDoValor(proprio(registro, 'jogada'))
      return jogada === null ? null : { t: tipo, id, jogada }
    }
  }
}

/** Um frame `duelo.*` do site. Fora do formato não lança: devolve o que dá para responder. */
export function lerPedidoDoDuelo(registro: Record<string, unknown>): LeituraDoPedidoDoDuelo {
  const tipo = tipoDoPedido(proprio(registro, 't'))
  if (tipo === null) return { ok: false, pedido: 'duelo' }
  const pedido = pedidoDoRegistro(tipo, registro)
  if (pedido !== null) return { ok: true, pedido }
  const id = proprio(registro, 'id')
  return segmentoValido(id) ? { ok: false, pedido: tipo, id } : { ok: false, pedido: tipo }
}
