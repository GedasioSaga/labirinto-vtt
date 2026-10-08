import { novoCartao, type CartaoDaFicha } from './personagem'
import type { AbaDoSistema, CatalogosDoSistema, PericiaDoCatalogo, SistemaDeRpg, TracoDoCatalogo } from './sistemaDeRpg'

/**
 * LIVRO DE REGRAS (entrega 3): o que a ficha e a mesa fazem com o livro do
 * sistema — de onde a aba escolhe ("Escolher do livro"), como o item vira
 * cartão, e o resumo que vai ao jogador no lugar do livro inteiro.
 */

export type ChaveDoCatalogo = keyof CatalogosDoSistema

/** Os catálogos na ordem em que o livro os mostra, com o nome de cada um. */
export const CATALOGOS_DO_LIVRO: readonly { chave: ChaveDoCatalogo; rotulo: string }[] = [
  { chave: 'pericias', rotulo: 'Perícias' },
  { chave: 'vantagens', rotulo: 'Vantagens' },
  { chave: 'desvantagens', rotulo: 'Desvantagens' },
  { chave: 'racas', rotulo: 'Raças' },
  { chave: 'oficios', rotulo: 'Ofícios' },
]

/** "PER · INT": os atributos da perícia pela abreviação do sistema (id desconhecido aparece como está). */
export function atributosAbreviados(sistema: SistemaDeRpg, ids: readonly string[]): string {
  return ids.map((id) => sistema.atributos.find((atributo) => atributo.id === id)?.abreviacao ?? id).join(' · ')
}

/** O sistema tem algo para abrir no livro: capítulo ou catálogo. */
export function temLivro(sistema: SistemaDeRpg): boolean {
  return resumoDoLivro(sistema) !== null
}

/**
 * O que o jogador sabe do livro antes de pedi-lo: quantos capítulos e quais
 * catálogos têm item. É o que acende o "Livro" e o "Escolher do livro" na tela
 * dele sem baixar nada. `null` = o sistema não tem livro.
 */
export interface ResumoDoLivro {
  capitulos: number
  catalogos: ChaveDoCatalogo[]
}

export function resumoDoLivro(sistema: SistemaDeRpg): ResumoDoLivro | null {
  const capitulos = sistema.livro === undefined ? 0 : sistema.livro.length
  const { catalogos } = sistema
  const comItens = catalogos === undefined ? [] : CATALOGOS_DO_LIVRO.map(({ chave }) => chave).filter((chave) => catalogos[chave].length > 0)
  return capitulos === 0 && comItens.length === 0 ? null : { capitulos, catalogos: comItens }
}

/** O sistema sem livro e sem catálogos: o que vai em `rpg.sistema` a cada conexão (o livro vai à parte, sob pedido). */
export function sistemaSemLivro(sistema: SistemaDeRpg): SistemaDeRpg {
  const { livro: _livro, catalogos: _catalogos, ...resto } = sistema
  return resto
}

/** Item que a aba pode copiar para um cartão. */
export type ItemEscolhivel = PericiaDoCatalogo | TracoDoCatalogo

/** O catálogo de onde a aba escolhe (o de id igual ao dela); `null` = a aba só tem texto livre. Raças e ofícios não viram cartão. */
export function catalogoDaAba(abaId: string): 'pericias' | 'vantagens' | 'desvantagens' | null {
  if (abaId === 'pericias' || abaId === 'vantagens' || abaId === 'desvantagens') return abaId
  return null
}

/** Os itens que a aba oferece no "Escolher do livro"; vazio = a aba não tem catálogo (ou ele ainda não chegou). */
export function itensDaAba(catalogos: CatalogosDoSistema | undefined, abaId: string): readonly ItemEscolhivel[] {
  const chave = catalogoDaAba(abaId)
  return chave === null || catalogos === undefined ? [] : catalogos[chave]
}

/** A aba escolhe do livro, segundo o resumo (o jogador sabe antes de o livro chegar). */
export function abaTemCatalogo(resumo: ResumoDoLivro | null, abaId: string): boolean {
  const chave = catalogoDaAba(abaId)
  return chave !== null && resumo !== null && resumo.catalogos.includes(chave)
}

/**
 * O item escolhido como cartão NOVO (id novo, por VALOR: editar o cartão não
 * muda o livro, como no projeto-rpg-v2). Cada texto vai ao campo de mesmo id
 * da aba; sem um campo `descricao`, a descrição vai ao primeiro parágrafo do
 * cartão. Os atributos da perícia só entram na aba que marca atributos, e só
 * os que o sistema tem.
 */
export function cartaoDoCatalogo(aba: AbaDoSistema, sistema: SistemaDeRpg, item: ItemEscolhivel): CartaoDaFicha {
  const textos: [string, string][] = 'efeito' in item ? [['descricao', item.descricao], ['efeito', item.efeito]] : [['descricao', item.descricao]]
  const campos: Record<string, string> = {}
  for (const [id, valor] of textos) {
    if (valor.length === 0) continue
    const destino = aba.campos.find((campo) => campo.id === id) ?? (id === 'descricao' ? aba.campos.find((campo) => campo.forma === 'paragrafo') : undefined)
    if (destino !== undefined && !(destino.id in campos)) campos[destino.id] = valor
  }
  const existentes = new Set(sistema.atributos.map((atributo) => atributo.id))
  const atributos = aba.atributos === true && 'atributos' in item ? item.atributos.filter((id) => existentes.has(id)) : []
  return { ...novoCartao(item.nome), campos, atributos }
}
