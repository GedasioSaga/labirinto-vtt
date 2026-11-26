import type { CarriedItem } from '../../types/map'
import { ITEM_QUANTIDADE_MAX, quantidadeDe, type ItemParaDar } from '../items'
import type { Personagem } from '../personagem'
import { moedasDe } from '../troca'
import { mochilaComOPenteDevolvido, vagaQueSai, type AcervoDaMochila, type Recusa } from './armaNaMochila'
import { darNaFicha, tirarDaMochilaDaFicha } from './darNaFicha'
import { fichaComMochila } from './juncao'

/**
 * "DAR A…" COM QUANTIDADE E VÁRIAS FICHAS (docs/design/itens-rework/PLANO.md, etapa E3): o mestre
 * escolhe o item, quantos e as fichas (jogadores e cópias de NPC) e dá a todas de uma vez, vendo
 * quanto cada uma tem e com quanto fica. Um clique por ficha, nunca um por unidade: 40 balas a dois
 * personagens são dois marcados e um "Dar". O Desfazer volta todas juntas.
 *
 * O empilhável soma na pilha (até `ITEM_QUANTIDADE_MAX`, a regra de `darNaFicha`); o que não empilha
 * abre uma vaga por unidade, até `VAGAS_POR_DAR_MAX`. Puras: quem chama grava a lista numa vez só.
 */

/** Teto de vagas novas de um item que não empilha num "Dar" só (a grade do inventário tem 16). */
export const VAGAS_POR_DAR_MAX = 16

/** Quantos o "Dar" pede, dentro do teto do tipo de item. */
export function quantidadeDoDar(item: Pick<ItemParaDar, 'empilhavel'>, pedida: number): number {
  const teto = item.empilhavel === true ? ITEM_QUANTIDADE_MAX : VAGAS_POR_DAR_MAX
  return Number.isSafeInteger(pedida) ? Math.min(Math.max(pedida, 1), teto) : 1
}

/** Quantos do item a ficha tem: pelo `itemId` (todas as vagas) ou, sem ele, pelo nome. */
export function quantosTem(personagem: Pick<Personagem, 'mochila'>, item: Pick<ItemParaDar, 'itemId' | 'nome'>): number {
  const mesma = (vaga: NonNullable<Personagem['mochila']>[number]) => (item.itemId !== undefined ? vaga.itemId === item.itemId : vaga.itemId === undefined && vaga.nome === item.nome)
  return (personagem.mochila ?? []).reduce((soma, vaga) => (mesma(vaga) ? soma + quantidadeDe(vaga) : soma), 0)
}

/** As vagas que entraram numa ficha, para o Desfazer (o não empilhável abre várias). */
export interface RecebidoNaFicha {
  personagemId: string
  vagas: { vagaId: string; entraram: number }[]
  entraram: number
}

/** A ficha depois de receber `quantidade` (`null` = nada entrou: pilha no teto ou nome vazio). */
function fichaQueRecebe(personagem: Personagem, item: ItemParaDar, quantidade: number, novoId: () => string): { personagem: Personagem; recebido: RecebidoNaFicha } | null {
  const pedida = quantidadeDoDar(item, quantidade)
  const vagas: RecebidoNaFicha['vagas'] = []
  let atual = personagem
  // O empilhável entra de uma vez na pilha; o outro, uma vaga por unidade.
  const vezes = item.empilhavel === true ? 1 : pedida
  for (let vez = 0; vez < vezes; vez++) {
    const deu = darNaFicha(atual, item, item.empilhavel === true ? pedida : 1, novoId())
    if (deu === null) break
    atual = deu.personagem
    vagas.push({ vagaId: deu.vagaId, entraram: deu.entraram })
  }
  if (vagas.length === 0) return null
  return { personagem: atual, recebido: { personagemId: personagem.id, vagas, entraram: vagas.reduce((soma, vaga) => soma + vaga.entraram, 0) } }
}

/** A prévia de uma linha do "Dar a…": quanto tem e com quanto fica. */
export interface LinhaDoDar {
  personagemId: string
  tem: number
  ficaCom: number
}

/** Quanto cada ficha tem e com quanto fica, sem gravar (a mesma conta do "Dar"). */
export function previaDoDar(personagens: readonly Personagem[], item: ItemParaDar, quantidade: number): LinhaDoDar[] {
  let n = 0
  const idDaPrevia = () => `previa_${n++}`
  return personagens.map((personagem) => {
    const tem = quantosTem(personagem, item)
    const recebe = fichaQueRecebe(personagem, item, quantidade, idDaPrevia)
    return { personagemId: personagem.id, tem, ficaCom: tem + (recebe?.recebido.entraram ?? 0) }
  })
}

/** A lista inteira depois do "Dar" e o que entrou em cada ficha (as que não receberam ficam fora de `recebidos`). */
export interface DadoAVarias {
  personagens: Personagem[]
  recebidos: RecebidoNaFicha[]
}

/** Dá `quantidade` do item a cada ficha de `ids`, sobre a lista de AGORA. Ficha que saiu da lista: fica fora. */
export function darAVarias(lista: readonly Personagem[], ids: readonly string[], item: ItemParaDar, quantidade: number, novoId: () => string): DadoAVarias {
  const pedidas = new Set(ids)
  const recebidos: RecebidoNaFicha[] = []
  const personagens = lista.map((personagem) => {
    if (!pedidas.has(personagem.id)) return personagem
    const recebe = fichaQueRecebe(personagem, item, quantidade, novoId)
    if (recebe === null) return personagem
    recebidos.push(recebe.recebido)
    return recebe.personagem
  })
  return { personagens, recebidos }
}

/** O Desfazer do "Dar a…": tira de cada ficha o que entrou nela, sobre a ficha de AGORA (o que mudou depois fica). */
export function desfazerDarAVarias(personagem: Personagem, recebidos: readonly RecebidoNaFicha[]): Personagem {
  const recebido = recebidos.find((candidato) => candidato.personagemId === personagem.id)
  if (recebido === undefined) return personagem
  return recebido.vagas.reduce((atual, vaga) => tirarDaMochilaDaFicha(atual, vaga.vagaId, vaga.entraram), personagem)
}

/** O que passou de uma ficha à outra: as duas fichas novas, quantos foram e quantas balas do pente voltaram a quem deu. */
export interface PassadoAoAliado {
  de: Personagem
  para: Personagem
  entraram: number
  devolvidas: number
}

/** A vaga como item a dar: sem o lugar (id), a pilha, o aceso, o equipado e o pente, que são de quem tinha. */
function vagaComoItem(vaga: CarriedItem): ItemParaDar {
  const { id: _id, quantidade: _quantidade, acesa: _acesa, ...resto } = vagaQueSai(vaga)
  return resto
}

/**
 * DAR DE UMA MOCHILA A UM ALIADO (E3): `quantos` da vaga `vagaId` de `de` vão para `para`. A arma vai
 * vazia e guardada: as balas do pente voltam antes para a mochila de quem deu (A8). A pilha cheia de
 * quem recebe aceita menos: sai de quem deu só o que entrou.
 */
export function passarAoAliado(de: Personagem, para: Personagem, vagaId: string, quantos: number, acervo: Pick<AcervoDaMochila, 'paraDar'>, novoId: () => string): PassadoAoAliado | Recusa {
  const vaga = (de.mochila ?? []).find((item) => item.id === vagaId)
  if (vaga === undefined) return { recusa: 'O item já não está na mochila.' }
  if (de.id === para.id) return { recusa: `${vaga.nome} já é de ${para.nome}.` }
  const pedidos = Number.isSafeInteger(quantos) ? Math.min(Math.max(quantos, 1), quantidadeDe(vaga)) : 1
  const recebeu = darNaFicha(para, vagaComoItem(vaga), pedidos, novoId())
  if (recebeu === null) return { recusa: `${para.nome} já carrega o máximo de ${vaga.nome}.` }
  const devolvido = mochilaComOPenteDevolvido(de.mochila ?? [], vagaId, acervo, novoId())
  const deSemOPente = fichaComMochila(de, devolvido.mochila, moedasDe(de))
  return { de: tirarDaMochilaDaFicha(deSemOPente, vagaId, recebeu.entraram), para: recebeu.personagem, entraram: recebeu.entraram, devolvidas: devolvido.devolvidas }
}
