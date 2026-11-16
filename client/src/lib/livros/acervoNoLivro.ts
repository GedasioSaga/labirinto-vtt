import type { ItemDoCatalogo as ItemDoAcervo } from '../acervoDeItens'
import { normalizarParaBusca } from '../buscaNoLivro'
import type { TipoDeEntrada } from './catalogo'

/**
 * O ACERVO NA PÁGINA DO LIVRO (Fase 1 da melhoria geral, tmp/auditoria-ferramentas-2026-11-15/
 * 2-dados-que-nao-conversam.md §5.5, passo 2): "Itens, armas e habilidades"
 * lista também as COISAS do Acervo do app (foto, nome, categoria, preço,
 * pilha), com o selo "Do acervo". O Acervo continua o dono delas — a página só
 * lê `useAcervoDeItensStore` e não copia nada para o catálogo do livro. O
 * "Pôr em" de uma coisa do Acervo dá na MOCHILA da ficha (`lib/mochila/darNaFicha.ts`),
 * com o `itemId` dela; a REGRA (dano, ação) continua no catálogo do livro.
 * Puro: sem store, sem disco.
 */

/** Uma coisa do Acervo como a página a lista. `tipo` só escolhe o filtro: "Armas" para a categoria Arma, "Itens" para o resto. */
export interface EntradaDoAcervo {
  /** O id do item no Acervo (`item_<uuid>`): não colide com o do catálogo (`cat_`) nem com o do livro (`livro-`). */
  id: string
  tipo: Extract<TipoDeEntrada, 'arma' | 'item'>
  nome: string
  acervo: ItemDoAcervo
}

/** As categorias do Acervo que contam como arma no filtro (sem acento, sem caixa). */
const CATEGORIAS_DE_ARMA: ReadonlySet<string> = new Set(['arma', 'armas'])

export function entradaDoAcervo(item: ItemDoAcervo): EntradaDoAcervo {
  const tipo = CATEGORIAS_DE_ARMA.has(normalizarParaBusca(item.categoria)) ? 'arma' : 'item'
  return { id: item.id, tipo, nome: item.nome, acervo: item }
}

/** A coisa do Acervo, entre as entradas da página (que também têm as do catálogo e as do livro). */
export function ehDoAcervo(entrada: object): entrada is EntradaDoAcervo {
  // Só a coisa do Acervo tem `acervo`: a entrada do catálogo e a do livro não têm (lib/livros/catalogo.ts).
  return 'acervo' in entrada
}

/**
 * A busca da página nas coisas do Acervo, com as mesmas regras da do catálogo
 * (`buscarNoCatalogo`): sem acento e sem caixa, cada palavra precisa aparecer,
 * por nome, descrição, categoria, o nome do filtro ("arma", "item") e
 * "acervo". Busca vazia = todas do filtro. Mantém a ordem recebida.
 */
export function buscarNoAcervo(entradas: readonly EntradaDoAcervo[], busca: string, filtro: TipoDeEntrada | 'todos'): EntradaDoAcervo[] {
  const palavras = normalizarParaBusca(busca)
    .split(' ')
    .filter((palavra) => palavra.length > 0)
  return entradas.filter((entrada) => {
    if (filtro !== 'todos' && entrada.tipo !== filtro) return false
    if (palavras.length === 0) return true
    const { nome, descricao, categoria } = entrada.acervo
    const alvo = normalizarParaBusca([nome, descricao, categoria, entrada.tipo, 'acervo'].join(' '))
    return palavras.every((palavra) => alvo.includes(palavra))
  })
}
