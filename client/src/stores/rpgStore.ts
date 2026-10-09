import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { importarSistema as gravarSistemaImportado, listarSistemas } from '../lib/bibliotecaDeSistemas'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { SISTEMAS_EMBUTIDOS } from '../lib/sistemaOnePiece'

/**
 * Janelas da ficha de personagem e a biblioteca de sistemas em memória.
 *
 * Os DADOS (o sistema escolhido e os personagens) moram na aventura
 * (`adventureStore`); aqui fica só o que é da tela: qual ficha está aberta, se
 * a grade de sistemas está aberta e a lista de sistemas que a grade mostra.
 * Separado do painel para o botão "Abrir ficha" do token e a lista
 * "Personagens" abrirem a MESMA janela, montada uma vez só (`RpgDialogs`) —
 * e o "Livro de regras" (aba Jogo e ficha), idem. A grade de sistemas abre
 * pela janela Configurações do mapa.
 */
interface RpgState {
  /** Personagem com a ficha aberta, ou `null`. */
  personagemAberto: string | null
  /** A ficha abre já em edição: o personagem acabou de nascer. */
  abrirEditando: boolean
  sistemasAbertos: boolean
  /** O livro de regras do sistema da aventura está aberto (por cima da ficha, quando ela também está). */
  livroAberto: boolean
  /** Embutidos primeiro, depois os da pasta (`listarSistemas`). */
  biblioteca: SistemaDeRpg[]
  avisosDaBiblioteca: string[]
  /** A pasta já foi lida nesta execução: abrir a grade de novo não relê o disco. */
  bibliotecaLida: boolean

  abrirFicha: (personagemId: string, editando?: boolean) => void
  fecharFicha: () => void
  abrirSistemas: () => void
  fecharSistemas: () => void
  abrirLivro: () => void
  fecharLivro: () => void
  /** Lê a pasta da biblioteca uma vez. Fora do app instalado ficam só os embutidos, sem aviso. */
  carregarBiblioteca: () => Promise<void>
  /** O "+" da grade: grava o sistema do arquivo e o põe na lista. Lança com a razão. */
  importarSistema: (texto: string) => Promise<SistemaDeRpg>
}

export const useRpgStore = create<RpgState>()((set, get) => ({
  personagemAberto: null,
  abrirEditando: false,
  sistemasAbertos: false,
  livroAberto: false,
  biblioteca: [...SISTEMAS_EMBUTIDOS],
  avisosDaBiblioteca: [],
  bibliotecaLida: false,

  abrirFicha: (personagemId, editando = false) => set({ personagemAberto: personagemId, abrirEditando: editando }),
  fecharFicha: () => set({ personagemAberto: null, abrirEditando: false }),
  abrirSistemas: () => set({ sistemasAbertos: true }),
  fecharSistemas: () => set({ sistemasAbertos: false }),
  abrirLivro: () => set({ livroAberto: true }),
  fecharLivro: () => set({ livroAberto: false }),

  carregarBiblioteca: async () => {
    if (get().bibliotecaLida || !isTauri()) return
    const { sistemas, avisos } = await listarSistemas()
    set({ biblioteca: sistemas, avisosDaBiblioteca: avisos, bibliotecaLida: true })
  },

  importarSistema: async (texto) => {
    const sistema = await gravarSistemaImportado(texto)
    const atual = get().biblioteca
    const biblioteca = atual.some((existente) => existente.id === sistema.id)
      ? atual.map((existente) => (existente.id === sistema.id ? sistema : existente))
      : [...atual, sistema]
    set({ biblioteca })
    return sistema
  },
}))

/** O sistema da biblioteca com esse id; `undefined` quando ele não está neste computador. */
export function sistemaPorId(biblioteca: readonly SistemaDeRpg[], sistemaId: string | undefined): SistemaDeRpg | undefined {
  return sistemaId === undefined ? undefined : biblioteca.find((sistema) => sistema.id === sistemaId)
}
