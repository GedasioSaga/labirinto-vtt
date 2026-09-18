import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { listarAcervo, type ItemDoAcervoNaTela } from '../lib/tokenLibrary'

/**
 * O ACERVO DE TOKENS na tela.
 *
 * Store separada de `useMapStore` de propósito: o acervo é GLOBAL DO APP e não
 * do mapa (decisão do usuário, 18/09/2026) — guardar isto dentro do mapa faria
 * o goblin salvo hoje sumir ao abrir a masmorra de amanhã, que é exatamente o
 * contrário do pedido. A mesma razão de `sessionStore` e `toastStore` existirem
 * fora do mapa.
 *
 * Aqui só mora o RETRATO do disco; quem escreve no disco é `lib/tokenLibrary.ts`
 * e quem trata o erro é `App.tsx` (o mesmo `reportFileError` de salvar mapa e
 * trocar imagem), para não haver duas rotas de erro dizendo coisas diferentes.
 */
interface TokenLibraryState {
  itens: ItemDoAcervoNaTela[]
  /** Frase pronta em português quando a leitura falhou; `null` = tudo certo. */
  aviso: string | null
  /** Relê a pasta do acervo. Nunca lança: `listarAcervo` já devolve o aviso no lugar do erro. */
  recarregar: () => Promise<void>
}

export const useTokenLibraryStore = create<TokenLibraryState>()((set) => ({
  itens: [],
  aviso: null,

  recarregar: async () => {
    // Fora do Tauri (o app aberto no navegador, e todo teste de unidade que
    // monta a tela) não existe disco nenhum para ler. Sem esta guarda o painel
    // abriria com "Não foi possível ler o acervo" no modo navegador — um aviso
    // verdadeiro sobre um recurso que nem é oferecido ali.
    if (!isTauri()) {
      set({ itens: [], aviso: null })
      return
    }
    const { itens, aviso } = await listarAcervo()
    set({ itens, aviso })
  },
}))
