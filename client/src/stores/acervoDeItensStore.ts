import { create } from 'zustand'
import { definirAcervoDaFicha } from './acervoDaFichaStore'
import { definirMunicoesDasArmas } from '../lib/batalha/municoesDoAcervo'
import { definirPrecosDoAcervo } from '../lib/loja'
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
  type PastaDeItens,
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
  /** Cria ou troca o item (pelo id); categoria nova entra na lista. `pastas` = a lista de pastas junto (a pasta nova do item novo). */
  salvarItem: (item: ItemDoCatalogo, pastas?: readonly PastaDeItens[]) => Promise<void>
  apagarItem: (id: string) => Promise<void>
  /**
   * PASTAS (18/11/2026): troca as pastas e, nos itens de `ondeMoram`, a pasta
   * (`undefined` = Sem pasta), numa gravação só. Serve a toda mudança da
   * árvore e ao Desfazer dela; o resto de cada item fica como está.
   */
  organizar: (pastas: readonly PastaDeItens[], ondeMoram?: ReadonlyMap<string, string | undefined>) => Promise<void>
  /**
   * VÁRIOS DE UMA VEZ (o "Dar alcance aos antigos" e o Desfazer dele): cada item da lista troca o
   * de mesmo id, numa gravação só; o id que sumiu do Acervo no meio não volta.
   */
  trocarItens: (trocados: readonly ItemDoCatalogo[]) => Promise<void>
  /**
   * SISTEMA DE ITENS REFEITO (E1): a conversão das fichas cria e completa itens numa gravação só.
   * O de mesmo id troca; o novo entra no fim. Lista vazia: nada se grava.
   */
  juntarItens: (itens: readonly ItemDoCatalogo[]) => Promise<void>
}

/** O item na pasta (`undefined` = Sem pasta, sem o campo). Já está lá: o mesmo objeto. */
function naPasta(item: ItemDoCatalogo, pasta: string | undefined): ItemDoCatalogo {
  if (item.pasta === pasta) return item
  const { pasta: _antes, ...semPasta } = item
  return pasta === undefined ? semPasta : { ...semPasta, pasta }
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
    set({ itens: proximo.itens, categorias: proximo.categorias, pastas: proximo.pastas })
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

    salvarItem: (item, pastas) => {
      const { itens, categorias, pastas: atuais } = get()
      const existe = itens.some((atual) => atual.id === item.id)
      const proximos = existe ? itens.map((atual) => (atual.id === item.id ? item : atual)) : [...itens, item]
      return gravar({ itens: proximos, categorias: comCategoria(categorias, item.categoria), pastas: pastas === undefined ? atuais : [...pastas] })
    },

    apagarItem: (id) => {
      const { itens, categorias, pastas } = get()
      return gravar({ itens: itens.filter((item) => item.id !== id), categorias, pastas })
    },

    organizar: (pastas, ondeMoram) => {
      const { itens, categorias } = get()
      const proximos = ondeMoram === undefined ? itens : itens.map((item) => (ondeMoram.has(item.id) ? naPasta(item, ondeMoram.get(item.id)) : item))
      return gravar({ itens: proximos, categorias, pastas: [...pastas] })
    },

    trocarItens: (trocados) => {
      const { itens, categorias, pastas } = get()
      const porId = new Map(trocados.map((item) => [item.id, item]))
      return gravar({ itens: itens.map((atual) => porId.get(atual.id) ?? atual), categorias, pastas })
    },

    juntarItens: async (novos) => {
      if (novos.length === 0) return
      const { itens, categorias, pastas } = get()
      const porId = new Map(novos.map((item) => [item.id, item]))
      const ja = new Set(itens.map((item) => item.id))
      const proximos = [...itens.map((atual) => porId.get(atual.id) ?? atual), ...novos.filter((item) => !ja.has(item.id))]
      await gravar({ itens: proximos, categorias, pastas })
    },
  }
})

// MUNIÇÃO (pedido de 16/11/2026): a batalha lê as munições que cada arma do Acervo aceita; a lista segue o Acervo a cada mudança.
// PREÇO DA BANCA (25/11/2026): a mercadoria sem preço próprio cobra o preço do Acervo de agora (lib/loja.ts).
// FICHA (26/11/2026): a aba "Mochila e equipamento" lê o Acervo por um módulo puro, que o site do Lobby também importa.
useAcervoDeItensStore.subscribe((state, antes) => {
  if (state.itens === antes.itens) return
  definirMunicoesDasArmas(state.itens)
  definirPrecosDoAcervo(state.itens)
  definirAcervoDaFicha(state.itens)
})

/**
 * MUNIÇÃO: lê o Acervo do disco se ninguém leu ainda, sem esperar. A Garrucha
 * dada antes de a vaga levar as munições só as acha no Acervo, e o mestre que
 * abre o mapa ou liga a batalha sem abrir o painel do Acervo ficaria sem elas.
 * Fora do app não há disco: não lê, para não apagar o que a tela já pôs ali.
 */
export function lerOAcervoSeFaltar(): void {
  const acervo = useAcervoDeItensStore.getState()
  if (acervo.podeGravar || !isTauri()) return
  void acervo.recarregar()
}
