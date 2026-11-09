/**
 * A DIVISÃO DA SESSÃO LADO A LADO (fatia F3c, como o `Workspace.tsx` do
 * Grimório): quanto da largura é do roteiro e qual lado está recolhido. Fica
 * guardada por sessão neste PC (é conforto de quem usa, não dado da sessão).
 */

export type LadoRecolhido = 'nenhum' | 'roteiro' | 'quadro'

export interface Divisao {
  /** A parte do roteiro na largura, com os dois lados abertos (de MINIMA a MAXIMA). */
  readonly proporcao: number
  readonly recolhido: LadoRecolhido
}

export const PROPORCAO_MINIMA = 0.2
export const PROPORCAO_MAXIMA = 0.8
export const PASSO_DO_TECLADO = 0.05
export const DIVISAO_PADRAO: Divisao = { proporcao: 0.42, recolhido: 'nenhum' }

const PREFIXO = 'lb-preparo:lados-da-sessao:'

export function prenderProporcao(proporcao: number): number {
  if (!Number.isFinite(proporcao)) return DIVISAO_PADRAO.proporcao
  return Math.min(PROPORCAO_MAXIMA, Math.max(PROPORCAO_MINIMA, Math.round(proporcao * 1000) / 1000))
}

/** O que veio guardado, conferido: o que não serve volta ao padrão, campo por campo. */
export function lerDivisao(bruto: unknown): Divisao {
  if (typeof bruto !== 'object' || bruto === null) return DIVISAO_PADRAO
  const { proporcao, recolhido } = bruto as Record<string, unknown>
  return {
    proporcao: typeof proporcao === 'number' ? prenderProporcao(proporcao) : DIVISAO_PADRAO.proporcao,
    recolhido: recolhido === 'roteiro' || recolhido === 'quadro' ? recolhido : 'nenhum',
  }
}

/** O botão de recolher um lado: recolhe esse; se ele já estava recolhido, abre os dois. */
export function alternarLado(atual: LadoRecolhido, lado: Exclude<LadoRecolhido, 'nenhum'>): LadoRecolhido {
  return atual === lado ? 'nenhum' : lado
}

export function divisaoGuardada(sessaoId: string): Divisao {
  try {
    const texto = window.localStorage.getItem(PREFIXO + sessaoId)
    return texto === null ? DIVISAO_PADRAO : lerDivisao(JSON.parse(texto))
  } catch {
    return DIVISAO_PADRAO
  }
}

export function guardarDivisao(sessaoId: string, divisao: Divisao): void {
  try {
    window.localStorage.setItem(PREFIXO + sessaoId, JSON.stringify(divisao))
  } catch {
    // Sem armazenamento, a divisão só não é lembrada na próxima vez.
  }
}
