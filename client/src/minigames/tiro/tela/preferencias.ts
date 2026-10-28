import { DIFICULDADES_TIRO, type DificuldadeTiro } from '../tipos'

/**
 * O que a barraca de tiro lembra entre uma visita e outra, neste aparelho: a
 * última dificuldade, o som e o realejo. Mesma chave do protótipo. Sem
 * armazenamento (aba privada, cota cheia), segue com o padrão.
 */

export interface PreferenciasDoTiro {
  dif: DificuldadeTiro
  som: boolean
  realejo: boolean
}

export type ArmazemDoTiro = Pick<Storage, 'getItem' | 'setItem'>

const CHAVE = 'labirinto.tiro.prefs'
export const PREFERENCIAS_PADRAO: PreferenciasDoTiro = { dif: 'normal', som: true, realejo: true }

export function armazemDoNavegador(): ArmazemDoTiro | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function lerPreferencias(armazem: ArmazemDoTiro | null): PreferenciasDoTiro {
  if (armazem === null) return PREFERENCIAS_PADRAO
  try {
    const lido: unknown = JSON.parse(armazem.getItem(CHAVE) ?? 'null')
    if (typeof lido !== 'object' || lido === null) return PREFERENCIAS_PADRAO
    const dif = 'dif' in lido ? lido.dif : undefined
    const som = 'som' in lido ? lido.som : undefined
    const realejo = 'realejo' in lido ? lido.realejo : undefined
    return {
      dif: DIFICULDADES_TIRO.find((d) => d === dif) ?? PREFERENCIAS_PADRAO.dif,
      som: typeof som === 'boolean' ? som : PREFERENCIAS_PADRAO.som,
      realejo: typeof realejo === 'boolean' ? realejo : PREFERENCIAS_PADRAO.realejo,
    }
  } catch {
    return PREFERENCIAS_PADRAO
  }
}

export function gravarPreferencias(armazem: ArmazemDoTiro | null, prefs: PreferenciasDoTiro): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE, JSON.stringify(prefs))
  } catch {
    // Sem espaço ou sem permissão: vale só nesta visita.
  }
}
