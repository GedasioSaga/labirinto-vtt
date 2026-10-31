import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import {
  CATALOGO_CHEIO,
  CATALOGO_MAX,
  itemLimpo,
  juntarDasFichas as juntarDasFichasDoCatalogo,
  type EntradaDoLivro,
  type ItemDoCatalogo,
} from '../lib/livros/catalogo'
import { entradasDoLivro } from '../lib/livros/catalogoDoLivro'
import { gravarCatalogo, lerCatalogo } from '../lib/livros/catalogoNoDisco'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'

/**
 * O CATÁLOGO DO LIVRO na tela (M3 do mundo do livro de regras): o do sistema
 * aberto no mundo, mais as perícias, vantagens e desvantagens lidas do livro
 * dele. Como o acervo de itens: a tela muda na hora e o disco grava atrás; se
 * a gravação falhar, a tela volta ao que o disco tem e o erro sobe para o
 * aviso de quem chamou. Nada daqui vai pela rede (só o mestre).
 */
interface CatalogoState {
  /** O sistema aberto; `null` = nenhum (o mundo fechado). */
  sistemaId: string | null
  /** As entradas do mestre (armas, habilidades, itens), na ordem do disco. */
  itens: ItemDoCatalogo[]
  /** As do livro do sistema (perícias, vantagens, desvantagens), só leitura. */
  doLivro: EntradaDoLivro[]
  aviso: string | null
  /** Há disco e o catálogo foi lido: só então a tela oferece criar, editar, apagar e juntar. */
  podeGravar: boolean
  /** Abre o catálogo do sistema: lê o livro na hora e o disco atrás. */
  abrir: (sistema: SistemaDeRpg) => Promise<void>
  recarregar: () => Promise<void>
  /** Cria ou troca a entrada (pelo id). Lança com a frase pronta (sem nome, catálogo cheio, disco). */
  salvarEntrada: (item: ItemDoCatalogo) => Promise<void>
  apagarEntrada: (id: string) => Promise<void>
  /** "Juntar das fichas da pasta": devolve quantas entradas novas entraram (0 = nada novo, sem gravar). */
  juntarDasFichas: (personagens: readonly Personagem[]) => Promise<number>
}

const SEM_NOME = 'A entrada precisa de um nome.'
const SEM_SISTEMA = 'Nenhum livro aberto.'
const NAO_LIDO = 'O catálogo do livro não foi lido do disco; nada foi gravado para não apagar o que está lá.'

export const useCatalogoStore = create<CatalogoState>()((set, get) => {
  /** Troca a tela, grava; falhou, relê o disco e devolve o erro a quem chamou. */
  const gravar = async (proximos: ItemDoCatalogo[]): Promise<void> => {
    const { sistemaId, podeGravar } = get()
    if (sistemaId === null) throw new Error(SEM_SISTEMA)
    if (!podeGravar) throw new Error(NAO_LIDO)
    set({ itens: proximos })
    try {
      await gravarCatalogo(sistemaId, proximos)
    } catch (erro) {
      await get().recarregar()
      throw erro
    }
  }

  /** Lê o disco do sistema; se outro sistema foi aberto no meio, a leitura velha é descartada. */
  const lerDoDisco = async (sistemaId: string): Promise<void> => {
    // Fora do aplicativo não há disco: o catálogo fica vazio, sem aviso de erro sobre o que nem é oferecido.
    if (!isTauri()) {
      set({ itens: [], aviso: null, podeGravar: false })
      return
    }
    const lido = await lerCatalogo(sistemaId)
    if (get().sistemaId !== sistemaId) return
    set({ itens: lido.itens, aviso: lido.aviso, podeGravar: lido.lido })
  }

  return {
    sistemaId: null,
    itens: [],
    doLivro: [],
    aviso: null,
    podeGravar: false,

    abrir: async (sistema) => {
      set({ sistemaId: sistema.id, itens: [], doLivro: entradasDoLivro(sistema), aviso: null, podeGravar: false })
      await lerDoDisco(sistema.id)
    },

    recarregar: async () => {
      const { sistemaId } = get()
      if (sistemaId !== null) await lerDoDisco(sistemaId)
    },

    salvarEntrada: (item) => {
      const limpo = itemLimpo(item)
      if (limpo === null) return Promise.reject(new Error(SEM_NOME))
      const { itens } = get()
      const existe = itens.some((atual) => atual.id === limpo.id)
      if (!existe && itens.length >= CATALOGO_MAX) return Promise.reject(new Error(CATALOGO_CHEIO))
      return gravar(existe ? itens.map((atual) => (atual.id === limpo.id ? limpo : atual)) : [...itens, limpo])
    },

    apagarEntrada: (id) => {
      const { itens } = get()
      if (!itens.some((item) => item.id === id)) return Promise.resolve()
      return gravar(itens.filter((item) => item.id !== id))
    },

    juntarDasFichas: async (personagens) => {
      const { itens } = get()
      const novos = juntarDasFichasDoCatalogo(personagens, itens)
      if (novos.length === 0) return 0
      await gravar([...itens, ...novos])
      return novos.length
    },
  }
})
