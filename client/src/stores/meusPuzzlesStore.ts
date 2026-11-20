import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { desafioDoModelo, gravarMeusPuzzles, lerMeusPuzzles, MEUS_PUZZLES_DE_VERSAO_NOVA, MEUS_PUZZLES_NAO_LIDOS, modeloMudado, modeloNovo } from '../puzzles/meusPuzzles'
import type { ModeloDePuzzle, Puzzle } from '../puzzles/tipos'
import type { LugarDoDesafio } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * "MEUS PUZZLES" na tela (plano dos puzzles, §1.3). Como o acervo de itens
 * (`acervoDeItensStore`), fora do mapa e da aventura: é do app. A tela muda
 * na hora e o disco grava atrás; se a gravação falhar, a tela volta ao que o
 * disco tem e o erro sobe para o aviso de quem chamou.
 *
 * Salvar um modelo nunca toca nos mapas: as cópias que já estão nos lugares
 * ficam como estão. "Pôr no lugar" é o único caminho daqui ao mapa, e leva
 * uma cópia funda.
 */
interface MeusPuzzlesState {
  modelos: ModeloDePuzzle[]
  aviso: string | null
  /** Há disco e o índice foi lido: só então a tela oferece salvar e apagar. */
  podeGravar: boolean
  recarregar: () => Promise<void>
  /** "Salvar nos meus puzzles" / "Salvar como novo": modelo novo com o puzzle do editor. Devolve o modelo como ficou guardado. */
  salvarComoNovo: (puzzle: Puzzle) => Promise<ModeloDePuzzle>
  /** "Salvar no modelo": troca o puzzle do modelo `id`. Devolve o modelo como ficou guardado. */
  salvarNoModelo: (id: string, puzzle: Puzzle) => Promise<ModeloDePuzzle>
  /** Apaga o modelo. As cópias nos lugares continuam (a lista diz "o modelo foi apagado"). */
  apagarModelo: (id: string) => Promise<void>
  /**
   * "Pôr aqui": um desafio novo no mapa aberto, com a cópia do modelo e o
   * nome do puzzle. Devolve o id do desafio; `null` = o modelo não existe mais.
   */
  porNoLugar: (modeloId: string, lugar?: LugarDoDesafio) => string | null
}

export const PUZZLE_SEM_NOME = 'Dê um nome ao puzzle antes de salvar.'
export const MODELO_APAGADO = 'O modelo foi apagado. Use “Salvar como novo”.'

/** O nome é o que a lista e a cópia mostram ao mestre: sem ele o leitor trocaria por "Fonte" ao reabrir, e o modelo não voltaria igual. */
function exigirNome(puzzle: Puzzle): void {
  if (puzzle.nome.trim() === '') throw new Error(PUZZLE_SEM_NOME)
}

export const useMeusPuzzlesStore = create<MeusPuzzlesState>()((set, get) => {
  /** Troca a tela, grava; falhou, relê o disco e devolve o erro a quem chamou. */
  const gravar = async (proximos: ModeloDePuzzle[]): Promise<void> => {
    if (!get().podeGravar) throw new Error(get().aviso === MEUS_PUZZLES_DE_VERSAO_NOVA ? MEUS_PUZZLES_DE_VERSAO_NOVA : MEUS_PUZZLES_NAO_LIDOS)
    set({ modelos: proximos })
    try {
      await gravarMeusPuzzles(proximos)
    } catch (erro) {
      await get().recarregar()
      throw erro
    }
  }

  return {
    modelos: [],
    aviso: null,
    podeGravar: false,

    recarregar: async () => {
      // Fora do aplicativo não há disco: a lista fica vazia, sem aviso de erro sobre o que nem é oferecido.
      if (!isTauri()) {
        set({ modelos: [], aviso: null, podeGravar: false })
        return
      }
      const lido = await lerMeusPuzzles()
      set({ modelos: lido.modelos, aviso: lido.aviso, podeGravar: lido.lido })
    },

    salvarComoNovo: async (puzzle) => {
      exigirNome(puzzle)
      const modelo = modeloNovo(puzzle, Date.now())
      await gravar([...get().modelos, modelo])
      return modelo
    },

    salvarNoModelo: async (id, puzzle) => {
      exigirNome(puzzle)
      const { modelos } = get()
      const atual = modelos.find((modelo) => modelo.id === id)
      if (atual === undefined) throw new Error(MODELO_APAGADO)
      const mudado = modeloMudado(atual, puzzle, Date.now())
      await gravar(modelos.map((modelo) => (modelo.id === id ? mudado : modelo)))
      return mudado
    },

    apagarModelo: (id) => {
      const { modelos } = get()
      if (!modelos.some((modelo) => modelo.id === id)) return Promise.resolve()
      return gravar(modelos.filter((modelo) => modelo.id !== id))
    },

    porNoLugar: (modeloId, lugar) => {
      const modelo = get().modelos.find((candidato) => candidato.id === modeloId)
      if (modelo === undefined) return null
      const desafio = desafioDoModelo(modelo, crypto.randomUUID(), lugar)
      useMapStore.getState().addDesafio(desafio)
      return desafio.id
    },
  }
})
