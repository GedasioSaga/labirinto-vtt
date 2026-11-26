import { quantidadeDe } from '../items'
import { lerRequisitos } from '../batalha/requisitos/ler'
import type { PecaDoGrupo, Referencia, Requisito } from '../batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../personagem'

/**
 * OS ITENS QUE A HABILIDADE GASTA OU EXIGE (sistema de itens refeito, etapa E4b; tela G do
 * protótipo: "as habilidades mostram os itens que gastam, com a contagem"). Lê as peças F1 `item`
 * do bloco de requisitos do cartão (`usar`: "Todos estes" e as opções de "Um destes") e conta na
 * mochila da ficha. Peça "não ter o item" (`nao`) fica de fora: não gasta nem pede item.
 *
 * Puro: sem store, sem React.
 */

export interface ItemDaTecnica {
  /** O id do requisito (chave da lista). */
  id: string
  nome: string
  /** Quantos a habilidade pede (e gasta, com `gasta`). */
  n: number
  gasta: boolean
  /** Quantos a mochila tem agora. */
  tem: number
  /** Opção de um "Um destes": basta uma delas. */
  ou: boolean
}

type RequisitoDeItem = Extract<Requisito, { tipo: 'item' }>

function ehItem(peca: PecaDoGrupo): peca is RequisitoDeItem {
  return 'tipo' in peca && peca.tipo === 'item'
}

function chaveDoNome(nome: string): string {
  return nome.trim().toLocaleLowerCase('pt-BR')
}

/** Quantos do item a mochila tem: pelo id do Acervo quando alguma vaga o leva; senão pelo nome (o bloco veio do livro ou de outra ficha). */
export function quantosDoItem(mochila: Personagem['mochila'], item: Referencia): number {
  const vagas = mochila ?? []
  const peloId = item.id === undefined ? [] : vagas.filter((vaga) => vaga.itemId === item.id)
  const chave = chaveDoNome(item.nome)
  const casam = peloId.length > 0 ? peloId : vagas.filter((vaga) => chaveDoNome(vaga.nome) === chave)
  return casam.reduce((soma, vaga) => soma + quantidadeDe(vaga), 0)
}

/** As peças de item do "Usar" da habilidade, com a contagem da mochila de `personagem`. Lista vazia = não gasta nem exige item. */
export function itensDaTecnica(cartao: Pick<CartaoDaFicha, 'requisitos'>, personagem: Pick<Personagem, 'mochila'>): ItemDaTecnica[] {
  const grupo = lerRequisitos(cartao.requisitos).bloco?.usar
  if (grupo === undefined) return []
  const itens: ItemDaTecnica[] = []
  const juntar = (peca: RequisitoDeItem, ou: boolean) => {
    if (peca.nao === true) return
    itens.push({ id: peca.id, nome: peca.item.nome, n: peca.quantidade, gasta: peca.gasta === true, tem: quantosDoItem(personagem.mochila, peca.item), ou })
  }
  for (const peca of grupo.todos) {
    if ('umDestes' in peca) {
      for (const opcao of peca.umDestes) if (ehItem(opcao)) juntar(opcao, true)
    } else if (ehItem(peca)) juntar(peca, false)
  }
  return itens
}
