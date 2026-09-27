import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import {
  listarAcervoNaFila,
  type AcervoCarregado,
  type ItemDoAcervoNaTela,
  type PastaDoAcervo,
} from '../lib/tokenLibrary'

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
  /**
   * Relê a pasta do acervo e troca a tela pelo que leu. Nunca lança:
   * `listarAcervo` já devolve o aviso no lugar do erro.
   *
   * Lê pela fila de gravação do índice, então só lê depois das gravações já
   * pedidas; e só troca a tela se nenhum `marcar*` chegou enquanto lia — se
   * chegou, lê de novo, atrás da gravação dele. Ver `adiantadas`.
   */
  recarregar: () => Promise<void>
  /**
   * Adianta na tela o que `recolherPastaNoAcervo` vai gravar: o chevron gira no
   * clique, sem esperar o disco. Se a gravação falhar, quem chamou recarrega.
   */
  marcarRecolhida: (pastaId: string, recolhida: boolean) => void
  /** Adianta na tela o que `moverNoAcervo` vai gravar — o token pula de pasta no soltar. */
  marcarPasta: (itemId: string, pasta: string | null) => void
}

export const useTokenLibraryStore = create<TokenLibraryState>()((set) => {
  /**
   * Quantas vezes a tela foi ADIANTADA (`marcarPasta`, `marcarRecolhida`) desde
   * que o app abriu. Só cresce; `recarregar` compara o antes e o depois da
   * leitura.
   *
   * Defeito achado em revisão (27/09/2026): uma releitura que terminava DEPOIS
   * de um arrasto trocava a lista inteira pelo disco de ANTES dele — o token
   * voltava para a pasta antiga na tela, o disco ficava certo, e arrastar de
   * novo era tratado como "já está lá". A fila sozinha não basta: um arrasto
   * feito com a leitura já em curso entra na fila ATRÁS dela. Jogar a leitura
   * fora também não: é ela que tira da tela a pasta apagada e desfaz o
   * movimento que o disco recusou.
   */
  let adiantadas = 0

  return {
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
      let acervo: AcervoCarregado
      let adiantadasAntes: number
      do {
        adiantadasAntes = adiantadas
        acervo = await listarAcervoNaFila()
        // Um `marcar*` durante a leitura mandou a gravação dele para a fila
        // DEPOIS dela: o que foi lido já é velho. Ler de novo, agora atrás
        // dessa gravação. Termina quando o mestre para de mexer — cada volta
        // espera na fila a gravação que a provocou.
      } while (adiantadasAntes !== adiantadas)
      set({ itens: acervo.itens, pastas: acervo.pastas, aviso: acervo.aviso, podeOrganizar: acervo.lido })
    },

    marcarRecolhida: (pastaId, recolhida) => {
      adiantadas += 1
      set((state) => ({
        pastas: state.pastas.map((pasta) => (pasta.id === pastaId ? { ...pasta, recolhida } : pasta)),
      }))
    },

    marcarPasta: (itemId, pasta) => {
      adiantadas += 1
      set((state) => ({
        itens: state.itens.map((item) => (item.id === itemId ? { ...item, pasta } : item)),
      }))
    },
  }
})
