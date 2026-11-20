import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { BIBLIOTECA_DE_VERSAO_NOVA, BIBLIOTECA_NAO_LIDA, documentoGuardado, documentoMudado, documentoNovo, gravarBiblioteca, lerBiblioteca } from '../documentos/biblioteca'
import type { Documento } from '../documentos/tipos'

/**
 * A BIBLIOTECA "DOCUMENTOS" na tela (plano §1.5). Como "Meus puzzles"
 * (`meusPuzzlesStore`), fora do mapa e da aventura: é do app. A tela muda na
 * hora e o disco grava atrás; se a gravação falhar, a tela volta ao que o
 * disco tem e o erro sobe para o aviso de quem chamou.
 *
 * Mexer num documento nunca toca nos mapas nem nas fichas: o papel no chão e
 * a linha da lista apontam para ele pelo id, e o host monta a leitura a
 * partir daqui na hora (`documentos/resolver.ts`).
 */
interface DocumentosState {
  documentos: Documento[]
  aviso: string | null
  /** Há disco e o índice foi lido: só então a tela oferece criar, salvar e apagar. */
  podeGravar: boolean
  recarregar: () => Promise<void>
  /** "Novo documento": grava e devolve o documento como ficou guardado. */
  criar: () => Promise<Documento>
  /** Troca o documento de mesmo id pelo do editor. Devolve o documento como ficou guardado. */
  salvar: (documento: Documento) => Promise<Documento>
  /** Apaga da biblioteca. Os papéis no mapa e as linhas das fichas ficam, e a tela diz que o mestre o apagou. */
  apagar: (id: string) => Promise<void>
}

export const DOCUMENTO_APAGADO = 'Este documento foi apagado da biblioteca.'
const DOCUMENTO_COM_ID_TORTO = 'Este documento não tem um id que dê para guardar.'

export const useDocumentosStore = create<DocumentosState>()((set, get) => {
  /** Troca a tela, grava; falhou, relê o disco e devolve o erro a quem chamou. */
  const gravar = async (proximos: Documento[]): Promise<void> => {
    if (!get().podeGravar) throw new Error(get().aviso === BIBLIOTECA_DE_VERSAO_NOVA ? BIBLIOTECA_DE_VERSAO_NOVA : BIBLIOTECA_NAO_LIDA)
    set({ documentos: proximos })
    try {
      await gravarBiblioteca(proximos)
    } catch (erro) {
      await get().recarregar()
      throw erro
    }
  }

  return {
    documentos: [],
    aviso: null,
    podeGravar: false,

    recarregar: async () => {
      // Fora do aplicativo não há disco: a lista fica vazia, sem aviso de erro sobre o que nem é oferecido.
      if (!isTauri()) {
        set({ documentos: [], aviso: null, podeGravar: false })
        return
      }
      const lida = await lerBiblioteca()
      set({ documentos: lida.documentos, aviso: lida.aviso, podeGravar: lida.lido })
    },

    criar: async () => {
      const documento = documentoNovo(Date.now())
      await gravar([documento, ...get().documentos])
      return documento
    },

    salvar: async (documento) => {
      const { documentos } = get()
      const atual = documentos.find((candidato) => candidato.id === documento.id)
      if (atual === undefined) throw new Error(DOCUMENTO_APAGADO)
      const guardado = documentoGuardado(documentoMudado(atual, documento, Date.now()))
      if (guardado === null) throw new Error(DOCUMENTO_COM_ID_TORTO)
      await gravar(documentos.map((candidato) => (candidato.id === documento.id ? guardado : candidato)))
      return guardado
    },

    apagar: (id) => {
      const { documentos } = get()
      if (!documentos.some((documento) => documento.id === id)) return Promise.resolve()
      return gravar(documentos.filter((documento) => documento.id !== id))
    },
  }
})
