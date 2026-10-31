import { create } from 'zustand'
import { sincronizarVariacoes } from '../lib/livros/combate'
import { COMPARAR_MAX } from '../lib/livros/encontro'
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

/** Os marcadores da M2: Comparar e balancear, Saúde da ficha e Anotações. */
export type AbaDaM2 = 'comparar' | 'saude' | 'anotacoes'

/**
 * Os marcadores do mundo: os da M1, os da M2, Itens e habilidades (M3) e a
 * Arena de testes (docs/planos/batalha-arena-de-testes-plano.md).
 */
export type AbaDoMundo = 'jogadores' | 'npcs' | AbaDaM2 | 'itens' | 'arena'

/**
 * O Comparar (M2): estado de SESSÃO, nada em disco. Ids de personagem da
 * pasta aberta; id que sumiu da pasta é ignorado pelas contas
 * (lib/livros/encontro.ts). Zera a cada `abrir`.
 */
export interface EncontroDoComparar {
  /** As fichas lado a lado, na ordem em que foram escolhidas (máx. `COMPARAR_MAX`). */
  comparar: string[]
  /** Quem está no grupo (jogadores e NPCs aliados). */
  grupo: string[]
  /** NPC inimigo -> quantos (1 ou mais; 0 sai). */
  inimigos: Record<string, number>
}

/** De onde o mundo abriu: a porta 04 da tela inicial, ou o atalho no livro do mestre (por cima do mapa). */
export type OrigemDoMundo = 'inicio' | 'editor'

export interface MundoAberto {
  sistemaId: string
  pastaId: string
  origem: OrigemDoMundo
}

/** A ficha aberta na janela de ficha do app, por cima do mundo (`GavetaDaFicha`). */
export interface FichaAbertaNoMundo {
  personagemId: string
  /** Abre já em "Editar" (a ficha recém-criada, para dar nome e números). */
  editando: boolean
}

/** Uma mudança na lista de fichas da pasta: recebe a do disco, devolve a nova (sem mutar). */
export type MudancaDoMundo = (personagens: Personagem[]) => Personagem[]

interface MundoDoLivroState extends EncontroDoComparar {
  aberto: MundoAberto | null
  aba: AbaDoMundo
  /** As fichas da pasta como o disco tinha na última leitura ou gravação; `null` = ainda não lidas. */
  daPasta: Personagem[] | null
  /** A leitura da pasta falhou: a frase pronta. */
  erro: string | null
  /** O NPC no detalhe da página NPCs de combate; `null` = o primeiro da lista. Sobrevive à troca de marcador. */
  npcEscolhido: string | null
  fichaAberta: FichaAbertaNoMundo | null
  /** Abre o mundo no primeiro marcador e lê a pasta. Nunca lança: a falha vira `erro`. */
  abrir: (aberto: MundoAberto) => Promise<void>
  fechar: () => void
  trocarAba: (aba: AbaDoMundo) => void
  escolherNpc: (personagemId: string | null) => void
  abrirFicha: (personagemId: string, editando?: boolean) => void
  fecharFicha: () => void
  /** Relê a pasta aberta do disco. Nunca lança: a falha vira `erro`. */
  recarregar: () => Promise<void>
  /**
   * Aplica a mudança às fichas da pasta aberta (disco e cópia do editor) e
   * sincroniza as variações com os modelos. Uma gravação por vez, na ordem
   * pedida: duas seguidas (dois atalhos da força) não leem o mesmo disco e
   * perdem a primeira. Lança com a razão.
   */
  mudar: (mudanca: MudancaDoMundo) => Promise<void>
  /** Põe ou tira a ficha das colunas; cheia (`COMPARAR_MAX`) não põe mais. */
  alternarComparar: (personagemId: string) => void
  /** Põe ou tira a ficha do grupo (sai dos inimigos se estava lá). */
  alternarNoGrupo: (personagemId: string) => void
  /** Quantos deste NPC entre os inimigos; 0 ou menos tira (sai do grupo se estava lá). */
  quantosInimigos: (personagemId: string, quantidade: number) => void
  /** Esvazia grupo e inimigos (as colunas ficam). */
  limparEncontro: () => void
}

const ENCONTRO_VAZIO: EncontroDoComparar = { comparar: [], grupo: [], inimigos: {} }
/** Teto de cópias de um NPC no encontro: o passo da tela, não regra do jogo (o "+" do Comparar para aqui). */
export const INIMIGOS_POR_NPC_MAX = 20

function semChave(registro: Record<string, number>, chave: string): Record<string, number> {
  if (!(chave in registro)) return registro
  const { [chave]: _saiu, ...resto } = registro
  return resto
}

export const useMundoDoLivroStore = create<MundoDoLivroState>()((set, get) => {
  /** A leitura (ou gravação) que terminou ainda é da pasta aberta? O mestre pode ter fechado ou trocado no meio. */
  const aindaAberta = (pastaId: string): boolean => get().aberto?.pastaId === pastaId
  /** A fila das gravações: cada `mudar` espera a anterior terminar (com ou sem erro). */
  let fila: Promise<void> = Promise.resolve()

  const recarregar = async (): Promise<void> => {
    const aberto = get().aberto
    if (aberto === null) return
    const lido = await lerRpgDaPasta(aberto.pastaId)
    if (!aindaAberta(aberto.pastaId)) return
    set(lido.ok ? { daPasta: lido.rpg.personagens, erro: null } : { daPasta: null, erro: lido.motivo })
  }

  const gravar = async (pastaId: string, mudanca: MudancaDoMundo): Promise<void> => {
    const gravado = await editarRpgDaPasta(pastaId, (rpg) => ({ ...rpg, personagens: sincronizarVariacoes(mudanca(rpg.personagens)) }))
    if (aindaAberta(pastaId)) set({ daPasta: gravado.personagens, erro: null })
  }

  return {
    aberto: null,
    aba: 'jogadores',
    daPasta: null,
    erro: null,
    npcEscolhido: null,
    fichaAberta: null,

    abrir: async (aberto) => {
      set({ aberto, aba: 'jogadores', daPasta: null, erro: null, npcEscolhido: null, fichaAberta: null, ...ENCONTRO_VAZIO })
      await recarregar()
    },
    fechar: () => set({ aberto: null, daPasta: null, erro: null, npcEscolhido: null, fichaAberta: null }),
    trocarAba: (aba) => set({ aba }),
    escolherNpc: (personagemId) => set({ npcEscolhido: personagemId }),
    abrirFicha: (personagemId, editando = false) => set({ fichaAberta: { personagemId, editando } }),
    fecharFicha: () => set({ fichaAberta: null }),
    recarregar,

    mudar: (mudanca) => {
      const aberto = get().aberto
      if (aberto === null) return Promise.resolve()
      const vez = fila.then(() => gravar(aberto.pastaId, mudanca))
      fila = vez.then(
        () => undefined,
        () => undefined,
      )
      return vez
    },

    ...ENCONTRO_VAZIO,
    alternarComparar: (personagemId) =>
      set(({ comparar }) => {
        if (comparar.includes(personagemId)) return { comparar: comparar.filter((id) => id !== personagemId) }
        if (comparar.length >= COMPARAR_MAX) return {}
        return { comparar: [...comparar, personagemId] }
      }),
    alternarNoGrupo: (personagemId) =>
      set(({ grupo, inimigos }) =>
        grupo.includes(personagemId)
          ? { grupo: grupo.filter((id) => id !== personagemId) }
          : { grupo: [...grupo, personagemId], inimigos: semChave(inimigos, personagemId) },
      ),
    quantosInimigos: (personagemId, quantidade) =>
      set(({ grupo, inimigos }) => {
        const n = Number.isFinite(quantidade) ? Math.min(INIMIGOS_POR_NPC_MAX, Math.floor(quantidade)) : 0
        if (n <= 0) return { inimigos: semChave(inimigos, personagemId) }
        return { grupo: grupo.filter((id) => id !== personagemId), inimigos: { ...inimigos, [personagemId]: n } }
      }),
    limparEncontro: () => set({ grupo: [], inimigos: {} }),
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
