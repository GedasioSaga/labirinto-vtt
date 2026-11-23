import { AJUDAS_PENDENTES_MAX, AVISO_DA_AJUDA_MS, type AcaoDaAjuda, type AjudaPendente } from '../combate'
import type { AutorDaAcao, TurnosDaCena } from '../turnos'
import type { PerguntaDosRequisitos } from './avaliar'
import { fraseDoPedidoDeAjuda } from './frases'
import { PRAZO_DA_AJUDA_MS } from './modelo'

/**
 * REQUISITOS, fase E (docs/design/habilidades/REQUISITOS.md §7): o PEDIDO DE AJUDA a um aliado no
 * estado da batalha (`turnos.pedidosDeAjuda`). Contas puras: nascer, fechar, vencer e cair quando a
 * vez passa. Quem grava é a store (`stores/batalha/ajuda.ts`); quem confere quem responde é o host
 * (`net/batalhaNoHost.ts`).
 *
 * - Uma pendência por ficha que pede: pedir de novo troca a anterior (e o aviso dela).
 * - O aliado tem `PRAZO_DA_AJUDA_MS`; o mestre (NPC aliado) não tem prazo.
 * - O que fecha sem aceite vira aviso para quem pediu ("Aira recusou") até `AVISO_DA_AJUDA_MS`.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** A pergunta do portão que vira pedido (G1, G2), com o aliado já escolhido. */
export type PerguntaDaAjuda = Extract<PerguntaDosRequisitos, { tipo: 'aliado' }>

export interface EntradaDaAjuda {
  id: string
  acao: AcaoDaAjuda
  autor: AutorDaAcao
  deTokenId: string
  dePersonagemId: string
  nomeDe: string
  /** O aliado escolhido (um dos `candidatos` da pergunta). */
  paraTokenId: string
  paraPersonagemId: string | null
  nomePara: string
  /** NPC aliado = quem responde é o mestre (sem prazo). */
  responde: 'dono' | 'mestre'
  pergunta: PerguntaDaAjuda
  tecnica: string
  turnos: Pick<TurnosDaCena, 'vez' | 'rodada'>
  agora: number
}

/** A pendência nova. */
export function novaAjuda(entrada: EntradaDaAjuda): AjudaPendente {
  const { requisito } = entrada.pergunta
  const ajuda: AjudaPendente = {
    id: entrada.id,
    acao: entrada.acao,
    autor: entrada.autor,
    deTokenId: entrada.deTokenId,
    dePersonagemId: entrada.dePersonagemId,
    // O NPC aliado é respondido pelo mestre: `paraTokenId` fica o do aliado (quem paga), `paraPersonagemId` `null`.
    paraTokenId: entrada.paraTokenId,
    paraPersonagemId: entrada.responde === 'mestre' ? null : entrada.paraPersonagemId,
    requisitoId: entrada.pergunta.requisitoId,
    frase: fraseDoPedidoDeAjuda(entrada.nomeDe, requisito, entrada.tecnica),
    criadoEm: entrada.agora,
    venceEm: entrada.responde === 'mestre' ? null : entrada.agora + PRAZO_DA_AJUDA_MS,
    vez: { cartaId: entrada.turnos.vez, rodada: entrada.turnos.rodada },
    nomeDe: entrada.nomeDe,
    nomePara: entrada.nomePara,
    tecnica: entrada.tecnica,
    estado: 'esperando',
  }
  if (requisito.tipo === 'pedirAoAliado' && requisito.gasta === true) ajuda.paga = { recurso: requisito.recurso, n: requisito.n }
  return ajuda
}

function comALista(turnos: TurnosDaCena, lista: readonly AjudaPendente[]): TurnosDaCena {
  if (lista.length > 0) return { ...turnos, pedidosDeAjuda: lista }
  const { pedidosDeAjuda: _fora, ...sem } = turnos
  return sem
}

/** A pendência entra; a anterior da mesma ficha (pendência ou aviso) sai. */
export function comAAjuda(turnos: TurnosDaCena, ajuda: AjudaPendente): TurnosDaCena {
  const outras = (turnos.pedidosDeAjuda ?? []).filter((candidata) => candidata.deTokenId !== ajuda.deTokenId)
  return comALista(turnos, [...outras, ajuda].slice(-AJUDAS_PENDENTES_MAX))
}

/** A ficha `tokenId` tem um pedido esperando resposta. */
export function esperandoAjuda(turnos: Pick<TurnosDaCena, 'pedidosDeAjuda'>, tokenId: string): AjudaPendente | null {
  return (turnos.pedidosDeAjuda ?? []).find((ajuda) => ajuda.deTokenId === tokenId && ajuda.estado === 'esperando') ?? null
}

/** Sem a pendência `id` (aceita, ou o aviso fechado por quem pediu). */
export function semAAjuda(turnos: TurnosDaCena, id: string): TurnosDaCena {
  const lista = turnos.pedidosDeAjuda ?? []
  const ficam = lista.filter((ajuda) => ajuda.id !== id)
  return ficam.length === lista.length ? turnos : comALista(turnos, ficam)
}

/** A pendência `id` vira aviso para quem pediu (recusa, prazo, cancelamento, o portão não passou). */
export function fecharAAjuda(turnos: TurnosDaCena, id: string, estado: Exclude<AjudaPendente['estado'], 'esperando'>, motivo: string, agora: number): TurnosDaCena {
  const lista = turnos.pedidosDeAjuda ?? []
  if (!lista.some((ajuda) => ajuda.id === id)) return turnos
  return comALista(
    turnos,
    lista.map((ajuda) => (ajuda.id === id ? { ...ajuda, estado, motivo, fechadoEm: agora } : ajuda)),
  )
}

/** O prazo: o pedido esperando que passou do `venceEm` vira "venceu"; o aviso velho sai. O mesmo objeto se nada mudou. */
export function comOPrazo(turnos: TurnosDaCena, agora: number): TurnosDaCena {
  const lista = turnos.pedidosDeAjuda
  if (lista === undefined || lista.length === 0) return turnos
  let mudou = false
  const ficam: AjudaPendente[] = []
  for (const ajuda of lista) {
    if (ajuda.estado === 'esperando' && ajuda.venceEm !== null && agora >= ajuda.venceEm) {
      ficam.push({ ...ajuda, estado: 'venceu', motivo: `${ajuda.nomePara} não respondeu a tempo: o pedido venceu`, fechadoEm: agora })
      mudou = true
    } else if (ajuda.estado !== 'esperando' && (ajuda.fechadoEm ?? 0) + AVISO_DA_AJUDA_MS <= agora) {
      mudou = true
    } else {
      ficam.push(ajuda)
    }
  }
  return mudou ? comALista(turnos, ficam) : turnos
}

/**
 * Passar a vez cancela (§7.5): o pedido de outra vez (carta ou rodada) que esperava vira "a vez
 * passou"; o aviso de outra vez sai. O mesmo objeto se nada mudou.
 */
export function comAVezDeAgora(turnos: TurnosDaCena, agora: number): TurnosDaCena {
  const lista = turnos.pedidosDeAjuda
  if (lista === undefined || lista.length === 0) return turnos
  const daVez = (ajuda: AjudaPendente): boolean => ajuda.vez.cartaId === turnos.vez && ajuda.vez.rodada === turnos.rodada
  if (lista.every(daVez)) return turnos
  const ficam: AjudaPendente[] = []
  for (const ajuda of lista) {
    if (daVez(ajuda)) ficam.push(ajuda)
    else if (ajuda.estado === 'esperando') ficam.push({ ...ajuda, estado: 'cancelado', motivo: 'A vez passou: o pedido caiu', fechadoEm: agora, vez: { cartaId: turnos.vez, rodada: turnos.rodada } })
  }
  return comALista(turnos, ficam)
}

/** O pedido ainda espera e está no prazo. */
export function ajudaAberta(ajuda: AjudaPendente, agora: number): boolean {
  return ajuda.estado === 'esperando' && (ajuda.venceEm === null || agora < ajuda.venceEm)
}
