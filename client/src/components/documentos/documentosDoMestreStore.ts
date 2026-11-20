import { create } from 'zustand'

/**
 * A PÁGINA DOCUMENTOS do livro do mestre, na tela: qual documento está aberto
 * na ficha e o "Marcar no mapa" em curso. Só memória, como o `desafiosStore`
 * da página Jogos: o documento mora na biblioteca e o papel, no mapa.
 */

/** O que o próximo clique no mapa marca: um ponto, ou o objeto clicado. */
export type ModoDeMarcarPapel = 'ponto' | 'objeto'

/** `papelId` = mudar o lugar de um papel que já está no mapa; `null` = pôr um papel novo. */
export interface MarcacaoDoPapel {
  docId: string
  papelId: string | null
  modo: ModoDeMarcarPapel
}

interface EstadoDosDocumentosDoMestre {
  /** O documento aberto na ficha da página; `null` = a lista. */
  aberto: string | null
  marcando: MarcacaoDoPapel | null
  abrir: (docId: string | null) => void
  marcar: (marcacao: MarcacaoDoPapel) => void
  pararDeMarcar: () => void
}

export const useDocumentosDoMestreStore = create<EstadoDosDocumentosDoMestre>((set) => ({
  aberto: null,
  marcando: null,
  // Trocar de documento cancela a marcação do anterior: o clique no mapa iria para o documento que saiu da tela.
  abrir: (docId) => set((estado) => ({ aberto: docId, marcando: estado.marcando !== null && estado.marcando.docId === docId ? estado.marcando : null })),
  marcar: (marcacao) => set({ marcando: marcacao }),
  pararDeMarcar: () => set({ marcando: null }),
}))
