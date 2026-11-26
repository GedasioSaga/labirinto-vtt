import type { ItemDoCatalogo } from './acervoDeItens'
import type { ItemParaDar, MunicaoDaVaga } from './items'
import type { BlocosDoItem } from './itens/modelo'
import { resumoDoEfeitoDoItem } from './batalha/mecanica/resumoDoItem'

/**
 * COMO O ITEM DO ACERVO VAI PARA A MOCHILA, sem o disco do Acervo. Saiu de `lib/acervoDeItens.ts`
 * (que lê e grava pelo Tauri) para o site do Lobby, fora do Tauri, poder montar a ficha com a mochila
 * (`lib/mochila/acervoDaMochila.ts`). `lib/acervoDeItens.ts` reexporta as três, para quem já importa de lá.
 */

/**
 * O que vai para a mochila quando o item é dado (`darDoAcervoChange`).
 * `acervo` = a lista de agora, de onde sai o nome de cada munição que a arma
 * aceita: a vaga leva `{ itemId, nome }` porque o app do jogador não vê o
 * Acervo. Munição que já saiu do Acervo não vai (não há nome a mostrar).
 */
export function itemParaDar(item: ItemDoCatalogo, acervo: readonly Pick<ItemDoCatalogo, 'id' | 'nome'>[]): ItemParaDar {
  return {
    nome: item.nome,
    itemId: item.id,
    ...(item.imagem !== null ? { imagem: item.imagem } : {}),
    ...(item.descricao.trim() !== '' ? { descricao: item.descricao } : {}),
    ...(item.categoria !== '' ? { categoria: item.categoria } : {}),
    // Sistema de itens refeito (E1): o tipo vai na cópia de exibição, como a categoria.
    ...(item.tipo !== undefined ? { tipo: item.tipo } : {}),
    ...(item.preco !== null ? { preco: item.preco } : {}),
    ...(item.empilhavel ? { empilhavel: true as const } : {}),
    ...municoesParaDar(item, acervo),
    ...(item.luz !== undefined ? { luz: { ...item.luz } } : {}),
    ...efeitoParaDar(item),
    ...requisitosParaDar(item),
    ...regraParaDar(item),
  }
}

/**
 * A REGRA NA VAGA (A1 do PLANO; decisão 18): o instantâneo dos blocos do item, em cópia e sem a imagem,
 * para quem não vê o Acervo: o jogador lê o cartão inteiro por ele, e o Worker do Lobby roda o treino.
 * Item sem bloco nenhum: nada vai.
 */
export function regraParaDar(item: BlocosDoItem): Pick<ItemParaDar, 'regra'> {
  const blocos: BlocosDoItem = {
    ...(item.ataque !== undefined ? { ataque: item.ataque } : {}),
    ...(item.golpe !== undefined ? { golpe: item.golpe } : {}),
    ...(item.pente !== undefined ? { pente: item.pente } : {}),
    ...(item.arremesso !== undefined ? { arremesso: item.arremesso } : {}),
    ...(item.bala !== undefined ? { bala: item.bala } : {}),
    ...(item.uso !== undefined ? { uso: item.uso } : {}),
    ...(item.equipamento !== undefined ? { equipamento: item.equipamento } : {}),
    ...(item.aoAcertar !== undefined ? { aoAcertar: item.aoAcertar } : {}),
    ...(item.aoUsar !== undefined ? { aoUsar: item.aoUsar } : {}),
  }
  return Object.keys(blocos).length === 0 ? {} : { regra: structuredClone(blocos) }
}

/** REQUISITOS (fase B2): a vaga leva o bloco do item em cópia, como o efeito (o host lê da cópia dele). */
export function requisitosParaDar(item: Pick<ItemDoCatalogo, 'requisitos'>): Pick<ItemParaDar, 'requisitos'> {
  return item.requisitos === undefined ? {} : { requisitos: structuredClone(item.requisitos) }
}

/** Fase 7: a vaga leva as peças (o host as lê) e a frase (o que o jogador recebe, decisão C8). */
export function efeitoParaDar(item: Pick<ItemDoCatalogo, 'efeito'>): Pick<ItemParaDar, 'efeito' | 'efeitoResumo'> {
  if (item.efeito === undefined) return {}
  const efeitoResumo = resumoDoEfeitoDoItem(item.efeito)
  return { efeito: { ...item.efeito, mecanica: structuredClone(item.efeito.mecanica) }, ...(efeitoResumo !== '' ? { efeitoResumo } : {}) }
}

function municoesParaDar(item: ItemDoCatalogo, acervo: readonly Pick<ItemDoCatalogo, 'id' | 'nome'>[]): { municoes?: MunicaoDaVaga[] } {
  if (item.municoes === undefined) return {}
  const nomes = new Map(acervo.map((outro) => [outro.id, outro.nome]))
  const municoes = item.municoes.flatMap((itemId) => {
    const nome = nomes.get(itemId)
    return nome === undefined ? [] : [{ itemId, nome }]
  })
  return municoes.length === 0 ? {} : { municoes }
}
