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
  /**
   * O papel ESCOLHIDO no mapa do editor (o `DocumentoNoMapa.id`): o contorno e
   * as alças de canto aparecem nele, o Delete o tira do mapa e o Esc o solta.
   * Fora da escolha da store do mapa, como o pino aberto; `null` = nenhum.
   */
  papelSelecionado: string | null
  selecionarPapel: (papelId: string | null) => void
  abrir: (docId: string | null) => void
  marcar: (marcacao: MarcacaoDoPapel) => void
  pararDeMarcar: () => void
}

export const useDocumentosDoMestreStore = create<EstadoDosDocumentosDoMestre>((set) => ({
  aberto: null,
  marcando: null,
  papelSelecionado: null,
  // O mesmo id não troca o estado: ninguém repinta à toa.
  selecionarPapel: (papelId) => set((estado) => (estado.papelSelecionado === papelId ? estado : { papelSelecionado: papelId })),
  // Trocar de documento cancela a marcação do anterior: o clique no mapa iria para o documento que saiu da tela.
  abrir: (docId) => set((estado) => ({ aberto: docId, marcando: estado.marcando !== null && estado.marcando.docId === docId ? estado.marcando : null })),
  marcar: (marcacao) => set({ marcando: marcacao }),
  pararDeMarcar: () => set({ marcando: null }),
}))
