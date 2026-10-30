import { create } from 'zustand'
import { gravarBibliotecaDeRegras, lerBibliotecaDeRegras } from '../lib/batalha/regrasDoCampoNoDisco'
import {
  bibliotecaDeRegrasVazia,
  blocosPorRankValido,
  NOME_DA_REGRA_MAX,
  NOME_DA_REGRA_PADRAO,
  novoIdDeRegra,
  REGRAS_MAX,
  TEXTO_DA_REGRA_MAX,
  type RegraDoCampo,
} from '../lib/batalha/regrasDoCampo'

/**
 * A BIBLIOTECA GLOBAL DE REGRAS DO CAMPO em memória (decisão 7 da batalha One
 * Piece). Molde de `bibliotecaDeSonsStore.ts`, sem migração: lê uma vez,
 * grava sozinha `ESPERA_PARA_GRAVAR_REGRAS_MS` depois da última mudança, e
 * fica FORA do Ctrl+Z e do "não salvo" da aventura — vale para todas.
 *
 * A regra que vale numa batalha é uma CÓPIA (`RegrasDaBatalha`, na
 * `batalhaStore`): mudar ou apagar aqui não mexe na batalha que já começou.
 */

export const ESPERA_PARA_GRAVAR_REGRAS_MS = 400
export const REGRAS_AINDA_LENDO = 'As regras do campo ainda estão sendo lidas. Tente de novo em instantes.'
export const REGRAS_NAO_GRAVAVEIS = 'As regras do campo não puderam ser lidas, então nada novo é guardado agora (para não apagar o que está no disco).'

/** O que o mestre escreve numa regra. */
export interface RascunhoDaRegra {
  nome: string
  blocosPorRank: number
  texto: string
}

interface RegrasDoCampoState {
  regras: RegraDoCampo[]
  carregando: boolean
  /** Há mudança esperando o relógio para ir ao disco. */
  pendente: boolean
  /** Frase pronta do último problema de leitura ou gravação; `null` = nenhum. */
  aviso: string | null
  /** `false` = o arquivo não foi lido (ou é de um app mais novo): nada novo é guardado. */
  podeGravar: boolean
  /** Lê o arquivo uma vez (as chamadas seguintes devolvem a mesma promessa). Nunca rejeita. */
  carregar: () => Promise<void>
  /** "Guardar na biblioteca": a regra nova, ou `null` (lendo, sem poder gravar, ou cheia). */
  criarRegra: (rascunho: RascunhoDaRegra) => RegraDoCampo | null
  /** Renomeia ou reescreve a regra. `false` = recusada ou não existe. */
  editarRegra: (id: string, mudanca: Partial<RascunhoDaRegra>) => boolean
  apagarRegra: (id: string) => boolean
  /** Grava já o que está esperando. Nunca rejeita: o erro vira `aviso`. */
  gravarAgora: () => Promise<void>
}

let temporizador: ReturnType<typeof setTimeout> | null = null
let carga: Promise<void> | null = null

function pararRelogio(): void {
  if (temporizador === null) return
  clearTimeout(temporizador)
  temporizador = null
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O rascunho nos tetos: nome vazio vira o padrão, blocos fora de 1..10 viram o padrão. */
function limpa(id: string, rascunho: RascunhoDaRegra): RegraDoCampo {
  const nome = rascunho.nome.trim().slice(0, NOME_DA_REGRA_MAX)
  return { id, nome: nome.length > 0 ? nome : NOME_DA_REGRA_PADRAO, blocosPorRank: blocosPorRankValido(rascunho.blocosPorRank), texto: rascunho.texto.slice(0, TEXTO_DA_REGRA_MAX) }
}

export const useRegrasDoCampoStore = create<RegrasDoCampoState>()((set, get) => {
  const podeMudar = (): boolean => !get().carregando && get().podeGravar

  /** Troca a lista e recomeça o relógio do salvamento. */
  const aplicar = (regras: RegraDoCampo[]): void => {
    set({ regras, pendente: true })
    pararRelogio()
    temporizador = setTimeout(() => {
      temporizador = null
      void get().gravarAgora() // nunca rejeita
    }, ESPERA_PARA_GRAVAR_REGRAS_MS)
  }

  return {
    regras: [],
    carregando: true,
    pendente: false,
    aviso: null,
    podeGravar: false,

    carregar: () => {
      if (carga !== null) return carga
      carga = lerBibliotecaDeRegras().then((lida) => {
        set({ regras: lida.biblioteca.regras, carregando: false, aviso: lida.aviso, podeGravar: lida.podeGravar })
      })
      return carga
    },

    criarRegra: (rascunho) => {
      const { regras } = get()
      if (!podeMudar() || regras.length >= REGRAS_MAX) return null
      const regra = limpa(novoIdDeRegra(), rascunho)
      aplicar([...regras, regra])
      return regra
    },

    editarRegra: (id, mudanca) => {
      const { regras } = get()
      const atual = regras.find((regra) => regra.id === id)
      if (!podeMudar() || atual === undefined) return false
      const nova = limpa(id, { nome: mudanca.nome ?? atual.nome, blocosPorRank: mudanca.blocosPorRank ?? atual.blocosPorRank, texto: mudanca.texto ?? atual.texto })
      if (nova.nome === atual.nome && nova.blocosPorRank === atual.blocosPorRank && nova.texto === atual.texto) return true
      aplicar(regras.map((regra) => (regra.id === id ? nova : regra)))
      return true
    },

    apagarRegra: (id) => {
      const { regras } = get()
      if (!podeMudar() || !regras.some((regra) => regra.id === id)) return false
      aplicar(regras.filter((regra) => regra.id !== id))
      return true
    },

    gravarAgora: async () => {
      pararRelogio()
      const { regras, pendente, podeGravar } = get()
      if (!pendente || !podeGravar) return
      set({ pendente: false })
      try {
        await gravarBibliotecaDeRegras({ ...bibliotecaDeRegrasVazia(), regras })
        set({ aviso: null })
      } catch (erro) {
        // Continua esperando: a próxima mudança tenta de novo.
        set({ pendente: true, aviso: mensagem(erro) })
      }
    },
  }
})
