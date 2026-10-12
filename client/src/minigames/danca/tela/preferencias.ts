import type { ModoTeclas } from '../entrada'

/**
 * PREFERÊNCIAS DA DANÇA neste aparelho: o atraso medido, o jeito das teclas e
 * o som do acerto. Moram no localStorage de quem dança (`labirinto.danca.v1`,
 * a mesma chave do protótipo) e nunca vão pela rede.
 */

export interface PreferenciasDaDanca {
  /** Positivo = os toques chegam depois do som (fone sem fio, TV): o jogo desconta. */
  ajusteMs: number
  teclas: ModoTeclas
  somAcerto: boolean
}

export const CHAVE_DAS_PREFERENCIAS = 'labirinto.danca.v1'
export const PREFERENCIAS_PADRAO: PreferenciasDaDanca = { ajusteMs: 0, teclas: 'setas', somAcerto: true }
/** Mais que isso não é atraso de fone, é engano: o ajuste à mão para aqui. */
export const AJUSTE_MAX_MS = 300

export type ArmazemDaDanca = Pick<Storage, 'getItem' | 'setItem'>

export function limitarAjuste(ms: number): number {
  if (!Number.isFinite(ms)) return 0
  return Math.min(AJUSTE_MAX_MS, Math.max(-AJUSTE_MAX_MS, Math.round(ms)))
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Storage bloqueado, vazio ou adulterado: cada campo torto volta ao padrão, e nada lança. */
export function lerPreferencias(armazem: ArmazemDaDanca | null): PreferenciasDaDanca {
  if (armazem === null) return { ...PREFERENCIAS_PADRAO }
  let dado: unknown
  try {
    const texto = armazem.getItem(CHAVE_DAS_PREFERENCIAS)
    if (texto === null) return { ...PREFERENCIAS_PADRAO }
    dado = JSON.parse(texto)
  } catch {
    return { ...PREFERENCIAS_PADRAO }
  }
  if (!isRecord(dado)) return { ...PREFERENCIAS_PADRAO }
  return {
    ajusteMs: typeof dado.ajusteMs === 'number' ? limitarAjuste(dado.ajusteMs) : PREFERENCIAS_PADRAO.ajusteMs,
    teclas: dado.teclas === 'dfjk' || dado.teclas === 'setas' ? dado.teclas : PREFERENCIAS_PADRAO.teclas,
    somAcerto: typeof dado.somAcerto === 'boolean' ? dado.somAcerto : PREFERENCIAS_PADRAO.somAcerto,
  }
}

/** Storage cheio ou bloqueado (aba anônima): vale só enquanto a página estiver aberta. */
export function gravarPreferencias(armazem: ArmazemDaDanca | null, prefs: PreferenciasDaDanca): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify(prefs))
  } catch {
    // Sem persistência: a escolha segue em memória.
  }
}

export function armazemDoNavegador(): ArmazemDaDanca | null {
  try {
    // Só ler `localStorage` já lança em iframe sem permissão ou com o dado do site bloqueado.
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
