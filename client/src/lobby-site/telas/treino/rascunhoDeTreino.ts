import type { Personagem } from '../../../lib/personagem'

/**
 * O RASCUNHO DE TREINO (fatia T7; achado Tr6 do plano: "rascunho de build
 * dito salvo sem fatia"): os números que a pessoa experimenta numa cópia da
 * ficha (atributos e máximos), guardados SÓ neste navegador, por mesa e por
 * ficha. Nunca vira op, nunca vai ao servidor e nunca muda a ficha de
 * verdade: o treino usa a cópia com o rascunho por cima. Recarregar a página
 * não perde; outro navegador não vê. Armazenamento bloqueado = o rascunho
 * vive só enquanto a página está aberta, e a tela diz isso.
 */

const VERSAO = 1
const PREFIXO = 'labirinto.lobby.rascunhoDeTreino'
/** O maior número que o rascunho aceita num campo (o mesmo teto largo de qualquer número da ficha no site). */
export const NUMERO_DO_RASCUNHO_MAX = 99_999

export interface RascunhoDeTreino {
  versao: typeof VERSAO
  fichaId: string
  /** Só os que mudaram: atributo → valor. */
  atributos: Record<string, number>
  /** Só os que mudaram: recurso → máximo. */
  maximos: Record<string, number>
  salvoEm: number
}

function chave(campanhaId: string, fichaId: string, demo: boolean): string {
  return `${PREFIXO}.${demo ? 'demo.' : ''}${campanhaId}.${fichaId}`
}

function numeroValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 && valor <= NUMERO_DO_RASCUNHO_MAX
}

function lerNumeros(valor: unknown): Record<string, number> | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const lidos: Record<string, number> = {}
  for (const [id, numero] of Object.entries(valor)) {
    if (!numeroValido(numero)) return null
    lidos[id] = numero
  }
  return lidos
}

function lerRascunhoDoTexto(texto: string, fichaId: string): RascunhoDeTreino | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (typeof bruto !== 'object' || bruto === null) return null
  const registro = bruto as Record<string, unknown>
  const atributos = lerNumeros(registro.atributos)
  const maximos = lerNumeros(registro.maximos)
  const salvoEm = registro.salvoEm
  if (registro.versao !== VERSAO || registro.fichaId !== fichaId || atributos === null || maximos === null || typeof salvoEm !== 'number') return null
  return { versao: VERSAO, fichaId, atributos, maximos, salvoEm }
}

/** O rascunho guardado; `null` = nenhum, torto, ou o navegador não deixa ler. */
export function lerRascunho(campanhaId: string, fichaId: string, demo: boolean): RascunhoDeTreino | null {
  try {
    const texto = window.localStorage.getItem(chave(campanhaId, fichaId, demo))
    return texto === null ? null : lerRascunhoDoTexto(texto, fichaId)
  } catch {
    return null
  }
}

/** Guarda; `false` = o navegador não deixou (modo privado, armazenamento cheio ou bloqueado). */
export function guardarRascunho(campanhaId: string, rascunho: RascunhoDeTreino, demo: boolean): boolean {
  try {
    window.localStorage.setItem(chave(campanhaId, rascunho.fichaId, demo), JSON.stringify(rascunho))
    return true
  } catch {
    return false
  }
}

export function apagarRascunho(campanhaId: string, fichaId: string, demo: boolean): void {
  try {
    window.localStorage.removeItem(chave(campanhaId, fichaId, demo))
  } catch {
    // Sem armazenamento: não havia o que apagar.
  }
}

export function rascunhoVazio(fichaId: string): RascunhoDeTreino {
  return { versao: VERSAO, fichaId, atributos: {}, maximos: {}, salvoEm: 0 }
}

/** O rascunho mexe em algo? */
export function rascunhoMuda(rascunho: RascunhoDeTreino | null): boolean {
  return rascunho !== null && (Object.keys(rascunho.atributos).length > 0 || Object.keys(rascunho.maximos).length > 0)
}

/** A cópia da ficha com o rascunho por cima; a ficha recebida não muda. */
export function comRascunho(doc: Personagem, rascunho: RascunhoDeTreino | null): Personagem {
  if (rascunho === null || !rascunhoMuda(rascunho)) return doc
  return { ...doc, atributos: { ...doc.atributos, ...rascunho.atributos }, maximos: { ...doc.maximos, ...rascunho.maximos } }
}
