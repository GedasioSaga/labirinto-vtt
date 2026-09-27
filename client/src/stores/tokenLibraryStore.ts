import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { listarAcervo, type ItemDoAcervoNaTela, type PastaDoAcervo } from '../lib/tokenLibrary'

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
  pastas: PastaDoAcervo[]
  /** Frase pronta em português quando a leitura falhou; `null` = tudo certo. */
  aviso: string | null
  /**
   * O índice foi lido e há disco para gravar: só então a tela oferece criar e
   * mover pastas. Com a leitura falhada, toda gravação é recusada
   * (`ACERVO_NAO_LIDO`), e oferecer o botão seria prometer o que vai dar erro.
   */
  podeOrganizar: boolean
  /** Relê a pasta do acervo. Nunca lança: `listarAcervo` já devolve o aviso no lugar do erro. */
  recarregar: () => Promise<void>
  /**
   * Adianta na tela o que `recolherPastaNoAcervo` vai gravar: o chevron gira no
   * clique, sem esperar o disco. Se a gravação falhar, quem chamou recarrega.
   */
  marcarRecolhida: (pastaId: string, recolhida: boolean) => void
  /** Adianta na tela o que `moverNoAcervo` vai gravar — o token pula de pasta no soltar. */
  marcarPasta: (itemId: string, pasta: string | null) => void
}

export const useTokenLibraryStore = create<TokenLibraryState>()((set) => ({
  itens: [],
  pastas: [],
  aviso: null,
  podeOrganizar: false,

  recarregar: async () => {
    // Fora do Tauri (o app aberto no navegador, e todo teste de unidade que
    // monta a tela) não existe disco nenhum para ler. Sem esta guarda o painel
    // abriria com "Não foi possível ler o acervo" no modo navegador — um aviso
    // verdadeiro sobre um recurso que nem é oferecido ali.
    if (!isTauri()) {
      set({ itens: [], pastas: [], aviso: null, podeOrganizar: false })
      return
    }
    const { itens, pastas, aviso, lido } = await listarAcervo()
    set({ itens, pastas, aviso, podeOrganizar: lido })
  },

  marcarRecolhida: (pastaId, recolhida) =>
    set((state) => ({
      pastas: state.pastas.map((pasta) => (pasta.id === pastaId ? { ...pasta, recolhida } : pasta)),
    })),

  marcarPasta: (itemId, pasta) =>
    set((state) => ({
      itens: state.itens.map((item) => (item.id === itemId ? { ...item, pasta } : item)),
    })),
}))
