import type { CarriedItem } from '../../types/map'
import { mochilaComItemDoAcervo, quantidadeDe, type ItemParaDar } from '../items'
import type { Personagem } from '../personagem'
import { moedasDe } from '../troca'
import { fichaComMochila } from './juncao'

/**
 * DAR À FICHA (Fase 1 da melhoria geral, tmp/auditoria-ferramentas-2026-11-15/
 * 2-dados-que-nao-conversam.md §5.5, passo 1): o item do Acervo entra na
 * MOCHILA da ficha, sem precisar de boneco no mapa. A ficha é a dona da
 * mochila (`espelho.ts`); o boneco dela, quando houver, passa a mostrá-la pelo
 * espelho. A regra de pilha é a MESMA do "Dar a…" do acervo
 * (`mochilaComItemDoAcervo`): a Poção dada duas vezes fica numa vaga só, ×2.
 *
 * O item leva o `itemId` do Acervo (`itemParaDar`): é a chave que a ligação
 * coisa x regra (Fase 5) vai usar. Puras: sem store, sem disco.
 */

/** A ficha depois de receber: a vaga que mudou e quantos entraram, para o aviso e o Desfazer. */
export interface FichaQueRecebeu {
  personagem: Personagem
  vagaId: string
  entraram: number
}

/**
 * Dá `quantidade` do item à mochila da ficha. `null` = nada entrou: nome
 * vazio, ou a pilha já estava no teto (`ITEM_QUANTIDADE_MAX`). A bolsa fica
 * como estava.
 */
export function darNaFicha(personagem: Personagem, item: ItemParaDar, quantidade: number, freshId: string): FichaQueRecebeu | null {
  const recebeu = mochilaComItemDoAcervo(personagem.mochila ?? [], item, quantidade, freshId)
  if (recebeu === null || recebeu.entraram === 0) return null
  return { personagem: fichaComMochila(personagem, recebeu.mochila, moedasDe(personagem)), vagaId: recebeu.vagaId, entraram: recebeu.entraram }
}

/** A vaga com outra quantidade; 1 tira o campo (ausente === 1, como no disco). */
function comQuantidade(item: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antes, ...semQuantidade } = item
  return quantidade > 1 ? { ...semQuantidade, quantidade } : semQuantidade
}

/**
 * O DESFAZER do "Pôr" do acervo: tira da vaga `vagaId` os `quantos` que
 * entraram; a vaga que chega a zero sai. Trabalha sobre a ficha como ela está
 * AGORA (o que mudou depois do "Pôr" fica). Vaga que já não está lá, ou nada a
 * tirar: a MESMA ficha.
 */
export function tirarDaMochilaDaFicha(personagem: Personagem, vagaId: string, quantos: number): Personagem {
  const mochila = personagem.mochila ?? []
  const vaga = mochila.find((item) => item.id === vagaId)
  if (vaga === undefined || !Number.isSafeInteger(quantos) || quantos < 1) return personagem
  const resta = quantidadeDe(vaga) - quantos
  const nova = resta >= 1 ? mochila.map((item) => (item === vaga ? comQuantidade(item, resta) : item)) : mochila.filter((item) => item !== vaga)
  return fichaComMochila(personagem, nova, moedasDe(personagem))
}

/** Quantos do item do acervo `itemId` a ficha carrega, somando as vagas (o não empilhável ocupa uma vaga por unidade). */
export function quantosNaFicha(personagem: Pick<Personagem, 'mochila'>, itemId: string): number {
  return (personagem.mochila ?? []).reduce((soma, item) => (item.itemId === itemId ? soma + quantidadeDe(item) : soma), 0)
}
