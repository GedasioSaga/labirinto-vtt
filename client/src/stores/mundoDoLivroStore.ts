import { create } from 'zustand'
import { sincronizarVariacoes } from '../lib/livros/combate'
import { lerRpgDaPasta } from '../lib/pastasDeMapas'
import type { Personagem } from '../lib/personagem'
import { herdaDaPasta, useAdventureStore } from './adventureStore'
import { editarRpgDaPasta } from './rpgDaPasta'

/**
 * MUNDO DO LIVRO DE REGRAS (M1, docs/planos/livros-de-regras-plano.md §3):
 * estado de TELA — qual sistema e qual pasta (campanha) estão abertos, de onde
 * o mundo abriu e em que marcador. O DADO (as fichas) mora no `rpg.json` da
 * pasta; toda escrita passa por `editarRpgDaPasta`, que grava o disco e aplica
 * a mesma mudança à cópia aberta do editor. Não há segundo caminho.
 *
 * Quem lê as fichas é `usePersonagensDoMundo`: a cópia viva do editor quando
 * o mapa aberto herda DESTA pasta (com o HP da mesa ainda não salvo), senão a
 * cópia lida do disco (`daPasta`). Um dono só por situação.
 */

/** Os marcadores da M1. Os outros (Comparar, Saúde, Itens, Anotações) chegam com a fase deles. */
export type AbaDoMundo = 'jogadores' | 'npcs'

/** De onde o mundo abriu: a porta 04 da tela inicial, ou o atalho no livro do mestre (por cima do mapa). */
export type OrigemDoMundo = 'inicio' | 'editor'

export interface MundoAberto {
  sistemaId: string
  pastaId: string
  origem: OrigemDoMundo
}

/** Uma mudança na lista de fichas da pasta: recebe a do disco, devolve a nova (sem mutar). */
export type MudancaDoMundo = (personagens: Personagem[]) => Personagem[]

interface MundoDoLivroState {
  aberto: MundoAberto | null
  aba: AbaDoMundo
  /** As fichas da pasta como o disco tinha na última leitura ou gravação; `null` = ainda não lidas. */
  daPasta: Personagem[] | null
  /** A leitura da pasta falhou: a frase pronta. */
  erro: string | null
  /** Abre o mundo no primeiro marcador e lê a pasta. Nunca lança: a falha vira `erro`. */
  abrir: (aberto: MundoAberto) => Promise<void>
  fechar: () => void
  trocarAba: (aba: AbaDoMundo) => void
  /** Relê a pasta aberta do disco. Nunca lança: a falha vira `erro`. */
  recarregar: () => Promise<void>
  /**
   * Aplica a mudança às fichas da pasta aberta (disco e cópia do editor) e
   * sincroniza as variações com os modelos. Lança com a razão.
   */
  mudar: (mudanca: MudancaDoMundo) => Promise<void>
}

export const useMundoDoLivroStore = create<MundoDoLivroState>()((set, get) => {
  /** A leitura (ou gravação) que terminou ainda é da pasta aberta? O mestre pode ter fechado ou trocado no meio. */
  const aindaAberta = (pastaId: string): boolean => get().aberto?.pastaId === pastaId

  const recarregar = async (): Promise<void> => {
    const aberto = get().aberto
    if (aberto === null) return
    const lido = await lerRpgDaPasta(aberto.pastaId)
    if (!aindaAberta(aberto.pastaId)) return
    set(lido.ok ? { daPasta: lido.rpg.personagens, erro: null } : { daPasta: null, erro: lido.motivo })
  }

  return {
    aberto: null,
    aba: 'jogadores',
    daPasta: null,
    erro: null,

    abrir: async (aberto) => {
      set({ aberto, aba: 'jogadores', daPasta: null, erro: null })
      await recarregar()
    },
    fechar: () => set({ aberto: null, daPasta: null, erro: null }),
    trocarAba: (aba) => set({ aba }),
    recarregar,

    mudar: async (mudanca) => {
      const aberto = get().aberto
      if (aberto === null) return
      const gravado = await editarRpgDaPasta(aberto.pastaId, (rpg) => ({ ...rpg, personagens: sincronizarVariacoes(mudanca(rpg.personagens)) }))
      if (aindaAberta(aberto.pastaId)) set({ daPasta: gravado.personagens, erro: null })
    },
  }
})

/**
 * As fichas que as páginas do mundo mostram: a cópia viva do editor quando o
 * mapa aberto herda desta pasta, senão a lida do disco. `null` = ainda não
 * lidas (ou a leitura falhou: ver `erro`).
 */
export function usePersonagensDoMundo(): readonly Personagem[] | null {
  const aberto = useMundoDoLivroStore((state) => state.aberto)
  const daPasta = useMundoDoLivroStore((state) => state.daPasta)
  const viva = useAdventureStore((state) =>
    aberto !== null && state.pasta !== null && state.pasta.pastaId === aberto.pastaId && herdaDaPasta(state) ? state.pasta.personagens : null,
  )
  return viva ?? daPasta
}
