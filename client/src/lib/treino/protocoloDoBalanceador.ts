import type { PedidoDaSerie } from './cemLutas'
import type { BalancoDaSerie, BotaoDoAjuste, MetaDoAchar, PropostaDoAchar } from './balanceadorComum'
import { ehRegistro } from './protocoloDasLutas'

/**
 * O PROTOCOLO ENTRE A PÁGINA "COMPARAR E BALANCEAR" E O WORKER DO
 * BALANCEADOR. Como o das 100 lutas (`protocoloDasLutas.ts`): um worker por
 * pedido, progresso e UMA resposta final. Só tipos e leituras: a página não
 * carrega o motor.
 */

/** A parte comum: o sistema, os lutadores e a semente, no formato do pedido da série (o worker relê com `pedidoDoFio`). */
export type SerieDoBalanceador = Omit<PedidoDaSerie, 'tetos'>

export type PedidoAoBalanceador =
  | { tipo: 'balanco'; serie: SerieDoBalanceador; n: number }
  | { tipo: 'achar'; serie: SerieDoBalanceador; alvos: readonly string[]; meta: MetaDoAchar; botoes: Readonly<Record<BotaoDoAjuste, boolean>> }

export type RespostaDoBalanceador =
  | { tipo: 'progresso'; feitas: number; total: number; fase: string }
  | { tipo: 'balanco'; balanco: BalancoDaSerie; ms: number }
  | { tipo: 'achar'; proposta: PropostaDoAchar; ms: number }
  | { tipo: 'erro'; motivo: string }

function ehNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/**
 * Confere a forma de fora do balanço (os números e as listas que a página
 * percorre). O worker é deste mesmo pacote e a mensagem chega por clone
 * estruturado: o miolo de cada item da lista sai como o worker montou.
 */
function ehBalanco(valor: unknown): valor is BalancoDaSerie {
  return (
    ehRegistro(valor) &&
    ehNumero(valor.n) &&
    ehNumero(valor.mediana) &&
    ehRegistro(valor.vitorias) &&
    ehRegistro(valor.dePe) &&
    Array.isArray(valor.histograma) &&
    Array.isArray(valor.vagas) &&
    Array.isArray(valor.tecnicas)
  )
}

/** Como `ehBalanco`: a forma de fora da proposta. */
function ehProposta(valor: unknown): valor is PropostaDoAchar {
  return ehRegistro(valor) && ehRegistro(valor.ajuste) && ehRegistro(valor.hoje) && ehRegistro(valor.conferencia) && Array.isArray(valor.tentativas) && Array.isArray(valor.avisos)
}

/** A resposta do worker relida; forma torta = `null`. */
export function respostaDoBalanceador(valor: unknown): RespostaDoBalanceador | null {
  if (!ehRegistro(valor)) return null
  switch (valor.tipo) {
    case 'progresso':
      return ehNumero(valor.feitas) && ehNumero(valor.total) && typeof valor.fase === 'string' ? { tipo: 'progresso', feitas: valor.feitas, total: valor.total, fase: valor.fase } : null
    case 'erro':
      return typeof valor.motivo === 'string' ? { tipo: 'erro', motivo: valor.motivo } : null
    case 'balanco':
      return ehBalanco(valor.balanco) && ehNumero(valor.ms) ? { tipo: 'balanco', balanco: valor.balanco, ms: valor.ms } : null
    case 'achar':
      return ehProposta(valor.proposta) && ehNumero(valor.ms) ? { tipo: 'achar', proposta: valor.proposta, ms: valor.ms } : null
    default:
      return null
  }
}
