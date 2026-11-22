import type { CarriedItem } from '../../types/map'
import { efeitoParaDar, type ItemDoCatalogo } from '../acervoDeItens'
import type { Personagem } from '../personagem'

/**
 * "ATUALIZAR AS CÓPIAS NAS MOCHILAS" (Fase 7 de docs/design/habilidades/
 * SISTEMA.md, tabela de migração): a vaga dada ANTES de o item ganhar efeito
 * (ou com o efeito antigo) recebe o efeito e a frase do item de agora. Só a
 * vaga com o mesmo `itemId`; o resto da vaga (nome, quantidade, aceso) fica.
 * O mestre vê a lista antes de confirmar (`copiasParaAtualizar`). Puro.
 */

/** A vaga com o efeito do item de agora; o item sem efeito tira o da vaga. Igual = a mesma referência. */
export function vagaComOEfeitoDoItem(vaga: CarriedItem, item: Pick<ItemDoCatalogo, 'id' | 'efeito'>): CarriedItem {
  if (vaga.itemId !== item.id) return vaga
  const { efeito: _antes, efeitoResumo: _fraseDeAntes, ...semEfeito } = vaga
  const nova: CarriedItem = { ...semEfeito, ...efeitoParaDar(item) }
  return JSON.stringify(nova) === JSON.stringify(vaga) ? vaga : nova
}

/** A ficha com as vagas do item atualizadas; nada a mudar = a mesma referência. */
export function fichaComOEfeitoDoItem(personagem: Personagem, item: Pick<ItemDoCatalogo, 'id' | 'efeito'>): Personagem {
  const mochila = personagem.mochila
  if (mochila === undefined) return personagem
  const nova = mochila.map((vaga) => vagaComOEfeitoDoItem(vaga, item))
  return nova.every((vaga, indice) => vaga === mochila[indice]) ? personagem : { ...personagem, mochila: nova }
}

/** A lista que o mestre confere antes: cada ficha com quantas vagas mudariam. */
export function copiasParaAtualizar(personagens: readonly Personagem[], item: Pick<ItemDoCatalogo, 'id' | 'efeito'>): { id: string; nome: string; vagas: number }[] {
  return personagens.flatMap((personagem) => {
    const vagas = (personagem.mochila ?? []).filter((vaga) => vagaComOEfeitoDoItem(vaga, item) !== vaga).length
    return vagas === 0 ? [] : [{ id: personagem.id, nome: personagem.nome, vagas }]
  })
}
