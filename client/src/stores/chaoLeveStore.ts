import { create } from 'zustand'

/**
 * CHÃO LEVE (válvula V do plano `otimizacao-200x200-2026-10-27.md`): troca o
 * chão em pedaços do Meio-Termo (`pixi/pedacosDoChao.ts`) pelo ladrilho
 * repetido do desenho de linhas, só no chão; o resto do Meio-Termo fica.
 * Preferência do APARELHO, como o som (`somStore`): mora no localStorage de
 * quem vê (o mestre no app, cada jogador no navegador dele) e nunca vai pela
 * rede. Nasce desligada.
 */

export const CHAVE_DO_CHAO_LEVE = 'lb-chao-leve'

/** O pedaço de `Storage` usado: o `localStorage` real ou um dublê nos testes. */
export type ArmazemDoChaoLeve = Pick<Storage, 'getItem' | 'setItem'>

/** Storage bloqueado, vazio ou adulterado: desligado, e nada lança. */
export function lerChaoLeve(armazem: ArmazemDoChaoLeve | null): boolean {
  if (armazem === null) return false
  try {
    return armazem.getItem(CHAVE_DO_CHAO_LEVE) === '1'
  } catch {
    return false
  }
}

/** Storage cheio ou bloqueado (aba anônima): a escolha vale só enquanto a página estiver aberta. */
export function gravarChaoLeve(armazem: ArmazemDoChaoLeve | null, ligado: boolean): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE_DO_CHAO_LEVE, ligado ? '1' : '0')
  } catch {
    // Sem persistência: segue com a escolha em memória.
  }
}

interface ChaoLeveState {
  ligado: boolean
  definir: (ligado: boolean) => void
}

/** Store com o armazém injetado, para o teste usar um dublê; o app usa `useChaoLeveStore`. */
export function criarChaoLeveStore(armazem: ArmazemDoChaoLeve | null) {
  return create<ChaoLeveState>()((set) => ({
    ligado: lerChaoLeve(armazem),
    definir: (ligado) => {
      set({ ligado })
      gravarChaoLeve(armazem, ligado)
    },
  }))
}

function armazemDoNavegador(): ArmazemDoChaoLeve | null {
  try {
    // Só ler `localStorage` já lança em iframe sem permissão ou com o dado do site bloqueado.
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const useChaoLeveStore = criarChaoLeveStore(armazemDoNavegador())

/** O chão leve está ligado neste aparelho? */
export function chaoLeveLigado(): boolean {
  return useChaoLeveStore.getState().ligado
}

/** A frase de ajuda, a mesma no mestre e no jogador. */
export const AJUDA_DO_CHAO_LEVE = 'Desenha o chão mais simples. Use se o mapa grande estiver lento.'
