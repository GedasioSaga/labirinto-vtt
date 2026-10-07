import { create } from 'zustand'

/**
 * CATEGORIAS SÓ COM NADA NA MÃO (pedido de 07/10/2026): ligada, as zonas
 * "Aventura" e "Esta cena" do painel (Cenas, Pinos, Objetos do mapa, Marcas,
 * Locais) só aparecem com a ferramenta Selecionar e nada selecionado. É
 * preferência do APARELHO do mestre: mora no localStorage e vale em qualquer
 * mapa. Nasce ligada, que é o que o pedido quer.
 */

export const CHAVE_CATEGORIAS_SO_SEM_SELECAO = 'lb-categorias-so-sem-selecao'
const PADRAO = true

type Armazem = Pick<Storage, 'getItem' | 'setItem'>

function armazemDoNavegador(): Armazem | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Storage bloqueado, vazio ou adulterado volta ao padrão, e nada lança. */
export function lerCategoriasSoSemSelecao(armazem: Armazem | null): boolean {
  if (armazem === null) return PADRAO
  try {
    const texto = armazem.getItem(CHAVE_CATEGORIAS_SO_SEM_SELECAO)
    return texto === 'false' ? false : texto === 'true' ? true : PADRAO
  } catch {
    return PADRAO
  }
}

function gravar(armazem: Armazem | null, ligado: boolean): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE_CATEGORIAS_SO_SEM_SELECAO, String(ligado))
  } catch {
    // Sem persistência: a escolha vale enquanto o app estiver aberto.
  }
}

interface PainelCategoriasState {
  soSemSelecao: boolean
  setSoSemSelecao: (ligado: boolean) => void
}

export const usePainelCategoriasStore = create<PainelCategoriasState>((set) => ({
  soSemSelecao: lerCategoriasSoSemSelecao(armazemDoNavegador()),
  setSoSemSelecao: (ligado) => {
    gravar(armazemDoNavegador(), ligado)
    set({ soSemSelecao: ligado })
  },
}))
