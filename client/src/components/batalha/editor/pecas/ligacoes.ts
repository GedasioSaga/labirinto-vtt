import { ABA_DAS_TECNICAS } from '../../../../lib/batalha/leituraDaFicha'
import { mesmaReferencia } from '../../../../lib/batalha/requisitos/contexto'
import type { ObjetoJson, Referencia, ValorJson } from '../../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../../lib/personagem'
import { ehObjetoJson, idNovo, referenciaJson } from '../../blocos/requisitosNaTela'
import { blocoCru, comUsar, todosCru } from '../requisitosDoCartao'

/**
 * AS LIGAÇÕES QUE A PEÇA MOSTRA E MUDA NOUTRO CARTÃO (rework do editor de habilidades, E4; PLANO.md D8:
 * "um lugar só: o requisito; a peça mostra e leva até ele"). A Transformação lista as técnicas da forma,
 * que são as que pedem "Numa forma <esta>" (B3) nos Requisitos delas; o Acumulador lista as técnicas que
 * ele libera ao chegar a N, que são as que pedem "<acumulador> N ou mais" (A4, sem gastar). Ligar ou
 * desligar grava o requisito no cartão da técnica, nunca na peça.
 *
 * Só olha a raiz "Todos estes" do `usar` (a ligação que a peça grava). Um B3 ou A4 dentro de "Um
 * destes", com "não ter" ou com "e gasta" é outra regra, montada à mão nos Requisitos: a peça não
 * mostra nem mexe.
 *
 * Puro: devolve o cartão novo; quem grava é o editor (`ArredoresDaPeca.aoMudarOutroCartao`).
 */

/** As técnicas da ficha (aba Habilidades, com os subcartões das formas), menos o cartão `menos`. */
export function tecnicasDaFicha(personagem: Pick<Personagem, 'abas'>, menos?: string): CartaoDaFicha[] {
  const achadas: CartaoDaFicha[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    if (cartao.id !== menos && cartao.nome.trim() !== '' && cartao.acumulador === undefined) achadas.push(cartao)
    cartao.subcartoes.forEach(juntar)
  }
  for (const cartao of personagem.abas[ABA_DAS_TECNICAS] ?? []) juntar(cartao)
  return achadas
}

/** A referência de um cartão ({ id, nome }). */
export function referenciaDoCartao(cartao: Pick<CartaoDaFicha, 'id' | 'nome'>): Referencia {
  return { id: cartao.id, nome: cartao.nome.trim() }
}

function referenciaDoJson(valor: ValorJson | undefined): Referencia | null {
  if (!ehObjetoJson(valor) || typeof valor.nome !== 'string') return null
  return typeof valor.id === 'string' ? { id: valor.id, nome: valor.nome } : { nome: valor.nome }
}

/** A peça B3 "Numa forma <forma>" que a Transformação grava (sem "não ter"). */
function ehNaForma(peca: ValorJson, forma: Referencia): boolean {
  if (!ehObjetoJson(peca) || peca.tipo !== 'naForma' || peca.nao === true) return false
  const ref = referenciaDoJson(peca.forma)
  return ref !== null && mesmaReferencia(ref, forma)
}

/**
 * A peça A4 "<acumulador> N ou mais" que o Acumulador grava (sem "não ter"). Pedido de 28/11/2026: o marco
 * e o requisito da técnica são a MESMA regra, então o A4 que gasta ("e gasta N", "gasta tudo") também é dele.
 */
function ehNoNivel(peca: ValorJson, acumulador: Referencia): boolean {
  if (!ehObjetoJson(peca) || peca.tipo !== 'contador' || peca.nao === true) return false
  const ref = referenciaDoJson(peca.acumulador)
  return ref !== null && mesmaReferencia(ref, acumulador)
}

/** O que a técnica gasta do acumulador ao usar (pedido de 28/11/2026): nada, o nível do marco ou tudo. */
export type GastoNoMarco = 'nao' | 'nivel' | 'tudo'

/** Como a técnica liberada no marco gasta o acumulador ao usar; não liberada = 'nao'. */
export function gastoQuePede(cartao: CartaoDaFicha, acumulador: Referencia): GastoNoMarco {
  const peca = todosCru(blocoCru(cartao), 'usar').find((candidata) => ehNoNivel(candidata, acumulador))
  if (!ehObjetoJson(peca) || peca.gasta !== true) return 'nao'
  return peca.tudo === true ? 'tudo' : 'nivel'
}

/** A técnica do marco com o gasto trocado ("Ao usar: gasta N / gasta tudo / não gasta"). Sem a liberação ou já assim = o MESMO cartão. */
export function comOGastoNoNivel(cartao: CartaoDaFicha, acumulador: Referencia, gasto: GastoNoMarco): CartaoDaFicha {
  const todos = todosCru(blocoCru(cartao), 'usar')
  const atual = todos.find((peca) => ehNoNivel(peca, acumulador))
  if (!ehObjetoJson(atual) || gastoQuePede(cartao, acumulador) === gasto) return cartao
  const { gasta: _gasta, tudo: _tudo, ...semGasto } = atual
  const peca: ObjetoJson = gasto === 'nao' ? semGasto : gasto === 'nivel' ? { ...semGasto, gasta: true } : { ...semGasto, gasta: true, tudo: true }
  return comUsar(cartao, todos.map((outra) => (outra === atual ? peca : outra)))
}

/** A técnica pede a forma (B3) na raiz dos Requisitos. */
export function pedeAForma(cartao: CartaoDaFicha, forma: Referencia): boolean {
  return todosCru(blocoCru(cartao), 'usar').some((peca) => ehNaForma(peca, forma))
}

/** O nível que a técnica pede do acumulador (A4), ou `null` (não pede). */
export function nivelQuePede(cartao: CartaoDaFicha, acumulador: Referencia): number | null {
  const peca = todosCru(blocoCru(cartao), 'usar').find((candidata) => ehNoNivel(candidata, acumulador))
  return ehObjetoJson(peca) && typeof peca.nivel === 'number' ? peca.nivel : null
}

/** A técnica com o B3 "Numa forma <forma>" (liga) ou sem ele (desliga). Já como pedido = o MESMO cartão. */
export function comATecnicaNaForma(cartao: CartaoDaFicha, forma: Referencia, liga: boolean): CartaoDaFicha {
  const todos = todosCru(blocoCru(cartao), 'usar')
  if (liga === todos.some((peca) => ehNaForma(peca, forma))) return cartao
  const peca: ObjetoJson = { id: idNovo(), tipo: 'naForma', forma: referenciaJson(forma) }
  return comUsar(cartao, liga ? [...todos, peca] : todos.filter((outra) => !ehNaForma(outra, forma)))
}

/** A técnica liberada no nível `nivel` do acumulador (A4; o gasto que já tinha fica), ou sem a liberação (`null`). */
export function comATecnicaNoNivel(cartao: CartaoDaFicha, acumulador: Referencia, nivel: number | null): CartaoDaFicha {
  const todos = todosCru(blocoCru(cartao), 'usar')
  const sem = todos.filter((peca) => !ehNoNivel(peca, acumulador))
  if (nivel === null) return sem.length === todos.length ? cartao : comUsar(cartao, sem)
  const atual = todos.find((peca) => ehNoNivel(peca, acumulador))
  if (ehObjetoJson(atual) && atual.nivel === nivel) return cartao
  const peca: ObjetoJson = ehObjetoJson(atual) ? { ...atual, nivel } : { id: idNovo(), tipo: 'contador', acumulador: referenciaJson(acumulador), nivel }
  // A liberação fica onde estava (ou no fim): a ordem dos outros requisitos não muda.
  return comUsar(cartao, ehObjetoJson(atual) ? todos.map((outra) => (outra === atual ? peca : outra)) : [...todos, peca])
}
