import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { apagarSistema as apagarDoDisco, gravarSistema, importarSistema as gravarSistemaImportado, listarSistemas } from '../lib/bibliotecaDeSistemas'
import { copiaDoSistema } from '../lib/editorDeSistema'
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
 *
 * A biblioteca é também o caminho do sistema EDITADO até os jogadores: salvar
 * troca o objeto do sistema na lista, o `App` avisa as pontes da sala quando a
 * lista muda, e o host reenvia o `rpg.sistema` a quem o recebeu por referência
 * diferente (`net/hostSession.ts`, `personagensUpdate`).
 */

/** Como o editor de sistema abre: um sistema da biblioteca, ou um novo (em branco, ou cópia de outro). */
export type AberturaDoEditor = { tipo: 'editar'; sistema: SistemaDeRpg } | { tipo: 'novo'; copiaDe: SistemaDeRpg | null }

interface RpgState {
  /** Personagem com a ficha aberta, ou `null`. */
  personagemAberto: string | null
  /** A ficha abre já em edição: o personagem acabou de nascer. */
  abrirEditando: boolean
  sistemasAbertos: boolean
  /** O livro de regras do sistema da aventura está aberto (por cima da ficha, quando ela também está). */
  livroAberto: boolean
  /** O editor de sistema aberto (por cima da grade), ou `null`. */
  editorDeSistema: AberturaDoEditor | null
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
  abrirEditorDeSistema: (abertura: AberturaDoEditor) => void
  fecharEditorDeSistema: () => void
  /** Lê a pasta da biblioteca uma vez. Fora do app instalado ficam só os embutidos, sem aviso. */
  carregarBiblioteca: () => Promise<void>
  /** O "+" da grade: grava o sistema do arquivo e o põe na lista. Lança com a razão. */
  importarSistema: (texto: string) => Promise<SistemaDeRpg>
  /** O "Salvar" do editor: grava no disco e troca (ou acrescenta) na lista. Lança com a razão. */
  salvarSistema: (sistema: SistemaDeRpg) => Promise<void>
  /** O "Duplicar" da grade: grava a cópia (nome e id novos) e a devolve. Lança com a razão. */
  duplicarSistema: (sistema: SistemaDeRpg) => Promise<SistemaDeRpg>
  /** O "Apagar" da grade, já confirmado: tira do disco e da lista. Lança com a razão. */
  apagarSistema: (sistemaId: string) => Promise<void>
}

/** A lista com o sistema no lugar do de mesmo id, ou no fim. Sempre uma lista NOVA: é a troca de referência que avisa a sala. */
function comSistema(biblioteca: readonly SistemaDeRpg[], sistema: SistemaDeRpg): SistemaDeRpg[] {
  return biblioteca.some((existente) => existente.id === sistema.id)
    ? biblioteca.map((existente) => (existente.id === sistema.id ? sistema : existente))
    : [...biblioteca, sistema]
}

export const useRpgStore = create<RpgState>()((set, get) => ({
  personagemAberto: null,
  abrirEditando: false,
  sistemasAbertos: false,
  livroAberto: false,
  editorDeSistema: null,
  biblioteca: [...SISTEMAS_EMBUTIDOS],
  avisosDaBiblioteca: [],
  bibliotecaLida: false,

  abrirFicha: (personagemId, editando = false) => set({ personagemAberto: personagemId, abrirEditando: editando }),
  fecharFicha: () => set({ personagemAberto: null, abrirEditando: false }),
  abrirSistemas: () => set({ sistemasAbertos: true }),
  fecharSistemas: () => set({ sistemasAbertos: false }),
  abrirLivro: () => set({ livroAberto: true }),
  fecharLivro: () => set({ livroAberto: false }),
  abrirEditorDeSistema: (abertura) => set({ editorDeSistema: abertura }),
  fecharEditorDeSistema: () => set({ editorDeSistema: null }),

  carregarBiblioteca: async () => {
    if (get().bibliotecaLida || !isTauri()) return
    const { sistemas, avisos } = await listarSistemas()
    set({ biblioteca: sistemas, avisosDaBiblioteca: avisos, bibliotecaLida: true })
  },

  importarSistema: async (texto) => {
    const sistema = await gravarSistemaImportado(texto)
    set({ biblioteca: comSistema(get().biblioteca, sistema) })
    return sistema
  },

  salvarSistema: async (sistema) => {
    await gravarSistema(sistema)
    set({ biblioteca: comSistema(get().biblioteca, sistema) })
  },

  duplicarSistema: async (sistema) => {
    const copia = copiaDoSistema(sistema, get().biblioteca)
    await gravarSistema(copia)
    set({ biblioteca: comSistema(get().biblioteca, copia) })
    return copia
  },

  apagarSistema: async (sistemaId) => {
    await apagarDoDisco(sistemaId)
    set({ biblioteca: get().biblioteca.filter((sistema) => sistema.id !== sistemaId) })
  },
}))

/** O sistema da biblioteca com esse id; `undefined` quando ele não está neste computador. */
export function sistemaPorId(biblioteca: readonly SistemaDeRpg[], sistemaId: string | undefined): SistemaDeRpg | undefined {
  return sistemaId === undefined ? undefined : biblioteca.find((sistema) => sistema.id === sistemaId)
}
