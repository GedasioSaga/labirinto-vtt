import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import {
  ACERVO_DE_ITENS_NAO_LIDO,
  acervoVazio,
  categoriaLimpa,
  CATEGORIAS_MAX,
  gravarAcervoDeItens,
  lerAcervoDeItens,
  type AcervoDeItens,
  type ItemDoCatalogo,
} from '../lib/acervoDeItens'

/**
 * O ACERVO DE ITENS na tela. Como o de tokens (`tokenLibraryStore`), fora do
 * mapa e da aventura: é do app. A tela muda na hora e o disco grava atrás;
 * se a gravação falhar, a tela volta ao que o disco tem e o erro sobe para o
 * aviso de quem chamou.
 */
interface AcervoDeItensState extends AcervoDeItens {
  aviso: string | null
  /** Há disco e o índice foi lido: só então a tela oferece criar, editar e apagar. */
  podeGravar: boolean
  recarregar: () => Promise<void>
  /** Cria ou troca o item (pelo id); categoria nova entra na lista. */
  salvarItem: (item: ItemDoCatalogo) => Promise<void>
  apagarItem: (id: string) => Promise<void>
  /** A lista editável de categorias (o seletor do item a sugere). */
  definirCategorias: (categorias: readonly string[]) => Promise<void>
}

/** A lista com a categoria do item, se ela é nova (sem diferença de caixa). */
function comCategoria(categorias: readonly string[], categoria: string): string[] {
  const limpa = categoriaLimpa(categoria)
  if (limpa === '' || categorias.length >= CATEGORIAS_MAX) return [...categorias]
  const chave = limpa.toLocaleLowerCase('pt-BR')
  return categorias.some((existente) => existente.toLocaleLowerCase('pt-BR') === chave) ? [...categorias] : [...categorias, limpa]
}

export const useAcervoDeItensStore = create<AcervoDeItensState>()((set, get) => {
  /** Troca a tela, grava; falhou, relê o disco e devolve o erro a quem chamou. */
  const gravar = async (proximo: AcervoDeItens): Promise<void> => {
    if (!get().podeGravar) throw new Error(ACERVO_DE_ITENS_NAO_LIDO)
    set({ itens: proximo.itens, categorias: proximo.categorias })
    try {
      await gravarAcervoDeItens(proximo)
    } catch (erro) {
      await get().recarregar()
      throw erro
    }
  }

  return {
    ...acervoVazio(),
    aviso: null,
    podeGravar: false,

    recarregar: async () => {
      // Fora do aplicativo não há disco: o painel fica vazio, sem aviso de erro sobre o que nem é oferecido.
      if (!isTauri()) {
        set({ ...acervoVazio(), aviso: null, podeGravar: false })
        return
      }
      const lido = await lerAcervoDeItens()
      set({ ...lido.acervo, aviso: lido.aviso, podeGravar: lido.lido })
    },

    salvarItem: (item) => {
      const { itens, categorias } = get()
      const existe = itens.some((atual) => atual.id === item.id)
      const proximos = existe ? itens.map((atual) => (atual.id === item.id ? item : atual)) : [...itens, item]
      return gravar({ itens: proximos, categorias: comCategoria(categorias, item.categoria) })
    },

    apagarItem: (id) => {
      const { itens, categorias } = get()
      return gravar({ itens: itens.filter((item) => item.id !== id), categorias })
    },

    definirCategorias: (lista) => {
      const categorias = lista.reduce<string[]>((acumuladas, categoria) => comCategoria(acumuladas, categoria), [])
      return gravar({ itens: get().itens, categorias })
    },
  }
})
