/**
 * "HOJE NA SESSÃO" (lista de cenas, ideia 3): até cinco cenas que o mestre
 * fixou no topo da lista, na ordem em que fixou, e logo abaixo as últimas que
 * ele abriu. As fixadas são dado da CAMPANHA (vão no `adventure.json`, campo
 * `fixadas`); as recentes são conveniência deste computador (localStorage).
 *
 * Só contas aqui: quem grava é a store (fixadas) e a lista (recentes).
 */

/** Mais que isto deixa de ser "a sessão de hoje" e vira uma segunda lista. */
export const MAX_FIXADAS = 5

/** Quantas recentes a lista mostra. */
export const RECENTES_A_VISTA = 3

/** Quantas recentes ficam guardadas (sobra para quando uma delas for fixada ou apagada). */
const RECENTES_GUARDADAS = 8

/** A frase de quando a sexta não cabe: o que aconteceu e o que fazer. */
export const AVISO_FIXADAS_CHEIAS = `No máximo ${MAX_FIXADAS} cenas fixadas. Tire uma para pôr outra.`

/** O resultado de alternar: a lista nova, ou `cheia` quando a sexta não entrou (a lista volta igual). */
export interface Alternada {
  fixadas: string[]
  cheia: boolean
}

/** Fixa no fim (a ordem é a de quem fixou) ou tira; a sexta não entra. */
export function alternarFixada(fixadas: readonly string[], sceneId: string): Alternada {
  if (fixadas.includes(sceneId)) return { fixadas: fixadas.filter((id) => id !== sceneId), cheia: false }
  if (fixadas.length >= MAX_FIXADAS) return { fixadas: [...fixadas], cheia: true }
  return { fixadas: [...fixadas, sceneId], cheia: false }
}

/**
 * O campo `fixadas` do arquivo, tolerante: só ids de cena que existem, sem
 * repetir, no máximo cinco, na ordem do arquivo. Lixo e lista vazia = sem o
 * campo (a aventura antiga continua sem a chave).
 */
export function fixadasDoArquivo(bruto: unknown, cenas: ReadonlySet<string>): string[] | undefined {
  if (!Array.isArray(bruto)) return undefined
  const fixadas: string[] = []
  for (const id of bruto) {
    if (typeof id !== 'string' || !cenas.has(id) || fixadas.includes(id)) continue
    fixadas.push(id)
    if (fixadas.length === MAX_FIXADAS) break
  }
  return fixadas.length === 0 ? undefined : fixadas
}

/** A cena aberta vai para a frente das recentes (sem repetir); a lista guardada tem teto. */
export function lembrarRecente(recentes: readonly string[], sceneId: string): string[] {
  return [sceneId, ...recentes.filter((id) => id !== sceneId)].slice(0, RECENTES_GUARDADAS)
}

/**
 * As recentes que a lista mostra: sem as fixadas (já estão logo acima), sem a
 * aberta (clicar nela não levaria a lugar nenhum) e sem cena apagada.
 */
export function recentesAVista(recentes: readonly string[], fixadas: readonly string[], aberta: string | null, existem: ReadonlySet<string>): string[] {
  return recentes.filter((id) => id !== aberta && !fixadas.includes(id) && existem.has(id)).slice(0, RECENTES_A_VISTA)
}

/** Uma lista de ids guardada no localStorage: lixo (JSON torto, objeto, número) vira lista vazia. */
export function lerListaDeIds(bruto: string | null): string[] {
  if (bruto === null) return []
  try {
    const lido: unknown = JSON.parse(bruto)
    return Array.isArray(lido) ? lido.filter((id): id is string => typeof id === 'string' && id !== '') : []
  } catch {
    return []
  }
}
