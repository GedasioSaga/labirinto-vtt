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

/** A peça A4 "<acumulador> N ou mais" que o Acumulador grava (sem "não ter" e sem "e gasta"). */
function ehNoNivel(peca: ValorJson, acumulador: Referencia): boolean {
  if (!ehObjetoJson(peca) || peca.tipo !== 'contador' || peca.nao === true || peca.gasta === true) return false
  const ref = referenciaDoJson(peca.acumulador)
  return ref !== null && mesmaReferencia(ref, acumulador)
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

/** A técnica liberada no nível `nivel` do acumulador (A4 sem gastar), ou sem a liberação (`null`). */
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
