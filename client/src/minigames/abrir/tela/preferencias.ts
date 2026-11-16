/**
 * O que a tela dos jogos de abrir lembra entre uma vez e outra, neste
 * aparelho: o som ligado ou desligado (a dificuldade vem do mestre). Sem
 * armazenamento (aba privada, cota cheia), segue com o padrão. Mesmo jeito da
 * pesca (pesca/tela/preferencias.ts).
 */

export interface PreferenciasDeAbrir {
  som: boolean
}

export type ArmazemDeAbrir = Pick<Storage, 'getItem' | 'setItem'>

const CHAVE = 'labirinto.abrir.prefs'
export const PREFERENCIAS_PADRAO: PreferenciasDeAbrir = { som: true }

export function armazemDoNavegador(): ArmazemDeAbrir | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function lerPreferencias(armazem: ArmazemDeAbrir | null): PreferenciasDeAbrir {
  if (armazem === null) return PREFERENCIAS_PADRAO
  try {
    const lido: unknown = JSON.parse(armazem.getItem(CHAVE) ?? 'null')
    if (typeof lido !== 'object' || lido === null || !('som' in lido)) return PREFERENCIAS_PADRAO
    return { som: typeof lido.som === 'boolean' ? lido.som : PREFERENCIAS_PADRAO.som }
  } catch {
    return PREFERENCIAS_PADRAO
  }
}

export function gravarPreferencias(armazem: ArmazemDeAbrir | null, prefs: PreferenciasDeAbrir): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE, JSON.stringify(prefs))
  } catch {
    // Sem espaço ou sem permissão: vale só nesta vez.
  }
}
