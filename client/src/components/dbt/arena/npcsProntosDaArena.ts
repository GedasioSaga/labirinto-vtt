import { create } from 'zustand'
import { carregarNpcsProntos } from '../../../lib/dbt/dados/npcsProntos'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { ND_SUGERIDO, personagemDoNpcPronto } from '../mundo/contasDoMundo'

/**
 * NPCS PRONTOS DO LIVRO NA ARENA DRAGON BALL: a ficha do NPC pronto
 * (`carregarNpcsProntos` + `npcProntoParaFicha` de `regras/npc.ts`, pela
 * mesma conversão do "Novo NPC") montada só na memória, sem ir para a pasta.
 * A montagem da arena guarda só o id; esta lista dá a ficha que o "Começar"
 * e o "Recomeçar" copiam. O id é estável (`idDoProntoNaArena`): trocar de
 * marcador e voltar acha a mesma escolha.
 *
 * Por livro (`sistemaId`): outro livro começa a lista do zero, como a sessão
 * da arena.
 */

const PREFIXO_DO_PRONTO = 'npc-pronto:'
const SEM_FICHAS: readonly Personagem[] = []

/** O id da ficha do NPC pronto na arena (nunca bate com o de uma ficha da pasta). */
export function idDoProntoNaArena(prontoId: string): string {
  return `${PREFIXO_DO_PRONTO}${prontoId}`
}

interface ProntosDaArenaState {
  sistemaId: string | null
  /** As fichas montadas dos NPCs prontos que já entraram na montagem. */
  fichas: readonly Personagem[]
  /** Os NPCs prontos (id do livro) cuja ficha está sendo montada. */
  carregando: readonly string[]
  erro: string | null
  /** Monta a ficha (uma vez por livro). `false` = não deu (o motivo fica em `erro`). */
  preparar: (sistemaId: string, sistema: SistemaDeRpg, prontoId: string) => Promise<boolean>
}

export const useProntosDaArenaDBT = create<ProntosDaArenaState>()((set, get) => ({
  sistemaId: null,
  fichas: SEM_FICHAS,
  carregando: [],
  erro: null,

  preparar: async (sistemaId, sistema, prontoId) => {
    if (get().sistemaId !== sistemaId) set({ sistemaId, fichas: SEM_FICHAS, carregando: [], erro: null })
    const id = idDoProntoNaArena(prontoId)
    if (get().fichas.some((ficha) => ficha.id === id)) return true
    set({ carregando: [...get().carregando, prontoId], erro: null })
    try {
      const npc = (await carregarNpcsProntos()).find((candidato) => candidato.id === prontoId)
      // O livro trocou enquanto baixava: a ficha seria de outro sistema.
      if (get().sistemaId !== sistemaId) return false
      if (npc === undefined) {
        set({ erro: 'Este NPC pronto não está mais no livro.' })
        return false
      }
      const ficha: Personagem = { ...personagemDoNpcPronto(sistema, npc, ND_SUGERIDO, npc.nome), id }
      set({ fichas: [...get().fichas.filter((outra) => outra.id !== id), ficha] })
      return true
    } catch {
      if (get().sistemaId === sistemaId) set({ erro: 'Não deu para abrir os NPCs prontos do livro. Tente de novo.' })
      return false
    } finally {
      if (get().sistemaId === sistemaId) set({ carregando: get().carregando.filter((outro) => outro !== prontoId) })
    }
  },
}))

/** As fichas dos NPCs prontos deste livro; outro livro, a mesma lista vazia (seletor estável). */
export function fichasProntasDoLivro(state: Pick<ProntosDaArenaState, 'sistemaId' | 'fichas'>, sistemaId: string): readonly Personagem[] {
  return state.sistemaId === sistemaId ? state.fichas : SEM_FICHAS
}
