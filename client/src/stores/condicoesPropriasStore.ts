import { create } from 'zustand'
import type { CondicaoPropria } from '../types/map'
import { CATALOGO_MAX, lerCatalogoDeCondicoes, lerCondicaoPropria } from '../lib/condicoesProprias'

/**
 * A LISTA DE CONDIÇÕES QUE O MESTRE CRIOU (pedido de 09/11/2026). Fica neste
 * computador (`localStorage`), e não dentro de uma aventura: a condição
 * "Queimando" serve a toda cena, toda sessão e toda campanha que ele abrir
 * aqui. A marca posta numa ficha não depende desta lista — ela vai inteira
 * dentro do mapa (`Token.condicoesProprias`).
 */

const CHAVE = 'lb-condicoes-proprias'

/** Sem armazenamento (janela privada, dado bloqueado, teste sem DOM) ou com lixo gravado, a lista nasce vazia. */
function lerDoComputador(): CondicaoPropria[] {
  try {
    const cru = window.localStorage.getItem(CHAVE)
    return cru === null ? [] : lerCatalogoDeCondicoes(JSON.parse(cru))
  } catch {
    return []
  }
}

function gravarNoComputador(catalogo: readonly CondicaoPropria[]): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(catalogo))
  } catch {
    // Sem armazenamento a lista vale enquanto o app estiver aberto.
  }
}

interface CondicoesPropriasState {
  catalogo: readonly CondicaoPropria[]
  /** Cria, ou troca a que tem o mesmo id. `false` quando não gravou: condição que não passa na leitura, ou lista cheia. */
  salvar: (condicao: CondicaoPropria) => boolean
  excluir: (id: string) => void
}

export const useCondicoesPropriasStore = create<CondicoesPropriasState>()((set, get) => ({
  catalogo: lerDoComputador(),

  salvar: (condicao) => {
    const limpa = lerCondicaoPropria(condicao)
    if (limpa === null) return false
    const atual = get().catalogo
    const existe = atual.some((c) => c.id === limpa.id)
    if (!existe && atual.length >= CATALOGO_MAX) return false
    const catalogo = existe ? atual.map((c) => (c.id === limpa.id ? limpa : c)) : [...atual, limpa]
    set({ catalogo })
    gravarNoComputador(catalogo)
    return true
  },

  excluir: (id) => {
    const atual = get().catalogo
    if (!atual.some((c) => c.id === id)) return
    const catalogo = atual.filter((c) => c.id !== id)
    set({ catalogo })
    gravarNoComputador(catalogo)
  },
}))
