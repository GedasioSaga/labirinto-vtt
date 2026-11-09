import { cartoesQueLigam } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { CARGA_MAX, type CombateDoPersonagem, type LembreteDaPassiva, type PedidoDePassiva } from './combate'
import { normalizar } from './formula'
import { CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, lerCusto, lerTempo, recursoDoCusto, tecnicaPorId, tecnicasComForma, type LeituraDoCusto } from './leituraDaFicha'
import { mantidaDe } from './mecanicasAMao'
import { CAMPO_DO_REQUISITO, parteAnterior } from './transformacao'
import type { TurnosDaCena } from './turnos'

/**
 * CUSTO POR TURNO, conserto das fichas F1 (bug 10, P6 de
 * docs/auditoria-fichas/respostas-do-grilling.md): o custo "20 SP (por turno)"
 * de uma forma ligada (ou de uma passiva ligada, a técnica mantida) vira um
 * lembrete "Aplicar / pular" no começo de cada vez do dono. Sem SP, a forma
 * desce uma Parte (resposta da Ryoko: da Parte 1, volta para a base).
 *
 * F2 (revisão da fatia D): a técnica MANTIDA da tabela à mão (Giro da Lança,
 * Campo de Contenção; `mantidaDe`) usa o mesmo lembrete, com a mesma chave:
 * Aplicar paga e mantém (o Campo ganha +1 de Concentração); pular, ou não ter
 * o recurso, para, e a recarga começa.
 *
 * Puro: sem store, sem rede.
 */

/** O custo que repete a cada vez. */
export type CustoPorTurno = Extract<LeituraDoCusto, { tipo: 'valor' }>

/**
 * F2 (fatia A, sobra da F1): o Requisito das formas que diz o gasto por vez
 * ("Gasta 5 SP por turno", "Gasta 10 SP por turno para manter a forma": as
 * formas do Jimboy e da Ryoko). Já sem acento e em minúsculas.
 */
const GASTO_POR_TURNO_NO_REQUISITO = /\bgasta (\d+) ?(?:de )?(sp|hp) \(? ?por turno\b/

/**
 * O custo que repete a cada vez: o do campo Custo quando é "por turno"; senão
 * o gasto por turno escrito no Requisito. Acima de 0; `null` = não repete.
 */
export function custoPorTurno(cartao: Pick<CartaoDaFicha, 'campos'>, personagem: Personagem): CustoPorTurno | null {
  const lido = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  if (lido.tipo === 'valor' && lido.porTurno) return lido.valor > 0 ? lido : null
  const noRequisito = GASTO_POR_TURNO_NO_REQUISITO.exec(normalizar(cartao.campos[CAMPO_DO_REQUISITO] ?? ''))
  const numero = noRequisito?.[1]
  if (noRequisito === null || numero === undefined) return null
  const valor = Number.parseInt(numero, 10)
  return valor > 0 ? { tipo: 'valor', recurso: noRequisito[2] === 'hp' ? 'hp' : 'sp', valor, porTurno: true } : null
}

/** A chave do lembrete do custo da forma, ou da técnica mantida (a do "a cada turno" da passiva é `cartaoId:turno`). */
export function chaveDoCustoDaForma(cartaoId: string): string {
  return `${cartaoId}:custo`
}

/** O lembrete é o do custo por turno de uma forma ou de uma técnica mantida (e não o de uma passiva). */
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

/** F2 (revisão da fatia D): o custo de cada vez da técnica mantida: o da tabela, ou o "por turno" do campo Custo. `null` = não é mantida (ou não custa). */
export function custoDaMantida(cartao: Pick<CartaoDaFicha, 'id' | 'campos' | 'mecanica'>, personagem: Personagem): CustoPorTurno | null {
  // Construtor C1: pelo cartão (o montado traz o custo por vez da peça, sempre na tabela da linha).
  const mantida = mantidaDe(cartao)
  if (mantida === null) return null
  const daTabela = mantida.custoPorVez
  if (daTabela === undefined) return custoPorTurno(cartao, personagem)
  return daTabela.valor > 0 ? { tipo: 'valor', recurso: daTabela.recurso, valor: daTabela.valor, porTurno: true } : null
}

/** F2 (revisão da fatia D): as técnicas mantidas agora, com o custo de cada vez, na ordem em que ligaram. A que saiu da ficha fica de fora. */
export function mantidasComCusto(personagem: Personagem, sistema: SistemaDeRpg, combate: Pick<CombateDoPersonagem, 'mantidas'> | undefined): { cartao: CartaoDaFicha; custo: CustoPorTurno }[] {
  return (combate?.mantidas ?? []).flatMap((cartaoId) => {
    const tecnica = tecnicaPorId(personagem, sistema, cartaoId)
    const custo = tecnica === null ? null : custoDaMantida(tecnica.cartao, personagem)
    return tecnica === null || custo === null ? [] : [{ cartao: tecnica.cartao, custo }]
  })
}

/** F2 (revisão da fatia D): liga a técnica mantida (usar de novo enquanto ela está ligada não repete). */
export function comAMantida(combate: CombateDoPersonagem, cartaoId: string): CombateDoPersonagem {
  const mantidas = combate.mantidas ?? []
  return mantidas.includes(cartaoId) ? combate : { ...combate, mantidas: [...mantidas, cartaoId] }
}

/** F2 (revisão da fatia D): mais uma vez mantida. A técnica que dá carga por vez (Campo) soma +1 de Concentração, até 3. */
export function manterNaVez(combate: CombateDoPersonagem, cartaoId: string): CombateDoPersonagem {
  if (mantidaDe(cartaoId)?.cargaPorVez !== true || combate.carga >= CARGA_MAX) return combate
  const carga: CombateDoPersonagem['carga'] = combate.carga === 0 ? 1 : combate.carga === 1 ? 2 : 3
  return { ...combate, carga }
}

/**
 * F2 (revisão da fatia D): para a técnica mantida. Ela sai da lista e a
 * recarga do Tempo começa agora. Para no começo da vez do dono (o lembrete),
 * então guarda N e não N + 1: Tempo 3 trava esta vez e as 2 seguintes.
 */
export function pararAMantida(combate: CombateDoPersonagem, cartao: Pick<CartaoDaFicha, 'id' | 'campos'>): CombateDoPersonagem {
  const { mantidas = [], ...semAsMantidas } = combate
  const resto = mantidas.filter((cartaoId) => cartaoId !== cartao.id)
  const parado: CombateDoPersonagem = resto.length === 0 ? semAsMantidas : { ...semAsMantidas, mantidas: resto }
  const tempo = lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? '')
  return tempo.tipo === 'recarga' ? { ...parado, recargas: { ...parado.recargas, [cartao.id]: tempo.turnos } } : parado
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
  /** Sem recurso para pagar: a Parte para onde a forma volta; `null` = sai da forma (a técnica mantida para). Ausente = dá para pagar. */
  semRecurso?: { voltaPara: string | null }
  /** F2 (revisão da fatia D): é uma técnica mantida (Giro, Campo): pular, ou não ter o recurso, para a técnica. Ausente = forma. */
  mantida?: true
}

/**
 * As formas ligadas com custo por turno, prontas para a faixa de lembretes.
 * F2 (revisão da fatia D): e todas as técnicas mantidas da ficha (a faixa só
 * mostra a que tem o lembrete esperando, então não precisa saber quais estão
 * ligadas; o jogador não recebe o `mantidas` do combate).
 */
export function custosDasFormasNaTela(personagem: Personagem | null | undefined, sistema: SistemaDeRpg | null): CustoDaFormaNaTela[] {
  if (personagem === null || personagem === undefined || sistema === null) return []
  const noTexto = (cartao: CartaoDaFicha, custo: CustoPorTurno, nomeVazio: string): CustoDaFormaNaTela => ({
    cartaoId: cartao.id,
    nome: cartao.nome.trim() || nomeVazio,
    custo: textoDoCustoPorTurno(custo, sistema),
    recurso: recursoDoCusto(sistema, custo.recurso)?.nome ?? custo.recurso.toUpperCase(),
  })
  const formas = formasComCustoPorTurno(personagem, sistema).map(({ cartao, custo }) => {
    const item = noTexto(cartao, custo, 'a forma')
    if (motivoDoCustoPorTurno(personagem, sistema, custo) !== null) {
      const anterior = parteAnterior(personagem, sistema, cartao)
      item.semRecurso = { voltaPara: anterior === null ? null : anterior.nome.trim() || 'a Parte anterior' }
    }
    return item
  })
  const mantidas = tecnicasComForma(personagem, sistema).flatMap(({ cartao }) => {
    const custo = custoDaMantida(cartao, personagem)
    if (custo === null) return []
    const item: CustoDaFormaNaTela = { ...noTexto(cartao, custo, 'a técnica'), mantida: true }
    if (motivoDoCustoPorTurno(personagem, sistema, custo) !== null) item.semRecurso = { voltaPara: null }
    return [item]
  })
  return [...formas, ...mantidas]
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
 * Por que o pedido sobre o custo da forma (ou da técnica mantida) não vale,
 * ou `null` (pode). A forma é da ficha do token, está ligada e custa por
 * turno (a técnica, mantida agora); "pular" precisa do lembrete esperando; o
 * jogador só aplica com ele.
 */
export function motivoDoPedidoDoCusto(ctx: ContextoDoCusto, pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>): string | null {
  const { personagem, sistema, turnos } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não tem forma'
  const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
  if (carta === undefined || carta.personagemId !== personagem.id) return 'A ficha não está na luta'
  const ehOPedido = ({ cartao }: { cartao: CartaoDaFicha }): boolean => cartao.id === pedido.cartaoId
  const ligada = formasComCustoPorTurno(personagem, sistema).some(ehOPedido) || mantidasComCusto(personagem, sistema, turnos.combate?.[personagem.id]).some(ehOPedido)
  if (!ligada) return 'A forma não está ligada ou não custa a cada turno'
  const esperando = (turnos.combate?.[personagem.id]?.lembretes ?? []).some((lembrete) => lembrete.cartaoId === pedido.cartaoId && ehLembreteDoCustoDaForma(lembrete))
  if (!pedido.aplicar) return esperando ? null : 'Nenhum lembrete desta forma'
  return ctx.aplicarSoComLembrete && !esperando ? 'Aplicar só no começo da sua vez' : null
}
