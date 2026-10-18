import { DIFICULDADES_PESCA, type DificuldadePesca } from '../tipos'

/**
 * O que a tela da pesca lembra entre uma pesca e outra, neste aparelho: a
 * última dificuldade e o som ligado ou desligado. Mesma chave do protótipo.
 * Sem armazenamento (aba privada, cota cheia), segue com o padrão.
 */

export interface PreferenciasDaPesca {
  dif: DificuldadePesca
  som: boolean
}

export type ArmazemDaPesca = Pick<Storage, 'getItem' | 'setItem'>

const CHAVE = 'labirinto.pesca.prefs'
export const PREFERENCIAS_PADRAO: PreferenciasDaPesca = { dif: 'normal', som: true }

export function armazemDoNavegador(): ArmazemDaPesca | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function lerPreferencias(armazem: ArmazemDaPesca | null): PreferenciasDaPesca {
  if (armazem === null) return PREFERENCIAS_PADRAO
  try {
    const lido: unknown = JSON.parse(armazem.getItem(CHAVE) ?? 'null')
    if (typeof lido !== 'object' || lido === null) return PREFERENCIAS_PADRAO
    const { dif, som } = lido as Record<string, unknown>
    return {
      dif: DIFICULDADES_PESCA.find((d) => d === dif) ?? PREFERENCIAS_PADRAO.dif,
      som: typeof som === 'boolean' ? som : PREFERENCIAS_PADRAO.som,
    }
  } catch {
    return PREFERENCIAS_PADRAO
  }
}

export function gravarPreferencias(armazem: ArmazemDaPesca | null, prefs: PreferenciasDaPesca): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE, JSON.stringify(prefs))
  } catch {
    // Sem espaço ou sem permissão: vale só nesta pesca.
  }
}
