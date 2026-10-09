import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import {
  comContaNova,
  comPinTrocado,
  comSoComConta,
  contasVazias,
  guardarPin,
  nomeDaContaLimpo,
  novoIdDeConta,
  pinValido,
  problemaDaNovaConta,
  semAparelho,
  semConta,
  TEXTO_DO_PROBLEMA,
  type ArquivoDeContas,
} from '../lib/contasDosJogadores'
import { gravarContas, lerContas } from '../lib/contasNoDisco'
import { criarPortaDasContas, type PortaDasContas } from '../net/entradaComConta'

const CONTAS_NAO_LIDAS = 'As contas dos jogadores não foram lidas: nada é gravado por cima.'

/**
 * CONTAS DOS JOGADORES na tela do mestre e na sala (`net/entradaComConta.ts`).
 * Como o acervo de itens (`acervoDeItensStore`): é do app, a tela muda na hora
 * e o disco grava atrás; se a gravação falhar, a tela volta ao que o disco tem
 * e o erro sobe a quem chamou.
 */
interface ContasState {
  arquivo: ArquivoDeContas
  aviso: string | null
  /** Há disco e o arquivo foi lido: só então a tela oferece criar, trocar e apagar. */
  podeGravar: boolean
  /** A primeira leitura já terminou (com ou sem disco). */
  lidas: boolean
  /** Lê uma vez; as chamadas seguintes esperam a mesma leitura. */
  carregar: () => Promise<void>
  recarregar: () => Promise<void>
  /** Aplica `mudar` ao arquivo de AGORA e grava. Lança com a frase pronta. */
  alterar: (mudar: (arquivo: ArquivoDeContas) => ArquivoDeContas) => Promise<void>
  criarConta: (nome: string, pin: string) => Promise<void>
  trocarPin: (contaId: string, pin: string) => Promise<void>
  apagarConta: (contaId: string) => Promise<void>
  esquecerAparelho: (contaId: string, aparelhoId: string) => Promise<void>
  definirSoComConta: (ligado: boolean) => Promise<void>
}

let leitura: Promise<void> | null = null

export const useContasStore = create<ContasState>()((set, get) => ({
  arquivo: contasVazias(),
  aviso: null,
  podeGravar: false,
  lidas: false,

  carregar: () => {
    leitura ??= get().recarregar()
    return leitura
  },

  recarregar: async () => {
    // Fora do aplicativo não há disco nem sala: ninguém tem conta.
    if (!isTauri()) {
      set({ arquivo: contasVazias(), aviso: null, podeGravar: false, lidas: true })
      return
    }
    const lidas = await lerContas()
    set({ arquivo: lidas.arquivo, aviso: lidas.aviso, podeGravar: lidas.lido, lidas: true })
  },

  alterar: async (mudar) => {
    if (!get().podeGravar) throw new Error(CONTAS_NAO_LIDAS)
    const antes = get().arquivo
    const proximo = mudar(antes)
    if (proximo === antes) return
    set({ arquivo: proximo })
    try {
      await gravarContas(proximo)
    } catch (erro) {
      await get().recarregar()
      throw erro
    }
  },

  criarConta: async (nome, pin) => {
    const problema = problemaDaNovaConta(get().arquivo, nome, pin)
    if (problema !== null) throw new Error(TEXTO_DO_PROBLEMA[problema])
    // O PBKDF2 leva uma fração de segundo: a conferência de nome repetido se repete depois dele.
    const guardado = await guardarPin(pin)
    await get().alterar((arquivo) => {
      const depois = problemaDaNovaConta(arquivo, nome, pin)
      if (depois !== null) throw new Error(TEXTO_DO_PROBLEMA[depois])
      return comContaNova(arquivo, { id: novoIdDeConta(), nome: nomeDaContaLimpo(nome), pin: guardado, aparelhos: [], criada: Date.now() })
    })
  },

  trocarPin: async (contaId, pin) => {
    if (!pinValido(pin)) throw new Error(TEXTO_DO_PROBLEMA.pin_invalido)
    const guardado = await guardarPin(pin)
    await get().alterar((arquivo) => comPinTrocado(arquivo, contaId, guardado))
  },

  apagarConta: (contaId) => get().alterar((arquivo) => semConta(arquivo, contaId)),

  esquecerAparelho: (contaId, aparelhoId) => get().alterar((arquivo) => semAparelho(arquivo, contaId, aparelhoId)),

  definirSoComConta: (ligado) => get().alterar((arquivo) => comSoComConta(arquivo, ligado)),
}))

/**
 * A porta da sala (`net/entradaComConta.ts`) sobre esta store: a ponte do jogo
 * de verdade a recebe (`App.tsx`). Uma por ponte: os freios de tentativa vivem nela.
 */
export function portaDasContasDoApp(): PortaDasContas {
  return criarPortaDasContas({
    prontas: () => useContasStore.getState().carregar(),
    ler: () => useContasStore.getState().arquivo,
    alterar: (mudar) => useContasStore.getState().alterar(mudar),
  })
}
