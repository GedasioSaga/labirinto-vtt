import { cartoesQueLigam } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { LembreteDaPassiva, PedidoDePassiva } from './combate'
import { CAMPO_DO_CUSTO, lerCusto, recursoDoCusto, type LeituraDoCusto } from './leituraDaFicha'
import { parteAnterior } from './transformacao'
import type { TurnosDaCena } from './turnos'

/**
 * CUSTO POR TURNO, conserto das fichas F1 (bug 10, P6 de
 * docs/auditoria-fichas/respostas-do-grilling.md): o custo "20 SP (por turno)"
 * de uma forma ligada (ou de uma passiva ligada, a técnica mantida) vira um
 * lembrete "Aplicar / pular" no começo de cada vez do dono. Sem SP, a forma
 * desce uma Parte (resposta da Ryoko: da Parte 1, volta para a base).
 *
 * Puro: sem store, sem rede.
 */

/** O custo que repete a cada vez. */
export type CustoPorTurno = Extract<LeituraDoCusto, { tipo: 'valor' }>

/** O custo do campo Custo quando é "por turno" e acima de 0; `null` = não repete. */
export function custoPorTurno(cartao: Pick<CartaoDaFicha, 'campos'>, personagem: Personagem): CustoPorTurno | null {
  const lido = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  return lido.tipo === 'valor' && lido.porTurno && lido.valor > 0 ? lido : null
}

/** A chave do lembrete do custo da forma (a do "a cada turno" da passiva é `cartaoId:turno`). */
export function chaveDoCustoDaForma(cartaoId: string): string {
  return `${cartaoId}:custo`
}

/** O lembrete é o do custo por turno de uma forma (e não o de uma passiva). */
export function ehLembreteDoCustoDaForma(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'chave'>): boolean {
  return lembrete.chave === chaveDoCustoDaForma(lembrete.cartaoId)
}

/** As formas LIGADAS do personagem com custo por turno, na ordem da ficha. */
export function formasComCustoPorTurno(personagem: Personagem, sistema: SistemaDeRpg): { cartao: CartaoDaFicha; custo: CustoPorTurno }[] {
  return cartoesQueLigam(personagem, sistema).flatMap((cartao) => {
    if (!personagem.cartoesAtivos.includes(cartao.id)) return []
    const custo = custoPorTurno(cartao, personagem)
    return custo === null ? [] : [{ cartao, custo }]
  })
}

/** "SP insuficiente: custa 20, você tem 5"; `null` = dá para pagar (ou o sistema não tem o recurso). */
export function motivoDoCustoPorTurno(personagem: Personagem, sistema: SistemaDeRpg, custo: CustoPorTurno): string | null {
  const recurso = recursoDoCusto(sistema, custo.recurso)
  if (recurso === null) return null
  const tem = numeroDaFicha(personagem.recursos, recurso.id)
  return tem < custo.valor ? `${recurso.nome} insuficiente: custa ${custo.valor}, você tem ${tem}` : null
}

/** "20 SP" (o nome do recurso no sistema). */
export function textoDoCustoPorTurno(custo: CustoPorTurno, sistema: SistemaDeRpg | null): string {
  const recurso = sistema === null ? null : recursoDoCusto(sistema, custo.recurso)
  return `${custo.valor} ${recurso?.nome ?? custo.recurso.toUpperCase()}`
}

/** O lembrete do custo de uma forma como a tela mostra. */
export interface CustoDaFormaNaTela {
  cartaoId: string
  nome: string
  /** "20 SP". */
  custo: string
  /** O nome do recurso que paga ("SP"). */
  recurso: string
  /** Sem recurso para pagar: a Parte para onde a forma volta; `null` = sai da forma. Ausente = dá para pagar. */
  semRecurso?: { voltaPara: string | null }
}

/** As formas ligadas com custo por turno, prontas para a faixa de lembretes. */
export function custosDasFormasNaTela(personagem: Personagem | null | undefined, sistema: SistemaDeRpg | null): CustoDaFormaNaTela[] {
  if (personagem === null || personagem === undefined || sistema === null) return []
  return formasComCustoPorTurno(personagem, sistema).map(({ cartao, custo }) => {
    const recurso = recursoDoCusto(sistema, custo.recurso)?.nome ?? custo.recurso.toUpperCase()
    const item: CustoDaFormaNaTela = { cartaoId: cartao.id, nome: cartao.nome.trim() || 'a forma', custo: textoDoCustoPorTurno(custo, sistema), recurso }
    if (motivoDoCustoPorTurno(personagem, sistema, custo) !== null) {
      const anterior = parteAnterior(personagem, sistema, cartao)
      item.semRecurso = { voltaPara: anterior === null ? null : anterior.nome.trim() || 'a Parte anterior' }
    }
    return item
  })
}

/** O que a regra do pedido precisa da batalha. */
export interface ContextoDoCusto {
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  turnos: TurnosDaCena
  /** Jogador: Aplicar só com o lembrete esperando (o mestre aplica quando quiser). */
  aplicarSoComLembrete: boolean
}

/**
 * Por que o pedido sobre o custo da forma não vale, ou `null` (pode). A
 * forma é da ficha do token, está ligada e custa por turno; "pular" precisa
 * do lembrete esperando; o jogador só aplica com ele.
 */
export function motivoDoPedidoDoCusto(ctx: ContextoDoCusto, pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>): string | null {
  const { personagem, sistema, turnos } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não tem forma'
  const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
  if (carta === undefined || carta.personagemId !== personagem.id) return 'A ficha não está na luta'
  if (!formasComCustoPorTurno(personagem, sistema).some(({ cartao }) => cartao.id === pedido.cartaoId)) return 'A forma não está ligada ou não custa a cada turno'
  const esperando = (turnos.combate?.[personagem.id]?.lembretes ?? []).some((lembrete) => lembrete.cartaoId === pedido.cartaoId && ehLembreteDoCustoDaForma(lembrete))
  if (!pedido.aplicar) return esperando ? null : 'Nenhum lembrete desta forma'
  return ctx.aplicarSoComLembrete && !esperando ? 'Aplicar só no começo da sua vez' : null
}
