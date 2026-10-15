import { create } from 'zustand'

/**
 * LIVRO DO MESTRE (fatia 2 do design consolidado, docs/design/consolidado/PLANO.md):
 * qual página está aberta (Ficha, Cena, Aventura, Acervo), se a página está
 * recolhida para dentro da lombada e se o campo do "+ Token" está aberto. Vale
 * enquanto o app está aberto, como no protótipo; nada disso vai para o disco.
 */

export type PaginaDoMestre = 'ficha' | 'cena' | 'aventura' | 'acervo'

/**
 * A preferência "Categorias do painel" (esconder Aventura e Esta cena com uma
 * ferramenta na mão) se aposentou: cada grupo tem a sua página agora. Quem a
 * tinha salva não quebra nada (ninguém mais lê a chave); ela só sai do aparelho.
 */
export const CHAVE_APOSENTADA_CATEGORIAS = 'lb-categorias-so-sem-selecao'

export function esquecerPreferenciaAposentada(armazem: Pick<Storage, 'removeItem'> | null): void {
  if (armazem === null) return
  try {
    armazem.removeItem(CHAVE_APOSENTADA_CATEGORIAS)
  } catch {
    // Storage bloqueado: a chave fica lá, sem efeito nenhum.
  }
}

function armazemDoNavegador(): Pick<Storage, 'removeItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

esquecerPreferenciaAposentada(armazemDoNavegador())

interface LivroDoMestreState {
  pagina: PaginaDoMestre
  recolhido: boolean
  novoTokenAberto: boolean
  /**
   * A última troca de página veio do ponteiro num marcador: só ela anima (a
   * fita desliza, a folha assenta). Pelo teclado ou puxada pela ferramenta e
   * pela seleção, a troca é na hora.
   */
  trocaAnimada: boolean
  /** Abre a página pedida e tira a página de dentro da lombada, se estava recolhida. */
  abrirPagina: (pagina: PaginaDoMestre, animada?: boolean) => void
  setRecolhido: (recolhido: boolean) => void
  /** O "+ Token": a página Ficha, aberta, com o campo do nome. */
  abrirNovoToken: () => void
  fecharNovoToken: () => void
}

export const useLivroDoMestreStore = create<LivroDoMestreState>((set) => ({
  pagina: 'ficha',
  recolhido: false,
  novoTokenAberto: false,
  trocaAnimada: false,
  abrirPagina: (pagina, animada = false) => set({ pagina, recolhido: false, trocaAnimada: animada }),
  setRecolhido: (recolhido) => set({ recolhido }),
  abrirNovoToken: () => set({ pagina: 'ficha', recolhido: false, novoTokenAberto: true, trocaAnimada: false }),
  fecharNovoToken: () => set({ novoTokenAberto: false }),
}))
